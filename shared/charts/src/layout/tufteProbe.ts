/**
 * Demanding Tufte probe — a chart designed to break every class the skill
 * used to treat as a checkbox.
 *
 * Four synthetic launch families, 2016.15–2026.40. The composition stacks
 * the failure modes that `placeLinearLabels` alone cannot catch:
 *
 *   1. Series end-labels clustered at the right edge (1-D along y).
 *   2. Range-frame ticks whose nice-number 2016 / 2026 sit on the data min/max.
 *   3. Reference-year captions a year apart on a 10-year axis.
 *   4. Dual reading (flights vs implied $/kg) that wants a second baseline.
 *   5. Small multiples that look honest only when they share a y-domain.
 *   6. A scatter of announced-vs-delivered marks whose default +8/−10
 *      callouts occupy the same box.
 *   7. A sequential "years since first flight" ramp that a rainbow would spoil.
 *   8. Type that must sit inside the canvas and carry a paper halo.
 *
 * `layoutTufteProbe('naive')` parks labels the way a careful author parks
 * them without an algorithm — every integrity helper fails.
 * `layoutTufteProbe('placed')` runs the primitives; every helper is empty.
 */

import {
  placeRangeFrameTicks,
  sequentialRampIntegrity,
  sharedScaleIntegrity,
  stackBands,
  type PanelScale,
} from './chartFidelity.ts';
import {
  estimateSansWidth,
  estimateTextWidth,
  laneIntegrity,
  overflowIntegrity,
  placeLinearLabels,
  placePlanarLabels,
  placeSeriesEndLabels,
  planarIntegrity,
  seatsAroundMark,
  textRect,
  type PlacedLabel,
  type PlacedPlanar,
  type Rect,
} from './labelPlacement.ts';

export const PROBE_W = 1120;
export const PROBE_H = 820;

const INK = '#0F1A33';
const SLATE = '#7B879E';
const SIGNAL = '#3E6CC9';
const PHOSPHOR = '#C69523';

export type Family = {
  id: string;
  name: string;
  color: string;
  flights: number[];
  costPerKg: number[];
  firstFlightYear: number;
};

/** Synthetic data for the probe. */
export const FAMILIES: Family[] = [
  {
    id: 'kestrel',
    name: 'Kestrel',
    color: INK,
    firstFlightYear: 2016,
    flights: [9, 18, 29, 41, 56, 72, 91, 112, 131, 146, 154],
    costPerKg: [5400, 4100, 3200, 2600, 2200, 1900, 1700, 1550, 1450, 1380, 1320],
  },
  {
    id: 'osprey',
    name: 'Osprey',
    color: SIGNAL,
    firstFlightYear: 2021,
    flights: [0, 0, 0, 0, 1, 2, 3, 5, 6, 8, 10],
    costPerKg: [0, 0, 0, 0, 8900, 7600, 6800, 6100, 5600, 5200, 4900],
  },
  {
    id: 'condor',
    name: 'Condor',
    color: PHOSPHOR,
    firstFlightYear: 2022,
    flights: [0, 0, 0, 0, 0, 1, 2, 3, 4, 6, 7],
    costPerKg: [0, 0, 0, 0, 0, 9200, 8400, 7800, 7200, 6700, 6300],
  },
  {
    id: 'tern',
    name: 'Tern',
    color: SLATE,
    firstFlightYear: 2010,
    flights: [14, 13, 12, 10, 9, 8, 7, 6, 5, 5, 4],
    costPerKg: [12000, 11800, 11700, 11600, 11500, 11400, 11350, 11300, 11280, 11260, 11240],
  },
];

export const YEARS = [
  2016.15, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026.40,
];

export const YEAR_DOMAIN: [number, number] = [2016.15, 2026.40];
export const FLIGHT_DOMAIN: [number, number] = [0, 154];
export const COST_DOMAIN: [number, number] = [0, 12000];

function cumulativeAt(family: Family, lastIndex: number): number {
  let sum = 0;
  for (let i = 0; i <= lastIndex; i++) sum += family.flights[i];
  return sum;
}

export const COST_X_DOMAIN: [number, number] = [
  1,
  Math.max(...FAMILIES.map((f) => cumulativeAt(f, f.flights.length - 1))),
];

export const REFS = [
  { id: 'landing', year: 2016.4, text: 'first landing 2016.4', priority: 3 },
  { id: 'cadence', year: 2022.0, text: 'cadence inflection', priority: 2 },
  { id: 'asof', year: 2026.15, text: 'as-of 2026.15', priority: 1 },
];

export type ScatterMark = {
  id: string;
  name: string;
  announced: number;
  delivered: number;
  priority: number;
};

export const SCATTER: ScatterMark[] = [
  { id: 'kestrel', name: 'Kestrel', announced: 160, delivered: 154, priority: 4 },
  { id: 'osprey', name: 'Osprey', announced: 18, delivered: 10, priority: 3 },
  { id: 'condor', name: 'Condor', announced: 16, delivered: 7, priority: 3 },
  { id: 'tern', name: 'Tern', announced: 6, delivered: 4, priority: 2 },
  { id: 'kite', name: 'Kite', announced: 14, delivered: 9, priority: 2 },
  { id: 'swift', name: 'Swift', announced: 15, delivered: 8, priority: 2 },
  { id: 'lark', name: 'Lark', announced: 13, delivered: 8, priority: 1 },
  { id: 'auk', name: 'Auk', announced: 12, delivered: 7, priority: 1 },
];

/** Sequential: years since first flight — single-hue ink, light → dark. */
export const YEAR_RAMP = ['#DDE2EC', '#7B879E', '#2C3750', '#0F1A33'];
export const RAINBOW_RAMP = ['#3E6CC9', '#E8B94A', '#B8535A'];

export type ProbeMode = 'naive' | 'placed';

export type ProbeLayout = {
  mode: ProbeMode;
  canvas: Rect;
  main: { x: number; y: number; w: number; h: number };
  xTicks: PlacedLabel[];
  yTicks: PlacedLabel[];
  refCaptions: PlacedLabel[];
  endLabels: PlacedLabel[];
  dualBand: { start: number; end: number };
  multiples: Array<{
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    scale: PanelScale;
  }>;
  scatter: { x: number; y: number; w: number; h: number };
  scatterLabels: PlacedPlanar[];
  ramp: string[];
  integrity: {
    lanes: string[];
    planar: string[];
    overflow: string[];
    scales: string[];
    ramp: string[];
  };
};

const M = { top: 28, right: 124, left: 64, bottom: 54 };

function xYear(year: number, plotX: number, plotW: number): number {
  const [a, b] = YEAR_DOMAIN;
  return plotX + ((year - a) / (b - a)) * plotW;
}

function yFlight(flights: number, plotY: number, plotH: number): number {
  const [a, b] = FLIGHT_DOMAIN;
  return plotY + plotH - ((flights - a) / (b - a)) * plotH;
}

export function layoutTufteProbe(mode: ProbeMode): ProbeLayout {
  const canvas: Rect = { x: 0, y: 0, w: PROBE_W, h: PROBE_H };
  const main = { x: M.left, y: 36, w: PROBE_W - M.left - M.right, h: 268 };

  const below = stackBands(main.y + main.h, 1, [
    { id: 'gap', size: 6 },
    { id: 'xticks', size: 16 },
    { id: 'ref0', size: 13 },
    { id: 'ref1', size: 13 },
    { id: 'caption', size: 18 },
  ]);
  const right = stackBands(main.x + main.w, 1, [
    { id: 'gap', size: 8 },
    { id: 'ends', size: 88 },
    { id: 'dual', size: 18 },
  ]);
  const endBand = right.find((b) => b.id === 'ends')!;
  const dualBand = right.find((b) => b.id === 'dual')!;
  const xtickBand = below.find((b) => b.id === 'xticks')!;
  const ref0 = below.find((b) => b.id === 'ref0')!;

  const niceYears = [2016, 2018, 2020, 2022, 2024, 2026];
  const xTicks = mode === 'placed'
    ? placeRangeFrameTicks({
      domain: YEAR_DOMAIN,
      toPx: (v) => xYear(v, main.x, main.w),
      format: (v) => v.toFixed(v % 1 === 0 ? 0 : 2),
      bounds: [main.x, main.x + main.w],
      candidates: niceYears,
      fontSize: 10,
      face: 'mono',
      minGap: 10,
    })
    : niceYears.map((v): PlacedLabel => ({
      id: `tick-${v}`,
      position: xYear(v, main.x, main.w),
      lane: 0,
      text: String(v),
      hidden: false,
      mergedIds: [`tick-${v}`],
      width: estimateTextWidth(String(v), 10, 'mono'),
      anchor: 'middle',
    })).concat([
      // naive also prints data-extent labels on the same baseline
      {
        id: 'min',
        position: xYear(YEAR_DOMAIN[0], main.x, main.w),
        lane: 0,
        text: YEAR_DOMAIN[0].toFixed(2),
        hidden: false,
        mergedIds: ['min'],
        width: estimateTextWidth(YEAR_DOMAIN[0].toFixed(2), 10, 'mono'),
        anchor: 'start' as const,
      },
      {
        id: 'max',
        position: xYear(YEAR_DOMAIN[1], main.x, main.w),
        lane: 0,
        text: YEAR_DOMAIN[1].toFixed(2),
        hidden: false,
        mergedIds: ['max'],
        width: estimateTextWidth(YEAR_DOMAIN[1].toFixed(2), 10, 'mono'),
        anchor: 'end' as const,
      },
    ]);

  const yTicks = mode === 'placed'
    ? placeRangeFrameTicks({
      domain: FLIGHT_DOMAIN,
      toPx: (v) => yFlight(v, main.y, main.h),
      format: (v) => String(v),
      bounds: [main.y, main.y + main.h],
      candidates: [0, 40, 80, 120, 160],
      fontSize: 10,
      face: 'mono',
      minGap: 8,
      along: 'y',
    })
    : [0, 40, 80, 120, 154].map((v) => ({
      id: `y-${v}`,
      position: yFlight(v, main.y, main.h),
      lane: 0,
      text: String(v),
      hidden: false,
      mergedIds: [`y-${v}`],
      width: estimateTextWidth(String(v), 10, 'mono'),
      anchor: 'middle' as const,
    }));

  const refCaptions = mode === 'placed'
    ? placeLinearLabels(
      REFS.map((r) => ({
        id: r.id,
        position: xYear(r.year, main.x, main.w) + 3,
        text: r.text,
        width: estimateTextWidth(r.text, 8.5, 'mono'),
        priority: r.priority,
        mergeable: true,
        anchor: 'start' as const,
      })),
      { bounds: [main.x, main.x + main.w], maxLanes: 2, minGap: 6, mergeDistance: 14 },
    )
    : REFS.map((r) => ({
      id: r.id,
      position: xYear(r.year, main.x, main.w) + 3,
      lane: 0,
      text: r.text,
      hidden: false,
      mergedIds: [r.id],
      width: estimateTextWidth(r.text, 8.5, 'mono'),
      anchor: 'start' as const,
    }));

  const lastY = FAMILIES.map((f) => ({
    id: f.id,
    y: yFlight(f.flights[f.flights.length - 1], main.y, main.h),
    text: `${f.name} ${f.flights[f.flights.length - 1]}`,
    priority: f.id === 'kestrel' ? 4 : f.id === 'osprey' ? 3 : f.id === 'condor' ? 2 : 1,
    face: 'sans' as const,
    fontSize: 11,
  }));
  const endLabels = mode === 'placed'
    ? placeSeriesEndLabels(lastY, { boundsY: [main.y, main.y + main.h], minGap: 3, maxLanes: 3 })
    : lastY.map((s) => ({
      id: s.id,
      position: s.y,
      lane: 0,
      text: s.text,
      hidden: false,
      mergedIds: [s.id],
      width: estimateSansWidth(s.text, 11),
      anchor: 'middle' as const,
    }));

  const multiY = (below.find((b) => b.id === 'caption')?.end ?? main.y + main.h + 70) + 28;
  const multiH = 168;
  const multiGap = 16;
  const multiW = (PROBE_W - 48 - multiGap * 2) / 3;
  const costFamilies = FAMILIES.filter((f) => f.id !== 'tern');
  const naiveScales = costFamilies.map((f) => {
    const vals = f.costPerKg.filter((v) => v > 0);
    return {
      id: f.id,
      x: [1, Math.max(...[cumulativeAt(f, f.flights.length - 1)])] as [number, number],
      y: [Math.min(...vals) * 0.9, Math.max(...vals) * 1.05] as [number, number],
    };
  });
  const shared: PanelScale = { id: 'shared', x: COST_X_DOMAIN, y: COST_DOMAIN };
  const multiples = costFamilies.map((f, i) => ({
    id: f.id,
    x: 24 + i * (multiW + multiGap),
    y: multiY,
    w: multiW,
    h: multiH,
    scale: mode === 'placed' ? { ...shared, id: f.id } : naiveScales[i],
  }));

  const scatter = {
    x: 24,
    y: multiY + multiH + 46,
    w: 520,
    h: 196,
  };
  const sx = (v: number) => scatter.x + 36 + (v / 180) * (scatter.w - 52);
  const sy = (v: number) => scatter.y + scatter.h - 22 - (v / 180) * (scatter.h - 36);
  const markR = 4;
  const obstacles: Rect[] = SCATTER.map((m) => ({
    x: sx(m.announced) - markR,
    y: sy(m.delivered) - markR,
    w: markR * 2,
    h: markR * 2,
  }));
  const scatterItems = SCATTER.map((m) => {
    const cx = sx(m.announced);
    const cy = sy(m.delivered);
    const w = estimateSansWidth(m.name, 10);
    return {
      id: m.id,
      text: m.name,
      width: w,
      height: 10,
      priority: m.priority,
      seats: seatsAroundMark(cx, cy, markR, 6),
    };
  });
  const scatterLabels = mode === 'placed'
    ? placePlanarLabels(scatterItems, {
      bounds: {
        x: scatter.x,
        y: scatter.y,
        w: scatter.w,
        h: scatter.h,
      },
      obstacles,
      minGap: 3,
    })
    : scatterItems.map((item) => {
      const seat = item.seats[0];
      return {
        id: item.id,
        text: item.text,
        hidden: false,
        seat,
        rect: textRect(seat.x, seat.y, item.width, item.height, seat.anchor),
      };
    });

  const ramp = mode === 'placed' ? YEAR_RAMP : RAINBOW_RAMP;

  const visibleTextRects: Rect[] = [];
  for (const t of xTicks.filter((p) => !p.hidden)) {
    visibleTextRects.push(textRect(t.position, xtickBand.mid + 4, t.width, 10, t.anchor));
  }
  for (const t of refCaptions.filter((p) => !p.hidden)) {
    visibleTextRects.push(textRect(t.position, ref0.mid + 4 + t.lane * 13, t.width, 8.5, t.anchor));
  }
  for (const t of endLabels.filter((p) => !p.hidden)) {
    visibleTextRects.push(textRect(
      endBand.start + 6 + t.lane * 44,
      t.position + 4,
      t.width,
      11,
      'start',
    ));
  }
  for (const p of scatterLabels) {
    if (p.rect) visibleTextRects.push(p.rect);
  }

  const integrity = {
    lanes: [
      ...laneIntegrity(xTicks, 8),
      ...laneIntegrity(refCaptions, 6),
      ...laneIntegrity(endLabels, 3),
    ],
    planar: planarIntegrity(scatterLabels, 3),
    overflow: overflowIntegrity(visibleTextRects, canvas),
    scales: sharedScaleIntegrity(multiples.map((p) => p.scale)),
    ramp: sequentialRampIntegrity(ramp),
  };

  return {
    mode,
    canvas,
    main,
    xTicks,
    yTicks,
    refCaptions,
    endLabels,
    dualBand,
    multiples,
    scatter,
    scatterLabels,
    ramp,
    integrity,
  };
}

export function probeIntegrityErrors(layout: ProbeLayout): string[] {
  return [
    ...layout.integrity.lanes,
    ...layout.integrity.planar,
    ...layout.integrity.overflow,
    ...layout.integrity.scales,
    ...layout.integrity.ramp,
  ];
}
