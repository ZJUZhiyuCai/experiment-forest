/** Coordinates durable plugin data with a best-effort, owner-configured local mirror. */
import type { ForestSnapshot } from '../shared/model';
import type { ConfigureObsidianInput, ObsidianStatus, ObsidianVault } from '../shared/obsidian-contract';
import { ForestError } from './migration';

export interface MirrorResult {
  status: 'synced' | 'conflict'; written: number; unchanged: number;
  conflicts: { path: string; reason: string }[]; stale: string[];
  entityCount: number; snapshotRevision: number; mirroredAt: string; materials?:ObsidianStatus['materials'];
}
export interface MirrorPort { sync(snapshot: ForestSnapshot): Promise<MirrorResult>; close(): Promise<void> }
export interface ObsidianControllerOptions {
  folder: string;
  readConfig(): Promise<{ vaultId: string | null }>;
  writeConfig(config: { vaultId: string | null }): Promise<void>;
  discover(): Promise<ObsidianVault[]>;
  createMirror(vault: ObsidianVault, folder: string): MirrorPort;
  snapshot(): Promise<ForestSnapshot>;
}
export class ObsidianController {
  private vaultId: string | null = null;
  private mirror: MirrorPort | null = null;
  private mirrorPath: string | null = null;
  private latest: ForestSnapshot | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private backgroundQueued = false;
  private closing = false;
  private state: ObsidianStatus['state'] = 'disabled';
  private lastError: string | null = null;
  private conflicts: ObsidianStatus['conflicts'] = [];
  private stale: string[] = [];
  private materials:ObsidianStatus['materials'];
  private lastSyncedRevision: number | null = null;
  private lastSyncedAt: string | null = null;
  constructor(private readonly options: ObsidianControllerOptions) {}

  async start(): Promise<void> {
    const config = await this.options.readConfig();
    this.vaultId = config.vaultId;
    this.acceptSnapshot(await this.options.snapshot());
    if (this.vaultId) {
      this.state = 'idle';
      // Activation does not depend on an external vault being available.
      this.onCommit(this.latest!);
    }
  }
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    if (this.closing) return Promise.reject(new ForestError('closed', 'Obsidian 同步已关闭'));
    const result = this.queue.then(work);
    this.queue = result.catch(() => undefined);
    return result;
  }
  private view(vaults: ObsidianVault[]): ObsidianStatus {
    return structuredClone({ enabled: this.vaultId !== null, vaultId: this.vaultId, folder: this.options.folder, vaults,
      state: this.state, lastError: this.lastError, conflicts: this.conflicts, stale: this.stale,
      lastSyncedRevision: this.lastSyncedRevision, lastSyncedAt: this.lastSyncedAt,materials:this.materials });
  }
  async status(): Promise<ObsidianStatus> {
    try { return this.view(await this.options.discover()); } catch (error) {
      return { ...this.view([]), state: this.vaultId ? 'error' : 'disabled', lastError: this.message(error) };
    }
  }
  configure(input: ConfigureObsidianInput): Promise<ObsidianStatus> {
    if (!input || Object.keys(input).some(key => key !== 'vaultId') || !(input.vaultId === null || typeof input.vaultId === 'string' && input.vaultId.length > 0 && input.vaultId.length <= 256)) {
      return Promise.reject(new ForestError('invalid', '请选择已登记的 Obsidian vault'));
    }
    const vaultId = input.vaultId;
    return this.enqueue(async () => {
      const vaults = vaultId === null ? [] : await this.options.discover();
      if (vaultId !== null && !vaults.some(vault => vault.id === vaultId)) throw new ForestError('invalid', '选中的 Obsidian vault 不在本机登记列表中');
      // Persist before replacing the working connection. A failed config save leaves it intact.
      await this.options.writeConfig({ vaultId });
      await this.mirror?.close(); this.mirror = null; this.mirrorPath = null;
      this.vaultId = vaultId;
      this.state = vaultId ? 'idle' : 'disabled'; this.lastError = null; this.conflicts = []; this.stale = [];
      this.lastSyncedAt = null; this.lastSyncedRevision = null;this.materials=undefined;
      if (vaultId) {
        await this.syncSnapshot(this.acceptSnapshot(await this.options.snapshot()));
      }
      return this.status();
    });
  }
  sync(): Promise<ObsidianStatus> {
    return this.enqueue(async () => {
      const latest = this.acceptSnapshot(await this.options.snapshot());
      if (this.vaultId) await this.syncSnapshot(latest);
      return this.status();
    });
  }
  /** Synchronous and nonthrowing: business commits do not await filesystem work. */
  onCommit(snapshot: ForestSnapshot): void {
    if (this.closing) return;
    this.acceptSnapshot(snapshot);
    if (!this.vaultId || this.backgroundQueued) return;
    this.backgroundQueued = true;
    void this.enqueue(async () => {
      try {
        while (this.vaultId && this.latest) {
          const target = this.latest;
          await this.syncSnapshot(target);
          if (!this.latest || this.latest.revision <= target.revision) break;
        }
      } finally { this.backgroundQueued = false; }
    }).catch(error => { this.backgroundQueued = false; this.state = 'error'; this.lastError = this.message(error); });
  }
  private acceptSnapshot(snapshot: ForestSnapshot): ForestSnapshot {
    if (!this.latest || snapshot.revision > this.latest.revision) this.latest = structuredClone(snapshot);
    return this.latest;
  }
  private async syncSnapshot(snapshot: ForestSnapshot): Promise<void> {
    if (!this.vaultId) return;
    this.state = 'syncing'; this.lastError = null;
    try {
      // Resolve the registration on every attempt. Never keep writing to an obsolete path.
      const vault = (await this.options.discover()).find(v => v.id === this.vaultId);
      if (!vault) throw new Error('Obsidian vault 已不在本机登记列表中，请重新选择');
      if (!this.mirror || this.mirrorPath !== vault.path) {
        await this.mirror?.close();
        this.mirror = this.options.createMirror(vault, this.options.folder); this.mirrorPath = vault.path;
      }
      const result = await this.mirror.sync(snapshot);
      this.materials=result.materials; this.state = result.status; this.conflicts = result.conflicts; this.stale = result.stale;
      if (result.status === 'synced') { this.lastSyncedRevision = result.snapshotRevision; this.lastSyncedAt = result.mirroredAt; }
    } catch (error) { this.state = 'error'; this.lastError = this.message(error); }
  }
  private message(error: unknown): string { return error instanceof Error ? error.message : 'Obsidian 同步失败；实验数据已保存在 Harness'; }
  async close(): Promise<void> {
    this.closing = true;
    await this.queue;
    await this.mirror?.close();
  }
}
