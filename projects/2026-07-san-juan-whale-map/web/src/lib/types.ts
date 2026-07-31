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
  srkw: '#3ecfba',
  biggs: '#f0a35e',
  orca_unspecified: '#7ec8e3',
  humpback: '#6b9fdf',
  gray: '#c4a882',
  minke: '#9ad0a8',
  other_baleen: '#8fa3b8',
  porpoise: '#b8a0d4',
  other_cetacean: '#a0a8b0',
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

export function hexScore(
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
