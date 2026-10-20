/**
 * The portal's lead figure: quarterly revenue as bars spanning each quarter,
 * daily closing price as a line, on one time axis. Both scales start at zero
 * and share gridlines (revenue $4B per line, price $60 per line).
 *
 * One pointer layer covers the plot: over a trading day it lights that day's
 * close and its quarter; before the IPO it lights the quarter alone.
 */
import { useState, type PointerEvent } from 'react';

import {
  AxisX, AxisY, Bars, Dots, Figure, Line, Rules, Segmented, Texts, c, d3, useFigure,
  type Bar, type Dot, type Label, type RenderMode, type Tip,
} from '../../../../shared/charts/src/index.ts';
import { CURSOR_Q3, IPO, PRICES, QUARTERS, type Quarter } from './data.ts';

const DAY = 86_400_000;
const t = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const REV_MAX = 16_000; // $M; 4 intervals of $4B
const PX_MAX = 240; // $; 4 intervals of $60

type View = 'year' | 'all';
const VIEWS: Record<View, { from: string; months: number[] }> = {
  year: { from: '2026-01-01', months: [0, 3, 6, 9].map((m) => Date.UTC(2026, m, 1)) },
  all: { from: '2025-01-01', months: [Date.UTC(2025, 0, 1), Date.UTC(2025, 6, 1), Date.UTC(2026, 0, 1), Date.UTC(2026, 6, 1)] },
};
const END = t('2026-10-31');

const billions = (m: number) => `$${(m / 1000).toFixed(1)}B`;
const usd = (v: number) => `$${v.toFixed(2)}`;
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%`;
const fmtDay = (iso: string) => new Date(t(iso)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const quarterOf = (iso: string): Quarter | undefined => QUARTERS.find((q) => iso >= q.start && iso <= q.end);
const releasedOn = (iso: string) => QUARTERS.find((q) => q.released === iso);

const first = PRICES[0];
const last = PRICES[PRICES.length - 1];
const latest = QUARTERS[QUARTERS.length - 1];
const sinceFirst = last.close / first.close - 1;

// The headline and takeaways state claims; fail the render if the data stops supporting them.
const y26 = QUARTERS.filter((q) => q.start >= '2026');
if (!y26.every((q, i) => i === 0 || q.revenue > y26[i - 1].revenue) || sinceFirst >= 0) {
  throw new Error('RevenuePrice: headline no longer matches the data');
}

function quarterTip(q: Quarter): Tip {
  const rows: Array<[string, string]> = [['Revenue', billions(q.revenue)]];
  if (q.yearAgo) rows.push(['Versus a year earlier', pct(q.revenue / q.yearAgo - 1)]);
  for (const [name, v] of q.segments) rows.push([name, billions(v)]);
  return { title: `${q.label} revenue`, rows, note: q.derived ?? q.source.label };
}

function dayTip(i: number): Tip {
  const d = PRICES[i];
  const rows: Array<[string, string]> = [['Close', usd(d.close)]];
  if (i > 0) rows.push(['On the day', pct(d.close / PRICES[i - 1].close - 1)]);
  rows.push(['Versus IPO price', pct(d.close / IPO.price - 1)]);
  const q = quarterOf(d.date);
  if (q) rows.push([`${q.label} revenue`, billions(q.revenue)]);
  const r = releasedOn(d.date);
  return { title: fmtDay(d.date), rows, note: r ? `${r.label} results released after the close.` : undefined };
}

/** Pointer layer, crosshair, and the active day's marker. */
function Scrub({ x, from, y0, y1, left, right }: { x: (v: number) => number; from: number; y0: number; y1: number; left: number; right: number }) {
  const ctx = useFigure();
  const activeDay = ctx.active?.startsWith('d') ? PRICES[Number(ctx.active.slice(1))] : undefined;
  const pick = (e: PointerEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement!;
    const px = e.clientX - svg.getBoundingClientRect().left;
    const when = from + ((px - x(from)) / (x(END) - x(from))) * (END - from);
    if (when >= t(first.date) - DAY / 2 && when <= t(last.date) + 4 * DAY) {
      const i = PRICES.reduce((best, d, j) => (Math.abs(t(d.date) - when) < Math.abs(t(PRICES[best].date) - when) ? j : best), 0);
      const q = quarterOf(PRICES[i].date);
      ctx.setActive(`d${i}`, q ? [q.id, 'price'] : ['price']);
      return;
    }
    const q = quarterOf(new Date(when).toISOString().slice(0, 10));
    if (q) ctx.setActive(q.id, [q.id]);
    else ctx.setActive(null);
  };
  return (
    <>
      {activeDay && (
        <line x1={x(t(activeDay.date))} x2={x(t(activeDay.date))} y1={y0} y2={y1} stroke={c('slate')} strokeOpacity={0.5} pointerEvents="none" />
      )}
      {ctx.mode === 'live' && (
        <rect x={left} y={y1} width={right - left} height={y0 - y1} fill="transparent" onPointerMove={pick} onPointerLeave={() => ctx.setActive(null)} />
      )}
    </>
  );
}

export function RevenuePrice({ mode, view: initial = 'year' }: { mode?: RenderMode; view?: View }) {
  const [view, setView] = useState<View>(initial);
  const from = t(VIEWS[view].from);
  const shown = QUARTERS.filter((q) => t(q.start) >= from);
  const q0 = shown[0];
  const growth = latest.revenue / q0.revenue;
  const cursorless = latest.revenue - CURSOR_Q3;
  const q4 = QUARTERS.find((q) => q.id === 'q4-25')!;

  return (
    <Figure
      id="revenue-price"
      mode={mode}
      hero
      headline={[
        'Quarterly revenue grew ', { value: growth, format: (v) => `${v.toFixed(1)}×`, from: 1 },
        ` from ${q0.label} to ${latest.label}; the stock closed `, { value: -sinceFirst * 100, format: (v) => `${v.toFixed(0)}%`, from: 0 },
        ' below its first day',
      ]}
      dek="Quarterly revenue (bars, left scale) and daily closing share price (line, right scale). Both scales start at zero."
      takeaways={{
        look: `The ${latest.label} bar against the ${q0.label} bar: ${billions(latest.revenue)} against ${billions(q0.revenue)}.`,
        learn: `Revenue rose every quarter of 2026 while the close went from ${usd(first.close)} on ${fmtDay(first.date)} to ${usd(last.close)}, a ${pct(sinceFirst)} change.`,
        scrutinize: view === 'all'
          ? `${q4.label} revenue of ${billions(q4.revenue)} is derived: full-year 2025 from the Form S-1 less the first nine months.`
          : `${latest.label} includes $${CURSOR_Q3}M from Cursor, acquired Aug 14, 2026; without it, ${latest.label} revenue is ${billions(cursorless)}.`,
      }}
      note={`Prices are daily closes in US dollars; the IPO priced at $${IPO.price} on ${fmtDay(IPO.date)}. Super Intelligence was reported as AI before Q3 2026.`}
      label="Quarterly revenue bars rising through 2026, with the daily closing share price from the June 12, 2026 IPO through October 20 drawn over them."
      controls={<Segmented label="Range" value={view} onChange={setView} options={[{ id: 'year', label: '2026' }, { id: 'all', label: 'Since 2025' }]} />}
      data={{
        columns: ['Quarter', 'Revenue ($M)', 'Year earlier ($M)', 'Last close in quarter ($)'],
        rows: QUARTERS.map((q) => {
          const inQ = PRICES.filter((d) => d.date >= q.start && d.date <= q.end);
          return [q.label, q.revenue.toLocaleString('en-US'), q.yearAgo?.toLocaleString('en-US') ?? '—', inQ.length ? usd(inQ[inQ.length - 1].close) : '—'];
        }),
      }}
      height={(w) => (w < 560 ? 300 : 400)}
    >
      {({ width, height }) => {
        const narrow = width < 560;
        const m = { l: 44, r: 44, t: 30, b: 30 };
        const x = d3.scaleLinear().domain([from, END]).range([m.l, width - m.r]);
        const yR = d3.scaleLinear().domain([0, REV_MAX]).range([height - m.b, m.t]);
        const yP = d3.scaleLinear().domain([0, PX_MAX]).range([height - m.b, m.t]);
        const gap = narrow || view === 'all' ? 2 : 4;

        const bars: Bar[] = shown.map((q) => {
          const x0 = x(t(q.start)) + gap / 2;
          const x1 = x(t(q.end) + DAY) - gap / 2;
          return {
            id: q.id, x: x0, y: yR(q.revenue), w: x1 - x0, h: yR(0) - yR(q.revenue),
            fill: c('series1'), opacity: 0.32, rx: 2,
            label: `${q.label} revenue ${billions(q.revenue)}`, tip: quarterTip(q), keys: [q.id],
          };
        });
        // Values print on every bar of the year view; across two years, on the first and the latest.
        const valued = view === 'year' ? shown : [q0, latest];
        const values: Label[] = valued.map((q) => ({
          id: `v-${q.id}`, x: x((t(q.start) + t(q.end) + DAY) / 2), y: yR(q.revenue) - 10,
          text: billions(q.revenue), value: q.revenue, format: billions,
          anchor: 'middle', size: 12.5, weight: 600, fill: c('series1'), keys: [q.id], halo: c('halo'),
        }));

        const pts = PRICES.map((d) => [x(t(d.date)), yP(d.close)] as const);
        const days: Dot[] = PRICES.map((d, i) => {
          const q = quarterOf(d.date);
          return {
            id: `d${i}`, cx: pts[i][0], cy: pts[i][1], r: 3.5, fill: c('ink'), stroke: c('halo'), strokeWidth: 2, hit: 0,
            label: `${fmtDay(d.date)} close ${usd(d.close)}`, tip: dayTip(i), lights: q ? [q.id, 'price'] : ['price'],
          };
        });
        const [lx] = pts[pts.length - 1];
        // The last-close label sits clear of the line's recent run.
        const ly = Math.min(...pts.slice(-15).map((p) => p[1]));
        const ends: Label[] = [
          { id: 'last', x: lx, y: ly - 12, text: usd(last.close), anchor: 'end', size: 12.5, weight: 600, fill: c('ink'), halo: c('halo') },
          { id: 'ipo', x: lx, y: yP(IPO.price) + 11, text: `IPO $${IPO.price}`, anchor: 'end', size: 11.5, fill: c('slate'), halo: c('halo') },
          // Scale titles, flush with each axis's outer edge.
          { id: 'rev', x: 0, y: m.t - 16, text: 'Revenue', anchor: 'start', size: 11.5, weight: 600, fill: c('series1') },
          { id: 'px', x: width, y: m.t - 16, text: 'Share price', anchor: 'end', size: 11.5, weight: 600, fill: c('ink') },
        ];
        // January carries the year; other ticks name the month.
        const tickLabel = (v: number) => {
          const d = new Date(v);
          return d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
        };

        return (
          <>
            <AxisY scale={yR} ticks={d3.range(0, REV_MAX + 1, 4000)} format={(v) => (v ? `$${v / 1000}B` : '$0')} at={m.l} grid={{ to: width - m.r }} unit="rev" />
            <AxisY scale={yP} ticks={d3.range(0, PX_MAX + 1, 60)} format={(v) => `$${v}`} at={width - m.r} offset={-8} anchor="start" unit="px" />
            <Rules data={[
              { id: 'base', x1: m.l, x2: width - m.r, y1: yR(0), y2: yR(0), stroke: c('slate'), opacity: 0.6 },
              { id: 'ipo', x1: x(t(IPO.date)), x2: lx, y1: yP(IPO.price), y2: yP(IPO.price), stroke: c('slate'), dash: '2 3', opacity: 0.7 },
            ]} />
            <Bars data={bars} grow="up" />
            <Texts data={values} />
            <Line spec={{ id: 'price', points: pts as Array<readonly [number, number]>, stroke: c('ink'), width: narrow ? 1.5 : 1.75, keys: ['price'] }} />
            <Texts data={ends} />
            <AxisX scale={x} ticks={VIEWS[view].months} format={tickLabel} at={height - m.b} unit={view} />
            <Scrub x={x} from={from} y0={height - m.b} y1={m.t} left={m.l} right={width - m.r} />
            <Dots data={days} className="spcx-days" />
          </>
        );
      }}
    </Figure>
  );
}
