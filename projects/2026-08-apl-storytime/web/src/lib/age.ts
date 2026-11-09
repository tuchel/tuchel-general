import type { StoryEvent } from './types'

export type AgeId = 'babies' | 'toddler' | 'preschool' | 'mixed'

export const AGE_LABEL: Record<AgeId, string> = {
  babies: 'Babies · 0–12 mo',
  toddler: 'Toddlers · 1–3',
  preschool: 'Preschool · 3–5',
  mixed: 'Ages 0–5',
}

export function ageOf(ev: StoryEvent): AgeId {
  if (ev.ages.includes('months')) return 'babies'
  if (ev.ages.startsWith('1')) return 'toddler'
  if (ev.ages.startsWith('3')) return 'preschool'
  return 'mixed'
}
