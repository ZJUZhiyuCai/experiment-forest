import { useId, useMemo, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import type { EntityKind, ForestApi, ForestEntity } from '../shared/model';
import { Icon, KIND_ICON } from './icons';
import type { IconName } from './icons';
import {
  AiBadge,
  EmptyState,
  EntityRow,
  FreshDot,
  InlineConfirm,
  Notice,
  Paragraphs,
  RingGlyph,
  StatusNode,
  StatusPill,
} from './bits';
import { CopyToDeepSeek } from './CopyToDeepSeek';
import type { Notify } from './EntityDetail';
import type { Draft } from './drafts';
import {
  CHILD_KINDS,
  KIND,
  byUpdatedDesc,
  classifyError,
  isArchived,
  localDate,
  matchesQuery,
  provenanceOf,
  relativeTime,
  snippet,
  str,
  timelineDate,
} from './forest-model';

export type TabKey = 'all' | EntityKind;

const PROJECT_ORDER: Record<string, number> = { active: 0, planning: 1, paused: 2, completed: 3, archived: 9 };

function childrenOf(entities: ForestEntity[], projectId: string): ForestEntity[] {
  return entities.filter((e) => e.kind !== 'project' && e.projectId === projectId);
}

function lastActivity(project: ForestEntity, children: ForestEntity[]): string {
  let t = project.updatedAt;
  for (const c of children) if (c.updatedAt > t) t = c.updatedAt;
  return t;
}

/* ───────────────────────── 侧栏导航（标准/宽屏） ───────────────────────── */

export function ScopeNav({
  entities,
  scope,
  reviewCount,
  inboxCount,
  onScope,
  onNewProject,
  onData,
  dataOpen,
}: {
  entities: ForestEntity[];
  scope: string;
  reviewCount: number;
  inboxCount: number;
  onScope: (scope: string) => void;
  onNewProject: () => void;
  onData: () => void;
  dataOpen: boolean;
}) {
  const projects = entities
    .filter((e) => e.kind === 'project' && !isArchived(e))
    .sort((a, b) => (PROJECT_ORDER[a.status] ?? 5) - (PROJECT_ORDER[b.status] ?? 5) || a.title.localeCompare(b.title, 'zh-CN'));
  const item = (key: string, label: string, icon: IconName, count?: number, accent?: boolean) => (
    <li>
      <button
        type="button"
        className={`fa-nav__item${scope === key && !dataOpen ? ' is-on' : ''}`}
        aria-current={scope === key && !dataOpen ? 'page' : undefined}
        onClick={() => onScope(key)}
      >
        <Icon name={icon} />
        <span className="fa-nav__label">{label}</span>
        {count ? <span className={`fa-nav__count${accent ? ' is-accent' : ''}`}>{count}</span> : null}
      </button>
    </li>
  );
  return (
    <nav className="fa-nav" aria-label="实验小森林导航">
      <ul className="fa-nav__group">
        {item('home', '林地', 'forest')}
        {reviewCount > 0 && item('review', '待核对', 'spark', reviewCount, true)}
        {inboxCount > 0 && item('inbox', '未归入课题', 'inbox', inboxCount)}
      </ul>
      <div className="fa-nav__heading">
        <span>课题</span>
        <button type="button" className="fa-icon-btn fa-icon-btn--sm" onClick={onNewProject} aria-label="新建课题" title="新建课题">
          <Icon name="plus" size={14} />
        </button>
      </div>
      <ul className="fa-nav__group fa-nav__projects">
        {projects.length === 0 && (
          <li>
            <button type="button" className="fa-nav__item fa-nav__ghost" onClick={onNewProject}>
              <Icon name="plus" />
              <span className="fa-nav__label">新建课题</span>
            </button>
          </li>
        )}
        {projects.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className={`fa-nav__item fa-nav__project${scope === p.id && !dataOpen ? ' is-on' : ''}`}
              aria-current={scope === p.id && !dataOpen ? 'page' : undefined}
              onClick={() => onScope(p.id)}
            >
              <RingGlyph records={childrenOf(entities, p.id).filter((e) => e.kind === 'record')} size={18} />
              <span className="fa-nav__label">{p.title}</span>
            </button>
          </li>
        ))}
      </ul>
      <ul className="fa-nav__group fa-nav__bottom">
        <li>
          <button type="button" className={`fa-nav__item${dataOpen ? ' is-on' : ''}`} onClick={onData} aria-current={dataOpen ? 'page' : undefined}>
            <Icon name="data" />
            <span className="fa-nav__label">导入与导出</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

/* ───────────────────────── 林地（首页） ───────────────────────── */

export function Grove({
  entities,
  freshIds,
  drafts,
  headingRef,
  showArchived,
  onToggleArchived,
  onOpenProject,
  onOpen,
  onNew,
  onScope,
  onData,
  onOpenDraft,
}: {
  entities: ForestEntity[];
  freshIds: Set<string>;
  drafts: Draft[];
  headingRef: RefObject<HTMLHeadingElement>;
  showArchived: boolean;
  onToggleArchived: () => void;
  onOpenProject: (id: string) => void;
  onOpen: (id: string) => void;
  onNew: (kind: EntityKind, projectId: string | null) => void;
  onScope: (scope: string) => void;
  onData: () => void;
  onOpenDraft: (key: string) => void;
}) {
  const uid = useId();
  const allProjects = entities.filter((e) => e.kind === 'project');
  const projects = allProjects
    .filter((p) => showArchived || !isArchived(p))
    .sort((a, b) => (PROJECT_ORDER[a.status] ?? 5) - (PROJECT_ORDER[b.status] ?? 5) || byUpdatedDesc(a, b));
  const archivedCount = allProjects.filter(isArchived).length;
  const review = entities.filter((e) => !isArchived(e) && provenanceOf(e).needsReview).sort(byUpdatedDesc);
  const inbox = entities.filter((e) => e.kind !== 'project' && !e.projectId && !isArchived(e));
  const freshAi = review.filter((e) => freshIds.has(e.id));
  const activeProjects = allProjects.filter((p) => !isArchived(p)).length;
  const recordCount = entities.filter((e) => e.kind === 'record' && !isArchived(e)).length;

  if (entities.length === 0 && drafts.length === 0) {
    return (
      <section className="fa-pane" aria-labelledby={`${uid}-h`}>
        <div className="fa-pane__body fa-pane__body--center">
          <h2 id={`${uid}-h`} ref={headingRef} tabIndex={-1} className="fa-sr">
            林地
          </h2>
          <EmptyState
            title="从一个研究问题开始"
            actions={
              <>
                <button type="button" className="fa-btn fa-btn--primary" onClick={() => onNew('project', null)}>
                  <Icon name="plus" />
                  新建课题
                </button>
                <button type="button" className="fa-btn" onClick={onData}>
                  <Icon name="upload" />
                  导入旧版数据
                </button>
              </>
            }
          >
            <p>课题是你想回答的一个问题。实验记录、计划、SOP、样本和笔记都可以归在它下面。</p>
            <p className="fa-help">也可以在 DeepSeek 对话里请它用 forest_create_draft 起草记录、笔记或 SOP——它们会作为待人工核对的草稿出现在这里。</p>
          </EmptyState>
        </div>
      </section>
    );
  }

  return (
    <section className="fa-pane" aria-labelledby={`${uid}-h`}>
      <div className="fa-pane__body">
        <header className="fa-page-head">
          <div className="fa-page-head__text">
            <h2 id={`${uid}-h`} ref={headingRef} tabIndex={-1} className="fa-page-title">
              林地
            </h2>
            <p className="fa-page-sub">
              {activeProjects} 个课题 · {recordCount} 条实验记录
              {review.length > 0 ? ` · ${review.length} 条待核对` : ''}
            </p>
          </div>
          <button type="button" className="fa-btn fa-btn--primary" onClick={() => onNew('project', null)}>
            <Icon name="plus" />
            新建课题
          </button>
        </header>

        {freshAi.length > 0 && (
          <Notice tone="ai" live title={`DeepSeek 会话里新建了 ${freshAi.length} 条草稿`} actions={<button type="button" className="fa-btn fa-btn--sm" onClick={() => onScope('review')}>去核对</button>}>
            <p>它们来自聊天中的工具调用，状态为草稿，需要你逐条核对。</p>
          </Notice>
        )}

        {drafts.length > 0 && (
          <section className="fa-section" aria-label="未保存的草稿">
            <div className="fa-section__head">
              <h3 className="fa-h3">
                未保存的输入 <span className="fa-count">{drafts.length}</span>
              </h3>
            </div>
            <p className="fa-help fa-unsaved-note">
              暂存在本页内存中：切换侧栏标签或重新打开面板不会丢失，但<strong>关闭或刷新 DeepSeek Harness 会丢失</strong>，请先保存或放弃。
            </p>
            <ul className="fa-mini-list fa-surface">
              {drafts.map((d) => (
                <li key={d.key}>
                  <button type="button" className="fa-mini" onClick={() => onOpenDraft(d.key)}>
                    <span className={`fa-mini__icon fa-kind-${d.kind}`}>
                      <Icon name={KIND_ICON[d.kind]} size={14} />
                    </span>
                    <span className="fa-mini__title">{d.title.trim() || `未命名${KIND[d.kind].label}`}</span>
                    <span className="fa-mini__dir">{d.mode === 'create' ? '新建' : '修改'}</span>
                    {d.phase !== 'editing' && <span className="fa-chip fa-chip--warn">{d.phase === 'saving' ? '保存中' : '需处理'}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {review.length > 0 && (
          <section className="fa-section">
            <div className="fa-section__head">
              <h3 className="fa-h3">
                待核对的 AI 草稿 <span className="fa-count">{review.length}</span>
              </h3>
              {review.length > 4 && (
                <button type="button" className="fa-link" onClick={() => onScope('review')}>
                  全部
                </button>
              )}
            </div>
            <ul className="fa-list fa-surface">
              {review.slice(0, 4).map((e) => (
                <EntityRow key={e.id} entity={e} selected={false} fresh={freshIds.has(e.id)} showKind onSelect={onOpen} />
              ))}
            </ul>
          </section>
        )}

        <section className="fa-section">
          <div className="fa-section__head">
            <h3 className="fa-h3">
              课题 <span className="fa-count">{projects.length}</span>
            </h3>
            {archivedCount > 0 && (
              <label className="fa-toggle">
                <input type="checkbox" checked={showArchived} onChange={onToggleArchived} />
                <span>显示已归档 {archivedCount}</span>
              </label>
            )}
          </div>
          {projects.length === 0 ? (
            <EmptyState
              art={false}
              title="还没有课题"
              actions={
                <button type="button" className="fa-btn fa-btn--primary fa-btn--sm" onClick={() => onNew('project', null)}>
                  <Icon name="plus" />
                  新建课题
                </button>
              }
            />
          ) : (
            <ul className="fa-grove">
              {projects.map((p) => {
                const children = childrenOf(entities, p.id).filter((e) => !isArchived(e));
                const records = children.filter((e) => e.kind === 'record');
                const start = str(p.data, 'startDate');
                const end = str(p.data, 'endDate');
                const pProv = provenanceOf(p);
                return (
                  <li key={p.id}>
                    <button type="button" className={`fa-card fa-tree${isArchived(p) ? ' is-archived' : ''}`} onClick={() => onOpenProject(p.id)}>
                      <span className="fa-tree__top">
                        <RingGlyph records={records} size={36} />
                        <span className="fa-tree__badges">
                          {freshIds.has(p.id) && <FreshDot />}
                          {pProv.isAi && <AiBadge needsReview={pProv.needsReview} />}
                          <StatusPill kind="project" status={p.status} />
                        </span>
                      </span>
                      <span className="fa-tree__title">{p.title}</span>
                      <span className="fa-tree__meta">
                        {(start || end) && (
                          <span className="is-mono">
                            {start || '?'} → {end || '…'}
                          </span>
                        )}
                        <span>{relativeTime(lastActivity(p, children))}更新</span>
                      </span>
                      <span className="fa-tree__counts">
                        {CHILD_KINDS.map((k) => {
                          const n = children.filter((e) => e.kind === k).length;
                          return n ? (
                            <span key={k} className="fa-tree__count" title={`${KIND[k].label} ${n}`}>
                              <Icon name={KIND_ICON[k]} size={12} />
                              {n}
                            </span>
                          ) : null;
                        })}
                        {children.length === 0 && <span className="fa-muted">尚无条目</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {inbox.length > 0 && (
          <button type="button" className="fa-inbox-link" onClick={() => onScope('inbox')}>
            <Icon name="inbox" />
            <span>
              <strong>{inbox.length}</strong> 条内容尚未归入课题
            </span>
            <span className="fa-inbox-link__go">整理</span>
          </button>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── 课题页 ───────────────────────── */

export function ProjectView({
  project,
  api,
  entities,
  freshIds,
  selectedId,
  tab,
  showArchived,
  headingRef,
  applyEntity,
  refresh,
  notify,
  onTab,
  onToggleArchived,
  onSelect,
  onNew,
  onEdit,
  onBack,
}: {
  project: ForestEntity;
  api: ForestApi;
  entities: ForestEntity[];
  freshIds: Set<string>;
  selectedId: string | null;
  tab: TabKey;
  showArchived: boolean;
  headingRef: RefObject<HTMLHeadingElement>;
  applyEntity: (e: ForestEntity) => void;
  refresh: () => Promise<boolean>;
  notify: Notify;
  onTab: (t: TabKey) => void;
  onToggleArchived: () => void;
  onSelect: (id: string) => void;
  onNew: (kind: EntityKind, projectId: string | null) => void;
  onEdit: (e: ForestEntity) => void;
  onBack: () => void;
}) {
  const uid = useId();
  const [filter, setFilter] = useState('');
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const all = useMemo(() => childrenOf(entities, project.id), [entities, project.id]);
  const visible = all.filter((e) => showArchived || !isArchived(e));
  const archivedChildren = all.length - all.filter((e) => !isArchived(e)).length;
  const filtered = visible.filter((e) => (tab === 'all' || e.kind === tab) && matchesQuery(e, filter));
  const records = all.filter((e) => e.kind === 'record');
  const start = str(project.data, 'startDate');
  const end = str(project.data, 'endDate');
  const projArchived = isArchived(project);
  const prov = provenanceOf(project);

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: 'all', label: '时间线', count: visible.length },
    ...CHILD_KINDS.map((k) => ({ key: k as TabKey, label: KIND[k].short, count: visible.filter((e) => e.kind === k).length })),
  ];

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.key === tab);
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      onTab(tabs[next].key);
      const btn = (e.currentTarget.querySelectorAll('[role="tab"]')[next] as HTMLElement | undefined) ?? null;
      btn?.focus();
    }
  };

  const archiveProject = async () => {
    setArchiving(true);
    setArchiveError(null);
    try {
      const saved = await api.archive({ id: project.id, expectedRevision: project.revision });
      applyEntity(saved);
      notify(`已归档课题「${project.title}」`, 'ok');
    } catch (err) {
      const c = classifyError(err);
      setArchiveError(
        c.kind === 'conflict' ? '课题已在别处被修改，归档未执行。请刷新核对后再试。' : c.kind === 'validation' ? c.message : `归档结果不确定（${c.message}），请刷新核对。`,
      );
    } finally {
      setArchiving(false);
    }
  };

  const newKind: EntityKind = tab === 'all' ? 'record' : tab;

  return (
    <section className="fa-pane fa-project" aria-labelledby={`${uid}-h`}>
      <header className="fa-pane__head">
        <button type="button" className="fa-icon-btn" onClick={onBack} aria-label="返回林地" title="返回林地">
          <Icon name="back" />
        </button>
        <nav className="fa-crumbs" aria-label="位置">
          <button type="button" className="fa-crumbs__link" onClick={onBack}>
            林地
          </button>
          <span className="fa-crumbs__sep" aria-hidden="true">
            /
          </span>
          <span className="fa-crumbs__here">{project.title}</span>
        </nav>
        <span className="fa-spacer" />
        <button type="button" className="fa-btn fa-btn--ghost fa-btn--sm" onClick={() => onEdit(project)}>
          <Icon name="edit" />
          编辑
        </button>
      </header>
      <div className="fa-pane__body">
        <div className="fa-hero">
          <RingGlyph records={records} size={52} />
          <div className="fa-hero__text">
            <div className="fa-hero__eyebrow">
              <span>课题</span>
              <StatusPill kind="project" status={project.status} />
              {prov.isAi && <AiBadge needsReview={prov.needsReview} />}
            </div>
            <h2 id={`${uid}-h`} ref={headingRef} tabIndex={-1} className="fa-page-title">
              {project.title}
            </h2>
            <p className="fa-hero__meta">
              <span className="is-mono">{start || end ? `${start || '未填开始'} → ${end || '进行中'}` : '未填写起止日期'}</span>
              {project.tags.length > 0 && (
                <span className="fa-hero__tags">
                  {project.tags.map((t) => (
                    <span key={t} className="fa-tag">
                      {t}
                    </span>
                  ))}
                </span>
              )}
            </p>
          </div>
        </div>

        {projArchived && (
          <Notice tone="info" title="课题已归档">
            <p>不能再把新条目关联到这个课题；已有条目保留原关联。可在“编辑”里改回其他状态以恢复。</p>
          </Notice>
        )}

        {project.content.trim() && (
          <details className="fa-about" open={project.content.length < 280}>
            <summary>研究问题与背景</summary>
            <Paragraphs text={project.content} limit={1200} />
          </details>
        )}

        <div className="fa-toolbar">
          <div className="fa-seg-tabs" role="tablist" aria-label="课题内容" onKeyDown={onTabKey}>
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                id={`${uid}-tab-${t.key}`}
                aria-selected={tab === t.key}
                aria-controls={`${uid}-panel`}
                tabIndex={tab === t.key ? 0 : -1}
                className={`fa-seg-tab${tab === t.key ? ' is-on' : ''}`}
                onClick={() => onTab(t.key)}
              >
                {t.label}
                {t.count > 0 && <span className="fa-seg-tab__count">{t.count}</span>}
              </button>
            ))}
          </div>
          {!projArchived && (
            <button type="button" className="fa-btn fa-btn--primary fa-btn--sm" onClick={() => onNew(newKind, project.id)}>
              <Icon name="plus" />
              新建{KIND[newKind].short}
            </button>
          )}
        </div>

        <div className="fa-listbar">
          <label className="fa-filter">
            <Icon name="search" size={14} />
            <span className="fa-sr">在本课题中筛选</span>
            <input className="fa-filter__input" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="筛选" />
          </label>
          {!projArchived && (
            <div className="fa-quickadd" role="group" aria-label="在本课题下新建">
              {CHILD_KINDS.filter((k) => k !== newKind).map((k) => (
                <button key={k} type="button" className="fa-quickadd__btn" onClick={() => onNew(k, project.id)} title={`新建${KIND[k].label}`}>
                  <Icon name="plus" size={12} />
                  {KIND[k].short}
                </button>
              ))}
            </div>
          )}
          {archivedChildren > 0 && (
            <label className="fa-toggle">
              <input type="checkbox" checked={showArchived} onChange={onToggleArchived} />
              <span>含已归档 {archivedChildren}</span>
            </label>
          )}
        </div>

        <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${tab}`}>
          {visible.length === 0 ? (
            <EmptyState
              title="还没有条目"
              actions={
                !projArchived && (
                  <>
                    <button type="button" className="fa-btn fa-btn--primary" onClick={() => onNew('record', project.id)}>
                      <Icon name="plus" />
                      记录第一次实验
                    </button>
                    <button type="button" className="fa-btn" onClick={() => onNew('plan', project.id)}>
                      写一个计划
                    </button>
                  </>
                )
              }
            >
              <p>实验记录会按日期排进时间线；依据的 SOP、用到的样本都可以在记录里关联。</p>
            </EmptyState>
          ) : filtered.length === 0 ? (
            <p className="fa-muted fa-pad">没有符合条件的条目。</p>
          ) : tab === 'all' ? (
            <GrowthLine items={filtered} freshIds={freshIds} selectedId={selectedId} onSelect={onSelect} />
          ) : (
            <ul className="fa-list fa-surface">
              {filtered
                .slice()
                .sort((a, b) => (timelineDate(b).date > timelineDate(a).date ? 1 : timelineDate(b).date < timelineDate(a).date ? -1 : byUpdatedDesc(a, b)))
                .map((e) => (
                  <EntityRow key={e.id} entity={e} selected={selectedId === e.id} fresh={freshIds.has(e.id)} onSelect={onSelect} />
                ))}
            </ul>
          )}
        </div>

        <footer className="fa-detail__foot">
          <CopyToDeepSeek primary={project} related={visible.filter((e) => !isArchived(e))} project={project} />
          <span className="fa-spacer" />
          {!projArchived && (
            <InlineConfirm
              label="归档课题"
              confirmLabel="确认归档"
              question="归档课题？其中的条目不会被归档。"
              icon="archive"
              busy={archiving}
              onConfirm={() => void archiveProject()}
            />
          )}
        </footer>
        {archiveError && (
          <Notice
            tone="danger"
            live
            title="归档未完成"
            actions={
              <button type="button" className="fa-btn fa-btn--sm" onClick={() => void refresh().then(() => setArchiveError(null))}>
                <Icon name="refresh" />
                刷新核对
              </button>
            }
          >
            <p>{archiveError}</p>
          </Notice>
        )}
      </div>
    </section>
  );
}

/* ───────────────────────── 时间线 ───────────────────────── */

function monthLabel(m: string): string {
  const [y, mo] = m.split('-');
  return `${y}年${Number(mo)}月`;
}

export function GrowthLine({
  items,
  freshIds,
  selectedId,
  onSelect,
}: {
  items: ForestEntity[];
  freshIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const today = localDate();
  const sorted = items
    .map((e) => ({ e, t: timelineDate(e) }))
    .sort((a, b) => (a.t.date < b.t.date ? 1 : a.t.date > b.t.date ? -1 : byUpdatedDesc(a.e, b.e)));
  const months: { month: string; rows: typeof sorted }[] = [];
  for (const row of sorted) {
    const m = row.t.date.slice(0, 7);
    const last = months[months.length - 1];
    if (last && last.month === m) last.rows.push(row);
    else months.push({ month: m, rows: [row] });
  }
  let todayPlaced = false;
  return (
    <ol className="fa-growth" aria-label="时间线：按日期排列的课题条目">
      {months.map(({ month, rows }) => (
        <li key={month} className="fa-growth__month">
          <h4 className="fa-growth__label">{monthLabel(month)}</h4>
          <ol className="fa-growth__items">
            {rows.map(({ e, t }) => {
              const showToday = !todayPlaced && t.date <= today && sorted[0].t.date > today;
              if (showToday) todayPlaced = true;
              const prov = provenanceOf(e);
              return (
                <li key={e.id} className="fa-growth__li">
                  {showToday && (
                    <div className="fa-growth__today" role="separator" aria-label={`今天 ${today}，以上为未来日期`}>
                      <span>今天</span>
                    </div>
                  )}
                  <button
                    type="button"
                    className={`fa-growth__item${selectedId === e.id ? ' is-selected' : ''}${isArchived(e) ? ' is-archived' : ''}${prov.isAi ? ' is-ai' : ''}${t.date > today ? ' is-future' : ''}`}
                    aria-current={selectedId === e.id ? 'true' : undefined}
                    onClick={() => onSelect(e.id)}
                  >
                    <span className="fa-growth__date is-mono" title={t.fromField ? KIND[e.kind].dateLabel ?? '' : '未填写日期，按创建时间排列'}>
                      {Number(t.date.slice(8, 10))}日
                      {!t.fromField && <span className="fa-growth__approx">创建</span>}
                    </span>
                    <span className="fa-growth__rail">
                      <StatusNode kind={e.kind} status={e.status} />
                    </span>
                    <span className={`fa-growth__kind fa-kind-${e.kind}`}>
                      <Icon name={KIND_ICON[e.kind]} size={15} label={KIND[e.kind].label} />
                    </span>
                    <span className="fa-growth__title">{e.title || '（无标题）'}</span>
                    <span className="fa-growth__side">
                      {freshIds.has(e.id) && <FreshDot />}
                      {prov.isAi && <AiBadge needsReview={prov.needsReview} />}
                      <StatusPill kind={e.kind} status={e.status} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ol>
  );
}

/* ───────────────────────── 通用集合（待核对 / 未归课题 / 搜索） ───────────────────────── */

export function CollectionView({
  title,
  icon,
  description,
  items,
  byId,
  freshIds,
  selectedId,
  query,
  headingRef,
  emptyText,
  onSelect,
  onBack,
  grouped,
}: {
  title: string;
  icon: IconName;
  description?: string;
  items: ForestEntity[];
  byId: Map<string, ForestEntity>;
  freshIds: Set<string>;
  selectedId: string | null;
  query?: string;
  headingRef: RefObject<HTMLHeadingElement>;
  emptyText: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  grouped?: boolean;
}) {
  const uid = useId();
  const kinds: EntityKind[] = ['project', ...CHILD_KINDS];
  const groups = grouped ? kinds.map((k) => ({ k, rows: items.filter((e) => e.kind === k) })).filter((g) => g.rows.length) : [{ k: null, rows: items }];
  return (
    <section className="fa-pane" aria-labelledby={`${uid}-h`}>
      <header className="fa-pane__head">
        <button type="button" className="fa-icon-btn" onClick={onBack} aria-label="返回" title="返回（Esc）">
          <Icon name="back" />
        </button>
        <nav className="fa-crumbs" aria-label="位置">
          <span className="fa-crumbs__here">
            <Icon name={icon} size={14} />
            {title}
          </span>
        </nav>
      </header>
      <div className="fa-pane__body">
        <header className="fa-page-head">
          <div className="fa-page-head__text">
            <h2 id={`${uid}-h`} ref={headingRef} tabIndex={-1} className="fa-page-title">
              {title}
            </h2>
            <p className="fa-page-sub">
              {items.length} 条{description ? ` · ${description}` : ''}
            </p>
          </div>
        </header>
        {items.length === 0 ? (
          <EmptyState art={false} title={emptyText} />
        ) : (
          groups.map((g) => (
            <section key={g.k ?? 'all'} className="fa-section">
              {g.k && (
                <h3 className="fa-h3">
                  {KIND[g.k].label} <span className="fa-count">{g.rows.length}</span>
                </h3>
              )}
              <ul className="fa-list fa-surface">
                {g.rows.map((e) => (
                  <li key={e.id} className="fa-row-wrap fa-row-wrap--stack">
                    <ul className="fa-list fa-list--flat">
                      <EntityRow
                        entity={e}
                        selected={selectedId === e.id}
                        fresh={freshIds.has(e.id)}
                        showKind={!grouped}
                        projectTitle={e.projectId ? byId.get(e.projectId)?.title : undefined}
                        onSelect={onSelect}
                      />
                    </ul>
                    {query && e.content && matchesQuery({ ...e, title: '', tags: [], data: {} }, query) && (
                      <p className="fa-snippet">{snippet(e.content, query)}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </section>
  );
}
