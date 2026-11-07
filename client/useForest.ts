import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { ForestApi, ForestEntity } from '../shared/model';
import { classifyError } from './forest-model';

export type LoadPhase = 'loading' | 'ready' | 'error';

export interface ForestStore {
  entities: ForestEntity[];
  byId: Map<string, ForestEntity>;
  /** 首次加载阶段；之后的轮询失败不会把它变回 error（已显示的数据保留） */
  phase: LoadPhase;
  loadError: string | null;
  syncing: boolean;
  /** 最近一次刷新失败的原因；成功后清除 */
  syncError: string | null;
  lastSyncedAt: Date | null;
  revision: number | null;
  /** 首次加载之后才出现的条目（例如宿主聊天里 AI 工具新建的草稿） */
  freshIds: Set<string>;
  markSeen: (id: string) => void;
  refresh: () => Promise<boolean>;
  /** 写入一个经服务端确认的条目（create/update/archive 的返回值） */
  applyEntity: (e: ForestEntity) => void;
}

const POLL_MS = 5000;

/**
 * 以 api.snapshot() 为唯一数据源。
 * - 面板可见时每 5 秒轮询；标签页/面板重新可见时立即刷新
 * - 同时只有一个请求在途
 * - 刷新失败只记录错误，不清空已显示数据
 * - 合并时保留本地已确认的更高 revision，避免慢返回的旧快照回滚刚保存的结果
 */
export function useForest(api: ForestApi, rootRef: RefObject<HTMLElement>): ForestStore {
  const [entities, setEntities] = useState<ForestEntity[]>([]);
  const [phase, setPhase] = useState<LoadPhase>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set());

  const inflight = useRef<Promise<boolean> | null>(null);
  const loadedOnce = useRef(false);
  const revisionRef = useRef<number | null>(null);
  const entitiesRef = useRef<ForestEntity[]>([]);
  const mounted = useRef(true);
  const onScreen = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const commitEntities = useCallback((next: ForestEntity[]) => {
    entitiesRef.current = next;
    setEntities(next);
  }, []);

  const refresh = useCallback((): Promise<boolean> => {
    if (inflight.current) return inflight.current;
    setSyncing(true);
    const p = (async () => {
      try {
        const snap = await api.snapshot();
        if (!mounted.current) return false;
        const unchanged = loadedOnce.current && revisionRef.current === snap.revision;
        if (!unchanged) {
          const local = new Map(entitiesRef.current.map((e) => [e.id, e]));
          const merged = snap.entities.map((remote) => {
            const mine = local.get(remote.id);
            return mine && mine.revision > remote.revision ? mine : remote;
          });
          // 本地刚创建、快照里尚未出现的条目不丢弃
          const remoteIds = new Set(snap.entities.map((e) => e.id));
          for (const mine of entitiesRef.current) {
            if (!remoteIds.has(mine.id) && mine.updatedAt > new Date(Date.now() - 60_000).toISOString()) merged.push(mine);
          }
          if (loadedOnce.current) {
            const added = snap.entities.filter((e) => !local.has(e.id)).map((e) => e.id);
            if (added.length) {
              setFreshIds((prev) => {
                const s = new Set(prev);
                added.forEach((id) => s.add(id));
                return s;
              });
            }
          }
          commitEntities(merged);
          revisionRef.current = snap.revision;
          setRevision(snap.revision);
        }
        loadedOnce.current = true;
        setPhase('ready');
        setLoadError(null);
        setSyncError(null);
        setLastSyncedAt(new Date());
        return true;
      } catch (err) {
        if (!mounted.current) return false;
        const { message } = classifyError(err);
        if (!loadedOnce.current) {
          setPhase('error');
          setLoadError(message);
        } else {
          setSyncError(message);
        }
        return false;
      } finally {
        inflight.current = null;
        if (mounted.current) setSyncing(false);
      }
    })();
    inflight.current = p;
    return p;
  }, [api, commitEntities]);

  // 首次加载
  useEffect(() => {
    loadedOnce.current = false;
    revisionRef.current = null;
    void refresh();
  }, [refresh]);

  // 面板是否真的在屏幕上（宿主切换 sidebar tab 时可能只是隐藏）
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      const visible = entries.some((en) => en.isIntersecting);
      const wasHidden = !onScreen.current;
      onScreen.current = visible;
      if (visible && wasHidden) void refresh();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [rootRef, refresh]);

  // 轮询 + 页面可见性
  useEffect(() => {
    const isVisible = () => document.visibilityState === 'visible' && onScreen.current;
    const timer = window.setInterval(() => {
      if (isVisible()) void refresh();
    }, POLL_MS);
    const onVis = () => {
      if (isVisible()) void refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refresh]);

  const applyEntity = useCallback(
    (e: ForestEntity) => {
      const cur = entitiesRef.current;
      const i = cur.findIndex((x) => x.id === e.id);
      if (i === -1) commitEntities([...cur, e]);
      else if (cur[i].revision <= e.revision) {
        const next = cur.slice();
        next[i] = e;
        commitEntities(next);
      }
    },
    [commitEntities],
  );

  const markSeen = useCallback((id: string) => {
    setFreshIds((prev) => {
      if (!prev.has(id)) return prev;
      const s = new Set(prev);
      s.delete(id);
      return s;
    });
  }, []);

  const byId = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);

  return {
    entities,
    byId,
    phase,
    loadError,
    syncing,
    syncError,
    lastSyncedAt,
    revision,
    freshIds,
    markSeen,
    refresh,
    applyEntity,
  };
}
