import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, realpath, readFile, writeFile, readdir, rm, rename, symlink, link } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { ForestSnapshot } from '../shared/model';
import { createObsidianMirror } from '../shared/obsidian';
import { discoverObsidianVaults, obsidianMirrorFolder, ObsidianMirrorSync } from '../plugin/obsidian-sync';

const at = '2026-11-08T02:00:00.000Z', folder = obsidianMirrorFolder('test-profile');
function snapshot(revision = 1): ForestSnapshot {
  return { revision, entities: [{ id: 'r1', kind: 'record', title: `record r${revision}`, content: 'complete body', data: {}, status: 'draft', revision, tags: [], createdAt: at, updatedAt: at }] };
}
async function vault(t: { after: (fn: () => Promise<void>) => void }) {
  const temporary = await realpath(await mkdtemp(path.join(tmpdir(), 'forest-obsidian-')));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  await mkdir(path.join(temporary, '.obsidian'));
  return temporary;
}
const notePath = (s = snapshot()) => createObsidianMirror(s).files.find(file => file.path.startsWith('entities/'))!.path;

test('sync writes scoped reading mirror and manifest, repeats without rewrites, then updates only changed content', async t => {
  const root = await vault(t), worker = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  const first = await worker.sync(snapshot());
  assert.equal(first.status, 'synced'); assert.equal(first.written, createObsidianMirror(snapshot()).fileCount);
  const second = await worker.sync(snapshot());
  assert.equal(second.written, 0); assert.equal(second.unchanged, first.written);
  const third = await worker.sync(snapshot(2));
  assert.ok(third.written > 0 && third.written < first.written);
  const manifest = JSON.parse(await readFile(path.join(root, folder, '.experiment-forest-sync.json'), 'utf8'));
  assert.equal(manifest.revision, 2);
  assert.match(await readFile(path.join(root, folder, notePath()), 'utf8'), /record r2/);
  const recovery = await readdir(path.join(root, folder, '.recovery'));
  assert.ok(recovery.length > 0);
  assert.ok((await Promise.all(recovery.map(name => readFile(path.join(root, folder, '.recovery', name), 'utf8')))).some(value => value.includes('record r1')));
  await worker.close();
});

test('manual modifications and moved owned files are preserved and never silently recreated', async t => {
  const root = await vault(t), worker = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  await worker.sync(snapshot());
  const file = path.join(root, folder, notePath());
  await writeFile(file, 'my independent research note');
  const modified = await worker.sync(snapshot(2));
  assert.equal(modified.status, 'conflict'); assert.match(modified.conflicts[0]!.reason, /手工修改/);
  assert.equal(await readFile(file, 'utf8'), 'my independent research note');
  await rename(file, path.join(root, folder, 'my-note.md'));
  const moved = await worker.sync(snapshot(3));
  assert.match(moved.conflicts.find(c => c.path === notePath())!.reason, /缺失或被移动/);
  await assert.rejects(readFile(file), { code: 'ENOENT' });
  assert.equal(await readFile(path.join(root, folder, 'my-note.md'), 'utf8'), 'my independent research note');
});

test('Obsidian JSON-to-YAML normalization and customized Bases stay owned without conflict while notes keep updating', async t => {
  const root = await vault(t), worker = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  await worker.sync(snapshot());
  const view = path.join(root, folder, 'Forest.base');
  const seeded = JSON.parse(await readFile(view, 'utf8')) as { views: unknown[] };
  assert.ok(seeded.views.length > 0);
  const manifestPath = path.join(root, folder, '.experiment-forest-sync.json');
  const seedHash = JSON.parse(await readFile(manifestPath, 'utf8')).files['Forest.base'];
  // Mirrors the normal .base rewrite performed by Obsidian; no YAML parser is
  // needed because the sync boundary must preserve user-owned view bytes.
  const normalized = 'filters:\n  and:\n    - file.ext == "md"\nviews:\n  - type: table\n    name: 全部资料\n';
  await writeFile(view, normalized);
  await worker.close();
  const reopened = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  const afterFormat = await reopened.sync(snapshot(2));
  assert.equal(afterFormat.status, 'synced'); assert.deepEqual(afterFormat.conflicts, []);
  assert.equal(await readFile(view, 'utf8'), normalized);
  assert.match(await readFile(path.join(root, folder, notePath()), 'utf8'), /record r2/);
  const customized = normalized.replace('全部资料', '我的实验视图') + '    order:\n      - note.title\n';
  await writeFile(view, customized);
  const afterEdit = await reopened.sync(snapshot(3));
  assert.equal(afterEdit.status, 'synced'); assert.deepEqual(afterEdit.conflicts, []);
  assert.equal(await readFile(view, 'utf8'), customized);
  assert.match(await readFile(path.join(root, folder, notePath()), 'utf8'), /record r3/);
  assert.equal(JSON.parse(await readFile(manifestPath, 'utf8')).files['Forest.base'], seedHash);
  assert.equal((await reopened.sync(snapshot(3))).written, 0);
});

test('the customizable Base exception never claims unowned, moved, symlinked or hardlinked views', async t => {
  const root = await vault(t), worker = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  await worker.sync(snapshot());
  const view = path.join(root, folder, 'Forest.base'), moved = path.join(root, folder, 'My-view.base');
  await rename(view, moved);
  const absent = await worker.sync(snapshot(2));
  assert.match(absent.conflicts.find(c => c.path === 'Forest.base')!.reason, /缺失或被移动/);
  await assert.rejects(readFile(view), { code: 'ENOENT' });
  const original = await readFile(moved, 'utf8');
  await symlink(moved, view);
  const symbolic = await worker.sync(snapshot(3));
  assert.match(symbolic.conflicts.find(c => c.path === 'Forest.base')!.reason, /普通文件/);
  await rm(view); await link(moved, view);
  const hardlinked = await worker.sync(snapshot(4));
  assert.match(hardlinked.conflicts.find(c => c.path === 'Forest.base')!.reason, /普通文件/);
  assert.equal(await readFile(moved, 'utf8'), original);
  await rm(view); await writeFile(view, 'a user-created unrelated view');
  const manifestPath = path.join(root, folder, '.experiment-forest-sync.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  delete manifest.files['Forest.base'];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const unowned = await worker.sync(snapshot(5));
  assert.match(unowned.conflicts.find(c => c.path === 'Forest.base')!.reason, /不属于/);
  assert.equal(await readFile(view, 'utf8'), 'a user-created unrelated view');
});

test('new unowned filename collisions and old managed files are never overwritten or deleted', async t => {
  const root = await vault(t), worker = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  await worker.sync(snapshot());
  const next = snapshot(2); next.entities.push({ ...next.entities[0]!, id: 'r2' });
  const added = createObsidianMirror(next).files.filter(f => f.path.startsWith('entities/')).find(f => f.path !== notePath())!;
  await writeFile(path.join(root, folder, added.path), 'user-owned collision');
  const result = await worker.sync(next);
  assert.equal(result.status, 'conflict'); assert.match(result.conflicts.find(c => c.path === added.path)!.reason, /不属于/);
  const empty = await worker.sync({ revision: 3, entities: [] });
  assert.ok(empty.stale.includes(notePath()));
  assert.equal(await readFile(path.join(root, folder, added.path), 'utf8'), 'user-owned collision');
  assert.match(await readFile(path.join(root, folder, notePath()), 'utf8'), /record r2/);
});

test('nonempty folders without manifest and malformed manifests are not taken over', async t => {
  const root = await vault(t), target = path.join(root, folder);
  await mkdir(target); await writeFile(path.join(target, 'README.md'), 'user-owned');
  const worker = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  await assert.rejects(worker.sync(snapshot()), /nonempty/);
  assert.equal(await readFile(path.join(target, 'README.md'), 'utf8'), 'user-owned');
  await writeFile(path.join(target, '.experiment-forest-sync.json'), JSON.stringify({ owner: 'experiment-forest', version: 1, folderName: folder, revision: 0, files: { '../escape': 'a'.repeat(64) } }));
  await assert.rejects(worker.sync(snapshot()), /invalid path/);
});

test('vault, mirror directory and parent symlinks are rejected without writes outside the intended root', async t => {
  const root = await vault(t), external = await vault(t);
  await symlink(external, path.join(root, folder));
  await assert.rejects(new ObsidianMirrorSync({ vaultPath: root, folderName: folder }).sync(snapshot()), /Unsafe/);
  assert.deepEqual(await readdir(external), ['.obsidian']);
  const linked = path.join(root, 'linked-vault'); await symlink(external, linked);
  await assert.rejects(new ObsidianMirrorSync({ vaultPath: linked, folderName: folder }).sync(snapshot()), /Unsafe/);
});

test('owned symlink or hardlink targets are conflicts and outside content stays intact', async t => {
  const root = await vault(t), worker = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  await worker.sync(snapshot());
  const target = path.join(root, folder, notePath()), outside = path.join(root, 'outside.md');
  await writeFile(outside, 'outside-data'); await rm(target); await symlink(outside, target);
  assert.equal((await worker.sync(snapshot(2))).status, 'conflict');
  assert.equal(await readFile(outside, 'utf8'), 'outside-data');
  await rm(target); await link(outside, target);
  assert.equal((await worker.sync(snapshot(3))).status, 'conflict');
  assert.equal(await readFile(outside, 'utf8'), 'outside-data');
});

test('manifest symlink cannot redirect ownership writes', async t => {
  const root = await vault(t), worker = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  await worker.sync(snapshot());
  const manifest = path.join(root, folder, '.experiment-forest-sync.json'), outside = path.join(root, 'other.json');
  await writeFile(outside, '{}'); await rm(manifest); await symlink(outside, manifest);
  await assert.rejects(worker.sync(snapshot(2)), /ordinary/);
  assert.equal(await readFile(outside, 'utf8'), '{}');
});

test('sync serializes detached snapshots, rejects rollback, and close drains then prevents new writes', async t => {
  const root = await vault(t), worker = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  const first = snapshot();
  const a = worker.sync(first); first.entities[0]!.content = 'mutated after call';
  const b = worker.sync(snapshot(2));
  const closed = worker.close(); await Promise.all([a, b, closed]);
  assert.doesNotMatch(await readFile(path.join(root, folder, notePath()), 'utf8'), /mutated after call/);
  await assert.rejects(worker.sync(snapshot(3)), /closed/);
  const reopened = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  await assert.rejects(reopened.sync(snapshot()), /older snapshot/);
});

test('vault discovery reads only registration JSON, supports missing config and platform paths, never creates or scans vault notes', async t => {
  const root = await vault(t), config = path.join(root, 'obsidian.json');
  await writeFile(config, JSON.stringify({ vaults: { a: { path: '/does-not-exist/vault-a', open: false }, b: { path: '/does-not-exist/vault-b', open: true }, invalid: { path: '../relative' } } }));
  assert.deepEqual(await discoverObsidianVaults({ configPath: config }), [
    { id: 'b', name: 'vault-b', path: '/does-not-exist/vault-b', open: true }, { id: 'a', name: 'vault-a', path: '/does-not-exist/vault-a', open: false },
  ]);
  assert.deepEqual(await discoverObsidianVaults({ configPath: path.join(root, 'missing.json') }), []);
  const mac = path.join(root, 'Library', 'Application Support', 'obsidian'); await mkdir(mac, { recursive: true });
  await writeFile(path.join(mac, 'obsidian.json'), JSON.stringify({ vaults: {} }));
  assert.deepEqual(await discoverObsidianVaults({ platform: 'darwin', homeDir: root }), []);
  await writeFile(config, '{broken'); await assert.rejects(discoverObsidianVaults({ configPath: config }));
});

test('profile identity determines isolated folder and unsafe targets are rejected', () => {
  assert.equal(obsidianMirrorFolder('a'), obsidianMirrorFolder('a'));
  assert.notEqual(obsidianMirrorFolder('a'), obsidianMirrorFolder('b'));
  assert.throws(() => obsidianMirrorFolder(''), /identity/);
  assert.throws(() => new ObsidianMirrorSync({ vaultPath: '/tmp', folderName: '../escape' }), /target/);
});

test('a failed manifest write never publishes success and a fresh instance recovers its own completed file writes', async t => {
  const root = await vault(t), worker = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  await worker.sync(snapshot());
  const manifestPath = path.join(root, folder, '.experiment-forest-sync.json');
  const oldManifest = await readFile(manifestPath, 'utf8');
  const seam = worker as unknown as { atomicWrite: (filename: string, content: string, expected: string | null) => Promise<void> };
  const original = seam.atomicWrite.bind(worker);
  seam.atomicWrite = async (filename, content, expected) => {
    if (filename === manifestPath) throw new Error('injected manifest I/O failure');
    return original(filename, content, expected);
  };
  await assert.rejects(worker.sync(snapshot(2)), /injected/);
  assert.equal(await readFile(manifestPath, 'utf8'), oldManifest);
  const resumed = await new ObsidianMirrorSync({ vaultPath: root, folderName: folder }).sync(snapshot(2));
  assert.equal(resumed.status, 'synced');
  assert.equal(resumed.conflicts.length, 0);
  assert.match(await readFile(path.join(root, folder, notePath()), 'utf8'), /record r2/);
  await assert.rejects(readFile(path.join(root, folder, '.experiment-forest-pending.json')), { code: 'ENOENT' });
});

test('first synchronization resumes after partial writes without taking over preexisting or manually changed content', async t => {
  const root = await vault(t), worker = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  const seam = worker as unknown as { atomicWrite: (filename: string, content: string, expected: string | null) => Promise<void> };
  const original = seam.atomicWrite.bind(worker);
  seam.atomicWrite = async (filename, content, expected) => {
    if (filename.endsWith('index-note.md')) throw new Error('simulated disk full');
    return original(filename, content, expected);
  };
  await assert.rejects(worker.sync(snapshot()), /write failed/);
  await assert.rejects(readFile(path.join(root, folder, '.experiment-forest-sync.json')), { code: 'ENOENT' });
  assert.ok((await readdir(path.join(root, folder))).includes('README.md'));
  const resumed = await new ObsidianMirrorSync({ vaultPath: root, folderName: folder }).sync(snapshot());
  assert.equal(resumed.status, 'synced'); assert.equal(resumed.conflicts.length, 0);
  assert.match(await readFile(path.join(root, folder, notePath()), 'utf8'), /record r1/);
});

test('recovery recognizes only its journal hashes and preserves edits made while the failed sync was offline', async t => {
  const root = await vault(t), worker = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  const seam = worker as unknown as { atomicWrite: (filename: string, content: string, expected: string | null) => Promise<void> };
  const original = seam.atomicWrite.bind(worker);
  seam.atomicWrite = async (filename, content, expected) => {
    if (filename.endsWith('index-note.md')) throw new Error('interrupted');
    return original(filename, content, expected);
  };
  await assert.rejects(worker.sync(snapshot()), /write failed/);
  await writeFile(path.join(root, folder, 'index-project.md'), 'my annotations after failure');
  const resumed = await new ObsidianMirrorSync({ vaultPath: root, folderName: folder }).sync(snapshot());
  assert.equal(resumed.status, 'conflict'); assert.ok(resumed.conflicts.some(c => c.path === 'index-project.md'));
  assert.equal(await readFile(path.join(root, folder, 'index-project.md'), 'utf8'), 'my annotations after failure');
  assert.match(await readFile(path.join(root, folder, notePath()), 'utf8'), /record r1/);
});

test('recovery itself can restart after publishing partial ownership without discarding its journal', async t => {
  const root = await vault(t), first = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  type Writer = { atomicWrite: (filename: string, content: string, expected: string | null) => Promise<void> };
  const one = first as unknown as Writer, original = one.atomicWrite.bind(first);
  one.atomicWrite = async (filename, content, expected) => {
    if (filename.endsWith('index-note.md')) throw new Error('first failure');
    return original(filename, content, expected);
  };
  await assert.rejects(first.sync(snapshot()), /write failed/);
  const second = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  const two = second as unknown as Writer, resume = two.atomicWrite.bind(second);
  two.atomicWrite = async (filename, content, expected) => {
    await resume(filename, content, expected);
    if (filename.endsWith('.experiment-forest-sync.json')) throw new Error('recovery interrupted after publish');
  };
  await assert.rejects(second.sync(snapshot()), /recovery interrupted/);
  const third = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  const result = await third.sync(snapshot());
  assert.equal(result.status, 'synced'); assert.equal(result.conflicts.length, 0);
  assert.match(await readFile(path.join(root, folder, notePath()), 'utf8'), /record r1/);
});

test('an editor atomic-save after moving the old inode cannot be overwritten by mirror publication', async t => {
  const root = await vault(t), worker = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  await worker.sync(snapshot());
  const target = path.join(root, folder, notePath());
  const seam = worker as unknown as { publishNewFile: (temporary: string, filename: string) => Promise<void> };
  const original = seam.publishNewFile.bind(worker);
  seam.publishNewFile = async (temporary, filename) => {
    if (filename === target) {
      const editorTemp = path.join(root, 'editor-save.tmp');
      await writeFile(editorTemp, 'USER ATOMIC SAVE'); await rename(editorTemp, target);
    }
    return original(temporary, filename);
  };
  await assert.rejects(worker.sync(snapshot(2)), /write failed/);
  assert.equal(await readFile(target, 'utf8'), 'USER ATOMIC SAVE');
  const result = await new ObsidianMirrorSync({ vaultPath: root, folderName: folder }).sync(snapshot(2));
  assert.equal(result.status, 'conflict');
  assert.equal(await readFile(target, 'utf8'), 'USER ATOMIC SAVE');
});

test('an editor atomic-save immediately before the move is moved safely, detected and restored without overwrite', async t => {
  const root = await vault(t), worker = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  await worker.sync(snapshot());
  const target = path.join(root, folder, notePath());
  const seam = worker as unknown as { moveExistingFile: (filename: string, recovery: string) => Promise<void> };
  const original = seam.moveExistingFile.bind(worker);
  seam.moveExistingFile = async (filename, recovery) => {
    if (filename === target) {
      const editorTemp = path.join(root, 'editor-save.tmp');
      await writeFile(editorTemp, 'USER SAVE BEFORE MOVE'); await rename(editorTemp, target);
    }
    return original(filename, recovery);
  };
  await assert.rejects(worker.sync(snapshot(2)), /write failed/);
  assert.equal(await readFile(target, 'utf8'), 'USER SAVE BEFORE MOVE');
  const result = await new ObsidianMirrorSync({ vaultPath: root, folderName: folder }).sync(snapshot(2));
  assert.equal(result.status, 'conflict');
  assert.equal(await readFile(target, 'utf8'), 'USER SAVE BEFORE MOVE');
});

test('a process stopping after moving its old file resumes from the journal recovery location', async t => {
  const root = await vault(t), worker = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  await worker.sync(snapshot());
  const target = path.join(root, folder, notePath());
  const seam = worker as unknown as { publishNewFile: (temporary: string, filename: string) => Promise<void> };
  const original = seam.publishNewFile.bind(worker);
  seam.publishNewFile = async (temporary, filename) => {
    if (filename === target) throw new Error('process stopped after move');
    return original(temporary, filename);
  };
  await assert.rejects(worker.sync(snapshot(2)), /write failed/);
  await assert.rejects(readFile(target), { code: 'ENOENT' });
  const result = await new ObsidianMirrorSync({ vaultPath: root, folderName: folder }).sync(snapshot(2));
  assert.equal(result.status, 'synced'); assert.equal(result.conflicts.length, 0);
  assert.match(await readFile(target, 'utf8'), /record r2/);
});

test('a process stopping after moving the manifest reconstructs its ownership from the pending transaction', async t => {
  const root = await vault(t), worker = new ObsidianMirrorSync({ vaultPath: root, folderName: folder });
  await worker.sync(snapshot());
  const target = path.join(root, folder, '.experiment-forest-sync.json');
  const seam = worker as unknown as { publishNewFile: (temporary: string, filename: string) => Promise<void> };
  const original = seam.publishNewFile.bind(worker);
  seam.publishNewFile = async (temporary, filename) => {
    if (filename === target) throw new Error('stopped before manifest publication');
    return original(temporary, filename);
  };
  await assert.rejects(worker.sync(snapshot(2)), /stopped before manifest/);
  await assert.rejects(readFile(target), { code: 'ENOENT' });
  const result = await new ObsidianMirrorSync({ vaultPath: root, folderName: folder }).sync(snapshot(2));
  assert.equal(result.status, 'synced');
  assert.equal(JSON.parse(await readFile(target, 'utf8')).revision, 2);
});
