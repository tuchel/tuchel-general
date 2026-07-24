export type TaxComposition = Record<string, number>
export type SpendComposition = Record<string, number>

export interface Metro {
  cbsa: string
  name: string
  area_type: string
  is_metro: boolean
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
  transfer_share: number | null
  ig_share_of_own_plus_ig: number | null
  tax_composition: TaxComposition
  spend_composition: SpendComposition
}

export interface Dataset {
  meta: {
    title: string
    fiscal_year: number
    definitions: Record<string, string>
  }
  audit: {
    fiscal_year: number
    n_metropolitan: number
    sum_tax_metropolitan_only: number
    sum_spend_metropolitan_only: number
    notes: string[]
  }
  metros: Metro[]
}

export type MetricKey = 'tax_per_capita' | 'spend_per_capita' | 'gap_per_capita'

export const METRIC_LABELS: Record<MetricKey, string> = {
  tax_per_capita: 'Local tax / person',
  spend_per_capita: 'Local spend / person',
  gap_per_capita: 'Spend − tax / person',
}

export function money(n: number, digits = 0): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: digits,
  })
}

export function compactMoney(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return money(n)
}

export function people(n: number): string {
  return n.toLocaleString('en-US')
}
