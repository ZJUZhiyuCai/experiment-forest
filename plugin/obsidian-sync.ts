import { constants } from 'node:fs';
import { link as hardlink, lstat, mkdir, open, readdir, readFile, rename, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import path from 'node:path';
import type { ForestSnapshot } from '../shared/model';
import type { ObsidianVault } from '../shared/obsidian-contract';
import { createObsidianMirror } from '../shared/obsidian';

export interface ObsidianSyncResult {
  status: 'synced' | 'conflict'; written: number; unchanged: number;
  conflicts: { path: string; reason: string }[]; stale: string[];
  entityCount: number; snapshotRevision: number; mirroredAt: string;
}
export interface ObsidianMirrorOptions { vaultPath: string; folderName: string }
interface Manifest { owner: 'experiment-forest'; version: 1; folderName: string; revision: number; files: Record<string, string> }
interface Journal {
  owner: 'experiment-forest'; version: 1; folderName: string;
  baseHash: string | null; base: Manifest | null; next: Manifest;
  changes: { path: string; oldHash: string | null; newHash: string; recovery: string | null }[];
}
const MANIFEST = '.experiment-forest-sync.json';
const OWNER = '.experiment-forest-owner.json';
const JOURNAL = '.experiment-forest-pending.json';
// Obsidian rewrites Bases from JSON to YAML when opening them and allows the user
// to customize views. Seed this exact generated view once; its existing manifest
// entry proves ownership, but subsequent view bytes belong to Obsidian/user.
const CUSTOMIZABLE_VIEW = 'Forest.base';
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
const missing = (error: unknown) => (error as NodeJS.ErrnoException)?.code === 'ENOENT';
const plain = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function obsidianMirrorFolder(profileKey: string): string {
  if (!profileKey) throw new Error('A stable Harness profile identity is required');
  return `Experiment Forest-${hash(profileKey).slice(0, 12)}`;
}

/** Test seams change only where the application registration JSON is read, never scan notes.
 * Production callers omit options and receive only Obsidian-registered vaults. */
export async function discoverObsidianVaults(options: {
  configPath?: string; platform?: NodeJS.Platform; homeDir?: string; env?: NodeJS.ProcessEnv;
} = {}): Promise<ObsidianVault[]> {
  const platform = options.platform ?? process.platform, home = options.homeDir ?? homedir(), env = options.env ?? process.env;
  const config = options.configPath ?? (platform === 'darwin'
    ? path.join(home, 'Library', 'Application Support', 'obsidian', 'obsidian.json')
    : platform === 'win32' ? path.join(env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'obsidian', 'obsidian.json')
      : path.join(env.XDG_CONFIG_HOME || path.join(home, '.config'), 'obsidian', 'obsidian.json'));
  let raw: string;
  try {
    const stat = await lstat(config);
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error('Obsidian registration file is not a regular bounded JSON file');
    raw = await readFile(config, 'utf8');
  } catch (error) { if (missing(error)) return []; throw error; }
  const registration: unknown = JSON.parse(raw);
  if (!plain(registration) || !plain(registration.vaults)) throw new Error('Obsidian vault registration is invalid');
  const vaults: ObsidianVault[] = [];
  for (const [id, value] of Object.entries(registration.vaults)) {
    if (!plain(value) || typeof value.path !== 'string' || !path.isAbsolute(value.path) || value.path.includes('\0')) continue;
    vaults.push({ id, name: path.basename(value.path), path: value.path, open: value.open === true });
  }
  return vaults.sort((a, b) => Number(b.open) - Number(a.open) || a.id.localeCompare(b.id));
}

/** Reject every symlink component, not only the final target. No recursive directory creation. */
async function safeDirectory(directory: string, create = false): Promise<void> {
  const resolved = path.resolve(directory), root = path.parse(resolved).root;
  let current = root;
  for (const component of resolved.slice(root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, component);
    let stat;
    try { stat = await lstat(current); } catch (error) {
      if (!create || !missing(error)) throw error;
      try { await mkdir(current); } catch (mkdirError) { if ((mkdirError as NodeJS.ErrnoException).code !== 'EEXIST') throw mkdirError; }
      stat = await lstat(current);
    }
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Unsafe Obsidian directory: ${current}`);
  }
}
function safeRelative(relative: string): boolean {
  return !!relative && !relative.includes('\\') && !/[\u0000-\u001f]/.test(relative) && !path.isAbsolute(relative)
    && relative.split('/').every(part => !!part && part !== '.' && part !== '..' && !part.includes(':'));
}
async function fileContent(filename: string, allowedLinks = 1): Promise<string | null> {
  let stat;
  try { stat = await lstat(filename); } catch (error) { if (missing(error)) return null; throw error; }
  if (stat.isSymbolicLink() || !stat.isFile() || (allowedLinks && stat.nlink !== allowedLinks)) throw new Error('Target is not an ordinary unlinked file');
  const handle = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const opened = await handle.stat();
    if (opened.ino !== stat.ino || opened.dev !== stat.dev || (allowedLinks && opened.nlink !== allowedLinks)) throw new Error('Target changed while opening');
    return await handle.readFile('utf8');
  } finally { await handle.close(); }
}
function parseManifest(raw: string, folderName: string): Manifest {
  const value: unknown = JSON.parse(raw);
  if (!plain(value) || value.owner !== 'experiment-forest' || value.version !== 1 || value.folderName !== folderName
    || !Number.isSafeInteger(value.revision) || (value.revision as number) < 0 || !plain(value.files)) throw new Error('Obsidian mirror ownership manifest is invalid');
  for (const [name, digest] of Object.entries(value.files)) {
    if (!safeRelative(name) || name.split('/').some(part => part.startsWith('.')) || typeof digest !== 'string' || !/^[a-f0-9]{64}$/.test(digest)) throw new Error('Obsidian mirror manifest contains an invalid path or hash');
  }
  return value as unknown as Manifest;
}

/** One class instance owns one profile-specific directory. It never edits vault config or
 * unrelated notes, never deletes stale files, and never overwrites a known manual edit.
 * A durable pending journal makes partial writes recoverable by their exact old/new hashes;
 * a distinct owner marker never claims that research data has already been synchronized. */
export class ObsidianMirrorSync {
  private readonly vault: string;
  private readonly root: string;
  private tail: Promise<unknown> = Promise.resolve();
  private closed = false;
  private recoveryTargets = new Map<string, string>();
  constructor(private readonly options: ObsidianMirrorOptions) {
    if (!path.isAbsolute(options.vaultPath) || !/^Experiment Forest-[a-f0-9]{8,64}$/.test(options.folderName)) throw new Error('Invalid Obsidian mirror target');
    this.vault = path.resolve(options.vaultPath);
    this.root = path.join(this.vault, options.folderName);
  }
  sync(snapshot: ForestSnapshot): Promise<ObsidianSyncResult> {
    if (this.closed) return Promise.reject(new Error('Obsidian mirror is closed'));
    // Capture caller data before it can change while waiting in the queue.
    const input = structuredClone(snapshot);
    const job = this.tail.then(() => this.perform(input));
    this.tail = job.catch(() => undefined);
    return job;
  }
  async close(): Promise<void> { this.closed = true; await this.tail; }

  private async syncDirectory(directory: string): Promise<void> {
    // Node cannot portably fsync a directory on Windows. On POSIX, publish the
    // directory entries after the staged file has been fsynced.
    if (process.platform === 'win32') return;
    const handle = await open(directory, constants.O_RDONLY | (constants.O_DIRECTORY ?? 0) | (constants.O_NOFOLLOW ?? 0));
    try { await handle.sync(); } finally { await handle.close(); }
  }
  private async publishNewFile(temporary: string, filename: string): Promise<void> {
    await hardlink(temporary, filename); // Atomic no-replace publication.
    await this.syncDirectory(path.dirname(filename));
  }
  private async moveExistingFile(filename: string, recovery: string): Promise<void> { await rename(filename, recovery); }

  private async atomicWrite(filename: string, content: string, expected: string | null): Promise<void> {
    const parent = path.dirname(filename);
    await safeDirectory(parent);
    const temporary = path.join(parent, `.ef-sync-${randomUUID()}.tmp`);
    const handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | (constants.O_NOFOLLOW ?? 0), 0o600);
    try {
      try { await handle.writeFile(content, 'utf8'); await handle.sync(); } finally { await handle.close(); }
    } catch (error) { await unlink(temporary).catch(() => undefined); throw error; }
    try {
      await safeDirectory(parent);
      const current = await fileContent(filename, 0);
      if (current !== expected) throw new Error('Target changed during synchronization');
      if (expected === null) {
        await this.publishNewFile(temporary, filename);
      } else {
        // Move the CURRENT inode aside first, including an external atomic save
        // racing the earlier check. Publish with no-replace, so another external
        // atomic save after this move can never be overwritten.
        const recovery = path.join(this.root, '.recovery');
        await safeDirectory(recovery, true);
        await this.syncDirectory(this.root);
        const saved = this.recoveryTargets.get(filename) ?? path.join(recovery, `${randomUUID()}-${path.basename(filename)}`);
        if (await fileContent(saved, 0) !== null) throw new Error('Recovery path is already occupied');
        await this.moveExistingFile(filename, saved);
        await this.syncDirectory(parent); await this.syncDirectory(recovery);
        if (await fileContent(saved, 0) !== expected) {
          // Restore only if the original path is still absent. Keep both copies
          // if an editor has already published another new inode there.
          await this.publishNewFile(saved, filename).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; });
          throw new Error('Target changed during synchronization; recovery copy retained');
        }
        await safeDirectory(parent);
        await this.publishNewFile(temporary, filename);
      }
    } finally {
      // Only the unique file created by this invocation is removed.
      await unlink(temporary).catch(error => { if (!missing(error)) throw error; });
    }
  }

  private async recover(previousRaw: string | null): Promise<string | null> {
    const filename = path.join(this.root, JOURNAL), raw = await fileContent(filename, 0);
    if (raw === null) return previousRaw;
    const candidate: unknown = JSON.parse(raw);
    if (!plain(candidate) || candidate.owner !== 'experiment-forest' || candidate.version !== 1 || candidate.folderName !== this.options.folderName
      || (candidate.baseHash !== null && (typeof candidate.baseHash !== 'string' || !/^[a-f0-9]{64}$/.test(candidate.baseHash))) || !Array.isArray(candidate.changes)) throw new Error('Invalid Obsidian pending journal');
    const target = parseManifest(JSON.stringify(candidate.next), this.options.folderName);
    const baseline: Manifest = candidate.base === null
      ? { owner: 'experiment-forest', version: 1, folderName: this.options.folderName, revision: 0, files: {} }
      : parseManifest(JSON.stringify(candidate.base), this.options.folderName);
    const changes = candidate.changes;
    const seen = new Set<string>();
    for (const change of changes) {
      if (!plain(change) || typeof change.path !== 'string' || !safeRelative(change.path) || change.path.split('/').some(p => p.startsWith('.')) || seen.has(change.path)
        || (change.oldHash !== null && (typeof change.oldHash !== 'string' || !/^[a-f0-9]{64}$/.test(change.oldHash)))
        || typeof change.newHash !== 'string' || !/^[a-f0-9]{64}$/.test(change.newHash) || target.files[change.path] !== change.newHash
        || (change.oldHash === null ? change.recovery !== null : typeof change.recovery !== 'string' || !/^\.recovery\/[a-f0-9-]{36}-[A-Za-z0-9_.-]+$/.test(change.recovery))) throw new Error('Invalid Obsidian pending change');
      seen.add(change.path);
    }
    const journal = candidate as unknown as Journal;
    const targetRaw = `${JSON.stringify(target, null, 2)}\n`;
    if (previousRaw !== targetRaw) {
      const recovered: Manifest = previousRaw === null
        ? structuredClone(baseline)
        : parseManifest(previousRaw, this.options.folderName);
      // A recovery can itself be interrupted after publishing some newly recognized
      // ownership. Accept only that exact baseline plus this transaction's new hashes.
      if ((previousRaw === null ? null : hash(previousRaw)) !== journal.baseHash) {
        const byPath = new Map(journal.changes.map(change => [change.path, change]));
        if (recovered.revision !== baseline.revision && recovered.revision !== target.revision) throw new Error('Obsidian manifest changed outside its pending transaction');
        for (const name of new Set([...Object.keys(recovered.files), ...Object.keys(baseline.files)])) {
          const current = recovered.files[name] ?? null, change = byPath.get(name);
          if (change ? current !== change.oldHash && current !== change.newHash : current !== (baseline.files[name] ?? null)) throw new Error('Obsidian manifest changed outside its pending transaction');
        }
      }
      for (const change of journal.changes) {
        if ((baseline.files[change.path] ?? null) !== change.oldHash) throw new Error('Pending change does not match its ownership baseline');
        const destination = path.join(this.root, ...change.path.split('/'));
        await safeDirectory(path.dirname(destination), true);
        let current: string | null;
        try {
          current = await fileContent(destination, 0);
          if (current === null && change.recovery !== null) {
            const saved = path.join(this.root, ...change.recovery.split('/'));
            await safeDirectory(path.dirname(saved));
            if (await fileContent(saved, 0) !== null) {
              await this.publishNewFile(saved, destination).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; });
              current = await fileContent(destination, 0);
            }
          }
        } catch { continue; }
        // Claim only bytes this transaction demonstrably generated, never arbitrary edits.
        if (current !== null && hash(current) === change.newHash) recovered.files[change.path] = change.newHash;
      }
      // Like a conflict manifest, this is a monotonic attempt boundary, not a UI
      // claim that every file is current. Prevent an older caller rolling back a
      // newer snapshot which reached the filesystem before the interruption.
      recovered.revision = Math.max(recovered.revision, target.revision);
      const recoveredRaw = `${JSON.stringify(recovered, null, 2)}\n`;
      if (recoveredRaw !== previousRaw) await this.atomicWrite(path.join(this.root, MANIFEST), recoveredRaw, previousRaw);
      previousRaw = recoveredRaw;
    }
    // Only our validated transaction file may be removed; unrelated notes are untouched.
    await safeDirectory(this.root);
    if (await fileContent(filename, 0) !== raw) throw new Error('Obsidian pending journal changed during recovery');
    await unlink(filename);
    await this.syncDirectory(this.root);
    return previousRaw;
  }
  private async perform(snapshot: ForestSnapshot): Promise<ObsidianSyncResult> {
    const rendered = createObsidianMirror(snapshot, undefined, this.options.folderName);
    await safeDirectory(this.vault);
    await safeDirectory(path.join(this.vault, '.obsidian'));
    await safeDirectory(this.root, true);
    await this.syncDirectory(this.vault);
    this.recoveryTargets.clear();
    const manifestPath = path.join(this.root, MANIFEST);
    let previousRaw = await fileContent(manifestPath, 0);
    const ownerPath = path.join(this.root, OWNER), ownerRaw = await fileContent(ownerPath);
    const expectedOwner = `${JSON.stringify({ owner: 'experiment-forest', version: 1, folderName: this.options.folderName })}\n`;
    if (ownerRaw === null) {
      if (previousRaw === null && (await readdir(this.root)).length !== 0) throw new Error('Refusing to take over a nonempty Obsidian folder without an ownership manifest');
      if (previousRaw !== null) parseManifest(previousRaw, this.options.folderName);
      await this.atomicWrite(ownerPath, expectedOwner, null);
    } else if (ownerRaw !== expectedOwner) throw new Error('Obsidian folder ownership marker is invalid');
    previousRaw = await this.recover(previousRaw);
    const previous: Manifest = previousRaw === null
      ? { owner: 'experiment-forest', version: 1, folderName: this.options.folderName, revision: 0, files: {} }
      : parseManifest(previousRaw, this.options.folderName);
    if (snapshot.revision < previous.revision) throw new Error('Refusing to overwrite a newer Obsidian mirror with an older snapshot');
    const desired = new Set(rendered.files.map(file => file.path));
    const next: Manifest = { ...previous, revision: snapshot.revision, files: { ...previous.files } };
    const result: ObsidianSyncResult = { status: 'synced', written: 0, unchanged: 0, conflicts: [],
      stale: Object.keys(previous.files).filter(name => !desired.has(name)), entityCount: rendered.entityCount,
      snapshotRevision: snapshot.revision, mirroredAt: new Date().toISOString() };
    const planned: { path: string; destination: string; content: string; existing: string | null }[] = [];
    for (const file of rendered.files) {
      if (!safeRelative(file.path)) throw new Error('Unsafe generated mirror path');
      const destination = path.join(this.root, ...file.path.split('/'));
      await safeDirectory(path.dirname(destination), true);
      let existing: string | null;
      try { existing = await fileContent(destination, previous.files[file.path] && file.path !== CUSTOMIZABLE_VIEW ? 0 : 1); } catch {
        result.conflicts.push({ path: file.path, reason: '目标不是普通文件、为符号链接或读取时发生变化；已保留' }); continue;
      }
      const owned = previous.files[file.path];
      if (owned && existing === null) { result.conflicts.push({ path: file.path, reason: '已管理文件缺失或被移动；不会自动重建' }); continue; }
      if (owned && existing !== null && file.path === CUSTOMIZABLE_VIEW) {
        // Preserve both automatic formatting and intentional view changes. Keep
        // the original seed hash as ownership evidence rather than claiming we
        // generated the user's current view. Missing/unsafe/unowned files still
        // follow the same conflict rules as every other mirror target.
        result.unchanged++;
        continue;
      }
      if (owned && existing !== null && hash(existing) !== owned) { result.conflicts.push({ path: file.path, reason: 'Obsidian 文件已被手工修改；未覆盖' }); continue; }
      if (!owned && existing !== null) { result.conflicts.push({ path: file.path, reason: '同名文件不属于此镜像；未接管' }); continue; }
      if (existing === file.content) result.unchanged++;
      else planned.push({ path: file.path, destination, content: file.content, existing });
      next.files[file.path] = hash(file.content);
    }
    const nextRaw = `${JSON.stringify(next, null, 2)}\n`;
    if (planned.length || nextRaw !== previousRaw) {
      const journal: Journal = { owner: 'experiment-forest', version: 1, folderName: this.options.folderName,
        baseHash: previousRaw === null ? null : hash(previousRaw), base: previousRaw === null ? null : previous, next,
        changes: planned.map(file => ({ path: file.path, oldHash: file.existing === null ? null : hash(file.existing), newHash: hash(file.content),
          recovery: file.existing === null ? null : `.recovery/${randomUUID()}-${path.basename(file.path)}` })) };
      const journalRaw = `${JSON.stringify(journal, null, 2)}\n`, journalPath = path.join(this.root, JOURNAL);
      await this.atomicWrite(journalPath, journalRaw, null);
      for (const change of journal.changes) if (change.recovery) this.recoveryTargets.set(path.join(this.root, ...change.path.split('/')), path.join(this.root, ...change.recovery.split('/')));
      for (const file of planned) {
        try { await this.atomicWrite(file.destination, file.content, file.existing); }
        catch (error) { throw new Error(`Obsidian write failed for ${file.path}`, { cause: error }); }
        result.written++;
      }
      if (nextRaw !== previousRaw) await this.atomicWrite(manifestPath, nextRaw, previousRaw);
      if (await fileContent(journalPath) !== journalRaw) throw new Error('Obsidian pending journal changed before completion');
      await unlink(journalPath);
      await this.syncDirectory(this.root);
    }
    result.status = result.conflicts.length ? 'conflict' : 'synced';
    return result;
  }
}
