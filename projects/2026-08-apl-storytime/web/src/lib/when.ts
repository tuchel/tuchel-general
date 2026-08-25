import { TZ } from './constants'

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const longDay = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

const shortDay = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

const narrowWeekday = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  weekday: 'narrow',
})

const monthAbbrev = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  month: 'short',
})

const monthLong = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  month: 'long',
})

const timeFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour: 'numeric',
  minute: '2-digit',
})

export function chicagoToday(): string {
  return dayFmt.format(new Date())
}

export function dayKey(iso: string): string {
  return dayFmt.format(new Date(iso))
}

export function formatLongDay(isoOrDay: string): string {
  const d = isoOrDay.length <= 10 ? new Date(`${isoOrDay}T12:00:00-05:00`) : new Date(isoOrDay)
  return longDay.format(d)
}

export function formatShortDay(isoOrDay: string): string {
  const d = isoOrDay.length <= 10 ? new Date(`${isoOrDay}T12:00:00-05:00`) : new Date(isoOrDay)
  return shortDay.format(d)
}

export function weekdayNarrow(day: string): string {
  return narrowWeekday.format(new Date(`${day}T12:00:00-05:00`))
}

export function monthShort(day: string): string {
  return monthAbbrev.format(new Date(`${day}T12:00:00-05:00`))
}

export function seasonDays(start: string, end: string): string[] {
  const out: string[] = []
  let k = start
  while (k <= end) {
    out.push(k)
    k = addDays(k, 1)
  }
  return out
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export function sundayOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return addDays(day, -new Date(Date.UTC(y, m - 1, d)).getUTCDay())
}

export function weekDays(sunday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(sunday, i))
}

export function weekLabel(sunday: string): string {
  const a = sunday
  const b = addDays(sunday, 6)
  const ad = Number(a.slice(8))
  const bd = Number(b.slice(8))
  const am = monthShort(a)
  const bm = monthShort(b)
  if (am === bm) return `${am} ${ad}–${bd}`
  return `${am} ${ad} – ${bm} ${bd}`
}

export function monthName(day: string): string {
  return monthLong.format(new Date(`${day}T12:00:00-05:00`))
}

export function weekMonthLabel(sunday: string): string {
  const end = addDays(sunday, 6)
  const a = monthName(sunday)
  const b = monthName(end)
  if (a === b) return a
  return `${monthShort(sunday)}–${monthShort(end)}`
}

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso))
}

export function formatRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}
