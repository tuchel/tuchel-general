#!/usr/bin/env node
// Headless screenshots of preview pages (bin/preview.mjs) or built app pages,
// with Playwright's Chromium (`npx playwright install chromium` once locally).
//
//   capture.mjs <page.html|url> <out.png> [--dark] [--reduced] [--width 1280]
//               [--hover <sel>] [--click <sel>] [--focus-tab <n>] [--select <sel>]
//
// The page settles first (fonts, render, the entrance), so a shot never
// catches a figure mid-reveal. Any page error fails the run.
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const [target, out, ...rest] = process.argv.slice(2);
const flag = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
const has = (n) => rest.includes(n);
if (!target || !out) {
  console.error('usage: capture.mjs <page.html|url> <out.png> [--dark] [--reduced] [--width 1280] [--hover <sel>] [--click <sel>] [--focus-tab <n>] [--select <sel>]');
  process.exit(2);
}
let url = /^https?:/.test(target) ? target : `file://${resolve(target.split('?')[0])}${target.includes('?') ? `?${target.split('?')[1]}` : ''}`;
if (has('--dark') && !/^https?:/.test(target)) url += `${url.includes('?') ? '&' : '?'}theme=dark`;

const width = Number(flag('--width') ?? 1280);
const height = Number(flag('--height') ?? 900);
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--font-render-hinting=none'] });
const page = await browser.newPage({
  viewport: { width, height },
  deviceScaleFactor: 2,
  colorScheme: has('--dark') ? 'dark' : 'light',
  reducedMotion: has('--reduced') ? 'reduce' : 'no-preference',
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|status of 404/.test(m.text())) errors.push(m.text()); });
const pause = (ms) => page.waitForTimeout(ms);

await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => window.__figReady || !document.querySelector('[data-figure]'), null, { timeout: 15000 }).catch(() => {});
await pause(250);
// Fit the viewport to the page first: an element screenshot taller than the
// viewport resizes it, which moves the page out from under a held hover.
const full = await page.evaluate(() => document.documentElement.scrollHeight);
if (full > height) { await page.setViewportSize({ width, height: full }); await pause(300); }
const el = page.locator(flag('--select') ?? '.shot').first();
await el.scrollIntoViewIfNeeded();
await pause(1800); // let the entrance finish
if (flag('--click')) { await page.click(flag('--click')); await pause(900); }
if (flag('--hover')) {
  const box = await page.locator(flag('--hover')).first().boundingBox();
  if (!box) throw new Error(`no element ${flag('--hover')}`);
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(x - 40, y - 40, { steps: 3 });
  await page.mouse.move(x, y, { steps: 6 });
  await pause(500);
}
if (flag('--focus-tab')) {
  for (let i = 0; i < Number(flag('--focus-tab')); i++) { await page.keyboard.press('Tab'); await pause(60); }
  await page.keyboard.press('ArrowRight');
  await pause(500);
}
await el.screenshot({ path: out });
console.log(`wrote ${out}`);
if (errors.length) console.error(`page errors:\n  ${errors.join('\n  ')}`);
await browser.close();
process.exit(errors.length ? 1 : 0);
