import {
  CRITERIA,
  type CriterionId,
  type RankResult,
  type School,
  type Weights,
} from './types'

/**
 * A = criteria with weight > 0.
 * W = subset of A with a numeric score (not unknown).
 * raw = sum(w_i * s_i for i in W) / sum(w_i for i in W)
 * coverage = sum(w_i for i in W) / sum(w_i for i in A)
 * default sort = raw * coverage
 *
 * Unknown is dropped from the denominator. A known 0 stays in.
 */
export function rankSchool(school: School, weights: Weights): RankResult {
  const active = CRITERIA.filter((id) => weights[id] > 0)
  const used = active.filter((id) => school.scores[id] != null)
  const contributions = Object.fromEntries(CRITERIA.map((id) => [id, null])) as Record<
    CriterionId,
    number | null
  >

  if (active.length === 0) {
    return { raw: null, coverage: null, sort: null, active, used, contributions }
  }

  const sumA = active.reduce((n, id) => n + weights[id], 0)
  const sumW = used.reduce((n, id) => n + weights[id], 0)
  const coverage = sumA > 0 ? sumW / sumA : null

  if (sumW === 0) {
    return { raw: null, coverage, sort: null, active, used, contributions }
  }

  const weighted = used.reduce((n, id) => n + weights[id] * (school.scores[id] as number), 0)
  const raw = weighted / sumW
  for (const id of used) {
    contributions[id] = (weights[id] * (school.scores[id] as number)) / sumW
  }

  return { raw, coverage, sort: raw * (coverage ?? 0), active, used, contributions }
}

export function sortValue(result: RankResult, rawOnly: boolean): number | null {
  return rawOnly ? result.raw : result.sort
}

export function cmpNullableDesc(a: number | null, b: number | null): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  return b - a
}

export function nearEq(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps
}

/** Competition rank: ties share a rank; the next rank skips. No hidden key. */
export function competitionRank(values: Array<number | null>): number[] {
  const ranks: number[] = []
  let lastVal: number | null = null
  let lastRank = 0
  values.forEach((v, i) => {
    if (v != null && lastVal != null && nearEq(v, lastVal)) {
      ranks.push(lastRank)
      return
    }
    lastRank = i + 1
    lastVal = v
    ranks.push(lastRank)
  })
  return ranks
}

export function weightsMatch(a: Weights, b: Weights): boolean {
  return CRITERIA.every((id) => a[id] === b[id])
}

export function activeShare(weights: Weights, id: CriterionId): number | null {
  const sum = CRITERIA.reduce((n, k) => n + (weights[k] > 0 ? weights[k] : 0), 0)
  if (sum <= 0 || weights[id] <= 0) return null
  return weights[id] / sum
}

export function fmt1(n: number): string {
  return (Math.round(n * 10 + Number.EPSILON) / 10).toFixed(1)
}

export function fmtScore(n: number | null): string {
  if (n == null) return 'unknown'
  if (Math.abs(n - Math.round(n)) < 0.05) return String(Math.round(n))
  return fmt1(n)
}

export function fmtPct(n: number | null): string {
  if (n == null) return '—'
  const pct = n * 100
  if (Math.abs(pct - Math.round(pct)) < 0.05) return `${Math.round(pct)}%`
  return `${fmt1(pct)}%`
}

export function fmtMinutes(n: number | null): string | null {
  if (n == null) return null
  return `${n} min`
}
