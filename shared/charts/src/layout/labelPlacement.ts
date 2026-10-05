/**
 * 1-D label placement — the mechanical half of chart visual fidelity.
 *
 * Type never shares ink with other type. Resolve by exclusive lanes, merge of coincident marks,
 * or omit. Never stack captions on one baseline and hope.
 *
 * Pure functions. No DOM. Unit-tested. Every 1-D label set on a chart
 * (reference-line captions, overlay dates, axis-tick extras) goes through
 * `placeLinearLabels` before render.
 */

export type TextAnchor = 'start' | 'middle' | 'end';
export type TextFace = 'mono' | 'sans';
export type TextAlign = 'baseline' | 'middle';

export type Rect = { x: number; y: number; w: number; h: number };

export type LabelItem = {
  id: string;
  /** Anchor position along the axis, in the same px space as `width`. */
  position: number;
  text: string;
  /** Estimated ink width in px (use `estimateMonoWidth` for JetBrains Mono). */
  width: number;
  /** Higher wins the lane, and is the survivor when marks merge. */
  priority: number;
  /** When true, marks closer than `mergeDistance` collapse into one caption. */
  mergeable?: boolean;
  anchor?: TextAnchor;
};

export type PlacedLabel = {
  id: string;
  position: number;
  lane: number;
  text: string;
  hidden: boolean;
  mergedIds: string[];
  width: number;
  anchor: TextAnchor;
};

export type PlaceOptions = {
  bounds: [number, number];
  /** Extra px required between adjacent boxes in the same lane. Default 6. */
  minGap?: number;
  /** Exclusive horizontal bands. Default 2. */
  maxLanes?: number;
  /**
   * Marks whose anchors are closer than this (px) and that are both
   * `mergeable` become one caption. Default 14 — about one short word
   * at 8.5 px mono, and well under a distinct data event on a typical plot.
   */
  mergeDistance?: number;
};

export type Box = { lo: number; hi: number };

/** JetBrains Mono at `fontSize` px — tabular, ~0.62 em per glyph. */
export function estimateMonoWidth(text: string, fontSize: number): number {
  return Math.max(0, text.length) * fontSize * 0.62;
}

/**
 * Inter (and the house sans) is proportional. A mono estimate on an Inter
 * caption is a lie: "William" is wider than "lllllll", and a collision test
 * that trusts the wrong box will pass a smear. Advances are em fractions
 * measured against Inter Regular; unknown glyphs take the category default.
 */
const SANS_ADVANCE: Record<string, number> = {
  ' ': 0.22, '.': 0.26, ',': 0.26, ':': 0.26, ';': 0.26, '!': 0.30,
  '-': 0.32, '–': 0.50, '—': 0.82, '·': 0.34, '/': 0.32, '\\': 0.32,
  '(': 0.32, ')': 0.32, '[': 0.32, ']': 0.32, '\'': 0.18, '"': 0.36,
  '%': 0.78, '$': 0.56, '+': 0.58, '=': 0.58, '*': 0.46, '#': 0.62,
  i: 0.27, l: 0.27, I: 0.29, t: 0.34, f: 0.34, j: 0.27, r: 0.36,
  J: 0.42, m: 0.86, M: 0.80, w: 0.78, W: 0.90,
};

function sansAdvance(ch: string): number {
  if (SANS_ADVANCE[ch] !== undefined) return SANS_ADVANCE[ch];
  if (ch >= '0' && ch <= '9') return 0.60;
  if (ch >= 'A' && ch <= 'Z') return 0.66;
  if (ch >= 'a' && ch <= 'z') return 0.54;
  return 0.56;
}

export function estimateSansWidth(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of text) em += sansAdvance(ch);
  return em * fontSize;
}

export function estimateTextWidth(
  text: string,
  fontSize: number,
  face: TextFace = 'mono',
): number {
  return face === 'sans'
    ? estimateSansWidth(text, fontSize)
    : estimateMonoWidth(text, fontSize);
}

export function boxOf(
  position: number,
  width: number,
  anchor: TextAnchor,
): Box {
  if (anchor === 'middle') {
    return { lo: position - width / 2, hi: position + width / 2 };
  }
  if (anchor === 'end') {
    return { lo: position - width, hi: position };
  }
  return { lo: position, hi: position + width };
}

export function boxesOverlap(a: Box, b: Box, gap = 0): boolean {
  return a.lo < b.hi + gap && b.lo < a.hi + gap;
}

export function clampPosition(
  position: number,
  width: number,
  anchor: TextAnchor,
  bounds: [number, number],
): number {
  const span = bounds[1] - bounds[0];
  if (width >= span) {
    if (anchor === 'end') return bounds[1];
    if (anchor === 'middle') return (bounds[0] + bounds[1]) / 2;
    return bounds[0];
  }
  const box = boxOf(position, width, anchor);
  let shift = 0;
  if (box.lo < bounds[0]) shift = bounds[0] - box.lo;
  if (box.hi + shift > bounds[1]) shift = bounds[1] - box.hi;
  return position + shift;
}

function withAnchor(item: LabelItem): TextAnchor {
  return item.anchor ?? 'start';
}

function mergeCluster(cluster: LabelItem[]): LabelItem {
  if (cluster.length === 1) return cluster[0];
  const ordered = [...cluster].sort((a, b) => a.position - b.position);
  const primary = [...cluster].sort((a, b) => b.priority - a.priority)[0];
  const text = ordered.map((item) => item.text).join(' · ');
  const sep = estimateMonoWidth(' · ', 8.5);
  const width = ordered.reduce((sum, item) => sum + item.width, 0) + sep * (ordered.length - 1);
  return {
    id: primary.id,
    position: primary.position,
    text,
    width,
    priority: primary.priority,
    mergeable: true,
    anchor: withAnchor(primary),
  };
}

function clusterByProximity(
  items: LabelItem[],
  mergeDistance: number,
): { representatives: LabelItem[]; absorbed: Map<string, string[]> } {
  const sorted = [...items].sort((a, b) => a.position - b.position || b.priority - a.priority);
  const groups: LabelItem[][] = [];
  for (const item of sorted) {
    const prev = groups[groups.length - 1];
    const last = prev?.[prev.length - 1];
    if (
      last
      && last.mergeable
      && item.mergeable
      && Math.abs(item.position - last.position) < mergeDistance
    ) {
      prev.push(item);
    } else {
      groups.push([item]);
    }
  }

  const absorbed = new Map<string, string[]>();
  const representatives = groups.map((group) => {
    const merged = mergeCluster(group);
    absorbed.set(merged.id, group.map((item) => item.id));
    return merged;
  });
  return { representatives, absorbed };
}

/**
 * Place a 1-D set of labels so no two visible captions share ink.
 *
 * Resolution order: merge coincident marks, then exclusive lanes, then hide
 * the lower-priority leftover. Positions clamp to `bounds`.
 */
export function placeLinearLabels(
  items: LabelItem[],
  opts: PlaceOptions,
): PlacedLabel[] {
  const minGap = opts.minGap ?? 6;
  const maxLanes = Math.max(1, opts.maxLanes ?? 2);
  const mergeDistance = opts.mergeDistance ?? 14;
  const { representatives, absorbed } = clusterByProximity(items, mergeDistance);

  const queue = [...representatives].sort(
    (a, b) => b.priority - a.priority || a.position - b.position,
  );
  const occupants: PlacedLabel[] = [];

  for (const item of queue) {
    const anchor = withAnchor(item);
    const position = clampPosition(item.position, item.width, anchor, opts.bounds);
    const mergedIds = absorbed.get(item.id) ?? [item.id];
    let lane: number | null = null;
    for (let candidate = 0; candidate < maxLanes; candidate++) {
      const box = boxOf(position, item.width, anchor);
      const hit = occupants.some((other) => (
        !other.hidden
        && other.lane === candidate
        && boxesOverlap(box, boxOf(other.position, other.width, other.anchor), minGap)
      ));
      if (!hit) {
        lane = candidate;
        break;
      }
    }
    occupants.push({
      id: item.id,
      position,
      lane: lane ?? 0,
      text: item.text,
      hidden: lane === null,
      mergedIds,
      width: item.width,
      anchor,
    });
  }

  const visibleIds = new Set(occupants.map((p) => p.id));
  const stubs: PlacedLabel[] = [];
  for (const item of items) {
    if (visibleIds.has(item.id)) continue;
    const host = occupants.find((p) => p.mergedIds.includes(item.id));
    stubs.push({
      id: item.id,
      position: host?.position ?? item.position,
      lane: host?.lane ?? 0,
      text: '',
      hidden: true,
      mergedIds: [item.id],
      width: 0,
      anchor: withAnchor(item),
    });
  }

  return [...occupants, ...stubs];
}

/**
 * Series end-labels are a 1-D set along the *orthogonal* axis: the last
 * vertex of each line shares an x, and the names must not share a y-box.
 * This is `placeLinearLabels` with the axis swapped — named so authors
 * do not re-park every name at `xMax + 8` and hope the series finish apart.
 */
export function placeSeriesEndLabels(
  series: Array<{
    id: string;
    y: number;
    text: string;
    priority: number;
    face?: TextFace;
    fontSize?: number;
  }>,
  opts: {
    boundsY: [number, number];
    minGap?: number;
    maxLanes?: number;
  },
): PlacedLabel[] {
  return placeLinearLabels(
    series.map((s) => {
      const fontSize = s.fontSize ?? 11;
      return {
        id: s.id,
        position: s.y,
        text: s.text,
        // Along-axis ink is the cap height, not the string's horizontal width.
        width: fontSize,
        priority: s.priority,
        mergeable: false,
        anchor: 'middle' as const,
      };
    }),
    {
      bounds: opts.boundsY,
      minGap: opts.minGap ?? 4,
      maxLanes: opts.maxLanes ?? 2,
      mergeDistance: 0,
    },
  );
}

export function textRect(
  x: number,
  y: number,
  width: number,
  height: number,
  anchor: TextAnchor,
  align: TextAlign = 'baseline',
): Rect {
  const left = anchor === 'end'
    ? x - width
    : anchor === 'middle'
      ? x - width / 2
      : x;
  const top = align === 'middle' ? y - height / 2 : y - height * 0.72;
  return { x: left, y: top, w: width, h: height };
}

export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return (
    a.x < b.x + b.w + gap
    && b.x < a.x + a.w + gap
    && a.y < b.y + b.h + gap
    && b.y < a.y + a.h + gap
  );
}

export function rectsInside(inner: Rect, outer: Rect, pad = 0): boolean {
  return (
    inner.x >= outer.x - pad
    && inner.y >= outer.y - pad
    && inner.x + inner.w <= outer.x + outer.w + pad
    && inner.y + inner.h <= outer.y + outer.h + pad
  );
}

/** Empty when every visible text box sits inside `canvas`. */
export function overflowIntegrity(rects: Rect[], canvas: Rect): string[] {
  return rects
    .filter((r) => !rectsInside(r, canvas, 0.5))
    .map((r) => `overflow ${r.x.toFixed(1)},${r.y.toFixed(1)} ${r.w.toFixed(1)}×${r.h.toFixed(1)}`);
}

export type Seat = {
  x: number;
  y: number;
  anchor: TextAnchor;
  align?: TextAlign;
};

/**
 * House seat order around a mark: right, left, above, below. Offsets clear
 * `markRadius + gap` so the first seat does not fail its own obstacle.
 * A hand-built `+8, −10` next to a 4 px dot with a 3 px gap is not a seat —
 * it is a collision the algorithm will correctly refuse.
 */
export function seatsAroundMark(
  mx: number,
  my: number,
  markRadius = 4,
  gap = 6,
): Seat[] {
  const d = markRadius + gap;
  return [
    { x: mx + d, y: my + 3.5, anchor: 'start' },
    { x: mx - d, y: my + 3.5, anchor: 'end' },
    { x: mx, y: my - d, anchor: 'middle' },
    { x: mx, y: my + d + 4, anchor: 'middle' },
  ];
}

export type PlanarItem = {
  id: string;
  text: string;
  width: number;
  height: number;
  priority: number;
  /** Tried in order; first seat whose box is free and inside bounds wins. */
  seats: Seat[];
};

export type PlacedPlanar = {
  id: string;
  text: string;
  hidden: boolean;
  seat: Seat | null;
  rect: Rect | null;
};

export type PlacePlanarOptions = {
  bounds: Rect;
  obstacles?: Rect[];
  minGap?: number;
};

/**
 * Place 2-D callouts so no two visible captions share ink, and none sit on
 * a mark or an axis. Resolution: try each seat in order, then omit.
 *
 * Default seat order for a mark at (mx, my) is right, left, above, below —
 * build that list at the call site; this function does not invent offsets.
 */
export function placePlanarLabels(
  items: PlanarItem[],
  opts: PlacePlanarOptions,
): PlacedPlanar[] {
  const minGap = opts.minGap ?? 4;
  const obstacles = opts.obstacles ?? [];
  const queue = [...items].sort((a, b) => b.priority - a.priority);
  const occupants: PlacedPlanar[] = [];

  for (const item of queue) {
    let chosen: { seat: Seat; rect: Rect } | null = null;
    for (const seat of item.seats) {
      const rect = textRect(
        seat.x,
        seat.y,
        item.width,
        item.height,
        seat.anchor,
        seat.align ?? 'baseline',
      );
      if (!rectsInside(rect, opts.bounds, 0)) continue;
      const hitObstacle = obstacles.some((o) => rectsOverlap(rect, o, minGap));
      if (hitObstacle) continue;
      const hitLabel = occupants.some((other) => (
        other.rect !== null && rectsOverlap(rect, other.rect, minGap)
      ));
      if (hitLabel) continue;
      chosen = { seat, rect };
      break;
    }
    occupants.push({
      id: item.id,
      text: item.text,
      hidden: chosen === null,
      seat: chosen?.seat ?? null,
      rect: chosen?.rect ?? null,
    });
  }
  return occupants;
}

/** Empty when no two visible planar captions overlap. */
export function planarIntegrity(placed: PlacedPlanar[], minGap = 0): string[] {
  const errors: string[] = [];
  const visible = placed.filter((p) => !p.hidden && p.rect);
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i];
      const b = visible[j];
      if (a.rect && b.rect && rectsOverlap(a.rect, b.rect, minGap)) {
        errors.push(`planar: "${a.text}" overlaps "${b.text}"`);
      }
    }
  }
  return errors;
}

/** Exclusive lanes actually occupied by visible captions. */
export function lanesUsed(placed: PlacedLabel[]): number {
  const visible = placed.filter((p) => !p.hidden);
  if (visible.length === 0) return 0;
  return Math.max(...visible.map((p) => p.lane)) + 1;
}

/** Empty when every visible pair in a lane respects `minGap`. */
export function laneIntegrity(placed: PlacedLabel[], minGap = 0): string[] {
  const errors: string[] = [];
  const byLane = new Map<number, PlacedLabel[]>();
  for (const p of placed) {
    if (p.hidden) continue;
    const list = byLane.get(p.lane) ?? [];
    list.push(p);
    byLane.set(p.lane, list);
  }
  for (const [lane, list] of byLane) {
    const sorted = [...list].sort((a, b) => a.position - b.position);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const next = sorted[i];
      if (boxesOverlap(
        boxOf(prev.position, prev.width, prev.anchor),
        boxOf(next.position, next.width, next.anchor),
        minGap,
      )) {
        errors.push(`lane ${lane}: "${prev.text}" overlaps "${next.text}"`);
      }
    }
  }
  return errors;
}
