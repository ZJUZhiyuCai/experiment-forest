import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import { ForestRepository } from '../plugin/domain.ts';
import { createForestTools } from '../plugin/tools.ts';
import type { ForestState } from '../shared/model.ts';

function fixture() {
  let state: ForestState | null = null;
  const repo = new ForestRepository({
    read: async () => structuredClone(state),
    write: async value => { state = structuredClone(value); },
  });
  const tools = new Map(createForestTools(repo).map(tool => [tool.name, tool]));
  const call = (name: string, args: unknown, signal = new AbortController().signal) =>
    tools.get(name)!.execute(args, { signal } as ToolRunContext);
  return { repo, call, tools };
}

test('model can create only a marked draft, never a completed or approved record', async () => {
  const { call, repo, tools } = fixture();
  assert.deepEqual([...tools.keys()], ['forest_search', 'forest_read', 'forest_create_draft']);
  const draft = await call('forest_create_draft', {
    kind: 'sop', title: '待复核流程', content: '仅为草案', status: 'approved',
    data: { provenance: { source: 'human' } },
  }) as Record<string, unknown>;
  assert.equal(draft.status, 'draft');
  assert.deepEqual(draft.data, { provenance: { source: 'deepseek-harness', reviewStatus: 'unreviewed' } });
  await assert.rejects(call('forest_create_draft', { kind: 'project', title: '伪项目', content: '' }));
  assert.equal((await repo.list()).length, 1);
});

test('search is bounded, reports truncation, and full read follows returned IDs', async () => {
  const { call, repo } = fixture();
  for (let n = 0; n < 3; n++) await repo.create({ kind: 'note', title: `细胞笔记 ${n}`, content: '观察'.repeat(200) });
  const result = await call('forest_search', { query: '细胞', limit: 2 }) as {
    total: number; truncated: boolean; results: { id: string; excerpt: string }[];
  };
  assert.equal(result.total, 3);
  assert.equal(result.truncated, true);
  assert.equal(result.results.length, 2);
  assert.equal(result.results[0].excerpt.length, 240);
  const full = await call('forest_read', { id: result.results[0].id }) as { content: string };
  assert.equal(full.content.length, 400);
  await assert.rejects(call('forest_search', { limit: 0 }));
  await assert.rejects(call('forest_search', { limit: 101 }));
  await assert.rejects(call('forest_search', { limit: 1.5 }));
  await assert.rejects(call('forest_read', { id: 'missing' }));
});

test('cancelled calls never create a draft', async () => {
  const { call, repo } = fixture();
  const signal = AbortSignal.abort(new Error('cancelled'));
  await assert.rejects(call('forest_create_draft', { kind: 'note', title: '取消', content: '' }, signal), /cancelled/);
  assert.equal((await repo.list()).length, 0);
});
