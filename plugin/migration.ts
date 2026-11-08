import { createHash } from 'node:crypto';
import { ENTITY_KINDS, type EntityKind, type ForestEntity, type ForestState, type ImportArchive, type Json, type JsonObject } from '../shared/model.js';
import { PAGE_KEY, pageSchema } from '../shared/page';
import { getRunWorkflow, hasWorkflowMarker, workflowSchema, WORKFLOW_KEY } from '../shared/workflow.js';

export class ForestError extends Error {
  constructor(public readonly code: 'invalid' | 'conflict' | 'not-found' | 'reference' | 'closed', message: string) {
    super(message);
    this.name = 'ForestError';
  }
}
export const MAX_ENTITIES = 10_000;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
export const STATUSES: Record<EntityKind, readonly string[]> = {
  project: ['planning', 'active', 'paused', 'completed', 'archived'],
  record: ['draft', 'completed', 'archived'],
  note: ['active', 'draft', 'archived'],
  sop: ['draft', 'pending', 'approved', 'rejected', 'archived'],
  sample: ['available', 'in_use', 'exhausted', 'expired', 'contaminated', 'reserved', 'archived'],
  plan: ['scheduled', 'in-progress', 'completed', 'cancelled', 'postponed', 'archived'],
};
export const DEFAULT_STATUS: Record<EntityKind, string> = {
  project: 'active', record: 'draft', note: 'active', sop: 'draft', sample: 'available', plan: 'scheduled',
};
const forbiddenKey = /^(?:__proto__|prototype|constructor|api[_-]?key|authorization|access[_-]?token|refresh[_-]?token|password|secret|aiSettings|aiChatSessions|chatSessions|chatHistory)$/i;

export function object(value: unknown, label = '数据'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new ForestError('invalid', `${label}必须是对象`);
  }
  return value as Record<string, unknown>;
}
export function text(value: unknown, label: string, max: number, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) {
    throw new ForestError('invalid', `${label}须为${allowEmpty ? '' : '非空'}文本，最多 ${max} 字符`);
  }
  return value;
}
export function revision(value: unknown, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) throw new ForestError('invalid', '版本号无效');
  return value as number;
}
export function entityId(value: unknown): string {
  const id = text(value, '记录 ID', 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(id)) throw new ForestError('invalid', '记录 ID 格式无效');
  return id;
}
export function entityKind(value: unknown): EntityKind {
  if (!ENTITY_KINDS.includes(value as EntityKind)) throw new ForestError('invalid', '记录类型无效');
  return value as EntityKind;
}
export function date(value: unknown, label: string): string {
  const s = text(value, label, 40);
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(s) || !Number.isFinite(Date.parse(s))) {
    throw new ForestError('invalid', `${label}须为有效 ISO 日期`);
  }
  const [year, month, day] = s.slice(0, 10).split('-').map(Number);
  if (month! < 1 || month! > 12 || day! < 1 || day! > new Date(Date.UTC(year!, month!, 0)).getUTCDate()) {
    throw new ForestError('invalid', `${label}须为真实存在的日期`);
  }
  return s;
}

/** Validate detached, finite JSON. Import mode removes credential/config fields recursively. */
export function json(value: unknown, redact = false, depth = 0, seen = new Set<object>()): Json {
  if (depth > 30) throw new ForestError('invalid', '数据嵌套过深');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'object' || !value) throw new ForestError('invalid', '数据必须是有限 JSON 值');
  if (seen.has(value)) throw new ForestError('invalid', '数据不能包含循环引用');
  seen.add(value);
  let result: Json;
  if (Array.isArray(value)) {
    if (value.length > MAX_ENTITIES) throw new ForestError('invalid', '数组过大');
    result = value.map(v => json(v, redact, depth + 1, seen));
  } else {
    const record = object(value);
    result = Object.fromEntries(Object.entries(record).flatMap(([key, v]) => {
      if (forbiddenKey.test(key)) {
        if (redact) return [];
        throw new ForestError('invalid', '业务数据不得包含凭据、聊天设置或特殊对象字段');
      }
      return [[key, json(v, redact, depth + 1, seen)]];
    }));
  }
  seen.delete(value);
  return result;
}
export function jsonObject(value: unknown, redact = false): JsonObject {
  object(value);
  const result = json(value, redact) as JsonObject;
  if (Buffer.byteLength(JSON.stringify(result)) > 2 * 1024 * 1024) throw new ForestError('invalid', '单条扩展数据不能超过 2 MiB');
  return result;
}
interface RelationSpec { field: string; targetKind: EntityKind; many?: boolean }
function relationSpecs(kind: EntityKind): RelationSpec[] {
  if (kind === 'record') return [{ field: 'sopId', targetKind: 'sop' }, { field: 'relatedSamples', targetKind: 'sample', many: true }];
  if (kind === 'note' || kind === 'plan') return [{ field: 'relatedRecordId', targetKind: 'record' }];
  return [];
}
export interface EntityRelation { field: string; targetKind: EntityKind; id: string }
/** Only declared relation fields participate; all other data stays user-owned JSON. */
export function entityRelations(entity: Pick<ForestEntity, 'kind' | 'data'>): EntityRelation[] {
  const relations: EntityRelation[] = [];
  for (const spec of relationSpecs(entity.kind)) {
    const value = entity.data[spec.field];
    if (value === undefined || value === null || value === '') continue;
    if (spec.many) {
      if (!Array.isArray(value)) throw new ForestError('invalid', `${spec.field} 须为记录 ID 数组`);
      const ids = value.map(entityId);
      if (new Set(ids).size !== ids.length) throw new ForestError('invalid', `${spec.field} 不能包含重复 ID`);
      relations.push(...ids.map(id => ({ field: spec.field, targetKind: spec.targetKind, id })));
    } else {
      relations.push({ field: spec.field, targetKind: spec.targetKind, id: entityId(value) });
    }
  }
  return relations;
}
export function validateEntity(value: unknown): ForestEntity {
  const e = object(value, '记录');
  const kind = entityKind(e.kind);
  const status = text(e.status, '状态', 32);
  if (!STATUSES[kind].includes(status)) throw new ForestError('invalid', `${kind} 的状态无效：${status}`);
  if (!Array.isArray(e.tags) || e.tags.length > 30) throw new ForestError('invalid', '标签须为数组，最多 30 项');
  const tags = [...new Set(e.tags.map(tag => text(tag, '标签', 80).trim()))];
  const data = jsonObject(e.data);
  if (data[PAGE_KEY] !== undefined && (kind !== 'record' || !pageSchema.safeParse(data[PAGE_KEY]).success)) throw new ForestError('invalid', '实验页结构或记录类型无效');
  if (hasWorkflowMarker(data[WORKFLOW_KEY])) {
    const parsed = workflowSchema.safeParse(data[WORKFLOW_KEY]);
    if (!parsed.success) throw new ForestError('invalid', `工作流结构无效：${parsed.error.issues[0]?.message ?? '未知错误'}`);
    if (parsed.data.type === 'sop' && kind !== 'sop' || parsed.data.type === 'run' && kind !== 'record') {
      throw new ForestError('invalid', '工作流与记录类型不匹配');
    }
    if (parsed.data.type === 'run' && data.sopId !== parsed.data.source.sopId) throw new ForestError('invalid', '运行记录必须保留来源 SOP 关联');
  }
  entityRelations({ kind, data });
  for (const field of ['date', 'startDate', 'endDate', 'plannedDate', 'expiryDate']) {
    if (data[field] !== undefined && data[field] !== null && data[field] !== '') date(data[field], field);
  }
  const createdAt = date(e.createdAt, '创建时间');
  const updatedAt = date(e.updatedAt, '更新时间');
  if (Date.parse(updatedAt) < Date.parse(createdAt)) throw new ForestError('invalid', '更新时间不能早于创建时间');
  return {
    id: entityId(e.id), kind, title: text(e.title, '标题', 300).trim(),
    content: text(e.content, '正文', 1_048_576, true), status,
    ...(e.projectId === undefined ? {} : { projectId: entityId(e.projectId) }),
    tags, data, revision: revision(e.revision, 1), createdAt, updatedAt,
  };
}
export function validateReferences(entities: ForestEntity[]): void {
  const all = new Map<string, ForestEntity>();
  const requests = new Set<string>();
  for (const e of entities) {
    if (all.has(e.id)) throw new ForestError('invalid', `重复记录 ID：${e.id}`);
    all.set(e.id, e);
    const run = getRunWorkflow(e);
    if (run) {
      if (requests.has(run.requestId)) throw new ForestError('invalid', '运行创建请求 ID 重复');
      requests.add(run.requestId);
    }
  }
  for (const e of entities) {
    if (e.kind === 'project' && e.projectId) throw new ForestError('reference', '课题不能归属于另一个课题');
    if (e.projectId && all.get(e.projectId)?.kind !== 'project') throw new ForestError('reference', `关联课题不存在：${e.projectId}`);
    for (const relation of entityRelations(e)) {
      if (all.get(relation.id)?.kind !== relation.targetKind) {
        throw new ForestError('reference', `${relation.field} 的关联对象不存在或类型不符：${relation.id}`);
      }
    }
  }
}
function archive(value: unknown): ImportArchive {
  const a = object(value, '导入存档');
  if (a.source !== 'legacy' && a.source !== 'forest-v1') throw new ForestError('invalid', '导入来源无效');
  const id = text(a.id, '导入指纹', 64);
  if (!/^[a-f0-9]{64}$/.test(id)) throw new ForestError('invalid', '导入指纹无效');
  object(a.raw, '原始业务材料');
  const raw = json(a.raw) as JsonObject;
  if (fingerprint(raw) !== id) throw new ForestError('invalid', '导入存档指纹不匹配');
  return { id, source: a.source, importedAt: date(a.importedAt, '导入时间'), entityCount: revision(a.entityCount), raw };
}
export function validateState(value: unknown): ForestState {
  const s = object(value, '数据库');
  if (s.schemaVersion !== 1) throw new ForestError('invalid', '不支持此数据版本；保留原数据，不自动重置');
  if (!Array.isArray(s.entities) || s.entities.length > MAX_ENTITIES || !Array.isArray(s.imports) || s.imports.length > MAX_ENTITIES) throw new ForestError('invalid', '数据库结构无效');
  const entities = s.entities.map(validateEntity);
  validateReferences(entities);
  const imports = s.imports.map(archive);
  if (new Set(imports.map(a => a.id)).size !== imports.length) throw new ForestError('invalid', '重复的导入存档');
  return { schemaVersion: 1, revision: revision(s.revision), entities, imports };
}

export function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k]!)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function fingerprint(value: Json): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
export interface PreparedImport {
  fingerprint: string;
  source: 'legacy' | 'forest-v1';
  entities: ForestEntity[];
  raw: JsonObject;
  archives: ImportArchive[];
  warnings: string[];
}

const collections: { kind: EntityKind; aliases: string[] }[] = [
  { kind: 'project', aliases: ['projects'] },
  { kind: 'record', aliases: ['records', 'experiment_records'] },
  { kind: 'note', aliases: ['notes', 'experiment_notes'] },
  { kind: 'sop', aliases: ['sops'] },
  { kind: 'sample', aliases: ['samples'] },
  { kind: 'plan', aliases: ['plans', 'experiment_plans'] },
];
const legacyId = (kind: EntityKind, id: string) => `legacy-${kind}-${fingerprint(id).slice(0, 24)}`;
function parseArray(value: unknown, key: string): unknown[] {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { throw new ForestError('invalid', `${key} 不是有效 JSON`); }
  }
  if (!Array.isArray(parsed)) throw new ForestError('invalid', `${key} 必须是数组`);
  if (parsed.length > MAX_ENTITIES) throw new ForestError('invalid', `${key} 记录过多`);
  return parsed;
}

export function prepareImport(input: unknown): PreparedImport {
  const original = typeof input === 'string' ? (() => {
    if (Buffer.byteLength(input) > MAX_BACKUP_BYTES) throw new ForestError('invalid', '备份不能超过 20 MiB');
    try { return JSON.parse(input) as unknown; } catch { throw new ForestError('invalid', '备份不是有效 JSON'); }
  })() : input;
  const source = object(original, '备份');
  // The transport is JSON; this also rejects non-finite values, cycles and custom prototypes.
  const cleaned = json(source, true) as JsonObject;
  if (Buffer.byteLength(JSON.stringify(cleaned)) > MAX_BACKUP_BYTES) throw new ForestError('invalid', '备份不能超过 20 MiB');
  const warnings: string[] = [];
  const raw: JsonObject = {};
  if (source.format === 'experiment-forest' || source.schemaVersion !== undefined || source.entities !== undefined) {
    if (source.format !== 'experiment-forest' || source.schemaVersion !== 1) throw new ForestError('invalid', '不支持的备份格式或版本');
    if (!Array.isArray(cleaned.entities) || cleaned.entities.length > MAX_ENTITIES) throw new ForestError('invalid', '备份记录列表无效');
    const entities = cleaned.entities.map(validateEntity);
    validateReferences(entities);
    // Keep the business source exactly as imported (after credential redaction),
    // including unknown future fields, while the active index uses the v1 model.
    raw.entities = cleaned.entities;
    const archives = Array.isArray(cleaned.imports) ? cleaned.imports.map(archive) : [];
    return { fingerprint: fingerprint(raw), source: 'forest-v1', entities, raw, archives, warnings };
  }
  let recognized = false;
  const imported: { kind: EntityKind; row: JsonObject }[] = [];
  for (const collection of collections) {
    const present = collection.aliases.filter(key => cleaned[key] !== undefined);
    if (present.length > 1) throw new ForestError('invalid', `同时提供了 ${present.join(' 和 ')}，请只保留一份集合`);
    const key = present[0];
    if (!key) continue;
    recognized = true;
    const rows = parseArray(cleaned[key], key).map(row => jsonObject(row, true));
    raw[key] = rows;
    imported.push(...rows.map(row => ({ kind: collection.kind, row })));
  }
  const preservedKeys = Object.keys(cleaned).filter(key => ['sample_history', 'todoItems', 'scheduleEvents', 'calendarEvents', 'dailyMood'].includes(key) || /^dailyMood_\d{4}-\d{2}-\d{2}$/.test(key));
  for (const key of preservedKeys) {
    recognized = true;
    let value = cleaned[key];
    if (typeof value === 'string') {
      try { value = json(JSON.parse(value), true); } catch { /* Preserve an unparseable raw string without altering it. */ }
    }
    raw[key] = value!;
  }
  if (preservedKeys.length) warnings.push(`旧版 ${preservedKeys.join('、')} 已保留原文，尚未映射为新功能。`);
  if (!recognized) throw new ForestError('invalid', '未找到实验小森林业务数据集合');
  if (imported.length > MAX_ENTITIES) throw new ForestError('invalid', '导入记录总数超过上限');
  const ignored = Object.keys(source).filter(key => !collections.some(c => c.aliases.includes(key)) && key !== 'exportDate' && !preservedKeys.includes(key));
  if (ignored.length) warnings.push('已忽略非业务字段（包括账户设置、凭据和聊天记录）。');
  warnings.push('原始业务字段保存在记录扩展数据和导入存档中；旧 ID 已稳定映射。');
  const knownProjects = new Set(imported.filter(x => x.kind === 'project').map(x => String(x.row.id)));
  const knownIds = new Map(ENTITY_KINDS.map(kind => [kind, new Set(imported.filter(x => x.kind === kind).map(x => String(x.row.id)))]));
  const missingProjects = new Set<string>();
  const entities = imported.map(({ kind, row }) => {
    const oldId = text(row.id, '旧记录 ID', 256);
    const title = row.title ?? row.name;
    const content = row.content ?? row.description ?? row.notes ?? '';
    if (kind === 'record' && (row.qualityControl !== undefined || row.dataValidation !== undefined)) {
      warnings.push('旧版可能自动填写重复次数、随机化或已验证标记，请核对原始实验记录；迁移不代表复核。');
    }
    let status = row.status ?? (kind === 'sop' ? row.approvalStatus : undefined) ?? DEFAULT_STATUS[kind];
    if (typeof status !== 'string' || !STATUSES[kind].includes(status)) {
      warnings.push(`“${String(title)}”的旧状态已保留在扩展数据中，当前状态设为 ${DEFAULT_STATUS[kind]}。`);
      status = DEFAULT_STATUS[kind];
    }
    // Missing historical timestamps are represented deterministically and disclosed.
    const createdAt = row.createdAt ?? row.lastUpdated ?? row.updatedAt ?? '1970-01-01T00:00:00.000Z';
    const updatedAt = row.updatedAt ?? row.lastUpdated ?? createdAt;
    if (createdAt === '1970-01-01T00:00:00.000Z') warnings.push(`“${String(title)}”缺少历史创建时间，使用未知时间标记（1970-01-01）。`);
    const oldProject = typeof row.projectId === 'string' && row.projectId ? row.projectId : undefined;
    if (oldProject && !knownProjects.has(oldProject)) missingProjects.add(oldProject);
    const data = structuredClone(row);
    const originalRelations: JsonObject = {};
    const unresolvedRelations: JsonObject = {};
    for (const spec of relationSpecs(kind)) {
      const value = row[spec.field];
      if (value === undefined || value === null || value === '') continue;
      originalRelations[spec.field] = value;
      const resolves = (id: Json): id is string => typeof id === 'string' && knownIds.get(spec.targetKind)!.has(id);
      if (spec.many) {
        const candidates = Array.isArray(value) ? value : [value];
        const resolved = candidates.filter(resolves);
        const unresolved = candidates.filter(id => !resolves(id));
        data[spec.field] = [...new Set(resolved.map(id => legacyId(spec.targetKind, id)))];
        if (unresolved.length) unresolvedRelations[spec.field] = unresolved;
      } else if (resolves(value)) data[spec.field] = legacyId(spec.targetKind, value);
      else { delete data[spec.field]; unresolvedRelations[spec.field] = value; }
    }
    if (Object.keys(originalRelations).length) {
      // Keep any pre-existing migration metadata in the raw archive; use an explicit
      // previous value here too rather than silently overwriting an unknown field.
      data.legacyRelations = { ...(row.legacyRelations === undefined ? {} : { previous: row.legacyRelations }), ...originalRelations };
    }
    if (Object.keys(unresolvedRelations).length) {
      data.unresolvedLegacyRelations = { ...(row.unresolvedLegacyRelations === undefined ? {} : { previous: row.unresolvedLegacyRelations }), ...unresolvedRelations };
      warnings.push(`“${String(title)}”的 ${Object.keys(unresolvedRelations).join('、')} 存在未找到或无效的旧关联，正式关系仅保留有效对象；原值保存在 legacyRelations / unresolvedLegacyRelations 和导入档案中。`);
    }
    const e = {
      id: legacyId(kind, oldId), kind, title, content, status,
      ...(kind !== 'project' && oldProject && knownProjects.has(oldProject) ? { projectId: legacyId('project', oldProject) } : {}),
      tags: row.tags ?? [], data, revision: 1, createdAt, updatedAt,
    };
    return validateEntity(e);
  });
  if (missingProjects.size) warnings.push(`${missingProjects.size} 个关联课题未包含在备份中，记录暂不关联；原课题 ID 仍保留在扩展数据中。`);
  validateReferences(entities);
  return { fingerprint: fingerprint(raw), source: 'legacy', entities, raw, archives: [], warnings: [...new Set(warnings)] };
}
