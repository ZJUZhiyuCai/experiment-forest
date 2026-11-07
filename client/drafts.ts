import type { EntityKind, EntityPatch, ForestEntity, Json, JsonObject } from '../shared/model';
import {
  DEFAULT_STATUS,
  FIELDS,
  KIND,
  LIMITS,
  cloneData,
  fieldList,
  fieldString,
  isDateString,
  localDate,
  lockedStatusesForReview,
  provenanceOf,
  reviewedProvenance,
  statusOption,
} from './forest-model';

export type DraftPhase = 'editing' | 'saving' | 'conflict' | 'uncertain' | 'error';

export interface Draft {
  key: string;
  mode: 'create' | 'edit';
  kind: EntityKind;
  id?: string;
  /** 编辑的基线（冲突后可“以最新为基准”替换）；新建时为 null */
  base: ForestEntity | null;
  title: string;
  content: string;
  status: string;
  projectId: string;
  tags: string[];
  fields: Record<string, string>;
  refs: Record<string, string[]>;
  /** 打开编辑器时展示的初值：未改动的字段不写回 data，避免把兼容读取的旧字段复制一份 */
  initialFields: Record<string, string>;
  initialRefs: Record<string, string[]>;
  phase: DraftPhase;
  message?: string;
  /** 冲突时载入的服务端最新版本 */
  latest?: ForestEntity | null;
  /** 结果不确定时：是否已刷新核对；核对出的疑似已保存条目 */
  checked?: boolean;
  suspects?: string[];
  /** suspects 中与草稿完整值（正文全文 + data 语义值）一致的条目 */
  exactMatches?: string[];
  attemptedAt?: string;
  /** 以最新修订为基准后提示用户复核 */
  rebasedFrom?: number;
  /**
   * 用户在编辑器中明确勾选“保存时记录为已人工核对”。
   * 只对基线是待核对的宿主 AI 草稿生效；保存时把 provenance.reviewStatus 写为 'reviewed'（保留 source 等字段）。
   */
  markReviewed?: boolean;
}

/** 基线是否为待人工核对的宿主 AI 草稿 */
export function baseNeedsReview(d: Draft): boolean {
  return !!d.base && provenanceOf(d.base).needsReview;
}

/** 当前草稿下被“待核对”锁定的状态（勾选核对后解除） */
export function reviewLockedStatuses(d: Draft): string[] {
  return baseNeedsReview(d) && !d.markReviewed ? lockedStatusesForReview(d.kind) : [];
}

let seq = 0;

export function newDraft(kind: EntityKind, projectId: string | null): Draft {
  seq += 1;
  const fields: Record<string, string> = {};
  const refs: Record<string, string[]> = {};
  for (const f of FIELDS[kind]) {
    if (f.type === 'refs') refs[f.key] = [];
    else fields[f.key] = '';
  }
  // 实验日期默认为本地今天（用户可清空）；其余专业字段一律留空，不预填
  if (kind === 'record') fields.date = localDate();
  return {
    key: `new:${Date.now().toString(36)}:${seq}`,
    mode: 'create',
    kind,
    base: null,
    title: '',
    content: '',
    status: DEFAULT_STATUS[kind],
    projectId: kind === 'project' ? '' : projectId ?? '',
    tags: [],
    fields,
    refs,
    initialFields: { ...fields },
    initialRefs: { ...refs },
    phase: 'editing',
  };
}

export function draftFromEntity(e: ForestEntity): Draft {
  const fields: Record<string, string> = {};
  const refs: Record<string, string[]> = {};
  for (const f of FIELDS[e.kind]) {
    if (f.type === 'refs') refs[f.key] = fieldList(e.data, f.key);
    else fields[f.key] = fieldString(e.data, f);
  }
  return {
    key: e.id,
    mode: 'edit',
    kind: e.kind,
    id: e.id,
    base: e,
    title: e.title,
    content: e.content,
    status: e.status,
    projectId: e.projectId ?? '',
    tags: e.tags.slice(),
    fields,
    refs,
    initialFields: { ...fields },
    initialRefs: Object.fromEntries(Object.entries(refs).map(([k, v]) => [k, v.slice()])),
    phase: 'editing',
  };
}

/** 新建时切换类型：保留通用输入，重置专业字段 */
export function switchKind(d: Draft, kind: EntityKind): Draft {
  const fresh = newDraft(kind, d.projectId || null);
  return {
    ...fresh,
    key: d.key,
    title: d.title,
    content: d.content,
    tags: d.tags,
    projectId: kind === 'project' ? '' : d.projectId,
  };
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

export function isDirty(d: Draft): boolean {
  const b = d.base;
  const baseTitle = b ? b.title : '';
  const baseContent = b ? b.content : '';
  const baseStatus = b ? b.status : DEFAULT_STATUS[d.kind];
  const baseProject = b ? b.projectId ?? '' : d.projectId; // 新建时课题来自上下文，不算改动
  const baseTags = b ? b.tags : [];
  if (d.title !== baseTitle || d.content !== baseContent || d.status !== baseStatus) return true;
  if (b && d.projectId !== baseProject) return true;
  if (!sameList(d.tags, baseTags)) return true;
  for (const k of Object.keys(d.fields)) if ((d.fields[k] ?? '') !== (d.initialFields[k] ?? '')) return true;
  for (const k of Object.keys(d.refs)) if (!sameList(d.refs[k] ?? [], d.initialRefs[k] ?? [])) return true;
  if (d.markReviewed && baseNeedsReview(d)) return true;
  return false;
}

/* ───────────────────────── 校验 ───────────────────────── */

export type DraftErrors = Partial<Record<string, string>>;

export function validate(d: Draft, archivedProjectIds: Set<string>): DraftErrors {
  const errors: DraftErrors = {};
  const title = d.title.trim();
  if (!title) errors.title = '请填写标题';
  else if (title.length > LIMITS.title) errors.title = `标题最多 ${LIMITS.title} 字（当前 ${title.length}）`;
  if (d.content.length > LIMITS.content) errors.content = `正文超过上限 ${LIMITS.content} 字`;
  if (d.tags.length > LIMITS.tags) errors.tags = `最多 ${LIMITS.tags} 个标签`;
  else if (d.tags.some((t) => t.length > LIMITS.tagLength)) errors.tags = `单个标签最多 ${LIMITS.tagLength} 字`;

  for (const f of FIELDS[d.kind]) {
    if (f.type !== 'date') continue;
    const v = (d.fields[f.key] ?? '').trim();
    if (v && !isDateString(v)) errors[f.key] = '日期格式应为 YYYY-MM-DD';
  }
  if (d.kind === 'project') {
    const s = d.fields.startDate ?? '';
    const e = d.fields.endDate ?? '';
    if (s && e && isDateString(s) && isDateString(e) && e < s) errors.endDate = '结束日期早于开始日期';
  }
  if (d.projectId && archivedProjectIds.has(d.projectId)) {
    const keepsOld = d.base && d.base.projectId === d.projectId;
    if (!keepsOld) errors.projectId = '不能关联到已归档的课题';
  }
  const locked = reviewLockedStatuses(d);
  if (locked.indexOf(d.status) !== -1 && d.status !== d.base?.status) {
    errors.status = `这是待人工核对的 AI 草稿：要设为“${statusOption(d.kind, d.status).label}”，请先勾选“保存时记录为已人工核对”`;
  }
  return errors;
}

/* ───────────────────────── 生成请求 ───────────────────────── */

function buildData(d: Draft): { data: JsonObject; changed: boolean } {
  const data: JsonObject = d.base ? cloneData(d.base.data) : {};
  let changed = false;
  for (const f of FIELDS[d.kind]) {
    if (f.type === 'refs') {
      const next = d.refs[f.key] ?? [];
      if (sameList(next, d.initialRefs[f.key] ?? [])) continue;
      changed = true;
      data[f.key] = next.slice() as Json;
    } else {
      const next = (d.fields[f.key] ?? '').trim();
      if (next === (d.initialFields[f.key] ?? '').trim()) continue;
      changed = true;
      if (next) data[f.key] = next;
      // 清空：编辑时写 null（无论服务端 data 是合并还是替换，都能表达“已清空”）；新建时直接不写
      else if (d.base) data[f.key] = null;
      else delete data[f.key];
    }
  }
  // 用户明确勾选了核对：只改 provenance.reviewStatus，source 与其它字段原样保留
  if (d.markReviewed && d.base) {
    const prov = provenanceOf(d.base);
    if (prov.needsReview && prov.raw) {
      data.provenance = reviewedProvenance(prov.raw);
      changed = true;
    }
  }
  return { data, changed };
}

export function createPayload(d: Draft) {
  const { data } = buildData(d);
  // 新建时初值等于空串，但实验日期默认值属于用户可见、可清空的输入，需写入
  if (d.kind === 'record' && (d.fields.date ?? '').trim()) data.date = d.fields.date.trim();
  return {
    kind: d.kind,
    title: d.title.trim(),
    content: d.content,
    status: d.status,
    projectId: d.kind !== 'project' && d.projectId ? d.projectId : undefined,
    tags: d.tags,
    data,
  };
}

export function updatePatch(d: Draft): EntityPatch {
  const b = d.base as ForestEntity;
  const patch: EntityPatch = {};
  const title = d.title.trim();
  if (title !== b.title) patch.title = title;
  if (d.content !== b.content) patch.content = d.content;
  if (d.status !== b.status) patch.status = d.status;
  const baseProject = b.projectId ?? '';
  if (d.kind !== 'project' && d.projectId !== baseProject) patch.projectId = d.projectId ? d.projectId : null;
  if (!sameList(d.tags, b.tags)) patch.tags = d.tags.slice();
  const { data, changed } = buildData(d);
  if (changed) patch.data = data;
  return patch;
}

export function draftHeading(d: Draft): string {
  return d.mode === 'create' ? `新建${KIND[d.kind].label}` : `编辑${KIND[d.kind].label}`;
}

/** 用于冲突对照：把条目与草稿投影到同一组可比字段 */
export interface CompareRow {
  label: string;
  base: string;
  latest: string;
  mine: string;
}

export function compareRows(d: Draft, latest: ForestEntity, projectTitle: (id: string) => string): CompareRow[] {
  const b = d.base as ForestEntity;
  const rows: CompareRow[] = [];
  const push = (label: string, base: string, lat: string, mine: string) => {
    if (base !== lat || mine !== base) rows.push({ label, base, latest: lat, mine });
  };
  push('标题', b.title, latest.title, d.title.trim());
  push('状态', b.status, latest.status, d.status);
  push('课题', projectTitle(b.projectId ?? ''), projectTitle(latest.projectId ?? ''), projectTitle(d.projectId));
  push('标签', b.tags.join('、'), latest.tags.join('、'), d.tags.join('、'));
  for (const f of FIELDS[d.kind]) {
    if (f.type === 'refs') {
      push(f.label, fieldList(b.data, f.key).join('、'), fieldList(latest.data, f.key).join('、'), (d.refs[f.key] ?? []).join('、'));
    } else {
      push(f.label, fieldString(b.data, f), fieldString(latest.data, f), (d.fields[f.key] ?? '').trim());
    }
  }
  const review = (e: ForestEntity) => (provenanceOf(e).isAi ? (provenanceOf(e).needsReview ? '待核对' : '已核对') : '');
  push('AI 审阅', review(b), review(latest), d.markReviewed && baseNeedsReview(d) ? '已核对（保存时记录）' : review(b));
  // 注意：正文这里只是供人阅读的摘要（长度 + 前 60 字），不能作为“是否一致”的依据；一致性判定见 draftMatchesEntity
  const sum = (s: string) => (s ? `${s.length} 字：${s.replace(/\s+/g, ' ').slice(0, 60)}${s.length > 60 ? '…' : ''}` : '（空）');
  const contentRow = (s: string) => (s === b.content ? sum(s) : `${sum(s)}${s.length === b.content.length ? '（与开始时等长但内容不同）' : ''}`);
  if (b.content !== latest.content || d.content !== b.content) {
    rows.push({ label: '正文', base: sum(b.content), latest: contentRow(latest.content), mine: contentRow(d.content) });
  }
  return rows;
}

/* ───────────────────────── 一致性判定（使用真实值，不用展示摘要） ───────────────────────── */

/** JSON 逐值相等：仅忽略对象键顺序；保留键是否存在、null、空数组及字符串空白的区别。 */
export function semanticEqual(a: Json | undefined, b: Json | undefined): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => semanticEqual(x, b[i]));
  }
  if (typeof a === 'object' && typeof b === 'object' && a && b) {
    const ao = a as JsonObject;
    const bo = b as JsonObject;
    const keys = Object.keys(ao);
    if (keys.length !== Object.keys(bo).length) return false;
    for (const k of keys) if (!Object.hasOwn(bo, k) || !semanticEqual(ao[k], bo[k])) return false;
    return true;
  }
  return false;
}

/**
 * 服务端条目是否已经完整体现了这份草稿（用于“保存结果不确定”后的核对）。
 * - 标题、状态、课题、标签：逐值比较
 * - 正文：完整字符串严格相等（不使用摘要）
 * - data：把草稿将要写入的完整 data（基线 data + 用户改动 + 核对标记）与服务端 data 做严格 JSON 比较，
 *   包括未知字段；任何差异都返回 false，交给冲突对照由用户判断，宁可多问一次也不误删草稿。
 */
export function draftMatchesEntity(d: Draft, e: ForestEntity): boolean {
  if (e.kind !== d.kind) return false;
  if (d.title.trim() !== e.title) return false;
  if (d.content !== e.content) return false;
  if (d.status !== e.status) return false;
  if (d.kind !== 'project' && d.projectId !== (e.projectId ?? '')) return false;
  if (!sameList(d.tags, e.tags)) return false;
  const intended = d.mode === 'create' ? createPayload(d).data : buildData(d).data;
  return semanticEqual(intended, e.data);
}

/** 以最新服务端版本为基准，保留用户已改动的部分 */
export function rebase(d: Draft, latest: ForestEntity): Draft {
  const b = d.base as ForestEntity;
  const fromLatest = draftFromEntity(latest);
  const pick = <T,>(mine: T, base: T, lat: T, eq: (x: T, y: T) => boolean): T => (eq(mine, base) ? lat : mine);
  const eqS = (x: string, y: string) => x === y;
  const fields: Record<string, string> = {};
  for (const k of Object.keys(d.fields)) fields[k] = pick(d.fields[k], d.initialFields[k] ?? '', fromLatest.fields[k] ?? '', eqS);
  const refs: Record<string, string[]> = {};
  for (const k of Object.keys(d.refs)) refs[k] = pick(d.refs[k], d.initialRefs[k] ?? [], fromLatest.refs[k] ?? [], sameList);
  return {
    ...fromLatest,
    key: d.key,
    title: pick(d.title, b.title, latest.title, eqS),
    content: pick(d.content, b.content, latest.content, eqS),
    status: pick(d.status, b.status, latest.status, eqS),
    projectId: pick(d.projectId, b.projectId ?? '', latest.projectId ?? '', eqS),
    tags: pick(d.tags, b.tags, latest.tags, sameList),
    fields,
    refs,
    phase: 'editing',
    rebasedFrom: b.revision,
    // 最新版本若仍待核对，保留用户已勾选的核对意图；若已被他人核对，则无需再写
    markReviewed: d.markReviewed && provenanceOf(latest).needsReview ? true : undefined,
  };
}
