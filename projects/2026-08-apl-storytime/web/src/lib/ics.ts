import { ADA_PHONE } from './constants'
import type { StoryEvent } from './types'

function utc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function esc(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function fold(line: string): string {
  const parts: string[] = []
  let rest = line
  while (rest.length > 73) {
    parts.push(rest.slice(0, 73))
    rest = rest.slice(73)
  }
  parts.push(rest)
  return parts.join('\r\n ')
}

function vevent(ev: StoryEvent, stamp: string): string[] {
  const location = [ev.branch, ev.room, ev.address].filter(Boolean).join(', ')
  const desc = [
    ev.title === ev.program ? ev.title : `${ev.title} — ${ev.program}`,
    'Confirm before you go; programs move or cancel.',
    ev.url,
    `ADA accommodations: ${ADA_PHONE}`,
  ].join('\n')
  return [
    'BEGIN:VEVENT',
    `UID:apl-storytime-${ev.nid}@tuchel.github.io`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${utc(ev.start)}`,
    `DTEND:${utc(ev.end)}`,
    `SUMMARY:${esc(`${ev.title} — ${ev.branch}`)}`,
    `LOCATION:${esc(location)}`,
    `DESCRIPTION:${esc(desc)}`,
    `URL:${ev.url}`,
    'END:VEVENT',
  ]
}

/** Programs as one calendar file. Each UID matches that program's UID in the subscription feed. */
export function eventsIcs(events: StoryEvent[]): string {
  const stamp = utc(new Date().toISOString())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//tuchel-general//APL Storytime Fall 2026//EN',
    'METHOD:PUBLISH',
    ...events.flatMap((ev) => vevent(ev, stamp)),
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function downloadIcs(events: StoryEvent[]): void {
  if (!events.length) return
  const blob = new Blob([eventsIcs(events)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = events.length === 1 ? `storytime-${events[0].nid}.ics` : `storytimes-${events.length}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}
