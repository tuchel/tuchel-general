#!/usr/bin/env node
// Build a local preview: one page per figure in a 640 px reading column, with
// the kit's CSS and the Inter face, rendered in the browser the way an app
// renders it. Used for headless captures (bin/capture.mjs).
//
//   node shared/charts/bin/preview.mjs <registry.tsx> --out <dir>
//
// Page query: ?spacer=N adds N px above and below the figure, so the scroll
// reveal can be exercised; ?theme=dark sets the opt-in dark tokens.
import { copyFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
if (!args[0] || !flag('--out')) {
  console.error('usage: preview.mjs <registry.tsx> --out <dir>');
  process.exit(2);
}
const registry = resolve(args[0]);
const out = resolve(flag('--out'));
mkdirSync(out, { recursive: true });

// Names first, so each page knows which figure to mount.
mkdirSync(join(KIT, '.cache'), { recursive: true });
const probe = join(KIT, '.cache', `preview-${Date.now()}.mjs`);
await build({ entryPoints: [registry], bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', outfile: probe, external: ['react', 'react-dom', 'react/*', 'react-dom/*'], loader: { '.css': 'empty' }, logLevel: 'error' });
const names = Object.keys((await import(pathToFileURL(probe).href)).figures);
rmSync(probe, { force: true });

await build({
  stdin: {
    contents: `import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { figures } from ${JSON.stringify(registry)};
const host = document.querySelector('[data-figure]');
createRoot(host).render(createElement(figures[host.dataset.figure].component, { mode: 'live' }));
requestAnimationFrame(() => { window.__figReady = true; });`,
    resolveDir: KIT,
    loader: 'tsx',
  },
  bundle: true,
  minify: true,
  format: 'iife',
  jsx: 'automatic',
  outfile: join(out, 'figures.js'),
  nodePaths: [join(KIT, 'node_modules')],
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.css': 'empty' },
  logLevel: 'error',
});

for (const f of readdirSync(join(KIT, 'fonts')).filter((f) => f.endsWith('.woff2') || f.endsWith('.css'))) copyFileSync(join(KIT, 'fonts', f), join(out, f));
copyFileSync(join(KIT, 'charts.css'), join(out, 'charts.css'));

for (const name of names) {
  const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name}</title>
<link rel="stylesheet" href="inter.css"><link rel="stylesheet" href="charts.css">
<script>{ const q = new URLSearchParams(location.search); if (q.get('theme') === 'dark') document.documentElement.dataset.theme = 'dark'; document.documentElement.style.setProperty('--spacer', (Number(q.get('spacer')) || 0) + 'px'); }</script>
<style>body{margin:0;background:var(--chart-ground);color:var(--chart-ink);font:16px/1.55 Inter,system-ui,sans-serif} .shot{padding:28px 16px 36px;overflow:hidden} article{max-width:640px;margin:0 auto} .spacer{height:var(--spacer,0)}</style>
</head><body><div class="shot"><div class="spacer"></div><article><p>Body text at the reading size, for scale.</p><div data-figure="${name}"></div></article><div class="spacer"></div></div>
<script src="figures.js"></script></body></html>`;
  writeFileSync(join(out, `${name}.html`), page);
  console.log(`wrote ${relative(process.cwd(), join(out, `${name}.html`))}`);
}
