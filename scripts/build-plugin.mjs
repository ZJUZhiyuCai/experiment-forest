import { build } from 'esbuild';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const shared = ['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis'];
await rm('lib', { recursive: true, force: true });
await mkdir('lib', { recursive: true });
await build({ entryPoints: { index: 'plugin/service.ts', remote: 'plugin/remote.ts' }, outdir: 'lib', bundle: true,
  format: 'esm', platform: 'node', target: 'node24', packages: 'external', sourcemap: true });
await build({ entryPoints: ['client/index.ts'], outfile: 'lib/client.js', bundle: true, format: 'cjs', platform: 'browser', target: 'es2022',
  external: shared, sourcemap: true, define: { 'process.env.NODE_ENV': '"production"' },
  banner: { js: `window.__ModuleLoader__.load({id:${JSON.stringify(manifest.name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;` },
  footer: { js: 'return module.exports;}});' },
  plugins: [{ name: 'plugin-owned-css', setup(builder) {
    builder.onLoad({ filter: /\.css\?inline$/ }, async ({ path }) => ({ contents: `export default ${JSON.stringify(await readFile(path.replace(/\?inline$/, ''), 'utf8'))}`, loader: 'js' }));
    builder.onResolve({ filter: /\.css\?inline$/ }, args => ({ path: resolve(args.resolveDir, args.path), namespace: 'inline-css' }));
  } }],
});
console.log('Built native Harness host and client artifacts in lib/.');
