import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import * as fontkit from 'fontkit';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';

import { chartFace, measure, setChartFace, wrap } from '../src/measure.ts';
import { INTER } from '../src/fonts/inter.generated.ts';
import { COLOR, MOTION, c } from '../src/tokens.ts';
import { KeyedTween, interpolateValue, resample } from '../src/motion/tween.ts';
import { cubicBezier, ease } from '../src/motion/ease.ts';
import { timingFor } from '../src/figure/context.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const KIT = join(HERE, '..');
const CSS = readFileSync(join(KIT, 'charts.css'), 'utf8');
const DARK = ':root[data-theme="dark"] {';

test('measure matches shaped widths from the font files (advances + kerning)', () => {
  const f = fontkit.openSync(join(KIT, 'fonts', 'Inter-400.woff2')) as unknown as { unitsPerEm: number; layout: (s: string) => { advanceWidth: number } };
  const samples = ['Local tax per resident, $4,210', 'AVAVA To', 'Drive time 18 min · 2.24 mi', 'Wollaston Lake', '$88 − $12 credit = $75', 'Tenure 7 yrs', 'Yearly T.V.'];
  for (const s of samples) {
    const truth = (f.layout(s).advanceWidth / f.unitsPerEm) * 12;
    const got = measure(s, { size: 12 });
    assert.ok(Math.abs(got - truth) / truth < 0.005, `${s}: ${got.toFixed(2)} vs ${truth.toFixed(2)}`);
  }
});

test('wrap never exceeds the width and never splits a word', () => {
  const text = 'Spending per resident rises from $2,900 to $5,400 across the 20 largest metros; Austin sits at $3,870';
  const lines = wrap(text, 300, { size: 17, weight: 600 });
  assert.ok(lines.length > 1);
  for (const l of lines) assert.ok(measure(l, { size: 17, weight: 600 }) <= 300 || !l.includes(' '));
  assert.equal(lines.join(' '), text);
});

test('every chart color token exists in the theme, light and dark', () => {
  const [lightBlock, darkBlock] = [CSS.slice(0, CSS.indexOf(DARK)), CSS.slice(CSS.indexOf(DARK), CSS.indexOf('}', CSS.indexOf(DARK)))];
  for (const [name, [v, light, dark]] of Object.entries(COLOR)) {
    if (!v.startsWith('--chart-') || v === '--chart-halo') continue;
    assert.ok(lightBlock.includes(`${v}: ${light};`), `${name} light ${v}: ${light}`);
    assert.ok(darkBlock.includes(`${v}: ${dark};`), `${name} dark ${v}: ${dark}`);
  }
});

test('motion tokens: CSS and TypeScript agree, reduced motion zeroes them, no curve overshoots', () => {
  for (const k of ['fast', 'base', 'slow', 'reveal', 'crossfade'] as const) {
    assert.ok(CSS.includes(`--motion-${k}: ${MOTION.duration[k]}ms;`), k);
  }
  assert.ok(CSS.includes(`--motion-stagger: ${MOTION.stagger.step}ms;`));
  const reduced = CSS.slice(CSS.indexOf('@media (prefers-reduced-motion: reduce) {\n  :root {'));
  for (const k of ['fast', 'base', 'slow', 'reveal', 'crossfade', 'stagger']) assert.ok(reduced.includes(`--motion-${k}: 0ms`), k);
  for (const [name, pts] of Object.entries(MOTION.ease)) {
    const css = `--ease-${name}: cubic-bezier(${pts.join(', ')});`;
    if (name !== 'linear') assert.ok(CSS.includes(css), css);
    assert.ok(pts.every((p) => p >= 0 && p <= 1), `${name} control points stay in [0, 1]`);
    const e = ease(name as keyof typeof MOTION.ease);
    for (let t = 0; t <= 1; t += 0.02) assert.ok(e(t) >= -1e-6 && e(t) <= 1 + 1e-6, `${name}(${t}) = ${e(t)}`);
  }
  assert.ok(Math.abs(cubicBezier(0.2, 0, 0, 1)(0.5) - 0.8) < 0.1);
});

test('c() paints through the token with the light hex as fallback', () => {
  assert.equal(c('series2'), 'var(--chart-series-2, #EB6834)');
  assert.ok(!CSS.includes('prefers-color-scheme'), 'dark is opt-in: a light page never gets dark charts from the OS alone');
});

test('setChartFace switches the face every measurement uses', () => {
  const narrow = { ...INTER, family: 'Narrow', weights: { 400: { ...INTER.weights[400], upm: INTER.weights[400].upm * 2 } } };
  const before = measure('Austin', { size: 12 });
  setChartFace(narrow);
  try {
    assert.equal(chartFace().family, 'Narrow');
    assert.ok(Math.abs(measure('Austin', { size: 12, weight: 600 }) - before / 2) < 1e-9, 'nearest weight, new metrics');
  } finally {
    setChartFace(INTER);
  }
});

test('interpolation: numbers tween, strings (colors) take the target at once', () => {
  const f = interpolateValue({ x: 0, fill: 'var(--a, #000)', pts: [0, 10] }, { x: 10, fill: 'var(--b, #fff)', pts: [10, 20] });
  assert.deepEqual(f(0.5), { x: 5, fill: 'var(--b, #fff)', pts: [5, 15] });
});

test('keyed tween: update moves, enter grows from its enter state, exit leaves and is removed', () => {
  const linear = (t: number) => t;
  const tw = new KeyedTween([{ id: 'a', w: 10 }, { id: 'b', w: 20 }], {
    key: (d) => d.id,
    timing: () => ({ duration: 100, ease: linear, delay: 0 }),
    enter: (d) => ({ ...d, w: 0 }),
    exit: (d) => ({ ...d, w: 0 }),
  });
  assert.deepEqual(tw.values().map((v) => v.value.w), [10, 20]);
  const r = tw.reconcile([{ id: 'a', w: 30 }, { id: 'c', w: 40 }], 0);
  assert.ok(r.changed && r.moving);
  tw.step(50);
  const mid = Object.fromEntries(tw.values().map((v) => [v.key, v.value.w]));
  assert.deepEqual(mid, { a: 20, c: 20, b: 10 });
  assert.equal(tw.step(100), false);
  assert.deepEqual(tw.values().map((v) => [v.key, v.value.w]), [['a', 30], ['c', 40]]);
  assert.equal(tw.reconcile([{ id: 'a', w: 30 }, { id: 'c', w: 40 }], 200).changed, false);
});

test('an interrupted tween retargets from where it is, not from where it started', () => {
  const tw = new KeyedTween([{ id: 'a', w: 0 }], { key: (d) => d.id, timing: () => ({ duration: 100, ease: (t) => t, delay: 0 }) });
  tw.reconcile([{ id: 'a', w: 100 }], 0);
  tw.step(50);
  tw.reconcile([{ id: 'a', w: 0 }], 50);
  tw.step(100);
  assert.equal(tw.values()[0].value.w, 25);
});

test('timing: reveal staggers and caps; data changes use the slow curve; still and check renders are instant', () => {
  const reveal = timingFor({ cause: 'reveal', still: false, mode: 'live' });
  assert.equal(reveal('enter', null, 0).duration, MOTION.duration.reveal);
  assert.equal(reveal('enter', null, 3).delay, 3 * MOTION.stagger.step);
  assert.equal(reveal('enter', null, 400).delay, MOTION.stagger.max);
  assert.equal(timingFor({ cause: 'data', still: false, mode: 'live' })('update', null, 0).duration, MOTION.duration.slow);
  for (const ctx of [{ cause: 'data', still: true, mode: 'live' }, { cause: 'reveal', still: false, mode: 'check' }, { cause: 'resize', still: false, mode: 'live' }, { cause: 'hide', still: false, mode: 'live' }] as const) {
    const t = timingFor(ctx)('update', null, 5);
    assert.equal(t.duration + t.delay, 0, JSON.stringify(ctx));
  }
});

test('resample keeps both ends and the requested count', () => {
  const r = resample([[0, 0], [10, 0], [10, 10]], 5);
  assert.equal(r.length, 5);
  assert.deepEqual(r[0], [0, 0]);
  assert.deepEqual(r[4], [10, 10]);
  assert.deepEqual(r[2], [10, 0]);
});

async function load(registry: string) {
  mkdirSync(join(KIT, '.cache'), { recursive: true });
  const out = join(KIT, '.cache', `test-${Date.now()}.mjs`);
  await build({ entryPoints: [registry], bundle: true, platform: 'node', format: 'esm', jsx: 'automatic', outfile: out, external: ['react', 'react-dom', 'react/*', 'react-dom/*'], logLevel: 'error' });
  try {
    return await import(pathToFileURL(out).href);
  } finally {
    rmSync(out, { force: true });
  }
}

test('the sampler renders live with its controls, marks, takeaways, and numbers', async () => {
  const { figures } = await load(join(KIT, 'examples', 'registry.tsx'));
  const html = renderToString(createElement(figures['kit-sampler'].component, { mode: 'live' }));
  assert.ok(html.includes('role="radiogroup"') && html.includes('Show the numbers'));
  assert.ok(html.includes('data-fig-focus="u1"') && html.includes('aria-label="Unit 1: $100"'));
  assert.ok(html.includes('<dt>Look at</dt>') && html.includes('<dt>Scrutinize</dt>'), 'takeaways render');
  assert.ok(html.includes('font-family="Inter, system-ui, sans-serif"'), 'the plot draws with the chart face');
});

test('check-figures passes the sampler in every listed state', () => {
  const out = execFileSync('node', [join(KIT, 'bin', 'check-figures.mjs'), join(KIT, 'examples', 'registry.tsx')], { encoding: 'utf8' });
  assert.match(out, /ok kit-sampler {2}\(2 state\(s\)/);
});

test('check-figures fails on labels sharing ink, small type, and missing takeaways; instruments are exempt', () => {
  mkdirSync(join(KIT, '.cache'), { recursive: true });
  const reg = join(KIT, '.cache', 'clash-registry.tsx');
  writeFileSync(reg, `import { Figure, Texts, type RenderMode } from '../src/index.ts';
export function Clash({ mode }: { mode?: RenderMode }) {
  return <Figure id="clash" mode={mode} headline="Clash" label="clash" height={60}>{() => <Texts data={[
    { id: 'a', x: 10, y: 30, text: 'Overlapping label', anchor: 'start' },
    { id: 'b', x: 40, y: 32, text: 'Another label', anchor: 'start', size: 9 },
  ]} />}</Figure>;
}
export function Tool({ mode }: { mode?: RenderMode }) {
  return <Figure id="tool" mode={mode} headline="Tool" label="tool" height={60} instrument>{() => <Texts data={[{ id: 'a', x: 10, y: 30, text: 'Alone', anchor: 'start' }]} />}</Figure>;
}
export const figures = { clash: { component: Clash }, tool: { component: Tool } };
`);
  let code = 0;
  let err = '';
  let out = '';
  try {
    execFileSync('node', [join(KIT, 'bin', 'check-figures.mjs'), reg], { encoding: 'utf8', stdio: 'pipe' });
  } catch (e) {
    code = (e as { status: number }).status;
    err = String((e as { stderr: string }).stderr);
    out = String((e as { stdout: string }).stdout);
  }
  rmSync(reg, { force: true });
  assert.equal(code, 1);
  assert.match(err, /clash: 1 label overlap\(s\) at 358 px/);
  assert.match(err, /clash: smallest text is 9 px/);
  assert.match(err, /clash: figure "clash" has no takeaways/);
  assert.doesNotMatch(err, /tool:/);
  assert.match(out, /ok tool/);
});
