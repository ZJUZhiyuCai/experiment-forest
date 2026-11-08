import type { ForestEntity } from '../shared/model';
import type { ObsidianStatus } from '../shared/obsidian-contract';
import { obsidianEntityPath } from '../shared/obsidian';

export interface ObsidianNoteTarget {
  relativePath: string;
  uri: string;
  wikilink: string;
  state: 'synced' | 'pending' | 'conflict';
}

/** No filesystem guesses: use the registered vault and the mirror's own path function.
 * Official URI contract: https://help.obsidian.md/uri (verified 2026-11-08). */
export function obsidianNoteTarget(
  status: ObsidianStatus,
  entity: Pick<ForestEntity, 'id' | 'title' | 'updatedAt'>,
): ObsidianNoteTarget | null {
  if (!status.enabled || status.state === 'disabled' || !status.vaultId
    || !status.vaults.some(v => v.id === status.vaultId)
    || !/^Experiment Forest-[a-f0-9]{8,64}$/.test(status.folder)) return null;
  let file: string;
  try { file = obsidianEntityPath(entity.id); } catch { return null; }
  const relativePath = `${status.folder}/${file}`;
  const conflict = status.conflicts.some(c => c.path === file || c.path === relativePath);
  const mirrored = Date.parse(status.lastSyncedAt ?? '');
  const updated = Date.parse(entity.updatedAt);
  const synced = !['error', 'syncing', 'idle'].includes(status.state)
    && Number.isFinite(mirrored) && Number.isFinite(updated) && mirrored >= updated;
  // Keep arbitrary titles out of link syntax while retaining their readable label.
  const label = (entity.title || '实验页').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\[/g, '&#91;').replace(/\]/g, '&#93;').replace(/\|/g, '&#124;').replace(/[\r\n\t]/g, ' ');
  return {
    relativePath,
    uri: `obsidian://open?vault=${encodeURIComponent(status.vaultId)}&file=${encodeURIComponent(relativePath)}&paneType=tab`,
    wikilink: `[[${relativePath.replace(/\.md$/, '')}|${label}]]`,
    state: conflict ? 'conflict' : synced ? 'synced' : 'pending',
  };
}
