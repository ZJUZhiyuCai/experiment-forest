/** Launch a keyless development Harness with its own profile and empty workspace. */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
const repo = fileURLToPath(new URL('..', import.meta.url));
const state = resolve(process.env.FOREST_DEV_HOME || join(repo, '.dsh-dev'));
const workspace = join(state, 'workspace');
await mkdir(workspace, { recursive: true });
const patch = join(state, 'forest.patch.yml');
await writeFile(patch, [
  ...['llm-deepseek', 'llm-deepseek-account', 'llm-pi-ai', 'session-log-deepseek', 'session-telemetry-otel']
    .flatMap(id => [`- id: ${id}`, '  disabled: true']), '',
].join('\n'));
const built = spawn(process.execPath, [join(repo, 'scripts/build-plugin.mjs')], { cwd: repo, stdio: 'inherit' });
const builtCode = await new Promise(resolveExit => built.on('exit', resolveExit));
if (builtCode !== 0) process.exit(builtCode ?? 1);
const env = Object.fromEntries(['PATH', 'HOME', 'LANG', 'TMPDIR', 'SYSTEMROOT'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
Object.assign(env, { DSH_HOME: state, DSH_TELEMETRY_DISABLED: '1', DSH_TELEMETRY_MODE: 'DISABLED' });
const cli = join(repo, 'node_modules/@deepseek-ai/dsh/lib/bin.js');
async function prepare(args, visible = false) {
  const setup = spawn(process.execPath, [cli, ...args], { cwd: workspace, env, stdio: ['ignore', visible ? 'inherit' : 'ignore', 'inherit'] });
  const code = await new Promise(resolveExit => setup.on('exit', resolveExit));
  if (code !== 0) process.exit(code ?? 1);
}
await prepare(['web', '--dump-config']);
await prepare(['plugin', '--profile', 'web', 'add', repo, '--ignore-scripts']);
console.log('Starting isolated development Harness: model providers disabled; no API key needed.');
console.log(`Development records: ${state}`);
const child = spawn(process.execPath, [cli, 'web', '--patch', patch, '--host', '127.0.0.1', '--port', process.env.FOREST_DEV_PORT || '0', '--no-open'],
  { cwd: workspace, env, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { child.kill(signal); });
child.on('exit', code => { process.exitCode = code ?? 0; });
