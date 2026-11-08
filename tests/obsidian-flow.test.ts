import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { ForestRepository } from '../plugin/domain';
import { ObsidianController } from '../plugin/obsidian-controller';
import { discoverObsidianVaults, obsidianMirrorFolder, ObsidianMirrorSync } from '../plugin/obsidian-sync';
import { createObsidianMirror } from '../shared/obsidian';
import type { ForestState, ObsidianStatus } from '../shared/model';

test('durable repository commits automatically reach a registered temporary Obsidian vault and expose manual-edit conflicts', async t => {
  const temporary = await realpath(await mkdtemp(join(tmpdir(), 'forest-auto-obsidian-')));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const vaultPath = join(temporary, 'software-test-vault'); await mkdir(vaultPath); await mkdir(join(vaultPath, '.obsidian'));
  const configPath = join(temporary, 'obsidian.json');
  await writeFile(configPath, JSON.stringify({ vaults: { 'test-registered-id': { path: vaultPath, open: true } } }));
  const folder = obsidianMirrorFolder(join(temporary, 'harness-profile'));
  let saved: ForestState | null = null;
  let connection: { vaultId: string | null } = { vaultId: null };
  let controller!: ObsidianController;
  const repo = new ForestRepository({ read: async () => structuredClone(saved), write: async state => { saved = structuredClone(state); } }, snapshot => controller.onCommit(snapshot));
  controller = new ObsidianController({ folder, readConfig: async () => connection, writeConfig: async next => { connection = next; },
    discover: () => discoverObsidianVaults({ configPath }), snapshot: () => repo.snapshot(),
    createMirror: (vault, folderName) => new ObsidianMirrorSync({ vaultPath: vault.path, folderName }) });
  t.after(async () => { await repo.close(); await controller.close(); });
  const wait = async (predicate: (status: ObsidianStatus) => boolean) => {
    for (let count = 0; count < 100; count++) { const status = await controller.status(); if (predicate(status)) return status; await delay(10); }
    assert.fail('automatic sync did not reach the expected observable state');
  };
  await controller.start();
  assert.equal((await controller.configure({ vaultId: 'test-registered-id' })).state, 'synced');
  const note = await repo.create({ kind: 'note', title: '软件验收笔记', content: '原始资料，非科学结果' });
  await wait(status => status.state === 'synced' && status.lastSyncedRevision === 1);
  const snapshot = await repo.snapshot();
  const relative = createObsidianMirror(snapshot).files.find(file => file.path.startsWith('entities/'))!.path;
  const notePath = join(vaultPath, folder, relative);
  const original = await readFile(notePath, 'utf8'); assert.match(original, /软件验收笔记/);
  assert.equal(JSON.parse(await readFile(join(vaultPath, folder, '.experiment-forest-sync.json'), 'utf8')).revision, 1);
  await writeFile(notePath, '用户在 Obsidian 人工改写的测试文字');
  const updated = await repo.update({ id: note.id, expectedRevision: note.revision, patch: { content: '新的 Harness 正文' } });
  assert.equal(updated.revision, 2);
  const conflict = await wait(status => status.state === 'conflict');
  assert.ok(conflict.conflicts.some(item => item.path === relative)); assert.equal(conflict.lastSyncedRevision, 1);
  assert.equal(await readFile(notePath, 'utf8'), '用户在 Obsidian 人工改写的测试文字');
  assert.equal((await repo.get(note.id))!.content, '新的 Harness 正文');
  // Only this test-owned note is restored; the explicit retry can then safely update it.
  await writeFile(notePath, original);
  assert.equal((await controller.sync()).state, 'synced');
  assert.match(await readFile(notePath, 'utf8'), /新的 Harness 正文/);
  assert.equal(connection.vaultId, 'test-registered-id');
  assert.equal(JSON.stringify(await repo.export()).includes(vaultPath), false);
});
