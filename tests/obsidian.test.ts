import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ForestEntity, ForestSnapshot, JsonObject } from '../shared/model';
import { createObsidianMirror } from '../shared/obsidian';

const at = '2026-11-08T02:00:00.000Z', folder = 'Experiment Forest-123456789abc';
function entity(id: string, kind: ForestEntity['kind'] = 'record', patch: Partial<ForestEntity> = {}): ForestEntity {
  return { id, kind, title: '相同标题', content: '', data: {}, status: 'draft', revision: 1, tags: [], createdAt: at, updatedAt: at, ...patch };
}
const snapshot = (...entities: ForestEntity[]): ForestSnapshot => ({ revision: 4, entities });
const meta = (content: string) => JSON.parse(content.split('\n---\n')[0]!.slice(4)) as Record<string, unknown>;
const notes = (input: ForestSnapshot, root = folder) => createObsidianMirror(input, undefined, root).files.filter(file => file.path.startsWith('entities/'));

test('all six kinds get complete notes and scoped links close over generated files, including archived cross-project references', () => {
  const p = entity('p1', 'project'), p2 = entity('p2', 'project');
  const sop = entity('s1', 'sop', { projectId: p2.id, status: 'archived' });
  const sample = entity('s2', 'sample', { projectId: p2.id });
  const record = entity('r1', 'record', { projectId: p.id, data: { sopId: sop.id, relatedSamples: [sample.id] } });
  const input = snapshot(p, p2, sop, sample, record, entity('n1', 'note', { data: { relatedRecordId: record.id } }), entity('plan1', 'plan'));
  const output = createObsidianMirror(input, at, folder);
  assert.equal(output.entityCount, 7); assert.equal(output.fileCount, output.files.length);
  const paths = new Set(output.files.map(file => `${folder}/${file.path.replace(/\.md$/, '')}`));
  for (const file of output.files) for (const match of file.content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) assert.ok(paths.has(match[1]!), match[1]);
  const recordFile = output.files.find(file => file.path.startsWith('entities/') && meta(file.content).id === 'r1')!;
  assert.match(recordFile.content, /已归档/); assert.match(recordFile.content, /被引用/);
  assert.ok(recordFile.content.includes(JSON.stringify(record.data, null, 2)));
  const p2File = output.files.find(file => file.path.startsWith('entities/') && meta(file.content).id === 'p2')!;
  assert.match(p2File.content, /\|样本\]\]/);
});

test('case-sensitive IDs and duplicate titles stay distinct on case-insensitive filesystems; title changes do not rename files', () => {
  const entries = [entity('a'), entity('A'), entity('a:b'), entity('a.b'), entity('Z'.repeat(128))];
  const before = notes(snapshot(...entries));
  const after = notes(snapshot(...entries.map(e => ({ ...e, title: 'renamed / [x] : #?' }))));
  assert.deepEqual(before.map(f => f.path), after.map(f => f.path));
  assert.equal(new Set(before.map(f => f.path.toLowerCase())).size, entries.length);
  for (const file of before) {
    assert.ok(file.path.split('/').every(part => part.length <= 255));
    assert.match(file.path, /^entities\/ef-[a-z2-7]+\.md$/);
  }
});

test('JSON frontmatter resists YAML injection and preserves original labels; incompatible tags remain in forest_tags', () => {
  const original = entity('r1', 'record', { title: '---\ntags: [bad]\n[[escape]] <script>x</script>', tags: ['实验', 'has space', '123', 'a/b', 'x:y', 'my_tag'] });
  const file = notes(snapshot(original))[0]!;
  assert.equal(meta(file.content).title, original.title);
  assert.deepEqual(meta(file.content).forest_tags, original.tags);
  assert.deepEqual(meta(file.content).tags, ['experiment-forest', '实验', 'a/b', 'my_tag']);
  assert.equal(meta(file.content).revision, 1);
  assert.match(file.content, /&lt;script&gt;/);
});

test('readable paragraphs cannot activate original HTML or embedding and adaptive fences retain full body and JSON', () => {
  const original = entity('r1', 'record', { content: ' x  \n<img src="https://external.invalid/a">\n![[outside]]\n```\n`````\n[run](javascript:alert(1))',
    data: { unknown: { nested: [null, false, '  raw trailing  '] }, source: { original: '<script>x</script>' } } });
  const file = notes(snapshot(original))[0]!;
  const readable = file.content.split('## 正文\n')[1]!.split('<details>')[0]!;
  assert.doesNotMatch(readable, /<img|!\[\[|javascript:alert\(1\)/);
  assert.ok(file.content.includes(`\n${original.content}\n`));
  assert.ok(file.content.includes(JSON.stringify(original.data, null, 2)));
  assert.match(file.content, /``````text/);
});

test('AI and frozen workflow source remain visible separately from current SOP', () => {
  const workflow: JsonObject = { format: 'experiment-forest/workflow', version: 1, type: 'run', requestId: 'request1', requestHash: 'a'.repeat(64),
    source: { sopId: 's1', sopRevision: 2, sopTitle: '旧方法', sopContent: '实际依据的旧方法', sopStatus: 'approved', sopVersion: '1.0',
      provenance: { source: 'deepseek-harness', reviewStatus: 'reviewed' }, steps: [{ id: 'step1', title: '测量', instruction: '按原始方法测量', required: true }] },
    steps: [{ stepId: 'step1', status: 'done', observation: '真实输入；未作验证', updatedAt: at }] };
  const record = entity('r1', 'record', { data: { forestWorkflow: workflow, provenance: { source: 'deepseek-harness', reviewStatus: 'unreviewed' } } });
  const file = notes(snapshot(record, entity('s1', 'sop', { title: '现在的方法', revision: 9, content: '新的方法' }))).find(f => meta(f.content).id === 'r1')!;
  assert.equal(meta(file.content).needs_review, true);
  assert.match(file.content, /固定修订 r2/); assert.match(file.content, /真实输入；未作验证/);
  assert.ok(file.content.includes(JSON.stringify(record.data, null, 2)));
  assert.match(file.content, /现在的方法/); assert.doesNotMatch(file.content, /新的方法/);
});

test('missing references remain explicit text without misleading empty notes; empty snapshots still have useful indexes and Bases', () => {
  const record = entity('r1', 'record', { projectId: 'missing', data: { sopId: 'also-missing', relatedSamples: ['missing-sample'] } });
  const output = createObsidianMirror(snapshot(record), undefined, folder);
  assert.equal(output.entityCount, 1); assert.match(notes(snapshot(record))[0]!.content, /本次镜像缺失/);
  const empty = createObsidianMirror(snapshot(), undefined, folder);
  assert.equal(empty.entityCount, 0); assert.equal(empty.files.filter(f => f.path.startsWith('entities/')).length, 0);
  assert.match(empty.files.find(f => f.path === 'README.md')!.content, /不是双向同步/);
  const base = JSON.parse(empty.files.find(f => f.path === 'Forest.base')!.content);
  assert.deepEqual(base.filters.and, ['file.ext == "md"', 'note.forest_mirror == true', 'file.folder == if(this.file.folder, this.file.folder + "/entities", "entities")']);
  assert.equal(base.formulas.entry, 'file.asLink(note.title)');
  assert.equal(base.properties['formula.entry'].displayName, '资料');
  assert.ok(base.views.every((v: { type: string; order: string[] }) => v.type === 'table' && v.order[0] === 'formula.entry' && !v.order.includes('file.name') && !v.order.includes('note.title')));
});

test('two profile folders namespace all generated links even when imported records have the same IDs', () => {
  const input = snapshot(entity('p1', 'project'), entity('r1', 'record', { projectId: 'p1' }));
  const first = notes(input, 'Experiment Forest-111111111111');
  const second = notes(input, 'Experiment Forest-222222222222');
  assert.deepEqual(first.map(f => f.path), second.map(f => f.path));
  for (const file of first) assert.doesNotMatch(file.content, /Experiment Forest-222222222222/);
  for (const file of second) assert.doesNotMatch(file.content, /Experiment Forest-111111111111/);
  assert.match(String(meta(first.find(f => meta(f.content).id === 'r1')!.content).project), /Experiment Forest-111111111111\/entities\//);
});

test('Bases project column uses the true project title as display text, never interpolated wiki syntax', () => {
  const project = entity('p1', 'project', { title: '研究 A | ]] <img src=x>\n# unsafe' });
  const result = createObsidianMirror(snapshot(project, entity('r1', 'record', { projectId: 'p1' })), undefined, folder);
  const record = result.files.find(f => f.path.startsWith('entities/') && meta(f.content).id === 'r1')!;
  const properties = meta(record.content);
  assert.equal(properties.project_title, project.title);
  assert.match(String(properties.project_path), /^Experiment Forest-[a-f0-9]+\/entities\/ef-[a-z2-7]+\.md$/);
  assert.doesNotMatch(String(properties.project), /unsafe|\]\] </);
  const base = JSON.parse(result.files.find(f => f.path === 'Forest.base')!.content);
  assert.match(base.formulas.project_entry, /link\(note.project_path, note.project_title\)/);
  assert.ok(base.views.every((view: { order: string[] }) => view.order.includes('formula.project_entry')));
});

test('generation is deterministic, detached, complete, and rejects unsafe or duplicate identity and lossy JSON', () => {
  const input = snapshot(entity('r2'), entity('r1', 'record', { content: 'FULL '.repeat(30000) }));
  const before = structuredClone(input);
  const output = createObsidianMirror(input, undefined, folder);
  assert.deepEqual(input, before);
  assert.deepEqual(output, createObsidianMirror({ ...input, entities: [...input.entities].reverse() }, undefined, folder));
  assert.ok(output.files.some(file => file.content.includes(input.entities[1]!.content)));
  assert.throws(() => createObsidianMirror(snapshot(entity('../escape'))), /ID/);
  assert.throws(() => createObsidianMirror(snapshot(entity('r1'), entity('r1'))), /duplicate/);
  assert.throws(() => createObsidianMirror(input, undefined, '../vault'), /folder/);
  assert.throws(() => createObsidianMirror(input, 'not-a-date'), /time/);
  assert.throws(() => createObsidianMirror(snapshot(entity('r1', 'record', { data: { invalid: NaN } }))), /JSON/);
});
