import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ForestRepository, createInitialState, stateSchema, type ForestPersistence } from './domain.js';
import { prepareImport, validateState } from './migration.js';
import type { CreateEntity, ForestState } from '../shared/model.js';

function memory(initial: ForestState | null = null) {
  let saved = structuredClone(initial);
  let writes = 0;
  const port: ForestPersistence = {
    async read() { return structuredClone(saved); },
    async write(next) { saved = structuredClone(next); writes++; },
  };
  return { port, read: () => structuredClone(saved), writes: () => writes };
}
const legacy = () => ({
  projects: [{ id: 'project-1', title: '耐受性研究', description: '验证细胞应激', status: 'active', tags: ['细胞'], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }],
  records: [{ id: 'record-1', title: '首次实验', content: '原始记录', status: 'completed', projectId: 'project-1', category: 'cell_culture', tags: [], date: '2026-01-02', createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', unfamiliarField: { exact: 'must survive' } }],
});

test('CRUD survives restart, returns detached data, searches and preserves archived records', async () => {
  const storage = memory();
  const repo = new ForestRepository(storage.port);
  const project = await repo.create({ kind: 'project', title: '  细胞研究  ' });
  const record = await repo.create({ kind: 'record', title: '实验一', projectId: project.id, content: '原始结果', tags: ['test'], data: { concentration: 0.1 } });
  project.title = 'outside mutation';
  assert.equal((await repo.get(project.id))!.title, '细胞研究');
  const found = await repo.list({ query: '原始结果', kind: 'record' });
  assert.equal(found[0]!.id, record.id);
  found[0]!.data.concentration = 999;
  assert.equal((await repo.get(record.id))!.data.concentration, 0.1);
  const updated = await repo.update({ id: record.id, expectedRevision: 1, patch: { content: '验证后的结果' } });
  assert.equal(updated.revision, 2);
  await repo.archive({ id: record.id, expectedRevision: 2 });
  assert.equal((await repo.list({ kind: 'record' })).length, 0);
  const restarted = new ForestRepository(storage.port);
  assert.equal((await restarted.list({ includeArchived: true })).length, 2);
  assert.equal((await restarted.get(record.id))!.content, '验证后的结果');
  assert.equal((await restarted.get(record.id))!.status, 'archived');
  assert.equal((await restarted.snapshot()).revision, 4);
});

test('concurrent writers serialize; optimistic revision prevents lost updates', async () => {
  const repo = new ForestRepository(memory().port);
  const record = await repo.create({ kind: 'note', title: '笔记' });
  const outcomes = await Promise.allSettled([
    repo.update({ id: record.id, expectedRevision: 1, patch: { content: 'writer A' } }),
    repo.update({ id: record.id, expectedRevision: 1, patch: { content: 'writer B' } }),
  ]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(outcomes.filter(x => x.status === 'rejected').length, 1);
  assert.equal((await repo.get(record.id))!.content, 'writer A');
});

test('rejects missing/wrong/archived project references without changing the store', async () => {
  const repo = new ForestRepository(memory().port);
  await assert.rejects(repo.create({ kind: 'record', title: 'bad', projectId: 'missing' }), /关联课题不存在/);
  const note = await repo.create({ kind: 'note', title: 'note' });
  await assert.rejects(repo.create({ kind: 'record', title: 'bad', projectId: note.id }), /关联课题不存在/);
  const project = await repo.create({ kind: 'project', title: 'project' });
  await repo.archive({ id: project.id, expectedRevision: 1 });
  await assert.rejects(repo.create({ kind: 'record', title: 'bad', projectId: project.id }), /已归档/);
  assert.equal((await repo.snapshot()).entities.length, 2);
});

test('research relations require existing entities of the declared kind on create and update', async () => {
  const repo = new ForestRepository(memory().port);
  const sop = await repo.create({ kind: 'sop', title: '真实 SOP' });
  const sample = await repo.create({ kind: 'sample', title: '真实样本' });
  const record = await repo.create({ kind: 'record', title: '实验', data: { sopId: sop.id, relatedSamples: [sample.id] } });
  const note = await repo.create({ kind: 'note', title: '解释', data: { relatedRecordId: record.id } });
  await repo.create({ kind: 'plan', title: '计划', data: { relatedRecordId: record.id } });
  const before = (await repo.snapshot()).revision;
  for (const input of [
    { kind: 'record', title: 'wrong SOP', data: { sopId: sample.id } },
    { kind: 'record', title: 'wrong sample', data: { relatedSamples: [sop.id] } },
    { kind: 'record', title: 'duplicate sample', data: { relatedSamples: [sample.id, sample.id] } },
    { kind: 'record', title: 'wrong shape', data: { relatedSamples: sample.id } },
    { kind: 'note', title: 'missing record', data: { relatedRecordId: 'missing' } },
    { kind: 'plan', title: 'wrong record', data: { relatedRecordId: sample.id } },
  ]) await assert.rejects(repo.create(input as unknown as CreateEntity));
  await assert.rejects(repo.update({ id: note.id, expectedRevision: 1, patch: { data: { relatedRecordId: 'missing' } } }), /关联对象不存在/);
  assert.equal((await repo.snapshot()).revision, before);
  assert.equal((await repo.get(note.id))!.data.relatedRecordId, record.id);
});

test('explicit null clears optional dates and single relations while retaining legacy fields', async () => {
  const repo = new ForestRepository(memory().port);
  const sop = await repo.create({ kind: 'sop', title: 'SOP' });
  const sample = await repo.create({ kind: 'sample', title: '样本', data: { storage: { location: '历史冰箱位置' }, location: null, expiryDate: null } });
  const record = await repo.create({ kind: 'record', title: '实验', data: { date: '2026-11-07', sopId: sop.id, relatedSamples: [sample.id] } });
  const updated = await repo.update({ id: record.id, expectedRevision: 1, patch: { data: { date: null, sopId: null, relatedSamples: [] } } });
  assert.deepEqual(updated.data, { date: null, sopId: null, relatedSamples: [] });
  const note = await repo.create({ kind: 'note', title: '笔记', data: { relatedRecordId: null } });
  const project = await repo.create({ kind: 'project', title: '课题', data: { startDate: null, endDate: null } });
  const plan = await repo.create({ kind: 'plan', title: '计划', data: { plannedDate: null, relatedRecordId: null } });
  assert.equal(note.data.relatedRecordId, null);
  assert.equal(project.data.endDate, null);
  assert.equal(plan.data.plannedDate, null);
  assert.deepEqual(sample.data.storage, { location: '历史冰箱位置' });
  assert.equal(sample.data.location, null);
  await assert.rejects(repo.update({ id: record.id, expectedRevision: 2, patch: { data: { date: '2026-02-30' } } }), /真实存在的日期/);
  assert.equal((await repo.get(record.id))!.data.date, null);
});

test('archived research targets remain linked historically but cannot receive new links', async () => {
  const storage = memory();
  const repo = new ForestRepository(storage.port);
  const sop = await repo.create({ kind: 'sop', title: 'SOP' });
  const sample = await repo.create({ kind: 'sample', title: 'sample' });
  const record = await repo.create({ kind: 'record', title: 'record', data: { sopId: sop.id, relatedSamples: [sample.id] } });
  const note = await repo.create({ kind: 'note', title: 'note', data: { relatedRecordId: record.id } });
  for (const entity of [sop, sample, record]) await repo.archive({ id: entity.id, expectedRevision: 1 });
  const changed = await repo.update({ id: note.id, expectedRevision: 1, patch: { content: '保留原关联并补充解释' } });
  assert.equal(changed.data.relatedRecordId, record.id);
  assert.equal((await repo.update({ id: record.id, expectedRevision: 2, patch: { content: '保留已归档样本和 SOP' } })).data.sopId, sop.id);
  for (const input of [
    { kind: 'record', title: 'new SOP link', data: { sopId: sop.id } },
    { kind: 'record', title: 'new sample link', data: { relatedSamples: [sample.id] } },
    { kind: 'plan', title: 'new record link', data: { relatedRecordId: record.id } },
  ]) await assert.rejects(repo.create(input as unknown as CreateEntity), /已归档对象/);
  const cleared = await repo.update({ id: note.id, expectedRevision: 2, patch: { data: {} } });
  await assert.rejects(repo.update({ id: note.id, expectedRevision: cleared.revision, patch: { data: { relatedRecordId: record.id } } }), /已归档对象/);
  const reopened = new ForestRepository(storage.port);
  assert.deepEqual((await reopened.get(record.id))!.data.relatedSamples, [sample.id]);
  const restored = new ForestRepository(memory().port);
  await restored.import({ data: await repo.export(), expectedRevision: 0 });
  assert.equal((await restored.get(record.id))!.data.sopId, sop.id);
});

test('validates title, status, dates, finite JSON, credentials, and immutable fields', async () => {
  const repo = new ForestRepository(memory().port);
  await assert.rejects(repo.get('../invalid'), /ID 格式/);
  const bad: unknown[] = [
    { kind: 'record', title: ' ' }, { kind: 'record', title: 'X', status: 'approved' },
    { kind: 'record', title: 'X', data: { date: '2026-02-30' } },
    { kind: 'record', title: 'X', data: { amount: Infinity } },
    { kind: 'record', title: 'X', data: { apiKey: 'secret' } },
    { kind: 'record', title: 'X', id: 'injected' },
  ];
  for (const value of bad) await assert.rejects(repo.create(value as CreateEntity));
  const item = await repo.create({ kind: 'record', title: 'valid' });
  await assert.rejects(repo.get('../invalid'), /ID 格式/);
  await assert.rejects(repo.update({ id: item.id, expectedRevision: 1, patch: { id: 'changed' } } as never), /不允许/);
  assert.equal((await repo.snapshot()).entities.length, 1);
});

test('failed persistence reloads and never announces success or loses a successful prior write', async () => {
  const storage = memory();
  const repo = new ForestRepository({ read: storage.port.read, async write(next) {
    if (next.revision === 2) throw new Error('disk full');
    await storage.port.write(next);
  } });
  await repo.create({ kind: 'note', title: 'one' });
  await assert.rejects(repo.create({ kind: 'note', title: 'two' }), /disk full/);
  assert.equal((await repo.snapshot()).entities.length, 1);
  assert.equal(storage.writes(), 1);
});

test('a failure after durable commit forces a fresh read, not a stale success-shaped snapshot', async () => {
  const storage = memory();
  const repo = new ForestRepository({ read: storage.port.read, async write(next) {
    await storage.port.write(next);
    throw new Error('acknowledgement lost');
  } });
  await assert.rejects(repo.create({ kind: 'note', title: 'committed' }), /acknowledgement lost/);
  assert.equal((await repo.snapshot()).entities[0]!.title, 'committed');
  assert.equal((await repo.snapshot()).revision, 1);
});

test('quarantined storage rejects reads after unknown durability rather than serving cached data', async () => {
  const storage = memory();
  let quarantined = false;
  const repo = new ForestRepository({ async read() {
    if (quarantined) throw new Error('unknown-state');
    return storage.port.read();
  }, async write() { quarantined = true; throw new Error('unknown-state'); } });
  await repo.snapshot();
  await assert.rejects(repo.create({ kind: 'note', title: 'uncertain' }), /unknown-state/);
  await assert.rejects(repo.snapshot(), /unknown-state/);
});

test('aborted draft queued behind another transaction never reaches persistence', async () => {
  const storage = memory();
  let release!: () => void;
  let started!: () => void;
  const firstStarted = new Promise<void>(resolve => { started = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const repo = new ForestRepository({ read: storage.port.read, async write(next) {
    if (next.revision === 1) { started(); await gate; }
    await storage.port.write(next);
  } });
  const first = repo.create({ kind: 'note', title: 'first' });
  await firstStarted;
  const controller = new AbortController();
  const second = repo.create({ kind: 'record', title: 'cancelled' }, controller.signal);
  controller.abort();
  release();
  await first;
  await assert.rejects(second, { name: 'AbortError' });
  assert.equal(storage.writes(), 1);
  assert.equal((await repo.snapshot()).entities.length, 1);
});

test('import previews without writing, imports project associations and preserves original fields', async () => {
  const storage = memory();
  const repo = new ForestRepository(storage.port);
  const preview = await repo.previewImport({ data: legacy() });
  assert.equal(preview.createCount, 2);
  assert.equal(storage.writes(), 0);
  const imported = await repo.import({ data: legacy(), expectedRevision: preview.revision });
  assert.equal(imported.imported, 2);
  const [record] = await repo.list({ kind: 'record' });
  const [project] = await repo.list({ kind: 'project' });
  assert.equal(record!.projectId, project!.id);
  assert.deepEqual(record!.data.unfamiliarField, { exact: 'must survive' });
  assert.equal((await repo.export()).imports[0]!.raw.records instanceof Array, true);
  const reopened = new ForestRepository(storage.port);
  assert.equal((await reopened.list()).length, 2);
});

test('same legacy backup is idempotent even after local edits; re-import never overwrites them', async () => {
  const storage = memory();
  const repo = new ForestRepository(storage.port);
  await repo.import({ data: legacy(), expectedRevision: 0 });
  const [record] = await repo.list({ kind: 'record' });
  await repo.update({ id: record!.id, expectedRevision: 1, patch: { content: 'new local evidence' } });
  const preview = await repo.previewImport({ data: legacy() });
  assert.equal(preview.alreadyImported, true);
  assert.equal(preview.conflicts.length, 0);
  const before = storage.writes();
  const again = await repo.import({ data: legacy(), expectedRevision: preview.revision });
  assert.equal(again.imported, 0);
  assert.equal(storage.writes(), before);
  assert.equal((await repo.get(record!.id))!.content, 'new local evidence');
});

test('import is all-or-nothing when any existing ID conflicts and rejects stale preview revisions', async () => {
  const repo = new ForestRepository(memory().port);
  await repo.import({ data: legacy(), expectedRevision: 0 });
  const changed = legacy();
  changed.records[0]!.content = 'different original';
  const preview = await repo.previewImport({ data: changed });
  assert.equal(preview.conflicts.length, 1);
  await assert.rejects(repo.import({ data: changed, expectedRevision: preview.revision }), /冲突记录/);
  const before = await repo.snapshot();
  await repo.create({ kind: 'note', title: 'concurrent note' });
  await assert.rejects(repo.import({ data: { notes: [] }, expectedRevision: before.revision }), /重新预览/);
  assert.equal((await repo.list({ kind: 'record' }))[0]!.content, '原始记录');
});

test('old partial Settings exports retain orphan project IDs without inventing projects', async () => {
  const data = { records: legacy().records };
  const repo = new ForestRepository(memory().port);
  const preview = await repo.previewImport({ data });
  assert.match(preview.warnings.join(' '), /关联课题未包含/);
  await repo.import({ data, expectedRevision: 0 });
  const [record] = await repo.list();
  assert.equal(record!.projectId, undefined);
  assert.equal(record!.data.projectId, 'project-1');
});

test('legacy automatic verification and QC flags remain original evidence with an explicit review warning', async () => {
  const data = { records: [{ ...legacy().records[0], qualityControl: { replicates: 3, randomization: true }, dataValidation: { isValidated: true } }] };
  const repo = new ForestRepository(memory().port);
  const preview = await repo.previewImport({ data });
  assert.match(preview.warnings.join(' '), /迁移不代表复核/);
  await repo.import({ data, expectedRevision: 0 });
  const [record] = await repo.list();
  assert.deepEqual(record!.data.qualityControl, data.records[0]!.qualityControl);
  assert.deepEqual(record!.data.dataValidation, data.records[0]!.dataValidation);
});

test('legacy research links map by kind, missing links remain readable in explicit legacy metadata', async () => {
  const data = {
    records: [{ ...legacy().records[0], sopId: 'same-id', relatedSamples: ['same-id', 'missing-sample'] }],
    sops: [{ id: 'same-id', title: 'SOP', content: '步骤', version: '1.0' }],
    samples: [{ id: 'same-id', name: '样本', status: 'available' }],
    notes: [{ id: 'note-1', title: '笔记', relatedRecordId: 'record-1' }],
    plans: [{ id: 'plan-1', title: '计划', relatedRecordId: 'missing-record' }],
  };
  const repo = new ForestRepository(memory().port);
  const preview = await repo.previewImport({ data });
  assert.match(preview.warnings.join(' '), /relatedSamples.*未找到/);
  assert.match(preview.warnings.join(' '), /relatedRecordId.*未找到/);
  await repo.import({ data, expectedRevision: 0 });
  const [record] = await repo.list({ kind: 'record' });
  const [sop] = await repo.list({ kind: 'sop' });
  const [sample] = await repo.list({ kind: 'sample' });
  const [note] = await repo.list({ kind: 'note' });
  const [plan] = await repo.list({ kind: 'plan' });
  assert.notEqual(sop!.id, sample!.id);
  assert.equal(record!.data.sopId, sop!.id);
  assert.deepEqual(record!.data.relatedSamples, [sample!.id]);
  assert.equal(note!.data.relatedRecordId, record!.id);
  assert.equal(plan!.data.relatedRecordId, undefined);
  assert.deepEqual(record!.data.legacyRelations, { sopId: 'same-id', relatedSamples: ['same-id', 'missing-sample'] });
  assert.deepEqual(record!.data.unresolvedLegacyRelations, { relatedSamples: ['missing-sample'] });
  assert.deepEqual(plan!.data.unresolvedLegacyRelations, { relatedRecordId: 'missing-record' });
  const originals = (await repo.export()).imports[0]!.raw.records as unknown as typeof data.records;
  assert.deepEqual(originals[0]!.relatedSamples, ['same-id', 'missing-sample']);
  assert.deepEqual(originals[0]!.sopId, 'same-id');
  assert.equal((await repo.previewImport({ data })).alreadyImported, true);
});

test('native backups and persisted state reject missing research references before any writes', async () => {
  const repo = new ForestRepository(memory().port);
  await repo.create({ kind: 'record', title: '实验' });
  const backup = await repo.export();
  backup.entities[0]!.data.relatedSamples = ['missing'];
  assert.throws(() => validateState(backup), /关联对象不存在/);
  const storage = memory();
  const destination = new ForestRepository(storage.port);
  await assert.rejects(destination.previewImport({ data: backup }), /关联对象不存在/);
  await assert.rejects(destination.import({ data: backup, expectedRevision: 0 }), /关联对象不存在/);
  assert.equal(storage.writes(), 0);
});

test('full localStorage export strips settings and nested credentials but preserves unmapped business collections', async () => {
  const data = {
    experiment_records: JSON.stringify([{ ...legacy().records[0], apiKey: 'do-not-import', unfamiliarField: { password: 'hidden', exact: 'kept' } }]),
    aiSettings: JSON.stringify({ apiKey: 'do-not-import' }), aiChatSessions: { private: true },
    todoItems: JSON.stringify([{ id: 'todo-1', title: '检测结果' }]),
    calendarEvents: 'unparseable but preserved', dailyMood_2026_11_07: 'ignored',
    'dailyMood_2026-11-07': JSON.stringify({ mood: 'calm' }),
  };
  const repo = new ForestRepository(memory().port);
  await repo.import({ data, expectedRevision: 0 });
  const backup = await repo.export();
  assert.equal(JSON.stringify(backup).includes('do-not-import'), false);
  assert.equal(JSON.stringify(backup).includes('hidden'), false);
  assert.equal(backup.imports[0]!.raw.calendarEvents, 'unparseable but preserved');
  assert.deepEqual(backup.imports[0]!.raw.todoItems, [{ id: 'todo-1', title: '检测结果' }]);
  assert.deepEqual(backup.entities[0]!.data.unfamiliarField, { exact: 'kept' });
});

test('native export/import preserves entities and legacy evidence across repositories', async () => {
  const original = new ForestRepository(memory().port);
  await original.import({ data: legacy(), expectedRevision: 0 });
  await original.create({ kind: 'sop', title: '操作规程', status: 'approved', content: '版本正文' });
  const backup = await original.export();
  const destination = new ForestRepository(memory().port);
  await destination.import({ data: backup, expectedRevision: 0 });
  assert.deepEqual((await destination.snapshot()).entities, backup.entities);
  assert.deepEqual((await destination.export()).imports[0], backup.imports[0]);
  assert.equal(stateSchema.safeParse(await destination.export()).success, true);
});

test('native import archives unknown entity fields instead of silently dropping original evidence', async () => {
  const original = new ForestRepository(memory().port);
  await original.create({ kind: 'note', title: '历史证据' });
  const backup = await original.export();
  (backup.entities[0] as unknown as Record<string, unknown>).futureEvidence = { exact: 'preserve this' };
  const destination = new ForestRepository(memory().port);
  await destination.import({ data: backup, expectedRevision: 0 });
  const archives = (await destination.export()).imports;
  const rawEntities = archives.at(-1)!.raw.entities as { futureEvidence: { exact: string } }[];
  assert.equal(rawEntities[0]!.futureEvidence.exact, 'preserve this');
});

test('malformed and future-version stores fail without reset; invalid imports never touch persistence', async () => {
  const storage = memory({ ...createInitialState(), schemaVersion: 99 } as never);
  const repo = new ForestRepository(storage.port);
  await assert.rejects(repo.snapshot(), /不支持此数据版本/);
  assert.equal(storage.writes(), 0);
  const validStorage = memory();
  const target = new ForestRepository(validStorage.port);
  for (const data of [null, {}, { records: 'broken JSON' }, { records: [legacy().records[0], legacy().records[0]] }, { format: 'experiment-forest', schemaVersion: 2, entities: [] }]) {
    await assert.rejects(target.import({ data, expectedRevision: 0 }));
  }
  assert.equal(validStorage.writes(), 0);
  assert.throws(() => validateState({ ...createInitialState(), entities: [{ id: 'bad' }] }));
});

test('native backup validates archive fingerprints and rejects conflicting alias collections', () => {
  assert.throws(() => prepareImport({ records: [], experiment_records: [] }), /同时提供/);
  assert.throws(() => prepareImport({ format: 'experiment-forest', schemaVersion: 1, entities: [], imports: [{ id: '0'.repeat(64), source: 'legacy', importedAt: '2026-01-01', entityCount: 0, raw: { records: [] } }] }), /指纹不匹配/);
});

test('close drains accepted work and refuses new requests', async () => {
  const repo = new ForestRepository(memory().port);
  const pending = repo.create({ kind: 'note', title: 'last note' });
  await repo.close();
  assert.equal((await pending).title, 'last note');
  await assert.rejects(repo.snapshot(), /已关闭/);
});
