/** Owner-only local Obsidian connection. The client selects a registered vault ID, never a path. */
export interface ObsidianVault { id: string; name: string; path: string; open: boolean }
export interface ObsidianConflict { path: string; reason: string }
export interface ObsidianStatus {
  enabled: boolean;
  vaultId: string | null;
  /** Stable profile-specific folder inside the selected vault. */
  folder: string;
  vaults: ObsidianVault[];
  state: 'disabled' | 'idle' | 'syncing' | 'synced' | 'conflict' | 'error';
  lastError: string | null;
  conflicts: ObsidianConflict[];
  stale: string[];
  lastSyncedRevision: number | null;
  lastSyncedAt: string | null;
  materials?: { total: number; mirrored: number; issues: { materialId: string; recordId: string; name: string;
    state: 'missing' | 'conflict' | 'error'; message: string }[] };
}
export interface ConfigureObsidianInput { vaultId: string | null }
