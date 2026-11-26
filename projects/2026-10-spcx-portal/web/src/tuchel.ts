/**
 * The Tuchel Indicator: how much credit the market gives SpaceX's results, set against the
 * market's own mood. Both run 0–100; the score is their mean, read on CNN's Fear & Greed bands.
 *
 * Execution credit is the mean of three percentile ranks, each against every trading day
 * since the IPO up to that day (so a past reading never changes when new days arrive):
 *   1. price ÷ the median analyst target in force,
 *   2. SPCX ÷ the Nasdaq-100 (the move that is SpaceX's own),
 *   3. price ÷ the latest reported quarter's revenue (the run-rate sales multiple).
 * Market mood is the CNN Fear & Greed Index as published.
 *
 * The formula is fixed. Do not tune weights, bands, or inputs to past prices.
 */
import { FIRMS, PRICES, QUARTERS } from './data.ts';
import { MARKET, SHARES } from './sentiment.ts';
import { median } from './targets.ts';

/** Trading days of history a percentile needs before the first reading. */
export const WARMUP = 20;
/** Forward window for the track record, trading days. */
export const HORIZON = 20;

export type VerdictId = 'strong-buy' | 'buy' | 'hold' | 'sell' | 'strong-sell';
/** CNN's bands for its index (under 25, under 45, to 55, to 75, above), applied to the score. */
export const BANDS: Array<{ id: VerdictId; label: string; from: number; to: number }> = [
  { id: 'strong-buy', label: 'Strong buy', from: 0, to: 25 },
  { id: 'buy', label: 'Buy', from: 25, to: 45 },
  { id: 'hold', label: 'Hold', from: 45, to: 55 },
  { id: 'sell', label: 'Sell', from: 55, to: 75 },
  { id: 'strong-sell', label: 'Strong sell', from: 75, to: 100 },
];
const band = (v: number) => (v < 25 ? 0 : v < 45 ? 1 : v <= 55 ? 2 : v <= 75 ? 3 : 4);
export const verdict = (score: number) => BANDS[band(score)];
const MOODS = ['extreme fear', 'fear', 'neutral', 'greed', 'extreme greed'];
export const moodName = (mood: number) => MOODS[band(mood)];

/** Share of the values up to and including the last that sit below it, ties counted half, 0–100. */
function rank(xs: number[]): number {
  const v = xs[xs.length - 1];
  let below = 0;
  let equal = 0;
  for (const x of xs) { if (x < v) below++; else if (x === v) equal++; }
  return (100 * (below + equal / 2)) / xs.length;
}

/** The latest quarter whose results were public before a day's close; Q1 2026 was in the S-1. */
function reported(date: string) {
  const out = QUARTERS.filter((q) => q.released && q.released < date).at(-1);
  return out ?? QUARTERS.filter((q) => !q.released).at(-1)!;
}

function targets(date: string) {
  return FIRMS.flatMap((f) => {
    const p = f.points.filter((x) => x.date <= date).at(-1);
    return p ? [p.target] : [];
  });
}

export type Part = { value: number; rank: number };
export type Reading = {
  date: string;
  close: number;
  credit: number;
  mood: number;
  score: number;
  verdict: (typeof BANDS)[number];
  /** Price ÷ median target; SPCX ÷ Nasdaq-100; market value ÷ (latest quarter × 4). */
  target: Part & { median: number; firms: number };
  relative: Part;
  sales: Part & { quarter: string };
  vix: number;
  /** Change in the close over the next HORIZON trading days, once they exist. */
  forward?: number;
};

const market = new Map(MARKET.map((m) => [m.date, m]));
// Only days with every input take part, so a late market row never shifts earlier ranks.
const days = PRICES.filter((p) => !p.intraday && market.has(p.date)).map((p) => {
  const m = market.get(p.date)!;
  const ts = targets(p.date);
  const q = reported(p.date);
  const med = ts.length ? median(ts) : NaN;
  return { ...p, m, med, firms: ts.length, q, toTarget: p.close / med, rel: p.close / m.ndx, perSales: p.close / q.revenue };
}).filter((d) => Number.isFinite(d.toTarget));

export const READINGS: Reading[] = days.flatMap((d, i) => {
  if (i < WARMUP) return [];
  const upTo = days.slice(0, i + 1);
  const target = rank(upTo.map((x) => x.toTarget));
  const relative = rank(upTo.map((x) => x.rel));
  const sales = rank(upTo.map((x) => x.perSales));
  const credit = (target + relative + sales) / 3;
  const score = (credit + d.m.mood) / 2;
  const later = days[i + HORIZON];
  return [{
    date: d.date, close: d.close, credit, mood: d.m.mood, score, verdict: verdict(score),
    target: { value: d.toTarget, rank: target, median: d.med, firms: d.firms },
    relative: { value: d.rel, rank: relative },
    sales: { value: (d.close * SHARES.count) / (d.q.revenue * 4e6), rank: sales, quarter: d.q.label },
    vix: d.m.vix,
    forward: later ? later.close / d.close - 1 : undefined,
  }];
});

export const LATEST = READINGS[READINGS.length - 1];

/** How the close moved over the HORIZON trading days after each reading, by band. */
export const RECORD = BANDS.map((b) => {
  const all = READINGS.filter((r) => r.verdict.id === b.id);
  const done = all.flatMap((r) => (r.forward === undefined ? [] : [r.forward]));
  return {
    ...b, days: all.length, complete: done.length,
    mean: done.length ? done.reduce((a, v) => a + v, 0) / done.length : undefined,
    rose: done.filter((v) => v > 0).length,
  };
});
