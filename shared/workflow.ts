import {getExperimentPage} from './page';
/** Additive workflow v1 contract. Existing entities without this marker remain ordinary records. */
import { z } from 'zod';
import type { EntityKind, ForestEntity, ForestSnapshot, JsonObject } from './model';

export const WORKFLOW_FORMAT = 'experiment-forest/workflow' as const;
export const WORKFLOW_KEY = 'forestWorkflow' as const;
export interface SopStep { id: string; title: string; instruction: string; required: boolean }
export interface SopWorkflow { format: typeof WORKFLOW_FORMAT; version: 1; type: 'sop'; steps: SopStep[] }
export interface RunStep { stepId: string; status: 'pending' | 'done' | 'skipped'; observation: string; updatedAt: string | null }
export interface RunWorkflow {
  format: typeof WORKFLOW_FORMAT;
  version: 1;
  type: 'run';
  /** Server-owned idempotency metadata; never edit or regenerate in the client. */
  requestId: string;
  requestHash: string;
  source: {
    sopId: string; sopRevision: number; sopTitle: string; sopContent: string; sopStatus: string;
    sopVersion: string | null; provenance: JsonObject | null; steps: SopStep[];
  };
  steps: RunStep[];
}
export type ForestWorkflow = SopWorkflow | RunWorkflow;
export interface CreateRunInput {
  sopId: string;
  expectedSopRevision: number;
  title: string;
  /** Omitted inherits the SOP project; null explicitly creates an unfiled record. */
  projectId?: string | null;
  /** Scheduled calendar day; never becomes the observed experiment date. */
  plannedDate?: string;
  /** Retain the same ID while retrying an uncertain save. A new action uses a new ID. */
  requestId: string;
}
export interface UpdateRunStepInput {
  id: string; expectedRevision: number; stepId: string;
  status: RunStep['status']; observation: string;
}
export interface RunProgress { total: number; done: number; skipped: number; pending: number; nextStep: SopStep | null }
export interface AgendaInput { today: string; through?: string; projectId?: string }
export interface ForestAgenda {
  overdue: ForestEntity[]; today: ForestEntity[]; upcoming: ForestEntity[];
  undated: ForestEntity[]; review: ForestEntity[];
}
export interface ForestContextInput { id: string; maxItems?: number; maxChars?: number }
export interface ContextText { text: string; totalChars: number; truncated: boolean }
export interface ForestContextItem {
  id: string; kind: EntityKind; title: string; status: string; revision: number;
  projectId?: string; updatedAt: string;
  relation: 'primary' | 'project' | 'child' | 'reference' | 'backlink';
  provenance: { source: string | null; reviewStatus: string | null } | null;
  /** The historical source revision, which may differ from the current SOP entry. */
  workflowSource: { id: string; revision: number; title: string; status: string } | null;
  content: ContextText;
  /** Stored structured JSON, represented as text so a truncated value is never mistaken for valid JSON. */
  data: ContextText;
}
export interface ForestContext {
  snapshotRevision: number; primaryId: string; entries: ForestContextItem[];
  /** Diagnostic ID lists are capped at 100, independently of the body text budget. */
  omittedIds: string[]; omittedTotal: number; omittedIdsTruncated: boolean;
  missingIds: string[]; missingTotal: number; missingIdsTruncated: boolean; truncated: boolean;
}

const idSchema = z.string().min(1).max(128).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
const nonblank = (max: number) => z.string().max(max).refine(value => !!value.trim(), 'Text must not be blank');
export function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const leap = year! % 4 === 0 && (year! % 100 !== 0 || year! % 400 === 0);
  return month! >= 1 && month! <= 12 && day! >= 1 && day! <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month! - 1]!;
}
export const calendarDaySchema = z.string().refine(isCalendarDay, 'A real YYYY-MM-DD calendar day is required');
export const sopStepSchema = z.object({ id: idSchema, title: nonblank(300), instruction: z.string().max(4000), required: z.boolean() }).strict();
const sopStepsSchema = z.array(sopStepSchema).max(100).refine(steps => new Set(steps.map(s => s.id)).size === steps.length, 'Step IDs must be unique');
export const sopWorkflowSchema = z.object({ format: z.literal(WORKFLOW_FORMAT), version: z.literal(1), type: z.literal('sop'), steps: sopStepsSchema }).strict();
export const runWorkflowSchema = z.object({
  format: z.literal(WORKFLOW_FORMAT), version: z.literal(1), type: z.literal('run'), requestId: idSchema,
  requestHash: z.string().regex(/^[a-f0-9]{64}$/),
  source: z.object({ sopId: idSchema, sopRevision: z.number().int().positive(), sopTitle: nonblank(300),
    sopContent: z.string().max(1_048_576), sopStatus: nonblank(32), sopVersion: z.string().max(2_097_152).nullable(),
    provenance: z.record(z.string(), z.json()).nullable(), steps: sopStepsSchema }).strict(),
  steps: z.array(z.object({ stepId: idSchema, status: z.enum(['pending', 'done', 'skipped']), observation: z.string().max(10000),
    updatedAt: z.string().datetime().nullable() }).strict()).max(100),
}).strict().superRefine((run, ctx) => {
  const expected = run.source.steps.map(step => step.id);
  if (run.steps.length !== expected.length || run.steps.some((step, index) => step.stepId !== expected[index])) {
    ctx.addIssue({ code: 'custom', message: 'Run steps must match the frozen source steps in order' });
  }
  for (const step of run.steps) {
    if (step.status === 'skipped' && !step.observation.trim()) ctx.addIssue({ code: 'custom', message: 'A skipped step needs a reason' });
    if ((step.status !== 'pending' || step.observation !== '') && step.updatedAt === null) ctx.addIssue({ code: 'custom', message: 'A recorded action needs a timestamp' });
  }
});
export const workflowSchema = z.union([sopWorkflowSchema, runWorkflowSchema]);
export const createRunInputSchema = z.object({ sopId: idSchema, expectedSopRevision: z.number().int().positive(), title: nonblank(300),
  projectId: idSchema.nullable().optional(), plannedDate: calendarDaySchema.optional(), requestId: idSchema }).strict();
export const updateRunStepInputSchema = z.object({ id: idSchema, expectedRevision: z.number().int().positive(), stepId: idSchema,
  status: z.enum(['pending', 'done', 'skipped']), observation: z.string().max(10000) }).strict();
export const contextInputSchema = z.object({ id: idSchema, maxItems: z.number().int().min(1).max(20).optional(),
  maxChars: z.number().int().min(1000).max(50000).optional() }).strict();
const contextTextSchema = z.object({ text: z.string(), totalChars: z.number().int().nonnegative(), truncated: z.boolean() });
export const contextSchema = z.object({ snapshotRevision: z.number().int().nonnegative(), primaryId: z.string(),
  entries: z.array(z.object({ id: z.string(), kind: z.enum(['project', 'record', 'note', 'sop', 'sample', 'plan']), title: z.string(),
    status: z.string(), revision: z.number().int().positive(), projectId: z.string().optional(), updatedAt: z.string(),
    relation: z.enum(['primary', 'project', 'child', 'reference', 'backlink']),
    provenance: z.object({ source: z.string().nullable(), reviewStatus: z.string().nullable() }).nullable(),
    workflowSource: z.object({ id: z.string(), revision: z.number().int().positive(), title: z.string(), status: z.string() }).nullable(),
    content: contextTextSchema, data: contextTextSchema })), omittedIds: z.array(z.string()).max(100), omittedTotal: z.number().int().nonnegative(), omittedIdsTruncated: z.boolean(),
  missingIds: z.array(z.string()).max(100), missingTotal: z.number().int().nonnegative(), missingIdsTruncated: z.boolean(), truncated: z.boolean() });

/** Only our exact v1 marker opts into workflow validation. Unknown legacy/future JSON stays opaque. */
export function hasWorkflowMarker(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && (value as Record<string, unknown>).format === WORKFLOW_FORMAT && (value as Record<string, unknown>).version === 1;
}
export function getSopWorkflow(entity: ForestEntity): SopWorkflow | null {
  if (entity.kind !== 'sop') return null;
  const result = sopWorkflowSchema.safeParse(entity.data[WORKFLOW_KEY]);
  return result.success ? result.data : null;
}
export function getRunWorkflow(entity: ForestEntity): RunWorkflow | null {
  if (entity.kind !== 'record') return null;
  const result = runWorkflowSchema.safeParse(entity.data[WORKFLOW_KEY]);
  return result.success ? result.data : null;
}
export function runProgress(entity: ForestEntity): RunProgress {
  const run = getRunWorkflow(entity);
  const steps = run?.steps ?? [];
  const pending = steps.filter(step => step.status === 'pending');
  return { total: steps.length, done: steps.filter(step => step.status === 'done').length,
    skipped: steps.filter(step => step.status === 'skipped').length, pending: pending.length,
    nextStep: run?.source.steps.find(step => step.id === pending[0]?.stepId) ?? null };
}
export function needsHumanReview(entity: Pick<ForestEntity, 'data'>): boolean {
  const p = entity.data.provenance;
  return !!getExperimentPage(entity)?.blocks.some(b=>b.pendingReview) || (!!p && typeof p === 'object' && !Array.isArray(p) && p.source === 'deepseek-harness' && p.reviewStatus !== 'reviewed');
}
/** Stored full ISO legacy dates retain their written calendar date; no timezone is guessed. */
function calendarPart(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const day = value.slice(0, 10);
  return isCalendarDay(day) ? day : null;
}
function plusDays(day: string, count: number): string {
  const date = new Date(`${day}T12:00:00.000Z`); date.setUTCDate(date.getUTCDate() + count); return date.toISOString().slice(0, 10);
}
export function buildAgenda(entities: readonly ForestEntity[], input: AgendaInput): ForestAgenda {
  calendarDaySchema.parse(input.today);
  const through = input.through ?? plusDays(input.today, 7); calendarDaySchema.parse(through);
  if (through < input.today) throw new Error('Agenda end date precedes today');
  const result: ForestAgenda = { overdue: [], today: [], upcoming: [], undated: [], review: [] };
  const archivedProjects = new Set(entities.filter(e => e.kind === 'project' && e.status === 'archived').map(e => e.id));
  for (const e of entities) {
    if (e.status === 'archived' || (input.projectId && e.projectId !== input.projectId && e.id !== input.projectId)) continue;
    if (e.projectId && archivedProjects.has(e.projectId)) continue;
    if (needsHumanReview(e)) result.review.push(e);
    const activePlan = e.kind === 'plan' && ['scheduled', 'in-progress', 'postponed'].includes(e.status);
    const day = calendarPart(e.data.plannedDate);
    // 手工记录明确排期后同样出现在今天；无排期的旧普通记录不挤占未排期清单。
    const activeRun = e.kind === 'record' && e.status === 'draft' && (getRunWorkflow(e) !== null || day !== null);
    if (!activePlan && !activeRun) continue;
    if (!day) result.undated.push(e);
    else if (day < input.today) result.overdue.push(e);
    else if (day === input.today) result.today.push(e);
    else if (day <= through) result.upcoming.push(e);
  }
  const order = (a: ForestEntity, b: ForestEntity) => (calendarPart(a.data.plannedDate) ?? '').localeCompare(calendarPart(b.data.plannedDate) ?? '') || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
  for (const entries of Object.values(result)) entries.sort(order);
  return result;
}

/** Declared one-hop relations only; free text is never interpreted as a link. */
export function workflowRelatedIds(entity: ForestEntity): string[] {
  const ids: string[] = [];
  if (entity.projectId) ids.push(entity.projectId);
  const add = (value: unknown) => { if (typeof value === 'string' && value) ids.push(value); };
  if (entity.kind === 'record') {
    add(entity.data.sopId);
    if (Array.isArray(entity.data.relatedSamples)) entity.data.relatedSamples.forEach(add);
    add(getRunWorkflow(entity)?.source.sopId);
  }
  if (entity.kind === 'note' || entity.kind === 'plan') add(entity.data.relatedRecordId);
  return [...new Set(ids)];
}
export function buildForestContext(snapshot: ForestSnapshot, input: ForestContextInput): ForestContext {
  const options = contextInputSchema.parse(input);
  const all = new Map(snapshot.entities.map(e => [e.id, e]));
  const primary = all.get(options.id);
  if (!primary) throw new Error('Research entity was not found');
  const selected = new Map<string, ForestContextItem['relation']>([[primary.id, 'primary']]);
  const missingIds: string[] = [];
  const add = (id: string, relation: ForestContextItem['relation']) => {
    if (!all.has(id)) { if (!missingIds.includes(id)) missingIds.push(id); }
    else if (!selected.has(id)) selected.set(id, relation);
  };
  for (const id of workflowRelatedIds(primary)) add(id, id === primary.projectId ? 'project' : 'reference');
  const sorted = [...snapshot.entities].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  for (const e of sorted) {
    if (primary.kind === 'project' && e.projectId === primary.id) add(e.id, 'child');
    else if (e.id !== primary.id && workflowRelatedIds(e).includes(primary.id)) add(e.id, 'backlink');
  }
  const maxItems = options.maxItems ?? 20;
  const pairs = [...selected.entries()];
  const omittedIds = pairs.slice(maxItems).map(([id]) => id);
  const included = pairs.slice(0, maxItems);
  let budget = options.maxChars ?? 24000;
  const clip = (text: string, size: number): ContextText => ({ text: text.slice(0, size), totalChars: text.length, truncated: text.length > size });
  const entries = included.map(([id, relation], index): ForestContextItem => {
    const e = all.get(id)!;
    const dataText = JSON.stringify(e.data);
    const allowance = Math.floor(budget / (included.length - index));
    let contentSize = Math.min(e.content.length, Math.ceil(allowance * 0.6));
    const dataSize = Math.min(dataText.length, allowance - contentSize);
    contentSize = Math.min(e.content.length, allowance - dataSize);
    budget -= contentSize + dataSize;
    const p = e.data.provenance;
    const provenance = p && typeof p === 'object' && !Array.isArray(p)
      ? { source: typeof p.source === 'string' ? p.source.slice(0, 300) : null, reviewStatus: typeof p.reviewStatus === 'string' ? p.reviewStatus.slice(0, 300) : null } : null;
    const run = getRunWorkflow(e);
    return { id: e.id, kind: e.kind, title: e.title, status: e.status, revision: e.revision,
      ...(e.projectId ? { projectId: e.projectId } : {}), updatedAt: e.updatedAt, relation, provenance,
      workflowSource: run ? { id: run.source.sopId, revision: run.source.sopRevision, title: run.source.sopTitle, status: run.source.sopStatus } : null,
      content: clip(e.content, contentSize), data: clip(dataText, dataSize) };
  });
  return { snapshotRevision: snapshot.revision, primaryId: primary.id, entries,
    omittedIds: omittedIds.slice(0, 100), omittedTotal: omittedIds.length, omittedIdsTruncated: omittedIds.length > 100,
    missingIds: missingIds.slice(0, 100), missingTotal: missingIds.length, missingIdsTruncated: missingIds.length > 100,
    truncated: omittedIds.length > 0 || missingIds.length > 100 || entries.some(e => e.content.truncated || e.data.truncated) };
}
