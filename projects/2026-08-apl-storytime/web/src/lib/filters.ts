import { chicagoToday } from './when'
import type { FilterId, StoryEvent } from './types'

export const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'babies', label: 'Babies' },
  { id: 'toddler', label: 'Toddler' },
  { id: 'preschool', label: 'Preschool' },
  { id: 'allages', label: 'All ages' },
  { id: 'pajama', label: 'Pajama' },
  { id: 'language', label: 'Language' },
  { id: 'music', label: 'Music' },
  { id: 'online', label: 'Online' },
]

export function matchesFilter(ev: StoryEvent, id: FilterId): boolean {
  if (id === 'all') return true
  if (id === 'online') return ev.branch === 'Online'
  if (id === 'babies') return ev.program === 'Books and Babies'
  if (id === 'toddler') return ev.program.includes('Toddler')
  if (id === 'preschool') return ev.program.includes('Preschool')
  if (id === 'allages') return ev.program === 'All Ages Storytime'
  if (id === 'pajama') return ev.program.includes('Pajama')
  if (id === 'music') return /music/i.test(ev.program)
  if (id === 'language') {
    return /spanish|french|japanese|mandarin|portuguese|hora de cuentos/i.test(ev.program)
  }
  return true
}

export function defaultDay(daysWithEvents: string[]): string {
  const today = chicagoToday()
  const sorted = [...daysWithEvents].sort()
  if (sorted.includes(today)) return today
  return sorted.find((d) => d >= today) ?? sorted[sorted.length - 1] ?? today
}

export function pinSize(count: number): number {
  if (count <= 0) return 10
  return Math.min(28, 12 + Math.round(Math.sqrt(count) * 6))
}
