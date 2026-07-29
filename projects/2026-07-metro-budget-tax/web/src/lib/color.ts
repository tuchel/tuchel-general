/** Five-class choropleth palette: low → high = blue → green → yellow → orange → red. */
export const CHOROPLETH_CLASS_COLORS = [
  '#2c7bb6', // blue
  '#1a9850', // green
  '#fee08b', // yellow
  '#fdae61', // orange
  '#d73027', // red
] as const

export const CHOROPLETH_CLASS_LABELS = [
  'Lowest',
  'Low',
  'Middle',
  'High',
  'Highest',
] as const

/** @deprecated Prefer CHOROPLETH_CLASS_COLORS for maps — kept for any non-map callers. */
export function sequentialColor(t: number): string {
  const x = Math.min(1, Math.max(0, t))
  const i = Math.min(CHOROPLETH_CLASS_COLORS.length - 1, Math.round(x * (CHOROPLETH_CLASS_COLORS.length - 1)))
  return CHOROPLETH_CLASS_COLORS[i]
}

export function classColor(index: number): string {
  const i = Math.min(CHOROPLETH_CLASS_COLORS.length - 1, Math.max(0, index))
  return CHOROPLETH_CLASS_COLORS[i]
}

export function quantileBreaks(values: number[], k = 5): number[] {
  const sorted = [...values].sort((a, b) => a - b)
  if (!sorted.length) return []
  const breaks: number[] = []
  for (let i = 1; i < k; i++) {
    const idx = (i / k) * (sorted.length - 1)
    const lo = Math.floor(idx)
    const hi = Math.ceil(idx)
    const v =
      lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
    breaks.push(v)
  }
  return breaks
}

export function classIndex(value: number, breaks: number[]): number {
  let i = 0
  while (i < breaks.length && value > breaks[i]) i++
  return i
}

/** Inclusive class ranges from quantile breaks + data extents. */
export function classRanges(
  values: number[],
  breaks: number[],
): { lo: number; hi: number }[] {
  if (!values.length) return []
  const sorted = [...values].sort((a, b) => a - b)
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  const edges = [min, ...breaks, max]
  const ranges: { lo: number; hi: number }[] = []
  for (let i = 0; i < edges.length - 1; i++) {
    ranges.push({ lo: edges[i], hi: edges[i + 1] })
  }
  return ranges
}
