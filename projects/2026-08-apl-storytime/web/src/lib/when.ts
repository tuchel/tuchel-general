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
    const [y, m, d] = k.split('-').map(Number)
    k = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
  }
  return out
}

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso))
}

export function formatRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}
