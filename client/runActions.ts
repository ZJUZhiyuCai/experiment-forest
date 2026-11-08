import type { ForestApi, ForestEntity } from '../shared/model';
import { getRunWorkflow, isCalendarDay } from '../shared/workflow';
import type { CreateRunInput, RunStep } from '../shared/workflow';
import * as memory from './draftMemory';
import type { RunAttempt, RunRequestDraft, StepDraft } from './draftMemory';
import { classifyError } from './forest-model';

/**
 * 实验执行相关的写操作：逐步保存（updateRunStep）与从 SOP 创建实验草稿（createRun）。
 *
 * 所有函数都把结果写回“发起时的会话”内存：面板在请求途中被卸载或切换会话，结果仍会正确落地，
 * 新挂载的实例通过订阅看到。不自动重试；结果不确定时交给用户核对。
 */
export interface ActionCtx {
  api: ForestApi;
  applyEntity(e: ForestEntity): void;
  refresh(): Promise<boolean>;
  /** 会话 s 的面板仍挂载时直接提示；否则留到下次挂载 */
  notify(s: string, text: string, tone?: 'ok' | 'warn' | 'danger'): void;
  /** 实验草稿已创建（或核对确认已创建）：打开服务端返回的真实记录 */
  openCreated(s: string, entity: ForestEntity): void;
}

/* ───────────────────────── 执行步骤 ───────────────────────── */

export const OBSERVATION_LIMIT = 10000;

export function savedStep(e: ForestEntity, stepId: string): RunStep | null {
  return getRunWorkflow(e)?.steps.find((s) => s.stepId === stepId) ?? null;
}

function stepLabel(e: ForestEntity, stepId: string): string {
  const run = getRunWorkflow(e);
  const i = run?.source.steps.findIndex((s) => s.id === stepId) ?? -1;
  const title = i >= 0 ? run?.source.steps[i].title : '';
  return i >= 0 ? `第 ${i + 1} 步「${title}」` : '这一步';
}

/** 修改某一步的本地输入；改回与已保存值完全相同且无待处理状态时自动清理 */
export function editStep(s: string, entity: ForestEntity, stepId: string, patch: Partial<Pick<StepDraft, 'status' | 'observation'>>): void {
  const key = memory.stepKey(entity.id, stepId);
  const existing = memory.getSteps(s)[key];
  let cur: StepDraft;
  if (existing) cur = existing;
  else {
    const st = savedStep(entity, stepId);
    if (!st) return;
    cur = {
      key,
      runId: entity.id,
      stepId,
      baseRevision: entity.revision,
      baseStatus: st.status,
      baseObservation: st.observation,
      status: st.status,
      observation: st.observation,
      phase: 'editing',
    };
  }
  if (cur.phase === 'saving') return;
  // 冲突 / 结果不确定期间继续输入：保留该状态直到用户处理，避免误以为可以直接覆盖
  const keepPhase = cur.phase === 'conflict' || cur.phase === 'uncertain';
  const next: StepDraft = {
    ...cur,
    ...patch,
    phase: keepPhase ? cur.phase : 'editing',
    message: keepPhase ? cur.message : undefined,
  };
  if (next.phase === 'editing' && !memory.stepHasUnsaved(next)) memory.dropStep(s, key);
  else memory.putStep(s, next);
}

export function validateStep(d: Pick<StepDraft, 'status' | 'observation'>): string | null {
  if (d.status === 'skipped' && !d.observation.trim()) return '跳过这一步需要写明原因';
  if (d.observation.length > OBSERVATION_LIMIT) return `观察记录最多 ${OBSERVATION_LIMIT} 字（当前 ${d.observation.length}）`;
  return null;
}

/** 本步保存成功后：同一记录的其它步骤若服务端值仍与其基线一致，把基线修订更新为最新，避免无谓冲突 */
function rebaseSiblings(s: string, saved: ForestEntity, exceptKey: string): void {
  const updates: StepDraft[] = [];
  for (const d of Object.values(memory.getSteps(s))) {
    if (d.runId !== saved.id || d.key === exceptKey || d.baseRevision >= saved.revision) continue;
    if (d.phase !== 'editing' && d.phase !== 'error') continue;
    const st = savedStep(saved, d.stepId);
    if (st && st.status === d.baseStatus && st.observation === d.baseObservation) updates.push({ ...d, baseRevision: saved.revision });
  }
  memory.replaceSteps(s, updates);
}

/**
 * 轮询带来新修订时调用：只要这一步在服务端仍是用户开始输入时的值，就把基线修订前移
 * （记录的其它部分被修改不影响这一步）；若这一步本身已被别处改动，保持原基线，保存时按冲突处理。
 */
export function syncStepBases(s: string, entity: ForestEntity): void {
  rebaseSiblings(s, entity, '');
}

/** 已知服务端这一步与基线不同（例如轮询看到别处的修改）：直接进入冲突对照，不需要再读取 */
export function stepConflictFrom(s: string, key: string, entity: ForestEntity): void {
  const d = memory.getSteps(s)[key];
  const st = d ? savedStep(entity, d.stepId) : null;
  if (!d || !st || d.phase === 'saving') return;
  memory.putStep(s, { ...d, phase: 'conflict', message: undefined, latest: { revision: entity.revision, status: st.status, observation: st.observation, updatedAt: st.updatedAt } });
}

export async function saveStep(ctx: ActionCtx, s: string, key: string): Promise<void> {
  const d = memory.getSteps(s)[key];
  if (!d || d.phase === 'saving' || memory.isInflight(s, `step:${key}`)) return;
  const invalid = validateStep(d);
  if (invalid) {
    memory.putStep(s, { ...d, phase: 'error', message: invalid });
    return;
  }
  const pending: StepDraft = { ...d, phase: 'saving', message: undefined };
  memory.putStep(s, pending);
  memory.markInflight(s, `step:${key}`, true);
  try {
    const saved = await ctx.api.updateRunStep({
      id: d.runId,
      expectedRevision: d.baseRevision,
      stepId: d.stepId,
      status: d.status,
      observation: d.observation,
    });
    ctx.applyEntity(saved);
    if (memory.getSteps(s)[key] !== pending) return;
    memory.dropStep(s, key);
    rebaseSiblings(s, saved, key);
    ctx.notify(s, `已保存${stepLabel(saved, d.stepId)}`, 'ok');
  } catch (err) {
    const c = classifyError(err);
    const cur = memory.getSteps(s)[key];
    if (cur !== pending) return;
    if (c.kind === 'conflict') {
      memory.putStep(s, { ...cur, phase: 'conflict', message: c.message, latest: null });
      void loadStepLatest(ctx, s, key);
    } else if (c.kind === 'validation' || c.kind === 'notfound') {
      memory.putStep(s, { ...cur, phase: 'error', message: c.message });
    } else {
      // 传输失败：不自动重试
      memory.putStep(s, { ...cur, phase: 'uncertain', message: c.message });
    }
  } finally {
    memory.markInflight(s, `step:${key}`, false);
  }
}

export async function loadStepLatest(ctx: ActionCtx, s: string, key: string): Promise<void> {
  const d = memory.getSteps(s)[key];
  if (!d) return;
  try {
    const latest = await ctx.api.get(d.runId);
    const cur = memory.getSteps(s)[key];
    if (cur !== d) return;
    const st = latest ? savedStep(latest, d.stepId) : null;
    if (!latest || !st) {
      memory.putStep(s, { ...cur, phase: 'error', message: '这条记录或这一步在服务端已不存在。请复制你的观察后放弃输入。' });
      return;
    }
    ctx.applyEntity(latest);
    memory.putStep(s, { ...cur, phase: 'conflict', latest: { revision: latest.revision, status: st.status, observation: st.observation, updatedAt: st.updatedAt } });
  } catch (err) {
    const cur = memory.getSteps(s)[key];
    if (cur !== d) return;
    memory.putStep(s, { ...cur, phase: 'conflict', latest: null, message: `读取最新版本失败：${classifyError(err).message}` });
  }
}

/**
 * 冲突后由用户在看过“最新 vs 我的输入”对照后明确选择：以服务端最新修订为基线，用自己的输入保存这一步。
 * 自己的输入与最新值完全相同时无需保存，直接清理。
 */
export async function rebaseAndSaveStep(ctx: ActionCtx, s: string, key: string): Promise<void> {
  const d = memory.getSteps(s)[key];
  if (!d?.latest) return;
  if (d.status === d.latest.status && d.observation === d.latest.observation) {
    memory.dropStep(s, key);
    ctx.notify(s, '服务端已是与你输入相同的内容，无需再保存', 'ok');
    return;
  }
  rebaseStep(s, key);
  await saveStep(ctx, s, key);
}

/** 以服务端最新值为基线，保留自己的输入（不保存） */
export function rebaseStep(s: string, key: string): void {
  const d = memory.getSteps(s)[key];
  if (!d?.latest) return;
  memory.putStep(s, {
    ...d,
    baseRevision: d.latest.revision,
    baseStatus: d.latest.status,
    baseObservation: d.latest.observation,
    phase: 'editing',
    latest: undefined,
    message: `已以最新修订 r${d.latest.revision} 为基准，你的输入保留。请核对后再保存。`,
  });
}

/** 结果不确定后的核对：按真实完整值比较这一步，不推测 */
export async function checkStep(ctx: ActionCtx, s: string, key: string): Promise<void> {
  const d = memory.getSteps(s)[key];
  if (!d) return;
  try {
    const latest = await ctx.api.get(d.runId);
    const cur = memory.getSteps(s)[key];
    if (cur !== d) return;
    const st = latest ? savedStep(latest, d.stepId) : null;
    if (!latest || !st) {
      memory.putStep(s, { ...cur, phase: 'error', message: '这条记录或这一步在服务端已不存在。' });
      return;
    }
    ctx.applyEntity(latest);
    if (st.status === cur.status && st.observation === cur.observation) {
      memory.dropStep(s, key);
      rebaseSiblings(s, latest, key);
      ctx.notify(s, `核对结果：${stepLabel(latest, d.stepId)}已经保存`, 'ok');
    } else if (latest.revision === cur.baseRevision) {
      memory.putStep(s, { ...cur, phase: 'editing', message: '核对结果：服务端仍是原值，这一步尚未保存，可以再次保存。' });
    } else {
      memory.putStep(s, { ...cur, phase: 'conflict', message: undefined, latest: { revision: latest.revision, status: st.status, observation: st.observation, updatedAt: st.updatedAt } });
    }
  } catch (err) {
    const cur = memory.getSteps(s)[key];
    if (cur !== d) return;
    memory.putStep(s, { ...cur, message: `核对失败：${classifyError(err).message}。请稍后再试。` });
  }
}

/* ───────────────────────── 从 SOP 创建实验草稿 ───────────────────────── */

export function newRequestId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return `run-${c.randomUUID()}`;
  return `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export interface RunParams {
  sopRevision: number;
  title: string;
  projectId: string | null;
  plannedDate: string;
}

export function runParams(d: RunRequestDraft, sop: ForestEntity): RunParams {
  return { sopRevision: sop.revision, title: d.title.trim(), projectId: d.projectId, plannedDate: d.plannedDate };
}

export function sameRunParams(a: RunAttempt, b: RunParams): boolean {
  return a.title === b.title && a.projectId === b.projectId && a.plannedDate === b.plannedDate;
}

export function validateRun(d: RunRequestDraft, archivedProjects: Set<string>): string | null {
  const title = d.title.trim();
  if (!title) return '请填写实验草稿的标题';
  if (title.length > 300) return `标题最多 300 字（当前 ${title.length}）`;
  if (d.plannedDate && !isCalendarDay(d.plannedDate)) return '计划日期应为有效的 YYYY-MM-DD';
  if (d.projectId && archivedProjects.has(d.projectId)) return '不能把新实验归入已归档的课题';
  return null;
}

/**
 * 结果不确定时，重试完整冻结请求（包括当时的 SOP 修订）。
 * 修改表单不能静默开始另一动作；需核对或明确取消旧请求。
 */
export async function submitRun(ctx: ActionCtx, s: string, sop: ForestEntity, archivedProjects: Set<string>): Promise<void> {
  const key = sop.id;
  const d = memory.getRuns(s)[key];
  if (!d || d.phase === 'creating' || memory.isInflight(s, `run:${key}`)) return;
  const unresolved = d.phase === 'uncertain' && d.attempt !== null;
  if (unresolved && !sameRunParams(d.attempt!, runParams(d, sop))) {
    memory.putRun(s, { ...d, message: '本次请求尚未确认。请先核对，或恢复原输入再重试；若要重新创建，请明确取消这次请求。' });
    return;
  }
  const invalid = unresolved ? null : validateRun(d, archivedProjects);
  if (invalid) {
    memory.putRun(s, { ...d, phase: 'error', message: invalid });
    return;
  }
  const params = runParams(d, sop);
  const attempt: RunAttempt = unresolved ? d.attempt! : { requestId: newRequestId(), ...params };
  const pending: RunRequestDraft = { ...d, attempt, phase: 'creating', message: undefined };
  memory.putRun(s, pending);
  memory.markInflight(s, `run:${key}`, true);
  try {
    const input: CreateRunInput = {
      sopId: sop.id,
      expectedSopRevision: attempt.sopRevision,
      title: attempt.title,
      projectId: attempt.projectId,
      requestId: attempt.requestId,
    };
    if (attempt.plannedDate) input.plannedDate = attempt.plannedDate;
    const created = await ctx.api.createRun(input);
    ctx.applyEntity(created);
    if (memory.getRuns(s)[key] !== pending) return;
    memory.dropRun(s, key);
    ctx.openCreated(s, created);
  } catch (err) {
    const c = classifyError(err);
    const cur = memory.getRuns(s)[key];
    if (cur !== pending) return;
    if (c.kind === 'conflict') {
      memory.putRun(s, { ...cur, phase: 'error', message: `SOP 在此期间被修改，未创建（${c.message}）。请核对最新内容后重新创建。` });
    } else if (c.kind === 'validation' || c.kind === 'notfound') {
      memory.putRun(s, { ...cur, phase: 'error', message: c.message });
    } else {
      memory.putRun(s, { ...cur, phase: 'uncertain', message: c.message });
    }
  } finally {
    memory.markInflight(s, `run:${key}`, false);
  }
}

/** 结果不确定后核对：服务端在运行记录中保存了 requestId，按它精确查找，不按标题猜测 */
export async function checkRun(ctx: ActionCtx, s: string, key: string): Promise<void> {
  const d = memory.getRuns(s)[key];
  if (!d?.attempt) return;
  const requestId = d.attempt.requestId;
  try {
    const records = await ctx.api.list({ kind: 'record', includeArchived: true });
    const found = records.find((e) => getRunWorkflow(e)?.requestId === requestId);
    const cur = memory.getRuns(s)[key];
    if (cur !== d) return;
    if (found) {
      ctx.applyEntity(found);
      memory.dropRun(s, key);
      ctx.notify(s, `核对结果：实验草稿「${found.title}」已经创建`, 'ok');
      ctx.openCreated(s, found);
    } else {
      memory.putRun(s, {
        ...cur,
        phase: 'uncertain',
        message: '核对结果：没有找到这次请求创建的记录。可以原样再次提交（同一请求，服务端会识别重复），如需另建，请明确取消这次请求后重新开始。',
      });
    }
  } catch (err) {
    const cur = memory.getRuns(s)[key];
    if (cur !== d) return;
    memory.putRun(s, { ...cur, message: `核对失败：${classifyError(err).message}。请稍后再试。` });
  }
}
