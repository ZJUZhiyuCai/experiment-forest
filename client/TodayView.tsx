import { useEffect, useId, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import type { ForestEntity } from '../shared/model';
import { buildAgenda, getRunWorkflow, needsHumanReview, runProgress } from '../shared/workflow';
import type { ForestAgenda } from '../shared/workflow';
import { Icon, KIND_ICON } from './icons';
import { AiBadge, EmptyState, FreshDot, StatusPill } from './bits';
import { KIND, dayDiff, friendlyDay, isArchived, localDate, provenanceOf, str } from './forest-model';

/* ───────────────────────── 本地日（跨午夜自动更新） ───────────────────────── */

/**
 * 当前客户端本地日 YYYY-MM-DD。午夜后自动切换：定时到下一个本地零点，
 * 另外在面板重新可见、窗口获得焦点时以及每分钟复核一次（休眠唤醒后计时器可能被推迟）。
 */
export function useLocalDay(): string {
  const [day, setDay] = useState(() => localDate());
  useEffect(() => {
    let timer = 0;
    const check = () => setDay((d) => {
      const now = localDate();
      return now === d ? d : now;
    });
    const arm = () => {
      window.clearTimeout(timer);
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = window.setTimeout(() => {
        check();
        arm();
      }, Math.max(1000, next.getTime() - now.getTime()));
    };
    arm();
    const minute = window.setInterval(check, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        check();
        arm();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(minute);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);
  return day;
}

/** 课题过滤：只在课题存在且未归档时生效（buildAgenda 自身也会跳过已归档课题中的安排） */
export function useAgenda(entities: ForestEntity[], today: string, projectId: string | null): ForestAgenda {
  return useMemo(() => buildAgenda(entities, { today, ...(projectId ? { projectId } : {}) }), [entities, today, projectId]);
}

type SectionKey = keyof ForestAgenda;

const SECTIONS: { key: SectionKey; title: string; icon: 'alert' | 'today' | 'plan' | 'inbox' | 'spark'; empty?: string }[] = [
  { key: 'overdue', title: '逾期', icon: 'alert' },
  { key: 'today', title: '今天', icon: 'today', empty: '今天没有安排' },
  { key: 'upcoming', title: '未来七天', icon: 'plan' },
  { key: 'undated', title: '未排期', icon: 'inbox' },
  { key: 'review', title: 'AI 待核对', icon: 'spark' },
];

function whenLabel(e: ForestEntity, today: string): { text: string; tone: '' | 'is-late' | 'is-today' } {
  const d = str(e.data, 'plannedDate').slice(0, 10);
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return { text: '未排期', tone: '' };
  const diff = dayDiff(today, d);
  if (diff < 0) return { text: `逾期 ${-diff} 天 · ${friendlyDay(d)}`, tone: 'is-late' };
  if (diff === 0) return { text: '今天', tone: 'is-today' };
  if (diff === 1) return { text: `明天 · ${friendlyDay(d)}`, tone: '' };
  return { text: `${friendlyDay(d)} · ${diff} 天后`, tone: '' };
}

/* ───────────────────────── 今天（工作台） ───────────────────────── */

export function TodayView({
  entities,
  byId,
  today,
  projectId,
  freshIds,
  selectedId,
  unsavedRuns,
  headingRef,
  onProject,
  onOpen,
  onContinue,
  onBack,
}: {
  entities: ForestEntity[];
  byId: Map<string, ForestEntity>;
  today: string;
  projectId: string | null;
  freshIds: Set<string>;
  selectedId: string | null;
  /** 有未保存步骤输入的实验 ID */
  unsavedRuns: Set<string>;
  headingRef: RefObject<HTMLHeadingElement>;
  onProject: (id: string | null) => void;
  onOpen: (id: string) => void;
  /** 打开实验并定位到下一步 */
  onContinue: (id: string) => void;
  onBack: () => void;
}) {
  const uid = useId();
  const filterProject = projectId ? byId.get(projectId) ?? null : null;
  const effective = filterProject && filterProject.kind === 'project' ? projectId : null;
  const agenda = useAgenda(entities, today, effective);
  const projects = entities.filter((e) => e.kind === 'project' && !isArchived(e)).sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
  const scheduled = agenda.overdue.length + agenda.today.length + agenda.upcoming.length + agenda.undated.length;
  const empty = scheduled === 0 && agenda.review.length === 0;

  return (
    <section className="fa-pane fa-today" aria-labelledby={`${uid}-h`}>
      <header className="fa-pane__head">
        <button type="button" className="fa-icon-btn" onClick={onBack} aria-label="返回林地" title="返回（Esc）">
          <Icon name="back" />
        </button>
        <nav className="fa-crumbs" aria-label="位置">
          <span className="fa-crumbs__here">
            <Icon name="today" size={14} />
            今天
          </span>
        </nav>
      </header>
      <div className="fa-pane__body">
        <header className="fa-page-head fa-today__head">
          <div className="fa-page-head__text">
            <p className="fa-today__date">{friendlyDay(today)}</p>
            <h2 id={`${uid}-h`} ref={headingRef} tabIndex={-1} className="fa-page-title">
              今天
            </h2>
            <p className="fa-page-sub">
              {agenda.today.length} 项今天
              {agenda.overdue.length ? ` · ${agenda.overdue.length} 项逾期` : ''}
              {agenda.upcoming.length ? ` · 未来七天 ${agenda.upcoming.length} 项` : ''}
              {filterProject ? ` · 仅「${filterProject.title}」` : ''}
            </p>
          </div>
          <label className="fa-today__filter">
            <Icon name="ring" size={13} />
            <span className="fa-sr">按课题筛选</span>
            <select value={effective ?? ''} onChange={(e) => onProject(e.target.value || null)}>
              <option value="">全部课题</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
              {projectId && !effective && <option value={projectId}>（课题不可用）</option>}
            </select>
          </label>
        </header>

        {empty ? (
          <EmptyState title={filterProject ? '这个课题近期没有安排' : '今天很安静'}>
            <p>这里列出带计划日期的实验计划，以及从 SOP 创建、仍是草稿的实验。</p>
            <p className="fa-help">在计划里填写“计划日期”，或在 SOP 详情中“创建实验草稿”，它们就会出现在这里。</p>
          </EmptyState>
        ) : (
          SECTIONS.map((sec) => {
            const rows = agenda[sec.key];
            if (!rows.length && !(sec.key === 'today' && scheduled > 0)) return null;
            return (
              <section key={sec.key} className={`fa-section fa-agenda fa-agenda--${sec.key}`} aria-labelledby={`${uid}-${sec.key}`}>
                <div className="fa-section__head">
                  <h3 id={`${uid}-${sec.key}`} className="fa-h3">
                    <Icon name={sec.icon} size={14} />
                    {sec.title} <span className="fa-count">{rows.length}</span>
                  </h3>
                </div>
                {rows.length === 0 ? (
                  <p className="fa-muted fa-agenda__empty">{sec.empty}</p>
                ) : (
                  <ul className="fa-agenda__list fa-surface">
                    {rows.map((e) => (
                      <AgendaRow
                        key={e.id}
                        entity={e}
                        today={today}
                        section={sec.key}
                        projectTitle={!effective && e.projectId ? byId.get(e.projectId)?.title : undefined}
                        fresh={freshIds.has(e.id)}
                        selected={selectedId === e.id}
                        unsaved={unsavedRuns.has(e.id)}
                        onOpen={onOpen}
                        onContinue={onContinue}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })
        )}
        <p className="fa-help fa-today__foot">按本机日期计算，午夜后自动更新。完成步骤不会自动把实验设为完成。</p>
      </div>
    </section>
  );
}

function AgendaRow({
  entity,
  today,
  section,
  projectTitle,
  fresh,
  selected,
  unsaved,
  onOpen,
  onContinue,
}: {
  entity: ForestEntity;
  today: string;
  section: SectionKey;
  projectTitle?: string;
  fresh: boolean;
  selected: boolean;
  unsaved: boolean;
  onOpen: (id: string) => void;
  onContinue: (id: string) => void;
}) {
  const run = getRunWorkflow(entity);
  const pr = run ? runProgress(entity) : null;
  const prov = provenanceOf(entity);
  const when = section === 'review' ? null : whenLabel(entity, today);
  const canContinue = !!run && entity.status === 'draft' && !!pr?.nextStep;
  const recorded = pr ? pr.done + pr.skipped : 0;
  return (
    <li className={`fa-agenda__row${selected ? ' is-selected' : ''}`}>
      <button type="button" className="fa-agenda__main" aria-current={selected ? 'true' : undefined} onClick={() => onOpen(entity.id)}>
        <span className={`fa-row__icon fa-kind-${entity.kind}`}>
          <Icon name={KIND_ICON[entity.kind]} size={16} />
        </span>
        <span className="fa-agenda__text">
          <span className="fa-agenda__title">
            {entity.title || '（无标题）'}
            {fresh && <FreshDot />}
          </span>
          <span className="fa-agenda__meta">
            {when && <span className={`fa-agenda__when ${when.tone}`}>{when.text}</span>}
            <span>{run ? '实验（SOP 执行）' : KIND[entity.kind].label}</span>
            {projectTitle && <span>{projectTitle}</span>}
          </span>
          {pr && pr.total > 0 && (
            <span className="fa-agenda__progress">
              <span className="fa-agenda__bar" aria-hidden="true">
                <span style={{ width: `${(pr.done / pr.total) * 100}%` }} className="is-done" />
                <span style={{ width: `${(pr.skipped / pr.total) * 100}%` }} className="is-skip" />
              </span>
              <span>
                {recorded}/{pr.total} 已记录
                {pr.nextStep ? ` · 下一步：${pr.nextStep.title}` : ' · 步骤已全部记录'}
              </span>
            </span>
          )}
          {pr && pr.total === 0 && <span className="fa-agenda__progress fa-muted">仅冻结正文，无步骤清单</span>}
        </span>
        <span className="fa-agenda__side">
          {unsaved && (
            <span className="fa-unsaved-dot" title="有未保存的步骤输入">
              <span className="fa-unsaved-dot__dot" aria-hidden="true" />
              未保存
            </span>
          )}
          {prov.isAi && <AiBadge needsReview={prov.needsReview} />}
          <StatusPill kind={entity.kind} status={entity.status} />
        </span>
      </button>
      {canContinue && (
        <button type="button" className="fa-btn fa-btn--sm fa-agenda__go" onClick={() => prov.needsReview ? onOpen(entity.id) : onContinue(entity.id)} aria-label={prov.needsReview ? `去核对「${entity.title}」的 AI 草稿` : `继续「${entity.title}」的下一步：${pr?.nextStep?.title ?? ''}`}>
          <Icon name={prov.needsReview ? 'check' : 'play'} size={12} />
          {prov.needsReview ? '去核对' : '继续'}
        </button>
      )}
    </li>
  );
}

/* ───────────────────────── 林地顶部的“今天”摘要 ───────────────────────── */

export function TodayCard({
  entities,
  today,
  onToday,
  onOpen,
  onContinue,
}: {
  entities: ForestEntity[];
  today: string;
  onToday: () => void;
  onOpen: (id: string) => void;
  onContinue: (id: string) => void;
}) {
  const agenda = useAgenda(entities, today, null);
  const focus = [...agenda.overdue, ...agenda.today];
  if (!focus.length && !agenda.upcoming.length) return null;
  return (
    <section className="fa-todaycard" aria-label="今天的安排">
      <div className="fa-todaycard__head">
        <span className="fa-todaycard__icon" aria-hidden="true">
          <Icon name="today" size={16} />
        </span>
        <div className="fa-todaycard__text">
          <p className="fa-todaycard__title">{friendlyDay(today)}</p>
          <p className="fa-todaycard__sub">
            今天 {agenda.today.length} 项
            {agenda.overdue.length ? <span className="is-late"> · 逾期 {agenda.overdue.length} 项</span> : null}
            {agenda.upcoming.length ? ` · 未来七天 ${agenda.upcoming.length} 项` : ''}
          </p>
        </div>
        <button type="button" className="fa-btn fa-btn--sm" onClick={onToday}>
          打开今天
        </button>
      </div>
      {focus.length > 0 && (
        <ul className="fa-todaycard__list">
          {focus.slice(0, 3).map((e) => {
            const run = getRunWorkflow(e);
            const pr = run ? runProgress(e) : null;
            const late = agenda.overdue.indexOf(e) !== -1;
            const reviewRequired = needsHumanReview(e);
            return (
              <li key={e.id}>
                <button type="button" className="fa-todaycard__item" onClick={() => (run && e.status === 'draft' && !reviewRequired && pr?.nextStep ? onContinue(e.id) : onOpen(e.id))} aria-label={reviewRequired ? `去核对「${e.title}」的 AI 草稿` : undefined}>
                  <Icon name={KIND_ICON[e.kind]} size={14} />
                  <span className="fa-todaycard__item-title">{e.title || '（无标题）'}</span>
                  {late && <span className="fa-todaycard__late">逾期</span>}
                  {reviewRequired && <span className="fa-todaycard__pr">去核对</span>}
                  {pr && pr.total > 0 && (
                    <span className="fa-todaycard__pr">
                      {pr.done + pr.skipped}/{pr.total}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {focus.length > 3 && (
            <li>
              <button type="button" className="fa-link fa-todaycard__more" onClick={onToday}>
                还有 {focus.length - 3} 项
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
