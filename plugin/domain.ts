import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ENTITY_KINDS, type CreateEntity, type EntityFilter, type ForestApi, type ForestEntity, type ForestExport, type ForestSnapshot, type ForestState, type ImportPreview, type ImportResult, type UpdateEntity } from '../shared/model.js';
import { canonical, DEFAULT_STATUS, entityId, entityKind, entityRelations, ForestError, json, MAX_BACKUP_BYTES, MAX_ENTITIES, object, prepareImport, revision, text, validateEntity, validateReferences, validateState, type PreparedImport } from './migration.js';

export { ForestError, validateState } from './migration.js';
export interface ForestPersistence {
  /** A malformed existing store must reject; never translate it into an empty store. */
  read(): Promise<ForestState | null>;
  /** Resolve only after durable commit. After failure the repository reloads before serving data. */
  write(state: ForestState): Promise<void>;
}
export const createInitialState = (): ForestState => ({ schemaVersion: 1, revision: 0, entities: [], imports: [] });
export const stateSchema = z.unknown().transform((value, ctx): ForestState => {
  try { return validateState(value); } catch (error) {
    ctx.addIssue({ code: 'custom', message: error instanceof Error ? error.message : '数据库结构无效' });
    return z.NEVER;
  }
});
const clone = <T>(value: T): T => structuredClone(value);

/** Serial domain transactions shared by UI RPCs and model tools. */
export class ForestRepository implements ForestApi {
  private state: ForestState | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private closing = false;
  constructor(private readonly persistence: ForestPersistence) {}

  private enqueue<T>(work: (state: ForestState) => Promise<T> | T): Promise<T> {
    if (this.closing) return Promise.reject(new ForestError('closed', '实验小森林服务已关闭'));
    const result = this.queue.then(async () => {
      if (!this.state) {
        const saved = await this.persistence.read();
        this.state = saved === null ? createInitialState() : validateState(saved);
      }
      return work(this.state);
    });
    this.queue = result.catch(() => undefined);
    return result;
  }

  async close(): Promise<void> {
    this.closing = true;
    await this.queue;
  }

  private async commit(current: ForestState, next: ForestState, signal?: AbortSignal): Promise<void> {
    next.revision = current.revision + 1;
    if (!Number.isSafeInteger(next.revision)) throw new ForestError('invalid', '数据库版本号已超出范围');
    if (next.entities.length > MAX_ENTITIES) throw new ForestError('invalid', '记录总数超过 10000 条');
    if (Buffer.byteLength(JSON.stringify(next)) > MAX_BACKUP_BYTES) throw new ForestError('invalid', '数据库超过 20 MiB；请导出备份并拆分工作区');
    validateReferences(next.entities);
    // Persistence receives a detached snapshot; a failed adapter cannot corrupt memory.
    signal?.throwIfAborted();
    try { await this.persistence.write(clone(next)); } catch (error) {
      // A transport/storage failure may occur after durable commit. Do not serve a stale
      // success-shaped snapshot; reopen through the adapter (which may quarantine reads).
      this.state = undefined;
      throw error;
    }
    this.state = next;
  }

  snapshot(): Promise<ForestSnapshot> {
    return this.enqueue(state => clone({ revision: state.revision, entities: state.entities }));
  }

  list(filter: EntityFilter = {}): Promise<ForestEntity[]> {
    return this.enqueue(state => {
      const f = object(filter, '筛选条件');
      if (f.kind !== undefined) entityKind(f.kind);
      if (f.projectId !== undefined) entityId(f.projectId);
      const query = f.query === undefined ? '' : text(f.query, '搜索词', 300, true).trim().toLocaleLowerCase();
      if (f.status !== undefined) text(f.status, '状态', 32);
      if (f.includeArchived !== undefined && typeof f.includeArchived !== 'boolean') throw new ForestError('invalid', '归档筛选须为布尔值');
      return clone(state.entities.filter(e =>
        (!f.kind || e.kind === f.kind) && (!f.projectId || e.projectId === f.projectId) &&
        (!f.status || e.status === f.status) && (f.includeArchived || f.status === 'archived' || e.status !== 'archived') &&
        (!query || [e.title, e.content, ...e.tags, JSON.stringify(e.data)].join('\n').toLocaleLowerCase().includes(query)),
      ).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id)));
    });
  }

  get(id: string): Promise<ForestEntity | null> {
    return this.enqueue(state => {
      const validId = entityId(id);
      return clone(state.entities.find(e => e.id === validId) ?? null);
    });
  }

  create(input: CreateEntity, signal?: AbortSignal): Promise<ForestEntity> {
    // Capture caller input now, not after a queued operation has allowed it to mutate.
    let captured: unknown;
    try { captured = clone(input); } catch { return Promise.reject(new ForestError('invalid', '记录输入无效')); }
    return this.enqueue(async state => {
      const i = object(captured, '新记录');
      this.onlyKeys(i, ['kind', 'title', 'content', 'status', 'projectId', 'tags', 'data']);
      const kind = entityKind(i.kind);
      const now = new Date().toISOString();
      const entity = validateEntity({
        ...i, id: randomUUID(), kind, content: i.content ?? '', status: i.status ?? DEFAULT_STATUS[kind],
        tags: i.tags ?? [], data: i.data ?? {}, revision: 1, createdAt: now, updatedAt: now,
      });
      this.requireActiveProject(entity, state);
      this.requireActiveRelations(entity, state);
      const next = clone(state);
      next.entities.push(entity);
      await this.commit(state, next, signal);
      return clone(entity);
    });
  }

  update(input: UpdateEntity): Promise<ForestEntity> {
    let captured: unknown;
    try { captured = clone(input); } catch { return Promise.reject(new ForestError('invalid', '修改输入无效')); }
    return this.enqueue(async state => {
      const i = object(captured, '修改请求');
      this.onlyKeys(i, ['id', 'expectedRevision', 'patch']);
      const id = entityId(i.id);
      const existing = state.entities.find(e => e.id === id);
      if (!existing) throw new ForestError('not-found', '记录不存在');
      if (existing.revision !== revision(i.expectedRevision, 1)) throw new ForestError('conflict', '记录已被其他操作修改，请刷新后重试');
      const patch = object(i.patch, '修改内容');
      this.onlyKeys(patch, ['title', 'content', 'status', 'projectId', 'tags', 'data']);
      if (!Object.keys(patch).length) return clone(existing);
      if (Object.values(patch).some(v => v === undefined)) throw new ForestError('invalid', '修改字段不能是 undefined');
      const merged = { ...existing, ...patch, revision: existing.revision + 1, updatedAt: new Date().toISOString() };
      if (patch.projectId === null) delete merged.projectId;
      const entity = validateEntity(merged);
      if (entity.projectId !== existing.projectId) this.requireActiveProject(entity, state);
      this.requireActiveRelations(entity, state, existing);
      const next = clone(state);
      next.entities = next.entities.map(e => e.id === id ? entity : e);
      await this.commit(state, next);
      return clone(entity);
    });
  }

  archive(input: { id: string; expectedRevision: number }): Promise<ForestEntity> {
    return this.update({ id: input.id, expectedRevision: input.expectedRevision, patch: { status: 'archived' } });
  }

  export(): Promise<ForestExport> {
    return this.enqueue(state => ({ ...clone(state), format: 'experiment-forest', exportedAt: new Date().toISOString() }));
  }

  previewImport(input: { data: unknown }): Promise<ImportPreview> {
    let prepared: PreparedImport;
    try { prepared = prepareImport(input.data); } catch (error) { return Promise.reject(error); }
    return this.enqueue(state => this.preview(state, prepared));
  }

  import(input: { data: unknown; expectedRevision: number }): Promise<ImportResult> {
    let prepared: PreparedImport;
    let expected: number;
    try { prepared = prepareImport(input.data); expected = revision(input.expectedRevision); } catch (error) { return Promise.reject(error); }
    return this.enqueue(async state => {
      if (state.revision !== expected) throw new ForestError('conflict', '数据已改变，请重新预览导入');
      const preview = this.preview(state, prepared);
      if (preview.alreadyImported) return { imported: 0, unchanged: prepared.entities.length, alreadyImported: true, revision: state.revision, warnings: preview.warnings };
      if (preview.conflicts.length) throw new ForestError('conflict', '导入包含冲突记录；未写入任何数据，请先检查预览');
      const next = clone(state);
      const ids = new Set(state.entities.map(e => e.id));
      next.entities.push(...prepared.entities.filter(e => !ids.has(e.id)));
      for (const evidence of prepared.archives) {
        const prior = next.imports.find(a => a.id === evidence.id);
        if (!prior) next.imports.push(evidence);
      }
      if (!next.imports.some(a => a.id === prepared.fingerprint)) {
        next.imports.push({ id: prepared.fingerprint, source: prepared.source, importedAt: new Date().toISOString(), entityCount: prepared.entities.length, raw: prepared.raw });
      }
      await this.commit(state, next);
      return { imported: preview.createCount, unchanged: preview.unchangedCount, alreadyImported: false, revision: next.revision, warnings: preview.warnings };
    });
  }

  private preview(state: ForestState, prepared: PreparedImport): ImportPreview {
    const byKind = Object.fromEntries(ENTITY_KINDS.map(k => [k, 0])) as ImportPreview['byKind'];
    const existing = new Map(state.entities.map(e => [e.id, e]));
    let createCount = 0;
    let unchangedCount = 0;
    const conflicts: ImportPreview['conflicts'] = [];
    const alreadyImported = state.imports.some(a => a.id === prepared.fingerprint);
    for (const e of prepared.entities) {
      byKind[e.kind]++;
      const previous = existing.get(e.id);
      if (!previous) createCount++;
      else if (canonical(json(previous)) === canonical(json(e))) unchangedCount++;
      else conflicts.push({ id: e.id, title: e.title, reason: '相同 ID 的记录内容不同，导入不会覆盖现有记录。' });
    }
    return { fingerprint: prepared.fingerprint, source: prepared.source, total: prepared.entities.length,
      createCount: alreadyImported ? 0 : createCount,
      unchangedCount: alreadyImported ? prepared.entities.length : unchangedCount,
      byKind, conflicts: alreadyImported ? [] : conflicts, warnings: alreadyImported ? [...prepared.warnings, '此备份已导入，重复导入不会覆盖后续编辑。'] : prepared.warnings,
      alreadyImported, revision: state.revision };
  }

  private onlyKeys(value: Record<string, unknown>, keys: string[]): void {
    if (Object.keys(value).some(k => !keys.includes(k))) throw new ForestError('invalid', '请求包含不允许修改的字段');
  }
  private requireActiveProject(entity: ForestEntity, state: ForestState): void {
    if (!entity.projectId) return;
    if (entity.kind === 'project') throw new ForestError('reference', '课题不能归属于另一个课题');
    const project = state.entities.find(e => e.id === entity.projectId && e.kind === 'project');
    if (!project) throw new ForestError('reference', '关联课题不存在');
    if (project.status === 'archived') throw new ForestError('reference', '不能新增关联到已归档课题');
  }
  private requireActiveRelations(entity: ForestEntity, state: ForestState, previous?: ForestEntity): void {
    const before = new Set(previous ? entityRelations(previous).map(r => `${r.field}:${r.id}`) : []);
    const all = new Map(state.entities.map(e => [e.id, e]));
    for (const relation of entityRelations(entity)) {
      const target = all.get(relation.id);
      if (!target || target.kind !== relation.targetKind) throw new ForestError('reference', `${relation.field} 的关联对象不存在或类型不符`);
      if (target.status === 'archived' && !before.has(`${relation.field}:${relation.id}`)) {
        throw new ForestError('reference', `${relation.field} 不能新增关联到已归档对象`);
      }
    }
  }
}
