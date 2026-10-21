/** Targets as of a vintage: each firm's latest reported target on or before that date. */
import { FIRMS, PRICES, VINTAGES, type Source, type VintageId } from './data.ts';

export type TargetAt = {
  firm: string;
  rating: string;
  target: number;
  /** Date of the point in force; earlier than the vintage when carried forward. */
  since: string;
  /** Reported on the vintage date itself, rather than carried from an earlier report. */
  reported: boolean;
  /** The firm's target at the previous vintage, when it had one. */
  before?: number;
  source: Source;
};

export const vintage = (id: VintageId) => VINTAGES.find((v) => v.id === id)!;

function at(points: (typeof FIRMS)[number]['points'], date: string) {
  return points.filter((p) => p.date <= date).at(-1);
}

export function targetsAt(id: VintageId): TargetAt[] {
  const v = vintage(id);
  const i = VINTAGES.findIndex((w) => w.id === id);
  const prev = i > 0 ? VINTAGES[i - 1] : undefined;
  return FIRMS.flatMap((f) => {
    const p = at(f.points, v.date);
    if (!p) return [];
    const b = prev ? at(f.points, prev.date) : undefined;
    return [{ firm: f.firm, rating: f.rating, target: p.target, since: p.date, reported: p.date === v.date, before: b?.target, source: p.source }];
  }).sort((a, b) => b.target - a.target);
}

export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** The price on or before a date: a close, or the intraday price on the latest day. */
export const priceOn = (date: string) => PRICES.filter((d) => d.date <= date).at(-1)!;
