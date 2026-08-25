import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { MapPane, type PinHover } from './MapPane'
import {
  ADA_PHONE,
  CLOSED_DAYS,
  GOOGLE_CAL,
  ICS_HTTPS,
  SEASON_END,
  SEASON_START,
  STORYTIMES_INDEX,
  WEBCAL,
} from './lib/constants'
import { defaultDay, FILTERS, matchesFilter } from './lib/filters'
import { eventPoint, formatMiles, miles } from './lib/geo'
import { dayKey, formatLongDay, formatRange } from './lib/when'
import type { BranchInfo, FilterId, Gap, LonLat, StoryEvent } from './lib/types'

const MONTHS = [
  { y: 2026, m: 9, label: 'September' },
  { y: 2026, m: 10, label: 'October' },
  { y: 2026, m: 11, label: 'November' },
]

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function shortBranch(name: string): string {
  return name.replace(/ Branch$/, '').replace('Hampton Branch at Oak Hill', 'Hampton @ Oak Hill')
}

export default function App() {
  const [events, setEvents] = useState<StoryEvent[]>([])
  const [branches, setBranches] = useState<Record<string, BranchInfo>>({})
  const [gaps, setGaps] = useState<Gap[]>([])
  const [day, setDay] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterId>('all')
  const [branch, setBranch] = useState<string | null>(null)
  const [eventId, setEventId] = useState<string | null>(null)
  const [user, setUser] = useState<LonLat | null>(null)
  const [geoMsg, setGeoMsg] = useState<string | null>(null)
  const [hover, setHover] = useState<PinHover | null>(null)
  const [calOpen, setCalOpen] = useState(false)
  const [boot, setBoot] = useState(true)

  useEffect(() => {
    const base = import.meta.env.BASE_URL
    Promise.all([
      fetch(`${base}events.json`).then((r) => r.json() as Promise<StoryEvent[]>),
      fetch(`${base}branches.json`).then((r) => r.json() as Promise<Record<string, BranchInfo>>),
      fetch(`${base}gaps.json`).then((r) => r.json() as Promise<Gap[]>),
    ]).then(([ev, br, gp]) => {
      setEvents(ev)
      setBranches(br)
      setGaps(gp)
      const params = new URLSearchParams(window.location.search)
      const days = [...new Set(ev.map((e) => dayKey(e.start)))].sort()
      setDay(params.get('d') && days.includes(params.get('d')!) ? params.get('d') : defaultDay(days))
      const f = params.get('f') as FilterId | null
      if (f && FILTERS.some((x) => x.id === f)) setFilter(f)
      if (params.get('b')) setBranch(params.get('b'))
      if (params.get('e')) setEventId(params.get('e'))
      setBoot(false)
    })
  }, [])

  useEffect(() => {
    if (boot || !day) return
    const u = new URL(window.location.href)
    u.searchParams.set('d', day)
    if (filter !== 'all') u.searchParams.set('f', filter)
    else u.searchParams.delete('f')
    if (branch) u.searchParams.set('b', branch)
    else u.searchParams.delete('b')
    if (eventId) u.searchParams.set('e', eventId)
    else u.searchParams.delete('e')
    history.replaceState(null, '', u)
  }, [day, filter, branch, eventId, boot])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const ev of events) {
      if (!matchesFilter(ev, filter)) continue
      const k = dayKey(ev.start)
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [events, filter])

  const maxCount = useMemo(() => Math.max(1, ...counts.values()), [counts])

  const mapEvents = useMemo(() => {
    if (!day) return []
    return events.filter((e) => dayKey(e.start) === day && matchesFilter(e, filter))
  }, [events, day, filter])

  const dayEvents = useMemo(() => {
    let list = branch ? mapEvents.filter((e) => e.branch === branch) : mapEvents
    if (user) {
      list = [...list].sort((a, b) => {
        const pa = eventPoint(a)
        const pb = eventPoint(b)
        const da = pa ? miles(user, pa) : 1e9
        const db = pb ? miles(user, pb) : 1e9
        if (da !== db) return da - db
        return a.start.localeCompare(b.start)
      })
    } else {
      list = [...list].sort((a, b) => a.start.localeCompare(b.start) || a.branch.localeCompare(b.branch))
    }
    return list
  }, [mapEvents, branch, user])

  const selectedEvent = dayEvents.find((e) => e.nid === eventId) ?? null
  const gapBranches = useMemo(() => new Set(gaps.map((g) => g.branch)), [gaps])

  const nearest = useMemo(() => {
    if (!user) return null
    let best: { name: string; mi: number } | null = null
    for (const ev of dayEvents) {
      const p = eventPoint(ev)
      if (!p) continue
      const mi = miles(user, p)
      if (!best || mi < best.mi) best = { name: ev.branch, mi }
    }
    return best
  }, [dayEvents, user])

  function locate() {
    if (!navigator.geolocation) {
      setGeoMsg('Location is not available in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUser({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setGeoMsg(null)
      },
      () => setGeoMsg('Location permission denied — the list stays in clock order.'),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  if (!day) {
    return <div className="boot">Loading the Fall 2026 storytimes…</div>
  }

  const unlocated = dayEvents.filter((e) => e.branch === 'Online')
  const located = dayEvents.filter((e) => e.branch !== 'Online')

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>Storytime</h1>
          <p>Austin Public Library · 7 Sep–21 Nov 2026</p>
        </div>
        <div className="top-actions">
          <button type="button" className={user ? 'text-btn on' : 'text-btn'} onClick={locate}>
            Near me
          </button>
          <div className="cal-wrap">
            <button type="button" className="text-btn primary" onClick={() => setCalOpen((v) => !v)}>
              Add to calendar
            </button>
            {calOpen && (
              <div className="cal-menu">
                <a href={WEBCAL}>Apple Calendar</a>
                <a href={GOOGLE_CAL}>Google Calendar</a>
                <a href={`${import.meta.env.BASE_URL}storytime.ics`} download>
                  Download .ics
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="lede-row">
        <h2>{formatLongDay(day)}</h2>
        <p>
          {dayEvents.length} program{dayEvents.length === 1 ? '' : 's'}
          {branch ? ` at ${shortBranch(branch)}` : ''}
          {nearest ? ` · nearest ${formatMiles(nearest.mi)}` : ''}
          {CLOSED_DAYS.has(day) ? ' · libraries closed' : ''}
        </p>
        {geoMsg && <p className="note">{geoMsg}</p>}
      </div>

      <div className="filters" role="tablist" aria-label="Program type">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            className={filter === f.id ? 'chip on' : 'chip'}
            onClick={() => {
              setFilter(f.id)
              setEventId(null)
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="workspace">
        <aside className="sheet">
          <SeasonGrid
            counts={counts}
            max={maxCount}
            selected={day}
            onSelect={(d) => {
              setDay(d)
              setEventId(null)
            }}
          />
          {branch && (
            <button type="button" className="clear" onClick={() => setBranch(null)}>
              Showing {shortBranch(branch)} · clear
            </button>
          )}
          <ol className="events">
            {located.length === 0 && unlocated.length === 0 && (
              <li className="empty">No programs this day for the current filter.</li>
            )}
            {located.map((ev) => (
              <EventRow
                key={ev.nid}
                ev={ev}
                open={ev.nid === eventId}
                user={user}
                info={branches[ev.branch]}
                onToggle={() => {
                  setEventId(ev.nid === eventId ? null : ev.nid)
                  setBranch(ev.branch)
                }}
              />
            ))}
            {unlocated.length > 0 && (
              <li className="online-head">Online</li>
            )}
            {unlocated.map((ev) => (
              <EventRow
                key={ev.nid}
                ev={ev}
                open={ev.nid === eventId}
                user={null}
                info={branches[ev.branch]}
                onToggle={() => setEventId(ev.nid === eventId ? null : ev.nid)}
              />
            ))}
          </ol>
        </aside>
        <section className="map-wrap">
          <MapPane
            branches={branches}
            dayEvents={mapEvents}
            selectedBranch={branch}
            selectedEvent={selectedEvent}
            user={user}
            gapBranches={gapBranches}
            onSelectBranch={(name) => {
              setBranch((cur) => (cur === name ? null : name))
              setEventId(null)
            }}
            onHover={setHover}
          />
          {hover && (
            <div className="tip" style={{ left: hover.x, top: hover.y }} role="tooltip">
              <strong>{shortBranch(hover.branch)}</strong>
              <span>
                {hover.count
                  ? `${hover.count} program${hover.count === 1 ? '' : 's'} today`
                  : hover.gap
                    ? 'On the flyer; no dated listing this season'
                    : 'No program today'}
              </span>
              {hover.next && <span>Next: {hover.next}</span>}
              <em>Source: APL event listings</em>
            </div>
          )}
          <p className="map-legend">
            <span className="lg live" /> programs today
            <span className="lg mute" /> quiet
            <span className="lg gap" /> flyer only
          </p>
        </section>
      </div>

      <footer>
        Unofficial map of dated Austin Public Library storytimes
        ({SEASON_START.slice(5)} to {SEASON_END.slice(5).replace('-', '/')}). Confirm at{' '}
        <a href={STORYTIMES_INDEX}>library.austintexas.gov</a>. ADA: {ADA_PHONE}. ICS:{' '}
        <a href={ICS_HTTPS}>{ICS_HTTPS}</a>
      </footer>
    </div>
  )
}

function EventRow({
  ev,
  open,
  user,
  info,
  onToggle,
}: {
  ev: StoryEvent
  open: boolean
  user: LonLat | null
  info?: BranchInfo
  onToggle: () => void
}) {
  const pt = eventPoint(ev)
  const dist = user && pt ? formatMiles(miles(user, pt)) : null
  return (
    <li className={open ? 'ev open' : 'ev'}>
      <button type="button" className="ev-main" onClick={onToggle}>
        <span className="ev-time">{formatRange(ev.start, ev.end)}</span>
        <span className="ev-title">{ev.title}</span>
        <span className="ev-meta">
          {shortBranch(ev.branch)}
          {dist ? ` · ${dist}` : ''}
          {` · ${ev.ages}`}
        </span>
      </button>
      {open && (
        <div className="ev-detail">
          <p>
            {ev.program}
            {ev.room ? ` · ${ev.room}` : ''}
          </p>
          {ev.address && <p>{ev.address}</p>}
          <p className="links">
            <a href={ev.url} target="_blank" rel="noreferrer">
              APL listing
            </a>
            {pt && (
              <a
                href={`https://maps.apple.com/?daddr=${pt.lat},${pt.lon}&q=${encodeURIComponent(ev.branch)}`}
              >
                Directions
              </a>
            )}
            {info?.phone && <a href={`tel:${info.phone.replace(/\D/g, '')}`}>{info.phone}</a>}
            {info?.url && (
              <a href={info.url} target="_blank" rel="noreferrer">
                Branch
              </a>
            )}
          </p>
        </div>
      )}
    </li>
  )
}

function SeasonGrid({
  counts,
  max,
  selected,
  onSelect,
}: {
  counts: Map<string, number>
  max: number
  selected: string
  onSelect: (d: string) => void
}) {
  const [tip, setTip] = useState<{ x: number; y: number; label: string; detail: string } | null>(null)
  return (
    <div className="season">
      {MONTHS.map((mo) => {
        const lead = new Date(Date.UTC(mo.y, mo.m - 1, 1, 18, 0, 0)).getUTCDay()
        const n = daysInMonth(mo.y, mo.m)
        const cells: ReactNode[] = []
        for (let i = 0; i < lead; i++) cells.push(<span key={`e${i}`} className="cell empty" />)
        for (let d = 1; d <= n; d++) {
          const key = `${mo.y}-${pad(mo.m)}-${pad(d)}`
          const inSeason = key >= SEASON_START && key <= SEASON_END
          const c = counts.get(key) ?? 0
          const closed = CLOSED_DAYS.has(key)
          const t = inSeason ? 0.08 + (c / max) * 0.82 : 0
          const hot = c / max > 0.45
          cells.push(
            <button
              key={key}
              type="button"
              disabled={!inSeason}
              className={`cell${key === selected ? ' sel' : ''}${closed ? ' closed' : ''}${hot ? ' hot' : ''}`}
              style={inSeason ? { background: `rgba(26, 22, 18, ${c ? t : 0.04})` } : undefined}
              onClick={() => onSelect(key)}
              onPointerEnter={(e) => {
                if (!inSeason) return
                const r = e.currentTarget.getBoundingClientRect()
                setTip({
                  x: r.left + r.width / 2,
                  y: r.top,
                  label: formatLongDay(key),
                  detail: closed
                    ? 'Libraries closed'
                    : `${c} program${c === 1 ? '' : 's'} · ink = count that day`,
                })
              }}
              onPointerLeave={() => setTip(null)}
            >
              {d}
            </button>,
          )
        }
        return (
          <div key={mo.label} className="month">
            <div className="month-label">{mo.label}</div>
            <div className="dow">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => (
                <span key={`${w}${i}`}>{w}</span>
              ))}
            </div>
            <div className="grid">{cells}</div>
          </div>
        )
      })}
      {tip && (
        <div className="tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          <strong>{tip.label}</strong>
          <span>{tip.detail}</span>
          <em>Source: dated APL listings</em>
        </div>
      )}
    </div>
  )
}

