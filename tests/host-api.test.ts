import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RemoteError, type RemoteResult } from '@deepseek-ai/dsh-typert-protocol';
import { createHostApi, ForestApiError } from '../client/host-api';
import type { ForestRemote } from '../plugin/remote';
import type { ForestEntity } from '../shared/model';
const unused = async (): Promise<never> => { throw new Error('Unexpected fixture method'); };
function remote(snapshot: ForestRemote['snapshot'] = unused, update: ForestRemote['update'] = unused): ForestRemote {
  return { snapshot, update, list: unused, get: unused, create: unused, archive: unused, export: unused, previewImport: unused, import: unused,
    createRun: unused, updateRunStep: unused, context: unused, obsidianStatus: unused, configureObsidian: unused, syncObsidian: unused };
}
test('Host adapter unwraps a successful native RPC value', async () => {
  const expected = { revision: 3, entities: [] };
  const api = createHostApi(remote(async () => ({ ok: true, value: expected })));
  assert.deepEqual(await api.snapshot(), expected);
});
test('Host adapter surfaces domain conflict code without losing the server message', async () => {
  const error = new RemoteError('experimentForest/failure', '记录已被其他操作修改，请刷新后重试', { code: 'conflict' });
  const api = createHostApi(remote(undefined, async (): Promise<RemoteResult<ForestEntity>> => ({ ok: false, error })));
  await assert.rejects(api.update({ id: 'record-1', expectedRevision: 1, patch: { title: 'draft' } }), candidate =>
    candidate instanceof ForestApiError && candidate.code === 'conflict' && candidate.message === error.message && candidate.cause === error);
});
test('Host adapter preserves non-domain transport and permission failures', async () => {
  const error = new RemoteError('gateway/cancelled', 'Request cancelled', {});
  const api = createHostApi(remote(async () => ({ ok: false, error })));
  await assert.rejects(api.snapshot(), candidate => candidate === error);
});
