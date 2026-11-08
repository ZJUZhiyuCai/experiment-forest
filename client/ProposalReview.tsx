import { useMemo, useState } from 'react';
import type { PageBlock, PageBlockInput, PageProposal, PageProposalOperation, PageReadReceipt } from '../shared/page';
import { Icon } from './icons';
import { BlockFields, BlockReadOnly, SourceChips } from './PageBlocks';
import type { BlockCtx } from './PageBlocks';
import {reviewEditKey} from './pageStore';
import type { PageController, PageState } from './pageStore';
import { BLOCK_TYPE_LABEL, OP_KIND_LABEL, RECEIPT_MODE_LABEL, blockLabel, isImageMaterial, mdhm, sameBlock } from './pageModel';

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

/* ───────────────────────── 单个改动 ───────────────────────── */

function OpRow({
  proposal,
  op,
  state,
  ctrl,
  ctx,
  selected,
  onSelect,
  onJumpBlock,
}: {
  proposal: PageProposal;
  op: PageProposalOperation;
  state: PageState;
  ctrl: PageController;
  ctx: BlockCtx;
  selected: boolean;
  onSelect: (on: boolean) => void;
  onJumpBlock: (id: string) => void;
}) {
  const metaById = useMemo(() => new Map((state.view?.page.blocks ?? []).map((b) => [b.id, b])), [state.view]);
  const pending = op.status === 'pending';
  const edit = state.reviewEdits[reviewEditKey(proposal.id,op.id)];
  const shown: PageBlockInput = edit ?? op.block;
  const target = op.targetBlockId ? state.local.blocks.find((b) => b.id === op.targetBlockId) : undefined;
  const targetMeta: PageBlock | undefined = op.targetBlockId ? metaById.get(op.targetBlockId) : undefined;
  const staleTarget = op.action === 'replace' && targetMeta && op.targetVersion !== undefined && targetMeta.version !== op.targetVersion;
  const staleSources = Object.entries(op.sourceVersions).filter(([k, v]) => {
    const b = metaById.get(k);
    return b && b.version !== v;
  });
  const fromImage = op.sources.some((s) => isImageMaterial(ctx.materials.find((m) => m.id === s.materialId)));
  const [open, setOpen] = useState(op.kind !== 'infer');

  const head =
    op.action === 'append' ? (
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

  return (
    <li className={`fa-op is-${op.status}${op.kind === 'infer' ? ' is-infer' : ''}`}>
      <div className="fa-op__head">
        {pending && (
          <input type="checkbox" className="fa-op__check" checked={selected} onChange={(e) => onSelect(e.target.checked)} aria-label="选中这处改动" />
        )}
        <span className="fa-op__what">{head}</span>
        <span className={`fa-op__kind is-${op.kind}`} title="类别由模型自报，不能证明没有改变事实">
          {OP_KIND_LABEL[op.kind]}
          <span className="fa-op__self">自报</span>
        </span>
        {!pending && <span className={`fa-op__status is-${op.status}`}>{op.status === 'accepted' ? '已接受' : '已拒绝'}</span>}
        {op.kind === 'infer' && pending && (
          <button type="button" className="fa-link fa-op__toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? '收起' : '展开推断'}
          </button>
        )}
      </div>

      {pending && (op.warning || staleTarget || staleSources.length > 0 || fromImage) && (
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
          {fromImage && (
            <li className="is-ai">
              <Icon name="spark" size={12} />
              依据里有图片：从图片读出的内容接受后会标为“待核”，需要你逐块确认。
            </li>
          )}
        </ul>
      )}

      {open && (
        <div className={`fa-op__preview${op.action === 'replace' && target ? ' is-diff' : ''}`}>
          {op.action === 'replace' && target && (
            <div className="fa-op__side is-now">
              <span className="fa-op__side-label">现在</span>
              <BlockReadOnly block={target} ctx={ctx} />
            </div>
          )}
          <div className="fa-op__side is-next">
            <span className="fa-op__side-label">
              {pending ? (edit ? '提议 · 你改过' : '提议 · 可以直接修改') : '提议'}
              {edit && pending && (
                <button type="button" className="fa-link" onClick={() => ctrl.setReviewEdit(proposal.id,op.id, null)}>
                  还原模型原文
                </button>
              )}
            </span>
            {pending ? (
              <BlockFields
                block={shown}
                ctx={ctx}
                disabled={ctx.busy}
                onChange={(b) => ctrl.setReviewEdit(proposal.id,op.id, sameBlock(b, op.block) ? null : b)}
              />
            ) : (
              <BlockReadOnly block={op.block} ctx={ctx} />
            )}
          </div>
        </div>
      )}

      <div className="fa-op__foot">
        <SourceChips sources={op.sources} ctx={ctx} />
        {pending && (
          <span className="fa-op__actions">
            <button type="button" className="fa-btn fa-btn--sm fa-btn--ghost" disabled={ctx.busy} onClick={() => void ctrl.decide(proposal.id, [op.id], 'reject')}>
              拒绝
            </button>
            <button type="button" className="fa-btn fa-btn--sm fa-op__accept" disabled={ctx.busy || (!target && op.action === 'replace')} onClick={() => void ctrl.decide(proposal.id, [op.id], 'accept')}>
              <Icon name="check" size={13} />
              {edit ? '按我改的接受' : '接受'}
            </button>
          </span>
        )}
      </div>
    </li>
  );
}

/* ───────────────────────── 一份提案 ───────────────────────── */

function ProposalCard({ proposal, state, ctrl, ctx, onJumpBlock, fresh }: { proposal: PageProposal; state: PageState; ctrl: PageController; ctx: BlockCtx; onJumpBlock: (id: string) => void; fresh: boolean }) {
  const [sel, setSel] = useState<Set<string>>(() => new Set());
  const pendingOps = proposal.operations.filter((o) => o.status === 'pending');
  const decided = proposal.operations.length - pendingOps.length;
  const chosen = pendingOps.filter((o) => sel.has(o.id)).map((o) => o.id);
  const allOn = pendingOps.length > 0 && chosen.length === pendingOps.length;

  const run = async (decision: 'accept' | 'reject') => {
    if (!chosen.length) return;
    const ok = await ctrl.decide(proposal.id, chosen, decision);
    if (ok) setSel(new Set());
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
        <p>{proposal.summary}</p>
      </section>

      <ReceiptPanel readIds={proposal.readIds} receipts={state.view?.page.receipts ?? []} ctx={ctx} />

      <ol className="fa-prop__ops">
        {proposal.operations.map((op) => (
          <OpRow
            key={op.id}
            proposal={proposal}
            op={op}
            state={state}
            ctrl={ctrl}
            ctx={ctx}
            selected={sel.has(op.id)}
            onSelect={(on) =>
              setSel((s) => {
                const n = new Set(s);
                if (on) n.add(op.id);
                else n.delete(op.id);
                return n;
              })
            }
            onJumpBlock={onJumpBlock}
          />
        ))}
      </ol>

      {pendingOps.length > 1 && (
        <footer className="fa-prop__foot">
          <label className="fa-check">
            <input type="checkbox" checked={allOn} onChange={(e) => setSel(e.target.checked ? new Set(pendingOps.map((o) => o.id)) : new Set())} />
            <span>全选待定</span>
          </label>
          <span className="fa-spacer" />
          <button type="button" className="fa-btn fa-btn--sm fa-btn--ghost" disabled={ctx.busy || !chosen.length} onClick={() => void run('reject')}>
            拒绝所选 {chosen.length || ''}
          </button>
          <button type="button" className="fa-btn fa-btn--sm fa-op__accept" disabled={ctx.busy || !chosen.length} onClick={() => void run('accept')}>
            <Icon name="check" size={13} />
            接受所选 {chosen.length || ''}
          </button>
        </footer>
      )}
      {pendingOps.length > 1 && <p className="fa-help fa-prop__atomic">一次接受的几处改动要么全部生效，要么都不生效；推断类改动建议逐条看。</p>}
    </article>
  );
}

/* ───────────────────────── 提案区 ───────────────────────── */

export function ProposalTray({ state, ctrl, ctx, onJumpBlock }: { state: PageState; ctrl: PageController; ctx: BlockCtx; onJumpBlock: (id: string) => void }) {
  const [showDone, setShowDone] = useState(false);
  const proposals = useMemo(() => (state.view?.page.proposals ?? []).slice().sort((a, b) => (a.at < b.at ? 1 : -1)), [state.view]);
  const open = proposals.filter((p) => p.operations.some((o) => o.status === 'pending'));
  const done = proposals.filter((p) => !p.operations.some((o) => o.status === 'pending'));
  const known = state.awaiting?.known ?? [];
  if (!proposals.length) return null;
  return (
    <section className="fa-props-tray" aria-label="AI 整理提案">
      {open.map((p) => (
        <ProposalCard key={p.id} proposal={p} state={state} ctrl={ctrl} ctx={ctx} onJumpBlock={onJumpBlock} fresh={!!state.awaiting && !known.includes(p.id)} />
      ))}
      {done.length > 0 && (
        <div className="fa-props-tray__done">
          <button type="button" className="fa-link" aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
            {showDone ? '收起已处理的提案' : `已处理的提案 ${done.length}`}
          </button>
          {showDone &&
            done.map((p) => <ProposalCard key={p.id} proposal={p} state={state} ctrl={ctrl} ctx={ctx} onJumpBlock={onJumpBlock} fresh={false} />)}
        </div>
      )}
    </section>
  );
}
