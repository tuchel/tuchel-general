/**
 * Chart-fidelity helpers that sit next to `placeLinearLabels`.
 *
 * 1-D captions were the first class. The Tufte skill still treated ticks,
 * small-multiple scales, sequential color, and reserved dual-axis bands as
 * checkboxes. These functions make those classes mechanical.
 */

import {
  estimateTextWidth,
  laneIntegrity,
  placeLinearLabels,
  type PlacedLabel,
  type TextFace,
} from './labelPlacement.ts';

/** Ground-colored halo so a grid or a line cannot strike through a digit. */
export const TYPE_HALO = {
  stroke: 'var(--chart-halo, #FCFCFB)',
  strokeWidth: 3,
  paintOrder: 'stroke',
} as const;

export type RangeFrameOpts = {
  domain: [number, number];
  toPx: (value: number) => number;
  format: (value: number) => string;
  bounds: [number, number];
  candidates?: number[];
  fontSize?: number;
  face?: TextFace;
  minGap?: number;
  /**
   * Axis the ticks sit on. Horizontal (default): collision uses text width.
   * Vertical: collision uses `fontSize` — the ink along y — not the
   * string's horizontal width. Mixing those two is how a y-axis "proves"
   * a collision that is not on the page.
   */
  along?: 'x' | 'y';
};

/**
 * Range-frame ticks: ink only across the data extent; min and max labels
 * sit on the data; a nice-number candidate whose box collides with min,
 * max, or a neighbor is omitted. One lane — ticks cannot stagger.
 */
export function placeRangeFrameTicks(opts: RangeFrameOpts): PlacedLabel[] {
  const fontSize = opts.fontSize ?? 10;
  const face = opts.face ?? 'mono';
  const minGap = opts.minGap ?? 8;
  const along = opts.along ?? 'x';
  const [d0, d1] = opts.domain[0] <= opts.domain[1]
    ? opts.domain
    : [opts.domain[1], opts.domain[0]];
  const span = d1 - d0;
  const near = span === 0 ? 0 : span * 0.02;

  const alongWidth = (text: string) => (
    along === 'y' ? fontSize : estimateTextWidth(text, fontSize, face)
  );
  const extentAnchor = along === 'y' ? 'middle' as const : undefined;

  const items = [
    {
      id: 'min',
      position: opts.toPx(d0),
      text: opts.format(d0),
      width: alongWidth(opts.format(d0)),
      priority: 100,
      mergeable: false,
      anchor: extentAnchor ?? 'start' as const,
    },
    {
      id: 'max',
      position: opts.toPx(d1),
      text: opts.format(d1),
      width: alongWidth(opts.format(d1)),
      priority: 99,
      mergeable: false,
      anchor: extentAnchor ?? 'end' as const,
    },
  ];

  for (const value of opts.candidates ?? []) {
    if (value < d0 - 1e-9 || value > d1 + 1e-9) continue;
    if (Math.abs(value - d0) <= near || Math.abs(value - d1) <= near) continue;
    const text = opts.format(value);
    items.push({
      id: `tick-${value}`,
      position: opts.toPx(value),
      text,
      width: alongWidth(text),
      priority: 10,
      mergeable: false,
      anchor: 'middle',
    });
  }

  const placed = placeLinearLabels(items, {
    bounds: opts.bounds,
    minGap,
    maxLanes: 1,
    mergeDistance: 0,
  });
  if (laneIntegrity(placed, minGap).length > 0) {
    throw new Error('placeRangeFrameTicks: lane integrity failed');
  }
  return placed;
}

export type BandSpec = { id: string; size: number };
export type Band = { id: string; start: number; end: number; mid: number };

/**
 * Stack exclusive strips away from a plot edge. Dual scales, tick labels,
 * and caption lanes each take a band — they never share a baseline.
 * `direction` is +1 toward larger coordinates, −1 toward smaller.
 */
export function stackBands(
  origin: number,
  direction: 1 | -1,
  specs: BandSpec[],
): Band[] {
  let cursor = origin;
  return specs.map((spec) => {
    const start = direction === 1 ? cursor : cursor - spec.size;
    const end = direction === 1 ? cursor + spec.size : cursor;
    cursor += direction * spec.size;
    return { id: spec.id, start, end, mid: (start + end) / 2 };
  });
}

export type PanelScale = {
  id: string;
  x: [number, number];
  y: [number, number];
};

/** Empty when every small-multiple panel shares the same domains. */
export function sharedScaleIntegrity(
  panels: PanelScale[],
  epsilon = 1e-6,
): string[] {
  if (panels.length <= 1) return [];
  const errors: string[] = [];
  const a = panels[0];
  for (const p of panels.slice(1)) {
    if (Math.abs(p.x[0] - a.x[0]) > epsilon || Math.abs(p.x[1] - a.x[1]) > epsilon) {
      errors.push(`${p.id} x-domain [${p.x[0]}, ${p.x[1]}] ≠ [${a.x[0]}, ${a.x[1]}]`);
    }
    if (Math.abs(p.y[0] - a.y[0]) > epsilon || Math.abs(p.y[1] - a.y[1]) > epsilon) {
      errors.push(`${p.id} y-domain [${p.y[0]}, ${p.y[1]}] ≠ [${a.y[0]}, ${a.y[1]}]`);
    }
  }
  return errors;
}

export type Hsl = { h: number; s: number; l: number };

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace('#', '').trim();
  const full = raw.length === 3
    ? raw.split('').map((c) => c + c).join('')
    : raw;
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function hexToHsl(hex: string): Hsl {
  const { r, g, b } = hexToRgb(hex);
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return { h: h * 60, s, l };
}

function hueSpan(hues: number[]): number {
  if (hues.length === 0) return 0;
  const sorted = [...hues].sort((a, b) => a - b);
  let gap = 0;
  for (let i = 1; i < sorted.length; i++) {
    gap = Math.max(gap, sorted[i] - sorted[i - 1]);
  }
  gap = Math.max(gap, sorted[0] + 360 - sorted[sorted.length - 1]);
  return 360 - gap;
}

/**
 * Empty when a sequential ramp is a single-hue value scale.
 * Rainbow (blue → yellow → red) fails: hue span is large and the yellow
 * midpoint reads as a third category.
 */
export function sequentialRampIntegrity(
  stops: string[],
  maxHueSpan = 50,
): string[] {
  if (stops.length < 2) return [];
  const hsl = stops.map(hexToHsl);
  const chromatic = hsl.filter((c) => c.s >= 0.08);
  const errors: string[] = [];
  if (chromatic.length >= 2) {
    const span = hueSpan(chromatic.map((c) => c.h));
    if (span > maxHueSpan) {
      errors.push(`sequential ramp hue span ${span.toFixed(0)}° > ${maxHueSpan}°`);
    }
  }
  const lights = hsl.map((c) => c.l);
  const up = lights.every((v, i) => i === 0 || v >= lights[i - 1] - 1e-6);
  const down = lights.every((v, i) => i === 0 || v <= lights[i - 1] + 1e-6);
  if (!up && !down) {
    errors.push('sequential ramp lightness is not monotonic');
  }
  return errors;
}
