export type TaxComposition = Record<string, number>
export type SpendComposition = Record<string, number>

export interface HistoryPoint {
  year: number
  population: number
  tax_per_capita: number
  spend_per_capita: number
  gap_per_capita: number
}

export interface Metro {
  cbsa: string
  name: string
  area_type: string
  is_metro: boolean
  region: string
  states: string[]
  year: number
  population: number
  n_gov_units: number
  tax_total: number
  spend_total: number
  charges_total: number
  misc_total: number
  ig_federal: number
  ig_state: number
  own_source: number
  tax_per_capita: number
  spend_per_capita: number
  gap_per_capita: number
  own_source_per_capita: number
  charges_per_capita: number
  ig_per_capita: number
  transfer_share: number | null
  ig_share_of_own_plus_ig: number | null
  personal_income_per_capita: number | null
  tax_as_share_of_personal_income: number | null
  city_hall_tax_per_capita: number
  city_hall_spend_per_capita: number
  n_city_units: number
  tax_composition: TaxComposition
  spend_composition: SpendComposition
  revenue_stack_per_capita: Record<string, number>
  history: HistoryPoint[]
}

export interface Dataset {
  meta: {
    title: string
    fiscal_year: number
    definitions: Record<string, string>
  }
  audit: {
    fiscal_year: number
    years_in_history: number[]
    n_metropolitan: number
    n_micropolitan: number
    metros_with_personal_income: number
    sum_tax_metropolitan_only: number
    sum_spend_metropolitan_only: number
    tax_recovery_vs_published: number
    notes: string[]
  }
  metros: Metro[]
}

export type MetricKey =
  | 'tax_per_capita'
  | 'spend_per_capita'
  | 'gap_per_capita'
  | 'tax_as_share_of_personal_income'

export const METRIC_LABELS: Record<MetricKey, string> = {
  tax_per_capita: 'Local tax / person',
  spend_per_capita: 'Local spend / person',
  gap_per_capita: 'Spend − tax / person',
  tax_as_share_of_personal_income: 'Tax / personal income',
}

export const REGIONS = ['Northeast', 'Midwest', 'South', 'West', 'Multi-region'] as const

export type PopBand = 'all' | 'lt500k' | '500k-1m' | '1m-3m' | 'gt3m'

export function money(n: number, digits = 0): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: digits,
  })
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '—'
  return `${(100 * n).toFixed(digits)}%`
}

export function people(n: number): string {
  return n.toLocaleString('en-US')
}

export function metricValue(m: Metro, key: MetricKey): number | null {
  if (key === 'tax_as_share_of_personal_income') return m.tax_as_share_of_personal_income
  return m[key]
}

export function formatMetric(m: Metro, key: MetricKey): string {
  const v = metricValue(m, key)
  if (v == null) return '—'
  if (key === 'tax_as_share_of_personal_income') return pct(v)
  return money(v)
}

export function inPopBand(pop: number, band: PopBand): boolean {
  if (band === 'all') return true
  if (band === 'lt500k') return pop < 500_000
  if (band === '500k-1m') return pop >= 500_000 && pop < 1_000_000
  if (band === '1m-3m') return pop >= 1_000_000 && pop < 3_000_000
  return pop >= 3_000_000
}

export function median(values: number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
