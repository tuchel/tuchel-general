#!/usr/bin/env node
// The figure gate. Renders every figure in each registry in memory and fails on:
//   - two labels (Texts marks) that share ink at rest,
//   - any text set under 11 px (figures draw at 1:1, so set size is rendered size),
//   - an explanatory figure without takeaways (Look at / Learn / Scrutinize), or a
//     takeaway that is not one sentence of at most 34 words.
// Each figure is checked at a phone, column, and wide width, in every state the
// registry lists, and rendered live once so a crash in the live path fails here.
// Nothing is written to disk.
//
//   node shared/charts/bin/check-figures.mjs <registry.tsx> [<registry.tsx> ...]
//   node shared/charts/bin/check-figures.mjs --all   (the sampler plus every tracked src/figures.tsx)
//
// A registry exports `figures = { '<name>': { component, states?: [props, …] } }`.
// `states` are extra props (a scenario, a slider extreme) to check besides the default.
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WIDTHS = [358, 640, 1100]; // a 390 px phone less its gutters, the reading column, a wide panel
const MIN_PX = 11;

function allRegistries() {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: KIT, encoding: 'utf8' }).trim();
  const tracked = execFileSync('git', ['ls-files', '--', ':(glob)**/src/figures.tsx'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  return [join(KIT, 'examples', 'registry.tsx'), ...tracked.map((f) => join(root, f))];
}
const registries = process.argv[2] === '--all' ? allRegistries() : process.argv.slice(2).map((a) => resolve(a));
if (!registries.length || registries.some((r) => !existsSync(r))) {
  console.error('usage: check-figures.mjs <registry.tsx> [<registry.tsx> ...]');
  process.exit(2);
}

const React = await import('react');
const { renderToStaticMarkup, renderToString } = await import('react-dom/server');
const cache = join(KIT, '.cache');
mkdirSync(cache, { recursive: true });

function overlaps(boxes) {
  const out = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5) {
        out.push(`"${a.text.replace(/\n/g, ' ')}" × "${b.text.replace(/\n/g, ' ')}"`);
      }
    }
  }
  return out;
}

function takeawayErrors(takes) {
  const out = [];
  for (const t of takes) {
    if (!t.takeaways) {
      if (!t.instrument) out.push(`figure "${t.figure}" has no takeaways (Look at / Learn / Scrutinize); mark a tool panel \`instrument\``);
      continue;
    }
    for (const [k, v] of Object.entries(t.takeaways)) {
      const words = String(v).trim().split(/\s+/).filter(Boolean).length;
      const sentences = String(v).trim().split(/(?<=[.!?])\s+(?=[A-Z“"$(])/).length;
      if (!words || words > 34 || sentences > 1) out.push(`takeaway "${k}" must be one sentence of at most 34 words (${words} words, ${sentences} sentences)`);
    }
  }
  return out;
}

const smallest = (markup) => Math.min(Infinity, ...[...markup.matchAll(/font-size(?:="|:\s*)([\d.]+)/g)].map((m) => Number(m[1])));

let failures = 0;
for (const registry of registries) {
  const tag = createHash('sha1').update(registry).digest('hex').slice(0, 10);
  const bundle = join(cache, `check-${tag}.mjs`);
  await build({
    entryPoints: [registry],
    bundle: true,
    platform: 'node',
    format: 'esm',
    jsx: 'automatic',
    outfile: bundle,
    external: ['react', 'react-dom', 'react-dom/*', 'react/*'],
    loader: { '.css': 'empty', '.svg': 'empty', '.png': 'empty', '.woff2': 'empty' },
    logLevel: 'error',
  });
  const { figures } = await import(`${pathToFileURL(bundle).href}?t=${Date.now()}`);
  rmSync(bundle, { force: true });
  if (!figures || !Object.keys(figures).length) {
    console.error(`${relative(process.cwd(), registry)}: exports no \`figures\``);
    failures++;
    continue;
  }

  console.log(relative(process.cwd(), registry));
  for (const [name, entry] of Object.entries(figures)) {
    const errors = new Set();
    let minPx = Infinity;
    for (const state of [{}, ...(entry.states ?? [])]) {
      const where = Object.keys(state).length ? ` ${JSON.stringify(state)}` : '';
      for (const width of WIDTHS) {
        globalThis.__figCheck = { width, labels: [], takeaways: [] };
        const markup = renderToStaticMarkup(React.createElement(entry.component, { ...state, mode: 'check' }));
        const { labels, takeaways } = globalThis.__figCheck;
        delete globalThis.__figCheck;
        minPx = Math.min(minPx, smallest(markup));
        const clashes = overlaps(labels);
        if (clashes.length) errors.add(`${clashes.length} label overlap(s) at ${width} px${where}: ${clashes.slice(0, 6).join('; ')}`);
        for (const e of takeawayErrors(takeaways)) errors.add(e);
      }
    }
    if (minPx < MIN_PX) errors.add(`smallest text is ${minPx} px (minimum ${MIN_PX})`);
    try {
      renderToString(React.createElement(entry.component, { mode: 'live' }));
    } catch (e) {
      errors.add(`live render throws: ${e.message}`);
    }
    if (errors.size) {
      failures++;
      for (const e of errors) console.error(`  ${name}: ${e}`);
    } else {
      console.log(`ok ${name}  (${1 + (entry.states?.length ?? 0)} state(s) × ${WIDTHS.join('/')} px, smallest text ${minPx} px)`);
    }
  }
}
process.exit(failures ? 1 : 0);
