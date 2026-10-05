/**
 * Keyed tweens: the one engine behind bars, dots, labels, ticks, line morphs,
 * and number tickers. Items are plain objects; numbers (and arrays and
 * objects of numbers) interpolate, everything else takes its target value at
 * once, so a color token is never half a string.
 *
 * The first render returns the targets untouched; motion only ever starts
 * from a later change.
 */
import { useLayoutEffect, useEffect, useReducer, useRef } from 'react';

import { clock, frame } from './env.ts';
import type { Ease } from './ease.ts';

export type Phase = 'enter' | 'update' | 'exit';
export type Timing = { duration: number; ease: Ease; delay: number };
export type Interp<T> = (a: T, b: T) => (t: number) => T;

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Numbers lerp; arrays and plain objects recurse; anything else jumps to `b`. */
export function interpolateValue<T>(a: T, b: T): (t: number) => T {
  if (typeof a === 'number' && typeof b === 'number') {
    return ((t: number) => lerp(a, b, t)) as unknown as (t: number) => T;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    const fns = b.map((bv, i) => interpolateValue(i < a.length ? a[i] : bv, bv));
    return ((t: number) => fns.map((f) => f(t))) as unknown as (t: number) => T;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = Object.keys(b as object);
    const fns = keys.map((k) => [k, interpolateValue((a as Record<string, unknown>)[k] ?? (b as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])] as const);
    return ((t: number) => {
      const o: Record<string, unknown> = {};
      for (const [k, f] of fns) o[k] = f(t);
      return o;
    }) as unknown as (t: number) => T;
  }
  return () => b;
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => same(v, b[i]));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    return ka.length === kb.length && ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

type Entry<T> = {
  key: string;
  value: T;
  target: T;
  interp: (t: number) => T;
  start: number;
  timing: Timing;
  phase: Phase;
  running: boolean;
};

export type KeyedOptions<T> = {
  key: (d: T, i: number) => string;
  timing: (phase: Phase, d: T, i: number) => Timing;
  enter?: (d: T) => T;
  exit?: (d: T) => T;
  interpolate?: Interp<T>;
};

/** Framework-free core, exported for tests. */
export class KeyedTween<T> {
  entries = new Map<string, Entry<T>>();
  order: string[] = [];

  private opts: KeyedOptions<T>;

  constructor(items: readonly T[], opts: KeyedOptions<T>) {
    this.opts = opts;
    items.forEach((d, i) => {
      const key = opts.key(d, i);
      this.entries.set(key, { key, value: d, target: d, interp: () => d, start: 0, timing: { duration: 0, ease: (t) => t, delay: 0 }, phase: 'update', running: false });
      this.order.push(key);
    });
  }

  setOptions(opts: KeyedOptions<T>) { this.opts = opts; }

  /** `changed`: some entry got a new target; `moving`: something must animate. */
  reconcile(items: readonly T[], now: number): { changed: boolean; moving: boolean } {
    const { key, timing, enter, exit } = this.opts;
    const interp = this.opts.interpolate ?? interpolateValue;
    const live = new Set<string>();
    const nextOrder: string[] = [];
    let any = false;
    let changed = false;
    const begin = (e: Entry<T>, to: T, phase: Phase, t: Timing) => {
      e.interp = interp(e.value, to);
      e.target = to;
      e.phase = phase;
      e.timing = t;
      e.start = now;
      e.running = t.duration > 0 || t.delay > 0;
      if (!e.running) e.value = to;
      any = any || e.running;
      changed = true;
    };
    items.forEach((d, i) => {
      const k = key(d, i);
      live.add(k);
      nextOrder.push(k);
      const e = this.entries.get(k);
      if (e) {
        if (!same(e.target, d) || e.phase === 'exit') begin(e, d, 'update', timing('update', d, i));
      } else {
        const from = enter ? enter(d) : d;
        const ne: Entry<T> = { key: k, value: from, target: from, interp: () => from, start: now, timing: timing('enter', d, i), phase: 'enter', running: false };
        this.entries.set(k, ne);
        begin(ne, d, 'enter', timing('enter', d, i));
      }
    });
    for (const [k, e] of this.entries) {
      if (live.has(k) || e.phase === 'exit') continue;
      const t = timing('exit', e.target, 0);
      if (t.duration <= 0 && t.delay <= 0) { this.entries.delete(k); changed = true; continue; }
      begin(e, exit ? exit(e.target) : e.target, 'exit', t);
    }
    const exiting = this.order.filter((k) => !live.has(k) && this.entries.has(k));
    const nextFull = [...nextOrder, ...exiting];
    if (nextFull.join('\u0000') !== this.order.join('\u0000')) changed = true;
    this.order = nextFull;
    return { changed, moving: any };
  }

  /** Advance to `now`; returns true while anything is still moving. */
  step(now: number): boolean {
    let running = false;
    for (const [k, e] of this.entries) {
      if (!e.running) continue;
      const { duration, delay, ease } = e.timing;
      const p = duration <= 0 ? (now - e.start >= delay ? 1 : 0) : Math.min(1, Math.max(0, (now - e.start - delay) / duration));
      e.value = e.interp(ease(p));
      if (p >= 1) {
        e.running = false;
        e.value = e.target;
        if (e.phase === 'exit') this.entries.delete(k);
      } else {
        running = true;
      }
    }
    this.order = this.order.filter((k) => this.entries.has(k));
    return running;
  }

  finish() {
    for (const [k, e] of this.entries) {
      e.value = e.target;
      e.running = false;
      if (e.phase === 'exit') this.entries.delete(k);
    }
    this.order = this.order.filter((k) => this.entries.has(k));
  }

  values(): Array<{ key: string; value: T; phase: Phase }> {
    return this.order.map((k) => {
      const e = this.entries.get(k)!;
      return { key: k, value: e.value, phase: e.phase };
    });
  }
}

export function useKeyedTween<T>(items: readonly T[], opts: KeyedOptions<T> & { still?: boolean }) {
  const ref = useRef<KeyedTween<T> | null>(null);
  if (!ref.current) ref.current = new KeyedTween(items, opts);
  const tw = ref.current;
  tw.setOptions(opts);
  const [, render] = useReducer((n: number) => n + 1, 0);
  const handle = useRef(0);
  const first = useRef(true);

  useIsoLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    const { changed, moving } = tw.reconcile(items, clock());
    if (!changed) return;
    if (opts.still) tw.finish();
    render();
    if (!moving || opts.still) return;
    const id = ++handle.current;
    const tick = (t: number) => {
      if (id !== handle.current) return;
      const more = tw.step(t);
      render();
      if (more) frame(tick);
    };
    frame(tick);
  });

  useEffect(() => () => { handle.current++; }, []);

  if (opts.still) tw.finish();
  return tw.values();
}

/** One value, same engine: a number ticker, a line's points, a clip width. */
export function useTween<T>(value: T, timing: (phase: Phase) => Timing, o: { from?: T; still?: boolean; interpolate?: Interp<T> } = {}): T {
  const [v] = useKeyedTween([value], {
    key: () => 'v',
    timing: (p) => timing(p),
    enter: o.from === undefined ? undefined : () => o.from as T,
    interpolate: o.interpolate,
    still: o.still,
  });
  return v ? v.value : value;
}

/** Resample a polyline to `n` points so two lines of different lengths morph. */
export function resample(points: ReadonlyArray<readonly [number, number]>, n: number): Array<[number, number]> {
  if (points.length === 0) return [];
  if (points.length === 1 || n <= 1) return Array.from({ length: Math.max(1, n) }, () => [points[0][0], points[0][1]]);
  const seg: number[] = [0];
  for (let i = 1; i < points.length; i++) seg.push(seg[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const total = seg[seg.length - 1] || 1;
  const out: Array<[number, number]> = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const d = (k / (n - 1)) * total;
    while (j < seg.length - 1 && seg[j] < d) j++;
    const span = seg[j] - seg[j - 1] || 1;
    const t = Math.min(1, Math.max(0, (d - seg[j - 1]) / span));
    out.push([lerp(points[j - 1][0], points[j][0], t), lerp(points[j - 1][1], points[j][1], t)]);
  }
  return out;
}
