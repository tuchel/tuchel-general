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

export function formatShortDay(iso: string): string {
  return shortDay.format(new Date(iso))
}

export function formatTime(iso: string): string {
  return timeFmt.format(new Date(iso))
}

export function formatRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}
