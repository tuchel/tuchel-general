import type { LonLat, StoryEvent } from './types'

const R_MI = 3958.7613

export function miles(a: LonLat, b: LonLat): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R_MI * Math.asin(Math.min(1, Math.sqrt(s)))
}

export function formatMiles(n: number): string {
  if (n < 0.1) return '<0.1 mi'
  if (n < 10) return `${n.toFixed(1)} mi`
  return `${Math.round(n)} mi`
}

export function eventPoint(ev: StoryEvent): LonLat | null {
  if (ev.lat == null || ev.lon == null) return null
  return { lat: ev.lat, lon: ev.lon }
}
