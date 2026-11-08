import { useEffect, useMemo, useState } from 'react';
import type { PageMaterial, PageSnapshot } from '../shared/page';
import { Icon } from './icons';
import { BlockReadOnly } from './PageBlocks';
import type { BlockCtx } from './PageBlocks';
import { MaterialPreview } from './MaterialView';
import { ReceiptPanel } from './ProposalReview';
import type { PageState } from './pageStore';
import { BLOCK_TYPE_LABEL, blockLabel, hhmm } from './pageModel';
import { friendlyDay, localDateOfIso } from './forest-model';

export type SourceTarget = { kind: 'snapshot' | 'material'; id: string; nonce: number };

type Item = { kind: 'snapshot'; at: string; snap: PageSnapshot } | { kind: 'material'; at: string; mat: PageMaterial };

/**
 * 原样一面：按放入先后排列的原始快照与素材原件。这里只读——成页怎么改都不会影响这里。
 * 每一条都能看到“被谁引用”，点一下回到成页里的那一块。
 */
export function OriginalView({
  state,
  ctx,
  target,
  onJumpBlock,
}: {
  state: PageState;
  ctx: BlockCtx;
  target: SourceTarget | null;
  onJumpBlock: (id: string) => void;
}) {
  const page = state.view?.page;
  const [allRevisions, setAllRevisions] = useState(false);

  const firstVersion = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of page?.snapshots ?? []) m.set(s.blockId, Math.min(m.get(s.blockId) ?? Infinity, s.version));
    return m;
  }, [page]);

  // 从成页跳来、目标是后来的修订时，自动展开全部修订
  useEffect(() => {
    if (target?.kind !== 'snapshot' || !page) return;
    const s = page.snapshots.find((x) => x.id === target.id);
    if (s && firstVersion.get(s.blockId) !== s.version) setAllRevisions(true);
  }, [target, page, firstVersion]);

  useEffect(() => {
    if (!target) return;
    const el = document.getElementById(`xp-${target.kind === 'snapshot' ? 'snap' : 'mat'}-${target.id}`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [target, allRevisions]);

  if (!page) return null;

  const items: Item[] = [
    ...page.snapshots.filter((s) => allRevisions || firstVersion.get(s.blockId) === s.version).map((snap) => ({ kind: 'snapshot' as const, at: snap.at, snap })),
    ...page.materials.map((mat) => ({ kind: 'material' as const, at: mat.addedAt, mat })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  const days: { day: string; items: Item[] }[] = [];
  for (const it of items) {
    const d = localDateOfIso(it.at);
    const last = days[days.length - 1];
    if (last && last.day === d) last.items.push(it);
    else days.push({ day: d, items: [it] });
  }

  const liveIds = new Set(state.local.blocks.map((b) => b.id));
  const metaBlocks = page.blocks;
  const citedBy = (kind: 'snapshot' | 'material', id: string) => {
    const blocks = metaBlocks.filter((b) => b.sources.some((s) => (kind === 'snapshot' ? s.snapshotId === id : s.materialId === id)));
    const media = kind === 'material' ? state.local.blocks.filter((b) => b.type === 'media' && b.materialId === id) : [];
    const ops = page.proposals.flatMap((p) => p.operations.filter((o) => o.status === 'pending' && o.sources.some((s) => (kind === 'snapshot' ? s.snapshotId === id : s.materialId === id))));
    const ids = new Set<string>();
    const out: { id: string; label: string }[] = [];
    for (const b of [...blocks, ...media]) {
      if (ids.has(b.id) || !liveIds.has(b.id)) continue;
      ids.add(b.id);
      const live = state.local.blocks.find((x) => x.id === b.id) ?? b;
      out.push({ id: b.id, label: blockLabel(live, page.materials) });
    }
    return { out, pendingOps: ops.length };
  };

  const snapshotRevisions = page.snapshots.length - firstVersion.size;

  return (
    <section className="fa-orig" aria-label="原样">
      <header className="fa-orig__intro">
        <p>
          <Icon name="lock" size={13} /> 按放入先后排列的原始快照与素材原件，<strong>不可修改</strong>。成页怎么编辑，这里都保持原样，可以随时对照。
        </p>
        {snapshotRevisions > 0 && (
          <div className="fa-xseg fa-xseg--mini" role="group" aria-label="显示范围">
            <button type="button" className={`fa-xseg__btn${!allRevisions ? ' is-on' : ''}`} aria-pressed={!allRevisions} onClick={() => setAllRevisions(false)}>
              首次输入
            </button>
            <button type="button" className={`fa-xseg__btn${allRevisions ? ' is-on' : ''}`} aria-pressed={allRevisions} onClick={() => setAllRevisions(true)}>
              含修订 {page.snapshots.length}
            </button>
          </div>
        )}
      </header>

      {items.length === 0 ? (
        <p className="fa-help fa-orig__empty">还没有原样记录。第一次保存后，每一块输入都会留下一份不可修改的快照；放入的文件按原始字节保存在这里。</p>
      ) : (
        <ol className="fa-orig__days">
          {days.map(({ day, items: list }) => (
            <li key={day} className="fa-orig__day">
              <h4 className="fa-orig__dayh">{friendlyDay(day)}</h4>
              <ol className="fa-orig__list">
                {list.map((it) => {
                  const key = it.kind === 'snapshot' ? it.snap.id : it.mat.id;
                  const flash = target?.id === key;
                  const refs = citedBy(it.kind, key);
                  return (
                    <li
                      key={`${it.kind}-${key}`}
                      id={`xp-${it.kind === 'snapshot' ? 'snap' : 'mat'}-${key}`}
                      className={`fa-orig__item is-${it.kind}${flash ? ' is-flash' : ''}`}
                    >
                      <time className="fa-orig__time is-mono" dateTime={it.at}>
                        {hhmm(it.at)}
                      </time>
                      <div className="fa-orig__card">
                        {it.kind === 'snapshot' ? (
                          <>
                            <p className="fa-orig__meta">
                              {BLOCK_TYPE_LABEL[it.snap.block.type]}
                              <span>v{it.snap.version}</span>
                              {firstVersion.get(it.snap.blockId) === it.snap.version ? <span>首次输入</span> : <span>修订</span>}
                              {!liveIds.has(it.snap.blockId) && <span className="fa-muted">这块已不在成页里</span>}
                            </p>
                            <BlockReadOnly block={it.snap.block} ctx={ctx} />
                          </>
                        ) : (
                          <>
                            <p className="fa-orig__meta">
                              原件
                              {it.mat.preview && (
                                <span title="交给模型和缩略显示时用的是这张预览图，不是原件">
                                  预览图 {it.mat.preview.width}×{it.mat.preview.height}
                                </span>
                              )}
                            </p>
                            <MaterialPreview api={ctx.api} pageId={ctx.pageId} material={it.mat} compact />
                          </>
                        )}
                        {(refs.out.length > 0 || refs.pendingOps > 0) && (
                          <p className="fa-orig__refs">
                            <span className="fa-muted">被引用：</span>
                            {refs.out.map((r) => (
                              <button key={r.id} type="button" className="fa-src" onClick={() => onJumpBlock(r.id)}>
                                <Icon name="back" size={11} />
                                {r.label}
                              </button>
                            ))}
                            {refs.pendingOps > 0 && <span className="fa-chip">待定提案 {refs.pendingOps} 处</span>}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ol>
      )}

      {page.receipts.length > 0 && (
        <div className="fa-orig__receipts">
          <h4 className="fa-orig__dayh">系统读取记录</h4>
          <ReceiptPanel readIds={page.receipts.map((r) => r.id)} receipts={page.receipts} ctx={ctx} />
        </div>
      )}
    </section>
  );
}
