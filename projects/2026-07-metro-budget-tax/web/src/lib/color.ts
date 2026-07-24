/** Single-hue sequential ramp (teal). t in [0,1]. */
export function sequentialColor(t: number): string {
  const x = Math.min(1, Math.max(0, t))
  // interpolate paper-teal → deep teal in HSL-ish RGB
  const r = Math.round(232 + (11 - 232) * x)
  const g = Math.round(241 + (95 - 241) * x)
  const b = Math.round(242 + (107 - 242) * x)
  return `rgb(${r},${g},${b})`
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
