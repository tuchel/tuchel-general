/** Sliding heat time windows over dated sighting points. */

export type HeatWindow = 'all' | '90d' | '30d' | '7d' | '24h'

export const HEAT_WINDOWS: { id: HeatWindow; label: string; hours: number | null }[] = [
  { id: 'all', label: 'All time', hours: null },
  { id: '90d', label: '90 days', hours: 90 * 24 },
  { id: '30d', label: '30 days', hours: 30 * 24 },
  { id: '7d', label: '7 days', hours: 7 * 24 },
  { id: '24h', label: '24 hours', hours: 24 },
]

export type HistoryPoint = {
  species: string
  date: string
  t: number
  source?: string
  lon: number
  lat: number
}

export function heatWindowIndex(w: HeatWindow): number {
  return Math.max(0, HEAT_WINDOWS.findIndex((x) => x.id === w))
}

export function heatWindowFromIndex(i: number): HeatWindow {
  return HEAT_WINDOWS[Math.min(Math.max(0, i), HEAT_WINDOWS.length - 1)].id
}

export function parseHistoryCollection(fc: {
  features: {
    properties: { species?: string; date?: string; t?: number; source?: string }
    geometry: { coordinates: number[] }
  }[]
}): HistoryPoint[] {
  const out: HistoryPoint[] = []
  for (const f of fc.features || []) {
    const t = Number(f.properties?.t)
    const lon = f.geometry?.coordinates?.[0]
    const lat = f.geometry?.coordinates?.[1]
    if (!Number.isFinite(t) || !Number.isFinite(lon) || !Number.isFinite(lat)) continue
    out.push({
      species: String(f.properties?.species || 'other_cetacean'),
      date: String(f.properties?.date || ''),
      t,
      source: f.properties?.source,
      lon,
      lat,
    })
  }
  return out
}

export function filterHistoryPoints(
  points: HistoryPoint[],
  window: HeatWindow,
  species: Set<string>,
  nowMs = Date.now(),
): HistoryPoint[] {
  const hours = HEAT_WINDOWS.find((w) => w.id === window)?.hours ?? null
  const cut = hours == null ? 0 : nowMs - hours * 3600 * 1000
  return points.filter((p) => {
    if (hours != null && p.t < cut) return false
    if (species.size && !species.has(p.species)) return false
    return true
  })
}

/** Point collection for MapLibre heatmap; weight favors newer sightings inside the window. */
export function historyToHeatGeoJSON(
  points: HistoryPoint[],
  window: HeatWindow,
  nowMs = Date.now(),
) {
  const hours = HEAT_WINDOWS.find((w) => w.id === window)?.hours
  const span = (hours ?? 365 * 24) * 3600 * 1000
  return {
    type: 'FeatureCollection' as const,
    features: points.map((p) => {
      const age = Math.max(0, nowMs - p.t)
      const recency = Math.max(0, Math.min(1, 1 - age / span))
      return {
        type: 'Feature' as const,
        properties: {
          species: p.species,
          date: p.date,
          t: p.t,
          recency,
          weight: 0.35 + 0.65 * recency,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [p.lon, p.lat],
        },
      }
    }),
  }
}
