import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ForestRepository } from '../plugin/domain';
import type { ForestEntity, ForestState } from '../shared/model';
import { buildAgenda, buildForestContext, getRunWorkflow, getSopWorkflow, isCalendarDay, runProgress, WORKFLOW_FORMAT } from '../shared/workflow';

const template = () => ({ format: WORKFLOW_FORMAT, version: 1 as const, type: 'sop' as const, steps: [
  { id: 'prepare', title: '核对材料', instruction: '按实际情况记录', required: true },
  { id: 'optional', title: '补充检查', instruction: '', required: false },
] });
function fixture() {
  let saved: ForestState | null = null;
  const repo = new ForestRepository({ read: async () => structuredClone(saved), write: async state => { saved = structuredClone(state); } });
  return { repo, reopen: () => new ForestRepository({ read: async () => structuredClone(saved), write: async state => { saved = structuredClone(state); } }) };
}
async function prepared() {
  const { repo, reopen } = fixture();
  const project = await repo.create({ kind: 'project', title: '研究问题' });
  const sop = await repo.create({ kind: 'sop', title: '原始规程', projectId: project.id, content: '完整的旧版正文', data: { version: '1.0', forestWorkflow: template(), opaque: { keep: 42 } } });
  const request = { sopId: sop.id, expectedSopRevision: sop.revision, title: '待执行的实验', plannedDate: '2026-11-08', requestId: 'create-test-1' };
  const run = await repo.createRun(request);
  return { repo, reopen, project, sop, run, request };
}

test('SOP instantiation freezes source revision/content/steps without creating observations or scientific results', async () => {
  const { repo, reopen, project, sop, run, request } = await prepared();
  assert.equal(run.projectId, project.id);
  assert.equal(run.status, 'draft'); assert.equal(run.content, '');
  assert.equal(run.data.plannedDate, '2026-11-08'); assert.equal(run.data.date, undefined);
  const workflow = getRunWorkflow(run)!;
  assert.equal(workflow.source.sopRevision, 1); assert.equal(workflow.source.sopContent, sop.content);
  assert.equal(workflow.source.sopVersion, '1.0');
  assert.ok(workflow.steps.every(s => s.status === 'pending' && s.observation === '' && s.updatedAt === null));
  await repo.update({ id: sop.id, expectedRevision: 1, patch: { content: '更新后的正文', data: { ...sop.data, forestWorkflow: { ...template(), steps: [] } } } });
  assert.deepEqual((await repo.get(run.id))!.data.forestWorkflow, run.data.forestWorkflow);
  assert.deepEqual((await reopen().get(run.id))!.data, run.data);
  const revision = (await repo.snapshot()).revision;
  assert.equal((await repo.createRun(request)).id, run.id, 'lost response retry works even after the SOP changed');
  assert.equal((await repo.snapshot()).revision, revision, 'idempotent retry does not write');
  await assert.rejects(repo.createRun({ ...request, title: '另一项操作' }), /同一创建请求/);
  await assert.rejects(repo.createRun({ ...request, requestId: 'fresh-request' }), /SOP 已更新/);
});

test('legacy SOPs with no structure remain usable and native export/import preserves workflow and opaque data', async () => {
  const { repo, run } = await prepared();
  const plain = await repo.create({ kind: 'sop', title: '旧正文', content: '只有原文', data: { oldField: ['原始', '材料'], version: '旧版版本原文'.repeat(200) } });
  const empty = await repo.createRun({ sopId: plain.id, expectedSopRevision: 1, title: '旧版模板', requestId: 'plain-1', projectId: null });
  assert.equal(getRunWorkflow(empty)!.source.sopContent, '只有原文');
  assert.equal(getRunWorkflow(empty)!.source.sopVersion, plain.data.version, 'legacy version labels are never silently truncated');
  assert.deepEqual(runProgress(empty), { total: 0, done: 0, skipped: 0, pending: 0, nextStep: null });
  assert.equal(empty.projectId, undefined);
  const unknown = await repo.create({ kind: 'note', title: '兼容数据', data: { forestWorkflow: { format: 'unknown-future', version: 99, raw: '保留' } } });
  const destination = fixture().repo;
  await destination.import({ data: await repo.export(), expectedRevision: 0 });
  assert.deepEqual((await destination.get(run.id))!.data, run.data);
  assert.deepEqual((await destination.get(unknown.id))!.data, unknown.data);
  const opaqueSop = await repo.create({ kind: 'sop', title: '未来字段', data: { forestWorkflow: { format: 'experiment-forest/workflow', version: 2, raw: '保留' } } });
  await assert.rejects(repo.update({ id: opaqueSop.id, expectedRevision: 1, patch: { data: { forestWorkflow: template() } } }), /保留原文/);
  assert.deepEqual((await repo.update({ id: opaqueSop.id, expectedRevision: 1, patch: { content: '仅正文正常编辑' } })).data, opaqueSop.data);
});

test('generic CRUD cannot forge, remove or rewrite a run snapshot or execution checklist', async () => {
  const { repo, run } = await prepared();
  const workflow = getRunWorkflow(run)!;
  const initialRevision = (await repo.snapshot()).revision;
  for (const data of [{}, { ...run.data, forestWorkflow: { ...workflow, source: { ...workflow.source, sopContent: '被篡改' } } },
    { ...run.data, forestWorkflow: { ...workflow, steps: workflow.steps.map(s => ({ ...s, status: 'done', updatedAt: new Date().toISOString() })) } }]) {
    await assert.rejects(repo.update({ id: run.id, expectedRevision: 1, patch: { data } }));
  }
  await assert.rejects(repo.create({ kind: 'record', title: '伪运行', data: run.data }), /从 SOP 创建/);
  assert.equal((await repo.snapshot()).revision, initialRevision);
  const edited = await repo.update({ id: run.id, expectedRevision: 1, patch: { content: '人工记录的观察', data: { ...run.data, plannedDate: '2026-11-09', custom: '保留其他编辑' } } });
  assert.equal(edited.content, '人工记录的观察');
  assert.deepEqual(getRunWorkflow(edited), workflow);
});

test('execution changes use optimistic revisions, skip reasons and required-step completion guards', async () => {
  const { repo, run } = await prepared();
  await assert.rejects(repo.update({ id: run.id, expectedRevision: 1, patch: { status: 'completed' } }), /必需步骤/);
  await assert.rejects(repo.updateRunStep({ id: run.id, expectedRevision: 1, stepId: 'prepare', status: 'skipped', observation: ' ' }), /跳过步骤/);
  const outcomes = await Promise.allSettled([
    repo.updateRunStep({ id: run.id, expectedRevision: 1, stepId: 'prepare', status: 'done', observation: '实际检查情况' }),
    repo.updateRunStep({ id: run.id, expectedRevision: 1, stepId: 'optional', status: 'done', observation: '并发写入' }),
  ]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  const done = (await repo.get(run.id))!;
  assert.deepEqual(runProgress(done), { total: 2, done: 1, skipped: 0, pending: 1, nextStep: template().steps[1] });
  assert.ok(getRunWorkflow(done)!.steps[0]!.updatedAt);
  const noChange = await repo.updateRunStep({ id: done.id, expectedRevision: done.revision, stepId: 'prepare', status: 'done', observation: '实际检查情况' });
  assert.equal(noChange.revision, done.revision);
  const skipped = await repo.updateRunStep({ id: done.id, expectedRevision: done.revision, stepId: 'optional', status: 'skipped', observation: '本次不适用，人工说明' });
  assert.equal(runProgress(skipped).nextStep, null);
  const completed = await repo.update({ id: run.id, expectedRevision: skipped.revision, patch: { status: 'completed' } });
  assert.equal(completed.content, '', 'completion never invents a result');
  await assert.rejects(repo.updateRunStep({ id: run.id, expectedRevision: completed.revision, stepId: 'prepare', status: 'pending', observation: '' }), /已完成或归档/);
});

test('AI provenance survives edits and server enforces review before approval, completion or recorded execution', async () => {
  const { repo } = fixture();
  const sop = await repo.create({ kind: 'sop', title: 'AI 草稿', data: { forestWorkflow: template(), provenance: { source: 'deepseek-harness', reviewStatus: 'unreviewed', trace: 'original' } } });
  await assert.rejects(repo.update({ id: sop.id, expectedRevision: 1, patch: { status: 'approved' } }), /人工核对/);
  await assert.rejects(repo.update({ id: sop.id, expectedRevision: 1, patch: { data: { forestWorkflow: template() } } }), /AI 来源/);
  await assert.rejects(repo.update({ id: sop.id, expectedRevision: 1, patch: { data: { ...sop.data, provenance: { source: 'human', reviewStatus: 'reviewed' } } } }), /AI 来源/);
  const approved = await repo.update({ id: sop.id, expectedRevision: 1, patch: { status: 'approved', data: { ...sop.data, provenance: { source: 'deepseek-harness', reviewStatus: 'reviewed', trace: 'original' } } } });
  const run = await repo.createRun({ sopId: sop.id, expectedSopRevision: approved.revision, title: '新运行仍待核对', requestId: 'ai-run' });
  assert.equal((run.data.provenance as Record<string, unknown>).reviewStatus, 'unreviewed');
  assert.equal(getRunWorkflow(run)!.source.provenance!.reviewStatus, 'reviewed');
  await assert.rejects(repo.updateRunStep({ id: run.id, expectedRevision: 1, stepId: 'prepare', status: 'done', observation: '' }), /人工核对/);
  const reviewed = await repo.update({ id: run.id, expectedRevision: 1, patch: { data: { ...run.data, provenance: { ...(run.data.provenance as Record<string, never>), reviewStatus: 'reviewed' } } } });
  assert.equal((await repo.updateRunStep({ id: run.id, expectedRevision: reviewed.revision, stepId: 'prepare', status: 'done', observation: '已人工执行' })).revision, 3);
});

test('workflow validation rejects duplicate steps, wrong kinds, forged source references and malformed run archives', async () => {
  const { repo, run } = await prepared();
  await assert.rejects(repo.create({ kind: 'sop', title: '重复', data: { forestWorkflow: { ...template(), steps: [template().steps[0]!, template().steps[0]!] } } }), /唯一|unique/);
  await assert.rejects(repo.create({ kind: 'note', title: '错误类型', data: { forestWorkflow: template() } }), /类型/);
  const exported = await repo.export();
  const archivedRun = exported.entities.find(e => e.id === run.id)!;
  (archivedRun.data.forestWorkflow as unknown as { steps: unknown[] }).steps = [];
  await assert.rejects(fixture().repo.previewImport({ data: exported }), /工作流/);
  assert.equal(getSopWorkflow(run), null);
});

test('calendar agenda is deterministic, excludes ended/archived work and does not substitute experiment dates', async () => {
  const { repo, project, run } = await prepared();
  await repo.create({ kind: 'plan', title: '逾期', projectId: project.id, data: { plannedDate: '2026-11-07' } });
  await repo.create({ kind: 'plan', title: '未来', data: { plannedDate: '2026-11-10' } });
  await repo.create({ kind: 'plan', title: '无日期' });
  await repo.create({ kind: 'plan', title: '已完成', status: 'completed', data: { plannedDate: '2026-11-07' } });
  await repo.create({ kind: 'record', title: '实际日期不是计划', data: { date: '2026-11-08' } });
  await repo.create({ kind: 'note', title: 'AI待核对', projectId: project.id, data: { provenance: { source: 'deepseek-harness', reviewStatus: 'unreviewed' } } });
  let agenda = buildAgenda((await repo.snapshot()).entities, { today: '2026-11-08' });
  assert.deepEqual(agenda.today.map(e => e.id), [run.id]);
  assert.deepEqual(agenda.overdue.map(e => e.title), ['逾期']);
  assert.deepEqual(agenda.upcoming.map(e => e.title), ['未来']);
  assert.deepEqual(agenda.undated.map(e => e.title), ['无日期']);
  assert.equal(agenda.review.length, 1);
  await repo.archive({ id: project.id, expectedRevision: 1 });
  agenda = buildAgenda((await repo.snapshot()).entities, { today: '2026-11-08' });
  assert.equal(agenda.today.length, 0); assert.equal(agenda.overdue.length, 0); assert.equal(agenda.review.length, 0);
  assert.equal(isCalendarDay('2026-02-30'), false); assert.equal(isCalendarDay('2024-02-29'), true); assert.equal(isCalendarDay('1900-02-29'), false);
  assert.throws(() => buildAgenda([], { today: '2026-02-30' }));
});

test('bounded context separates frozen source revisions from live references and reports body truncation', async () => {
  const { repo, sop, run } = await prepared();
  await repo.update({ id: sop.id, expectedRevision: 1, patch: { content: '新正文'.repeat(2000) } });
  const note = await repo.create({ kind: 'note', title: '关联观察', data: { relatedRecordId: run.id } });
  const context = await repo.context({ id: run.id, maxChars: 1000 });
  assert.equal(context.entries[0]!.workflowSource!.revision, 1);
  assert.equal(context.entries.find(e => e.id === sop.id)!.revision, 2);
  assert.equal(context.entries.find(e => e.id === note.id)!.relation, 'backlink');
  assert.ok(context.entries.reduce((sum, e) => sum + e.content.text.length + e.data.text.length, 0) <= 1000);
  assert.equal(context.truncated, true);
  assert.equal((await repo.get(sop.id))!.content.length, 6000);
  await assert.rejects(repo.context({ id: run.id, maxChars: 999 }));
  await assert.rejects(repo.context({ id: 'missing' }), /不存在/);
});

test('context diagnostic metadata stays bounded even with thousands of project members or missing references', () => {
  const base: ForestEntity = { id: 'project', kind: 'project', title: '大项目', status: 'active', content: '', data: {}, tags: [], revision: 1, createdAt: '2026-11-08', updatedAt: '2026-11-08' };
  const children = Array.from({ length: 2000 }, (_, index): ForestEntity => ({ ...base, id: `note-${index}`, kind: 'note', projectId: base.id }));
  const context = buildForestContext({ revision: 3, entities: [base, ...children] }, { id: base.id, maxItems: 1 });
  assert.equal(context.omittedTotal, 2000); assert.equal(context.omittedIds.length, 100); assert.equal(context.omittedIdsTruncated, true);
  const broken = { ...base, id: 'record', kind: 'record' as const, data: { relatedSamples: children.map(e => e.id) } };
  const missing = buildForestContext({ revision: 0, entities: [broken] }, { id: broken.id });
  assert.equal(missing.missingTotal, 2000); assert.equal(missing.missingIds.length, 100); assert.equal(missing.missingIdsTruncated, true);
});

test('a cancelled run creation cannot commit, and failed observers cannot undo durable business writes', async () => {
  const { repo, sop } = await prepared();
  const before = (await repo.snapshot()).revision;
  await assert.rejects(repo.createRun({ sopId: sop.id, expectedSopRevision: sop.revision, title: '已取消', requestId: 'aborted-run' }, AbortSignal.abort()));
  assert.equal((await repo.snapshot()).revision, before);
  let saved: ForestState | null = null;
  const observed = new ForestRepository({ read: async () => saved, write: async state => { saved = state; } }, () => { throw new Error('mirror unavailable'); });
  assert.equal((await observed.create({ kind: 'note', title: '已保存' })).revision, 1);
  assert.equal((await observed.snapshot()).revision, 1);
});


test('manually created records with a planned date enter the agenda without treating undated old records as pending work', async () => {
  const repo = new ForestRepository({ read: async () => null, write: async () => {} });
  const today = await repo.create({ kind: 'record', title: '手工排期记录', data: { plannedDate: '2026-11-08' } });
  const undated = await repo.create({ kind: 'record', title: '旧记录' });
  const invalid = { ...undated, id: 'invalid-date', data: { plannedDate: '2026-02-30' } };
  const completed = { ...today, id: 'completed', status: 'completed' };
  const agenda = buildAgenda([today, undated, invalid, completed], { today: '2026-11-08' });
  assert.deepEqual(agenda.today.map(e => e.id), [today.id]);
  assert.equal(agenda.undated.length, 0);
});
