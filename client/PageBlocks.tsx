import { forwardRef, memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ClipboardEvent, KeyboardEvent, TextareaHTMLAttributes } from 'react';
import type { ForestApi } from '../shared/model';
import type { PageBlock, PageBlockInput, PageMaterial, PageSnapshot, PageSource } from '../shared/page';
import { pastedBlock } from '../shared/page';
import { Icon } from './icons';
import { MaterialPreview, MissingMaterial } from './MaterialView';
import {
  BLOCK_TYPE_LABEL,
  PAGE_LIMITS,
  addColumn,
  addRow,
  convertBlock,
  looksTabular,
  mdhm,
  moveRow,
  removeColumn,
  removeRow,
  sameBlock,
  setCell,
  setColumnLabel,
  sourceLabel,
  uid,
} from './pageModel';

type TableBlock = Extract<PageBlockInput, { type: 'table' }>;

export interface BlockCtx {
  api: ForestApi;
  pageId: string;
  materials: PageMaterial[];
  snapshots: PageSnapshot[];
  busy: boolean;
  onSource: (s: PageSource) => void;
}

/* ───────────────────────── 自动增高的纯文本输入（不解析 HTML/Markdown） ───────────────────────── */

export const AutoTextarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { value: string; minRows?: number }>(
  function AutoTextarea({ value, minRows = 1, ...rest }, outer) {
    const ref = useRef<HTMLTextAreaElement | null>(null);
    useLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }, [value]);
    return (
      <textarea
        ref={(el) => {
          ref.current = el;
          if (typeof outer === 'function') outer(el);
          else if (outer) outer.current = el;
        }}
        rows={minRows}
        value={value}
        {...rest}
      />
    );
  },
);

/* ───────────────────────── 依据、作者、待核 ───────────────────────── */

export function SourceChips({ sources, ctx }: { sources: PageSource[]; ctx: Pick<BlockCtx, 'snapshots' | 'materials' | 'onSource'> }) {
  if (!sources.length) return null;
  return (
    <span className="fa-srcs">
      <span className="fa-srcs__label">依据</span>
      {sources.map((s, i) => (
        <button
          key={`${s.snapshotId ?? s.materialId}-${i}`}
          type="button"
          className={`fa-src${s.materialId ? ' is-material' : ''}`}
          title={s.quote ? `引用原文：“${s.quote}”` : '跳到原样对照'}
          onClick={() => ctx.onSource(s)}
        >
          <Icon name={s.materialId ? 'file' : 'list'} size={11} />
          <span className="fa-src__text">{sourceLabel(s, ctx.snapshots, ctx.materials)}</span>
          {s.quote && <span className="fa-src__quote">“{s.quote.length > 24 ? `${s.quote.slice(0, 24)}…` : s.quote}”</span>}
        </button>
      ))}
    </span>
  );
}

export function AuthorBadge({ meta }: { meta: PageBlock }) {
  if (meta.author === 'user') return null;
  return (
    <span className="fa-ai-tag" title={meta.author === 'ai' ? '由 AI 提议、你接受的块' : '由 AI 提议、你接受后又改过的块'}>
      <Icon name="spark" size={11} />
      {meta.author === 'ai' ? 'AI 提议' : 'AI 提议 · 你改过'}
    </span>
  );
}

/* ───────────────────────── 只读渲染（原样快照、提案对照） ───────────────────────── */

export function BlockReadOnly({ block, ctx, compactMedia = true }: { block: PageBlockInput; ctx: Pick<BlockCtx, 'api' | 'pageId' | 'materials'>; compactMedia?: boolean }) {
  switch (block.type) {
    case 'heading':
      return <h4 className="fa-ro fa-ro--heading">{block.text || <span className="fa-muted">（空标题）</span>}</h4>;
    case 'text':
      return <p className="fa-ro fa-ro--text">{block.text || <span className="fa-muted">（空）</span>}</p>;
    case 'media': {
      const m = ctx.materials.find((x) => x.id === block.materialId);
      return (
        <div className="fa-ro fa-ro--media">
          {m ? <MaterialPreview api={ctx.api} pageId={ctx.pageId} material={m} compact={compactMedia} /> : <MissingMaterial materialId={block.materialId} />}
          {block.caption && <p className="fa-ro__caption">{block.caption}</p>}
        </div>
      );
    }
    case 'table':
      return (
        <div className="fa-ro fa-ro--table">
          <div className="fa-tbl__scroll">
            <table className="fa-tbl__ro">
              <thead>
                <tr>
                  {block.columns.map((c) => (
                    <th key={c.id}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((r) => (
                  <tr key={r.id}>
                    {block.columns.map((c) => {
                      const v = r.cells[c.id];
                      return (
                        <td key={c.id} className={v === undefined || v === '' ? 'is-empty' : undefined} title={v === '' ? '空白（原样保留）' : undefined}>
                          {v}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.note && <p className="fa-ro__caption">{block.note}</p>}
        </div>
      );
  }
}

/* ───────────────────────── 表格编辑 ───────────────────────── */

function TableEditor({ block, onChange, disabled }: { block: TableBlock; onChange: (b: TableBlock) => void; disabled?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const focusNext = useRef<string | null>(null);
  const [rawOpen, setRawOpen] = useState(false);

  useEffect(() => {
    if (!focusNext.current) return;
    const el = rootRef.current?.querySelector<HTMLTextAreaElement>(`[data-cell="${focusNext.current}"]`);
    focusNext.current = null;
    el?.focus();
  });

  const canAddRow = block.rows.length < PAGE_LIMITS.rows;
  const canAddCol = block.columns.length < PAGE_LIMITS.columns;

  const onCellKey = (e: KeyboardEvent<HTMLTextAreaElement>, rowIndex: number, colId: string) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const next = block.rows[rowIndex + 1];
    if (next) {
      focusNext.current = `${next.id}:${colId}`;
      rootRef.current?.querySelector<HTMLTextAreaElement>(`[data-cell="${focusNext.current}"]`)?.focus();
      focusNext.current = null;
    } else if (canAddRow) {
      const t = addRow(block);
      focusNext.current = `${t.rows[t.rows.length - 1].id}:${colId}`;
      onChange(t);
    }
  };

  return (
    <div className="fa-tbl" ref={rootRef}>
      <div className="fa-tbl__scroll">
        <table>
          <thead>
            <tr>
              <th className="fa-tbl__rowh" aria-label="行号" />
              {block.columns.map((c) => (
                <th key={c.id}>
                  <span className="fa-tbl__colh">
                    <input
                      className="fa-tbl__label"
                      value={c.label}
                      maxLength={PAGE_LIMITS.columnLabel}
                      aria-label="列名"
                      disabled={disabled}
                      onChange={(e) => onChange(setColumnLabel(block, c.id, e.target.value))}
                    />
                    {block.columns.length > 1 && (
                      <button type="button" className="fa-tbl__x" aria-label={`删除列 ${c.label}`} title="删除这一列" disabled={disabled} onClick={() => onChange(removeColumn(block, c.id))}>
                        <Icon name="close" size={11} />
                      </button>
                    )}
                  </span>
                </th>
              ))}
              <th className="fa-tbl__add-col">
                <button type="button" className="fa-icon-btn fa-icon-btn--sm" aria-label="添加一列" title={canAddCol ? '添加一列' : `最多 ${PAGE_LIMITS.columns} 列`} disabled={disabled || !canAddCol} onClick={() => onChange(addColumn(block))}>
                  <Icon name="plus" size={13} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {block.rows.map((r, i) => (
              <tr key={r.id}>
                <td className="fa-tbl__rowh">
                  <span className="fa-tbl__n">{i + 1}</span>
                  <span className="fa-tbl__rowtools">
                    <button type="button" aria-label="上移这一行" disabled={disabled || i === 0} onClick={() => onChange(moveRow(block, r.id, -1))}>
                      <Icon name="up" size={11} />
                    </button>
                    <button type="button" aria-label="下移这一行" disabled={disabled || i === block.rows.length - 1} onClick={() => onChange(moveRow(block, r.id, 1))}>
                      <Icon name="down" size={11} />
                    </button>
                    <button type="button" aria-label="在下方插入一行" disabled={disabled || !canAddRow} onClick={() => onChange(addRow(block, r.id))}>
                      <Icon name="plus" size={11} />
                    </button>
                    <button type="button" aria-label="删除这一行" disabled={disabled} onClick={() => onChange(removeRow(block, r.id))}>
                      <Icon name="trash" size={11} />
                    </button>
                  </span>
                </td>
                {block.columns.map((c) => {
                  const v = r.cells[c.id] ?? '';
                  return (
                    <td key={c.id} className={v === '' ? 'is-empty' : undefined}>
                      <AutoTextarea
                        className="fa-tbl__cell"
                        data-cell={`${r.id}:${c.id}`}
                        value={v}
                        maxLength={PAGE_LIMITS.cell}
                        aria-label={`${c.label} 第 ${i + 1} 行`}
                        disabled={disabled}
                        onChange={(e) => onChange(setCell(block, r.id, c.id, e.target.value))}
                        onKeyDown={(e) => onCellKey(e, i, c.id)}
                      />
                    </td>
                  );
                })}
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="fa-tbl__foot">
        <button type="button" className="fa-btn fa-btn--ghost fa-btn--sm" disabled={disabled || !canAddRow} onClick={() => onChange(addRow(block))}>
          <Icon name="plus" size={13} />
          添加一行
        </button>
        <span className="fa-help">
          {block.columns.length} 列 × {block.rows.length} 行 · 空白、0、ND、— 都按原样保存
        </span>
        {block.raw !== undefined && (
          <button type="button" className="fa-link fa-tbl__rawbtn" aria-expanded={rawOpen} onClick={() => setRawOpen((v) => !v)}>
            {rawOpen ? '收起原始粘贴' : '查看原始粘贴'}
          </button>
        )}
      </div>
      {rawOpen && block.raw !== undefined && (
        <div className="fa-tbl__raw">
          <p className="fa-help">由制表符文本按规则转成表格，没有经过模型。下面是粘贴时的原文，表格之后怎么改，这份原文都不变。</p>
          <pre>{block.raw}</pre>
        </div>
      )}
      <AutoTextarea
        className="fa-tbl__note"
        value={block.note ?? ''}
        placeholder="表注（可选）：单位、样品说明、缺失值的含义…"
        maxLength={PAGE_LIMITS.note}
        disabled={disabled}
        onChange={(e) => {
          const note = e.target.value;
          const next: TableBlock = { ...block };
          if (note) next.note = note;
          else delete next.note;
          onChange(next);
        }}
      />
    </div>
  );
}

/* ───────────────────────── 单块字段（页面与提案预览共用） ───────────────────────── */

export function BlockFields({
  block,
  ctx,
  onChange,
  disabled,
  fieldRef,
  onKeyDown,
  onPaste,
}: {
  block: PageBlockInput;
  ctx: Pick<BlockCtx, 'api' | 'pageId' | 'materials'>;
  onChange: (b: PageBlockInput) => void;
  disabled?: boolean;
  fieldRef?: (el: HTMLElement | null) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  onPaste?: (e: ClipboardEvent<HTMLTextAreaElement>) => void;
}) {
  switch (block.type) {
    case 'heading':
      return (
        <input
          ref={fieldRef}
          className="fa-blk__heading"
          value={block.text}
          maxLength={PAGE_LIMITS.heading}
          placeholder="小节标题"
          aria-label="小节标题"
          disabled={disabled}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          onKeyDown={onKeyDown}
        />
      );
    case 'text':
      return (
        <AutoTextarea
          className="fa-blk__text"
          value={block.text}
          maxLength={PAGE_LIMITS.text}
          placeholder="写点什么…  “# ”变标题，粘贴制表符文本自动成表"
          aria-label="文字"
          disabled={disabled}
          onFocus={(e) => fieldRef?.(e.currentTarget)}
          onChange={(e) => {
            const v = e.target.value;
            // Notion 式快捷：空块里输入“# ”即变成标题
            if (/^#{1,3} $/.test(v) && block.text.length < v.length && /^#{0,3}$/.test(block.text)) onChange({ id: block.id, type: 'heading', text: '' });
            else onChange({ ...block, text: v });
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />
      );
    case 'table':
      return <TableEditor block={block} onChange={onChange} disabled={disabled} />;
    case 'media': {
      const m = ctx.materials.find((x) => x.id === block.materialId);
      return (
        <div className="fa-blk__media">
          {m ? <MaterialPreview api={ctx.api} pageId={ctx.pageId} material={m} /> : <MissingMaterial materialId={block.materialId} />}
          <AutoTextarea
            className="fa-blk__caption"
            value={block.caption}
            maxLength={PAGE_LIMITS.caption}
            placeholder="写一句图注：拍的是什么、哪一组、什么时候…"
            aria-label="图注"
            disabled={disabled}
            onChange={(e) => onChange({ ...block, caption: e.target.value })}
          />
        </div>
      );
    }
  }
}

/* ───────────────────────── 页面里的一块（带工具与状态） ───────────────────────── */

/** 按块 ID 操作；引用保持稳定，配合 memo 让打字时只重渲染正在编辑的那一块 */
export interface BlockActions {
  change: (id: string, b: PageBlockInput) => void;
  remove: (id: string, focusPrev: boolean) => void;
  move: (id: string, delta: number) => void;
  insertAfter: (id: string, b: PageBlockInput) => void;
  replaceWith: (id: string, b: PageBlockInput) => void;
  confirm: (id: string) => void;
}

export const PageBlockView = memo(function PageBlockView({
  block,
  meta,
  index,
  total,
  ctx,
  actions,
  focus,
  onFocused,
  highlight,
}: {
  block: PageBlockInput;
  /** 服务器上的同一块（新块尚未保存时为 undefined） */
  meta: PageBlock | undefined;
  index: number;
  total: number;
  ctx: BlockCtx;
  actions: BlockActions;
  focus: boolean;
  onFocused: () => void;
  highlight: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const fieldEl = useRef<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dirty = !!meta && !sameBlock(block, meta);

  useEffect(() => {
    if (!focus) return;
    const el = fieldEl.current ?? rootRef.current?.querySelector<HTMLElement>('textarea, input');
    el?.focus();
    onFocused();
  }, [focus, onFocused]);

  useEffect(() => {
    if (highlight) rootRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlight]);

  const id = block.id;
  const close = () => setMenu(false);
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      actions.move(id, e.key === 'ArrowUp' ? -1 : 1);
    } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      actions.insertAfter(id, { id: uid(), type: 'text', text: '' });
    } else if (e.key === 'Enter' && block.type === 'heading') {
      e.preventDefault();
      actions.insertAfter(id, { id: uid(), type: 'text', text: '' });
    } else if (e.key === 'Backspace' && (block.type === 'text' || block.type === 'heading') && block.text === '') {
      e.preventDefault();
      if (block.type === 'heading') actions.replaceWith(id, convertBlock(block, 'text'));
      else actions.remove(id, true);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData.files.length) return; // 文件由页面统一接收
    const text = e.clipboardData.getData('text/plain');
    if (!looksTabular(text)) return;
    const pb = pastedBlock(text, uid);
    if (pb.type !== 'table') return; // 不规则内容按原文粘进文字
    e.preventDefault();
    if (block.type === 'text' && block.text.trim() === '') actions.replaceWith(id, pb);
    else actions.insertAfter(id, pb);
  };

  const pending = !!meta?.pendingReview;
  const cls = [
    'fa-blk',
    `fa-blk--${block.type}`,
    meta && meta.author !== 'user' ? 'is-ai' : '',
    pending ? 'is-pending' : '',
    dirty || !meta ? 'is-unsaved' : '',
    highlight ? 'is-flash' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={rootRef} className={cls} id={`xp-blk-${block.id}`} data-block={block.id}>
      <div className="fa-blk__gutter">
        <button type="button" className="fa-blk__handle" aria-label={`第 ${index + 1} 块（${BLOCK_TYPE_LABEL[block.type]}）操作`} aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
          <span aria-hidden="true">⋮⋮</span>
        </button>
        {menu && (
          <div
            className="fa-blk__menu"
            role="menu"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setMenu(false);
              }
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setMenu(false);
            }}
          >
            <button
              type="button"
              role="menuitem"
              autoFocus
              disabled={index === 0}
              onClick={() => {
                actions.move(id, -1);
                close();
              }}
            >
              <Icon name="up" size={13} /> 上移 <kbd>Alt ↑</kbd>
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={index === total - 1}
              onClick={() => {
                actions.move(id, 1);
                close();
              }}
            >
              <Icon name="down" size={13} /> 下移 <kbd>Alt ↓</kbd>
            </button>
            {block.type === 'text' && (
              <button
                type="button"
                role="menuitem"
                disabled={block.text.length > PAGE_LIMITS.heading}
                title={block.text.length > PAGE_LIMITS.heading ? `标题最多 ${PAGE_LIMITS.heading} 字` : undefined}
                onClick={() => {
                  actions.replaceWith(id, convertBlock(block, 'heading'));
                  close();
                }}
              >
                <Icon name="edit" size={13} /> 转为小节标题
              </button>
            )}
            {block.type === 'heading' && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  actions.replaceWith(id, convertBlock(block, 'text'));
                  close();
                }}
              >
                <Icon name="edit" size={13} /> 转为文字
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                actions.insertAfter(id, { id: uid(), type: 'text', text: '' });
                close();
              }}
            >
              <Icon name="plus" size={13} /> 在下方加文字 <kbd>⌘↵</kbd>
            </button>
            <button
              type="button"
              role="menuitem"
              className="is-danger"
              onClick={() => {
                actions.remove(id, false);
                close();
              }}
            >
              <Icon name="trash" size={13} /> 删除这一块
            </button>
            {block.type === 'media' && <p className="fa-blk__menu-note">删除的是页面里的这一块；素材原件与原样记录仍然保留。</p>}
          </div>
        )}
      </div>
      <div className="fa-blk__body">
        <BlockFields
          block={block}
          ctx={ctx}
          onChange={(b) => actions.change(id, b)}
          fieldRef={(el) => {
            fieldEl.current = el;
          }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />
        {(meta && (meta.author !== 'user' || pending || meta.confirmedAt || meta.sources.length > 0)) || dirty ? (
          <div className="fa-blk__foot">
            {meta && <AuthorBadge meta={meta} />}
            {pending && (
              <>
                <span className="fa-blk__pending" title="这块内容来自 AI，尚未由你核对。模型的把握程度不能代替核对。">
                  待核
                </span>
                <button type="button" className="fa-btn fa-btn--sm fa-blk__confirm" disabled={ctx.busy || dirty} title={dirty ? '先等修改保存完成' : '记录为你已核对'} onClick={() => actions.confirm(id)}>
                  <Icon name="check" size={13} />
                  我已核对
                </button>
              </>
            )}
            {meta?.confirmedAt && !pending && <span className="fa-blk__confirmed">已核对 {mdhm(meta.confirmedAt)}</span>}
            {meta && <SourceChips sources={meta.sources} ctx={ctx} />}
            {dirty && <span className="fa-blk__dirty">已修改 · 待保存</span>}
          </div>
        ) : null}
      </div>
    </div>
  );
});
