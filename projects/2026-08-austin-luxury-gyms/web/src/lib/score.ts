import type { Flag, Gym, MustId, Weights } from './types'

export function hasFlag(v: Flag): boolean {
  return v === true || v === 'extra' || v === 'claimed'
}

export function inDues(v: Flag): boolean {
  return v === true || v === 'claimed'
}

export function contrast(g: Gym): boolean {
  return hasFlag(g.amenities.sauna) || hasFlag(g.amenities.steam) || hasFlag(g.amenities.coldPlunge)
}

export function matchesMust(g: Gym, must: MustId): boolean {
  if (must === 'pool') return inDues(g.amenities.pool)
  if (must === 'contrast') return contrast(g)
  if (must === 'kids') return hasFlag(g.amenities.kids)
  if (must === 'weekendEvening') return g.hours.weekendEvening
  if (must === 'travel') return hasFlag(g.amenities.travelNetwork)
  if (must === 'quotedPrice') return g.price.kind === 'quoted' && g.price.monthlyFrom != null
  if (must === 'noTimedGarage') return g.id !== 'equinox-austin'
  return true
}

export function driveMin(g: Gym, peak: boolean): number {
  return peak ? g.driveMin * 1.7 : g.driveMin
}

export function reviewMean(g: Gym): number | null {
  const scored = g.reviews.sources.filter((s) => s.score != null && s.n >= 5)
  if (!scored.length) return null
  const w = scored.reduce((a, s) => a + (s.score as number) * s.n, 0)
  const n = scored.reduce((a, s) => a + s.n, 0)
  return w / n
}

/** 0–1. Higher is better. Missing price scores 0.4 so unpublished clubs are not auto-eliminated. */
export function fitScore(g: Gym, w: Weights, peak: boolean, priceCap: number): number {
  const d = driveMin(g, peak)
  const commute = Math.max(0, 1 - d / 30)
  let price = 0.4
  if (g.price.monthlyFrom != null) {
    price = Math.max(0, 1 - g.price.monthlyFrom / Math.max(400, priceCap))
  }
  const recoveryBits = [
    g.amenities.sauna,
    g.amenities.steam,
    g.amenities.coldPlunge,
    g.amenities.spa,
  ].filter(hasFlag).length
  const recovery = recoveryBits / 4
  const familyBits = [g.amenities.kids, g.amenities.pool, g.amenities.pickleball, g.amenities.tennis].filter(
    hasFlag,
  ).length
  const family = familyBits / 4
  const hours = g.hours.weekendEvening ? 1 : 0.35
  const sum = w.commute + w.price + w.recovery + w.family + w.hours
  if (sum <= 0) return commute
  return (
    (w.commute * commute + w.price * price + w.recovery * recovery + w.family * family + w.hours * hours) / sum
  )
}

export function annualDues(g: Gym): number | null {
  return g.price.monthlyFrom == null ? null : g.price.monthlyFrom * 12
}

export function annualTimeCost(g: Gym, peak: boolean, visitsPerWeek: number, valuePerHour: number): number {
  const hours = (driveMin(g, peak) / 60) * 2 * visitsPerWeek * 52
  return hours * valuePerHour
}

export function allInAnnual(
  g: Gym,
  peak: boolean,
  visitsPerWeek: number,
  valuePerHour: number,
): number | null {
  const dues = annualDues(g)
  if (dues == null) return null
  return dues + annualTimeCost(g, peak, visitsPerWeek, valuePerHour)
}
