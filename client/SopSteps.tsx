import { useEffect, useRef, useState } from 'react';
import type { SopStep } from '../shared/workflow';
import { Icon } from './icons';
import { InlineConfirm } from './bits';
import { MAX_SOP_STEPS, STEP_LIMITS, newStepId } from './drafts';
import type { DraftErrors } from './drafts';

/* ───────────────────────── SOP 步骤编辑（属于编辑草稿的一部分） ───────────────────────── */

/**
 * 结构化步骤：标题、说明、是否必需；可增删、上移下移。
 * - 步骤 ID 在“添加”时生成一次，改名、排序都不会重新生成。
 * - 这里只修改草稿里的 steps；脏检测、保存、冲突合并与“结果不确定”核对都沿用编辑草稿的流程。
 * - 正文不受影响：步骤是正文之外的结构化模板，SOP 正文照常完整保存。
 */
export function SopStepsEditor({
  idPrefix,
  steps,
  locked,
  errors,
  onChange,
}: {
  idPrefix: string;
  steps: SopStep[];
  locked: boolean;
  errors: DraftErrors;
  onChange: (steps: SopStep[]) => void;
}) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const [announce, setAnnounce] = useState('');

  useEffect(() => {
    if (!focusId) return;
    listRef.current?.querySelector<HTMLElement>(`[data-step-focus="${focusId}"]`)?.focus();
    setFocusId(null);
  }, [focusId, steps]);

  if (locked) {
    return (
      <section className="fa-steps-edit is-locked" aria-label="SOP 步骤">
        <div className="fa-steps-edit__head">
          <span className="fa-label">
            <Icon name="lock" size={13} />
            结构化步骤
          </span>
        </div>
        <p className="fa-help">这条 SOP 已有一份本界面无法识别的结构化数据（可能来自其它版本的工具）。为避免覆盖，这里不提供编辑，保存时原样保留。</p>
      </section>
    );
  }

  const full = steps.length >= MAX_SOP_STEPS;
  const patch = (id: string, p: Partial<SopStep>) => onChange(steps.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = steps.slice();
    const [item] = next.splice(i, 1);
    next.splice(j, 0, item);
    onChange(next);
    setAnnounce(`「${item.title || `第 ${i + 1} 步`}」已移到第 ${j + 1} 步`);
    // 移动后焦点跟随同一个按钮；到边界时换到另一个方向的按钮
    const edge = (dir === -1 && j === 0) || (dir === 1 && j === steps.length - 1);
    setFocusId(`${item.id}:${edge ? (dir === -1 ? 'down' : 'up') : dir === -1 ? 'up' : 'down'}`);
  };
  const add = (at: number) => {
    if (full) return;
    const step: SopStep = { id: newStepId(), title: '', instruction: '', required: true };
    const next = steps.slice();
    next.splice(at, 0, step);
    onChange(next);
    setFocusId(`${step.id}:title`);
  };
  const remove = (i: number) => {
    const s = steps[i];
    onChange(steps.filter((x) => x.id !== s.id));
    setAnnounce(`已删除第 ${i + 1} 步${s.title ? `「${s.title}」` : ''}（保存前可放弃修改恢复）`);
    const neighbour = steps[i + 1] ?? steps[i - 1];
    setFocusId(neighbour ? `${neighbour.id}:title` : '__add');
  };

  return (
    <section className="fa-steps-edit" aria-labelledby={`${idPrefix}-steps-h`}>
      <div className="fa-steps-edit__head">
        <span id={`${idPrefix}-steps-h`} className="fa-label">
          <Icon name="list" size={13} />
          结构化步骤
        </span>
        <span className="fa-help">
          {steps.length ? `${steps.length} 步 · ${steps.filter((s) => s.required).length} 步必需` : '可选'}
          {steps.length > MAX_SOP_STEPS * 0.8 ? ` · 上限 ${MAX_SOP_STEPS}` : ''}
        </span>
      </div>
      <p className="fa-help fa-steps-edit__intro">
        从这条 SOP 创建实验时，会冻结当下的步骤，作为执行清单。正文照常完整保存，不会被步骤替换；没有步骤的 SOP 也能创建实验，只冻结正文。
      </p>
      {errors.steps && (
        <p className="fa-help fa-help--error" role="alert" data-field="steps" tabIndex={-1}>
          {errors.steps}
        </p>
      )}

      {steps.length > 0 && (
        <ol ref={listRef} className="fa-steps-edit__list">
          {steps.map((s, i) => {
            const tErr = errors[`step-title:${s.id}`];
            const iErr = errors[`step-instruction:${s.id}`];
            const tid = `${idPrefix}-step-${i}-t`;
            const iid = `${idPrefix}-step-${i}-i`;
            const hasText = !!(s.title.trim() || s.instruction.trim());
            return (
              <li key={s.id} className={`fa-step-card${tErr || iErr ? ' has-error' : ''}`}>
                <span className="fa-step-card__num" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="fa-step-card__main">
                  <label className="fa-sr" htmlFor={tid}>
                    第 {i + 1} 步标题
                  </label>
                  <input
                    id={tid}
                    className="fa-input fa-step-card__title"
                    data-field={`step-title:${s.id}`}
                    data-step-focus={`${s.id}:title`}
                    value={s.title}
                    maxLength={STEP_LIMITS.title + 50}
                    placeholder="这一步做什么，例如：裂解细胞"
                    aria-invalid={!!tErr}
                    aria-describedby={tErr ? `${tid}-err` : undefined}
                    onChange={(e) => patch(s.id, { title: e.target.value })}
                    onKeyDown={(e) => {
                      // 在最后一步的标题里按回车：快速追加下一步（而不是提交表单）
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        if (i === steps.length - 1 && s.title.trim()) add(steps.length);
                        else listRef.current?.querySelector<HTMLElement>(`[data-step-focus="${s.id}:instruction"]`)?.focus();
                      }
                    }}
                  />
                  {tErr && (
                    <span id={`${tid}-err`} className="fa-help fa-help--error">
                      {tErr}
                    </span>
                  )}
                  <label className="fa-sr" htmlFor={iid}>
                    第 {i + 1} 步说明
                  </label>
                  <textarea
                    id={iid}
                    className="fa-input fa-step-card__inst"
                    data-field={`step-instruction:${s.id}`}
                    data-step-focus={`${s.id}:instruction`}
                    value={s.instruction}
                    rows={Math.min(8, Math.max(2, s.instruction.split('\n').length))}
                    placeholder="操作要点、参数、注意事项（可选）"
                    aria-invalid={!!iErr}
                    aria-describedby={iErr ? `${iid}-err` : undefined}
                    onChange={(e) => patch(s.id, { instruction: e.target.value })}
                  />
                  {iErr ? (
                    <span id={`${iid}-err`} className="fa-help fa-help--error">
                      {iErr}
                    </span>
                  ) : s.instruction.length > STEP_LIMITS.instruction * 0.8 ? (
                    <span className="fa-help">
                      {s.instruction.length}/{STEP_LIMITS.instruction}
                    </span>
                  ) : null}
                  <div className="fa-step-card__tools">
                    <label className="fa-check fa-step-card__req">
                      <input type="checkbox" checked={s.required} onChange={(e) => patch(s.id, { required: e.target.checked })} />
                      <span>必需步骤</span>
                    </label>
                    <span className="fa-spacer" />
                    <button
                      type="button"
                      className="fa-icon-btn fa-icon-btn--sm"
                      data-step-focus={`${s.id}:up`}
                      disabled={i === 0}
                      aria-label={`上移第 ${i + 1} 步`}
                      title="上移"
                      onClick={() => move(i, -1)}
                    >
                      <Icon name="up" size={14} />
                    </button>
                    <button
                      type="button"
                      className="fa-icon-btn fa-icon-btn--sm"
                      data-step-focus={`${s.id}:down`}
                      disabled={i === steps.length - 1}
                      aria-label={`下移第 ${i + 1} 步`}
                      title="下移"
                      onClick={() => move(i, 1)}
                    >
                      <Icon name="down" size={14} />
                    </button>
                    <button
                      type="button"
                      className="fa-icon-btn fa-icon-btn--sm"
                      disabled={full}
                      aria-label={`在第 ${i + 1} 步后插入一步`}
                      title="在后面插入一步"
                      onClick={() => add(i + 1)}
                    >
                      <Icon name="plus" size={14} />
                    </button>
                    {hasText ? (
                      <span className="fa-step-card__del">
                        <InlineConfirm label="删除" confirmLabel="删除这一步" question={`删除第 ${i + 1} 步？`} icon="trash" onConfirm={() => remove(i)} />
                      </span>
                    ) : (
                      <button type="button" className="fa-icon-btn fa-icon-btn--sm" aria-label={`删除第 ${i + 1} 步（空）`} title="删除" onClick={() => remove(i)}>
                        <Icon name="trash" size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <button type="button" className="fa-steps-edit__add" data-step-focus="__add" disabled={full} onClick={() => add(steps.length)} ref={(el) => {
        if (el && focusId === '__add') el.focus();
      }}>
        <Icon name="plus" size={14} />
        {full ? `已达 ${MAX_SOP_STEPS} 步上限` : steps.length ? '添加一步' : '添加第一个步骤'}
      </button>
      <span className="fa-sr" role="status" aria-live="polite">
        {announce}
      </span>
    </section>
  );
}

/* ───────────────────────── SOP 步骤只读视图 ───────────────────────── */

export function SopStepsView({ steps, compact }: { steps: readonly SopStep[]; compact?: boolean }) {
  return (
    <ol className={`fa-steps-view${compact ? ' is-compact' : ''}`}>
      {steps.map((s, i) => (
        <li key={s.id} className="fa-steps-view__item">
          <span className="fa-steps-view__num" aria-hidden="true">
            {i + 1}
          </span>
          <div className="fa-steps-view__main">
            <p className="fa-steps-view__title">
              <span className="fa-sr">第 {i + 1} 步：</span>
              {s.title}
              {s.required ? <span className="fa-req-tag">必需</span> : <span className="fa-opt-tag">可选</span>}
            </p>
            {s.instruction.trim() && <p className="fa-steps-view__inst">{s.instruction}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
