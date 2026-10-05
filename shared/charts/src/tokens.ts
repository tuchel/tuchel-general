/**
 * Chart color, motion, and type tokens. Colors paint through `c(name)`, which
 * emits `var(--token, light-hex)`, so each app maps the roles onto its own
 * palette in CSS and a dark theme swaps them in one place. The CSS side of
 * every token lives in `charts.css`; `test/kit.test.ts` keeps the two in step.
 *
 * Defaults are the dataviz reference palette. Categorical slots 1–5 pass the
 * colorblind checks in this order for adjacent marks (bars, stacks, lines);
 * only slots 1–3 pass for every pair (scatter, maps). An app that overrides
 * them re-runs the validator against its own ground.
 */
export const COLOR = {
  paper: ['--chart-ground', '#FCFCFB', '#1A1A19'], // page ground behind the plot
  surface: ['--chart-surface', '#FFFFFF', '#242422'], // tooltip and card background
  halo: ['--chart-halo', '#FCFCFB', '#1A1A19'], // = ground; stroke behind type that crosses lines
  ink: ['--chart-ink', '#0B0B0B', '#FFFFFF'], // one-series default, labels
  ink2: ['--chart-ink-2', '#52514E', '#C3C2B7'], // secondary labels
  slate: ['--chart-slate', '#898781', '#898781'], // axes, ticks, notes
  hair: ['--chart-hair', '#E1E0D9', '#2C2C2A'], // gridlines
  band: ['--chart-hair-2', '#F0EFEC', '#383835'], // alternating bands, hover tint
  signal: ['--chart-signal', '#2A78D6', '#3987E5'], // the one accent for the argument
  fail: ['--chart-fail', '#D03B3B', '#D03B3B'], // a stated price or threshold under test
  warn: ['--chart-warn', '#FAB219', '#FAB219'],
  // Categorical slots, at most five families, drawn in this order.
  series1: ['--chart-series-1', '#2A78D6', '#3987E5'],
  series1b: ['--chart-series-1b', '#86B6EF', '#256ABF'], // lighter shades of slot 1, to split one category
  series1c: ['--chart-series-1c', '#CDE2FB', '#184F95'],
  series2: ['--chart-series-2', '#EB6834', '#D95926'],
  series3: ['--chart-series-3', '#1BAF7A', '#199E70'],
  series4: ['--chart-series-4', '#EDA100', '#C98500'],
  series5: ['--chart-series-5', '#E87BA4', '#D55181'],
  other: ['--chart-other', '#C3C2B7', '#52514E'], // "everything else"
  onDark: ['--chart-on-dark', '#FFFFFF', '#1A1A19'], // text on filled marks
  onLight: ['--chart-on-light', '#0B0B0B', '#0B0B0B'],
  onMuted: ['--chart-on-muted', '#0B0B0B', '#FFFFFF'],
} as const;

export type ColorName = keyof typeof COLOR;

export function c(name: ColorName): string {
  const [v, light] = COLOR[name];
  return `var(${v}, ${light})`;
}

/**
 * Motion scale. Durations in ms; `prefers-reduced-motion: reduce` sets every
 * one to 0. Easing curves never overshoot (every control point sits in
 * [0, 1]), so nothing bounces.
 */
export const MOTION = {
  duration: {
    instant: 0,
    fast: 140, // hover and focus emphasis, pressed states
    base: 240, // small state changes: a toggle, a tooltip, a label
    slow: 420, // scenario changes: bars, lines, axes, labels, path morphs
    reveal: 640, // one-time entrance of a figure
    crossfade: 320, // swapping one view for another
  },
  stagger: { step: 36, max: 360 },
  ease: {
    standard: [0.2, 0, 0, 1],
    enter: [0, 0, 0, 1],
    exit: [0.3, 0, 1, 1],
    linear: [0, 0, 1, 1],
  },
  dim: 0.26,
} as const;

export type EaseName = keyof typeof MOTION.ease;
export type DurationName = keyof typeof MOTION.duration;

/**
 * Type sizes inside the plot, in px at 1:1 render. Nothing below 11. The face
 * is the app's chart face (`setChartFace`); headline, dek, and takeaways are
 * HTML set by the app's CSS.
 */
export const TYPE = {
  label: { size: 12.5, weight: 400 },
  strong: { size: 12.5, weight: 600 },
  tick: { size: 12, weight: 400 },
  small: { size: 11.5, weight: 500 },
  note: { size: 12, weight: 400 },
  min: 11,
};
