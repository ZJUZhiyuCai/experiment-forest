import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ForestEntity } from '../shared/model';
import { createMarkdownReport } from '../shared/report';

const at = '2026-11-08T02:00:00.000Z';
function entry(id: string, kind: ForestEntity['kind'], patch: Partial<ForestEntity> = {}): ForestEntity {
  return { id, kind, title: id, content: '', data: {}, status: 'draft', revision: 1, tags: [], createdAt: at, updatedAt: at, ...patch };
}

test('project reading report includes archived direct entries, not unrelated project bodies', () => {
  const project = entry('p1', 'project');
  const records = [project, entry('r1', 'record', { projectId: 'p1', content: 'COMPLETE BODY', status: 'archived' }),
    entry('s1', 'sample', { projectId: 'p1' }), entry('r2', 'record', { projectId: 'p2', content: 'UNRELATED BODY' })];
  const report = createMarkdownReport(project, records, at);
  assert.equal(report.entityCount, 3);
  assert.match(report.text, /COMPLETE BODY/);
  assert.match(report.text, /archived/);
  assert.doesNotMatch(report.text, /UNRELATED BODY/);
});

test('individual report preserves full text and data, while reference index distinguishes missing and current revisions', () => {
  const record = entry('r1', 'record', { content: ' x\n'.repeat(2000), data: {
    sopId: 'sop1', relatedSamples: ['missing'], unknown: { nested: [null, false, 'original'] },
    provenance: { source: 'deepseek-harness', reviewStatus: 'unreviewed' },
  } });
  const sop = entry('sop1', 'sop', { title: 'current SOP', content: 'DO NOT COPY RELATED BODY', revision: 9 });
  const before = structuredClone(record);
  const report = createMarkdownReport(record, [record, sop], at);
  assert.equal(report.entityCount, 1);
  assert.ok(report.text.includes(record.content));
  assert.ok(report.text.includes(JSON.stringify(record.data, null, 2)));
  assert.match(report.text, /r9/);
  assert.match(report.text, /当前快照中缺失/);
  assert.doesNotMatch(report.text, /DO NOT COPY RELATED BODY/);
  assert.deepEqual(record, before);
});

test('user text containing fences and HTML stays literal, title cannot create report markup or path traversal', () => {
  const record = entry('r1', 'record', { title: '../../<script>\n# [run](file:///bad)', content: '```\n<script>alert(1)</script>\n````' });
  const report = createMarkdownReport(record, [record], at);
  assert.match(report.text, /`````text\n```\n<script>alert\(1\)<\/script>\n````\n`````/);
  assert.ok(report.text.split('\n')[0]?.includes('&lt;script&gt;'));
  assert.ok(!/[<>:"/\\|?*\u0000-\u001f]/.test(report.filename));
  assert.ok(!report.filename.startsWith('.'));
  assert.ok(report.filename.endsWith('-2026-11-08.md'));
});

test('report uses the selected saved revision and rejects invalid generation time', () => {
  const current = entry('r1', 'record', { title: 'saved', revision: 3 });
  assert.match(createMarkdownReport(current, [entry('r1', 'record', { title: 'stale' })], at).text, /修订：r3/);
  assert.throws(() => createMarkdownReport(current, [], 'not-a-date'), /生成时间/);
});

test('execution report keeps the frozen method and manual observations distinct from the current SOP', () => {
  const step = { id: 'step1', title: '检查', instruction: '原始方法', required: true };
  const record = entry('run', 'record', { data: { sopId: 'sop1', forestWorkflow: {
    format: 'experiment-forest/workflow', version: 1, type: 'run', requestId: 'request1', requestHash: 'a'.repeat(64),
    source: { sopId: 'sop1', sopRevision: 1, sopTitle: '方法初稿', sopContent: 'FROZEN METHOD', sopStatus: 'draft', sopVersion: 'v1', provenance: null, steps: [step] },
    steps: [{ stepId: 'step1', status: 'skipped', observation: 'USER REASON', updatedAt: at }],
  } } });
  const report = createMarkdownReport(record, [record, entry('sop1', 'sop', { revision: 2, content: 'NEW METHOD' })], at);
  assert.match(report.text, /冻结快照/);
  assert.match(report.text, /FROZEN METHOD/);
  assert.match(report.text, /USER REASON/);
  assert.match(report.text, /已做 0 \/ 1，跳过 1，待处理 0/);
  assert.doesNotMatch(report.text, /NEW METHOD/);
});
