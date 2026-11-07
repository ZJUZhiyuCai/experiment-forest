import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../public/legacy-export.js', import.meta.url), 'utf8');
function run(values: Record<string, string>) {
  let downloaded: Blob | undefined;
  const store = Object.assign(Object.create({ getItem: (key: string) => values[key] ?? null }), values);
  const status = { textContent: '' };
  const button = { addEventListener: (_: string, fn: () => void) => fn() };
  runInNewContext(source, {
    localStorage: store, Blob, console,
    document: { getElementById: (id: string) => id === 'export' ? button : status, createElement: () => ({ click() {} }) },
    URL: { createObjectURL: (blob: Blob) => { downloaded = blob; return 'blob:test'; }, revokeObjectURL() {} },
    setTimeout: (fn: () => void) => fn(),
  });
  return { downloaded, status: status.textContent };
}
test('legacy exporter preserves raw business records and excludes secrets and chat', async () => {
  const raw = { projects: '[{"id":"p1"}]', experiment_records: 'malformed original',
    dailyMood_2026_11_07: 'not a supported key', 'dailyMood_2026-11-07': '{"mood":"ok"}',
    aiSettings: '{"apiKey":"never-export"}', aiChatSessions: '{"private":"chat"}' };
  const { downloaded, status } = run(raw);
  const backup = JSON.parse(await downloaded!.text());
  assert.deepEqual(backup, { projects: raw.projects, experiment_records: raw.experiment_records, 'dailyMood_2026-11-07': raw['dailyMood_2026-11-07'] });
  assert.match(status, /无法解析/);
  assert.equal(raw.experiment_records, 'malformed original');
});
test('empty origin does not download a misleading blank backup', () => {
  const { downloaded, status } = run({ aiSettings: '{"apiKey":"never-export"}' });
  assert.equal(downloaded, undefined);
  assert.match(status, /没有旧版业务数据/);
});
