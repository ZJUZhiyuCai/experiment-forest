import { useEffect, useId, useRef, useState } from 'react';
import type { ForestEntity } from '../shared/model';
import { getRunWorkflow, needsHumanReview, runProgress } from '../shared/workflow';
import type { RunStep, RunWorkflow, SopStep } from '../shared/workflow';
import { Icon } from './icons';
import { InlineConfirm, Notice, Paragraphs, Spinner } from './bits';
import * as memory from './draftMemory';
import type { StepDraft } from './draftMemory';
import { HOST_AI_SOURCE, REVIEW_REVIEWED, formatDateTime, relativeTime, statusOption } from './forest-model';
import {
  OBSERVATION_LIMIT,
  checkStep,
  editStep,
  loadStepLatest,
  rebaseAndSaveStep,
  rebaseStep,
  saveStep,
  stepConflictFrom,
  syncStepBases,
  validateStep,
} from './runActions';
import type { ActionCtx } from './runActions';

const STATUS_LABEL: Record<RunStep['status'], string> = { pending: '待做', done: '完成', skipped: '跳过' };

/* ───────────────────────── 执行清单 ───────────────────────── */

/**
 * 从 SOP 创建的实验：逐步记录 完成 / 待做 / 跳过 与观察。
 * - 每一步单独通过 updateRunStep 保存，带修订冲突保护；输入在会话内存中，切换页面、轮询刷新都不会丢。
 * - 步骤全部完成也不会自动把实验设为完成，更不会生成结论。
 * - 记录不是“草稿”状态（已完成 / 已归档）时步骤只读，需先修改记录状态。
 */
export function RunChecklist({
  entity,
  sessKey,
  ctx,
  focusNext,
  onFocused,
}: {
  entity: ForestEntity;
  sessKey: string;
  ctx: ActionCtx;
  /** 从“今天”工作台进入：把下一步滚到可见处并聚焦 */
  focusNext?: boolean;
  onFocused?: () => void;
}) {
  const run = getRunWorkflow(entity) as RunWorkflow;
  const uid = useId();
  const allSteps = memory.useSessionSteps(sessKey);
  const progress = runProgress(entity);
  const editable = entity.status === 'draft';
  const reviewRequired = needsHumanReview(entity);
  const listRef = useRef<HTMLOListElement>(null);

  const draftOf = (stepId: string): StepDraft | undefined => allSteps[memory.stepKey(entity.id, stepId)];
  const nextId = progress.nextStep?.id ?? null;
  const [open, setOpen] = useState<Set<string>>(() => new Set(nextId ? [nextId] : []));

  // 轮询带来新修订：这一步本身未被改动的输入，基线自动前移，避免无谓冲突
  useEffect(() => {
    syncStepBases(sessKey, entity);
  }, [sessKey, entity]);

  const focusStep = (stepId: string) => {
    setOpen((o) => new Set(o).add(stepId));
    window.setTimeout(() => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-step="${stepId}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el?.querySelector<HTMLElement>('input[type="radio"]:checked, textarea')?.focus({ preventScroll: true });
    }, 30);
  };

  useEffect(() => {
    if (!focusNext) return;
    if (nextId) focusStep(nextId);
    onFocused?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNext]);

  const unsaved = run.source.steps.filter((s) => {
    const d = draftOf(s.id);
    return d && memory.stepHasUnsaved(d);
  }).length;

  const total = progress.total;
  const pct = (n: number) => (total ? `${(n / total) * 100}%` : '0%');

  return (
    <section className="fa-run" aria-labelledby={`${uid}-h`}>
      <header className="fa-run__head">
        <h3 id={`${uid}-h`} className="fa-h3">
          <Icon name="list" size={14} />
          执行清单
        </h3>
        <span className="fa-run__count">
          {total ? (
            <>
              <b>{progress.done}</b>/{total} 完成
              {progress.skipped ? ` · ${progress.skipped} 跳过` : ''}
              {progress.pending ? ` · ${progress.pending} 待做` : ''}
            </>
          ) : (
            '无结构化步骤'
          )}
        </span>
      </header>

      {total > 0 && (
        <div
          className="fa-run__bar"
          role="img"
          aria-label={`进度：共 ${total} 步，完成 ${progress.done}，跳过 ${progress.skipped}，待做 ${progress.pending}`}
        >
          <span className="fa-run__bar-done" style={{ width: pct(progress.done) }} />
          <span className="fa-run__bar-skip" style={{ width: pct(progress.skipped) }} />
        </div>
      )}

      {!editable && (
        <Notice tone="info" title={entity.status === 'archived' ? '记录已归档，步骤只读' : '记录已完成，步骤只读'}>
          <p>如需补记或修改步骤，请先把记录状态改回“草稿”（在上方状态处修改）。步骤的记录会完整保留。</p>
        </Notice>
      )}

      {editable && reviewRequired && (
        <Notice tone="ai" title="先核对 AI 草稿，再保存执行步骤">
          <p>请在上方 AI 草稿提示中逐项核对，并点击“记录为已核对”。核对前不能保存执行步骤；已有输入会保留。</p>
        </Notice>
      )}

      {editable && !reviewRequired && total > 0 && (
        progress.nextStep ? (
          <div className="fa-run__next">
            <span className="fa-run__next-label">下一步</span>
            <span className="fa-run__next-title">
              第 {run.source.steps.findIndex((s) => s.id === progress.nextStep?.id) + 1} 步 · {progress.nextStep.title}
            </span>
            <button type="button" className="fa-btn fa-btn--sm" onClick={() => focusStep(progress.nextStep?.id as string)}>
              <Icon name="play" size={13} />
              去记录
            </button>
          </div>
        ) : (
          <div className="fa-run__next is-clear">
            <Icon name="check" size={14} />
            <span>所有步骤都已记录。实验状态不会自动改变——确认结果后，再在上方把记录设为“已完成”。</span>
          </div>
        )
      )}

      {unsaved > 0 && (
        <p className="fa-run__unsaved" role="status">
          <span className="fa-unsaved-dot__dot" aria-hidden="true" />
          {unsaved} 步有未保存的输入（每一步单独保存）
        </p>
      )}

      {total > 0 && (
        <ol ref={listRef} className="fa-run__steps">
          {run.source.steps.map((s, i) => {
            const saved = run.steps[i] as RunStep;
            const d = draftOf(s.id);
            return (
              <StepItem
                key={s.id}
                index={i}
                step={s}
                saved={saved}
                draft={d}
                entity={entity}
                sessKey={sessKey}
                ctx={ctx}
                editable={editable}
                reviewRequired={reviewRequired}
                isNext={s.id === nextId}
                open={open.has(s.id) || !!(d && memory.stepHasUnsaved(d))}
                onToggle={() =>
                  setOpen((o) => {
                    const n = new Set(o);
                    if (n.has(s.id)) n.delete(s.id);
                    else n.add(s.id);
                    return n;
                  })
                }
              />
            );
          })}
        </ol>
      )}
    </section>
  );
}

/* ───────────────────────── 单个步骤 ───────────────────────── */

function StepItem({
  index,
  step,
  saved,
  draft,
  entity,
  sessKey,
  ctx,
  editable,
  reviewRequired,
  isNext,
  open,
  onToggle,
}: {
  index: number;
  step: SopStep;
  saved: RunStep;
  draft: StepDraft | undefined;
  entity: ForestEntity;
  sessKey: string;
  ctx: ActionCtx;
  editable: boolean;
  reviewRequired: boolean;
  isNext: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const uid = useId();
  const key = memory.stepKey(entity.id, step.id);
  const status = draft?.status ?? saved.status;
  const observation = draft?.observation ?? saved.observation;
  const hasUnsaved = !!draft && memory.stepHasUnsaved(draft);
  const saving = draft?.phase === 'saving';
  const invalid = draft ? validateStep(draft) : null;
  // 别处修改了这一步（轮询看到），而本地输入仍基于旧值
  const remoteChanged =
    !!draft && (draft.phase === 'editing' || draft.phase === 'error') && (saved.status !== draft.baseStatus || saved.observation !== draft.baseObservation);
  const busyOrLocked = !editable || saving;
  const set = (patch: Partial<Pick<StepDraft, 'status' | 'observation'>>) => editStep(sessKey, entity, step.id, patch);
  const save = () => {
    if (!busyOrLocked && !reviewRequired && hasUnsaved && !invalid) void saveStep(ctx, sessKey, key);
  };

  return (
    <li className={`fa-runstep is-${saved.status}${open ? ' is-open' : ''}${isNext && editable ? ' is-next' : ''}${hasUnsaved ? ' is-dirty' : ''}`} data-step={step.id}>
      <button type="button" className="fa-runstep__head" aria-expanded={open} aria-controls={`${uid}-body`} onClick={onToggle}>
        <span className={`fa-runstep__mark is-${saved.status}`} aria-hidden="true">
          {saved.status === 'done' ? <Icon name="check" size={13} /> : saved.status === 'skipped' ? <Icon name="skip" size={11} /> : index + 1}
        </span>
        <span className="fa-runstep__title">
          <span className="fa-sr">第 {index + 1} 步：</span>
          {step.title}
          {step.required ? <span className="fa-req-tag">必需</span> : <span className="fa-opt-tag">可选</span>}
        </span>
        <span className="fa-runstep__state">
          {hasUnsaved && (
            <span className="fa-unsaved-dot" title="有未保存的输入">
              <span className="fa-unsaved-dot__dot" aria-hidden="true" />
              未保存
            </span>
          )}
          <span className={`fa-runstep__label is-${saved.status}`}>{STATUS_LABEL[saved.status]}</span>
        </span>
      </button>

      {open && (
        <div id={`${uid}-body`} className="fa-runstep__body">
          {step.instruction.trim() ? <p className="fa-runstep__inst">{step.instruction}</p> : <p className="fa-runstep__inst is-empty">（这一步没有说明）</p>}

          {draft?.phase === 'conflict' && (
            <Notice
              tone="danger"
              live
              title="未保存：记录已在别处更新"
              actions={
                draft.latest ? (
                  <>
                    <button
                      type="button"
                      className="fa-btn fa-btn--primary fa-btn--sm"
                      disabled={!editable || reviewRequired || !!invalid}
                      onClick={() => void rebaseAndSaveStep(ctx, sessKey, key)}
                    >
                      按最新修订保存我的输入
                    </button>
                    <button type="button" className="fa-btn fa-btn--sm" onClick={() => rebaseStep(sessKey, key)}>
                      以最新为基准继续编辑
                    </button>
                    <InlineConfirm label="放弃我的输入" confirmLabel="确认放弃" question="放弃这一步的输入，采用最新值？" onConfirm={() => memory.dropStep(sessKey, key)} />
                  </>
                ) : (
                  <button type="button" className="fa-btn fa-btn--primary fa-btn--sm" onClick={() => void loadStepLatest(ctx, sessKey, key)}>
                    <Icon name="refresh" />
                    载入最新对照
                  </button>
                )
              }
            >
              <p>
                你基于 r{draft.baseRevision} 输入{draft.latest ? `，服务端已是 r${draft.latest.revision}` : ''}，没有覆盖任何内容。
                {draft.message ? `（${draft.message}）` : ''}
              </p>
              {draft.latest && (
                <div className="fa-stepcmp">
                  <div>
                    <span className="fa-stepcmp__h">最新 r{draft.latest.revision}</span>
                    <b>{STATUS_LABEL[draft.latest.status]}</b>
                    <span className="fa-stepcmp__obs">{draft.latest.observation || '（无观察）'}</span>
                    {draft.latest.updatedAt && <span className="fa-help">{formatDateTime(draft.latest.updatedAt)}</span>}
                  </div>
                  <div className="is-mine">
                    <span className="fa-stepcmp__h">我的输入</span>
                    <b>{STATUS_LABEL[draft.status]}</b>
                    <span className="fa-stepcmp__obs">{draft.observation || '（无观察）'}</span>
                  </div>
                </div>
              )}
            </Notice>
          )}

          {draft?.phase === 'uncertain' && (
            <Notice
              tone="warn"
              live
              title="无法确认这一步是否已保存"
              actions={
                <button type="button" className="fa-btn fa-btn--primary fa-btn--sm" onClick={() => void checkStep(ctx, sessKey, key)}>
                  <Icon name="refresh" />
                  刷新并核对
                </button>
              }
            >
              <p>请求没有得到明确结果（{draft.message || '网络或传输中断'}）。请先核对；输入已保留。</p>
            </Notice>
          )}

          {draft?.phase === 'error' && draft.message && (
            <Notice tone="danger" live title="这一步没有保存">
              <p>{draft.message}</p>
            </Notice>
          )}

          {remoteChanged && (
            <Notice
              tone="warn"
              title="这一步已在别处更新"
              actions={
                <button type="button" className="fa-btn fa-btn--sm" onClick={() => stepConflictFrom(sessKey, key, entity)}>
                  对照最新值
                </button>
              }
            >
              <p>
                服务端现在是“{STATUS_LABEL[saved.status]}”{saved.observation ? `：${saved.observation.slice(0, 60)}${saved.observation.length > 60 ? '…' : ''}` : ''}。你的输入仍基于旧值，直接保存会提示冲突。
              </p>
            </Notice>
          )}

          {draft?.phase === 'editing' && draft.message && !remoteChanged && (
            <Notice tone="info" live>
              {draft.message}
            </Notice>
          )}

          {!editable && hasUnsaved && (
            <Notice tone="warn" title="记录已不是草稿状态，这一步的输入无法保存">
              <p>你的输入仍保留在下方。把记录状态改回“草稿”后可以保存，或放弃输入。</p>
            </Notice>
          )}

          <fieldset className="fa-runstep__form" disabled={busyOrLocked}>
            <legend className="fa-sr">第 {index + 1} 步的执行状态</legend>
            <div className="fa-seg fa-seg--status" role="radiogroup" aria-label="执行状态">
              {(['pending', 'done', 'skipped'] as const).map((v) => (
                <label key={v} className={`fa-seg__item is-${v}${status === v ? ' is-on' : ''}`}>
                  <input type="radio" name={`${uid}-st`} checked={status === v} onChange={() => set({ status: v })} />
                  <Icon name={v === 'done' ? 'check' : v === 'skipped' ? 'skip' : 'ring'} size={13} />
                  <span>{STATUS_LABEL[v]}</span>
                </label>
              ))}
            </div>
            <label className="fa-label fa-runstep__obs-label" htmlFor={`${uid}-obs`}>
              {status === 'skipped' ? (
                <>
                  跳过原因<span className="fa-req" aria-hidden="true"> *</span>
                </>
              ) : (
                '观察记录'
              )}
            </label>
            <textarea
              id={`${uid}-obs`}
              className="fa-input fa-runstep__obs"
              rows={Math.min(10, Math.max(3, observation.split('\n').length + 1))}
              value={observation}
              maxLength={OBSERVATION_LIMIT + 200}
              placeholder={status === 'skipped' ? '为什么跳过这一步（必填）' : '实际操作、参数、现象……如实记录，不必填写结论'}
              aria-invalid={!!invalid}
              aria-describedby={`${uid}-obs-help`}
              onChange={(e) => set({ observation: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  save();
                }
              }}
            />
            <span id={`${uid}-obs-help`} className={`fa-help${invalid && hasUnsaved ? ' fa-help--error' : ''}`}>
              {invalid && hasUnsaved
                ? invalid
                : observation.length > OBSERVATION_LIMIT * 0.8
                  ? `${observation.length}/${OBSERVATION_LIMIT}`
                  : saved.updatedAt
                    ? `上次记录 ${relativeTime(saved.updatedAt)} · ${formatDateTime(saved.updatedAt)}`
                    : '尚未记录 · Ctrl/⌘ + Enter 保存这一步'}
            </span>
          </fieldset>

          {(hasUnsaved || saving) && (
            <div className="fa-runstep__actions">
              <button type="button" className="fa-btn fa-btn--primary fa-btn--sm" disabled={busyOrLocked || reviewRequired || !!invalid || draft?.phase === 'conflict'} onClick={save}>
                {saving ? <Spinner label="正在保存…" /> : draft?.phase === 'uncertain' ? '仍然再次保存' : (<><Icon name="check" size={13} />保存这一步</>)}
              </button>
              {!saving && draft?.phase !== 'conflict' && (
                <InlineConfirm label="撤销输入" confirmLabel="确认撤销" question="撤销这一步未保存的输入？" onConfirm={() => memory.dropStep(sessKey, key)} />
              )}
              <span className="fa-help">只保存这一步，不会改变记录状态</span>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

/* ───────────────────────── 冻结的 SOP 来源 ───────────────────────── */

export function RunSourceCard({ run, byId, onOpen }: { run: RunWorkflow; byId: Map<string, ForestEntity>; onOpen: (id: string) => void }) {
  const src = run.source;
  const current = byId.get(src.sopId) ?? null;
  const p = src.provenance;
  const aiUnreviewed = !!p && p.source === HOST_AI_SOURCE && p.reviewStatus !== REVIEW_REVIEWED;
  const aiReviewed = !!p && p.source === HOST_AI_SOURCE && p.reviewStatus === REVIEW_REVIEWED;
  const st = statusOption('sop', src.sopStatus);
  const notApproved = src.sopStatus !== 'approved';

  return (
    <section className="fa-source" aria-label="冻结的 SOP 来源">
      <div className="fa-source__head">
        <span className="fa-source__icon" aria-hidden="true">
          <Icon name="lock" size={14} />
        </span>
        <div className="fa-source__main">
          <p className="fa-source__eyebrow">按此版本执行 · 已冻结</p>
          <p className="fa-source__title">
            {src.sopTitle}
            <span className="fa-source__rev">r{src.sopRevision}</span>
            {src.sopVersion ? <span className="fa-source__ver">v{src.sopVersion.replace(/^v/i, '')}</span> : null}
          </p>
          <p className="fa-source__meta">
            创建时状态：<span className={`fa-status fa-tone-${st.tone}`}><span className="fa-status__dot" aria-hidden="true" />{st.label}</span>
            {' · '}
            {src.steps.length ? `${src.steps.length} 个步骤` : '无结构化步骤'}
            {' · '}
            正文 {src.sopContent.length} 字
          </p>
        </div>
      </div>

      {(notApproved || aiUnreviewed || aiReviewed) && (
        <ul className="fa-source__flags">
          {notApproved && (
            <li className="is-warn">
              <Icon name="alert" size={13} />
              创建时这份 SOP 尚未批准（{st.label}），步骤未经审批确认。
            </li>
          )}
          {aiUnreviewed && (
            <li className="is-ai">
              <Icon name="spark" size={13} />
              创建时这份 SOP 是 AI 草稿，未经人工核对。
            </li>
          )}
          {aiReviewed && (
            <li className="is-quiet">
              <Icon name="spark" size={13} />
              来源为 AI 草稿，创建时已人工核对。
            </li>
          )}
        </ul>
      )}

      {!src.steps.length && (
        <p className="fa-source__note">
          这份 SOP 当时没有结构化步骤，因此只冻结了正文，没有执行清单；界面不会从正文猜测步骤。可以在正文中按实际情况记录。
        </p>
      )}

      <div className="fa-source__current">
        {!current ? (
          <span className="fa-muted">当前 SOP 条目未找到（{src.sopId}）。冻结的快照不受影响。</span>
        ) : (
          <>
            <span>
              {current.revision === src.sopRevision ? '当前 SOP 与冻结版本相同修订。' : `当前 SOP 已更新到 r${current.revision}，本实验仍按冻结的 r${src.sopRevision}。`}
              {current.status === 'archived' ? ' 当前 SOP 已归档。' : ''}
            </span>
            <button type="button" className="fa-link" onClick={() => onOpen(current.id)}>
              查看当前 SOP →
            </button>
          </>
        )}
      </div>

      <details className="fa-source__body">
        <summary>冻结的 SOP 正文{src.steps.length ? '与步骤' : ''}</summary>
        {src.steps.length > 0 && (
          <ol className="fa-steps-view is-compact">
            {src.steps.map((s, i) => (
              <li key={s.id} className="fa-steps-view__item">
                <span className="fa-steps-view__num" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="fa-steps-view__main">
                  <p className="fa-steps-view__title">
                    {s.title}
                    {s.required ? <span className="fa-req-tag">必需</span> : <span className="fa-opt-tag">可选</span>}
                  </p>
                  {s.instruction.trim() && <p className="fa-steps-view__inst">{s.instruction}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
        <div className="fa-source__text">
          <Paragraphs text={src.sopContent} limit={2400} />
        </div>
      </details>
    </section>
  );
}
