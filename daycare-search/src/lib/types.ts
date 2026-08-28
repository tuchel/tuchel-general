export const CORE_CRITERIA = [
  'outdoor',
  'montessori',
  'age_fit',
  'distance',
  'nature',
  'logistics',
] as const

export const EXTRA_CRITERIA = ['continuity', 'cost', 'staff', 'availability'] as const

export const CRITERIA = [...CORE_CRITERIA, ...EXTRA_CRITERIA] as const

export type CoreCriterion = (typeof CORE_CRITERIA)[number]
export type ExtraCriterion = (typeof EXTRA_CRITERIA)[number]
export type CriterionId = (typeof CRITERIA)[number]
export type TrayId = 'ranked' | 'worth_the_drive' | 'eligible_at_3'

/** null = unknown. Never coerce unknown to 0. */
export type Score = number | null

export type Weights = Record<CriterionId, number>

export type School = {
  id: string
  name: string
  bluntClass: string
  tray: TrayId
  /** Frozen ranked-v1 0–100 scores. null = unknown. */
  scores: Record<CriterionId, Score>
  /**
   * published = per-criterion numbers given in ranked-v1.
   * fitted-aggregate = per-criterion row completed so first-pass raw/coverage
   * match the published totals; slider re-ranks are approximate.
   */
  scoreSource: 'published' | 'fitted-aggregate'
  /** Google typical 8am minutes from 427 Ridgewood Rd. null = untimed. */
  driveMinutesTypical: number | null
  driveRange: [number, number] | null
  /** Range can reach 20 minutes. Flag, not a fail. */
  straddle: boolean
  address: string
  url: string | null
  flags: string[]
  notes: string[]
  missingUnverified: string[]
}

export type RankResult = {
  raw: number | null
  coverage: number | null
  sort: number | null
  active: CriterionId[]
  used: CriterionId[]
  contributions: Record<CriterionId, number | null>
}

export const FIRST_PASS: Weights = {
  outdoor: 30,
  montessori: 20,
  age_fit: 15,
  distance: 15,
  nature: 10,
  logistics: 10,
  continuity: 0,
  cost: 0,
  staff: 0,
  availability: 0,
}

export const CRITERION_LABEL: Record<CriterionId, string> = {
  outdoor: 'Outdoor',
  montessori: 'Montessori',
  age_fit: 'Age fit',
  distance: 'Distance',
  nature: 'Nature',
  logistics: 'Logistics',
  continuity: 'Continuity',
  cost: 'Cost',
  staff: 'Staff',
  availability: 'Availability',
}

export const CRITERION_BOUND: Record<CriterionId, string> = {
  outdoor: 'How much all-day outdoor time matters relative to the rest of the mix.',
  montessori: 'How much a prepared Montessori environment matters. Unknown is dropped, not zero.',
  age_fit: 'How well the class matches a child born 24 Oct 2023 (~2y 10m this fall).',
  distance: 'Frozen 0–100 from typical 8am drive. Not recomputed when weights move.',
  nature: 'Preserve, acreage, or true woods versus a yard with trees.',
  logistics: 'Hours, days, and whether a full week is published.',
  continuity: 'Same community through elementary. Off in First pass.',
  cost: 'Tuition as a scored criterion. Off in First pass; most rows are unknown.',
  staff: 'Credentials and tenure as a scored criterion. Off in First pass.',
  availability: 'Seats this fall as a scored criterion. Off in First pass.',
}

export const TRAY_COPY: Record<
  TrayId,
  { kicker: string; title: string; rule: string }
> = {
  ranked: {
    kicker: 'Tray 1',
    title: 'Ranked',
    rule: 'Typical 8am under 20 minutes, and eligible now.',
  },
  worth_the_drive: {
    kicker: 'Tray 2',
    title: 'Worth the drive',
    rule: 'Typical 8am is 20 minutes or more. Range-high is a flag, not a fail.',
  },
  eligible_at_3: {
    kicker: 'Tray 3',
    title: 'Eligible at 3',
    rule: 'Age-gated this fall. Parkside and Cedars sit here even though typical is under 20.',
  },
}
