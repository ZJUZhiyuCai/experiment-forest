import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ForestApi } from '../shared/model';
import type { ObsidianStatus } from '../shared/obsidian-contract';
import { Icon } from './icons';
import { InlineConfirm, Notice, Spinner } from './bits';
import { classifyError, formatDateTime, relativeTime } from './forest-model';

/* ───────────────────────── 状态轮询 ───────────────────────── */

export interface ObsidianState {
  status: ObsidianStatus | null;
  /** 首次读取尚未返回 */
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** 写操作（连接 / 断开 / 立即同步）返回的最新状态 */
  accept: (s: ObsidianStatus) => void;
}

/**
 * 只通过受控 RPC 读取状态（obsidianStatus）；界面不接触本机路径、Node 或文件系统。
 * 面板可见时约每 15 秒刷新一次，同步进行中约每 3 秒；面板隐藏时暂停。
 */
export function useObsidianStatus(api: ForestApi): ObsidianState {
  const [status, setStatus] = useState<ObsidianStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const generation = useRef(0);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const requestGeneration = generation.current;
    try {
      const s = await api.obsidianStatus();
      if (!alive.current || generation.current !== requestGeneration) return;
      setStatus(s);
      setError(null);
    } catch (err) {
      if (alive.current && generation.current === requestGeneration) setError(classifyError(err).message);
    } finally {
      busy.current = false;
      if (alive.current) setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const syncing = status?.state === 'syncing';
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const ms = syncing ? 3000 : 15000;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, ms);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, syncing]);

  const accept = useCallback((s: ObsidianStatus) => {
    generation.current += 1;
    setStatus(s);
    setError(null);
    setLoading(false);
  }, []);

  return { status, loading, error, refresh, accept };
}

/* ───────────────────────── 展示用状态 ───────────────────────── */

export type ObsidianTone = 'off' | 'busy' | 'ok' | 'warn' | 'bad';

export function obsidianSummary(o: ObsidianState): { label: string; tone: ObsidianTone } {
  const s = o.status;
  if (o.error && s) return { label: '状态过期', tone: 'warn' };
  if (!s) return o.error ? { label: '状态未知', tone: 'bad' } : { label: '读取中', tone: 'off' };
  if (!s.enabled || !s.vaultId || s.state === 'disabled') return { label: '未连接', tone: 'off' };
  const m = s.materials;
  switch (s.state) {
    case 'syncing':
      return { label: '同步中', tone: 'busy' };
    case 'synced':
      // 只要还有素材没镜像，就不说“已同步”
      if (m && m.issues.length) return { label: `素材 ${m.mirrored}/${m.total}`, tone: 'warn' };
      if (m && m.mirrored < m.total) return { label: `素材 ${m.mirrored}/${m.total}`, tone: 'busy' };
      return { label: '已同步', tone: 'ok' };
    case 'conflict':
      return { label: `冲突 ${s.conflicts.length}`, tone: 'warn' };
    case 'error':
      return { label: '同步失败', tone: 'bad' };
    default:
      return { label: '已连接', tone: 'ok' };
  }
}

/* ───────────────────────── 同步面板 ───────────────────────── */

type Busy = null | 'connect' | 'sync' | 'disconnect';

export function ObsidianSection({ api, obsidian }: { api: ForestApi; obsidian: ObsidianState }) {
  const uid = useId();
  const { status, loading, error } = obsidian;
  const [busy, setBusy] = useState<Busy>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);

  const connected = !!status && status.enabled && !!status.vaultId && status.state !== 'disabled';
  const vault = status && status.vaultId ? status.vaults.find((v) => v.id === status.vaultId) ?? null : null;
  const summary = obsidianSummary(obsidian);

  useEffect(() => {
    if (!status) return;
    // 默认选中：当前已连接的仓库，或唯一 / 正在打开的仓库（不自动连接，需用户确认）
    setChoice((c) => {
      if (c && status.vaults.some((v) => v.id === c)) return c;
      if (status.vaultId && status.vaults.some((v) => v.id === status.vaultId)) return status.vaultId;
      const open = status.vaults.filter((v) => v.open);
      if (status.vaults.length === 1) return status.vaults[0].id;
      if (open.length === 1) return open[0].id;
      return null;
    });
  }, [status]);

  const act = async (what: Exclude<Busy, null>, fn: () => Promise<ObsidianStatus>) => {
    setBusy(what);
    setActionError(null);
    try {
      const s = await fn();
      obsidian.accept(s);
      if (what !== 'sync') setPicking(false);
    } catch (err) {
      const c = classifyError(err);
      setActionError(
        c.kind === 'network' || c.kind === 'unknown' ? `结果不确定（${c.message}）。已重新读取状态，请以下方显示为准。` : c.message,
      );
      void obsidian.refresh();
    } finally {
      setBusy(null);
    }
  };

  const connect = () => {
    if (choice) void act('connect', () => api.configureObsidian({ vaultId: choice }));
  };

  return (
    <section className="fa-section fa-obsidian" aria-labelledby={`${uid}-h`}>
      <div className="fa-obsidian__head">
        <span className="fa-obsidian__icon" aria-hidden="true">
          <Icon name="vault" size={18} />
        </span>
        <div className="fa-obsidian__titles">
          <h3 id={`${uid}-h`} className="fa-h3">
            Obsidian 自动同步
          </h3>
          <p className="fa-help">在 Obsidian 里阅读、整理资料；实验仍在这里管理。</p>
        </div>
        <span className={`fa-obs-state is-${summary.tone}`} role="status">
          <span className="fa-obs-state__dot" aria-hidden="true" />
          {summary.label}
        </span>
      </div>

      <p className="fa-obsidian__oneway">
        <Icon name="alert" size={13} />
        <span>
          <strong>Obsidian 整理不会回写实验记录。</strong>同步是单向的：宿主只更新仓库中的专用文件夹，不会改写你原有的笔记。
        </span>
      </p>

      {loading && !status ? (
        <Spinner label="正在读取同步状态…" />
      ) : !status ? (
        <Notice
          tone="danger"
          title="无法读取 Obsidian 同步状态"
          actions={
            <button type="button" className="fa-btn fa-btn--sm" onClick={() => void obsidian.refresh()}>
              <Icon name="refresh" />
              重试
            </button>
          }
        >
          <p>{error}</p>
        </Notice>
      ) : (
        <>
          {error && <p className="fa-help fa-help--error">刷新状态失败：{error}（显示的是上一次读取的结果）</p>}

          {connected && !picking && (
            <div className="fa-obsidian__conn">
              <dl className="fa-kv fa-kv--compact">
                <div>
                  <dt>仓库</dt>
                  <dd>
                    {vault ? vault.name : <span className="fa-muted">已连接的仓库不在当前注册列表中（{status.vaultId}）</span>}
                    {vault?.open && <span className="fa-quiet-tag">已在 Obsidian 中打开</span>}
                    {vault && <span className="fa-obsidian__path">{vault.path}</span>}
                  </dd>
                </div>
                <div>
                  <dt>专用文件夹</dt>
                  <dd className="is-mono">{status.folder}</dd>
                </div>
                <div>
                  <dt>上次同步</dt>
                  <dd>
                    {status.lastSyncedAt ? (
                      <>
                        {relativeTime(status.lastSyncedAt)}
                        <span className="fa-muted"> · {formatDateTime(status.lastSyncedAt)}{status.lastSyncedRevision !== null ? ` · 数据修订 r${status.lastSyncedRevision}` : ''}</span>
                      </>
                    ) : (
                      <span className="fa-muted">尚未完成过同步</span>
                    )}
                  </dd>
                </div>
              </dl>

              <StateLine status={status} />

              <MaterialsLine status={status} />

              {status.conflicts.length > 0 && (
                <div className="fa-obsidian__conflicts">
                  <p className="fa-obsidian__conflicts-h">
                    <Icon name="file" size={13} />
                    {status.conflicts.length} 个生成的文件在 Obsidian 中被修改或移动，已原样保留，没有覆盖
                  </p>
                  <ul>
                    {status.conflicts.map((c) => (
                      <li key={c.path}>
                        <span className="is-mono">{c.path}</span>
                        <span className="fa-muted">{c.reason}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="fa-help">这些文件里不会出现对应条目的最新内容。你的修改始终保留；实验记录以这里为准。</p>
                </div>
              )}

              {status.stale.length > 0 && (
                <details className="fa-obsidian__stale">
                  <summary>宿主标记为过期的文件 {status.stale.length} 个</summary>
                  <ul>
                    {status.stale.map((p) => (
                      <li key={p} className="is-mono">
                        {p}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="fa-obsidian__actions">
                <button type="button" className="fa-btn fa-btn--sm" disabled={!!busy || status.state === 'syncing'} onClick={() => void act('sync', () => api.syncObsidian())}>
                  {busy === 'sync' ? <Spinner label="正在请求同步…" /> : (<><Icon name="refresh" />{status.state === 'error' || status.state === 'conflict' ? '重试同步' : '立即同步'}</>)}
                </button>
                <button type="button" className="fa-btn fa-btn--ghost fa-btn--sm" disabled={!!busy} onClick={() => setPicking(true)}>
                  更换仓库
                </button>
                <span className="fa-spacer" />
                <InlineConfirm
                  label="断开"
                  confirmLabel="确认断开"
                  question="断开后不再自动更新 Obsidian 中的专用文件夹。"
                  icon="close"
                  busy={busy === 'disconnect'}
                  disabled={!!busy}
                  onConfirm={() => void act('disconnect', () => api.configureObsidian({ vaultId: null }))}
                />
              </div>
              <p className="fa-help">平时无需操作：保存条目或宿主重启时会自动更新。“立即同步”只在你想马上看到结果或失败后重试时使用。</p>
            </div>
          )}

          {(!connected || picking) && (
            <div className="fa-obsidian__pick">
              {!connected && (
                <p className="fa-help">
                  选择一个已在 Obsidian 中注册的仓库并连接，只需一次。之后宿主会在保存或重启时自动更新仓库里的专用文件夹
                  {status.folder ? <code className="fa-obsidian__folder">{status.folder}</code> : null}
                  ，不需要反复导出，也不会生成压缩包。
                </p>
              )}
              {status.vaults.length === 0 ? (
                <Notice
                  tone="info"
                  title="没有找到已注册的 Obsidian 仓库"
                  actions={
                    <button type="button" className="fa-btn fa-btn--sm" onClick={() => void obsidian.refresh()}>
                      <Icon name="refresh" />
                      重新查找
                    </button>
                  }
                >
                  <p>请先在本机的 Obsidian 中打开或创建一个仓库，然后重新查找。</p>
                </Notice>
              ) : (
                <fieldset className="fa-vaults" disabled={!!busy}>
                  <legend className="fa-label">选择仓库</legend>
                  {status.vaults.map((v) => (
                    <label key={v.id} className={`fa-vault${choice === v.id ? ' is-on' : ''}`}>
                      <input type="radio" name={`${uid}-vault`} checked={choice === v.id} onChange={() => setChoice(v.id)} />
                      <span className="fa-vault__main">
                        <span className="fa-vault__name">
                          {v.name}
                          {v.open && <span className="fa-quiet-tag">已打开</span>}
                          {v.id === status.vaultId && <span className="fa-quiet-tag">当前</span>}
                        </span>
                        <span className="fa-vault__path">{v.path}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
              <div className="fa-obsidian__actions">
                {status.vaults.length > 0 && (
                  <button type="button" className="fa-btn fa-btn--primary fa-btn--sm" disabled={!choice || !!busy || (connected && choice === status.vaultId)} onClick={connect}>
                    {busy === 'connect' ? <Spinner label="正在连接…" /> : (<><Icon name="link" />{connected ? '改为同步到这个仓库' : '连接并开始自动同步'}</>)}
                  </button>
                )}
                {picking && (
                  <button type="button" className="fa-btn fa-btn--ghost fa-btn--sm" disabled={!!busy} onClick={() => setPicking(false)}>
                    取消
                  </button>
                )}
              </div>
            </div>
          )}

          {actionError && (
            <Notice tone="danger" live title="操作未完成">
              <p>{actionError}</p>
            </Notice>
          )}
        </>
      )}
    </section>
  );
}

const MATERIAL_STATE: Record<'missing' | 'conflict' | 'error', string> = { missing: '文件缺失', conflict: '库里的副本被改动，已保留你的版本', error: '写入失败' };

/** 实验页素材的镜像情况（宿主可选提供）；没有统计时如实说“未知”，不推断为已同步 */
function MaterialsLine({ status }: { status: ObsidianStatus }) {
  const m = status.materials;
  if (!m) {
    return <p className="fa-help">素材镜像：宿主没有提供统计，状态未知。正文同步不受影响。</p>;
  }
  if (m.total === 0) return null;
  const all = m.mirrored >= m.total && m.issues.length === 0;
  return (
    <div className="fa-obsidian__mats">
      <p className={`fa-obs-line ${all ? 'is-ok' : m.issues.length ? 'is-warn' : ''}`}>
        <Icon name={all ? 'check' : 'file'} size={13} />
        素材 {m.mirrored}/{m.total} 已镜像到库里{all ? '' : m.issues.length ? `，${m.issues.length} 个有问题` : '，其余等待下一次同步'}
      </p>
      {m.issues.length > 0 && (
        <ul className="fa-obsidian__matlist">
          {m.issues.map((i) => (
            <li key={`${i.recordId}:${i.materialId}`}>
              <span className="fa-obsidian__matname">{i.name}</span>
              <span className="fa-chip fa-chip--warn">{MATERIAL_STATE[i.state]}</span>
              <span className="fa-muted">{i.message}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="fa-help">原件以 Host 保存的哈希为准；库里的副本只用于阅读，在库里改动或移动不会回写。</p>
    </div>
  );
}

function StateLine({ status }: { status: ObsidianStatus }) {
  switch (status.state) {
    case 'syncing':
      return (
        <p className="fa-obs-line is-busy" role="status">
          <span className="fa-spinner__ring" aria-hidden="true" />
          正在把最新记录写入专用文件夹…
        </p>
      );
    case 'synced':
      return (
        <p className="fa-obs-line is-ok">
          <Icon name="check" size={13} />
          {status.materials && (status.materials.mirrored < status.materials.total || status.materials.issues.length) ? '正文已同步' : '已同步'}
          {status.lastSyncedRevision !== null ? `到数据修订 r${status.lastSyncedRevision}` : ''}。
        </p>
      );
    case 'conflict':
      return (
        <p className="fa-obs-line is-warn">
          <Icon name="alert" size={13} />
          有文件冲突：这些文件保留你的版本，没有被覆盖。
        </p>
      );
    case 'error':
      return (
        <p className="fa-obs-line is-bad" role="alert">
          <Icon name="alert" size={13} />
          同步失败：{status.lastError || '宿主没有给出原因'}。实验记录不受影响，可以重试。
        </p>
      );
    default:
      return (
        <p className="fa-obs-line">
          <Icon name="link" size={13} />
          已连接，等待下一次保存时自动同步。
        </p>
      );
  }
}
