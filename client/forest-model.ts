import type { EntityKind, ForestEntity, Json, JsonObject } from '../shared/model';

/* ───────────────────────── 限制（服务端已核验） ───────────────────────── */

export const LIMITS = {
  title: 300,
  tags: 30,
  tagLength: 80,
  content: 1048576,
} as const;

/* ───────────────────────── 类型与状态 ───────────────────────── */

/** 视觉语气：决定状态点的形状与颜色，不代表任何业务含义之外的判断。 */
export type Tone = 'draft' | 'growing' | 'done' | 'paused' | 'warn' | 'danger' | 'muted';

export interface StatusOption {
  value: string;
  label: string;
  tone: Tone;
}

export const STATUS: Record<EntityKind, StatusOption[]> = {
  project: [
    { value: 'planning', label: '规划中', tone: 'draft' },
    { value: 'active', label: '进行中', tone: 'growing' },
    { value: 'paused', label: '已暂停', tone: 'paused' },
    { value: 'completed', label: '已完成', tone: 'done' },
    { value: 'archived', label: '已归档', tone: 'muted' },
  ],
  record: [
    { value: 'draft', label: '草稿', tone: 'draft' },
    { value: 'completed', label: '已完成', tone: 'done' },
    { value: 'archived', label: '已归档', tone: 'muted' },
  ],
  note: [
    { value: 'active', label: '有效', tone: 'growing' },
    { value: 'draft', label: '草稿', tone: 'draft' },
    { value: 'archived', label: '已归档', tone: 'muted' },
  ],
  sop: [
    { value: 'draft', label: '草稿', tone: 'draft' },
    { value: 'pending', label: '待审', tone: 'warn' },
    { value: 'approved', label: '已批准', tone: 'done' },
    { value: 'rejected', label: '已驳回', tone: 'danger' },
    { value: 'archived', label: '已归档', tone: 'muted' },
  ],
  sample: [
    { value: 'available', label: '可用', tone: 'growing' },
    { value: 'in_use', label: '使用中', tone: 'paused' },
    { value: 'reserved', label: '已预留', tone: 'warn' },
    { value: 'exhausted', label: '已用完', tone: 'muted' },
    { value: 'expired', label: '已过期', tone: 'danger' },
    { value: 'contaminated', label: '已污染', tone: 'danger' },
    { value: 'archived', label: '已归档', tone: 'muted' },
  ],
  plan: [
    { value: 'scheduled', label: '已排期', tone: 'draft' },
    { value: 'in-progress', label: '进行中', tone: 'growing' },
    { value: 'postponed', label: '已推迟', tone: 'warn' },
    { value: 'completed', label: '已完成', tone: 'done' },
    { value: 'cancelled', label: '已取消', tone: 'muted' },
    { value: 'archived', label: '已归档', tone: 'muted' },
  ],
};

export const DEFAULT_STATUS: Record<EntityKind, string> = {
  project: 'active',
  record: 'draft',
  note: 'active',
  sop: 'draft',
  sample: 'available',
  plan: 'scheduled',
};

export function statusOption(kind: EntityKind, value: string): StatusOption {
  return (
    STATUS[kind].find((s) => s.value === value) ?? {
      // 未知状态如实显示原值，不猜测含义
      value,
      label: value || '未设置',
      tone: 'muted',
    }
  );
}

export interface KindMeta {
  label: string;
  /** 新建按钮上的短名 */
  short: string;
  /** 主日期字段（data 中的键）；没有则为 null */
  dateKey: string | null;
  dateLabel: string | null;
}

export const KIND: Record<EntityKind, KindMeta> = {
  project: { label: '课题', short: '课题', dateKey: 'startDate', dateLabel: '开始日期' },
  record: { label: '实验记录', short: '记录', dateKey: 'date', dateLabel: '实验日期' },
  plan: { label: '实验计划', short: '计划', dateKey: 'plannedDate', dateLabel: '计划日期' },
  sop: { label: 'SOP', short: 'SOP', dateKey: null, dateLabel: null },
  sample: { label: '样本', short: '样本', dateKey: null, dateLabel: null },
  note: { label: '笔记', short: '笔记', dateKey: null, dateLabel: null },
};

/** 课题下可挂载的条目类型（展示顺序 = 日常使用频率） */
export const CHILD_KINDS: EntityKind[] = ['record', 'plan', 'sop', 'sample', 'note'];

/* ───────────────────────── 专业字段（data 内） ───────────────────────── */

export type FieldType = 'date' | 'text' | 'ref' | 'refs';

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  /** ref/refs 指向的类型 */
  refKind?: EntityKind;
  placeholder?: string;
  hint?: string;
  /** 读取时的兼容路径（旧数据），写入时始终写 key */
  legacy?: string[][];
}

export const FIELDS: Record<EntityKind, FieldSpec[]> = {
  project: [
    { key: 'startDate', label: '开始日期', type: 'date' },
    { key: 'endDate', label: '结束日期', type: 'date' },
  ],
  record: [
    { key: 'date', label: '实验日期', type: 'date' },
    { key: 'sopId', label: '依据的 SOP', type: 'ref', refKind: 'sop', hint: '记录按哪份 SOP 执行（可不选）' },
    { key: 'relatedSamples', label: '使用的样本', type: 'refs', refKind: 'sample' },
  ],
  plan: [
    { key: 'plannedDate', label: '计划日期', type: 'date' },
    { key: 'relatedRecordId', label: '执行后的记录', type: 'ref', refKind: 'record', hint: '计划完成后，关联到实际的实验记录' },
  ],
  sop: [{ key: 'version', label: '版本号', type: 'text', placeholder: '例如 1.0' }],
  sample: [
    { key: 'sampleId', label: '样本编号', type: 'text', placeholder: '实验室内部编号', legacy: [['sampleCode'], ['code']] },
    { key: 'location', label: '存放位置', type: 'text', placeholder: '例如 -80℃ 冰箱 2 / 架 3 / 盒 B', legacy: [['storage', 'location']] },
  ],
  note: [{ key: 'relatedRecordId', label: '关联的实验记录', type: 'ref', refKind: 'record' }],
};

/** 已由界面“认识”的 data 键：其余键原样保留并在详情中只读展示 */
export function knownKeys(kind: EntityKind): Set<string> {
  const keys = new Set<string>(['provenance']);
  for (const f of FIELDS[kind]) keys.add(f.key);
  return keys;
}

function readPath(data: JsonObject, path: string[]): Json | undefined {
  let cur: Json | undefined = data;
  for (const p of path) {
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) cur = (cur as JsonObject)[p];
    else return undefined;
  }
  return cur;
}

export function fieldString(data: JsonObject, spec: FieldSpec): string {
  const direct = data[spec.key];
  if (typeof direct === 'string') return direct;
  if (typeof direct === 'number') return String(direct);
  if (direct === undefined) {
    for (const path of spec.legacy ?? []) {
      const v = readPath(data, path);
      if (typeof v === 'string' && v.trim()) return v;
      if (typeof v === 'number') return String(v);
    }
  }
  return '';
}

export function fieldList(data: JsonObject, key: string): string[] {
  const v = data[key];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string' && v) return [v];
  return [];
}

export function str(data: JsonObject, key: string): string {
  const v = data[key];
  return typeof v === 'string' ? v : '';
}

/* ───────────────────────── AI 来源 ───────────────────────── */

/**
 * 已由 Codex 核验的 forest_create_draft 实际写入：
 *   data.provenance = { source: 'deepseek-harness', reviewStatus: 'unreviewed', ...可能的其它字段 }
 * 用户明确确认核对后写 reviewStatus: 'reviewed'，其余字段（含 source）一律原样保留。
 */
export const HOST_AI_SOURCE = 'deepseek-harness';
export const REVIEW_UNREVIEWED = 'unreviewed';
export const REVIEW_REVIEWED = 'reviewed';

export interface Provenance {
  /** 由 DeepSeek Harness 宿主 AI 工具生成 */
  isAi: boolean;
  /** 宿主 AI 生成且尚未被人工确认核对 */
  needsReview: boolean;
  source: string | null;
  reviewStatus: string | null;
  raw: JsonObject | null;
}

export function provenanceOf(e: ForestEntity): Provenance {
  const p = e.data.provenance;
  if (!p || typeof p !== 'object' || Array.isArray(p)) {
    return { isAi: false, needsReview: false, source: null, reviewStatus: null, raw: null };
  }
  const raw = p as JsonObject;
  const source = typeof raw.source === 'string' ? raw.source : null;
  const reviewStatus = typeof raw.reviewStatus === 'string' ? raw.reviewStatus : null;
  const isAi = source === HOST_AI_SOURCE;
  // 'unreviewed' 是待核对；缺失或未知的审阅状态也按“未核对”保守处理，只有明确的 'reviewed' 才算核对过
  const needsReview = isAi && reviewStatus !== REVIEW_REVIEWED;
  return { isAi, needsReview, source, reviewStatus, raw };
}

/** 生成“已人工核对”的 provenance：只改 reviewStatus，保留 source 与所有其它字段 */
export function reviewedProvenance(raw: JsonObject): JsonObject {
  return { ...raw, reviewStatus: REVIEW_REVIEWED };
}

export function provenanceSourceLabel(source: string | null): string {
  if (source === HOST_AI_SOURCE) return 'DeepSeek Harness 会话中的 AI 工具';
  return source ?? '未注明';
}

export function reviewStatusLabel(status: string | null): string {
  if (status === REVIEW_UNREVIEWED) return '待人工核对';
  if (status === REVIEW_REVIEWED) return '已人工核对';
  if (status === null) return '未注明（按待核对处理）';
  return `${status}（按待核对处理）`;
}

/**
 * 宿主工具 forest_create_draft 实际只支持这三种 kind（Codex 已核验）。
 * 课题、计划、样本只能由用户在本界面手动新建；所有复制给宿主的指令都必须遵守。
 */
export const DRAFT_TOOL_KINDS = ['record', 'note', 'sop'] as const;
export type DraftToolKind = (typeof DRAFT_TOOL_KINDS)[number];

/** AI 草稿待核对时，不允许直接选择这些“代表已确认事实”的状态。 */
export function lockedStatusesForReview(kind: EntityKind): string[] {
  if (kind === 'sop') return ['approved'];
  if (kind === 'record' || kind === 'plan') return ['completed'];
  return [];
}

/* ───────────────────────── 日期 ───────────────────────── */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateString(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 本地日历日（不使用 toISOString，避免 UTC+8 凌晨跨日错误） */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localDateOfIso(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : localDate(d);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso || '—';
  return `${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function relativeTime(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const diff = Math.round((now - t) / 1000);
  if (diff < 45) return '刚刚';
  if (diff < 3600) return `${Math.round(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.round(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.round(diff / 86400)} 天前`;
  return localDateOfIso(iso);
}

/** 条目在时间线上的日期：优先专业日期字段，否则回退到创建日期，并告知来源。 */
export function timelineDate(e: ForestEntity): { date: string; fromField: boolean } {
  const key = KIND[e.kind].dateKey;
  if (key) {
    const v = str(e.data, key);
    if (isDateString(v)) return { date: v, fromField: true };
  }
  return { date: localDateOfIso(e.createdAt), fromField: false };
}

/* ───────────────────────── 错误分类 ───────────────────────── */

export type ErrorKind = 'conflict' | 'validation' | 'notfound' | 'network' | 'unknown';

export interface ClassifiedError {
  kind: ErrorKind;
  message: string;
}

/**
 * shared/model.ts 未约定错误结构，这里按常见字段与消息做保守判定。
 * 判定不出时归为 unknown —— 对 create/update 而言 unknown 与 network 一样按“结果不确定”处理。
 */
export function classifyError(err: unknown): ClassifiedError {
  const anyErr = err as { code?: unknown; status?: unknown; name?: unknown; message?: unknown } | null;
  const message =
    (anyErr && typeof anyErr.message === 'string' && anyErr.message) ||
    (typeof err === 'string' ? err : '') ||
    '未知错误';
  const code = anyErr && (typeof anyErr.code === 'string' || typeof anyErr.code === 'number') ? String(anyErr.code) : '';
  const status = anyErr && typeof anyErr.status === 'number' ? anyErr.status : 0;
  const hay = `${code} ${message}`.toLowerCase();

  // host-api 已把领域错误 details.code 映射为 err.code：有 code 时优先按 code 判定，不让消息文本误导
  if (code) {
    const c = code.toLowerCase();
    if (/conflict|revision|stale|precondition/.test(c) || c === '409') return { kind: 'conflict', message };
    if (/not[_-]?found/.test(c) || c === '404') return { kind: 'notfound', message };
    if (/invalid|validation|too[_-]?(long|large|many)|limit|exceed|archived|required|bad[_-]?request/.test(c) || c === '400' || c === '422')
      return { kind: 'validation', message };
  }

  if (status === 409 || /conflict|revision|stale|冲突|修订/.test(hay)) return { kind: 'conflict', message };
  if (status === 404 || /not[ _-]?found|不存在|未找到/.test(hay)) return { kind: 'notfound', message };
  if (status === 400 || status === 422 || /invalid|validation|too long|exceed|must|required|不能|超过|无效|archived project/.test(hay))
    return { kind: 'validation', message };
  if ((anyErr && anyErr.name === 'TypeError') || /network|fetch|timeout|timed out|transport|disconnect|abort|网络|超时/.test(hay))
    return { kind: 'network', message };
  return { kind: 'unknown', message };
}

/* ───────────────────────── 搜索与引用 ───────────────────────── */

function collectStrings(v: Json, out: string[], depth = 0): void {
  if (depth > 6 || v === null) return;
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'number') out.push(String(v));
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out, depth + 1));
  else if (typeof v === 'object') Object.values(v).forEach((x) => collectStrings(x, out, depth + 1));
}

export function matchesQuery(e: ForestEntity, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const parts: string[] = [e.title, e.content, e.id, ...e.tags];
  collectStrings(e.data, parts);
  return needle
    .split(/\s+/)
    .every((token) => parts.some((p) => p.toLowerCase().indexOf(token) !== -1));
}

/** data 中出现的、恰好等于某个现有条目 ID 的字符串 = 显式引用 */
export function referencedIds(e: ForestEntity, known: Map<string, ForestEntity>): string[] {
  const all: string[] = [];
  collectStrings(e.data, all);
  const seen = new Set<string>();
  for (const s of all) if (s !== e.id && known.has(s)) seen.add(s);
  return Array.from(seen);
}

export function snippet(text: string, q: string, radius = 36): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const token = q.trim().toLowerCase().split(/\s+/)[0] ?? '';
  if (!token) return flat.slice(0, radius * 2);
  const i = flat.toLowerCase().indexOf(token);
  if (i === -1) return flat.slice(0, radius * 2);
  const start = Math.max(0, i - radius);
  return `${start > 0 ? '…' : ''}${flat.slice(start, i + token.length + radius)}${i + token.length + radius < flat.length ? '…' : ''}`;
}

export function byUpdatedDesc(a: ForestEntity, b: ForestEntity): number {
  return b.updatedAt < a.updatedAt ? -1 : b.updatedAt > a.updatedAt ? 1 : 0;
}

export function isArchived(e: ForestEntity): boolean {
  return e.status === 'archived';
}

export function shortId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 4)}…${id.slice(-4)}` : id;
}

/** 便于展示未知 data 字段的纯文本 */
export function jsonText(v: Json): string {
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export function cloneData(data: JsonObject): JsonObject {
  return JSON.parse(JSON.stringify(data)) as JsonObject;
}
