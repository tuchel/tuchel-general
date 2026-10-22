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
  /** The firm's target at its previous reported point, when it had one. */
  prior?: number;
  /** When the target was set: `since`, or earlier for a restated target. */
  set: string;
  /** The date the target is for. */
  horizon: string;
  /** The firm states the horizon; otherwise it is 12 months after `set`. */
  stated: boolean;
  source: Source;
};

const yearAfter = (iso: string) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4)}`;

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
    const prior = f.points[f.points.indexOf(p) - 1]?.target;
    const b = prev ? at(f.points, prev.date) : undefined;
    const set = p.set ?? p.date;
    return [{
      firm: f.firm, rating: f.rating, target: p.target, since: p.date, reported: p.date === v.date, before: b?.target, prior,
      set, horizon: p.horizon ?? yearAfter(set), stated: p.horizon !== undefined, source: p.source,
    }];
  }).sort((a, b) => b.target - a.target);
}

export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** The price on or before a date: a close, or the intraday price on the latest day. */
export const priceOn = (date: string) => PRICES.filter((d) => d.date <= date).at(-1)!;
