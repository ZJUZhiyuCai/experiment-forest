import type { PageBlock, PageBlockInput, PageMaterial, PageReadReceipt, PageSnapshot, PageSource, PageView } from '../shared/page';
import { MAX_MATERIAL_BYTES } from '../shared/page';

/**
 * 实验页纯函数层：不发请求、不碰 DOM。
 * 工作版（title / experimentDate / blocks）是唯一由前端提交的正文；来源、作者、待核、快照、提案状态都由服务器管理，
 * 这里只读取它们用于展示，绝不回写。
 */

/* ───────────────────────── 常量（与 shared/page.ts 的 schema 保持一致） ───────────────────────── */

export const UNTITLED = '未命名实验';
export const PAGE_LIMITS = {
  title: 300,
  blocks: 200,
  text: 100_000,
  heading: 300,
  caption: 10_000,
  note: 10_000,
  cell: 10_000,
  columnLabel: 500,
  columns: 50,
  rows: 500,
  materialBytes: MAX_MATERIAL_BYTES,
} as const;

/** 前端提交的工作版正文 */
export interface Content {
  title: string;
  experimentDate: string | null;
  blocks: PageBlockInput[];
}

export const EMPTY_CONTENT: Content = { title: '', experimentDate: null, blocks: [] };

/* ───────────────────────── 稳定 ID ───────────────────────── */

/** 所有块、行、列、请求 ID 都用 crypto.randomUUID（以十六进制字符开头，符合服务端 ID 规则） */
export function uid(): string {
  return crypto.randomUUID();
}

/* ───────────────────────── 规范化与比较 ───────────────────────── */

/** 标题比较口径：首尾空白不算改动；空标题与“未命名实验”等价 */
export function normTitle(t: string): string {
  const s = t.trim();
  return s === UNTITLED ? '' : s;
}

/** 提交给服务器的标题：title 必须非空 */
export function titleForSave(t: string): string {
  return t.trim() || UNTITLED;
}

/** 稳定 JSON：对象键排序、丢弃 undefined。用于判断两块内容是否相同（服务器返回的键顺序可能不同） */
export function canon(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v) ?? 'null';
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canon(o[k])}`)
    .join(',')}}`;
}

/** 从服务器块中只取输入字段（去掉 version / author / sources / pendingReview / confirmedAt） */
export function blockInput(b: PageBlock | PageBlockInput): PageBlockInput {
  switch (b.type) {
    case 'text':
      return { id: b.id, type: 'text', text: b.text };
    case 'heading':
      return { id: b.id, type: 'heading', text: b.text };
    case 'media':
      return { id: b.id, type: 'media', materialId: b.materialId, caption: b.caption };
    case 'table': {
      const out: Extract<PageBlockInput, { type: 'table' }> = {
        id: b.id,
        type: 'table',
        columns: b.columns.map((c) => ({ id: c.id, label: c.label })),
        rows: b.rows.map((r) => ({ id: r.id, cells: { ...r.cells } })),
      };
      if (b.note !== undefined) out.note = b.note;
      if (b.raw !== undefined) out.raw = b.raw;
      return out;
    }
  }
}

export function sameBlock(a: PageBlockInput | undefined, b: PageBlockInput | undefined): boolean {
  if (!a || !b) return a === b;
  return canon(blockInput(a)) === canon(blockInput(b));
}

export function sameContent(a: Content, b: Content): boolean {
  return (
    normTitle(a.title) === normTitle(b.title) &&
    a.experimentDate === b.experimentDate &&
    a.blocks.length === b.blocks.length &&
    a.blocks.every((x, i) => sameBlock(x, b.blocks[i]))
  );
}

/** Host stores the actual experiment date in data.date; absence means deliberately unset. */
export function readExperimentDate(view: PageView): string | null {
  const d=view.entity.data.date;
  return typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d)?d:null;
}
export function contentOf(view: PageView): Content {
  return {title:normTitle(view.entity.title),experimentDate:readExperimentDate(view),blocks:view.page.blocks.map(blockInput)};
}

export function cloneContent(c: Content): Content {
  return { title: c.title, experimentDate: c.experimentDate, blocks: c.blocks.map(blockInput) };
}

/* ───────────────────────── 三方合并（块粒度） ───────────────────────── */

export interface Clash {
  /** 'title' | 'date' | 块 ID */
  key: string;
  label: string;
  kind: 'both-edited' | 'they-deleted' | 'i-deleted';
}

export interface MergeResult {
  /** 重叠处保留我的 */
  mine: Content;
  /** 重叠处采用对方 */
  theirs: Content;
  clashes: Clash[];
}

/**
 * base：我方工作版所依据的服务器正文；mine：本地工作版；theirs：服务器最新正文。
 * 只改了一边的块直接取那一边；两边都改且不同才算重叠。重叠时产出两种结果，由用户明确选择，不替用户决定。
 */
export function merge3(base: Content, mine: Content, theirs: Content): MergeResult {
  const clashes: Clash[] = [];
  const pick = <T,>(m: T, b: T, t: T, eq: (x: T, y: T) => boolean, key: string, label: string): [T, T] => {
    if (eq(m, t)) return [m, m];
    if (eq(m, b)) return [t, t];
    if (eq(t, b)) return [m, m];
    clashes.push({ key, label, kind: 'both-edited' });
    return [m, t];
  };
  const [titleM, titleT] = pick(mine.title, base.title, theirs.title, (x, y) => normTitle(x) === normTitle(y), 'title', '标题');
  const [dateM, dateT] = pick(mine.experimentDate, base.experimentDate, theirs.experimentDate, (x, y) => x === y, 'date', '实验日期');

  const B = new Map(base.blocks.map((b) => [b.id, b]));
  const M = new Map(mine.blocks.map((b) => [b.id, b]));
  const T = new Map(theirs.blocks.map((b) => [b.id, b]));
  const keepM = new Map<string, PageBlockInput>();
  const keepT = new Map<string, PageBlockInput>();
  const label = (b: PageBlockInput) => `块「${blockLabel(b)}」`;

  for (const id of new Set([...B.keys(), ...M.keys(), ...T.keys()])) {
    const b = B.get(id);
    const m = M.get(id);
    const t = T.get(id);
    const both = (x: PageBlockInput, y: PageBlockInput = x) => {
      keepM.set(id, x);
      keepT.set(id, y);
    };
    if (m && t) {
      if (sameBlock(m, t) || sameBlock(t, b)) both(m); // 对方没改，或两边改成一样
      else if (sameBlock(m, b)) both(t); // 只有对方改了
      else {
        clashes.push({ key: id, label: label(m), kind: 'both-edited' });
        both(m, t);
      }
    } else if (m && !t) {
      if (!b) both(m); // 我新增的
      else if (!sameBlock(m, b)) {
        clashes.push({ key: id, label: label(m), kind: 'they-deleted' });
        keepM.set(id, m);
      } // 对方删除且我没改：跟随删除
    } else if (!m && t) {
      if (!b) both(t); // 对方新增的（素材登记、接受的提案）
      else if (!sameBlock(t, b)) {
        // 我删、对方改：两种结果都保留对方的修改，宁可多留一块也不丢内容
        clashes.push({ key: id, label: label(t), kind: 'i-deleted' });
        both(t);
      }
    }
  }

  // Compare shared surviving IDs so additions/deletions don't masquerade as reorders.
  const common=new Set(base.blocks.filter(b=>M.has(b.id)&&T.has(b.id)).map(b=>b.id));
  const sequence=(blocks:PageBlockInput[])=>blocks.filter(b=>common.has(b.id)).map(b=>b.id).join('|');
  const baseOrder=sequence(base.blocks),mineOrder=sequence(mine.blocks),theirOrder=sequence(theirs.blocks);
  const mineMoved=mineOrder!==baseOrder,theirsMoved=theirOrder!==baseOrder;
  const orderConflict=mineMoved&&theirsMoved&&mineOrder!==theirOrder;
  if(orderConflict)clashes.push({key:'order',label:'块顺序',kind:'both-edited'});
  const order=(keep:Map<string,PageBlockInput>,preferTheirs:boolean):PageBlockInput[]=>{
    const primary=preferTheirs?theirs.blocks:mine.blocks,secondary=preferTheirs?mine.blocks:theirs.blocks;
    const out=primary.filter(b=>keep.has(b.id)).map(b=>keep.get(b.id)!);
    const placed=new Set(out.map(b=>b.id));
    secondary.forEach((block,i)=>{
      if(placed.has(block.id)||!keep.has(block.id))return;
      let at=0;
      for(let j=i-1;j>=0;j--){const k=out.findIndex(b=>b.id===secondary[j]!.id);if(k>=0){at=k+1;break;}}
      out.splice(at,0,keep.get(block.id)!);placed.add(block.id);
    });
    return out;
  };
  const preferTheirs=theirsMoved&&!mineMoved;

  return {
    mine: { title: titleM, experimentDate: dateM, blocks: order(keepM,preferTheirs) },
    theirs: { title: titleT, experimentDate: dateT, blocks: order(keepT,orderConflict||preferTheirs) },
    clashes,
  };
}

/* ───────────────────────── 构造块 ───────────────────────── */

export function newText(text = ''): PageBlockInput {
  return { id: uid(), type: 'text', text };
}
export function newHeading(text = ''): PageBlockInput {
  return { id: uid(), type: 'heading', text };
}
export function newTable(cols = 3, rows = 2): PageBlockInput {
  const columns = Array.from({ length: cols }, (_, i) => ({ id: uid(), label: `列 ${i + 1}` }));
  return {
    id: uid(),
    type: 'table',
    columns,
    rows: Array.from({ length: rows }, () => ({ id: uid(), cells: Object.fromEntries(columns.map((c) => [c.id, ''])) })),
  };
}

/** 粘贴文字是否“看起来像表格”（有制表符且多于一行）；真正的转换规则以 shared/page.ts 的 pastedBlock 为准 */
export function looksTabular(text: string): boolean {
  return text.includes('\t') && /\n./.test(text.replace(/\r\n/g, '\n').replace(/\n$/, ''));
}

/** 文字 ⇄ 标题：只换类型，ID 不变；标题超长时截断前先由调用方提示 */
export function convertBlock(b: PageBlockInput, to: 'text' | 'heading'): PageBlockInput {
  if (b.type !== 'text' && b.type !== 'heading') return b;
  return to === 'text' ? { id: b.id, type: 'text', text: b.text } : { id: b.id, type: 'heading', text: b.text.replace(/\s*\n\s*/g, ' ') };
}

/* ───────────────────────── 表格编辑（全部返回新对象，行列 ID 稳定） ───────────────────────── */

type TableBlock = Extract<PageBlockInput, { type: 'table' }>;

export function setCell(t: TableBlock, rowId: string, colId: string, value: string): TableBlock {
  return { ...t, rows: t.rows.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r)) };
}
export function setColumnLabel(t: TableBlock, colId: string, label: string): TableBlock {
  return { ...t, columns: t.columns.map((c) => (c.id === colId ? { ...c, label } : c)) };
}
export function addRow(t: TableBlock, afterRowId?: string): TableBlock {
  const row = { id: uid(), cells: Object.fromEntries(t.columns.map((c) => [c.id, ''])) };
  const i = afterRowId ? t.rows.findIndex((r) => r.id === afterRowId) : -1;
  const rows = t.rows.slice();
  rows.splice(i === -1 ? rows.length : i + 1, 0, row);
  return { ...t, rows };
}
export function removeRow(t: TableBlock, rowId: string): TableBlock {
  return { ...t, rows: t.rows.filter((r) => r.id !== rowId) };
}
export function addColumn(t: TableBlock): TableBlock {
  const col = { id: uid(), label: `列 ${t.columns.length + 1}` };
  return { ...t, columns: [...t.columns, col], rows: t.rows.map((r) => ({ ...r, cells: { ...r.cells, [col.id]: '' } })) };
}
export function removeColumn(t: TableBlock, colId: string): TableBlock {
  return {
    ...t,
    columns: t.columns.filter((c) => c.id !== colId),
    rows: t.rows.map((r) => {
      const cells = { ...r.cells };
      delete cells[colId];
      return { ...r, cells };
    }),
  };
}
export function moveRow(t: TableBlock, rowId: string, delta: number): TableBlock {
  const i = t.rows.findIndex((r) => r.id === rowId);
  const j = i + delta;
  if (i === -1 || j < 0 || j >= t.rows.length) return t;
  const rows = t.rows.slice();
  const [r] = rows.splice(i, 1);
  rows.splice(j, 0, r);
  return { ...t, rows };
}

/* ───────────────────────── 校验（提交前，与服务端 schema 同口径） ───────────────────────── */

export function validateContent(c: Content): string | null {
  if (titleForSave(c.title).length > PAGE_LIMITS.title) return `标题最多 ${PAGE_LIMITS.title} 字`;
  if (c.blocks.length > PAGE_LIMITS.blocks) return `一页最多 ${PAGE_LIMITS.blocks} 块（当前 ${c.blocks.length}）。可以把内容拆到新的一页。`;
  if (new Set(c.blocks.map((b) => b.id)).size !== c.blocks.length) return '块 ID 重复，请刷新后再试';
  for (const [i, b] of c.blocks.entries()) {
    const n = `第 ${i + 1} 块`;
    if (b.type === 'text' && b.text.length > PAGE_LIMITS.text) return `${n}文字超过 ${PAGE_LIMITS.text} 字，请拆成几块`;
    if (b.type === 'heading' && b.text.length > PAGE_LIMITS.heading) return `${n}标题超过 ${PAGE_LIMITS.heading} 字`;
    if (b.type === 'media' && b.caption.length > PAGE_LIMITS.caption) return `${n}说明超过 ${PAGE_LIMITS.caption} 字`;
    if (b.type === 'table') {
      if (b.columns.length < 1) return `${n}表格至少需要一列`;
      if (b.columns.length > PAGE_LIMITS.columns) return `${n}表格最多 ${PAGE_LIMITS.columns} 列`;
      if (b.rows.length > PAGE_LIMITS.rows) return `${n}表格最多 ${PAGE_LIMITS.rows} 行；更大的表请作为文件放入`;
      if (b.columns.some((col) => col.label.length > PAGE_LIMITS.columnLabel)) return `${n}有列名超过 ${PAGE_LIMITS.columnLabel} 字`;
      if (b.rows.some((r) => Object.values(r.cells).some((v) => v.length > PAGE_LIMITS.cell))) return `${n}有单元格超过 ${PAGE_LIMITS.cell} 字`;
      if ((b.note ?? '').length > PAGE_LIMITS.note) return `${n}表注超过 ${PAGE_LIMITS.note} 字`;
      if ((b.raw ?? '').length > PAGE_LIMITS.text) return `${n}原始粘贴超过 ${PAGE_LIMITS.text} 字`;
    }
  }
  return null;
}

/* ───────────────────────── 展示文案 ───────────────────────── */

export function blockLabel(b: PageBlockInput, materials?: PageMaterial[]): string {
  const cut = (s: string) => {
    const f = s.replace(/\s+/g, ' ').trim();
    return f ? (f.length > 18 ? `${f.slice(0, 18)}…` : f) : '空';
  };
  switch (b.type) {
    case 'text':
      return cut(b.text);
    case 'heading':
      return cut(b.text);
    case 'table':
      return `表格 ${b.columns.length}×${b.rows.length}`;
    case 'media': {
      const m = materials?.find((x) => x.id === b.materialId);
      return m ? m.name : '素材';
    }
  }
}

export const BLOCK_TYPE_LABEL: Record<PageBlockInput['type'], string> = { text: '文字', heading: '标题', table: '表格', media: '素材' };

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function hhmm(iso: string | number | Date): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function mdhm(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, '0')} ${hhmm(d)}`;
}

/**
 * 素材如何在页面里呈现。原件一律可下载；只有浏览器能安全渲染的被动格式才内嵌。
 * HTML、SVG、XML 等可能含脚本的格式只下载，不作为活动内容渲染。
 */
export type MediaKind = 'image' | 'video' | 'audio' | 'text' | 'blocked' | 'file';

const INLINE_IMAGE = /^image\/(png|jpe?g|gif|webp|avif|bmp)$/i;
const BLOCKED = /(html|svg|xml|javascript|ecmascript|x-sh|xhtml)/i;

export function mediaKind(mime: string, name: string): MediaKind {
  const m = (mime || '').toLowerCase();
  if (BLOCKED.test(m) || /\.(html?|svg|xhtml|xml|js|mjs)$/i.test(name)) return 'blocked';
  if (INLINE_IMAGE.test(m)) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m === 'text/plain' || m === 'text/csv' || m === 'text/tab-separated-values' || m === 'text/markdown' || /\.(txt|csv|tsv|md|log)$/i.test(name))
    return 'text';
  return 'file';
}

export const MEDIA_KIND_LABEL: Record<MediaKind, string> = {
  image: '图片',
  video: '视频',
  audio: '音频',
  text: '文本',
  blocked: '网页/矢量文件',
  file: '文件',
};

export const RECEIPT_MODE_LABEL: Record<PageReadReceipt['materials'][number]['mode'], string> = {
  'metadata-only': '只交了文件信息，未交内容',
  text: '交了文本内容',
  'preview-image': '交了预览图（不是原件）',
};

export const OP_KIND_LABEL: Record<'layout' | 'extract' | 'infer', string> = { layout: '排版', extract: '摘录', infer: '推断' };

/** 依据标签：快照显示“块 v版本 · 时间”，素材显示文件名 */
export function sourceLabel(s: PageSource, snapshots: PageSnapshot[], materials: PageMaterial[]): string {
  if (s.materialId) {
    const m = materials.find((x) => x.id === s.materialId);
    const cell = s.rowId || s.columnId ? ' · 指定单元格' : '';
    return `${m ? m.name : '未找到的素材'}${cell}`;
  }
  const snap = snapshots.find((x) => x.id === s.snapshotId);
  if (!snap) return '未找到的快照';
  return `${BLOCK_TYPE_LABEL[snap.block.type]}原样 v${snap.version} · ${mdhm(snap.at)}`;
}

/** 素材是否来自图片（用于提示“图片摘录一律先待核”） */
export function isImageMaterial(m: PageMaterial | undefined): boolean {
  return !!m && /^image\//i.test(m.mime);
}

export function withinUploadLimit(file: File): string | null {
  if (!file.size) return '文件是空的（0 字节），没有上传';
  if (file.size > MAX_MATERIAL_BYTES) return `文件 ${formatBytes(file.size)}，超过单个文件 64 MiB 的上限，没有上传`;
  return null;
}
