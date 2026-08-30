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
  /** Frozen ranked-v2 0–100 scores. null = unknown. */
  scores: Record<CriterionId, Score>
  /**
   * published = per-criterion numbers from ranked-v2.
   * fitted-aggregate is unused.
   */
  scoreSource: 'published' | 'fitted-aggregate'
  /** Google typical 8am minutes from 427 Ridgewood Rd. null = untimed. */
  driveMinutesTypical: number | null
  driveRange: [number, number] | null
  /** Range can reach 20 minutes. Flag, not a fail. */
  straddle: boolean
  address: string
  url: string
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
  montessori: 'Montessori / Reggio',
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
  outdoor: 'All-day outdoor time versus indoor.',
  montessori: 'Montessori or Reggio. Unknown is dropped, not zero. No NAREA-listed school in Austin.',
  age_fit: 'Fit for a child born 24 Oct 2023 (~2y 10m this fall).',
  distance: 'Score from typical 8am drive. Weights do not recompute it.',
  nature: 'Preserve or woods versus a yard with trees.',
  logistics: 'Hours, days, and a published full week.',
  continuity: 'Same community through elementary.',
  cost: 'Tuition.',
  staff: 'Credentials and tenure.',
  availability: 'A seat this fall.',
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
    rule: 'Typical 8am is 20 minutes or more.',
  },
  eligible_at_3: {
    kicker: 'Tray 3',
    title: 'Eligible at 3',
    rule: 'Age-gated this fall.',
  },
}
