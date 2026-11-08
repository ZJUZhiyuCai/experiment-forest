import { useEffect, useId, useMemo, useRef } from 'react';
import type { ForestEntity } from '../shared/model';
import { getRunWorkflow, getSopWorkflow, isCalendarDay, needsHumanReview, runProgress } from '../shared/workflow';
import { Icon } from './icons';
import { InlineConfirm, Notice, Spinner, StatusPill } from './bits';
import { SopStepsView } from './SopSteps';
import * as memory from './draftMemory';
import type { RunRequestDraft } from './draftMemory';
import { friendlyDay, isArchived, localDate, statusOption } from './forest-model';
import { checkRun, runParams, sameRunParams, submitRun, validateRun } from './runActions';
import type { ActionCtx } from './runActions';

/**
 * SOP 详情中的执行入口：
 * - 只读展示结构化步骤
 * - “创建实验草稿”：标题、课题、可选计划日期 → createRun；服务端冻结 SOP 修订、正文、步骤与来源
 * - 由这条 SOP 创建的实验（冻结修订 vs 当前修订）
 */
export function SopRunPanel({
  sop,
  entities,
  byId,
  sessKey,
  ctx,
  hasDraft,
  onOpen,
  onEdit,
}: {
  sop: ForestEntity;
  entities: ForestEntity[];
  byId: Map<string, ForestEntity>;
  sessKey: string;
  ctx: ActionCtx;
  /** 这条 SOP 有未保存的编辑草稿 */
  hasDraft: boolean;
  onOpen: (id: string) => void;
  onEdit: (e: ForestEntity) => void;
}) {
  const uid = useId();
  const wf = getSopWorkflow(sop);
  const malformed = !wf && Object.hasOwn(sop.data, 'forestWorkflow');
  const steps = wf?.steps ?? [];
  const runs = memory.useSessionRuns(sessKey);
  const req = runs[sop.id];
  const archivedSop = isArchived(sop);

  const created = useMemo(
    () =>
      entities
        .filter((e) => getRunWorkflow(e)?.source.sopId === sop.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)),
    [entities, sop.id],
  );

  const startForm = () => {
    const proj = sop.projectId ? byId.get(sop.projectId) : undefined;
    const d: RunRequestDraft = {
      key: sop.id,
      sopId: sop.id,
      title: `${sop.title.slice(0, 280)} · ${localDate()}`,
      projectId: proj && !isArchived(proj) ? proj.id : null,
      plannedDate: '',
      attempt: null,
      phase: 'editing',
    };
    memory.putRun(sessKey, d);
  };

  return (
    <>
      <section className="fa-section fa-sop-steps" aria-labelledby={`${uid}-steps`}>
        <h3 id={`${uid}-steps`} className="fa-h3">
          <Icon name="list" size={14} />
          结构化步骤
          {steps.length > 0 && <span className="fa-h3__count">{steps.length}</span>}
        </h3>
        {malformed ? (
          <p className="fa-help">这条 SOP 有一份无法识别的结构化数据，界面原样保留，不展示也不编辑。</p>
        ) : steps.length ? (
          <SopStepsView steps={steps} />
        ) : (
          <p className="fa-help">
            还没有结构化步骤。可以
            <button type="button" className="fa-link" onClick={() => onEdit(sop)}>
              在编辑中添加
            </button>
            ；没有步骤也能创建实验，只会冻结正文。
          </p>
        )}
      </section>

      <section className="fa-section fa-startrun" aria-labelledby={`${uid}-run`}>
        <h3 id={`${uid}-run`} className="fa-h3">
          <Icon name="play" size={14} />
          按这条 SOP 做实验
        </h3>
        {req ? (
          <StartRunForm sop={sop} req={req} entities={entities} byId={byId} sessKey={sessKey} ctx={ctx} hasDraft={hasDraft} steps={steps.length} />
        ) : (
          <div className="fa-startrun__cta">
            <p className="fa-help">
              创建一条“草稿”状态的实验记录：冻结当前已保存的 r{sop.revision}
              {steps.length ? `（${steps.length} 步）` : '（仅正文）'}
              。之后修改 SOP 不会改变已创建实验的快照。
            </p>
            <button type="button" className="fa-btn fa-btn--primary fa-btn--sm" onClick={startForm} disabled={archivedSop}>
              <Icon name="plus" />
              创建实验草稿
            </button>
            {archivedSop && <p className="fa-help">已归档的 SOP 不能用来创建新实验。</p>}
          </div>
        )}

        {created.length > 0 && (
          <div className="fa-runs-from">
            <p className="fa-runs-from__h">由此创建的实验 · {created.length}</p>
            <ul className="fa-mini-list">
              {created.map((e) => {
                const run = getRunWorkflow(e);
                const pr = runProgress(e);
                const older = run && run.source.sopRevision !== sop.revision;
                return (
                  <li key={e.id}>
                    <button type="button" className="fa-mini" onClick={() => onOpen(e.id)}>
                      <span className="fa-mini__icon fa-kind-record">
                        <Icon name="record" size={14} />
                      </span>
                      <span className="fa-mini__title">{e.title}</span>
                      <span className={`fa-mini__dir${older ? ' is-older' : ''}`} title={older ? `按旧版 r${run?.source.sopRevision} 执行；当前 SOP 是 r${sop.revision}` : '与当前 SOP 同一修订'}>
                        r{run?.source.sopRevision}
                        {older ? ' · 旧版' : ''}
                      </span>
                      {pr.total > 0 && (
                        <span className="fa-mini__dir">
                          {pr.done + pr.skipped}/{pr.total}
                        </span>
                      )}
                      <StatusPill kind={e.kind} status={e.status} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}

function StartRunForm({
  sop,
  req,
  entities,
  byId,
  sessKey,
  ctx,
  hasDraft,
  steps,
}: {
  sop: ForestEntity;
  req: RunRequestDraft;
  entities: ForestEntity[];
  byId: Map<string, ForestEntity>;
  sessKey: string;
  ctx: ActionCtx;
  hasDraft: boolean;
  steps: number;
}) {
  const uid = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const creating = req.phase === 'creating';
  const archivedProjects = useMemo(() => new Set(entities.filter((e) => e.kind === 'project' && isArchived(e)).map((e) => e.id)), [entities]);
  const projects = entities.filter((e) => e.kind === 'project' && !isArchived(e)).sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
  const invalid = validateRun(req, archivedProjects);
  const changedSinceAttempt = req.phase === 'uncertain' && req.attempt !== null && !sameRunParams(req.attempt, runParams(req, sop));
  const st = statusOption('sop', sop.status);
  const today = localDate();

  useEffect(() => {
    if (req.phase === 'editing' && !req.attempt) titleRef.current?.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (patch: Partial<RunRequestDraft>) => {
    if (creating) return;
    // 结果不确定时继续修改：保留“不确定”状态与原请求凭据，直到用户核对或作为新动作提交
    memory.putRun(sessKey, { ...req, ...patch, phase: req.phase === 'error' ? 'editing' : req.phase, message: req.phase === 'error' ? undefined : req.message });
  };

  const warnings: { tone: 'warn' | 'ai' | 'info'; text: string }[] = [];
  if (sop.status !== 'approved') warnings.push({ tone: 'warn', text: `这份 SOP 尚未批准（${st.label}）。实验会如实记录创建时的状态。` });
  if (needsHumanReview(sop)) warnings.push({ tone: 'ai', text: '这份 SOP 是 AI 草稿，尚未人工核对。冻结的快照会保留这一来源标记。' });
  if (!steps) warnings.push({ tone: 'info', text: '没有结构化步骤：只冻结正文，生成“仅快照”的实验草稿，不会猜测或生成步骤。' });
  if (hasDraft) warnings.push({ tone: 'warn', text: `你对这条 SOP 有未保存的修改。创建会使用服务端已保存的 r${sop.revision}，不包含这些修改。` });

  return (
    <form
      className="fa-startrun__form"
      noValidate
      aria-busy={creating}
      onSubmit={(e) => {
        e.preventDefault();
        void submitRun(ctx, sessKey, sop, archivedProjects);
      }}
    >
      <p className="fa-startrun__freeze">
        <Icon name="lock" size={13} />
        {req.phase === 'uncertain' && req.attempt ? (
          <>将原样重试基于 <b>r{req.attempt.sopRevision}</b> 的已提交请求</>
        ) : (
          <>将冻结 <b>r{sop.revision}</b>
            {typeof sop.data.version === 'string' && sop.data.version ? ` · v${sop.data.version.replace(/^v/i, '')}` : ''} · {steps ? `${steps} 步` : '无步骤'} · 正文 {sop.content.length} 字
          </>
        )}
      </p>

      {warnings.length > 0 && (
        <ul className="fa-startrun__warn">
          {warnings.map((w) => (
            <li key={w.text} className={`is-${w.tone}`}>
              <Icon name={w.tone === 'ai' ? 'spark' : w.tone === 'info' ? 'file' : 'alert'} size={13} />
              {w.text}
            </li>
          ))}
        </ul>
      )}

      <fieldset className="fa-fieldset" disabled={creating}>
        <div className="fa-field">
          <div className="fa-field__top">
            <label className="fa-label" htmlFor={`${uid}-t`}>
              实验标题<span className="fa-req" aria-hidden="true"> *</span>
            </label>
          </div>
          <input
            ref={titleRef}
            id={`${uid}-t`}
            className="fa-input"
            value={req.title}
            maxLength={350}
            aria-required="true"
            onChange={(e) => set({ title: e.target.value })}
          />
        </div>
        <div className="fa-startrun__row">
          <div className="fa-field">
            <div className="fa-field__top">
              <label className="fa-label" htmlFor={`${uid}-p`}>
                课题
              </label>
            </div>
            <select id={`${uid}-p`} className="fa-input" value={req.projectId ?? ''} onChange={(e) => set({ projectId: e.target.value || null })}>
              <option value="">— 不归入课题 —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                  {p.id === sop.projectId ? '（SOP 所在课题）' : ''}
                </option>
              ))}
              {req.projectId && !projects.some((p) => p.id === req.projectId) && (
                <option value={req.projectId}>{byId.get(req.projectId)?.title ?? req.projectId}（不可用）</option>
              )}
            </select>
          </div>
          <div className="fa-field">
            <div className="fa-field__top">
              <label className="fa-label" htmlFor={`${uid}-d`}>
                计划日期
              </label>
              <span className="fa-help">可选</span>
            </div>
            <input id={`${uid}-d`} className="fa-input" type="date" value={req.plannedDate} onChange={(e) => set({ plannedDate: e.target.value })} />
          </div>
        </div>
        <p className="fa-help">
          {req.plannedDate && isCalendarDay(req.plannedDate)
            ? `安排在 ${friendlyDay(req.plannedDate)}${req.plannedDate === today ? '（今天）' : req.plannedDate < today ? '（已过）' : ''}，会出现在“今天”工作台。`
            : '不填计划日期也会出现在工作台的“未排期”。'}
          计划日期不是实验日期；实际做实验的日期在记录里另外填写。
        </p>
      </fieldset>

      {req.phase === 'error' && req.message && (
        <Notice tone="danger" live title="没有创建">
          <p>{req.message}</p>
        </Notice>
      )}
      {req.phase === 'uncertain' && (
        <Notice
          tone="warn"
          live
          title="无法确认实验草稿是否已创建"
          actions={
            <button type="button" className="fa-btn fa-btn--primary fa-btn--sm" onClick={() => void checkRun(ctx, sessKey, req.key)}>
              <Icon name="refresh" />
              核对是否已创建
            </button>
          }
        >
          <p>{req.message || '请求没有得到明确结果。'}</p>
          {req.attempt && (
            <p className="fa-help">
              本次请求编号 <code>{req.attempt.requestId.slice(0, 16)}…</code>。
              {changedSinceAttempt
                ? ' 你已修改了输入。请先核对原请求；恢复原输入可继续重试，另建则需先明确取消。'
                : ` 原样重试会沿用同一请求编号及原 SOP 修订 r${req.attempt.sopRevision}，服务端会识别重复。`}
            </p>
          )}
        </Notice>
      )}

      <div className="fa-startrun__actions">
        <button type="submit" className="fa-btn fa-btn--primary fa-btn--sm" disabled={creating || (req.phase !== 'uncertain' && !!invalid) || changedSinceAttempt}>
          {creating ? (
            <Spinner label="正在创建…" />
          ) : req.phase === 'uncertain' ? (
            changedSinceAttempt ? '请先核对原请求' : '原样再次提交'
          ) : (
            <>
              <Icon name="check" size={13} />
              创建并打开
            </>
          )}
        </button>
        {!creating &&
          (req.phase === 'uncertain' ? (
            <InlineConfirm
              label="取消"
              confirmLabel="确认取消"
              question="结果尚未核对，取消后不再追踪这次请求。确定？"
              onConfirm={() => memory.dropRun(sessKey, req.key)}
            />
          ) : (
            <button type="button" className="fa-btn fa-btn--ghost fa-btn--sm" onClick={() => memory.dropRun(sessKey, req.key)}>
              取消
            </button>
          ))}
        {invalid && !creating && req.title.trim() !== '' && <span className="fa-help fa-help--error">{invalid}</span>}
        {invalid && !creating && req.title.trim() === '' && <span className="fa-help">请填写标题</span>}
      </div>
    </form>
  );
}
