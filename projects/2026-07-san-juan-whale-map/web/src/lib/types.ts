export type SpeciesKey =
  | 'srkw'
  | 'biggs'
  | 'orca_unspecified'
  | 'humpback'
  | 'gray'
  | 'minke'
  | 'other_baleen'
  | 'porpoise'
  | 'other_cetacean'

export type Meta = {
  builtAt: string
  bbox: { south: number; north: number; west: number; east: number }
  counts: {
    historicalInBbox: number
    hexCells: number
    recentInBbox: number
    scatterSample: number
    historyPoints?: number
  }
  sources: { id: string; name: string; url: string; license: string }[]
  speciesLabels: Record<string, string>
}

export type Seasonality = {
  bySpeciesMonth: Record<string, Record<string, number>>
  bySpeciesHour: Record<string, Record<string, number>>
  yearCounts: Record<string, number>
  total: number
}

export type Hotspot = {
  id: string
  name: string
  kind: string
  speciesPriors: SpeciesKey[]
  bestMonths: number[]
  lat: number
  lon: number
  radiusKm: number
  why: string
  tip: string
}

export type Launch = {
  id: string
  name: string
  lat: number
  lon: number
  note: string
}

export type Etiquette = {
  title: string
  rules: string[]
  url: string
  bufferYards: number
}

export const SPECIES_ORDER: SpeciesKey[] = [
  'srkw',
  'biggs',
  'orca_unspecified',
  'humpback',
  'minke',
  'gray',
  'porpoise',
]

export const SPECIES_COLOR: Record<SpeciesKey, string> = {
  srkw: '#1a7a72',
  biggs: '#c46b2d',
  orca_unspecified: '#3d7ea6',
  humpback: '#3f6fad',
  gray: '#8a7355',
  minke: '#4f8f6a',
  other_baleen: '#6a7d8c',
  porpoise: '#7a6a96',
  other_cetacean: '#6e757c',
}

export const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export function hexRawCount(
  props: {
    total: number
    bySpecies: Record<string, number>
    byMonth: Record<string, number>
    bySpeciesMonth: Record<string, number>
  },
  month: number | 'all',
  species: Set<string>,
): number {
  if (month === 'all' && species.size === 0) return props.total
  if (month === 'all') {
    return [...species].reduce((n, s) => n + (props.bySpecies[s] || 0), 0)
  }
  if (species.size === 0) return props.byMonth[String(month)] || 0
  return [...species].reduce(
    (n, s) => n + (props.bySpeciesMonth[`${s}:${month}`] || 0),
    0,
  )
}

/** Effort proxy = all-time cell total. Down-weights popular watch water. */
export function hexScore(
  props: {
    total: number
    bySpecies: Record<string, number>
    byMonth: Record<string, number>
    bySpeciesMonth: Record<string, number>
  },
  month: number | 'all',
  species: Set<string>,
  opts?: { effortBias?: boolean; medianEffort?: number },
): number {
  const raw = hexRawCount(props, month, species)
  if (!opts?.effortBias) return raw
  const effort = Math.max(1, props.total)
  const med = Math.max(1, opts.medianEffort ?? 20)
  // Same raw count in a quiet cell scores higher than at Lime Kiln.
  return raw * (med / (effort + med * 0.5))
}

export type ViewMode = 'balanced' | 'climatology' | 'nowcast'
