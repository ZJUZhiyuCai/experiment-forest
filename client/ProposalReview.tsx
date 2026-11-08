import { useMemo, useState } from 'react';
import type { PageBlock, PageBlockInput, PageProposal, PageProposalOperation, PageReadReceipt } from '../shared/page';
import { Icon } from './icons';
import { BlockFields, BlockReadOnly, SourceChips } from './PageBlocks';
import type { BlockCtx } from './PageBlocks';
import {reviewEditKey} from './pageStore';
import type { PageController, PageState } from './pageStore';
import { BLOCK_TYPE_LABEL, OP_KIND_LABEL, RECEIPT_MODE_LABEL, blockLabel, isImageMaterial, mdhm, sameBlock } from './pageModel';

/**
 * 就地审阅：页首只留一条精简的提案条（模型自述、系统记录、批量与“逐处看”），
 * 每处待定改动挂在它要改写的那一块正下方；追加类改动放在页末。
 * 接受仍然逐处由人决定；批量接受保持原子语义。这里只做展示与交互，结果一律以 Host 返回为准。
 */

/* ───────────────────────── 系统记录（Host 实际交给会话的内容） ───────────────────────── */

export function ReceiptPanel({ readIds, receipts, ctx, defaultOpen = false }: { readIds: string[]; receipts: PageReadReceipt[]; ctx: BlockCtx; defaultOpen?: boolean }) {
  const mine = receipts.filter((r) => readIds.includes(r.id));
  const seen = new Set(mine.flatMap((r) => r.materials.map((m) => m.id)));
  const unseen = ctx.materials.filter((m) => !seen.has(m.id));
  const truncated = mine.some((r) => r.truncated);
  return (
    <details className="fa-receipt" open={defaultOpen}>
      <summary>
        <Icon name="lock" size={12} />
        <span className="fa-receipt__title">系统记录</span>
        <span className="fa-receipt__sum">
          {mine.length ? `Host 记下了 ${mine.length} 次读取` : '没有找到对应的读取记录'}
          {truncated ? ' · 有截断' : ''}
          {unseen.length ? ` · ${unseen.length} 份素材未交给会话` : ''}
        </span>
        <span className="fa-receipt__chev" aria-hidden="true">
          <Icon name="down" size={12} />
        </span>
      </summary>
      <div className="fa-receipt__body">
        {mine.length === 0 && (
          <p className="fa-help">
            提案引用的读取凭据（{readIds.join('、')}）在本页没有记录，无法证实模型读过什么。
          </p>
        )}
        {mine.map((r) => (
          <div key={r.id} className="fa-receipt__item">
            <p className="fa-receipt__when">
              {mdhm(r.at)} · 块快照 {r.snapshots.length} 份{r.truncated ? ' · 内容有截断，模型只拿到了一部分' : ''}
            </p>
            {r.materials.length > 0 && (
              <ul className="fa-receipt__list">
                {r.materials.map((m) => {
                  const mat = ctx.materials.find((x) => x.id === m.id);
                  return (
                    <li key={m.id}>
                      <span className="fa-receipt__name">{mat?.name ?? m.id}</span>
                      <span className={`fa-receipt__mode is-${m.mode}`}>{RECEIPT_MODE_LABEL[m.mode]}</span>
                      {m.detail && <span className="fa-muted">{m.detail}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
        {unseen.length > 0 && (
          <p className="fa-help">
            未交给会话：{unseen.map((m) => m.name).join('、')}。
          </p>
        )}
        <p className="fa-help fa-receipt__fine">这里是 Host 读取并准备提供给工具的内容范围；会话策略仍可能拦截结果，不证明模型已接收或理解正确；提案里的“模型自述”是模型自己的说法，不作为证据。</p>
      </div>
    </details>
  );
}

/* ───────────────────────── 逐字差异（纯展示：只比较文字，不判断语义） ───────────────────────── */

type Seg = { t: 'same' | 'del' | 'ins'; s: string };

// 数字（含小数点、千分位）与拉丁词整体成词，其余逐字：0.23 → 0.32 显示为一整处替换，而不是零碎的字符
const TOKEN = /\d+(?:[.,]\d+)*|[A-Za-z]+|\s+|[\s\S]/gu;
// 超过预算时退化为“整段删去 + 整段新增”，结果仍然正确，只是粒度变粗
const LCS_BUDGET = 160_000;

function textDiff(a: string, b: string): Seg[] {
  const x = a.match(TOKEN) ?? [];
  const y = b.match(TOKEN) ?? [];
  const out: Seg[] = [];
  const push = (t: Seg['t'], s: string) => {
    if (!s) return;
    const last = out[out.length - 1];
    if (last && last.t === t) last.s += s;
    else out.push({ t, s });
  };
  let pre = 0;
  while (pre < x.length && pre < y.length && x[pre] === y[pre]) pre += 1;
  let suf = 0;
  while (suf < x.length - pre && suf < y.length - pre && x[x.length - 1 - suf] === y[y.length - 1 - suf]) suf += 1;
  const xm = x.slice(pre, x.length - suf);
  const ym = y.slice(pre, y.length - suf);
  push('same', x.slice(0, pre).join(''));
  if (xm.length * ym.length > LCS_BUDGET) {
    push('del', xm.join(''));
    push('ins', ym.join(''));
  } else {
    const n = xm.length;
    const m = ym.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = m - 1; j >= 0; j -= 1) dp[i][j] = xm[i] === ym[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (xm[i] === ym[j]) {
        push('same', xm[i]);
        i += 1;
        j += 1;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) push('del', xm[i++]);
      else push('ins', ym[j++]);
    }
    while (i < n) push('del', xm[i++]);
    while (j < m) push('ins', ym[j++]);
  }
  push('same', x.slice(x.length - suf).join(''));
  return out;
}

const visibleLength = (s: string) => Array.from(s.replace(/\s/g, '')).length;

function diffFacts(segs: Seg[]) {
  const changed = segs.filter((s) => s.t !== 'same');
  return {
    unchanged: changed.length === 0,
    digits: changed.some((s) => /\d/.test(s.s)),
    deleted: segs.filter((s) => s.t === 'del').reduce((n, s) => n + visibleLength(s.s), 0),
  };
}

function DiffText({ segs, heading }: { segs: Seg[]; heading?: boolean }) {
  return (
    <p className={`fa-diff${heading ? ' is-heading' : ''}`}>
      {segs.map((s, i) =>
        s.t === 'same' ? (
          <span key={i}>{s.s}</span>
        ) : s.t === 'del' ? (
          <del key={i} className="fa-diff__del">
            <span className="fa-sr">删去：</span>
            {s.s}
          </del>
        ) : (
          <ins key={i} className="fa-diff__ins">
            <span className="fa-sr">新增：</span>
            {s.s}
          </ins>
        ),
      )}
    </p>
  );
}

const textOf = (b: PageBlockInput | undefined): string | null => (b && (b.type === 'text' || b.type === 'heading') ? b.text : null);

/* ───────────────────────── 选择（批量接受用，跨提案条与正文共享） ───────────────────────── */

export interface ReviewSelection {
  isOn: (proposalId: string, opId: string) => boolean;
  set: (proposalId: string, opIds: string[], on: boolean) => void;
  chosen: (proposalId: string, among: string[]) => string[];
}

export function useReviewSelection(): ReviewSelection {
  const [sel, setSel] = useState<Record<string, string[]>>({});
  return useMemo(
    () => ({
      isOn: (p, o) => !!sel[p]?.includes(o),
      set: (p, ids, on) =>
        setSel((s) => {
          const cur = new Set(s[p] ?? []);
          ids.forEach((id) => (on ? cur.add(id) : cur.delete(id)));
          return { ...s, [p]: Array.from(cur) };
        }),
      chosen: (p, among) => among.filter((id) => sel[p]?.includes(id)),
    }),
    [sel],
  );
}

/* ───────────────────────── 待定改动在正文里的位置 ───────────────────────── */

export interface PendingItem {
  proposal: PageProposal;
  op: PageProposalOperation;
}
export interface Placement {
  /** 替换类：挂在目标块下方（目标块仍在当前正文里） */
  byBlock: Map<string, PendingItem[]>;
  /** 追加类，以及目标块已不在正文里的替换 */
  tail: PendingItem[];
  /** 按正文从上到下的顺序，供“逐处看 / 下一处”使用 */
  order: string[];
}

export const opDomId = (proposalId: string, opId: string) => `xp-op-${proposalId}-${opId}`;

export function usePlacement(state: PageState): Placement {
  const proposals = state.view?.page.proposals;
  const blocks = state.local.blocks;
  return useMemo(() => {
    const ids = new Set(blocks.map((b) => b.id));
    const byBlock = new Map<string, PendingItem[]>();
    const tail: PendingItem[] = [];
    const sorted = (proposals ?? []).slice().sort((a, b) => (a.at < b.at ? -1 : 1));
    for (const proposal of sorted) {
      for (const op of proposal.operations) {
        if (op.status !== 'pending') continue;
        if (op.action === 'replace' && op.targetBlockId && ids.has(op.targetBlockId)) {
          const list = byBlock.get(op.targetBlockId) ?? [];
          list.push({ proposal, op });
          byBlock.set(op.targetBlockId, list);
        } else tail.push({ proposal, op });
      }
    }
    const order: string[] = [];
    for (const b of blocks) for (const it of byBlock.get(b.id) ?? []) order.push(opDomId(it.proposal.id, it.op.id));
    for (const it of tail) order.push(opDomId(it.proposal.id, it.op.id));
    return { byBlock, tail, order };
  }, [proposals, blocks]);
}

/* ───────────────────────── 单个改动 ───────────────────────── */

function OpRow({
  proposal,
  op,
  state,
  ctrl,
  ctx,
  selection,
  onJumpBlock,
  inline = false,
  fresh = false,
  flash = false,
  onNext,
}: {
  proposal: PageProposal;
  op: PageProposalOperation;
  state: PageState;
  ctrl: PageController;
  ctx: BlockCtx;
  selection?: ReviewSelection;
  onJumpBlock: (id: string) => void;
  inline?: boolean;
  fresh?: boolean;
  flash?: boolean;
  onNext?: () => void;
}) {
  const metaById = useMemo(() => new Map((state.view?.page.blocks ?? []).map((b) => [b.id, b])), [state.view]);
  const pending = op.status === 'pending';
  const edit = state.reviewEdits[reviewEditKey(proposal.id, op.id)];
  const shown: PageBlockInput = edit ?? op.block;
  const target = op.targetBlockId ? state.local.blocks.find((b) => b.id === op.targetBlockId) : undefined;
  const targetMeta: PageBlock | undefined = op.targetBlockId ? metaById.get(op.targetBlockId) : undefined;
  const staleTarget = op.action === 'replace' && targetMeta && op.targetVersion !== undefined && targetMeta.version !== op.targetVersion;
  const staleSources = Object.entries(op.sourceVersions).filter(([k, v]) => {
    const b = metaById.get(k);
    return b && b.version !== v;
  });
  const fromImage = op.sources.some((s) => isImageMaterial(ctx.materials.find((m) => m.id === s.materialId)));
  // 推断类默认折叠；已处理的改动只作历史，默认也折叠
  const [open, setOpen] = useState(pending && op.kind !== 'infer');
  const [editing, setEditing] = useState(false);

  // 文字 / 标题的替换：显示逐字差异（与当前正文比较，用户改过提议时与改后的版本比较）
  const before = pending && op.action === 'replace' ? textOf(target) : null;
  const after = textOf(shown);
  const segs = useMemo(() => (before !== null && after !== null ? textDiff(before, after) : null), [before, after]);
  const facts = segs ? diffFacts(segs) : null;
  const typeChange = !!segs && !!target && target.type !== shown.type;
  const selected = !!selection?.isOn(proposal.id, op.id);
  const domId = opDomId(proposal.id, op.id);

  const decide = async (decision: 'accept' | 'reject') => {
    const ok = await ctrl.decide(proposal.id, [op.id], decision);
    if (ok) selection?.set(proposal.id, [op.id], false);
  };

  const head = inline ? (
    op.action === 'append' ? (
      <>提议在页末追加{BLOCK_TYPE_LABEL[op.block.type]}</>
    ) : target ? (
      <>提议改写上面这块{BLOCK_TYPE_LABEL[target.type]}</>
    ) : (
      <>替换的目标块已不在页面里</>
    )
  ) : op.action === 'append' ? (
    <>追加{BLOCK_TYPE_LABEL[op.block.type]}到页末</>
  ) : target ? (
    <>
      替换
      <button type="button" className="fa-link" onClick={() => onJumpBlock(target.id)}>
        「{blockLabel(target, ctx.materials)}」
      </button>
    </>
  ) : (
    <>替换的目标块已不在页面里</>
  );

  const editor = (
    <BlockFields block={shown} ctx={ctx} disabled={ctx.busy} onChange={(b) => ctrl.setReviewEdit(proposal.id, op.id, sameBlock(b, op.block) ? null : b)} />
  );

  return (
    <li
      id={domId}
      className={`fa-op is-${op.status}${op.kind === 'infer' ? ' is-infer' : ''}${inline ? ' is-inline' : ''}${fresh ? ' is-fresh' : ''}${flash ? ' is-flash' : ''}`}
    >
      <div className="fa-op__head">
        {pending && selection && (
          <input
            type="checkbox"
            className="fa-op__check"
            checked={selected}
            onChange={(e) => selection.set(proposal.id, [op.id], e.target.checked)}
            aria-label="选中这处改动（用于批量接受或拒绝）"
          />
        )}
        <span className="fa-op__what">
          {inline && <Icon name="spark" size={12} />}
          {head}
        </span>
        <span className={`fa-op__kind is-${op.kind}`} title="类别由模型自报，不能证明没有改变事实">
          {OP_KIND_LABEL[op.kind]}
          <span className="fa-op__self">自报</span>
        </span>
        {!pending && <span className={`fa-op__status is-${op.status}`}>{op.status === 'accepted' ? '已接受' : '已拒绝'}</span>}
        {(op.kind === 'infer' || !pending) && (
          <button type="button" className="fa-link fa-op__toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? '收起' : op.kind === 'infer' && pending ? '展开推断' : '展开'}
          </button>
        )}
      </div>

      {pending && (op.warning || staleTarget || staleSources.length > 0 || fromImage || facts?.digits || (op.kind === 'layout' && !!facts?.deleted)) && (
        <ul className="fa-op__flags">
          {op.warning && (
            <li className="is-warn">
              <Icon name="alert" size={12} />
              系统核对：{op.warning}
            </li>
          )}
          {staleTarget && (
            <li className="is-warn">
              <Icon name="alert" size={12} />
              提案生成后这块又被修改过（v{op.targetVersion} → v{targetMeta?.version}），Host 很可能拒绝接受；可以再理一理。
            </li>
          )}
          {staleSources.length > 0 && (
            <li className="is-warn">
              <Icon name="alert" size={12} />
              {staleSources.length} 处依据在生成后有变化，请对照原样重新核对。
            </li>
          )}
          {facts?.digits && (
            <li className="is-warn">
              <Icon name="alert" size={12} />
              {op.kind === 'layout' ? '自报为“排版”，但' : ''}差异里有数字被改动或删去（下方红色删去、绿色新增），请逐个对照原样。
            </li>
          )}
          {!facts?.digits && op.kind === 'layout' && !!facts?.deleted && (
            <li className="is-warn">
              <Icon name="alert" size={12} />
              自报为“排版”，但删去了 {facts.deleted} 个字，请确认没有丢内容。
            </li>
          )}
          {fromImage && (
            <li className="is-ai">
              <Icon name="spark" size={12} />
              依据里有图片：从图片读出的内容接受后会标为“待核”，需要你逐块确认。
            </li>
          )}
        </ul>
      )}

      {open &&
        (segs && !editing ? (
          <div className="fa-op__diffbox">
            <span className="fa-op__side-label">
              {edit ? '改动 · 按你改过的版本' : '改动'}
              {typeChange ? ` · 并改为${BLOCK_TYPE_LABEL[shown.type]}` : ''}
              <span className="fa-op__legend" aria-hidden="true">
                <del>删去</del>
                <ins>新增</ins>
              </span>
            </span>
            {facts?.unchanged ? <p className="fa-help">文字没有变化{typeChange ? '，只改了块的类型' : ''}。</p> : <DiffText segs={segs} heading={shown.type === 'heading'} />}
            {pending && (
              <span className="fa-op__diffacts">
                <button type="button" className="fa-link" disabled={ctx.busy} onClick={() => setEditing(true)}>
                  {edit ? '继续修改' : '先改再接受'}
                </button>
                {edit && (
                  <button type="button" className="fa-link" onClick={() => ctrl.setReviewEdit(proposal.id, op.id, null)}>
                    还原模型原文
                  </button>
                )}
              </span>
            )}
          </div>
        ) : segs && editing ? (
          <div className="fa-op__diffbox is-editing">
            <span className="fa-op__side-label">
              修改提议 · 接受时按你改的版本
              <button type="button" className="fa-link" onClick={() => setEditing(false)}>
                完成
              </button>
            </span>
            <div className="fa-op__side is-next">{editor}</div>
            <span className="fa-op__side-label is-sub">与现在相比</span>
            <DiffText segs={segs} heading={shown.type === 'heading'} />
          </div>
        ) : (
          <div className={`fa-op__preview${pending && op.action === 'replace' && target ? ' is-diff' : ''}`}>
            {/* 预览区本身是尺寸容器，内层网格按它的实际宽度决定左右对照还是上下对照 */}
            <div className="fa-op__grid">
              {pending && op.action === 'replace' && target && (
                <>
                  <div className="fa-op__side is-now">
                    <span className="fa-op__side-label">现在</span>
                    <BlockReadOnly block={target} ctx={ctx} />
                  </div>
                  <span className="fa-op__arrow" aria-hidden="true" />
                </>
              )}
              <div className="fa-op__side is-next">
                <span className="fa-op__side-label">
                  {pending ? (edit ? '提议 · 你改过' : '提议 · 可以直接修改') : '提议'}
                  {edit && pending && (
                    <button type="button" className="fa-link" onClick={() => ctrl.setReviewEdit(proposal.id, op.id, null)}>
                      还原模型原文
                    </button>
                  )}
                </span>
                {pending ? editor : <BlockReadOnly block={op.block} ctx={ctx} />}
              </div>
            </div>
          </div>
        ))}

      <div className="fa-op__foot">
        <SourceChips sources={op.sources} ctx={ctx} />
        {pending && (
          <span className="fa-op__actions">
            {inline && onNext && (
              <button type="button" className="fa-btn fa-btn--sm fa-btn--ghost fa-op__next" onClick={onNext} title="跳到下一处待定改动">
                下一处
                <Icon name="down" size={12} />
              </button>
            )}
            <button type="button" className="fa-btn fa-btn--sm fa-btn--ghost" disabled={ctx.busy} onClick={() => void decide('reject')}>
              拒绝
            </button>
            <button type="button" className="fa-btn fa-btn--sm fa-op__accept" disabled={ctx.busy || (!target && op.action === 'replace')} onClick={() => void decide('accept')}>
              <Icon name="check" size={13} />
              {edit ? '按我改的接受' : '接受'}
            </button>
          </span>
        )}
      </div>
    </li>
  );
}

/* ───────────────────────── 正文里的改动（挂在目标块下方 / 页末） ───────────────────────── */

export function InlineOps({
  items,
  tail = false,
  state,
  ctrl,
  ctx,
  selection,
  onJumpBlock,
  flashId,
  onNext,
}: {
  items: PendingItem[];
  tail?: boolean;
  state: PageState;
  ctrl: PageController;
  ctx: BlockCtx;
  selection: ReviewSelection;
  onJumpBlock: (id: string) => void;
  flashId: string | null;
  onNext: (fromId: string) => void;
}) {
  if (!items.length) return null;
  const known = state.awaiting?.known ?? [];
  // 全页只剩这一处时不显示“下一处”
  const many = (state.view?.page.proposals ?? []).reduce((n, p) => n + p.operations.filter((o) => o.status === 'pending').length, 0) > 1;
  return (
    <div className={`fa-inline-ops${tail ? ' is-tail' : ''}`}>
      {tail && (
        <p className="fa-inline-ops__label">
          <Icon name="spark" size={12} />
          提议追加到页末
        </p>
      )}
      <ol aria-label={tail ? '提议追加到页末的内容' : '针对上面这块的整理提议'}>
        {items.map(({ proposal, op }) => {
          const id = opDomId(proposal.id, op.id);
          return (
            <OpRow
              key={id}
              proposal={proposal}
              op={op}
              state={state}
              ctrl={ctrl}
              ctx={ctx}
              selection={selection}
              onJumpBlock={onJumpBlock}
              inline
              fresh={!!state.awaiting && !known.includes(proposal.id)}
              flash={flashId === id}
              onNext={many ? () => onNext(id) : undefined}
            />
          );
        })}
      </ol>
    </div>
  );
}

/* ───────────────────────── 页首提案条 ───────────────────────── */

function ProposalHead({
  proposal,
  state,
  ctrl,
  ctx,
  selection,
  placement,
  fresh,
  onGo,
}: {
  proposal: PageProposal;
  state: PageState;
  ctrl: PageController;
  ctx: BlockCtx;
  selection: ReviewSelection;
  placement: Placement;
  fresh: boolean;
  onGo: (domId: string) => void;
}) {
  const [claimOpen, setClaimOpen] = useState(false);
  const pendingOps = proposal.operations.filter((o) => o.status === 'pending');
  const pendingIds = pendingOps.map((o) => o.id);
  const decided = proposal.operations.length - pendingOps.length;
  const chosen = selection.chosen(proposal.id, pendingIds);
  const allOn = pendingIds.length > 0 && chosen.length === pendingIds.length;
  const mine = new Set(pendingIds.map((id) => opDomId(proposal.id, id)));
  const first = placement.order.find((id) => mine.has(id));
  const atTail = placement.tail.filter((it) => it.proposal.id === proposal.id).length;
  const inPlace = pendingOps.length - atTail;
  const long = proposal.summary.length > 90 || proposal.summary.includes('\n');

  const run = async (decision: 'accept' | 'reject') => {
    if (!chosen.length) return;
    const ok = await ctrl.decide(proposal.id, chosen, decision);
    if (ok) selection.set(proposal.id, chosen, false);
  };

  return (
    <article className={`fa-prop${fresh ? ' is-fresh' : ''}`} aria-label="整理提案">
      <header className="fa-prop__head">
        <span className="fa-prop__eyebrow">
          <Icon name="spark" size={13} />
          整理提案
          <span className="fa-muted">· {mdhm(proposal.at)}</span>
        </span>
        <span className="fa-prop__count">
          {pendingOps.length} 处待定{decided ? ` · 已处理 ${decided}` : ''}
        </span>
      </header>

      <section className="fa-prop__claim">
        <span className="fa-prop__tag" title="模型自己对这次整理的描述，不作为证据">
          模型自述
        </span>
        <p className={long && !claimOpen ? 'is-clamped' : undefined}>{proposal.summary}</p>
        {long && (
          <button type="button" className="fa-link fa-prop__more" aria-expanded={claimOpen} onClick={() => setClaimOpen((v) => !v)}>
            {claimOpen ? '收起' : '展开全文'}
          </button>
        )}
      </section>

      <ReceiptPanel readIds={proposal.readIds} receipts={state.view?.page.receipts ?? []} ctx={ctx} />

      {pendingOps.length > 0 && (
        <div className="fa-prop__nav">
          <p className="fa-prop__where">
            {inPlace > 0 ? `改动已放进正文：${inPlace} 处在要改的那块下方` : ''}
            {inPlace > 0 && atTail > 0 ? '，' : ''}
            {atTail > 0 ? `${inPlace > 0 ? '' : '改动已放进正文：'}${atTail} 处追加在页末` : ''}
            {'。逐处读、逐处决定。'}
          </p>
          {first && (
            <button type="button" className="fa-btn fa-btn--sm fa-prop__go" onClick={() => onGo(first)}>
              逐处看
              <Icon name="down" size={13} />
            </button>
          )}
        </div>
      )}

      {pendingOps.length > 1 && (
        <>
          <footer className="fa-prop__foot">
            <label className="fa-check">
              <input type="checkbox" checked={allOn} onChange={(e) => selection.set(proposal.id, pendingIds, e.target.checked)} />
              <span>全选待定 {pendingOps.length}</span>
            </label>
            {chosen.length > 0 && <span className="fa-muted fa-prop__chosen">已选 {chosen.length}（在正文里勾选或取消）</span>}
            <span className="fa-spacer" />
            <button type="button" className="fa-btn fa-btn--sm fa-btn--ghost" disabled={ctx.busy || !chosen.length} onClick={() => void run('reject')}>
              拒绝所选 {chosen.length || ''}
            </button>
            <button type="button" className="fa-btn fa-btn--sm fa-op__accept" disabled={ctx.busy || !chosen.length} onClick={() => void run('accept')}>
              <Icon name="check" size={13} />
              接受所选 {chosen.length || ''}
            </button>
          </footer>
          <p className="fa-help fa-prop__atomic">一次接受的几处改动要么全部生效，要么都不生效；推断类改动建议逐条看。</p>
        </>
      )}
    </article>
  );
}

/** 已处理完的提案：只作历史，改动默认折叠 */
function ProposalHistory({ proposal, state, ctrl, ctx, onJumpBlock }: { proposal: PageProposal; state: PageState; ctrl: PageController; ctx: BlockCtx; onJumpBlock: (id: string) => void }) {
  const accepted = proposal.operations.filter((o) => o.status === 'accepted').length;
  return (
    <article className="fa-prop is-done" aria-label="已处理的整理提案">
      <header className="fa-prop__head">
        <span className="fa-prop__eyebrow">
          <Icon name="spark" size={13} />
          整理提案
          <span className="fa-muted">· {mdhm(proposal.at)}</span>
        </span>
        <span className="fa-prop__count">
          接受 {accepted} · 拒绝 {proposal.operations.length - accepted}
        </span>
      </header>
      <section className="fa-prop__claim">
        <span className="fa-prop__tag" title="模型自己对这次整理的描述，不作为证据">
          模型自述
        </span>
        <p>{proposal.summary}</p>
      </section>
      <ReceiptPanel readIds={proposal.readIds} receipts={state.view?.page.receipts ?? []} ctx={ctx} />
      <ol className="fa-prop__ops">
        {proposal.operations.map((op) => (
          <OpRow key={op.id} proposal={proposal} op={op} state={state} ctrl={ctrl} ctx={ctx} onJumpBlock={onJumpBlock} />
        ))}
      </ol>
    </article>
  );
}

/* ───────────────────────── 提案区（页首） ───────────────────────── */

export function ProposalTray({
  state,
  ctrl,
  ctx,
  selection,
  placement,
  onGo,
  onJumpBlock,
}: {
  state: PageState;
  ctrl: PageController;
  ctx: BlockCtx;
  selection: ReviewSelection;
  placement: Placement;
  onGo: (domId: string) => void;
  onJumpBlock: (id: string) => void;
}) {
  const [showDone, setShowDone] = useState(false);
  const proposals = useMemo(() => (state.view?.page.proposals ?? []).slice().sort((a, b) => (a.at < b.at ? 1 : -1)), [state.view]);
  const open = proposals.filter((p) => p.operations.some((o) => o.status === 'pending'));
  const done = proposals.filter((p) => !p.operations.some((o) => o.status === 'pending'));
  const known = state.awaiting?.known ?? [];
  if (!proposals.length) return null;
  return (
    <section className="fa-props-tray" aria-label="AI 整理提案">
      {open.map((p) => (
        <ProposalHead
          key={p.id}
          proposal={p}
          state={state}
          ctrl={ctrl}
          ctx={ctx}
          selection={selection}
          placement={placement}
          fresh={!!state.awaiting && !known.includes(p.id)}
          onGo={onGo}
        />
      ))}
      {done.length > 0 && (
        <div className="fa-props-tray__done">
          <button type="button" className="fa-link" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
            {showDone ? '收起已处理的提案' : `已处理的提案 ${done.length}`}
          </button>
          {showDone && done.map((p) => <ProposalHistory key={p.id} proposal={p} state={state} ctrl={ctrl} ctx={ctx} onJumpBlock={onJumpBlock} />)}
        </div>
      )}
    </section>
  );
}
