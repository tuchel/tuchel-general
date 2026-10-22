/**
 * The portal's lead figure: quarterly revenue as bars spanning each quarter,
 * daily closing price as a line, on one time axis. Both scales start at zero
 * and share gridlines (revenue $4B per line, price $60 per line).
 *
 * One pointer layer covers the plot: over a trading day it lights that day's
 * close and its quarter; before the IPO it lights the quarter alone.
 *
 * With analyst targets on, each target sits at the date it is for, joined to the
 * price on the day it was set, and the time axis runs on to the latest horizon.
 */
import { useState, type PointerEvent } from 'react';

import {
  AxisX, AxisY, Bars, Dots, Figure, Line, Rules, Segmented, Texts, c, d3, useFigure,
  type Bar, type Dot, type Label, type RenderMode, type Tip,
} from '../../../../shared/charts/src/index.ts';
import { CURSOR_Q3, EVENTS, FY26_ESTIMATES, IPO, NINE_MONTHS_2026, PRICES, Q1_27_GUIDE, QUARTERS, VINTAGES, type Quarter, type VintageId } from './data.ts';
import { median, priceOn, targetsAt, vintage, type TargetAt } from './targets.ts';

const DAY = 86_400_000;
const t = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
// Price scale tops, $; 4 intervals each, so price gridlines meet revenue's. With targets
// shown the scale holds every vintage's highest target, so switching vintages never rescales.
const PX_MAX = 240;
const PX_MAX_TARGETS = 600;

// One timeline: the earliest reported quarter (the S-1 gives 2024 only as a year) through the
// Q1 2027 guide. Revenue scale top in $M, 4 intervals.
const FROM = QUARTERS[0].start;
const REV_MAX = 40_000;

/** Quarters ahead of the last report: Q4 2026 from analysts' full-year models, Q1 2027 from guidance. */
const Q4_EST = FY26_ESTIMATES.map((e) => [e.firm, e.revenue - NINE_MONTHS_2026] as const);
const AHEAD = [
  { id: 'q4-26e', label: 'Q4 2026', start: '2026-10-01', end: '2026-12-31', low: Math.min(...Q4_EST.map((e) => e[1])), high: Math.max(...Q4_EST.map((e) => e[1])) },
  { id: 'q1-27g', label: 'Q1 2027', start: '2027-01-01', end: '2027-03-31', low: Q1_27_GUIDE.low, high: Q1_27_GUIDE.high },
].filter((q) => q.id !== 'q4-26e' || Q4_EST.length);
const Q1_27_MID = (Q1_27_GUIDE.low + Q1_27_GUIDE.high) / 2;

const billions = (m: number) => `$${(m / 1000).toFixed(1)}B`;
const usd = (v: number) => `$${v.toFixed(2)}`;
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%`;
const fmtDay = (iso: string) => new Date(t(iso)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const quarterOf = (iso: string): Quarter | undefined => QUARTERS.find((q) => iso >= q.start && iso <= q.end);
const aheadOf = (iso: string) => AHEAD.find((q) => iso >= q.start && iso <= q.end);
const releasedOn = (iso: string) => QUARTERS.find((q) => q.released === iso);

const first = PRICES[0];
const last = PRICES[PRICES.length - 1];
const latest = QUARTERS[QUARTERS.length - 1];
const sinceFirst = last.close / first.close - 1;

const TARGETS = Object.fromEntries(VINTAGES.map((v) => [v.id, targetsAt(v.id)])) as Record<VintageId, TargetAt[]>;
const MEDIANS = VINTAGES.map((v) => ({ ...v, median: median(TARGETS[v.id].map((d) => d.target)) }));
// With targets on, the axis ends a month past the latest horizon of any vintage, so switching vintages never rescales.
const LAST_HORIZON = Object.values(TARGETS).flat().reduce((a, d) => (d.horizon > a ? d.horizon : a), '');
const TARGETS_END = Date.UTC(Number(LAST_HORIZON.slice(0, 4)), Number(LAST_HORIZON.slice(5, 7)), 1);

// The headline and takeaways state claims; fail the render if the data stops supporting them.
const y26 = QUARTERS.filter((q) => q.start >= '2026');
const maxTarget = Math.max(...Object.values(TARGETS).flat().map((d) => d.target));
if (!y26.every((q, i) => i === 0 || q.revenue > y26[i - 1].revenue) || maxTarget > PX_MAX_TARGETS
  || MEDIANS.some((m) => m.median <= priceOn(m.date).close)) {
  throw new Error('RevenuePrice: headline no longer matches the data');
}

const usd0 = (v: number) => `$${Math.round(v)}`;
function targetTip(d: TargetAt, date: string): Tip {
  const px = priceOn(date);
  const rows: Array<[string, string]> = [
    ['Target', usd0(d.target)], ['For', `${fmtDay(d.horizon)}${d.stated ? '' : ', 12 months assumed'}`], ['Rating', d.rating],
    [`Versus price on ${fmtDay(date)}`, pct(d.target / px.close - 1)],
  ];
  if (d.before !== undefined && d.before !== d.target) rows.push(['Previous', usd0(d.before)]);
  const when = d.set !== d.since ? `Set ${fmtDay(d.set)}, restated ${fmtDay(d.since)}` : d.reported ? undefined : `Carried from ${fmtDay(d.since)}`;
  return { title: d.firm, rows, note: when ? `${when}; ${d.source.label}` : d.source.label };
}

function quarterTip(q: Quarter): Tip {
  const rows: Array<[string, string]> = [['Revenue', billions(q.revenue)]];
  if (q.yearAgo) rows.push(['Versus a year earlier', pct(q.revenue / q.yearAgo - 1)]);
  for (const [name, v] of q.segments) rows.push([name, billions(v)]);
  return { title: `${q.label} revenue`, rows, note: q.derived ?? q.source.label };
}

function aheadTip(id: string): Tip {
  if (id === 'q4-26e') {
    return {
      title: 'Q4 2026 revenue, estimates',
      rows: Q4_EST.map(([firm, v]) => [firm, billions(v)] as [string, string]),
      note: 'Each firm\'s full-year 2026 estimate less the nine months reported.',
    };
  }
  return {
    title: 'Q1 2027 revenue, guidance',
    rows: [['Low', billions(Q1_27_GUIDE.low)], ['Midpoint', billions(Q1_27_MID)], ['High', billions(Q1_27_GUIDE.high)], ['Versus Q3 2026 at midpoint', `${(Q1_27_MID / latest.revenue).toFixed(1)}×`]],
    note: 'The CFO on the Oct 20, 2026 earnings call.',
  };
}

function dayTip(i: number): Tip {
  const d = PRICES[i];
  const rows: Array<[string, string]> = [['Close', usd(d.close)]];
  if (i > 0) rows.push(['On the day', pct(d.close / PRICES[i - 1].close - 1)]);
  rows.push(['Versus IPO price', pct(d.close / IPO.price - 1)]);
  if (d.intraday) rows[0] = ['Price', `${usd(d.close)} at ${d.intraday}`];
  const q = quarterOf(d.date);
  if (q) rows.push([`${q.label} revenue`, billions(q.revenue)]);
  const r = releasedOn(d.date);
  return { title: fmtDay(d.date), rows, note: r ? `${r.label} results released after the close.` : undefined };
}

/** Pointer layer, crosshair, and the active day's marker. */
function Scrub({ x, from, end, y0, y1, left, right }: { x: (v: number) => number; from: number; end: number; y0: number; y1: number; left: number; right: number }) {
  const ctx = useFigure();
  const activeDay = ctx.active?.startsWith('d') ? PRICES[Number(ctx.active.slice(1))] : undefined;
  const pick = (e: PointerEvent<SVGRectElement>) => {
    const svg = e.currentTarget.ownerSVGElement!;
    const px = e.clientX - svg.getBoundingClientRect().left;
    const when = from + ((px - x(from)) / (x(end) - x(from))) * (end - from);
    if (when >= t(first.date) - DAY / 2 && when <= t(last.date) + 4 * DAY) {
      const i = PRICES.reduce((best, d, j) => (Math.abs(t(d.date) - when) < Math.abs(t(PRICES[best].date) - when) ? j : best), 0);
      const q = quarterOf(PRICES[i].date);
      ctx.setActive(`d${i}`, q ? [q.id, 'price'] : ['price']);
      return;
    }
    const iso = new Date(when).toISOString().slice(0, 10);
    const q = quarterOf(iso) ?? aheadOf(iso);
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

/** Hairlines from each event marker down to the baseline; the hovered one darkens. */
function EventLines({ data, y0 }: { data: Array<{ id: string; x: number; y: number }>; y0: number }) {
  const ctx = useFigure();
  return (
    <g pointerEvents="none">
      {data.map((d) => (
        <line key={d.id} x1={d.x} x2={d.x} y1={d.y + 5} y2={y0} stroke={c('slate')} strokeWidth={1} strokeDasharray="2 3"
          opacity={ctx.active === d.id ? 0.8 : 0.22} className="fig-fade" />
      ))}
    </g>
  );
}

/** Thin lines from the price on the day each target was set to the target; the hovered one darkens. */
function Connectors({ data }: { data: Array<{ id: string; x1: number; y1: number; x2: number; y2: number }> }) {
  const ctx = useFigure();
  return (
    <g pointerEvents="none">
      {data.map((d) => (
        <line key={d.id} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke={c('series2')} strokeWidth={1}
          opacity={ctx.active === d.id ? 0.9 : ctx.active?.startsWith('t-') ? 0.08 : 0.22} className="fig-fade" />
      ))}
    </g>
  );
}

export function RevenuePrice({ mode, targets: initialTargets = null, events: initialEvents = false }: { mode?: RenderMode; targets?: VintageId | null; events?: boolean }) {
  const [show, setShow] = useState(initialTargets !== null);
  const [events, setEvents] = useState(initialEvents);
  const [vid, setVid] = useState<VintageId>(initialTargets ?? 'oct21');
  const vin = vintage(vid);
  const tv = TARGETS[vid];
  const med = MEDIANS.find((m) => m.id === vid)!.median;
  const pxThen = priceOn(vin.date).close;
  const carried = tv.filter((d) => !d.reported).length;
  const stated = tv.filter((d) => d.stated);
  const raised = TARGETS.oct21.filter((d) => d.reported && d.before !== undefined && d.target > d.before).length;
  const pxMax = show ? PX_MAX_TARGETS : PX_MAX;
  const from = t(FROM);
  const end = show ? TARGETS_END : t(AHEAD[AHEAD.length - 1].end) + DAY;
  // Company guidance always shows; the analysts' Q4 2026 model only with estimates on.
  const ahead = AHEAD.filter((q) => show || q.id !== 'q4-26e');
  const shown = QUARTERS;
  const q0 = shown[0];
  const growth = latest.revenue / q0.revenue;
  const derived = QUARTERS.filter((q) => q.derived).map((q) => q.label.replace(' 2025', '')).join(' and ');

  return (
    <Figure
      id="revenue-price"
      mode={mode}
      hero
      headline={show ? [
        'Median analyst target ', { value: med, format: usd0, from: MEDIANS[0].median },
        ` on ${vin.label}, `, { value: (med / pxThen - 1) * 100, format: (v) => `${v.toFixed(0)}%`, from: 0 },
        ' above the share price that day',
      ] : [
        'Quarterly revenue grew ', { value: growth, format: (v) => `${v.toFixed(1)}×`, from: 1 },
        ` from ${q0.label} to ${latest.label}, and Q1 2027 guidance is `, { value: Q1_27_MID / latest.revenue, format: (v) => `${v.toFixed(1)}×`, from: 1 },
        ` ${latest.label} at its midpoint`,
      ]}
      takeaways={show ? {
        look: `The targets out to the right against the end of the price line: a ${usd0(med)} median against ${usd(pxThen)} on ${vin.label}.`,
        learn: `The median target went from ${usd0(MEDIANS[0].median)} at initiation to ${usd0(MEDIANS[MEDIANS.length - 1].median)} after Q3, when ${raised} of ${TARGETS.oct21.filter((d) => d.reported).length} reporting firms raised.`,
        scrutinize: stated.length
          ? `Only ${stated.length} target states its date (${fmtDay(stated[0].horizon)}); the rest sit 12 months after they were set, and ${carried} hollow dots may be stale.`
          : `No firm here states a horizon, so each target sits 12 months after it was set; ${carried} of ${tv.length} are hollow, carried from an earlier report.`,
      } : {
        look: `The Q1 2027 band against the ${latest.label} bar: ${billions(Q1_27_GUIDE.low)}–${billions(Q1_27_GUIDE.high)} guided against ${billions(latest.revenue)} reported.`,
        learn: `Revenue rose every quarter of 2026 while the stock went from a ${usd(first.close)} first close to ${usd(last.close)}, a ${pct(sinceFirst)} change.`,
        scrutinize: `${derived} 2025 are derived from filed totals, ${latest.label} includes $${CURSOR_Q3}M from Cursor, and the Q1 2027 range comes from the earnings call.`,
      }}
      note={show
        ? 'Targets sit at the date they are for: 12 months after being set unless the firm states one. Hollow dots are carried from an earlier report.'
        : 'Q4 2026 is not yet reported. Super Intelligence was reported as AI before Q3 2026.'}
      label={`Quarterly revenue bars from ${q0.label} rising through 2026 to the Q1 2027 guidance range, with the daily share price from the June 12, 2026 IPO through ${fmtDay(last.date)} drawn over them${show ? `, and analysts' price targets as of ${vin.label}` : ''}.`}
      controls={(
        <>
          <button type="button" className="spcx-toggle" aria-pressed={show} onClick={() => setShow(!show)}>Analyst estimates</button>
          <button type="button" className="spcx-toggle spcx-toggle--events" aria-pressed={events} onClick={() => setEvents(!events)}>Key events</button>
          {show && <Segmented label="Targets as of" value={vid} onChange={setVid} options={VINTAGES.map((v) => ({ id: v.id, label: v.label }))} />}
        </>
      )}
      data={show ? {
        caption: `Price targets as of ${fmtDay(vin.date)}, ${vin.name.toLowerCase()}`,
        columns: ['Firm', 'Rating', 'Target ($)', 'Set', 'For'],
        rows: tv.map((d) => [d.firm, d.rating, d.target, fmtDay(d.set), `${fmtDay(d.horizon)}${d.stated ? '' : ' (assumed)'}`]),
      } : {
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
        const x = d3.scaleLinear().domain([from, end]).range([m.l, width - m.r]);
        const yR = d3.scaleLinear().domain([0, REV_MAX]).range([height - m.b, m.t]);
        const yP = d3.scaleLinear().domain([0, pxMax]).range([height - m.b, m.t]);
        const gap = narrow ? 2 : 3;

        const bars: Bar[] = shown.map((q) => {
          const x0 = x(t(q.start)) + gap / 2;
          const x1 = x(t(q.end) + DAY) - gap / 2;
          return {
            id: q.id, x: x0, y: yR(q.revenue), w: x1 - x0, h: yR(0) - yR(q.revenue),
            fill: c('series1'), opacity: 0.32, rx: 2,
            label: `${q.label} revenue ${billions(q.revenue)}`, tip: quarterTip(q), keys: [q.id],
          };
        });
        // Quarters ahead: a pale column to the low end, a stronger band across the range.
        const aheadBars: Bar[] = ahead.flatMap((q) => {
          const x0 = x(t(q.start)) + gap / 2;
          const w = x(t(q.end) + DAY) - gap / 2 - x0;
          const tip = aheadTip(q.id);
          return [
            { id: q.id, x: x0, y: yR(q.low), w, h: yR(0) - yR(q.low), fill: c('series1'), opacity: 0.12, rx: 2, label: `${q.label} revenue ${billions(q.low)} to ${billions(q.high)}`, tip, keys: [q.id] },
            { id: `${q.id}-band`, x: x0, y: yR(q.high), w, h: Math.max(2, yR(q.low) - yR(q.high)), fill: c('series1'), opacity: 0.45, rx: 1, keys: [q.id] },
          ];
        });
        const range = (lo: number, hi: number) => (Math.round(lo / 100) === Math.round(hi / 100) ? billions(lo) : `$${(lo / 1000).toFixed(narrow ? 0 : 1)}–${(hi / 1000).toFixed(narrow ? 0 : 1)}B`);
        const aheadValues: Label[] = ahead.map((q) => ({
          id: `v-${q.id}`, x: x((t(q.start) + t(q.end) + DAY) / 2), y: yR(q.high) - 10,
          text: q.id === 'q4-26e' && narrow ? `≈$${Math.round(q.high / 1000)}B` : range(q.low, q.high),
          anchor: 'middle', size: 12.5, weight: 600, fill: c('series1'), keys: [q.id], halo: c('halo'),
        }));

        // Values print on every bar where there is room; on a phone, on the first and the latest.
        const valued = narrow ? [q0, latest] : shown;
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
        // The latest-price label sits clear of the line's recent run: above it, or below it when targets fill the space above.
        const run = pts.slice(-15).map((p) => p[1]);
        const ly = show ? Math.max(...run) + 13 : Math.min(...run) - 12;

        // Targets: each at its horizon date; equal targets on the same date fan out sideways.
        const cx = x(t(vin.date));
        const seen = new Map<string, number>();
        const placed = show ? tv.map((d) => {
          const key = `${d.target}|${d.horizon}`;
          const k = seen.get(key) ?? 0;
          seen.set(key, k + 1);
          const dx = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 7;
          return { d, x: x(t(d.horizon)) + dx, y: yP(d.target) };
        }) : [];
        const targetDots: Dot[] = placed.map(({ d, x: tx, y: ty }) => ({
          id: `t-${d.firm}`, cx: tx, cy: ty, r: 4,
          fill: d.reported ? c('series2') : c('halo'), stroke: c('series2'), strokeWidth: 1.5, hit: 8,
          label: `${d.firm} target ${usd0(d.target)} for ${fmtDay(d.horizon)}`, tip: targetTip(d, vin.date),
        }));
        const connectors = placed.map(({ d, x: tx, y: ty }) => ({ id: `t-${d.firm}`, x1: x(t(d.set)), y1: yP(priceOn(d.set).close), x2: tx, y2: ty }));
        // Key events: small diamonds along the top of the plot; one that would crowd its neighbour steps down a row.
        const eventMarks = events ? EVENTS.reduce<Array<{ e: (typeof EVENTS)[number]; id: string; x: number; y: number }>>((acc, e, i) => {
          const ex = x(t(e.date));
          const prev = acc[acc.length - 1];
          const y = prev && ex - prev.x < 10 ? prev.y + 11 : m.t + 4;
          return [...acc, { e, id: `e${i}`, x: ex, y }];
        }, []) : [];
        const eventDots: Dot[] = eventMarks.map(({ e, id, x: ex, y }) => ({
          id, cx: ex, cy: y, r: 4.5, shape: 'diamond', fill: c('ink'), stroke: c('halo'), strokeWidth: 1.5, hit: 9,
          label: `${fmtDay(e.date)}: ${e.title}`, tip: { title: e.title, rows: [['Date', fmtDay(e.date)]], note: `${e.detail} ${e.source.label}` },
        }));
        const ends: Label[] = [
          { id: 'last', x: lx, y: ly, text: usd(last.close), anchor: 'end', size: 12.5, weight: 600, fill: c('ink'), halo: c('halo'), opacity: show && narrow ? 0 : 1 },
          // On a phone the outlook compresses the price run; the rule and the note carry the IPO price there.
          { id: 'ipo', x: lx, y: yP(IPO.price) + 11, text: `IPO $${IPO.price}`, anchor: 'end', size: 11.5, fill: c('slate'), halo: c('halo'), opacity: show || narrow ? 0 : 1 },
          // Scale titles, flush with each axis's outer edge.
          { id: 'rev', x: 0, y: m.t - 16, text: 'Revenue', anchor: 'start', size: 11.5, weight: 600, fill: c('series1') },
          { id: 'px', x: width, y: m.t - 16, text: show ? 'Price and targets' : 'Share price', anchor: 'end', size: 11.5, weight: 600, fill: c('ink') },
        ];
        // The median rule runs to the price scale and is tagged there, clear of the dots.
        if (show) ends.push({ id: 'median', x: width - m.r + 8, y: yP(med), baseline: 'middle', text: usd0(med), value: med, format: usd0, anchor: 'start', size: 11.5, weight: 600, fill: c('series2'), halo: c('halo') });
        // Ticks run every January, and every July when there is room.
        const ticks = d3.range(Number(FROM.slice(0, 4)), new Date(end).getUTCFullYear() + 1)
          .flatMap((yr) => (narrow ? [Date.UTC(yr, 0, 1)] : [Date.UTC(yr, 0, 1), Date.UTC(yr, 6, 1)]))
          .filter((v) => v >= from && v <= end);
        // January carries the year; other ticks name the month.
        const tickLabel = (v: number) => {
          const d = new Date(v);
          return d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
        };

        return (
          <>
            <AxisY scale={yR} ticks={d3.range(0, REV_MAX + 1, REV_MAX / 4)} format={(v) => (v ? `$${v / 1000}B` : '$0')} at={m.l} grid={{ to: width - m.r }} unit="rev" />
            <AxisY scale={yP} ticks={d3.range(0, pxMax + 1, pxMax / 4)} format={(v) => `$${v}`} at={width - m.r} offset={-8} anchor="start" unit="px" />
            <Rules data={[
              { id: 'base', x1: m.l, x2: width - m.r, y1: yR(0), y2: yR(0), stroke: c('slate'), opacity: 0.6 },
              { id: 'ipo', x1: x(t(IPO.date)), x2: lx, y1: yP(IPO.price), y2: yP(IPO.price), stroke: c('slate'), dash: '2 3', opacity: 0.7 },
            ]} />
            <Bars data={[...bars, ...aheadBars]} grow="up" />
            <Texts data={[...values, ...aheadValues]} />
            <Line spec={{ id: 'price', points: pts as Array<readonly [number, number]>, stroke: c('ink'), width: narrow ? 1.5 : 1.75, keys: ['price'] }} />
            <Texts data={ends} />
            <AxisX scale={x} ticks={ticks} format={tickLabel} at={height - m.b} unit={show ? 'targets' : 'base'} />
            <Scrub x={x} from={from} end={end} y0={height - m.b} y1={m.t} left={m.l} right={width - m.r} />
            <Dots data={days} className="spcx-days" />
            {events && (
              <>
                <EventLines data={eventMarks} y0={height - m.b} />
                <Dots data={eventDots} className="spcx-events" />
              </>
            )}
            {show && (
              <>
                <Connectors data={connectors} />
                <Rules data={[{ id: 'median', x1: cx, x2: width - m.r, y1: yP(med), y2: yP(med), stroke: c('series2'), width: 1.25, dash: '3 3' }]} />
                <Dots data={targetDots} className="spcx-targets" />
              </>
            )}
          </>
        );
      }}
    </Figure>
  );
}
