import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import { ForestRepository } from '../plugin/domain';
import { createForestTools } from '../plugin/tools';
import { compareRows, createPayload, draftFromEntity, draftMatchesEntity, isDirty, newDraft, rebase, semanticEqual, updatePatch, validate } from '../client/drafts';
import { FIELDS, fieldString, provenanceOf } from '../client/forest-model';
import { EntityEditor } from '../client/EntityEditor';
import type { ForestEntity, ForestState } from '../shared/model';

function repository() {
  let state: ForestState | null = null;
  return new ForestRepository({ read: async () => structuredClone(state), write: async value => { state = structuredClone(value); } });
}

test('editor payload clears dates, project and references with null/empty arrays and preserves unknown data', async () => {
  const repo = repository();
  const project = await repo.create({ kind: 'project', title: '课题' });
  const sop = await repo.create({ kind: 'sop', title: '流程' });
  const sample = await repo.create({ kind: 'sample', title: '样本' });
  const source = await repo.create({ kind: 'record', title: '实验记录', projectId: project.id,
    data: { date: '2026-11-07', sopId: sop.id, relatedSamples: [sample.id], instrumentReadings: { raw: [1, 2, 3] } } });
  const draft = draftFromEntity(source);
  draft.fields.date = '';
  draft.fields.sopId = '';
  draft.refs.relatedSamples = [];
  draft.projectId = '';
  const patch = updatePatch(draft);
  assert.deepEqual(patch, { projectId: null, data: { date: null, sopId: null, relatedSamples: [], instrumentReadings: { raw: [1, 2, 3] } } });
  const saved = await repo.update({ id: source.id, expectedRevision: draft.base!.revision, patch });
  assert.equal(saved.projectId, undefined);
  assert.equal(saved.data.date, null);
  assert.equal(saved.data.sopId, null);
  assert.deepEqual(saved.data.relatedSamples, []);
  assert.deepEqual(saved.data.instrumentReadings, source.data.instrumentReadings);
  assert.equal(source.data.date, '2026-11-07', 'building a patch must not mutate the original entity');
});

test('untouched compatibility fields are not copied, clearing them suppresses fallback without destroying legacy evidence', async () => {
  const repo = repository();
  const source = await repo.create({ kind: 'sample', title: '样本', data: { storage: { location: '历史冰箱 A' }, sampleCode: 'old-code', untouched: '原文' } });
  const draft = draftFromEntity(source);
  assert.equal(draft.fields.location, '历史冰箱 A');
  assert.equal(draft.fields.sampleId, 'old-code');
  draft.title = '更正的样本标题';
  assert.deepEqual(updatePatch(draft), { title: '更正的样本标题' });
  draft.fields.location = '';
  const patch = updatePatch(draft);
  assert.deepEqual(patch.data, { storage: { location: '历史冰箱 A' }, sampleCode: 'old-code', untouched: '原文', location: null });
  const saved = await repo.update({ id: source.id, expectedRevision: draft.base!.revision, patch });
  const location = FIELDS.sample.find(field => field.key === 'location')!;
  assert.equal(fieldString(saved.data, location), '');
  assert.deepEqual(saved.data.storage, { location: '历史冰箱 A' });
});

test('new entity payloads contain visible input only and no fabricated QC or verification facts', async () => {
  const repo = repository();
  const record = newDraft('record', null);
  record.title = '  新记录  ';
  const payload = createPayload(record);
  assert.equal(payload.title, '新记录');
  assert.equal(payload.status, 'draft');
  assert.equal(payload.data.date, record.fields.date);
  assert.equal(payload.data.qualityControl, undefined);
  assert.equal(payload.data.dataValidation, undefined);
  record.fields.date = '';
  assert.deepEqual(createPayload(record).data, {});
  const saved = await repo.create(createPayload(record));
  assert.equal(saved.data.date, undefined);
  const sample = newDraft('sample', null);
  sample.title = '新样本';
  assert.deepEqual(createPayload(sample).data, {});
});

test('stale editor keeps its base revision so server rejects overwriting a concurrent edit', async () => {
  const repo = repository();
  const base = await repo.create({ kind: 'note', title: '初始标题', content: '初始正文' });
  const draft = draftFromEntity(base);
  draft.content = '我未保存的正文';
  const concurrent = await repo.update({ id: base.id, expectedRevision: base.revision, patch: { title: '另一端修改' } });
  assert.equal(draft.base!.revision, 1);
  assert.equal(concurrent.revision, 2);
  await assert.rejects(repo.update({ id: draft.id!, expectedRevision: draft.base!.revision, patch: updatePatch(draft) }), /其他操作修改/);
  assert.equal(draft.content, '我未保存的正文');
  assert.equal((await repo.get(base.id))!.content, '初始正文');
});

test('rebase retains local edits, adopts newer server fields and submits the latest expectedRevision', async () => {
  const repo = repository();
  const base = await repo.create({ kind: 'sample', title: '样本', data: { location: 'A', instrumentNotes: { raw: 'v1' } } });
  const draft = draftFromEntity(base);
  draft.fields.location = 'B';
  draft.content = '本地补充观察';
  const latest = await repo.update({ id: base.id, expectedRevision: 1, patch: { title: '远端更正标题', data: { location: 'A', instrumentNotes: { raw: 'v2', added: true } } } });
  const merged = rebase(draft, latest);
  assert.equal(merged.base!.revision, latest.revision);
  assert.equal(merged.title, latest.title);
  assert.equal(merged.content, '本地补充观察');
  assert.equal(merged.fields.location, 'B');
  assert.equal(isDirty(merged), true);
  const patch = updatePatch(merged);
  assert.deepEqual(patch.data, { location: 'B', instrumentNotes: { raw: 'v2', added: true } });
  const saved = await repo.update({ id: merged.id!, expectedRevision: merged.base!.revision, patch });
  assert.equal(saved.revision, 3);
  assert.equal(saved.title, '远端更正标题');
  assert.equal(saved.content, '本地补充观察');
});

test('client date validation accepts clearing but rejects real calendar errors before save', () => {
  const draft = newDraft('project', null);
  draft.title = '计划';
  draft.fields.startDate = '2026-02-30';
  assert.ok(validate(draft, new Set()).startDate);
  draft.fields.startDate = '2026-11-07';
  draft.fields.endDate = '2026-11-06';
  assert.ok(validate(draft, new Set()).endDate);
  draft.fields.startDate = '';
  draft.fields.endDate = '';
  assert.deepEqual(validate(draft, new Set()), {});
});

test('real AI tool provenance is recognized and unreviewed record completion is disabled in the editor', async () => {
  const repo = repository();
  const tool = createForestTools(repo).find(def => def.name === 'forest_create_draft')!;
  const entity = await tool.execute({ kind: 'record', title: '待核对假设', content: '需人工确认' }, { signal: new AbortController().signal } as ToolRunContext) as ForestEntity;
  const provenance = provenanceOf(entity);
  assert.equal(provenance.isAi, true);
  assert.equal(provenance.needsReview, true);
  const noop = () => {};
  const markup = renderToStaticMarkup(createElement(EntityEditor, {
    draft: draftFromEntity(entity), entities: [entity], byId: new Map([[entity.id, entity]]),
    onChange: noop, onSave: noop, onClose: noop, onDiscard: noop, onLoadLatest: noop,
    onRebase: noop, onCheckUncertain: noop, onConfirmSaved: noop, onOpen: noop, headingRef: createRef<HTMLHeadingElement>(),
  }));
  assert.match(markup, /待人工核对/);
  assert.match(markup, /DeepSeek Harness/);
  const completeOption = markup.match(/<option\b[^>]*value="completed"[^>]*>/)?.[0];
  assert.ok(completeOption, 'completed status remains visible');
  assert.match(completeOption, /\bdisabled(?:=|\s|>)/);
  const reviewed: ForestEntity = { ...entity, data: { provenance: { source: 'deepseek-harness', reviewStatus: 'reviewed' } } };
  assert.equal(provenanceOf(reviewed).isAi, true);
  assert.equal(provenanceOf(reviewed).needsReview, false);
});

test('uncertain save verification compares the complete body rather than equal-length matching summaries', async () => {
  const repo = repository();
  const prefix = '相同前缀'.repeat(20);
  const base = await repo.create({ kind: 'note', title: '需要准确核对', content: `${prefix}原始A` });
  const draft = draftFromEntity(base);
  draft.content = `${prefix}本地B`;
  const different = { ...base, revision: 2, content: `${prefix}远端C` };
  assert.equal(draft.content.length, different.content.length);
  const row = compareRows(draft, different, id => id).find(item => item.label === '正文')!;
  assert.equal(row.mine, row.latest, 'the display summary intentionally collides in this regression fixture');
  assert.equal(draftMatchesEntity(draft, different), false, 'different unsaved suffix must retain the draft');
  assert.equal(draftMatchesEntity(draft, { ...different, content: draft.content }), true);
});

test('uncertain save verification distinguishes explicit null clearing from missing fields with legacy fallback', async () => {
  const repo = repository();
  const base = await repo.create({ kind: 'sample', title: '原位置应被清空', data: { storage: { location: '旧冰箱 A' } } });
  const draft = draftFromEntity(base);
  draft.fields.location = '';
  const stillOld = { ...base, revision: 2 };
  assert.equal(fieldString(stillOld.data, FIELDS.sample.find(field => field.key === 'location')!), '旧冰箱 A');
  assert.equal(draftMatchesEntity(draft, stillOld), false);
  const saved = { ...stillOld, data: { ...stillOld.data, location: null } };
  assert.equal(draftMatchesEntity(draft, saved), true);
  assert.equal(semanticEqual({ location: null }, {}), false);
  assert.equal(semanticEqual({ samples: [] }, { samples: null }), false);
});

test('uncertain save verification preserves unknown JSON values and significant whitespace, independent of key order', async () => {
  const repo = repository();
  const base = await repo.create({ kind: 'note', title: '原始仪器字符串', data: { instrument: { raw: ' signal ', scale: 1 }, metadata: 'unchanged' } });
  const draft = draftFromEntity(base);
  draft.content = '补充说明';
  const reordered = { ...base, revision: 2, content: draft.content, data: { metadata: 'unchanged', instrument: { scale: 1, raw: ' signal ' } } };
  assert.equal(draftMatchesEntity(draft, reordered), true);
  assert.equal(draftMatchesEntity(draft, { ...reordered, data: { ...reordered.data, instrument: { scale: 1, raw: 'signal' } } }), false);
  assert.equal(semanticEqual(' signal ', 'signal'), false);
});

test('explicit review records only reviewed status and preserves AI origin and original provenance fields', async () => {
  const repo = repository();
  const base = await repo.create({ kind: 'record', title: 'AI草稿', status: 'draft', data: { provenance: { source: 'deepseek-harness', reviewStatus: 'unreviewed', trace: 'original-trace' }, rawEvidence: '原文' } });
  const draft = draftFromEntity(base);
  draft.markReviewed = true;
  draft.status = 'completed';
  assert.deepEqual(validate(draft, new Set()), {});
  const patch = updatePatch(draft);
  assert.deepEqual(patch.data?.provenance, { source: 'deepseek-harness', reviewStatus: 'reviewed', trace: 'original-trace' });
  assert.equal(patch.data?.rawEvidence, '原文');
  const saved = await repo.update({ id: base.id, expectedRevision: draft.base!.revision, patch });
  assert.equal(saved.status, 'completed');
  assert.equal(provenanceOf(saved).isAi, true);
  assert.equal(provenanceOf(saved).needsReview, false);
  assert.equal(draftMatchesEntity(draft, saved), true);
});
