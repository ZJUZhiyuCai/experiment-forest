import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { KeyboardEvent, ReactElement } from 'react';
import type { EntityKind, ForestApi, ForestEntity } from '../shared/model';
import { useForest } from './useForest';
import { Icon } from './icons';
import { Notice, Spinner } from './bits';
import { EntityDetail } from './EntityDetail';
import { EntityEditor } from './EntityEditor';
import { DataPanel } from './DataPanel';
import { CollectionView, Grove, ProjectView, ScopeNav } from './views';
import type { TabKey } from './views';
import { TodayView, useAgenda, useLocalDay } from './TodayView';
import { obsidianSummary, useObsidianStatus } from './ObsidianSync';
import type { ActionCtx } from './runActions';
import { createPayload, draftFromEntity, draftMatchesEntity, newDraft, rebase, updatePatch } from './drafts';
import type { Draft } from './drafts';
import * as memory from './draftMemory';
import { byUpdatedDesc, classifyError, formatTime, isArchived, matchesQuery, provenanceOf } from './forest-model';
import { getExperimentPage } from '../shared/page';
import type { OrganizePage } from './material-transfer';
import { ExperimentPageView } from './ExperimentPage';
import { seedPage, supportsPages, useUnsavedPages } from './pageStore';
import { beginPageCreation, clearPageCreation } from './pageCreation';

export interface ForestAppProps {
  api: ForestApi;
  sessionId?: string;
  /**
   * 宿主提供的“理一理”入口：把只含目标页 ID 与整理要求的指令插入/发送到会话。
   * 缺省时实验页诚实地降级为复制指令。
   */
  organizePage?: OrganizePage;
}

type Mode = 'narrow' | 'medium' | 'wide';

interface Nav {
  /** 'home' | 'today' | 'review' | 'inbox' | 课题 ID */
  scope: string;
  selectedId: string | null;
  editorKey: string | null;
  dataOpen: boolean;
  tab: TabKey;
  /** “今天”工作台的课题筛选 */
  agendaProject: string | null;
  /** 从工作台“继续”进入的实验：打开后定位到下一步（一次性） */
  focusNext: string | null;
  /** 旧记录被明确“以实验页打开” */
  pageOpen?: string | null;
  /** 实验页记录切到原详情（状态、归档、关联等原有功能） */
  pageClassic?: string | null;
  /** 宽工作台：实验页占满主区 */
  focus?: boolean;
}

const SPECIAL_SCOPES = new Set(['home', 'today', 'review', 'inbox']);

interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'warn' | 'danger';
}

const HOME: Nav = { scope: 'home', selectedId: null, editorKey: null, dataOpen: false, tab: 'all', agendaProject: null, focusNext: null };

function restoreNav(s: string): Nav {
  const saved = memory.getNav<Partial<Nav>>(s);
  return saved ? { ...HOME, ...saved } : HOME;
}

function modeFor(width: number): Mode {
  if (width >= 1080) return 'wide';
  if (width >= 640) return 'medium';
  return 'narrow';
}

/**
 * 实验小森林 · DeepSeek Harness 右侧栏插件入口。
 * 不挂载路由、不注入全局样式、不访问 localStorage；所有数据来自 props.api。
 */
export function ForestApp({ api, sessionId, organizePage }: ForestAppProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const store = useForest(api, rootRef);
  const { entities, byId } = store;

  /* ── 布局：按容器宽度（而非窗口）适配 ── */
  const [mode, setMode] = useState<Mode>('narrow');
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    setMode(modeFor(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? el.getBoundingClientRect().width;
      setMode(modeFor(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ── 会话：草稿与导航按 sessionId 隔离在模块级内存中，卸载后同会话再挂载可恢复 ── */
  const sessKey = memory.sessionKeyOf(sessionId);
  const sessRef = useRef(sessKey);
  sessRef.current = sessKey;
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ── 导航 ── */
  const [nav, setNav] = useState<Nav>(() => restoreNav(sessKey));
  const [query, setQuery] = useState('');
  /** 中/窄布局：正在输入搜索词时，结果列表接管主区（不再被详情遮住）；打开某条结果后交还给详情 */
  const [searchActive, setSearchActive] = useState(false);
  const [showArchivedProjects, setShowArchivedProjects] = useState(false);
  const [showArchivedChildren, setShowArchivedChildren] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const navigated = useRef(false);

  const go = useCallback((patch: Partial<Nav>) => {
    navigated.current = true;
    setNav((n) => ({ ...n, ...patch }));
  }, []);

  /* ── 草稿：以模块级会话内存为唯一来源（跨导航、跨卸载保留；保存成功/明确放弃即删除） ── */
  const subscribeDrafts = useCallback((cb: () => void) => memory.subscribe(sessKey, cb), [sessKey]);
  const getDraftsSnapshot = useCallback(() => memory.getDrafts(sessKey), [sessKey]);
  const drafts = useSyncExternalStore(subscribeDrafts, getDraftsSnapshot, getDraftsSnapshot);
  /** 读取实时草稿（异步回调中使用，避免闭包里的旧值）；s 默认为当前会话 */
  const draftsRef = useMemo(() => ({ get current() { return memory.getDrafts(sessRef.current); } }), []);
  const putDraft = useCallback((d: Draft, s: string = sessRef.current) => memory.putDraft(s, d), []);
  const dropDraft = useCallback((key: string, s: string = sessRef.current) => memory.dropDraft(s, key), []);
  // 执行清单的步骤输入、“创建实验”请求同样保存在会话内存中，并计入未保存数量与 beforeunload 保护
  const stepDrafts = memory.useSessionSteps(sessKey);
  const runRequests = memory.useSessionRuns(sessKey);
  // 实验页按页面 ID 存放（不按会话），正文由 Host 自动保存；这里只计入尚未被 Host 确认的部分
  const unsavedPages = useUnsavedPages();
  const unsavedCount = useMemo(
    () =>
      Object.values(drafts).filter(memory.hasUnsavedInput).length +
      Object.values(stepDrafts).filter(memory.stepHasUnsaved).length +
      Object.values(runRequests).filter(memory.runHasUnsaved).length +
      unsavedPages.length,
    [drafts, stepDrafts, runRequests, unsavedPages],
  );
  const pagesOk = supportsPages(api);

  /* ── 提示 ── */
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  const notify = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    toastSeq.current += 1;
    const id = toastSeq.current;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    if (tone === 'ok') window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  /* ── 会话恢复 ── */
  const lastSess = useRef(sessKey);
  useEffect(() => {
    // 宿主在挂载期间切换了会话：换到该会话自己的导航（草稿经订阅自动切换）
    if (lastSess.current !== sessKey) {
      lastSess.current = sessKey;
      setNav(restoreNav(sessKey));
      setQuery('');
    }
    memory.recoverSession(sessKey);
  }, [sessKey]);

  // 卸载期间（或上一个实例发起、在本实例挂载后才完成）的保存结果：草稿变化时取出并如实告知
  useEffect(() => {
    memory.takeNotices(sessKey).forEach((text) => notify(text, 'ok'));
  }, [drafts, stepDrafts, runRequests, sessKey, notify]);

  // 记住当前导航（正在编辑/查看的条目），供同会话再挂载时回到原处
  useEffect(() => {
    memory.setNav(sessKey, nav);
  }, [sessKey, nav]);

  /* ── 衍生数据 ── */
  const review = useMemo(() => entities.filter((e) => !isArchived(e) && provenanceOf(e).needsReview).sort(byUpdatedDesc), [entities]);
  const inbox = useMemo(() => entities.filter((e) => e.kind !== 'project' && !e.projectId && !isArchived(e)).sort(byUpdatedDesc), [entities]);

  /* ── 今天：客户端本地日（跨午夜自动更新）与全局安排数量（真实计数） ── */
  const today = useLocalDay();
  const agendaAll = useAgenda(entities, today, null);

  /* ── Obsidian 自动同步状态（只经受控 RPC 读取） ── */
  const obsidian = useObsidianStatus(api);
  const obsidianBadge = obsidianSummary(obsidian);

  /** 未保存输入按条目汇总：步骤输入按实验，创建请求按 SOP */
  const pendingInputs = useMemo(() => {
    const out: { id: string; title: string; label: string; attention: boolean }[] = [];
    const byRun = new Map<string, memory.StepDraft[]>();
    for (const d of Object.values(stepDrafts)) {
      if (!memory.stepHasUnsaved(d)) continue;
      byRun.set(d.runId, [...(byRun.get(d.runId) ?? []), d]);
    }
    byRun.forEach((list, runId) =>
      out.push({
        id: runId,
        title: byId.get(runId)?.title ?? runId,
        label: `${list.length} 步未保存`,
        attention: list.some((d) => d.phase !== 'editing'),
      }),
    );
    for (const r of Object.values(runRequests)) {
      if (!memory.runHasUnsaved(r)) continue;
      out.push({ id: r.sopId, title: byId.get(r.sopId)?.title ?? r.sopId, label: r.phase === 'editing' ? '创建表单未提交' : r.phase === 'creating' ? '正在创建实验' : '创建实验待处理', attention: r.phase !== 'editing' });
    }
    for (const p of unsavedPages) out.push({ id: p.id, title: byId.get(p.id)?.title || p.title, label: p.label, attention: p.attention });
    return out;
  }, [stepDrafts, runRequests, byId, unsavedPages]);
  const unsavedRuns = useMemo(() => new Set(pendingInputs.filter((p) => byId.get(p.id)?.kind === 'record').map((p) => p.id)), [pendingInputs, byId]);
  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return entities
      .filter((e) => matchesQuery(e, q))
      .sort((a, b) => Number(isArchived(a)) - Number(isArchived(b)) || byUpdatedDesc(a, b))
      .slice(0, 200);
  }, [entities, query]);

  /* ── 选中条目不在快照中时（例如被过滤或刚创建），单独读取一次 ── */
  const [fetched, setFetched] = useState<Record<string, ForestEntity | null | 'loading' | 'error'>>({});
  useEffect(() => {
    const id = nav.selectedId;
    if (!id || byId.has(id) || store.phase !== 'ready' || fetched[id] !== undefined) return;
    setFetched((f) => ({ ...f, [id]: 'loading' }));
    api.get(id).then(
      (e) => setFetched((f) => ({ ...f, [id]: e })),
      () => setFetched((f) => ({ ...f, [id]: 'error' })),
    );
  }, [nav.selectedId, byId, store.phase, fetched, api]);

  const selected: ForestEntity | null = nav.selectedId
    ? byId.get(nav.selectedId) ?? (typeof fetched[nav.selectedId] === 'object' ? (fetched[nav.selectedId] as ForestEntity | null) : null)
    : null;

  useEffect(() => {
    if (nav.selectedId) store.markSeen(nav.selectedId);
  }, [nav.selectedId, store]);

  /* ── 导航动作 ── */
  const open = useCallback(
    (id: string) => {
      const e = byId.get(id);
      setSearchActive(false);
      if (e && e.kind === 'project') {
        go({ scope: id, selectedId: null, editorKey: null, dataOpen: false, tab: 'all' });
        store.markSeen(id);
      } else {
        go({ selectedId: id, editorKey: null, dataOpen: false, pageClassic: null, pageOpen: null });
      }
    },
    [byId, go, store],
  );
  const openProject = useCallback((id: string) => go({ scope: id, selectedId: null, editorKey: null, dataOpen: false, tab: 'all' }), [go]);
  const openScope = useCallback((scope: string) => {
    setQuery('');
    go({ scope, selectedId: null, editorKey: null, dataOpen: false, tab: 'all' });
  }, [go]);

  /** 从工作台“继续”：打开实验并定位到下一步 */
  const continueRun = useCallback((id: string) => go({ selectedId: id, editorKey: null, dataOpen: false, focusNext: id }), [go]);

  /**
   * 执行动作（逐步保存、创建实验）的上下文。动作把结果写回发起时的会话内存；
   * 面板已卸载或已切到别的会话时，提示与导航留给该会话下次挂载。
   */
  const actions = useMemo<ActionCtx>(
    () => ({
      api,
      applyEntity: (e) => {
        if (mountedRef.current) store.applyEntity(e);
      },
      refresh: () => store.refresh(),
      notify: (s, text, tone = 'ok') => {
        if (mountedRef.current && sessRef.current === s) notify(text, tone);
        else memory.pushNotice(s, text);
      },
      openCreated: (s, e) => {
        const text = `已创建实验草稿「${e.title}」，并冻结了所用 SOP 版本`;
        const patch = (n: Nav): Nav => ({ ...n, selectedId: e.id, editorKey: null, dataOpen: false, focusNext: null });
        if (mountedRef.current && sessRef.current === s) {
          navigated.current = true;
          setNav(patch);
          notify(text, 'ok');
        } else {
          memory.setNav(s, patch(restoreNav(s)));
          memory.pushNotice(s, text);
        }
      },
    }),
    [api, store, notify],
  );

  /* ── 新建实验页：立即 createPage 拿到 ID，正文随后自动保存 ── */
  const [creatingPage, setCreatingPage] = useState(false);
  const openPage = useCallback(
    (e: ForestEntity) => {
      store.applyEntity(e);
      setQuery('');
      setSearchActive(false);
      go({ selectedId: e.id, editorKey: null, dataOpen: false, pageClassic: null, pageOpen: null });
    },
    [store, go],
  );
  const createPage = useCallback(
    async (projectId: string | null) => {
      if (creatingPage) return;
      setCreatingPage(true);
      const session=sessKey;
      const attempt=beginPageCreation(api,session,projectId),req=attempt.input;
      const openResult=(entity:ForestEntity)=>{
        if(mountedRef.current&&sessRef.current===session)openPage(entity);
        else memory.setNav(session,{...restoreNav(session),selectedId:entity.id,editorKey:null,dataOpen:false,pageClassic:null,pageOpen:null});
      };
      try {
        const view = await attempt.result;
        clearPageCreation(session,req.requestId);
        seedPage(api, view);
        openResult(view.entity);
      } catch (err) {
        const c = classifyError(err);
        if (c.kind === 'network' || c.kind === 'unknown') {
          // 不盲目重建：按 creationRequestId 核对这一页是否其实已经建好
          try {
            const records = await api.list({ kind: 'record', includeArchived: true });
            const found = records.find((e) => getExperimentPage(e)?.creationRequestId === req.requestId);
            if (found) {
              clearPageCreation(session,req.requestId);
              openResult(found);
              notify('核对结果：这一页其实已经建好了', 'ok');
            } else notify(`新建结果不确定（${c.message}）。已核对：还没有建成。再点一次会沿用同一个请求号，不会重复建页。`, 'warn');
          } catch {
            notify(`新建结果不确定（${c.message}），核对也没有成功。稍后再点“新建实验页”，会沿用同一个请求号重试。`, 'danger');
          }
        } else {
          clearPageCreation(session,req.requestId);
          notify(`没有建成：${c.message}`, 'danger');
        }
      } finally {
        if(mountedRef.current&&sessRef.current===session)setCreatingPage(false);
      }
    },
    [api, creatingPage, openPage, notify, sessKey],
  );

  const startNew = useCallback(
    (kind: EntityKind, projectId: string | null) => {
      // 记录的主路径是自由编辑的实验页；宿主没有页面接口时退回原表单
      if (kind === 'record' && pagesOk) {
        void createPage(projectId);
        return;
      }
      const d = newDraft(kind, projectId);
      putDraft(d);
      go({ editorKey: d.key, dataOpen: false });
    },
    [go, putDraft, pagesOk, createPage],
  );

  const startEdit = useCallback(
    (e: ForestEntity) => {
      // 实验页的正文由块生成，不走旧表单（旧表单会把整个 data 写回）
      if (e.kind === 'record' && getExperimentPage(e)) {
        go({ selectedId: e.id, editorKey: null, dataOpen: false, pageClassic: null });
        return;
      }
      const existing = draftsRef.current[e.id];
      // 有未保存输入的草稿原样恢复（保留其基线 revision，以便冲突检测）；没有改动且基线已过期的草稿换成最新版本
      if (!existing || (!memory.hasUnsavedInput(existing) && existing.base?.revision !== e.revision)) putDraft(draftFromEntity(e));
      go({ editorKey: e.id, dataOpen: false, selectedId: e.kind === 'project' ? nav.selectedId : e.id });
    },
    [go, putDraft, nav.selectedId],
  );

  const back = useCallback(() => {
    // 搜索结果接管着中/窄布局时，先交还给刚才的详情
    if (mode !== 'wide' && searchActive && query.trim() && (nav.selectedId || nav.editorKey || nav.dataOpen)) return setSearchActive(false);
    if (nav.dataOpen) return go({ dataOpen: false });
    if (nav.editorKey) {
      const d = draftsRef.current[nav.editorKey];
      // 没有任何改动的草稿直接清理，避免出现在“未保存的草稿”里造成误会
      if (d && !memory.hasUnsavedInput(d)) dropDraft(d.key);
      return go({ editorKey: null, selectedId: d?.mode === 'edit' && d.kind !== 'project' ? d.id ?? null : nav.selectedId });
    }
    if (nav.selectedId) return go({ selectedId: null, pageOpen: null, pageClassic: null, focus: false });
    if (query) return setQuery('');
    if (nav.scope !== 'home') return go({ scope: 'home', tab: 'all' });
  }, [nav, go, query, draftsRef, dropDraft, mode, searchActive]);

  /* ── 保存流程 ── */
  const afterSaved = useCallback(
    (s: string, key: string, saved: ForestEntity, text: string) => {
      // 先删除会话内存中的草稿：无论面板此刻是否仍挂载，已保存的输入都不会被再次恢复
      dropDraft(key, s);
      const finish = (n: Nav): Nav => {
        if (n.editorKey !== key) return n;
        if (saved.kind === 'project') return { ...n, editorKey: null, scope: saved.id, selectedId: null, tab: 'all' };
        const scope = n.scope === 'home' && saved.projectId ? saved.projectId : n.scope;
        return { ...n, editorKey: null, selectedId: saved.id, scope };
      };
      if (!mountedRef.current || sessRef.current !== s) {
        // 面板已卸载或已切到别的会话：结果留给该会话下次挂载时显示
        const n = memory.getNav<Nav>(s);
        if (n) memory.setNav(s, finish(n));
        memory.pushNotice(s, text);
        return;
      }
      store.applyEntity(saved);
      notify(text, 'ok');
      setNav(finish);
    },
    [store, dropDraft, notify],
  );

  /** 读取某会话中的实时草稿 */
  const live = (s: string, key: string): Draft | undefined => memory.getDrafts(s)[key];

  const loadLatest = useCallback(
    async (key: string, s: string = sessRef.current) => {
      const d = live(s, key);
      if (!d || !d.id) return;
      try {
        const latest = await api.get(d.id);
        const cur = live(s, key);
        if (cur !== d) return;
        if (!latest) putDraft({ ...cur, phase: 'error', message: '这条内容在服务端已不存在，无法保存修改。请复制你的输入后放弃草稿。' }, s);
        else {
          if (mountedRef.current) store.applyEntity(latest);
          putDraft({ ...cur, phase: 'conflict', latest }, s);
        }
      } catch (err) {
        const cur = live(s, key);
        if (cur !== d) return;
        putDraft({ ...cur, phase: 'conflict', latest: null, message: `读取最新版本失败：${classifyError(err).message}` }, s);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, putDraft, store],
  );

  const save = useCallback(
    async (key: string) => {
      // 记下发起保存时的会话：之后即使面板卸载或宿主切换会话，结果也写回原会话
      const s = sessRef.current;
      const d = live(s, key);
      if (!d || d.phase === 'saving' || memory.isInflight(s, key)) return;
      const attemptedAt = new Date(Date.now() - 10_000).toISOString();
      const pending: Draft = { ...d, phase: 'saving', message: undefined, rebasedFrom: undefined, attemptedAt };
      putDraft(pending, s);
      memory.markInflight(s, key, true);
      try {
        const saved =
          d.mode === 'create'
            ? await api.create(createPayload(d))
            : await api.update({ id: d.id as string, expectedRevision: (d.base as ForestEntity).revision, patch: updatePatch(d) });
        if (live(s, key) !== pending) { store.applyEntity(saved); return; }
        afterSaved(s, key, saved, `已保存「${saved.title}」`);
      } catch (err) {
        const c = classifyError(err);
        const cur = live(s, key);
        if (cur !== pending) return;
        if (c.kind === 'conflict' && d.mode === 'edit') {
          putDraft({ ...cur, phase: 'conflict', message: c.message, latest: null }, s);
          void loadLatest(key, s);
        } else if (c.kind === 'validation' || c.kind === 'notfound' || (c.kind === 'conflict' && d.mode === 'create')) {
          putDraft({ ...cur, phase: 'error', message: c.message }, s);
        } else {
          // 网络/传输失败：不自动重试，避免重复记录
          putDraft({ ...cur, phase: 'uncertain', message: c.message, checked: false, suspects: undefined, exactMatches: undefined, attemptedAt }, s);
        }
      } finally {
        memory.markInflight(s, key, false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, afterSaved, putDraft, loadLatest],
  );

  /**
   * “结果不确定”后的核对。判定一律使用真实完整值（标题/状态/课题/标签逐值、正文全文严格相等、
   * data 按完整 JSON 值严格比较含未知字段），绝不使用冲突对照里的展示摘要；不一致就交给用户判断，不自动丢弃草稿。
   */
  const checkUncertain = useCallback(
    async (key: string) => {
      const s = sessRef.current;
      const d = live(s, key);
      if (!d) return;
      void store.refresh();
      try {
        if (d.mode === 'create') {
          const same = await api.list({ kind: d.kind, includeArchived: true });
          const title = d.title.trim();
          const since = d.attemptedAt ?? new Date(0).toISOString();
          const found = same.filter((e) => e.title.trim() === title && e.createdAt >= since);
          found.forEach((e) => store.applyEntity(e));
          const cur = live(s, key);
        if (cur !== d) return;
          putDraft(
            {
              ...cur,
              checked: true,
              suspects: found.map((e) => e.id),
              exactMatches: found.filter((e) => draftMatchesEntity(cur, e)).map((e) => e.id),
            },
            s,
          );
        } else {
          const latest = await api.get(d.id as string);
          const cur = live(s, key);
        if (cur !== d) return;
          if (!latest) {
            putDraft({ ...cur, phase: 'error', message: '这条内容在服务端已不存在。' }, s);
            return;
          }
          store.applyEntity(latest);
          const base = cur.base as ForestEntity;
          if (latest.revision === base.revision) {
            putDraft({ ...cur, phase: 'editing', message: '核对结果：服务端仍是原版本，你的修改尚未保存，可以再次保存。' }, s);
          } else if (draftMatchesEntity(cur, latest)) {
            afterSaved(s, key, latest, '核对结果：服务端内容与你的草稿完全一致，修改已经保存。');
          } else {
            putDraft({ ...cur, phase: 'conflict', latest, message: undefined }, s);
          }
        }
      } catch (err) {
        if (live(s, key) !== d) return;
        putDraft({ ...d, message: `核对失败：${classifyError(err).message}。请稍后再试。` }, s);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, putDraft, store, afterSaved],
  );

  /** 用户确认“核对出的那条就是此前已保存的结果”：清理草稿并打开该条目 */
  const confirmSaved = useCallback(
    (key: string, id: string) => {
      const s = sessRef.current;
      const e = byId.get(id);
      if (e) afterSaved(s, key, e, `已确认「${e.title}」此前已保存成功，草稿已清理。`);
    },
    [byId, afterSaved],
  );

  /* ── 焦点管理：视图切换后把焦点移到新视图标题（首次加载不抢宿主焦点） ── */
  const scopeHeading = useRef<HTMLHeadingElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const dataHeading = useRef<HTMLHeadingElement>(null);
  const editorDraft = nav.editorKey ? drafts[nav.editorKey] : undefined;
  const focusKey = `${nav.dataOpen}|${nav.editorKey && editorDraft ? nav.editorKey : ''}|${nav.selectedId ?? ''}|${nav.scope}`;
  useEffect(() => {
    if (!navigated.current) return;
    const target = nav.dataOpen
      ? dataHeading
      : editorDraft
        ? editorDraft.mode === 'create'
          ? null // 新建时焦点交给标题输入框（autoFocus）
          : editorHeading
        : nav.selectedId
          ? detailHeading
          : scopeHeading;
    target?.current?.focus({ preventScroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  // 编辑器指向的草稿被丢弃后，关闭编辑器
  useEffect(() => {
    if (nav.editorKey && !drafts[nav.editorKey]) setNav((n) => ({ ...n, editorKey: null }));
  }, [drafts, nav.editorKey]);

  /* ── 键盘 ── */
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
      return;
    }
    if (e.key === '/' && !typing) {
      e.preventDefault();
      searchRef.current?.focus();
      return;
    }
    if (e.key === 'Escape' && !e.defaultPrevented) {
      if (t === searchRef.current && query) {
        setQuery('');
        return;
      }
      back();
    }
  };

  /* ── 视图组装 ── */
  const projectOf = (id: string) => byId.get(id) ?? null;
  const scopeProject = !SPECIAL_SCOPES.has(nav.scope) ? projectOf(nav.scope) : null;

  let scopeView: ReactElement;
  if (query.trim()) {
    scopeView = (
      <CollectionView
        title={`搜索“${query.trim()}”`}
        icon="search"
        description={results.length >= 200 ? '只显示前 200 条结果，请输入更具体的关键词。' : '匹配标题、正文、标签和专业字段（含已归档条目，排在最后）。'}
        items={results}
        byId={byId}
        freshIds={store.freshIds}
        selectedId={nav.selectedId}
        query={query}
        headingRef={scopeHeading}
        emptyText="没有找到匹配的条目"
        onSelect={open}
        onBack={() => (mode !== 'wide' && (nav.selectedId || nav.editorKey) ? setSearchActive(false) : setQuery(''))}
        grouped
      />
    );
  } else if (nav.scope === 'today') {
    scopeView = (
      <TodayView
        entities={entities}
        byId={byId}
        today={today}
        projectId={nav.agendaProject}
        freshIds={store.freshIds}
        selectedId={nav.selectedId}
        unsavedRuns={unsavedRuns}
        headingRef={scopeHeading}
        onProject={(agendaProject) => setNav((n) => ({ ...n, agendaProject }))}
        onOpen={open}
        onContinue={continueRun}
        onBack={() => openScope('home')}
      />
    );
  } else if (nav.scope === 'review') {
    scopeView = (
      <CollectionView
        title="待核对的 AI 草稿"
        icon="spark"
        description="来源为 DeepSeek Harness 会话（provenance.source = deepseek-harness）且审阅状态不是“已核对”的条目。打开后逐项核对，勾选确认即可记录为已核对；来源始终保留。"
        items={review}
        byId={byId}
        freshIds={store.freshIds}
        selectedId={nav.selectedId}
        headingRef={scopeHeading}
        emptyText="没有待核对的 AI 草稿"
        onSelect={open}
        onBack={() => openScope('home')}
      />
    );
  } else if (nav.scope === 'inbox') {
    scopeView = (
      <CollectionView
        title="未归入课题"
        icon="inbox"
        description="这些条目没有关联课题（常见于旧版导入或 AI 草稿）。打开后可在“编辑”中选择课题。"
        items={inbox}
        byId={byId}
        freshIds={store.freshIds}
        selectedId={nav.selectedId}
        headingRef={scopeHeading}
        emptyText="所有条目都已归入课题"
        onSelect={open}
        onBack={() => openScope('home')}
        grouped
      />
    );
  } else if (scopeProject) {
    scopeView = (
      <ProjectView
        project={scopeProject}
        api={api}
        entities={entities}
        freshIds={store.freshIds}
        selectedId={nav.selectedId}
        tab={nav.tab}
        showArchived={showArchivedChildren}
        headingRef={scopeHeading}
        applyEntity={store.applyEntity}
        refresh={store.refresh}
        notify={notify}
        onTab={(tab) => go({ tab })}
        pageMode={pagesOk}
        onToggleArchived={() => setShowArchivedChildren((v) => !v)}
        onSelect={open}
        onNew={startNew}
        onEdit={startEdit}
        onBack={() => openScope('home')}
        today={today}
        onAgenda={(projectId) => {
          setQuery('');
          go({ scope: 'today', agendaProject: projectId, selectedId: null, editorKey: null, dataOpen: false });
        }}
      />
    );
  } else if (nav.scope !== 'home' && store.phase === 'ready') {
    scopeView = (
      <section className="fa-pane">
        <div className="fa-pane__body">
          <h2 ref={scopeHeading} tabIndex={-1} className="fa-sr">
            课题不存在
          </h2>
          <Notice tone="warn" title="没有找到这个课题" actions={<button type="button" className="fa-btn fa-btn--sm" onClick={() => openScope('home')}>回到林地</button>}>
            <p>它可能尚未同步。可以点右上角刷新。</p>
          </Notice>
        </div>
      </section>
    );
  } else {
    scopeView = (
      <Grove
        entities={entities}
        freshIds={store.freshIds}
        drafts={Object.values(drafts).filter(memory.hasUnsavedInput)}
        headingRef={scopeHeading}
        showArchived={showArchivedProjects}
        onToggleArchived={() => setShowArchivedProjects((v) => !v)}
        onOpenProject={openProject}
        onOpen={open}
        onNew={startNew}
        onNewPage={pagesOk ? () => void createPage(null) : undefined}
        creatingPage={creatingPage}
        onScope={openScope}
        onData={() => go({ dataOpen: true })}
        onOpenDraft={(key) => {
          const d = draftsRef.current[key];
          go({ editorKey: key, selectedId: d?.mode === 'edit' && d.kind !== 'project' ? d.id ?? null : null });
        }}
        pendingInputs={pendingInputs}
        today={today}
        onContinue={continueRun}
      />
    );
  }

  let detailView: ReactElement | null = null;
  if (editorDraft) {
    detailView = (
      <EntityEditor
        key={editorDraft.key}
        draft={editorDraft}
        entities={entities}
        byId={byId}
        headingRef={editorHeading}
        onChange={putDraft}
        onSave={() => void save(editorDraft.key)}
        onClose={back}
        onDiscard={() => {
          const d = editorDraft;
          dropDraft(d.key);
          go({ editorKey: null, selectedId: d.mode === 'edit' && d.kind !== 'project' ? d.id ?? null : nav.selectedId });
        }}
        onLoadLatest={() => void loadLatest(editorDraft.key)}
        onRebase={() => {
          const d = draftsRef.current[editorDraft.key];
          if (d?.latest) putDraft(rebase(d, d.latest));
        }}
        onCheckUncertain={() => void checkUncertain(editorDraft.key)}
        onConfirmSaved={(id) => confirmSaved(editorDraft.key, id)}
        onOpen={open}
      />
    );
  } else if (
    selected &&
    selected.kind === 'record' &&
    (getExperimentPage(selected) || nav.pageOpen === selected.id) &&
    nav.pageClassic !== selected.id
  ) {
    detailView = (
      <ExperimentPageView
        key={selected.id}
        api={api}
        entityId={selected.id}
        entities={entities}
        headingRef={detailHeading}
        obsidian={obsidian}
        organizePage={organizePage}
        notify={notify}
        applyEntity={store.applyEntity}
        onClose={() => go({ selectedId: null, pageOpen: null, focus: false })}
        onOpenProject={openProject}
        onClassic={() => go({ pageClassic: selected.id })}
        onOpenData={() => go({ dataOpen: true })}
        focus={mode === 'wide' ? { on: !!nav.focus, toggle: () => go({ focus: !nav.focus }) } : undefined}
      />
    );
  } else if (selected && selected.kind !== 'project') {
    const pageRecord = selected.kind === 'record' && !!getExperimentPage(selected);
    detailView = (
      <EntityDetail
        pageMode={pageRecord}
        onOpenPage={selected.kind === 'record' && pagesOk ? () => go({ pageOpen: selected.id, pageClassic: null }) : undefined}
        key={selected.id}
        entity={selected}
        api={api}
        entities={entities}
        byId={byId}
        hasDraft={!!drafts[selected.id] && memory.hasUnsavedInput(drafts[selected.id])}
        headingRef={detailHeading}
        applyEntity={store.applyEntity}
        refresh={store.refresh}
        notify={notify}
        onEdit={startEdit}
        onOpen={open}
        onOpenProject={openProject}
        onClose={() => go({ selectedId: null })}
        sessKey={sessKey}
        actions={actions}
        focusNextStep={nav.focusNext === selected.id}
        onFocusedNextStep={() => setNav((n) => (n.focusNext ? { ...n, focusNext: null } : n))}
      />
    );
  } else if (nav.selectedId && !selected) {
    const f = fetched[nav.selectedId];
    detailView = (
      <section className="fa-pane">
        <div className="fa-pane__body fa-pane__body--center">
          <h2 ref={detailHeading} tabIndex={-1} className="fa-sr">
            条目
          </h2>
          {f === 'loading' || f === undefined ? (
            <Spinner label="正在读取条目…" />
          ) : (
            <Notice tone="warn" title={f === 'error' ? '读取失败' : '没有找到这个条目'} actions={<button type="button" className="fa-btn fa-btn--sm" onClick={() => go({ selectedId: null })}>返回</button>}>
              <p>{f === 'error' ? '网络或服务端出错，请稍后刷新。' : '它可能已被移除或尚未同步。'}</p>
            </Notice>
          )}
        </div>
      </section>
    );
  }

  const dataView = nav.dataOpen ? (
    <DataPanel api={api} entities={entities} headingRef={dataHeading} refresh={store.refresh} notify={notify} obsidian={obsidian} onClose={() => go({ dataOpen: false })} />
  ) : null;

  /* ── 外壳 ── */
  const loading = store.phase === 'loading';
  const failed = store.phase === 'error';
  // 宽布局列表与详情并排，不存在遮挡；中/窄布局输入搜索词时由结果接管
  const searchTakeover = mode !== 'wide' && searchActive && !!query.trim();
  const detailIsPage = !!detailView && detailView.type === ExperimentPageView;
  const pageFocus = mode === 'wide' && detailIsPage && !!nav.focus && !dataView;

  let body: ReactElement;
  if (loading) {
    body = (
      <div className="fa-boot">
        <Spinner label="正在打开实验小森林…" />
      </div>
    );
  } else if (failed) {
    body = (
      <div className="fa-boot">
        <Notice
          tone="danger"
          live
          title="无法读取实验数据"
          actions={
            <button type="button" className="fa-btn fa-btn--primary fa-btn--sm" onClick={() => void store.refresh()}>
              <Icon name="refresh" />
              重试
            </button>
          }
        >
          <p>{store.loadError}</p>
          <p className="fa-help">没有显示任何示例数据。服务恢复后点击重试即可。</p>
        </Notice>
      </div>
    );
  } else if (mode === 'narrow') {
    body = <main className="fa-main">{searchTakeover ? scopeView : dataView ?? detailView ?? scopeView}</main>;
  } else {
    const navEl = (
      <ScopeNav
        entities={entities}
        scope={query.trim() ? '' : nav.scope}
        reviewCount={review.length}
        inboxCount={inbox.length}
        onScope={openScope}
        onNewProject={() => startNew('project', null)}
        onNewPage={pagesOk ? () => void createPage(SPECIAL_SCOPES.has(nav.scope) ? null : nav.scope) : undefined}
        creatingPage={creatingPage}
        onData={() => go({ dataOpen: !nav.dataOpen })}
        dataOpen={nav.dataOpen}
        todayCount={agendaAll.today.length + agendaAll.overdue.length}
        todayLate={agendaAll.overdue.length > 0}
        obsidian={obsidianBadge}
      />
    );
    body =
      mode === 'medium' ? (
        <>
          {navEl}
          <main className="fa-main">{searchTakeover ? scopeView : dataView ?? detailView ?? scopeView}</main>
        </>
      ) : (
        <>
          {navEl}
          <main className={`fa-main${detailView && !dataView ? ' has-aside' : ''}${pageFocus ? ' is-focus' : ''}`}>
            <div className="fa-col">{dataView ?? scopeView}</div>
            {detailView && !dataView && <div className={`fa-col fa-col--aside${detailIsPage ? ' is-page' : ''}`}>{detailView}</div>}
          </main>
        </>
      );
  }


  return (
    <div ref={rootRef} className="forest-app" data-mode={mode} data-session={sessionId || undefined} onKeyDown={onKeyDown}>
      <header className="fa-top">
        <button type="button" className="fa-brand" onClick={() => openScope('home')} title="回到林地">
          <span className="fa-brand__mark" aria-hidden="true">
            <Icon name="sprout" size={15} />
          </span>
          <span className="fa-brand__name">实验小森林</span>
        </button>
        <label className="fa-search">
          <Icon name="search" size={14} />
          <span className="fa-sr">搜索课题、记录、SOP、样本、笔记、计划</span>
          <input
            ref={searchRef}
            className="fa-search__input"
            type="search"
            value={query}
            placeholder="搜索"
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchActive(true);
              navigated.current = true;
            }}
            onFocus={() => {
              if (query.trim()) setSearchActive(true);
            }}
          />
          {!query && (
            <kbd className="fa-kbd" aria-hidden="true">
              ⌘K
            </kbd>
          )}
          {query.trim() && (
            <span className="fa-search__count" aria-live="polite">
              {results.length >= 200 ? '200+' : results.length} 条
            </span>
          )}
        </label>
        {unsavedCount > 0 && (
          <button
            type="button"
            className="fa-unsaved"
            onClick={() => openScope('home')}
            title="这些输入保存在本页内存中：切换侧栏标签不会丢失，但关闭或刷新 DeepSeek Harness 会丢失。请先保存或放弃。"
            aria-label={`${unsavedCount} 份未保存的输入，关闭或刷新宿主前请先保存。点击查看`}
          >
            <span className="fa-unsaved__dot" aria-hidden="true" />
            <span className="fa-unsaved__text">{unsavedCount} 份未保存</span>
          </button>
        )}
        <SyncState store={store} />
        {mode === 'narrow' && (
          <button
            type="button"
            className={`fa-icon-btn fa-today-btn${nav.scope === 'today' && !nav.dataOpen && !query.trim() ? ' is-on' : ''}`}
            onClick={() => openScope('today')}
            aria-label={`今天：${agendaAll.today.length} 项今天，${agendaAll.overdue.length} 项逾期`}
            title="今天"
          >
            <Icon name="today" />
            {agendaAll.today.length + agendaAll.overdue.length > 0 && (
              <span className={`fa-today-btn__n${agendaAll.overdue.length ? ' is-late' : ''}`} aria-hidden="true">
                {agendaAll.today.length + agendaAll.overdue.length}
              </span>
            )}
          </button>
        )}
        {mode === 'narrow' && (
          <button
            type="button"
            className={`fa-icon-btn fa-data-btn${nav.dataOpen ? ' is-on' : ''}`}
            onClick={() => go({ dataOpen: !nav.dataOpen })}
            aria-label={`同步与导出（Obsidian：${obsidianBadge.label}）`}
            aria-pressed={nav.dataOpen}
            title={`同步与导出 · Obsidian：${obsidianBadge.label}`}
          >
            <Icon name="data" />
            {obsidianBadge.tone !== 'off' && <span className={`fa-nav__obs is-${obsidianBadge.tone}`} aria-hidden="true" />}
          </button>
        )}
      </header>

      {store.phase === 'ready' && store.syncError && (
        <div className="fa-syncbar" role="status">
          <Icon name="alert" size={14} />
          <span>
            刷新失败：{store.syncError}。正在显示 {store.lastSyncedAt ? formatTime(store.lastSyncedAt) : '上次'} 的数据
            {unsavedCount ? '，你未保存的输入不受影响' : ''}。
          </span>
          <button type="button" className="fa-link" onClick={() => void store.refresh()}>
            重试
          </button>
        </div>
      )}

      <div className="fa-body">{body}</div>

      <div className="fa-toasts" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <div key={t.id} className={`fa-toast fa-toast--${t.tone}`} role={t.tone === 'danger' ? 'alert' : undefined}>
            <Icon name={t.tone === 'ok' ? 'check' : 'alert'} size={14} />
            <span>{t.text}</span>
            <button type="button" className="fa-icon-btn fa-icon-btn--sm" aria-label="关闭提示" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
              <Icon name="close" size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SyncState({ store }: { store: ReturnType<typeof useForest> }) {
  const label = store.syncing
    ? '同步中'
    : store.syncError
      ? '同步失败'
      : store.lastSyncedAt
        ? `已同步 ${formatTime(store.lastSyncedAt).slice(0, 5)}`
        : '未同步';
  const tone = store.syncError ? 'is-bad' : store.syncing ? 'is-busy' : 'is-ok';
  return (
    <button
      type="button"
      className={`fa-sync ${tone}`}
      onClick={() => void store.refresh()}
      disabled={store.syncing}
      title={`${store.lastSyncedAt && !store.syncing && !store.syncError ? `已同步 ${formatTime(store.lastSyncedAt)}` : label}${store.revision !== null ? ` · 数据修订 r${store.revision}` : ''}。点击立即刷新（面板可见时每 5 秒自动刷新）`}
      aria-label={`${label}，点击立即刷新`}
    >
      <span className="fa-sync__dot" aria-hidden="true" />
      <span className="fa-sync__text">{label}</span>
      <Icon name="refresh" size={14} />
    </button>
  );
}
