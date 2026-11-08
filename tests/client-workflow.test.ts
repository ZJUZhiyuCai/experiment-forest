import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { ForestRepository } from '../plugin/domain';
import type { ForestApi, ForestEntity, ForestState, JsonObject } from '../shared/model';
import { getRunWorkflow, WORKFLOW_FORMAT, type CreateRunInput } from '../shared/workflow';
import * as memory from '../client/draftMemory';
import type { RunRequestDraft, StepDraft } from '../client/draftMemory';
import { checkRun, checkStep, editStep, loadStepLatest, submitRun, type ActionCtx } from '../client/runActions';
import { draftFromEntity, rebase, updatePatch } from '../client/drafts';

let sequence = 0;
function session(t: TestContext): string {
  const key = memory.sessionKeyOf(`workflow-race-${++sequence}`);
  t.after(() => {
    for (const draft of Object.values(memory.getRuns(key))) { memory.markInflight(key, `run:${draft.key}`, false); memory.dropRun(key, draft.key); }
    for (const draft of Object.values(memory.getSteps(key))) { memory.markInflight(key, `step:${draft.key}`, false); memory.dropStep(key, draft.key); }
    for (const draft of Object.values(memory.getDrafts(key))) { memory.markInflight(key, draft.key, false); memory.dropDraft(key, draft.key); }
    memory.takeNotices(key); memory.setNav(key, null);
  });
  return key;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function repository(): ForestRepository {
  let persisted: ForestState | null = null;
  return new ForestRepository({ read: async () => structuredClone(persisted), write: async state => { persisted = structuredClone(state); } });
}
function actionContext(repo: ForestRepository, overrides: Partial<ForestApi> = {}) {
  const unused = async (): Promise<never> => { throw new Error('Unexpected Obsidian call in workflow test'); };
  const applied: ForestEntity[] = [];
  const opened: ForestEntity[] = [];
  const notices: string[] = [];
  const api: ForestApi = {
    list: filter => repo.list(filter), get: id => repo.get(id), snapshot: () => repo.snapshot(),
    create: input => repo.create(input), update: input => repo.update(input), archive: input => repo.archive(input),
    createRun: input => repo.createRun(input), updateRunStep: input => repo.updateRunStep(input), context: input => repo.context(input),
    export: () => repo.export(), previewImport: input => repo.previewImport(input), import: input => repo.import(input),
    createPage:unused,getPage:unused,savePage:unused,decideProposal:unused,confirmPageBlock:unused,beginMaterial:unused,appendMaterial:unused,finishMaterial:unused,cancelMaterial:unused,readMaterial:unused,
    obsidianStatus: unused, configureObsidian: unused, syncObsidian: unused, ...overrides,
  };
  const ctx: ActionCtx = { api, applyEntity: entity => { applied.push(entity); }, refresh: async () => true,
    notify: (_session, text) => { notices.push(text); }, openCreated: (_session, entity) => { opened.push(entity); } };
  return { ctx, applied, opened, notices };
}
async function sopFixture(repo: ForestRepository) {
  const project = await repo.create({ kind: 'project', title: '客户端软件验收' });
  const sop = await repo.create({ kind: 'sop', title: '软件测试流程', projectId: project.id, content: '测试数据，不是科研方法或结论',
    data: { forestWorkflow: { format: WORKFLOW_FORMAT, version: 1, type: 'sop', steps: [
      { id: 'step-one', title: '检查软件状态', instruction: '仅软件测试', required: true },
    ] } } });
  return { project, sop };
}
function runForm(sop: ForestEntity): RunRequestDraft {
  return { key: sop.id, sopId: sop.id, title: '本次软件运行', projectId: sop.projectId ?? null, plannedDate: '2026-11-08', attempt: null, phase: 'editing' };
}
function uncertainForm(sop: ForestEntity, requestId: string): RunRequestDraft {
  const form = runForm(sop);
  return { ...form, phase: 'uncertain', attempt: { requestId, sopRevision: sop.revision, title: form.title, projectId: form.projectId, plannedDate: form.plannedDate } };
}

test('a committed createRun with a lost response retries the complete frozen attempt after the live SOP changes', async t => {
  const repo = repository(); const { sop, project } = await sopFixture(repo); const s = session(t);
  const sent: CreateRunInput[] = [];
  const { ctx, opened } = actionContext(repo, { createRun: async input => {
    sent.push(structuredClone(input));
    const result = await repo.createRun(input);
    if (sent.length === 1) throw new Error('Network response was lost after durable commit');
    return result;
  } });
  memory.putRun(s, runForm(sop));
  await submitRun(ctx, s, sop, new Set());
  const uncertain = memory.getRuns(s)[sop.id]!;
  assert.equal(uncertain.phase, 'uncertain'); assert.equal(opened.length, 0);
  assert.equal((await repo.list({ kind: 'record' })).length, 1);
  const frozen = structuredClone(uncertain.attempt);
  const latestSop = await repo.update({ id: sop.id, expectedRevision: sop.revision, patch: { content: '新修订，与首次创建时不同' } });
  await repo.archive({ id: project.id, expectedRevision: project.revision });
  await submitRun(ctx, s, latestSop, new Set([project.id]));
  assert.deepEqual(sent[1], sent[0], 'retry must retain title, project, date, requestId and old source revision');
  assert.equal(sent[1]!.expectedSopRevision, frozen!.sopRevision);
  assert.equal((await repo.list({ kind: 'record' })).length, 1, 'lost-response recovery must not create a second record');
  assert.equal(opened.length, 1); assert.equal(memory.getRuns(s)[sop.id], undefined);
  assert.equal(getRunWorkflow(opened[0]!)!.source.sopContent, sop.content);
});

test('an uncommitted uncertain request also retains its old SOP revision and cannot silently create against a newer source', async t => {
  const repo = repository(); const { sop } = await sopFixture(repo); const s = session(t); const sent: CreateRunInput[] = [];
  const { ctx } = actionContext(repo, { createRun: async input => {
    sent.push(structuredClone(input)); if (sent.length === 1) throw new Error('Network request never reached the Host'); return repo.createRun(input);
  } });
  memory.putRun(s, runForm(sop)); await submitRun(ctx, s, sop, new Set());
  const latest = await repo.update({ id: sop.id, expectedRevision: 1, patch: { content: '新版' } });
  await submitRun(ctx, s, latest, new Set());
  assert.deepEqual(sent[1], sent[0]); assert.equal((await repo.list({ kind: 'record' })).length, 0);
  assert.equal(memory.getRuns(s)[sop.id]!.phase, 'error');
  assert.match(memory.getRuns(s)[sop.id]!.message!, /SOP.*修改/);
});

test('editing title, project or planned date during uncertainty never silently starts a new createRun action', async t => {
  const repo = repository(); const { sop } = await sopFixture(repo); const s = session(t); const sent: CreateRunInput[] = [];
  const { ctx } = actionContext(repo, { createRun: async input => {
    sent.push(structuredClone(input)); const saved = await repo.createRun(input);
    if (sent.length === 1) throw new Error('Response lost'); return saved;
  } });
  memory.putRun(s, runForm(sop)); await submitRun(ctx, s, sop, new Set());
  const original = memory.getRuns(s)[sop.id]!;
  for (const patch of [{ title: '另一个实验标题' }, { projectId: null }, { plannedDate: '2026-11-09' }]) {
    memory.putRun(s, { ...original, ...patch });
    await submitRun(ctx, s, sop, new Set());
    const current = memory.getRuns(s)[sop.id]!;
    assert.equal(sent.length, 1); assert.equal(current.phase, 'uncertain');
    assert.deepEqual(current.attempt, original.attempt); assert.match(current.message!, /先核对|恢复原输入/);
    for (const [key, value] of Object.entries(patch)) assert.equal(current[key as keyof RunRequestDraft], value);
  }
  memory.putRun(s, { ...original }); await submitRun(ctx, s, sop, new Set());
  assert.equal(sent.length, 2); assert.deepEqual(sent[1], sent[0]); assert.equal((await repo.list({ kind: 'record' })).length, 1);
});

test('late checkRun results cannot resurrect discarded forms or erase newer input/new attempts, including missing and failed reads', async t => {
  const repo = repository(); const { sop } = await sopFixture(repo);
  const saved = await repo.createRun({ sopId: sop.id, expectedSopRevision: 1, title: '旧请求已创建', requestId: 'old-check-request' });
  for (const change of ['discard', 'edit', 'new-attempt'] as const) for (const result of ['found', 'missing', 'error'] as const) {
    const s = session(t); const gate = deferred<ForestEntity[]>();
    const { ctx, opened, applied, notices } = actionContext(repo, { list: () => gate.promise });
    const original = uncertainForm(sop, 'old-check-request'); memory.putRun(s, original);
    const checking = checkRun(ctx, s, sop.id);
    let replacement: RunRequestDraft | undefined;
    if (change === 'discard') memory.dropRun(s, sop.id);
    else {
      replacement = { ...original, title: '读取期间的未保存输入', ...(change === 'new-attempt'
        ? { attempt: { ...original.attempt!, requestId: 'newer-check-request' }, phase: 'creating' as const } : {}) };
      memory.putRun(s, replacement);
    }
    if (result === 'error') gate.reject(new Error('Deferred read failed')); else gate.resolve(result === 'found' ? [saved] : []);
    await checking;
    assert.equal(memory.getRuns(s)[sop.id], replacement, `${change}/${result}: preserve the current draft identity`);
    assert.deepEqual(opened, []); assert.deepEqual(applied, []); assert.deepEqual(notices, []);
  }
});

for (const [name, action] of [['loadStepLatest', loadStepLatest], ['checkStep', checkStep]] as const) {
  test(`late ${name} results cannot resurrect discarded observations or overwrite newer input/attempts`, async t => {
    const repo = repository(); const { sop } = await sopFixture(repo);
    const run = await repo.createRun({ sopId: sop.id, expectedSopRevision: 1, title: '异步步骤测试', requestId: `step-check-${name}` });
    const latest = await repo.updateRunStep({ id: run.id, expectedRevision: 1, stepId: 'step-one', status: 'done', observation: '请求开始时的观察' });
    for (const change of ['discard', 'edit', 'new-attempt'] as const) for (const result of ['found', 'missing', 'error'] as const) {
      const s = session(t); const gate = deferred<ForestEntity | null>();
      const { ctx, applied, notices } = actionContext(repo, { get: () => gate.promise });
      editStep(s, run, 'step-one', { status: 'done', observation: '请求开始时的观察' });
      const key = memory.stepKey(run.id, 'step-one');
      memory.putStep(s, { ...memory.getSteps(s)[key]!, phase: name === 'checkStep' ? 'uncertain' : 'conflict' });
      const original = memory.getSteps(s)[key]!;
      const checking = action(ctx, s, key);
      let replacement: StepDraft | undefined;
      if (change === 'discard') memory.dropStep(s, key);
      else {
        if (change === 'edit') editStep(s, run, 'step-one', { observation: '读取期间新增的观察，必须保留' });
        else memory.putStep(s, { ...original, observation: '新一次保存中的观察', phase: 'saving', baseRevision: latest.revision });
        replacement = memory.getSteps(s)[key];
      }
      if (result === 'error') gate.reject(new Error('Deferred step read failed')); else gate.resolve(result === 'found' ? latest : null);
      await checking;
      assert.equal(memory.getSteps(s)[key], replacement, `${change}/${result}: preserve the newer observation`);
      assert.deepEqual(applied, []); assert.deepEqual(notices, []);
    }
  });
}

test('current checkRun and checkStep still acknowledge exact saved requests and observations', async t => {
  const repo = repository(); const { sop } = await sopFixture(repo); const s = session(t);
  const run = await repo.createRun({ sopId: sop.id, expectedSopRevision: 1, title: '已保存运行', requestId: 'ack-current-run' });
  const { ctx, opened } = actionContext(repo);
  memory.putRun(s, uncertainForm(sop, 'ack-current-run'));
  await checkRun(ctx, s, sop.id);
  assert.equal(memory.getRuns(s)[sop.id], undefined); assert.equal(opened[0]!.id, run.id);
  editStep(s, run, 'step-one', { status: 'done', observation: '完整原始观察' });
  const key = memory.stepKey(run.id, 'step-one');
  memory.putStep(s, { ...memory.getSteps(s)[key]!, phase: 'uncertain' });
  await repo.updateRunStep({ id: run.id, expectedRevision: 1, stepId: 'step-one', status: 'done', observation: '完整原始观察' });
  await checkStep(ctx, s, key);
  assert.equal(memory.getSteps(s)[key], undefined);
});

test('SOP rebase preserves edited steps and remains conflicted when the latest workflow is unknown or from a future version', async () => {
  const variants: JsonObject[] = [{ format: WORKFLOW_FORMAT, version: 2, type: 'sop', futureSteps: ['future evidence'] }, { foreign: 'opaque prior data' }];
  for (const unknown of variants) {
    const repo = repository(); const { sop } = await sopFixture(repo);
    const draft = draftFromEntity(sop);
    draft.steps = [{ ...draft.steps![0]!, instruction: '尚未保存的步骤修改' }, { id: 'new-local-step', title: '新增步骤', instruction: '本地输入', required: false }];
    draft.content = '同时保留未保存正文'; draft.phase = 'conflict';
    const expectedSteps = structuredClone(draft.steps);
    const latest = await repo.update({ id: sop.id, expectedRevision: sop.revision, patch: { data: { ...sop.data, forestWorkflow: unknown } } });
    const rebased = rebase(draft, latest);
    assert.equal(rebased.phase, 'conflict'); assert.equal(rebased.base!.revision, sop.revision);
    assert.equal(rebased.latest!.revision, latest.revision); assert.deepEqual(rebased.steps, expectedSteps);
    assert.equal(rebased.content, draft.content); assert.match(rebased.message!, /不能合并|已保留/);
    await assert.rejects(repo.update({ id: sop.id, expectedRevision: rebased.base!.revision, patch: updatePatch(rebased) }), /已被其他操作修改/);
    assert.deepEqual((await repo.get(sop.id))!.data.forestWorkflow, unknown);
    const textOnly = draftFromEntity(sop); textOnly.content = '仅修改正文';
    const safe = rebase(textOnly, latest);
    assert.equal(safe.phase, 'editing'); assert.equal(safe.stepsLocked, true);
    assert.deepEqual(updatePatch(safe), { content: '仅修改正文' }, 'unmodified structured data can remain opaque without blocking ordinary body edits');
  }
});

test('retained run forms install refresh protection throughout editing, creating and uncertainty until explicit discard', async t => {
  const s = session(t); const previous = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const listeners = new Map<string, (event: { preventDefault(): void; returnValue: string }) => unknown>();
  let adds = 0; let removes = 0;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    addEventListener(name: string, handler: (event: { preventDefault(): void; returnValue: string }) => unknown) { listeners.set(name, handler); adds++; },
    removeEventListener(name: string) { listeners.delete(name); removes++; },
  } });
  const form: RunRequestDraft = { key: 'refresh-sop', sopId: 'refresh-sop', title: '', projectId: null, plannedDate: '', attempt: null, phase: 'editing' };
  try {
    const baseline = memory.unsavedCountAll();
    for (const phase of ['editing', 'creating', 'uncertain', 'error'] as const) {
      const current = { ...form, phase };
      assert.equal(memory.runHasUnsaved(current), true);
      memory.putRun(s, current);
      assert.equal(memory.unsavedCountAll(), baseline + 1);
      assert.equal(listeners.has('beforeunload'), true);
    }
    let prevented = false;
    const event = { preventDefault() { prevented = true; }, returnValue: 'untouched' };
    listeners.get('beforeunload')!(event);
    assert.equal(prevented, true); assert.equal(event.returnValue, ''); assert.equal(adds, 1);
    memory.dropRun(s, form.key);
    assert.equal(memory.unsavedCountAll(), baseline); assert.equal(listeners.has('beforeunload'), false); assert.equal(removes, 1);
  } finally {
    memory.dropRun(s, form.key);
    if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window');
  }
});
