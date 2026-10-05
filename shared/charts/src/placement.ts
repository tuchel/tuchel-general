/**
 * The house placement primitives and integrity helpers, fed measured boxes.
 * Use them where a label set is dense; a hand-placed label is fine when the
 * integrity helpers pass on its measured box.
 */
import {
  placeLinearLabels, placePlanarLabels, seatsAroundMark,
  type LabelItem, type PlanarItem, type Seat, type TextAnchor,
} from './layout/labelPlacement.ts';
import { measure, type TextStyle } from './measure.ts';

export {
  placeLinearLabels, placePlanarLabels, placeSeriesEndLabels, seatsAroundMark,
  laneIntegrity, planarIntegrity, overflowIntegrity, rectsOverlap, textRect,
  type LabelItem, type PlanarItem, type PlacedLabel, type PlacedPlanar, type Rect, type Seat,
} from './layout/labelPlacement.ts';
export { sharedScaleIntegrity, sequentialRampIntegrity, stackBands } from './layout/chartFidelity.ts';

export function linearItem(id: string, position: number, text: string, style: TextStyle, o: { priority?: number; anchor?: TextAnchor } = {}): LabelItem {
  return { id, position, text, width: measure(text, style), priority: o.priority ?? 10, anchor: o.anchor ?? 'middle', mergeable: false };
}

export function planarItem(id: string, text: string, style: TextStyle, seats: Seat[], priority = 10): PlanarItem {
  return { id, text, width: measure(text, style), height: style.size, priority, seats };
}

export function placeLinear(items: LabelItem[], bounds: [number, number], o: { minGap?: number; maxLanes?: number } = {}) {
  return placeLinearLabels(items, { bounds, minGap: o.minGap ?? 6, maxLanes: o.maxLanes ?? 2, mergeDistance: 0 });
}

export { placePlanarLabels as placePlanar, seatsAroundMark as seats };
