import { useCallback, useSyncExternalStore } from 'react';
import type { Draft } from './drafts';
import { isDirty } from './drafts';
import type { RunStep } from '../shared/workflow';

/**
 * 模块级、按会话隔离的未保存输入内存。
 *
 * 为什么需要：宿主切换 sidebar tab 时会卸载 ForestApp，组件 state 随之消失。
 * 这里把未保存的输入放在模块作用域（同一页面生命周期内常驻），同一 sessionId 再次挂载时恢复。
 *
 * 保存三类临时输入：
 * - drafts：条目编辑器草稿（含 SOP 步骤）
 * - steps：执行清单里某一步尚未保存的状态与观察
 * - runs：从 SOP 创建实验草稿的表单与“同一动作同一 requestId”的重试凭据
 *
 * 边界：
 * - 只在内存中，不写 localStorage / IndexedDB，也不调用任何后端接口；刷新或关闭宿主页面会丢失
 *   （因此有未保存内容时注册 beforeunload 提醒）。
 * - 按 sessionId 隔离：不同会话互不可见；没有 sessionId 时归入一个独立的默认分区。
 * - 保存成功或用户明确放弃时立即删除，绝不会把已保存的输入再次恢复。
 * - 请求在组件卸载后仍会完成，并通过这里更新/删除；新挂载的实例通过订阅同步看到结果。
 */

export type StepPhase = 'editing' | 'saving' | 'conflict' | 'uncertain' | 'error';

/** 执行清单中某一步的本地未保存输入 */
export interface StepDraft {
  /** `${runId}::${stepId}` */
  key: string;
  runId: string;
  stepId: string;
  /** 开始输入时看到的记录修订与该步已保存的值（冲突判定基线） */
  baseRevision: number;
  baseStatus: RunStep['status'];
  baseObservation: string;
  status: RunStep['status'];
  observation: string;
  phase: StepPhase;
  message?: string;
  /** 冲突时载入的服务端最新值 */
  latest?: { revision: number; status: RunStep['status']; observation: string; updatedAt: string | null } | null;
}

export interface RunAttempt {
  requestId: string;
  sopRevision: number;
  title: string;
  projectId: string | null;
  plannedDate: string;
}

/** 从 SOP 创建实验草稿的表单（按 SOP ID 归档） */
export interface RunRequestDraft {
  key: string;
  sopId: string;
  title: string;
  /** null = 明确不归入课题 */
  projectId: string | null;
  plannedDate: string;
  /** 最近一次提交：结果不确定时必须用同一 requestId 与同一参数重试 */
  attempt: RunAttempt | null;
  phase: 'editing' | 'creating' | 'uncertain' | 'error';
  message?: string;
}

interface SessionMemory {
  drafts: Record<string, Draft>;
  steps: Record<string, StepDraft>;
  runs: Record<string, RunRequestDraft>;
  /** 导航状态（正在编辑/查看的条目等），用于再挂载时回到原处 */
  nav: unknown;
  /** 组件卸载期间完成的保存结果，等待新实例显示 */
  notices: string[];
}

const EMPTY_DRAFTS: Record<string, Draft> = Object.freeze({}) as Record<string, Draft>;
const EMPTY_STEPS: Record<string, StepDraft> = Object.freeze({}) as Record<string, StepDraft>;
const EMPTY_RUNS: Record<string, RunRequestDraft> = Object.freeze({}) as Record<string, RunRequestDraft>;
const sessions = new Map<string, SessionMemory>();
const listeners = new Map<string, Set<() => void>>();
/** 仍在进行中的请求：`${session}\u0000${kind}:${key}` */
const inflight = new Set<string>();

export function sessionKeyOf(sessionId?: string): string {
  return sessionId && sessionId.trim() ? `session:${sessionId}` : 'session:(未提供 sessionId)';
}

function memOf(s: string): SessionMemory {
  let m = sessions.get(s);
  if (!m) {
    m = { drafts: EMPTY_DRAFTS, steps: EMPTY_STEPS, runs: EMPTY_RUNS, nav: null, notices: [] };
    sessions.set(s, m);
  }
  return m;
}

function emit(s: string): void {
  listeners.get(s)?.forEach((fn) => fn());
}

function changed(s: string): void {
  const m = sessions.get(s);
  if (
    m &&
    m.drafts === EMPTY_DRAFTS &&
    m.steps === EMPTY_STEPS &&
    m.runs === EMPTY_RUNS &&
    m.nav === null &&
    m.notices.length === 0 &&
    !listeners.get(s)?.size
  ) {
    sessions.delete(s);
  }
  emit(s);
  syncBeforeUnload();
}

/** 草稿是否含有尚未被服务端确认的输入（未改动的编辑草稿不算） */
export function hasUnsavedInput(d: Draft): boolean {
  return d.phase !== 'editing' || isDirty(d);
}

export function stepHasUnsaved(d: StepDraft): boolean {
  return d.phase !== 'editing' || d.status !== d.baseStatus || d.observation !== d.baseObservation;
}

/** 保留的创建表单包含用户输入或待确认请求，均需导航与刷新保护 */
export function runHasUnsaved(d: RunRequestDraft): boolean {
  return true;
}

/* ───────────── 草稿读写 ───────────── */

export function getDrafts(s: string): Record<string, Draft> {
  return sessions.get(s)?.drafts ?? EMPTY_DRAFTS;
}

export function putDraft(s: string, d: Draft): void {
  const m = memOf(s);
  m.drafts = { ...m.drafts, [d.key]: d };
  changed(s);
}

export function dropDraft(s: string, key: string): void {
  const m = sessions.get(s);
  if (!m || !(key in m.drafts)) return;
  const next = { ...m.drafts };
  delete next[key];
  m.drafts = Object.keys(next).length ? next : EMPTY_DRAFTS;
  changed(s);
}

/* ───────────── 步骤输入读写 ───────────── */

export function stepKey(runId: string, stepId: string): string {
  return `${runId}::${stepId}`;
}

export function getSteps(s: string): Record<string, StepDraft> {
  return sessions.get(s)?.steps ?? EMPTY_STEPS;
}

export function putStep(s: string, d: StepDraft): void {
  const m = memOf(s);
  m.steps = { ...m.steps, [d.key]: d };
  changed(s);
}

export function dropStep(s: string, key: string): void {
  const m = sessions.get(s);
  if (!m || !(key in m.steps)) return;
  const next = { ...m.steps };
  delete next[key];
  m.steps = Object.keys(next).length ? next : EMPTY_STEPS;
  changed(s);
}

/** 批量替换（用于成功保存后为同一记录的其它步骤刷新基线） */
export function replaceSteps(s: string, updates: StepDraft[]): void {
  if (!updates.length) return;
  const m = memOf(s);
  const next = { ...m.steps };
  for (const u of updates) next[u.key] = u;
  m.steps = next;
  changed(s);
}

/* ───────────── 创建请求读写 ───────────── */

export function getRuns(s: string): Record<string, RunRequestDraft> {
  return sessions.get(s)?.runs ?? EMPTY_RUNS;
}

export function putRun(s: string, d: RunRequestDraft): void {
  const m = memOf(s);
  m.runs = { ...m.runs, [d.key]: d };
  changed(s);
}

export function dropRun(s: string, key: string): void {
  const m = sessions.get(s);
  if (!m || !(key in m.runs)) return;
  const next = { ...m.runs };
  delete next[key];
  m.runs = Object.keys(next).length ? next : EMPTY_RUNS;
  changed(s);
}

/* ───────────── 订阅 ───────────── */

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

/** React：订阅某会话的步骤输入 */
export function useSessionSteps(s: string): Record<string, StepDraft> {
  const sub = useCallback((cb: () => void) => subscribe(s, cb), [s]);
  const get = useCallback(() => getSteps(s), [s]);
  return useSyncExternalStore(sub, get, get);
}

/** React：订阅某会话的创建请求 */
export function useSessionRuns(s: string): Record<string, RunRequestDraft> {
  const sub = useCallback((cb: () => void) => subscribe(s, cb), [s]);
  const get = useCallback(() => getRuns(s), [s]);
  return useSyncExternalStore(sub, get, get);
}

/* ───────────── 进行中的请求 ───────────── */

export function markInflight(s: string, key: string, on: boolean): void {
  const id = `${s}\u0000${key}`;
  if (on) inflight.add(id);
  else inflight.delete(id);
}

export function isInflight(s: string, key: string): boolean {
  return inflight.has(`${s}\u0000${key}`);
}

/**
 * 再挂载时调用（防御性）：正常情况下请求结束时一定会更新或删除对应输入；
 * 若某项仍是“保存中/创建中”却已没有请求在途（请求收尾时出现异常等），
 * 改为“结果不确定”，要求用户刷新核对后再决定是否重试——不自动重试，避免重复记录。
 * 请求仍在途的项保持原状，结果到达后经订阅同步给新实例。
 */
export function recoverSession(s: string): void {
  const m = sessions.get(s);
  if (!m) return;
  let dirty = false;
  const drafts: Record<string, Draft> = { ...m.drafts };
  for (const [k, d] of Object.entries(m.drafts)) {
    if (d.phase === 'saving' && !isInflight(s, k)) {
      drafts[k] = { ...d, phase: 'uncertain', checked: false, suspects: undefined, exactMatches: undefined, message: '面板在保存过程中被关闭，无法确认这次保存是否成功' };
      dirty = true;
    }
  }
  const steps: Record<string, StepDraft> = { ...m.steps };
  for (const [k, d] of Object.entries(m.steps)) {
    if (d.phase === 'saving' && !isInflight(s, `step:${k}`)) {
      steps[k] = { ...d, phase: 'uncertain', message: '面板在保存过程中被关闭，无法确认这一步是否已保存' };
      dirty = true;
    }
  }
  const runs: Record<string, RunRequestDraft> = { ...m.runs };
  for (const [k, d] of Object.entries(m.runs)) {
    if (d.phase === 'creating' && !isInflight(s, `run:${k}`)) {
      runs[k] = { ...d, phase: 'uncertain', message: '面板在创建过程中被关闭，无法确认实验草稿是否已创建' };
      dirty = true;
    }
  }
  if (!dirty) return;
  m.drafts = Object.keys(drafts).length ? drafts : EMPTY_DRAFTS;
  m.steps = Object.keys(steps).length ? steps : EMPTY_STEPS;
  m.runs = Object.keys(runs).length ? runs : EMPTY_RUNS;
  changed(s);
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
  emit(s);
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
    for (const d of Object.values(m.steps)) if (stepHasUnsaved(d)) n += 1;
    for (const d of Object.values(m.runs)) if (runHasUnsaved(d)) n += 1;
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
