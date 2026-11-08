import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate as tick } from 'node:timers/promises';
import { ForestRepository } from '../plugin/domain';
import { ObsidianController, type MirrorResult } from '../plugin/obsidian-controller';
import type { ForestSnapshot, ForestState } from '../shared/model';

function fixture() {
  let persisted: ForestState | null = null;
  let config: { vaultId: string | null } = { vaultId: null };
  let vaults = [{ id: 'registered-test', name: 'Test vault', path: '/test/vault', open: true }];
  let fail = false;
  let configFailure = false;
  let discoveryFailure = false;
  let block: Promise<void> | undefined;
  const synced: number[] = [];
  const paths: string[] = [];
  let closes = 0;
  let controller!: ObsidianController;
  const repo = new ForestRepository({ read: async () => structuredClone(persisted), write: async state => { persisted = structuredClone(state); } }, snapshot => controller.onCommit(snapshot));
  controller = new ObsidianController({ folder: 'Experiment Forest-test',
    readConfig: async () => config,
    writeConfig: async value => { if (configFailure) throw new Error('config disk full'); config = value; },
    discover: async () => { if (discoveryFailure) throw new Error('registration unreadable'); return vaults; },
    snapshot: () => repo.snapshot(),
    createMirror(vault) {
      paths.push(vault.path);
      return { async close() { closes++; }, async sync(snapshot: ForestSnapshot): Promise<MirrorResult> {
        synced.push(snapshot.revision);
        await block;
        if (fail) throw new Error('test vault unavailable');
        return { status: 'synced', written: snapshot.entities.length, unchanged: 0, conflicts: [], stale: [], entityCount: snapshot.entities.length,
          snapshotRevision: snapshot.revision, mirroredAt: new Date().toISOString() };
      } };
    },
  });
  return { repo, controller, synced, paths, config: () => config, closes: () => closes,
    fail: (value: boolean) => { fail = value; }, failConfig: (value: boolean) => { configFailure = value; },
    failDiscovery: (value: boolean) => { discoveryFailure = value; },
    block: (value: Promise<void> | undefined) => { block = value; }, setVaults: (value: typeof vaults) => { vaults = value; } };
}

test('Obsidian configuration selects only registered IDs, is separate from research export, and disconnects without filesystem deletion', async () => {
  const { repo, controller, synced, config, closes } = fixture();
  await controller.start();
  assert.equal((await controller.status()).state, 'disabled'); assert.deepEqual(synced, []);
  await assert.rejects(controller.configure({ vaultId: 'not-registered' }), /登记列表/);
  await assert.rejects(controller.configure({ vaultId: 'registered-test', path: '/arbitrary/path' } as never), /已登记/);
  assert.equal(config().vaultId, null);
  const connected = await controller.configure({ vaultId: 'registered-test' });
  assert.equal(connected.enabled, true); assert.equal(connected.state, 'synced'); assert.equal(connected.lastSyncedRevision, 0);
  assert.equal(config().vaultId, 'registered-test');
  assert.equal(JSON.stringify(await repo.export()).includes('vault'), false);
  const disconnected = await controller.configure({ vaultId: null });
  assert.equal(disconnected.enabled, false); assert.equal(disconnected.state, 'disabled'); assert.equal(closes(), 1);
  await repo.create({ kind: 'note', title: '关闭连接后仍正常保存' });
  await tick(); assert.deepEqual(synced, [0]);
  await controller.close(); await repo.close();
});

test('a slow external mirror never blocks commits and coalesces pending revisions to the latest snapshot', async () => {
  const f = fixture(); await f.controller.start(); await f.controller.configure({ vaultId: 'registered-test' });
  let release!: () => void;
  f.block(new Promise<void>(resolve => { release = resolve; }));
  await f.repo.create({ kind: 'note', title: 'first' }); await tick();
  await f.repo.create({ kind: 'note', title: 'second' });
  await f.repo.create({ kind: 'note', title: 'third' });
  assert.equal((await f.repo.snapshot()).revision, 3, 'all three writes are durable while mirror is blocked');
  assert.deepEqual(f.synced, [0, 1]);
  f.block(undefined); release();
  await f.controller.close();
  assert.deepEqual(f.synced, [0, 1, 3]);
  assert.equal((await f.controller.status()).lastSyncedRevision, 3);
  await f.repo.close();
});

test('mirror failure is visible and retried by the next save, without turning persisted business data into a failed save', async () => {
  const f = fixture(); await f.controller.start(); await f.controller.configure({ vaultId: 'registered-test' });
  f.fail(true);
  const saved = await f.repo.create({ kind: 'note', title: '仍保存在 Harness' });
  const failed = await f.controller.sync();
  assert.equal(failed.state, 'error'); assert.match(failed.lastError!, /unavailable/);
  assert.equal(failed.lastSyncedRevision, 0);
  assert.equal((await f.repo.get(saved.id))!.title, '仍保存在 Harness');
  f.fail(false); await f.repo.create({ kind: 'note', title: '后续保存触发重试' });
  await f.controller.close();
  assert.equal((await f.controller.status()).state, 'synced'); assert.equal((await f.controller.status()).lastSyncedRevision, 2);
  await f.repo.close();
});

test('a failed config write keeps the existing connection, and changed or removed registrations are rechecked before writing', async () => {
  const f = fixture(); await f.controller.start(); await f.controller.configure({ vaultId: 'registered-test' });
  f.failConfig(true);
  await assert.rejects(f.controller.configure({ vaultId: null }), /config disk full/);
  assert.equal((await f.controller.status()).vaultId, 'registered-test'); assert.equal(f.closes(), 0);
  f.failConfig(false);
  f.setVaults([{ id: 'registered-test', name: 'Moved test', path: '/test/moved', open: true }]);
  await f.controller.sync(); assert.deepEqual(f.paths, ['/test/vault', '/test/moved']); assert.equal(f.closes(), 1);
  f.setVaults([]);
  const lost = await f.controller.sync(); assert.equal(lost.state, 'error'); assert.match(lost.lastError!, /登记列表/);
  assert.deepEqual(f.paths, ['/test/vault', '/test/moved']);
  f.failDiscovery(true);
  const disabled = await f.controller.configure({ vaultId: null });
  assert.equal(disabled.state, 'disabled'); assert.equal(disabled.enabled, false, 'disconnect remains available when Obsidian registration is unreadable');
  await f.controller.close(); await f.repo.close();
});

for (const operation of ['start', 'configure', 'sync'] as const) test(`${operation} cannot replace a newer commit snapshot with a delayed stale read`, async () => {
  let config = { vaultId: operation === 'start' ? 'test' : null as string | null };
  let defer = operation !== 'sync';
  let release!: (snapshot: ForestSnapshot) => void;
  let reading!: () => void;
  const isReading = new Promise<void>(resolve => { reading = resolve; });
  const pendingSnapshot = new Promise<ForestSnapshot>(resolve => { release = resolve; });
  const versions: number[] = [];
  const controller = new ObsidianController({ folder: 'Experiment Forest-test', readConfig: async () => config,
    writeConfig: async value => { config = value; }, discover: async () => [{ id: 'test', name: 'test', path: '/test', open: false }],
    snapshot: async () => { if (defer) { reading(); return pendingSnapshot; } return { revision: 0, entities: [] }; },
    createMirror: () => ({ close: async () => {}, sync: async snapshot => { versions.push(snapshot.revision); return {
      status: 'synced', snapshotRevision: snapshot.revision, mirroredAt: new Date().toISOString(), written: 0, unchanged: 0, conflicts: [], stale: [], entityCount: 0,
    }; } }),
  });
  if (operation === 'sync') { await controller.start(); await controller.configure({ vaultId: 'test' }); defer = true; }
  const pending = operation === 'start' ? controller.start() : operation === 'configure' ? controller.configure({ vaultId: 'test' }) : controller.sync();
  await isReading;
  controller.onCommit({ revision: 2, entities: [] });
  release({ revision: 1, entities: [] });
  await pending; await controller.close();
  assert.equal((await controller.status()).lastSyncedRevision, 2);
  assert.equal(versions.includes(1), false, 'stale r1 must never be written after observing r2');
});
