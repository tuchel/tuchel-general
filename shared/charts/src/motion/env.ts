/**
 * Motion environment shared by every figure on the page: the reader's
 * reduced-motion preference and a print flag. Printing (and reduced motion)
 * make every tween land on its final frame synchronously, so a figure the
 * reader never scrolled to still prints complete.
 */
import { useSyncExternalStore } from 'react';
import { flushSync } from 'react-dom';

type Snapshot = { reduced: boolean; instant: boolean };
const state: Snapshot = { reduced: false, instant: false };
let snapshot = 'm0';
const listeners = new Set<() => void>();
let installed = false;

function emit(sync: boolean) {
  snapshot = `m${state.reduced ? 1 : 0}${state.instant ? 1 : 0}`;
  const run = () => listeners.forEach((l) => l());
  if (sync) flushSync(run);
  else run();
}

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (reduce) {
    state.reduced = reduce.matches;
    reduce.addEventListener?.('change', (e) => { state.reduced = e.matches; emit(false); });
  }
  const print = (on: boolean) => { state.instant = on; emit(true); };
  window.addEventListener('beforeprint', () => print(true));
  window.addEventListener('afterprint', () => print(false));
  window.matchMedia?.('print').addEventListener?.('change', (e) => print(e.matches));
  snapshot = `m${state.reduced ? 1 : 0}${state.instant ? 1 : 0}`;
}

export function motionState(): Readonly<Snapshot> {
  install();
  return state;
}

export function subscribeMotion(fn: () => void): () => void {
  install();
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** True when motion should be skipped: reduced-motion preference or printing. */
export function useStillMotion(): boolean {
  const snap = useSyncExternalStore(subscribeMotion, () => { install(); return snapshot; }, () => 'm00');
  return snap !== 'm00';
}

/** For tests and headless capture: force the environment. */
export function setMotionForTest(next: Partial<Snapshot>) {
  Object.assign(state, next);
  emit(false);
}

export type Frame = (cb: (now: number) => void) => number;
let raf: Frame = (cb) => (typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame(cb)
  : (setTimeout(() => cb(now()), 16) as unknown as number));
let now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function frame(cb: (t: number) => void) { return raf(cb); }
export function clock() { return now(); }
/** Tests drive time by hand. */
export function setClockForTest(f: Frame, n: () => number) { raf = f; now = n; }
