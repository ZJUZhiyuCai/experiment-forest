import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode, RefObject } from 'react';
import type { EntityKind, ForestEntity } from '../shared/model';
import { Icon, KIND_ICON } from './icons';
import { InlineConfirm, Notice, Spinner, TagInput } from './bits';
import {
  FIELDS,
  KIND,
  LIMITS,
  STATUS,
  isArchived,
  lockedStatusesForReview,
  provenanceOf,
  provenanceSourceLabel,
  statusOption,
} from './forest-model';
import type { FieldSpec } from './forest-model';
import { compareRows, draftHeading, isDirty, reviewLockedStatuses, switchKind, validate } from './drafts';
import type { Draft, DraftErrors } from './drafts';

export interface EditorProps {
  draft: Draft;
  entities: ForestEntity[];
  byId: Map<string, ForestEntity>;
  onChange: (next: Draft) => void;
  onSave: () => void;
  /** 收起编辑器，草稿保留 */
  onClose: () => void;
  onDiscard: () => void;
  onLoadLatest: () => void;
  onRebase: () => void;
  onCheckUncertain: () => void;
  /** 用户确认核对出的条目就是此前已保存的结果 */
  onConfirmSaved: (id: string) => void;
  onOpen: (id: string) => void;
  headingRef: RefObject<HTMLHeadingElement>;
}

const ORDER: EntityKind[] = ['record', 'plan', 'sop', 'sample', 'note', 'project'];

export function EntityEditor(props: EditorProps) {
  const { draft, entities, byId, onChange, onSave, onClose, onDiscard, headingRef } = props;
  const uid = useId();
  const fid = (k: string) => `${uid}-${k}`;
  const [errors, setErrors] = useState<DraftErrors>({});
  const [triedSubmit, setTriedSubmit] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const archivedProjects = useMemo(
    () => new Set(entities.filter((e) => e.kind === 'project' && isArchived(e)).map((e) => e.id)),
    [entities],
  );

  // 提交过一次之后，随输入实时更新校验信息
  useEffect(() => {
    if (triedSubmit) setErrors(validate(draft, archivedProjects));
  }, [draft, triedSubmit, archivedProjects]);

  // 编辑后清掉“没有需要保存的修改”之类的一次性提示；冲突/不确定状态保持可见直到用户处理
  const touched = (): Partial<Draft> => (draft.phase === 'editing' ? { message: undefined } : {});
  const set = (patch: Partial<Draft>) => onChange({ ...draft, ...touched(), ...patch });
  const setField = (key: string, value: string) => onChange({ ...draft, ...touched(), fields: { ...draft.fields, [key]: value } });
  const setRefs = (key: string, value: string[]) => onChange({ ...draft, ...touched(), refs: { ...draft.refs, [key]: value } });

  const prov = draft.base ? provenanceOf(draft.base) : null;
  const reviewLocked = reviewLockedStatuses(draft);
  const lockableLabels = lockedStatusesForReview(draft.kind).map((s) => statusOption(draft.kind, s).label);
  const saving = draft.phase === 'saving';
  const dirty = isDirty(draft);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (saving) return;
    setTriedSubmit(true);
    const errs = validate(draft, archivedProjects);
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) {
      const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`) ?? document.getElementById(fid(first));
      el?.focus();
      return;
    }
    if (draft.mode === 'edit' && !dirty) {
      onChange({ ...draft, phase: 'editing', message: '没有需要保存的修改。' });
      return;
    }
    onSave();
  };

  const err = (k: string) => errors[k];
  const errId = (k: string) => (errors[k] ? `${fid(k)}-err` : undefined);

  const projects = entities
    .filter((e) => e.kind === 'project' && (!isArchived(e) || e.id === draft.base?.projectId))
    .sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
  const missingProject = draft.projectId && !byId.has(draft.projectId);

  const statusOptions = STATUS[draft.kind].filter((s) => s.value !== 'archived' || draft.status === 'archived');

  return (
    <section className="fa-pane fa-editor" aria-labelledby={`${uid}-h`}>
      <header className="fa-pane__head">
        <button type="button" className="fa-icon-btn" onClick={onClose} aria-label="收起编辑（保留草稿）" title="收起编辑（保留草稿）">
          <Icon name="back" />
        </button>
        <h2 id={`${uid}-h`} ref={headingRef} tabIndex={-1} className="fa-crumbs">
          <span className="fa-crumbs__here">
            <Icon name={KIND_ICON[draft.kind]} size={14} />
            {draftHeading(draft)}
          </span>
        </h2>
        <span className="fa-spacer" />
        {dirty && (
          <span className="fa-unsaved-dot" title="有未保存的修改">
            <span className="fa-unsaved-dot__dot" aria-hidden="true" />
            未保存
          </span>
        )}
      </header>

      <form ref={formRef} className="fa-pane__body fa-form" onSubmit={submit} noValidate aria-busy={saving}>
        <fieldset className="fa-fieldset fa-doc" disabled={saving}>
        {draft.mode === 'create' && (
          <fieldset className="fa-kind-switch">
            <legend className="fa-label">类型</legend>
            <div className="fa-seg" role="radiogroup" aria-label="条目类型">
              {ORDER.map((k) => (
                <label key={k} className={`fa-seg__item${draft.kind === k ? ' is-on' : ''}`}>
                  <input
                    type="radio"
                    name={`${uid}-kind`}
                    checked={draft.kind === k}
                    onChange={() => onChange(switchKind(draft, k))}
                  />
                  <Icon name={KIND_ICON[k]} size={14} />
                  <span>{KIND[k].short}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {prov?.isAi && (
          <Notice tone="ai" title={prov.needsReview ? 'AI 生成的草稿 · 待人工核对' : 'AI 生成的草稿 · 已人工核对'}>
            <p>
              来源：{provenanceSourceLabel(prov.source)}（保存时原样保留）。
              {prov.needsReview ? '请逐项核对正文与字段后再采用。' : '编辑后内容仍记录为 AI 来源。'}
            </p>
            {prov.needsReview && (
              <label className="fa-check fa-check--block">
                <input
                  type="checkbox"
                  data-field="markReviewed"
                  checked={!!draft.markReviewed}
                  onChange={(e) => set({ markReviewed: e.target.checked })}
                />
                <span>
                  我已逐项核对，<strong>保存时记录为“已人工核对”</strong>
                  {lockableLabels.length > 0 && <span className="fa-help">（勾选后才能设为“{lockableLabels.join('、')}”）</span>}
                </span>
              </label>
            )}
          </Notice>
        )}

        <StatusBanner {...props} />

        <Field
          id={fid('title')}
          label="标题"
          required
          hideLabel
          className="fa-field--title"
          error={err('title')}
          counter={draft.title.trim().length > LIMITS.title * 0.8 ? `${draft.title.trim().length}/${LIMITS.title}` : undefined}
        >
          <input
            id={fid('title')}
            data-field="title"
            className="fa-input fa-input--title"
            value={draft.title}
            maxLength={LIMITS.title + 50}
            autoFocus={draft.mode === 'create'}
            aria-required="true"
            aria-invalid={!!err('title')}
            aria-describedby={errId('title')}
            placeholder={titlePlaceholder(draft.kind)}
            onChange={(e) => set({ title: e.target.value })}
          />
        </Field>

        <div className="fa-form__props">
          <Field id={fid('status')} label="状态" row error={err('status')}>
            <select
              id={fid('status')}
              data-field="status"
              className="fa-input"
              value={draft.status}
              aria-invalid={!!err('status')}
              aria-describedby={errId('status')}
              onChange={(e) => set({ status: e.target.value })}
            >
              {statusOptions.map((s) => (
                <option key={s.value} value={s.value} disabled={reviewLocked.indexOf(s.value) !== -1 && draft.status !== s.value}>
                  {s.label}
                  {reviewLocked.indexOf(s.value) !== -1 ? '（需先勾选人工核对）' : ''}
                </option>
              ))}
              {!STATUS[draft.kind].some((s) => s.value === draft.status) && <option value={draft.status}>{draft.status}（原值）</option>}
            </select>
          </Field>

          {draft.kind !== 'project' && (
            <Field id={fid('projectId')} label="所属课题" row error={err('projectId')}>
              <select
                id={fid('projectId')}
                data-field="projectId"
                className="fa-input"
                value={draft.projectId}
                aria-invalid={!!err('projectId')}
                aria-describedby={errId('projectId')}
                onChange={(e) => set({ projectId: e.target.value })}
              >
                <option value="">— 不归入课题 —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                    {isArchived(p) ? '（已归档，保留原关联）' : ''}
                  </option>
                ))}
                {missingProject && <option value={draft.projectId}>（未找到的课题 {draft.projectId}）</option>}
              </select>
            </Field>
          )}

          {FIELDS[draft.kind]
            .filter((f) => f.type === 'date' || f.type === 'text')
            .map((f) => (
              <Field key={f.key} id={fid(f.key)} label={f.label} row error={err(f.key)} hint={f.hint}>
                <input
                  id={fid(f.key)}
                  data-field={f.key}
                  className="fa-input"
                  type={f.type === 'date' ? 'date' : 'text'}
                  value={draft.fields[f.key] ?? ''}
                  placeholder={f.placeholder}
                  aria-invalid={!!err(f.key)}
                  aria-describedby={errId(f.key)}
                  onChange={(e) => setField(f.key, e.target.value)}
                />
              </Field>
            ))}

          {FIELDS[draft.kind]
            .filter((f) => f.type === 'ref' || f.type === 'refs')
            .map((f) => (
              <RefField
                key={f.key}
                id={fid(f.key)}
                spec={f}
                draft={draft}
                entities={entities}
                byId={byId}
                value={f.type === 'ref' ? (draft.fields[f.key] ? [draft.fields[f.key]] : []) : draft.refs[f.key] ?? []}
                onChange={(ids) => (f.type === 'ref' ? setField(f.key, ids[0] ?? '') : setRefs(f.key, ids))}
              />
            ))}

          <Field id={fid('tags')} label="标签" row error={err('tags')}>
            <TagInput id={fid('tags')} tags={draft.tags} onChange={(tags) => set({ tags })} describedBy={errId('tags')} />
          </Field>
        </div>

        <Field
          id={fid('content')}
          label="正文"
          className="fa-field--body"
          error={err('content')}
          hint="纯文本，空行分段 · Ctrl/⌘ + Enter 保存"
          counter={draft.content.length > LIMITS.content * 0.9 ? `${draft.content.length}/${LIMITS.content}` : undefined}
        >
          <textarea
            id={fid('content')}
            data-field="content"
            className="fa-input fa-textarea"
            value={draft.content}
            rows={10}
            placeholder={contentPlaceholder(draft.kind)}
            aria-invalid={!!err('content')}
            aria-describedby={errId('content')}
            onChange={(e) => set({ content: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submit();
              }
            }}
          />
        </Field>

        {triedSubmit && Object.keys(errors).length > 0 && (
          <Notice tone="danger" live title="还有需要修改的地方">
            <ul className="fa-errlist">
              {Object.entries(errors).map(([k, v]) => (
                <li key={k}>
                  <a
                    href={`#${fid(k)}`}
                    onClick={(e) => {
                      e.preventDefault();
                      formRef.current?.querySelector<HTMLElement>(`[data-field="${k}"]`)?.focus();
                    }}
                  >
                    {v}
                  </a>
                </li>
              ))}
            </ul>
          </Notice>
        )}

        <footer className="fa-form__foot">
          <button type="submit" className="fa-btn fa-btn--primary" disabled={saving || (draft.phase === 'uncertain' && !draft.checked)}>
            {saving ? <Spinner label="正在保存…" /> : draft.phase === 'uncertain' ? (<><Icon name="check" />仍然再次保存</>) : (<><Icon name="check" />保存</>)}
          </button>
          <button type="button" className="fa-btn fa-btn--ghost" onClick={onClose} disabled={saving} title="收起编辑，输入会保留">
            稍后继续
          </button>
          <span className="fa-spacer" />
          {dirty ? (
            <InlineConfirm
              label={draft.mode === 'create' ? '放弃草稿' : '放弃修改'}
              confirmLabel="确认放弃"
              question="放弃后无法找回这些输入，确定？"
              icon="close"
              disabled={saving}
              onConfirm={onDiscard}
            />
          ) : (
            <button type="button" className="fa-btn fa-btn--ghost" onClick={onDiscard} disabled={saving}>
              关闭
            </button>
          )}
          {(dirty || draft.phase !== 'editing') && (
            <p className="fa-help fa-form__persist">
              未保存的输入暂存在本页内存：切换侧栏标签不会丢失；关闭或刷新 DeepSeek Harness 前请先保存。
            </p>
          )}
        </footer>
        </fieldset>
      </form>
    </section>
  );
}

/* ───────────────────────── 保存结果横幅 ───────────────────────── */

function StatusBanner({ draft, byId, onLoadLatest, onRebase, onCheckUncertain, onConfirmSaved, onOpen, onDiscard }: EditorProps) {
  if (draft.phase === 'conflict') {
    const latest = draft.latest;
    const projectTitle = (id: string) => (id ? byId.get(id)?.title ?? id : '（无）');
    return (
      <Notice
        tone="danger"
        live
        title="未保存：这条内容已在别处被修改"
        actions={
          latest ? (
            <>
              <button type="button" className="fa-btn fa-btn--primary fa-btn--sm" onClick={onRebase}>
                以最新版本为基准，保留我的修改
              </button>
              <InlineConfirm label="放弃我的修改" confirmLabel="确认放弃" question="放弃修改并查看最新版本？" onConfirm={onDiscard} />
            </>
          ) : (
            <button type="button" className="fa-btn fa-btn--primary fa-btn--sm" onClick={onLoadLatest}>
              <Icon name="refresh" />
              载入最新版本对照
            </button>
          )
        }
      >
        <p>
          你基于修订 r{draft.base?.revision} 编辑{latest ? `，服务端已是 r${latest.revision}` : ''}。你的草稿完整保留，没有覆盖任何内容。
          {draft.message && draft.message !== 'conflict' ? `（${draft.message}）` : ''}
        </p>
        {latest && draft.base && (
          <div className="fa-compare" role="region" aria-label="版本对照">
            <table>
              <thead>
                <tr>
                  <th scope="col">字段</th>
                  <th scope="col">你开始编辑时 r{draft.base.revision}</th>
                  <th scope="col">最新 r{latest.revision}</th>
                  <th scope="col">你的草稿</th>
                </tr>
              </thead>
              <tbody>
                {compareRows(draft, latest, projectTitle).map((r) => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    <td>{r.base || '（空）'}</td>
                    <td className={r.latest !== r.base ? 'is-changed' : undefined}>{r.latest || '（空）'}</td>
                    <td className={r.mine !== r.base ? 'is-mine' : undefined}>{r.mine || '（空）'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="fa-help">“以最新版本为基准”：你改过的字段保留你的值，没改过的字段采用最新值。合并后请再核对一遍，然后手动保存。</p>
          </div>
        )}
      </Notice>
    );
  }
  if (draft.phase === 'uncertain') {
    return (
      <Notice
        tone="warn"
        live
        title="无法确认是否已保存"
        actions={
          <button type="button" className="fa-btn fa-btn--primary fa-btn--sm" onClick={onCheckUncertain}>
            <Icon name="refresh" />
            刷新并核对
          </button>
        }
      >
        <p>
          请求没有得到明确结果（{draft.message || '网络或传输中断'}），服务端可能已经保存。
          {draft.mode === 'create' ? '为避免重复创建，请先刷新核对，再决定是否再次保存。' : '请先刷新核对最新版本。'}
        </p>
        {draft.checked && draft.mode === 'create' && (
          draft.suspects && draft.suspects.length ? (
            <div className="fa-suspects">
              <p>刷新后发现可能已经保存的同名条目：</p>
              <ul>
                {draft.suspects.map((id) => {
                  const e = byId.get(id);
                  const exact = (draft.exactMatches ?? []).indexOf(id) !== -1;
                  return (
                    <li key={id}>
                      <button type="button" className="fa-link" onClick={() => onOpen(id)}>
                        {e?.title ?? id}
                      </button>
                      {e && <span className="fa-muted"> · 创建于 {new Date(e.createdAt).toLocaleTimeString('zh-CN')}</span>}{' '}
                      {exact ? (
                        <span className="fa-chip fa-chip--ok">正文与字段与草稿完全一致</span>
                      ) : (
                        <span className="fa-chip fa-chip--warn">同名但内容有差异</span>
                      )}
                      {exact && e && (
                        <button type="button" className="fa-btn fa-btn--sm fa-suspects__confirm" onClick={() => onConfirmSaved(id)}>
                          <Icon name="check" />
                          就是它，清理草稿
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="fa-help">
                “完全一致”按完整正文与全部字段值判定。确认就是此前保存的结果时点“就是它”；内容有差异或需要另建一条时，请先打开核对，再决定“放弃草稿”或“仍然再次保存”。
              </p>
            </div>
          ) : (
            <p className="fa-help">刷新后没有发现同名的新条目。可以点“仍然再次保存”重试。</p>
          )
        )}
      </Notice>
    );
  }
  if (draft.phase === 'error') {
    return (
      <Notice tone="danger" live title="服务端拒绝了这次保存">
        <p>{draft.message}</p>
        <p className="fa-help">输入已保留，修改后可再次保存。</p>
      </Notice>
    );
  }
  if (draft.rebasedFrom !== undefined && draft.phase === 'editing') {
    return (
      <Notice tone="info" live title={`已切换到最新版本 r${draft.base?.revision} 为基准`}>
        <p>你修改过的字段保留了你的值。请核对后再保存。</p>
      </Notice>
    );
  }
  if (draft.message && draft.phase === 'editing') {
    return <Notice tone="info" live>{draft.message}</Notice>;
  }
  return null;
}

/* ───────────────────────── 字段外框 ───────────────────────── */

function Field({
  id,
  label,
  required,
  error,
  hint,
  counter,
  row,
  hideLabel,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  counter?: string;
  /** 属性行：宽栏时左标签、右控件 */
  row?: boolean;
  /** 视觉上隐藏标签（仍保留给读屏） */
  hideLabel?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`fa-field${row ? ' fa-field--row' : ''}${error ? ' has-error' : ''}${className ? ` ${className}` : ''}`}>
      <div className={`fa-field__top${hideLabel ? ' fa-sr' : ''}`}>
        <label className="fa-label" htmlFor={id}>
          {label}
          {required && <span className="fa-req" aria-hidden="true"> *</span>}
        </label>
        {counter && <span className="fa-help">{counter}</span>}
      </div>
      <div className="fa-field__control">
        {children}
        {hint && !error && <span className="fa-help">{hint}</span>}
        {error && (
          <span id={`${id}-err`} className="fa-help fa-help--error">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── 关联选择 ───────────────────────── */

function RefField({
  id,
  spec,
  draft,
  entities,
  byId,
  value,
  onChange,
}: {
  id: string;
  spec: FieldSpec;
  draft: Draft;
  entities: ForestEntity[];
  byId: Map<string, ForestEntity>;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const kind = spec.refKind as EntityKind;
  const candidates = entities
    .filter((e) => e.kind === kind && !isArchived(e) && e.id !== draft.id && value.indexOf(e.id) === -1)
    .filter((e) => !q.trim() || e.title.toLowerCase().indexOf(q.trim().toLowerCase()) !== -1)
    .sort((a, b) => {
      const sa = draft.projectId && a.projectId === draft.projectId ? 0 : 1;
      const sb = draft.projectId && b.projectId === draft.projectId ? 0 : 1;
      return sa - sb || (b.updatedAt > a.updatedAt ? 1 : -1);
    });
  const single = spec.type === 'ref';
  const listId = `${id}-opts`;

  return (
    <div className="fa-field fa-field--row">
      <div className="fa-field__top">
        <span className="fa-label" id={`${id}-label`}>
          {spec.label}
        </span>
        {!single && value.length > 0 && <span className="fa-help">{value.length}</span>}
      </div>
      <div className="fa-field__control">
      {value.length > 0 && (
        <ul className="fa-refs" aria-labelledby={`${id}-label`}>
          {value.map((rid) => {
            const e = byId.get(rid);
            return (
              <li key={rid} className="fa-ref">
                <Icon name={KIND_ICON[kind]} size={13} />
                <span>{e ? e.title : `未找到的条目 ${rid}`}</span>
                {e && isArchived(e) && <span className="fa-muted">（已归档）</span>}
                <button type="button" className="fa-tag__x" aria-label={`移除关联 ${e?.title ?? rid}`} onClick={() => onChange(value.filter((x) => x !== rid))}>
                  <Icon name="close" size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {(!single || value.length === 0) && (
        <div className="fa-refpick">
          <input
            id={id}
            className="fa-input"
            value={q}
            placeholder={candidates.length || q ? `按标题筛选${KIND[kind].label}…` : `暂无可关联的${KIND[kind].label}`}
            aria-labelledby={`${id}-label`}
            aria-controls={listId}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (candidates[0]) {
                  onChange(single ? [candidates[0].id] : [...value, candidates[0].id]);
                  setQ('');
                }
              }
            }}
          />
          {candidates.length > 0 && (
            <ul id={listId} className="fa-refpick__list" aria-label={`可关联的${KIND[kind].label}`}>
              {candidates.slice(0, 8).map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className="fa-refpick__opt"
                    onClick={() => {
                      onChange(single ? [e.id] : [...value, e.id]);
                      setQ('');
                    }}
                  >
                    <span>{e.title || '（无标题）'}</span>
                    <span className="fa-muted">
                      {draft.projectId && e.projectId === draft.projectId ? '本课题' : byId.get(e.projectId ?? '')?.title ?? '未归入课题'}
                    </span>
                  </button>
                </li>
              ))}
              {candidates.length > 8 && <li className="fa-help">还有 {candidates.length - 8} 条，输入标题筛选</li>}
            </ul>
          )}
        </div>
      )}
      {spec.hint && <span className="fa-help">{spec.hint}</span>}
      </div>
    </div>
  );
}

function titlePlaceholder(kind: EntityKind): string {
  switch (kind) {
    case 'project':
      return '一个研究问题，例如：CAR-T 对 Raji 细胞的杀伤效率';
    case 'record':
      return '例如：Western Blot 检测 p-AKT';
    case 'plan':
      return '例如：下周二 qPCR 验证敲低效率';
    case 'sop':
      return '例如：原代 T 细胞分离';
    case 'sample':
      return '例如：抗 p-AKT 抗体 / HEK293T P12';
    default:
      return '标题';
  }
}

function contentPlaceholder(kind: EntityKind): string {
  if (kind === 'record') return '目的、材料、步骤、观察、结果……按实际情况记录，未做的不必填。';
  if (kind === 'sop') return '1. 准备……\n2. 操作……\n3. 注意事项……';
  if (kind === 'project') return '研究背景、假设与目标。';
  if (kind === 'plan') return '打算做什么、需要准备什么。';
  return '';
}
