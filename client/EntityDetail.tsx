import { useEffect, useId, useState } from 'react';
import type { RefObject } from 'react';
import type { ForestApi, ForestEntity, JsonObject } from '../shared/model';
import { WORKFLOW_KEY, getRunWorkflow, getSopWorkflow, hasWorkflowMarker } from '../shared/workflow';
import { createMarkdownReport } from '../shared/report';
import { Icon, KIND_ICON } from './icons';
import { AiBadge, InlineConfirm, Notice, Paragraphs, Properties, StatusPill } from './bits';
import type { PropertyRow } from './bits';
import { CopyToDeepSeek } from './CopyToDeepSeek';
import { RunChecklist, RunSourceCard } from './RunChecklist';
import { SopRunPanel } from './StartRun';
import type { ActionCtx } from './runActions';
import {
  CHILD_KINDS,
  FIELDS,
  KIND,
  STATUS,
  classifyError,
  downloadText,
  fieldList,
  fieldString,
  formatDateTime,
  isArchived,
  jsonText,
  knownKeys,
  lockedStatusesForReview,
  provenanceOf,
  provenanceSourceLabel,
  referencedIds,
  relativeTime,
  reviewStatusLabel,
  reviewedProvenance,
} from './forest-model';

export type Notify = (message: string, tone?: 'ok' | 'warn' | 'danger') => void;

export interface DetailProps {
  entity: ForestEntity;
  api: ForestApi;
  entities: ForestEntity[];
  byId: Map<string, ForestEntity>;
  hasDraft: boolean;
  headingRef: RefObject<HTMLHeadingElement>;
  applyEntity: (e: ForestEntity) => void;
  refresh: () => Promise<boolean>;
  notify: Notify;
  onEdit: (e: ForestEntity) => void;
  onOpen: (id: string) => void;
  onOpenProject: (id: string) => void;
  onClose: () => void;
  /** 会话键与执行动作（步骤保存、创建实验） */
  sessKey: string;
  actions: ActionCtx;
  /** 从“今天”工作台“继续”进入：定位到下一步 */
  focusNextStep?: boolean;
  onFocusedNextStep?: () => void;
}

/** 生成并下载普通 Markdown 阅读报告（与 Obsidian 自动同步是独立用途） */
export function downloadReport(primary: ForestEntity, entities: readonly ForestEntity[], near: Element | null, notify: Notify): void {
  try {
    const r = createMarkdownReport(primary, entities);
    const size = downloadText(r.text, r.filename, r.mimeType, near);
    notify(`已生成 Markdown 报告「${r.filename}」（${r.entityCount} 条资料，${size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`}）。若没有开始下载，请检查宿主是否拦截了下载。`, 'ok');
  } catch (err) {
    notify(`生成报告失败：${classifyError(err).message}`, 'danger');
  }
}

type ActionState = { kind: 'idle' } | { kind: 'busy'; what: string } | { kind: 'error'; message: string; conflict: boolean };

export function EntityDetail(props: DetailProps) {
  const { entity, api, entities, byId, hasDraft, headingRef, applyEntity, refresh, notify, onEdit, onOpen, onOpenProject, onClose, sessKey, actions } = props;
  const runWf = getRunWorkflow(entity);
  const sopWf = getSopWorkflow(entity);
  // 带有 v1 标记却无法通过校验的结构化数据：原样保留并如实提示，不尝试修复
  const brokenWorkflow = !runWf && !sopWf && hasWorkflowMarker(entity.data[WORKFLOW_KEY]);
  const legacySopId = entity.kind === 'record' && !runWf && typeof entity.data.sopId === 'string' && entity.data.sopId ? entity.data.sopId : null;
  const uid = useId();
  const [action, setAction] = useState<ActionState>({ kind: 'idle' });
  const prov = provenanceOf(entity);
  const project = entity.projectId ? byId.get(entity.projectId) ?? null : null;
  const archived = isArchived(entity);

  useEffect(() => setAction({ kind: 'idle' }), [entity.id]);

  const run = async (what: string, fn: () => Promise<ForestEntity>, ok: string) => {
    setAction({ kind: 'busy', what });
    try {
      const saved = await fn();
      applyEntity(saved);
      setAction({ kind: 'idle' });
      notify(ok, 'ok');
    } catch (err) {
      const c = classifyError(err);
      setAction({
        kind: 'error',
        conflict: c.kind === 'conflict',
        message:
          c.kind === 'conflict'
            ? '这条内容已在别处被修改，操作未执行。请刷新查看最新版本后再试。'
            : c.kind === 'network' || c.kind === 'unknown'
              ? `操作结果不确定（${c.message}）。请刷新核对后再决定是否重试。`
              : c.message,
      });
    }
  };

  const changeStatus = (status: string) =>
    run(
      'status',
      () => api.update({ id: entity.id, expectedRevision: entity.revision, patch: { status } }),
      `状态已更新为“${STATUS[entity.kind].find((s) => s.value === status)?.label ?? status}”`,
    );

  const markReviewed = () => {
    if (!prov.raw) return;
    // 只把 reviewStatus 改为 'reviewed'；source 与其它 provenance 字段、其余 data 字段全部原样保留
    const data: JsonObject = { ...entity.data, provenance: reviewedProvenance(prov.raw) };
    return run('review', () => api.update({ id: entity.id, expectedRevision: entity.revision, patch: { data } }), '已记录为“人工核对完成”（来源保持为 AI 生成）');
  };
  const [reviewChecked, setReviewChecked] = useState(false);
  useEffect(() => setReviewChecked(false), [entity.id, entity.revision]);

  const archive = () =>
    run('archive', () => api.archive({ id: entity.id, expectedRevision: entity.revision }), `已归档「${entity.title}」`);

  const refsOut = referencedIds(entity, byId);
  const refsIn = entities.filter((e) => e.id !== entity.id && referencedIds(e, byId).indexOf(entity.id) !== -1);
  const siblings = entity.projectId ? entities.filter((e) => e.projectId === entity.projectId && e.id !== entity.id && !isArchived(e)) : [];
  const known = knownKeys(entity.kind);
  // 可识别的工作流已在清单 / 步骤中展示，不再作为“其他字段”重复；无法识别时照常原样展示
  const extraKeys = Object.keys(entity.data).filter((k) => !known.has(k) && !(k === WORKFLOW_KEY && (runWf || sopWf)));
  const reviewLocked = prov.needsReview ? lockedStatusesForReview(entity.kind) : [];
  const busy = action.kind === 'busy';

  /* ── 属性表：状态、课题、专业字段、标签 ── */
  const statusSelect = (
    <span className="fa-quickstatus">
      <StatusPill kind={entity.kind} status={entity.status} />
      <label className="fa-select-quiet">
        <span className="fa-sr">修改状态</span>
        <select
          value={entity.status}
          disabled={busy}
          onChange={(e) => {
            if (e.target.value !== entity.status) void changeStatus(e.target.value);
          }}
        >
          {STATUS[entity.kind]
            .filter((s) => s.value !== 'archived' || archived)
            .map((s) => (
              <option key={s.value} value={s.value} disabled={reviewLocked.indexOf(s.value) !== -1}>
                {s.label}
                {reviewLocked.indexOf(s.value) !== -1 ? '（需先核对）' : ''}
              </option>
            ))}
          {!STATUS[entity.kind].some((s) => s.value === entity.status) && <option value={entity.status}>{entity.status}</option>}
        </select>
        <span className="fa-select-quiet__hint" aria-hidden="true">
          更改
        </span>
      </label>
      {action.kind === 'busy' && action.what === 'status' && (
        <span className="fa-muted" role="status">
          正在保存…
        </span>
      )}
    </span>
  );

  const rows: PropertyRow[] = [{ label: '状态', icon: 'check', value: statusSelect }];
  if (entity.kind !== 'project') {
    rows.push({
      label: '课题',
      icon: 'ring',
      value: project ? (
        <button type="button" className="fa-prop-link" onClick={() => onOpenProject(project.id)}>
          {project.title}
          {isArchived(project) ? <span className="fa-muted">（已归档）</span> : null}
        </button>
      ) : entity.projectId ? (
        <span className="fa-muted">未找到 {entity.projectId}</span>
      ) : (
        <span className="fa-muted">未归入课题</span>
      ),
    });
  }
  for (const f of FIELDS[entity.kind]) {
    if (f.type === 'ref' || f.type === 'refs') {
      const ids = f.type === 'ref' ? (fieldString(entity.data, f) ? [fieldString(entity.data, f)] : []) : fieldList(entity.data, f.key);
      rows.push({
        label: f.label,
        icon: f.refKind ? KIND_ICON[f.refKind] : 'link',
        value:
          ids.length === 0 ? (
            <span className="fa-muted">空</span>
          ) : (
            <ul className="fa-inline-list">
              {ids.map((id) => {
                const e = byId.get(id);
                return (
                  <li key={id}>
                    {e ? (
                      <button type="button" className="fa-chiplink" onClick={() => onOpen(id)}>
                        <Icon name={KIND_ICON[e.kind]} size={13} />
                        {e.title}
                      </button>
                    ) : (
                      <span className="fa-muted">未找到 {id}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ),
      });
    } else {
      const v = fieldString(entity.data, f);
      rows.push({
        label: f.label,
        icon: f.type === 'date' ? 'plan' : 'note',
        mono: f.type === 'date' && !!v,
        value: v || <span className="fa-muted">空</span>,
      });
    }
  }
  if (entity.tags.length > 0) {
    rows.push({
      label: '标签',
      icon: 'link',
      value: (
        <ul className="fa-tags fa-tags--static" aria-label="标签">
          {entity.tags.map((t) => (
            <li key={t} className="fa-tag">
              {t}
            </li>
          ))}
        </ul>
      ),
    });
  }

  return (
    <section className={`fa-pane fa-detail${prov.isAi ? ' is-ai' : ''}`} aria-labelledby={`${uid}-h`}>
      <header className="fa-pane__head">
        <button type="button" className="fa-icon-btn" onClick={onClose} aria-label="返回" title="返回（Esc）">
          <Icon name="back" />
        </button>
        <nav className="fa-crumbs" aria-label="位置">
          {project ? (
            <>
              <button type="button" className="fa-crumbs__link" onClick={() => onOpenProject(project.id)}>
                {project.title}
              </button>
              <span className="fa-crumbs__sep" aria-hidden="true">
                /
              </span>
            </>
          ) : null}
          <span className="fa-crumbs__here">{KIND[entity.kind].label}</span>
        </nav>
        <span className="fa-spacer" />
        <button type="button" className="fa-btn fa-btn--primary fa-btn--sm" onClick={() => onEdit(entity)} disabled={busy}>
          <Icon name="edit" />
          {hasDraft ? '继续编辑' : '编辑'}
        </button>
      </header>

      <div className="fa-pane__body">
        <article className="fa-doc">
          <div className="fa-doc__eyebrow">
            <span className={`fa-kind-chip fa-kind-${entity.kind}`}>
              <Icon name={KIND_ICON[entity.kind]} size={14} />
              {KIND[entity.kind].label}
            </span>
            {prov.isAi && <AiBadge needsReview={prov.needsReview} />}
            {archived && <span className="fa-quiet-tag">已归档</span>}
          </div>
          <h2 id={`${uid}-h`} ref={headingRef} tabIndex={-1} className="fa-doc__title">
            {entity.title || '（无标题）'}
          </h2>

          {action.kind === 'error' && (
            <Notice
              tone="danger"
              live
              title="操作未完成"
              actions={
                <button type="button" className="fa-btn fa-btn--sm" onClick={() => void refresh().then(() => setAction({ kind: 'idle' }))}>
                  <Icon name="refresh" />
                  刷新核对
                </button>
              }
            >
              <p>{action.message}</p>
            </Notice>
          )}

          {hasDraft && (
            <Notice tone="warn" title="你有未保存的修改" actions={<button type="button" className="fa-btn fa-btn--sm" onClick={() => onEdit(entity)}>继续编辑</button>}>
              <p>下方显示的是服务端已保存的版本。</p>
            </Notice>
          )}

          {prov.isAi && (
            <Notice tone="ai" title={prov.needsReview ? 'AI 生成的草稿 · 待人工核对' : 'AI 生成的草稿 · 已人工核对'}>
              <p>
                来源：{provenanceSourceLabel(prov.source)}。
                {prov.needsReview
                  ? '内容未经人工确认，不代表实验事实；核对前不能设为“已批准”或“已完成”。'
                  : '已有人确认核对过内容；来源仍保留为 AI 生成。'}
              </p>
              <dl className="fa-kv fa-kv--compact" aria-label="服务端保存的来源信息（原样）">
                <div>
                  <dt>审阅状态</dt>
                  <dd>{reviewStatusLabel(prov.reviewStatus)}</dd>
                </div>
                {Object.entries(prov.raw ?? {})
                  .filter(([k]) => k !== 'reviewStatus')
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{jsonText(v)}</dd>
                    </div>
                  ))}
              </dl>
              {prov.needsReview && (
                <div className="fa-review-gate">
                  <label className="fa-check">
                    <input
                      type="checkbox"
                      checked={reviewChecked}
                      disabled={busy}
                      onChange={(e) => setReviewChecked(e.target.checked)}
                    />
                    <span>我已逐项核对正文与字段，确认内容属实（只记录核对，不改变状态）</span>
                  </label>
                  <button
                    type="button"
                    className="fa-btn fa-btn--primary fa-btn--sm"
                    disabled={!reviewChecked || busy}
                    onClick={() => void markReviewed()}
                  >
                    <Icon name="check" />
                    {action.kind === 'busy' && action.what === 'review' ? '正在记录…' : '记录为已核对'}
                  </button>
                  {hasDraft && <span className="fa-help">注意：记录核对会产生新修订，你未保存的修改之后保存时需要按冲突流程核对。</span>}
                </div>
              )}
            </Notice>
          )}

          {archived && (
            <Notice tone="info" title="已归档">
              <p>归档是软归档，内容完整保留。如需恢复，可在“编辑”中把状态改回其他值。</p>
            </Notice>
          )}

          <Properties rows={rows} label="属性" />

          {legacySopId && (
            <p className="fa-legacy-sop">
              <Icon name="alert" size={13} />
              <span>
                这条记录只关联了 SOP 的当前条目，未记录所用版本：SOP 之后的修改都会反映在关联里。从 SOP 详情“创建实验草稿”可以冻结当时的版本。
              </span>
            </p>
          )}

          {brokenWorkflow && (
            <Notice tone="warn" title="结构化执行数据无法识别">
              <p>这条内容的 {WORKFLOW_KEY} 不符合当前格式，界面不展示也不修改它，保存时原样保留。可在“详细信息”中查看原始值。</p>
            </Notice>
          )}

          {runWf && (
            <>
              <RunChecklist
                entity={entity}
                sessKey={sessKey}
                ctx={actions}
                focusNext={props.focusNextStep}
                onFocused={props.onFocusedNextStep}
              />
              <RunSourceCard run={runWf} byId={byId} onOpen={onOpen} />
            </>
          )}

          <section className="fa-doc__body" aria-label="正文">
            {runWf && <h3 className="fa-h3 fa-doc__body-h">记录正文</h3>}
            <Paragraphs text={entity.content} limit={1600} />
          </section>

          {entity.kind === 'sop' && (
            <SopRunPanel sop={entity} entities={entities} byId={byId} sessKey={sessKey} ctx={actions} hasDraft={hasDraft} onOpen={onOpen} onEdit={onEdit} />
          )}

          {(refsOut.length > 0 || refsIn.length > 0) && (
            <section className="fa-section">
              <h3 className="fa-h3">关联</h3>
              <ul className="fa-mini-list">
                {refsOut.map((id) => {
                  const e = byId.get(id) as ForestEntity;
                  return (
                    <li key={`o-${id}`}>
                      <button type="button" className="fa-mini" onClick={() => onOpen(id)}>
                        <span className={`fa-mini__icon fa-kind-${e.kind}`}>
                          <Icon name={KIND_ICON[e.kind]} size={14} />
                        </span>
                        <span className="fa-mini__title">{e.title}</span>
                        <span className="fa-mini__dir">引用</span>
                        <StatusPill kind={e.kind} status={e.status} />
                      </button>
                    </li>
                  );
                })}
                {refsIn.map((e) => (
                  <li key={`i-${e.id}`}>
                    <button type="button" className="fa-mini" onClick={() => onOpen(e.id)}>
                      <span className={`fa-mini__icon fa-kind-${e.kind}`}>
                        <Icon name={KIND_ICON[e.kind]} size={14} />
                      </span>
                      <span className="fa-mini__title">{e.title}</span>
                      <span className="fa-mini__dir">被引用</span>
                      <StatusPill kind={e.kind} status={e.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {project && entity.kind !== 'project' && (
            <section className="fa-section">
              <h3 className="fa-h3">同课题</h3>
              <p className="fa-siblings">
                {CHILD_KINDS.map((k) => {
                  const n = siblings.filter((e) => e.kind === k).length;
                  return n ? (
                    <span key={k} className="fa-sibling">
                      <Icon name={KIND_ICON[k]} size={13} />
                      {KIND[k].short}
                      <b>{n}</b>
                    </span>
                  ) : null;
                })}
                {siblings.length === 0 && <span className="fa-muted">该课题下没有其他条目。</span>}
                <button type="button" className="fa-link" onClick={() => onOpenProject(project.id)}>
                  打开课题 →
                </button>
              </p>
            </section>
          )}

          <details className="fa-section fa-extra">
            <summary>
              详细信息
              <span className="fa-muted">
                r{entity.revision} · {relativeTime(entity.updatedAt)}更新
              </span>
            </summary>
            <Properties
              label="记录信息"
              rows={[
                { label: '编号', value: <span title={entity.id}>{entity.id}</span>, mono: true, quiet: true },
                { label: '修订', value: `r${entity.revision}`, mono: true, quiet: true },
                { label: '创建', value: formatDateTime(entity.createdAt), mono: true, quiet: true },
                { label: '更新', value: `${formatDateTime(entity.updatedAt)}（${relativeTime(entity.updatedAt)}）`, mono: true, quiet: true },
              ]}
            />
            {extraKeys.length > 0 && (
              <>
                <p className="fa-help fa-extra__note">保留的其他字段（{extraKeys.length}）：来自导入或其他工具。界面不编辑它们，保存时原样保留。</p>
                <dl className="fa-kv fa-kv--code">
                  {extraKeys.map((k) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>
                        <pre>{jsonText(entity.data[k])}</pre>
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
          </details>

          <footer className="fa-detail__foot">
            <CopyToDeepSeek primary={entity} project={project} api={api} />
            <button
              type="button"
              className="fa-btn fa-btn--ghost"
              title="下载这条内容及其关联资料的 Markdown 阅读报告（完整保存的原文、来源与结构化数据）"
              onClick={(e) => downloadReport(entity, entities, e.currentTarget, notify)}
            >
              <Icon name="file" />
              Markdown 报告
            </button>
            <span className="fa-spacer" />
            {!archived && (
              <InlineConfirm
                label="归档"
                confirmLabel="确认归档"
                question={`归档「${entity.title}」？可在编辑中恢复。`}
                icon="archive"
                busy={action.kind === 'busy' && action.what === 'archive'}
                onConfirm={() => void archive()}
              />
            )}
          </footer>
        </article>
      </div>
    </section>
  );
}
