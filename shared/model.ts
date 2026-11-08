import type { PageApi } from './page';
/** JSON-only contract shared by the Harness host and the browser client. */
import type { CreateRunInput, UpdateRunStepInput, ForestContextInput, ForestContext } from './workflow';
import type { ConfigureObsidianInput, ObsidianStatus } from './obsidian-contract';
export type { CreateRunInput, UpdateRunStepInput, ForestContextInput, ForestContext } from './workflow';
export type { ConfigureObsidianInput, ObsidianStatus } from './obsidian-contract';
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
export const ENTITY_KINDS = ['project', 'record', 'note', 'sop', 'sample', 'plan'] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export interface ForestEntity {
  id: string;
  kind: EntityKind;
  title: string;
  content: string;
  status: string;
  projectId?: string;
  tags: string[];
  /** Kind-specific fields and preserved legacy fields; never provider credentials. */
  data: JsonObject;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntity {
  kind: EntityKind;
  title: string;
  content?: string;
  status?: string;
  projectId?: string;
  tags?: string[];
  data?: JsonObject;
}
export interface EntityPatch {
  title?: string;
  content?: string;
  status?: string;
  /** null removes the association. */
  projectId?: string | null;
  tags?: string[];
  data?: JsonObject;
}
export interface UpdateEntity {
  id: string;
  expectedRevision: number;
  patch: EntityPatch;
}
export interface EntityFilter {
  kind?: EntityKind;
  projectId?: string;
  query?: string;
  status?: string;
  includeArchived?: boolean;
}
export interface ForestSnapshot {
  revision: number;
  entities: ForestEntity[];
}
export interface ImportArchive {
  id: string;
  importedAt: string;
  source: 'legacy' | 'forest-v1';
  entityCount: number;
  /** Only business collections, with credential/chat fields removed. */
  raw: JsonObject;
}
export interface ForestState extends ForestSnapshot {
  schemaVersion: 1;
  imports: ImportArchive[];
}
export interface ForestExport extends ForestState {
  format: 'experiment-forest';
  exportedAt: string;
}
export interface ImportPreview {
  fingerprint: string;
  source: 'legacy' | 'forest-v1';
  total: number;
  createCount: number;
  unchangedCount: number;
  byKind: Record<EntityKind, number>;
  conflicts: { id: string; title: string; reason: string }[];
  warnings: string[];
  alreadyImported: boolean;
  /** Use this revision for import; a concurrent mutation requires another preview. */
  revision: number;
}
export interface ImportResult {
  imported: number;
  unchanged: number;
  alreadyImported: boolean;
  revision: number;
  warnings: string[];
}
export interface ForestApi extends PageApi {
  list(filter?: EntityFilter): Promise<ForestEntity[]>;
  get(id: string): Promise<ForestEntity | null>;
  snapshot(): Promise<ForestSnapshot>;
  create(input: CreateEntity): Promise<ForestEntity>;
  update(input: UpdateEntity): Promise<ForestEntity>;
  archive(input: { id: string; expectedRevision: number }): Promise<ForestEntity>;
  createRun(input: CreateRunInput): Promise<ForestEntity>;
  updateRunStep(input: UpdateRunStepInput): Promise<ForestEntity>;
  context(input: ForestContextInput): Promise<ForestContext>;
  obsidianStatus(): Promise<ObsidianStatus>;
  configureObsidian(input: ConfigureObsidianInput): Promise<ObsidianStatus>;
  syncObsidian(): Promise<ObsidianStatus>;
  export(): Promise<ForestExport>;
  previewImport(input: { data: unknown }): Promise<ImportPreview>;
  import(input: { data: unknown; expectedRevision: number }): Promise<ImportResult>;
}
