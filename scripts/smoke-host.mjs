/** Keyless integration against published Cordis, Storage, Tool registry, and authenticated Gateway. */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Context } from '@deepseek-ai/cordis';
import Storage from '@deepseek-ai/dsh-storage';
import * as JsonStorage from '@deepseek-ai/dsh-storage-json';
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain';
import TypertRegistry from '@deepseek-ai/dsh-typert-registry';
import RemoteAccess from '@deepseek-ai/dsh-api-remote-access';
import Gateway from '@deepseek-ai/dsh-api-gateway';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import Tools from '@deepseek-ai/dsh-tools';
import { Peer } from '@deepseek-ai/dsh-client-connection';
import * as forest from '../lib/index.js';

const root = await mkdtemp(join(tmpdir(), 'forest-host-smoke-'));
const contexts = [];
async function boot(profileName = 'forest-smoke') {
  const ctx = new Context(); contexts.push(ctx);
  ctx.provide('profileContext', { name: profileName });
  await ctx.plugin(Storage);
  await ctx.plugin(JsonStorage, { root });
  await ctx.plugin(StorageDomain, { backend: 'json' });
  await ctx.plugin(SystemPrompt);
  await ctx.plugin(Tools);
  await ctx.plugin(TypertRegistry);
  await ctx.plugin(RemoteAccess);
  await ctx.plugin(Gateway, {});
  const fiber = ctx.plugin(forest); await fiber;
  assert.ok(ctx.get('experimentForest'), 'plugin must activate');
  const peer = new Peer(ctx, { principal: { kind: 'owner' } });
  const rpc = (method, args = {}) => ctx.typertGateway.invoke({ namespace: 'experimentForest', method, args, peer });
  return { ctx, fiber, rpc };
}
try {
  const first = await boot();
  assert.deepEqual(await first.rpc('snapshot'), { revision: 0, entities: [] });
  const guest = new Peer(first.ctx, { principal: { kind: 'test-guest', guest: 'forest-smoke' } });
  const guestCalls = {
    list: { filter: {} }, get: { id: 'denied' }, snapshot: {}, create: { input: { kind: 'note', title: 'denied' } },
    update: { input: { id: 'denied', expectedRevision: 0, patch: { title: 'denied' } } }, archive: { input: { id: 'denied', expectedRevision: 0 } },
    export: {}, previewImport: { input: { data: {} } }, import: { input: { data: {}, expectedRevision: 0 } },
  };
  for (const [method, args] of Object.entries(guestCalls)) {
    await assert.rejects(first.ctx.typertGateway.invoke({ namespace: 'experimentForest', method, args, peer: guest }), /access|denied|permitted|authorized/i);
  }
  const project = await first.rpc('create', { input: { kind: 'project', title: '可复现的研究' } });
  const record = await first.rpc('create', { input: { kind: 'record', title: '长'.repeat(280), projectId: project.id } });
  await assert.rejects(first.rpc('update', { input: { id: record.id, expectedRevision: 0, patch: { title: '过期修改' } } }), /版本|刷新|修改/);
  await assert.rejects(first.rpc('create', { input: { kind: 'record', title: 'invalid', arbitrary: true } }));
  assert.equal((await first.rpc('snapshot')).entities.length, 2);
  assert.equal((await first.rpc('export')).entities[1].title.length, 280);
  assert.deepEqual(first.ctx.tools.schemas().map(tool => tool.name).sort(), ['forest_create_draft', 'forest_read', 'forest_search']);
  await first.fiber.dispose();
  assert.equal(first.ctx.get('experimentForest'), undefined);
  assert.equal(first.ctx.tools.schemas().length, 0);
  await first.ctx.fiber.dispose(); contexts.splice(contexts.indexOf(first.ctx), 1);
  const second = await boot();
  assert.equal((await second.rpc('get', { id: record.id })).title.length, 280);
  assert.equal((await second.rpc('snapshot')).revision, 2);
  await second.fiber.dispose();
  const separate = await boot('forest-other-profile');
  assert.deepEqual(await separate.rpc('snapshot'), { revision: 0, entities: [] });
  await separate.fiber.dispose();
  console.log('PASS: official Host activation, strict RPC, conflict handling, durable restart, tool registration and unload. No model request.');
} finally {
  await Promise.all(contexts.map(ctx => ctx.fiber.dispose()));
  await rm(root, { recursive: true, force: true });
}
