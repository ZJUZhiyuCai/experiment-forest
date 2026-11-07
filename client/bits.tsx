import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import type { EntityKind, ForestEntity } from '../shared/model';
import { Icon, KIND_ICON } from './icons';
import type { IconName } from './icons';
import {
  FIELDS,
  KIND,
  LIMITS,
  fieldString,
  isArchived,
  localDateOfIso,
  provenanceOf,
  statusOption,
  timelineDate,
} from './forest-model';

/* ───────────────────────── 状态 ───────────────────────── */

/** 状态：一枚小圆点 + 文字，安静地呈现；颜色之外还有点的形态（空心/实心/菱形）区分 */
export function StatusPill({ kind, status }: { kind: EntityKind; status: string }) {
  const opt = statusOption(kind, status);
  return (
    <span className={`fa-status fa-tone-${opt.tone}`}>
      <span className="fa-status__dot" aria-hidden="true" />
      {opt.label}
    </span>
  );
}

/** 生长线上的节点：形状随状态语气变化，颜色不是唯一区分手段 */
export function StatusNode({ kind, status }: { kind: EntityKind; status: string }) {
  const opt = statusOption(kind, status);
  return <span className={`fa-node fa-node--${opt.tone}`} aria-hidden="true" />;
}

export function AiBadge({ needsReview }: { needsReview: boolean }) {
  return (
    <span className={`fa-ai-tag${needsReview ? ' is-review' : ''}`} title={needsReview ? 'AI 草稿，待人工核对' : 'AI 草稿，已人工核对'}>
      <Icon name="spark" size={11} />
      {needsReview ? 'AI · 待核对' : 'AI · 已核对'}
    </span>
  );
}

export function FreshDot() {
  return (
    <span className="fa-fresh" title="刷新后新出现的条目">
      <span className="fa-sr">新</span>
    </span>
  );
}

/* ───────────────────────── 年轮徽记 ───────────────────────── */

/**
 * 每一圈 = 一个“有实验记录的月份”（按实验日期，未填则按创建日期），
 * 圈越粗该月记录越多。由真实记录计算，aria-label 写明具体数字。
 */
export function RingGlyph({ records, size = 40 }: { records: ForestEntity[]; size?: number }) {
  const months = new Map<string, number>();
  for (const r of records) {
    if (isArchived(r)) continue;
    const m = timelineDate(r).date.slice(0, 7);
    if (m) months.set(m, (months.get(m) ?? 0) + 1);
  }
  const sorted = Array.from(months.entries()).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const shown = sorted.slice(-7);
  const label = sorted.length
    ? `年轮：${sorted.length} 个月份有实验记录（${sorted.map(([m, c]) => `${m} 共 ${c} 条`).join('，')}）`
    : '年轮：尚无实验记录';
  // 放在柔和的圆角方块里：细线同心圆，越外圈越新；没有记录时只有一粒中心点
  const c = size / 2;
  const maxR = c * 0.72;
  const minR = c * 0.16;
  return (
    <span className={`fa-rings${shown.length ? '' : ' is-empty'}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <title>{label}</title>
        {shown.map(([m, count], i) => {
          const r = shown.length === 1 ? maxR * 0.66 : minR + ((maxR - minR) * (i + 1)) / shown.length;
          const w = Math.min(size / 14, 0.75 + Math.log2(count + 1) * (size / 64));
          return <circle key={m} cx={c} cy={c} r={r} className="fa-rings__ring" strokeWidth={w} style={{ opacity: 0.35 + (0.65 * (i + 1)) / shown.length }} />;
        })}
        <circle cx={c} cy={c} r={Math.max(1.2, size / 22)} className="fa-rings__pith" />
      </svg>
    </span>
  );
}

/* ───────────────────────── 条目行 ───────────────────────── */

export function entityMeta(e: ForestEntity): string {
  const bits: string[] = [];
  const t = timelineDate(e);
  if (KIND[e.kind].dateKey) bits.push(t.fromField ? t.date : `创建 ${t.date}`);
  for (const f of FIELDS[e.kind]) {
    if (f.type !== 'text') continue;
    const v = fieldString(e.data, f);
    if (v) bits.push(f.key === 'version' ? `v${v.replace(/^v/i, '')}` : v);
  }
  if (!KIND[e.kind].dateKey) bits.push(`更新 ${localDateOfIso(e.updatedAt)}`);
  return bits.join(' · ');
}

export function EntityRow({
  entity,
  selected,
  fresh,
  showKind,
  projectTitle,
  onSelect,
}: {
  entity: ForestEntity;
  selected: boolean;
  fresh: boolean;
  showKind?: boolean;
  projectTitle?: string;
  onSelect: (id: string) => void;
}) {
  const prov = provenanceOf(entity);
  return (
    <li className="fa-row-wrap">
      <button
        type="button"
        className={`fa-row${selected ? ' is-selected' : ''}${isArchived(entity) ? ' is-archived' : ''}${prov.isAi ? ' is-ai' : ''}`}
        aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(entity.id)}
      >
        <span className={`fa-row__icon fa-kind-${entity.kind}`}>
          <Icon name={KIND_ICON[entity.kind]} size={16} />
        </span>
        <span className="fa-row__main">
          <span className="fa-row__title">
            {showKind && <span className="fa-row__kind">{KIND[entity.kind].short}</span>}
            {entity.title || '（无标题）'}
          </span>
          <span className="fa-row__meta">
            {entityMeta(entity)}
            {projectTitle ? ` · ${projectTitle}` : ''}
          </span>
        </span>
        <span className="fa-row__side">
          {fresh && <FreshDot />}
          {prov.isAi && <AiBadge needsReview={prov.needsReview} />}
          <StatusPill kind={entity.kind} status={entity.status} />
        </span>
      </button>
    </li>
  );
}

/* ───────────────────────── 属性表（Notion 式：左标签、右取值） ───────────────────────── */

export interface PropertyRow {
  label: string;
  value: ReactNode;
  icon?: IconName;
  mono?: boolean;
  /** 次要信息（编号、时间戳等），视觉上更轻 */
  quiet?: boolean;
}

export function Properties({ rows, label }: { rows: PropertyRow[]; label?: string }) {
  return (
    <dl className="fa-props" aria-label={label}>
      {rows.map((r) => (
        <div className={`fa-props__row${r.quiet ? ' is-quiet' : ''}`} key={r.label}>
          <dt>
            {r.icon && <Icon name={r.icon} size={14} />}
            <span>{r.label}</span>
          </dt>
          <dd className={r.mono ? 'is-mono' : undefined}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ───────────────────────── 正文 ───────────────────────── */

/** 纯文本段落渲染：不解析 HTML/Markdown，不使用 dangerouslySetInnerHTML */
export function Paragraphs({ text, limit }: { text: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  const trimmed = text.trim();
  if (!trimmed) return <p className="fa-muted">（正文为空）</p>;
  const tooLong = limit !== undefined && trimmed.length > limit;
  const visible = tooLong && !expanded ? `${trimmed.slice(0, limit)}…` : trimmed;
  const paras = visible.split(/\n{2,}/);
  return (
    <div className="fa-prose">
      {paras.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {tooLong && (
        <button type="button" className="fa-link" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          {expanded ? '收起' : `展开全文（${trimmed.length} 字）`}
        </button>
      )}
    </div>
  );
}

/* ───────────────────────── 空态 / 提示 ───────────────────────── */

/** 空态标志：细线同心圆（年轮）中长出一株新芽，克制、单色 */
export function SeedArt() {
  return (
    <svg className="fa-seed-art" viewBox="0 0 96 96" aria-hidden="true">
      <circle className="fa-seed-art__ring fa-seed-art__ring--3" cx="48" cy="48" r="44" />
      <circle className="fa-seed-art__ring fa-seed-art__ring--2" cx="48" cy="48" r="32" />
      <circle className="fa-seed-art__ring" cx="48" cy="48" r="20" />
      <path className="fa-seed-art__sprout" d="M48 60V46" />
      <path className="fa-seed-art__leaf" d="M48 47c0-6 3.6-9.6 9.6-9.6 0 6-3.6 9.6-9.6 9.6Z" />
      <path className="fa-seed-art__leaf" d="M48 50c0-4.6-2.8-7.4-7.4-7.4 0 4.6 2.8 7.4 7.4 7.4Z" />
    </svg>
  );
}

export function EmptyState({
  title,
  children,
  actions,
  art = true,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  art?: boolean;
}) {
  return (
    <div className="fa-empty">
      {art && <SeedArt />}
      <p className="fa-empty__title">{title}</p>
      {children && <div className="fa-empty__body">{children}</div>}
      {actions && <div className="fa-empty__actions">{actions}</div>}
    </div>
  );
}

export function Notice({
  tone,
  title,
  children,
  actions,
  live = false,
}: {
  tone: 'info' | 'warn' | 'danger' | 'ai' | 'ok';
  title?: string;
  children?: ReactNode;
  actions?: ReactNode;
  live?: boolean;
}) {
  const icon: IconName = tone === 'ok' ? 'check' : tone === 'ai' ? 'spark' : tone === 'info' ? 'sprout' : 'alert';
  return (
    <div className={`fa-notice fa-notice--${tone}`} role={live ? (tone === 'danger' ? 'alert' : 'status') : undefined}>
      <span className="fa-notice__icon">
        <Icon name={icon} size={16} />
      </span>
      <div className="fa-notice__body">
        {title && <p className="fa-notice__title">{title}</p>}
        {children}
        {actions && <div className="fa-notice__actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="fa-spinner" role="status">
      <span className="fa-spinner__ring" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

/* ───────────────────────── 两步确认（本地） ───────────────────────── */

export function InlineConfirm({
  label,
  confirmLabel,
  question,
  icon,
  busy,
  disabled,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  question: string;
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) confirmRef.current?.focus();
  }, [open]);
  const close = () => {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  };
  if (!open) {
    return (
      <button ref={triggerRef} type="button" className="fa-btn fa-btn--ghost" disabled={disabled || busy} onClick={() => setOpen(true)}>
        {icon && <Icon name={icon} />}
        {busy ? '处理中…' : label}
      </button>
    );
  }
  return (
    <span
      className="fa-confirm"
      role="group"
      aria-label={question}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      }}
    >
      <span className="fa-confirm__q">{question}</span>
      <button
        ref={confirmRef}
        type="button"
        className="fa-btn fa-btn--danger fa-btn--sm"
        onClick={() => {
          setOpen(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className="fa-btn fa-btn--ghost fa-btn--sm" onClick={close}>
        取消
      </button>
    </span>
  );
}

/* ───────────────────────── 标签输入 ───────────────────────── */

export function TagInput({
  tags,
  onChange,
  id,
  describedBy,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  id: string;
  describedBy?: string;
}) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const msgId = useId();

  const add = (raw: string): boolean => {
    const parts = raw
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return false;
    const next = tags.slice();
    for (const p of parts) {
      if (p.length > LIMITS.tagLength) {
        setMsg(`单个标签最多 ${LIMITS.tagLength} 字`);
        return false;
      }
      if (next.indexOf(p) !== -1) continue;
      if (next.length >= LIMITS.tags) {
        setMsg(`最多 ${LIMITS.tags} 个标签`);
        break;
      }
      next.push(p);
    }
    onChange(next);
    setText('');
    if (next.length < LIMITS.tags) setMsg('');
    return true;
  };

  return (
    <div className="fa-tags-input">
      <ul className="fa-tags" aria-label="已添加的标签">
        {tags.map((t) => (
          <li key={t} className="fa-tag">
            <span>{t}</span>
            <button type="button" className="fa-tag__x" aria-label={`移除标签 ${t}`} onClick={() => onChange(tags.filter((x) => x !== t))}>
              <Icon name="close" size={12} />
            </button>
          </li>
        ))}
      </ul>
      <input
        id={id}
        className="fa-input fa-tags-input__field"
        value={text}
        maxLength={LIMITS.tagLength * 4}
        placeholder={tags.length ? '继续添加…' : '输入后回车或逗号添加'}
        aria-describedby={[describedBy, msg ? msgId : ''].filter(Boolean).join(' ') || undefined}
        onChange={(e) => {
          const v = e.target.value;
          if (/[,，]/.test(v)) add(v);
          else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && text.trim()) {
            // 有待添加的文字时，回车用于添加标签而不是提交表单
            e.preventDefault();
            add(text);
          } else if (e.key === 'Backspace' && !text && tags.length) {
            onChange(tags.slice(0, -1));
          }
        }}
        onBlur={() => {
          if (text.trim()) add(text);
        }}
      />
      <span className="fa-help">
        {tags.length}/{LIMITS.tags}
        {msg && (
          <span id={msgId} className="fa-help--error" role="alert">
            {' '}
            {msg}
          </span>
        )}
      </span>
    </div>
  );
}
