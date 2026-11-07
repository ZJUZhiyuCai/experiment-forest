import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { newDraft } from '../client/drafts';
import * as memory from '../client/draftMemory';

let sequence = 0;
function session(t: TestContext) {
  const key = memory.sessionKeyOf(`memory-regression-${++sequence}`);
  t.after(() => {
    for (const draft of Object.values(memory.getDrafts(key))) {
      memory.markInflight(key, draft.key, false);
      memory.dropDraft(key, draft.key);
    }
    memory.takeNotices(key);
    memory.setNav(key, null);
  });
  return key;
}

test('same-session remount restores unsubmitted input and navigation after listener disposal', t => {
  const key = session(t);
  const draft = newDraft('note', null);
  draft.title = '仍未提交的标题';
  draft.content = '逐字保留这段没有保存的正文';
  let firstMountUpdates = 0;
  const unmount = memory.subscribe(key, () => { firstMountUpdates++; });
  memory.putDraft(key, draft);
  memory.setNav(key, { scope: 'home', editorKey: draft.key });
  assert.equal(firstMountUpdates, 1);
  unmount();
  memory.recoverSession(key);
  assert.equal(memory.getDrafts(key)[draft.key]!.content, draft.content);
  assert.deepEqual(memory.getNav(key), { scope: 'home', editorKey: draft.key });
  let secondMountUpdates = 0;
  const unsubscribe = memory.subscribe(key, () => { secondMountUpdates++; });
  t.after(unsubscribe);
  memory.putDraft(key, { ...draft, title: '重新打开后的编辑' });
  assert.equal(firstMountUpdates, 1);
  assert.equal(secondMountUpdates, 1);
});

test('different sessions never see or overwrite each other even when draft keys are identical', t => {
  const first = session(t);
  const second = session(t);
  const draft = newDraft('note', null);
  memory.putDraft(first, { ...draft, title: '会话 A' });
  memory.putDraft(second, { ...draft, title: '会话 B' });
  memory.setNav(first, { editorKey: draft.key });
  assert.equal(memory.getDrafts(first)[draft.key]!.title, '会话 A');
  assert.equal(memory.getDrafts(second)[draft.key]!.title, '会话 B');
  assert.equal(memory.getNav(second), null);
  memory.dropDraft(first, draft.key);
  assert.equal(memory.getDrafts(second)[draft.key]!.title, '会话 B');
  assert.notEqual(first, memory.sessionKeyOf());
});

test('remount keeps real in-flight saves pending and recovers abandoned saving state as uncertain', t => {
  const key = session(t);
  const draft = { ...newDraft('record', null), title: '不能自动重试的保存', phase: 'saving' as const, content: '原文保持' };
  memory.putDraft(key, draft);
  memory.markInflight(key, draft.key, true);
  memory.recoverSession(key);
  assert.equal(memory.isInflight(key, draft.key), true);
  assert.equal(memory.getDrafts(key)[draft.key]!.phase, 'saving');
  memory.markInflight(key, draft.key, false);
  memory.recoverSession(key);
  const recovered = memory.getDrafts(key)[draft.key]!;
  assert.equal(recovered.phase, 'uncertain');
  assert.equal(recovered.checked, false);
  assert.equal(recovered.content, '原文保持');
  assert.equal(recovered.title, draft.title);
  assert.equal(memory.hasUnsavedInput(recovered), true);
  assert.match(recovered.message!, /无法确认/);
});

test('confirmed save deletes the retained draft and delivers the completion notice only once', t => {
  const key = session(t);
  const draft = { ...newDraft('note', null), title: '已保存条目', phase: 'saving' as const };
  memory.putDraft(key, draft);
  memory.markInflight(key, draft.key, true);
  // This is the same acknowledgement order used after a successful Host write.
  memory.dropDraft(key, draft.key);
  memory.markInflight(key, draft.key, false);
  memory.pushNotice(key, '已保存「已保存条目」');
  memory.recoverSession(key);
  assert.equal(memory.getDrafts(key)[draft.key], undefined);
  assert.equal(memory.isInflight(key, draft.key), false);
  assert.deepEqual(memory.takeNotices(key), ['已保存「已保存条目」']);
  assert.deepEqual(memory.takeNotices(key), []);
  memory.recoverSession(key);
  assert.equal(memory.getDrafts(key)[draft.key], undefined, 'a later mount cannot resurrect acknowledged input');
});
