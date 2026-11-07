import type { Draft } from './drafts';
import { isDirty } from './drafts';

/**
 * 模块级、按会话隔离的草稿内存。
 *
 * 为什么需要：宿主切换 sidebar tab 时会卸载 ForestApp，组件 state 随之消失。
 * 这里把未保存的输入放在模块作用域（同一页面生命周期内常驻），同一 sessionId 再次挂载时恢复。
 *
 * 边界：
 * - 只在内存中，不写 localStorage / IndexedDB，也不调用任何后端接口；刷新或关闭宿主页面会丢失
 *   （因此有未保存内容时注册 beforeunload 提醒）。
 * - 按 sessionId 隔离：不同会话互不可见；没有 sessionId 时归入一个独立的默认分区。
 * - 保存成功或用户明确放弃时立即删除，绝不会把已保存的输入再次恢复。
 * - 保存请求在组件卸载后仍会完成，并通过这里更新/删除草稿；新挂载的实例通过订阅同步看到结果。
 */

interface SessionMemory {
  drafts: Record<string, Draft>;
  /** 导航状态（正在编辑/查看的条目等），用于再挂载时回到原处 */
  nav: unknown;
  /** 组件卸载期间完成的保存结果，等待新实例显示 */
  notices: string[];
}

const EMPTY: Record<string, Draft> = Object.freeze({}) as Record<string, Draft>;
const sessions = new Map<string, SessionMemory>();
const listeners = new Map<string, Set<() => void>>();
/** 仍在进行中的保存请求：`${session}\u0000${draftKey}` */
const inflight = new Set<string>();

export function sessionKeyOf(sessionId?: string): string {
  return sessionId && sessionId.trim() ? `session:${sessionId}` : 'session:(未提供 sessionId)';
}

function memOf(s: string): SessionMemory {
  let m = sessions.get(s);
  if (!m) {
    m = { drafts: EMPTY, nav: null, notices: [] };
    sessions.set(s, m);
  }
  return m;
}

function emit(s: string): void {
  listeners.get(s)?.forEach((fn) => fn());
}

/** 草稿是否含有尚未被服务端确认的输入（未改动的编辑草稿不算） */
export function hasUnsavedInput(d: Draft): boolean {
  return d.phase !== 'editing' || isDirty(d);
}

/* ───────────── 草稿读写 ───────────── */

export function getDrafts(s: string): Record<string, Draft> {
  return sessions.get(s)?.drafts ?? EMPTY;
}

function setDrafts(s: string, next: Record<string, Draft>): void {
  const m = memOf(s);
  m.drafts = Object.keys(next).length ? next : EMPTY;
  if (m.drafts === EMPTY && m.nav === null && m.notices.length === 0 && !listeners.get(s)?.size) sessions.delete(s);
  emit(s);
  syncBeforeUnload();
}

export function putDraft(s: string, d: Draft): void {
  setDrafts(s, { ...getDrafts(s), [d.key]: d });
}

export function dropDraft(s: string, key: string): void {
  const cur = getDrafts(s);
  if (!(key in cur)) return;
  const next = { ...cur };
  delete next[key];
  setDrafts(s, next);
}

export function subscribe(s: string, fn: () => void): () => void {
  let set = listeners.get(s);
  if (!set) {
    set = new Set();
    listeners.set(s, set);
  }
  set.add(fn);
  return () => {
    set?.delete(fn);
  };
}

/* ───────────── 进行中的保存 ───────────── */

export function markInflight(s: string, key: string, on: boolean): void {
  const id = `${s}\u0000${key}`;
  if (on) inflight.add(id);
  else inflight.delete(id);
}

export function isInflight(s: string, key: string): boolean {
  return inflight.has(`${s}\u0000${key}`);
}

/**
 * 再挂载时调用（防御性）：正常情况下保存请求结束时一定会更新或删除草稿；
 * 若某草稿仍是“保存中”却已没有对应请求在途（请求收尾时出现异常等），
 * 改为“结果不确定”，要求用户刷新核对后再决定是否重试——不自动重试，避免重复记录。
 * 请求仍在途的草稿保持“保存中”，结果到达后经订阅同步给新实例。
 */
export function recoverSession(s: string): void {
  const cur = getDrafts(s);
  let changed = false;
  const next: Record<string, Draft> = { ...cur };
  for (const [k, d] of Object.entries(cur)) {
    if (d.phase === 'saving' && !isInflight(s, k)) {
      next[k] = {
        ...d,
        phase: 'uncertain',
        checked: false,
        suspects: undefined,
        exactMatches: undefined,
        message: '面板在保存过程中被关闭，无法确认这次保存是否成功',
      };
      changed = true;
    }
  }
  if (changed) setDrafts(s, next);
}

/* ───────────── 导航与通知 ───────────── */

export function getNav<T>(s: string): T | null {
  return (sessions.get(s)?.nav as T | undefined) ?? null;
}

export function setNav(s: string, nav: unknown): void {
  memOf(s).nav = nav;
}

export function pushNotice(s: string, text: string): void {
  memOf(s).notices.push(text);
}

export function takeNotices(s: string): string[] {
  const m = sessions.get(s);
  if (!m || !m.notices.length) return [];
  const out = m.notices;
  m.notices = [];
  return out;
}

/* ───────────── beforeunload ───────────── */

let guardInstalled = false;

function onBeforeUnload(e: BeforeUnloadEvent): string {
  // 浏览器只显示通用文案；这里的作用是让刷新/关闭宿主前出现确认
  e.preventDefault();
  e.returnValue = '';
  return '';
}

export function unsavedCountAll(): number {
  let n = 0;
  sessions.forEach((m) => {
    for (const d of Object.values(m.drafts)) if (hasUnsavedInput(d)) n += 1;
  });
  return n;
}

function syncBeforeUnload(): void {
  if (typeof window === 'undefined') return;
  const need = unsavedCountAll() > 0;
  if (need && !guardInstalled) {
    window.addEventListener('beforeunload', onBeforeUnload);
    guardInstalled = true;
  } else if (!need && guardInstalled) {
    window.removeEventListener('beforeunload', onBeforeUnload);
    guardInstalled = false;
  }
}
