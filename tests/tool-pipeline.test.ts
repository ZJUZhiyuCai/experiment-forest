import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { Context } from '@deepseek-ai/cordis';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import Tools, { type ToolExecutionResult } from '@deepseek-ai/dsh-tools';
import * as NativeExecutor from '@deepseek-ai/dsh-tool-executor-native';
import type { ToolCallId } from '@deepseek-ai/dsh-llm';
import { ForestRepository, type ForestPersistence } from '../plugin/domain';
import { createForestTools, registerForestTools } from '../plugin/tools';
import type { ForestEntity, ForestState } from '../shared/model';

async function fixture(t: TestContext, persistence?: ForestPersistence, register = true) {
  const ctx = new Context();
  t.after(async () => { await ctx.fiber.dispose(); });
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(Tools);
  await ctx.plugin(NativeExecutor);
  let saved: ForestState | null = null;
  const repo = new ForestRepository(persistence ?? {
    read: async () => structuredClone(saved),
    write: async state => { saved = structuredClone(state); },
  });
  t.after(async () => { await repo.close(); });
  if (register) registerForestTools(ctx, repo);
  let sequence = 0;
  async function call(name: string, args: unknown, signal = new AbortController().signal): Promise<ToolExecutionResult> {
    const callId = `forest-pipeline-${++sequence}` as ToolCallId;
    const outcome = await ctx.tools.execute({
      calls: [{ type: 'tool-call', id: callId, name, arguments: JSON.stringify(args) }], signal,
    });
    assert.equal(outcome.results.length, 1);
    assert.equal(outcome.results[0]!.callId, callId);
    return outcome.results[0]!.result;
  }
  return { ctx, repo, call };
}
function success(result: ToolExecutionResult) {
  if (result.isError) assert.fail(result.error.message);
  return result;
}

test('official Native pipeline validates canonical outputs for create, search and read', async t => {
  const { call, repo } = await fixture(t);
  const project = await repo.create({ kind: 'project', title: '工具测试课题' });
  const created = success(await call('forest_create_draft', {
    kind: 'record', title: '长'.repeat(300), content: '待复核的研究假设，非实验结果。', projectId: project.id, tags: ['假设', 'hypothesis'],
  }));
  const entity = created.value as unknown as ForestEntity;
  assert.equal(entity.status, 'draft');
  assert.equal(entity.title.length, 300);
  assert.equal(entity.projectId, project.id);
  assert.deepEqual(entity.data.provenance, { source: 'deepseek-harness', reviewStatus: 'unreviewed' });
  assert.equal(Object.isFrozen(created.value), true);
  assert.equal(created.content[0]!.type, 'text');
  const searched = success(await call('forest_search', { kind: 'record', query: '研究假设', limit: 1 }));
  const search = searched.value as { total: number; results: { id: string }[]; truncated: boolean };
  assert.equal(search.total, 1);
  assert.equal(search.results[0]!.id, entity.id);
  assert.equal(search.truncated, false);
  const read = success(await call('forest_read', { id: entity.id }));
  assert.deepEqual(read.value, created.value);
  assert.deepEqual((await repo.get(entity.id))!.data, entity.data);
});

test('official Native pipeline contains malformed tool output as an error, proving output validation runs', async t => {
  const { ctx, repo, call } = await fixture(t, undefined, false);
  // A test-only faulty wrapper over the real definition verifies this test path
  // reaches output validation; production definitions are never changed.
  const definition = createForestTools(repo).find(item => item.name === 'forest_read')!;
  ctx.tools.register({ ...definition, async execute() { return { id: 'broken', title: 42 }; } });
  const result = await call('forest_read', { id: 'broken' });
  assert.equal(result.isError, true);
  if (!result.isError) throw new Error('invalid output was accepted');
  assert.equal(result.error.info?.code, 'INVALID_TOOL_OUTPUT');
  assert.equal('value' in result, false);
  assert.equal((await repo.snapshot()).entities.length, 0);
});

test('official Native pipeline rejects pre-cancelled calls before saving any draft', async t => {
  const { call, repo } = await fixture(t);
  const result = await call('forest_create_draft', { kind: 'note', title: '不能保存', content: '' }, AbortSignal.abort());
  assert.equal(result.isError, true);
  if (!result.isError) throw new Error('cancelled call succeeded');
  assert.equal(result.error.info?.code, 'ABORTED_BEFORE_DISPATCH');
  assert.equal((await repo.snapshot()).revision, 0);
});

test('official policy guard can deny model writes without changing domain state', async t => {
  const { ctx, call, repo } = await fixture(t);
  ctx.tools.guard(exec => exec.name === 'forest_create_draft' ? 'Research records are read-only in this test.' : undefined);
  const denied = await call('forest_create_draft', { kind: 'sop', title: '被策略拒绝', content: '草稿' });
  assert.equal(denied.isError, true);
  assert.equal((await repo.snapshot()).revision, 0);
  success(await call('forest_search', {}));
});

test('a running Native call cancelled while queued at persistence never writes its draft', async t => {
  let saved: ForestState | null = null;
  let release!: () => void;
  let started!: () => void;
  const firstStarted = new Promise<void>(resolve => { started = resolve; });
  const writeGate = new Promise<void>(resolve => { release = resolve; });
  const { ctx, call, repo } = await fixture(t, {
    read: async () => structuredClone(saved),
    async write(state) {
      if (state.revision === 1) { started(); await writeGate; }
      saved = structuredClone(state);
    },
  });
  const first = repo.create({ kind: 'note', title: '已接受的第一笔' });
  await firstStarted;
  let dispatched!: () => void;
  const didDispatch = new Promise<void>(resolve => { dispatched = resolve; });
  ctx.on('tools/execute', async (_exec, next) => { const pending = next(); dispatched(); return pending; });
  const controller = new AbortController();
  const pending = call('forest_create_draft', { kind: 'note', title: '排队后取消', content: '' }, controller.signal);
  await didDispatch;
  controller.abort();
  release();
  await first;
  const result = await pending;
  assert.equal(result.isError, true);
  if (!result.isError) throw new Error('cancelled queued write succeeded');
  // The official pipeline preserves an AbortError thrown by the body rather
  // than replacing an already-failed result with its ABORTED success override.
  assert.match(result.error.message, /abort/i);
  const state = await repo.snapshot();
  assert.equal(state.revision, 1);
  assert.equal(state.entities[0]!.title, '已接受的第一笔');
});
