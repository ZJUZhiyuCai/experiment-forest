import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement, createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ForestRepository } from '../plugin/domain';
import type { ForestApi, ForestEntity, ForestState } from '../shared/model';
import { WORKFLOW_FORMAT } from '../shared/workflow';
import { RunChecklist } from '../client/RunChecklist';
import { TodayCard, TodayView } from '../client/TodayView';
import * as memory from '../client/draftMemory';
import type { StepDraft } from '../client/draftMemory';
import type { ActionCtx } from '../client/runActions';

const noop = () => {};
const ctx: ActionCtx = { api: {} as ForestApi, applyEntity: noop, refresh: async () => true, notify: noop, openCreated: noop };

async function fixture() {
  let state: ForestState | null = null;
  const repo = new ForestRepository({ read: async () => structuredClone(state), write: async value => { state = structuredClone(value); } });
  const sop = await repo.create({ kind: 'sop', title: 'AI 操作规程', data: {
    provenance: { source: 'deepseek-harness', reviewStatus: 'unreviewed' },
    forestWorkflow: { format: WORKFLOW_FORMAT, version: 1, type: 'sop', steps: [
      { id: 'prepare', title: '核对材料', instruction: '如实记录观察', required: true },
    ] },
  } });
  const run = await repo.createRun({ sopId: sop.id, expectedSopRevision: sop.revision, title: '待核对的实验', requestId: 'review-test', plannedDate: '2026-11-08' });
  const review = () => repo.update({ id: run.id, expectedRevision: run.revision, patch: {
    data: { ...run.data, provenance: { ...(run.data.provenance as Record<string, string>), reviewStatus: 'reviewed' } },
  } });
  return { run, review };
}

function draftFor(run: ForestEntity, phase: StepDraft['phase'] = 'editing'): StepDraft {
  return {
    key: memory.stepKey(run.id, 'prepare'), runId: run.id, stepId: 'prepare',
    baseRevision: run.revision, baseStatus: 'pending', baseObservation: '',
    status: 'done', observation: '用户尚未保存的真实观察', phase,
    ...(phase === 'conflict' ? { latest: { revision: run.revision, status: 'pending' as const, observation: '', updatedAt: null } } : {}),
  };
}

function actionButton(markup: string, text: string): string {
  const button = markup.match(/<button\b[^>]*>[\s\S]*?<\/button>/g)?.find(item => item.includes(text));
  assert.ok(button, `missing action: ${text}`);
  return button;
}

test('AI review gate explains disabled step saving, preserves existing input and unlocks after real review', async () => {
  const { run, review } = await fixture();
  const session = `review-gate:${run.id}`;
  const draft = draftFor(run);
  memory.putStep(session, draft);
  try {
    const markup = renderToStaticMarkup(createElement(RunChecklist, { entity: run, sessKey: session, ctx }));
    assert.match(markup, /先核对 AI 草稿，再保存执行步骤/);
    assert.match(markup, /记录为已核对/);
    assert.match(markup, /用户尚未保存的真实观察/);
    assert.match(actionButton(markup, '保存这一步'), /disabled=""/);
    assert.equal(memory.getSteps(session)[draft.key], draft, 'rendering the review gate must not discard or alter local input');

    const reviewed = await review();
    const unlocked = renderToStaticMarkup(createElement(RunChecklist, { entity: reviewed, sessKey: session, ctx }));
    assert.doesNotMatch(unlocked, /先核对 AI 草稿，再保存执行步骤/);
    assert.doesNotMatch(actionButton(unlocked, '保存这一步'), /disabled=""/);
    assert.match(unlocked, /用户尚未保存的真实观察/);
  } finally {
    memory.dropStep(session, draft.key);
  }
});

test('AI review gate also disables saving the user input over a newer step revision', async () => {
  const { run } = await fixture();
  const session = `review-conflict:${run.id}`;
  const draft = draftFor(run, 'conflict');
  memory.putStep(session, draft);
  try {
    const markup = renderToStaticMarkup(createElement(RunChecklist, { entity: run, sessKey: session, ctx }));
    assert.match(actionButton(markup, '按最新修订保存我的输入'), /disabled=""/);
    assert.match(markup, /用户尚未保存的真实观察/);
    assert.equal(memory.getSteps(session)[draft.key], draft);
  } finally {
    memory.dropStep(session, draft.key);
  }
});

test('Today directs unreviewed runs to review and only offers continuing execution after review', async () => {
  const { run, review } = await fixture();
  const renderToday = (entity: ForestEntity) => renderToStaticMarkup(createElement(TodayView, {
    entities: [entity], byId: new Map([[entity.id, entity]]), today: '2026-11-08', projectId: null,
    freshIds: new Set<string>(), selectedId: null, unsavedRuns: new Set<string>(), headingRef: createRef<HTMLHeadingElement>(),
    onProject: noop, onOpen: noop, onContinue: noop, onBack: noop,
  }));
  const pending = renderToday(run);
  assert.match(pending, /aria-label="去核对「待核对的实验」的 AI 草稿"/);
  assert.doesNotMatch(pending, /aria-label="继续「/);
  const home = renderToStaticMarkup(createElement(TodayCard, { entities: [run], today: '2026-11-08', onToday: noop, onOpen: noop, onContinue: noop }));
  assert.match(home, /aria-label="去核对「待核对的实验」的 AI 草稿"/);
  assert.match(home, />去核对</);

  const reviewed = renderToday(await review());
  assert.match(reviewed, /aria-label="继续「待核对的实验」的下一步：核对材料"/);
  assert.doesNotMatch(reviewed, /aria-label="去核对「/);
});
