import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { MapPane, type EdgePad, type PinHover } from './MapPane'
import {
  ADA_PHONE,
  CLOSED_DAYS,
  GOOGLE_CAL,
  HOME,
  ICS_HTTPS,
  SEASON_END,
  SEASON_START,
  STORYTIMES_INDEX,
  WEBCAL,
} from './lib/constants'
import { defaultDay, FILTERS, matchesFilter } from './lib/filters'
import { eventPoint, formatMiles, miles, sortByDistance, sortByTime } from './lib/geo'
import { dayKey, formatLongDay, formatRange, formatShortDay, monthShort, seasonDays, weekdayNarrow } from './lib/when'
import type { BranchInfo, FilterId, Gap, StoryEvent } from './lib/types'

type SortId = 'time' | 'distance'

const MONTHS = [
  { y: 2026, m: 9, label: 'September' },
  { y: 2026, m: 10, label: 'October' },
  { y: 2026, m: 11, label: 'November' },
]

const DAYS = seasonDays(SEASON_START, SEASON_END)

const REST_PAD: EdgePad = { top: 40, right: 52, bottom: 36, left: 24 }

function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function shortBranch(name: string): string {
  return name.replace(/ Branch$/, '').replace('Hampton Branch at Oak Hill', 'Hampton @ Oak Hill')
}

function tipStyle(x: number, y: number): CSSProperties {
  const inset = 10
  const half = 88
  const left = Math.min(Math.max(x, inset + half), window.innerWidth - inset - half)
  const flip = y < 88
  return {
    left,
    top: y,
    transform: flip ? 'translate(-50%, 10px)' : 'translate(-50%, calc(-100% - 10px))',
  }
}

function padFromChrome(el: HTMLElement | null): EdgePad {
  if (!el) return REST_PAD
  const r = el.getBoundingClientRect()
  const w = window.innerWidth
  const h = window.innerHeight
  const gap = 14
  const leftDock = r.left < 48 && r.width < w * 0.55 && r.height > h * 0.5
  if (leftDock) {
    return { top: 36, right: 52, bottom: 36, left: Math.min(Math.round(r.right + gap), w - 120) }
  }
  const sheetH = Math.min(r.height, 304)
  return {
    top: 40,
    right: 52,
    bottom: Math.max(36, Math.round(sheetH + gap)),
    left: 20,
  }
}

export default function App() {
  const [events, setEvents] = useState<StoryEvent[]>([])
  const [branches, setBranches] = useState<Record<string, BranchInfo>>({})
  const [gaps, setGaps] = useState<Gap[]>([])
  const [day, setDay] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterId>('all')
  const [branch, setBranch] = useState<string | null>(null)
  const [eventId, setEventId] = useState<string | null>(null)
  const [sort, setSort] = useState<SortId>('time')
  const [hover, setHover] = useState<PinHover | null>(null)
  const [calOpen, setCalOpen] = useState(false)
  const [seasonOpen, setSeasonOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [boot, setBoot] = useState(true)
  const [edgePad, setEdgePad] = useState<EdgePad>(REST_PAD)
  const calWrap = useRef<HTMLDivElement>(null)
  const chromeRef = useRef<HTMLDivElement>(null)
  const dragY = useRef<number | null>(null)

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
      if (params.get('s') === 'distance') setSort('distance')
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
    if (sort === 'distance') u.searchParams.set('s', 'distance')
    else u.searchParams.delete('s')
    history.replaceState(null, '', u)
  }, [day, filter, branch, eventId, sort, boot])

  useEffect(() => {
    if (!calOpen) return
    const onPtr = (e: PointerEvent) => {
      if (!calWrap.current?.contains(e.target as Node)) setCalOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCalOpen(false)
    }
    document.addEventListener('pointerdown', onPtr)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPtr)
      document.removeEventListener('keydown', onKey)
    }
  }, [calOpen])

  useEffect(() => {
    if (!seasonOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSeasonOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [seasonOpen])

  useLayoutEffect(() => {
    const el = chromeRef.current
    const sync = () => setEdgePad(padFromChrome(chromeRef.current))
    sync()
    const ro = new ResizeObserver(sync)
    if (el) ro.observe(el)
    window.addEventListener('resize', sync)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', sync)
    }
  }, [boot, day])

  useEffect(() => {
    if (!eventId) return
    document.getElementById(`ev-${eventId}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [eventId, day, expanded])

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

  const dayEvents = useMemo(() => {
    if (!day) return []
    const list = events.filter((e) => dayKey(e.start) === day && matchesFilter(e, filter))
    const cmp = sort === 'distance' ? (a: StoryEvent, b: StoryEvent) => sortByDistance(HOME, a, b) : sortByTime
    return [...list].sort(cmp)
  }, [events, day, filter, sort])

  const selectedEvent = dayEvents.find((e) => e.nid === eventId) ?? null
  const gapBranches = useMemo(() => new Set(gaps.map((g) => g.branch)), [gaps])

  const nearest = useMemo(() => {
    let best: { name: string; mi: number } | null = null
    for (const ev of dayEvents) {
      const p = eventPoint(ev)
      if (!p) continue
      const mi = miles(HOME, p)
      if (!best || mi < best.mi) best = { name: ev.branch, mi }
    }
    return best
  }, [dayEvents])

  function pickDay(next: string) {
    setDay(next)
    setEventId(null)
    setBranch(null)
    setSeasonOpen(false)
  }

  function selectBranch(name: string | null) {
    if (!name || name === branch) {
      setBranch(null)
      setEventId(null)
      return
    }
    setBranch(name)
    const first = dayEvents.find((e) => e.branch === name)
    setEventId(first?.nid ?? null)
    setExpanded(true)
  }

  function toggleEvent(ev: StoryEvent) {
    if (ev.nid === eventId) {
      setEventId(null)
      setBranch(null)
      return
    }
    setEventId(ev.nid)
    setBranch(ev.branch)
  }

  function onHandlePointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    dragY.current = e.clientY
  }

  function onHandlePointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const start = dragY.current
    dragY.current = null
    if (start == null) return
    const dy = e.clientY - start
    if (dy < -28) setExpanded(true)
    else if (dy > 28) setExpanded(false)
    else setExpanded((v) => !v)
  }

  if (!day) {
    return <div className="boot">Loading the Fall 2026 storytimes…</div>
  }

  const unlocated = dayEvents.filter((e) => e.branch === 'Online')
  const located = dayEvents.filter((e) => e.branch !== 'Online')

  return (
    <div className={expanded ? 'app expanded' : 'app'}>
      <section className="map-wrap">
        <MapPane
          branches={branches}
          dayEvents={dayEvents}
          selectedBranch={branch}
          selectedEvent={selectedEvent}
          user={HOME}
          gapBranches={gapBranches}
          edgePad={edgePad}
          onSelectBranch={selectBranch}
          onHover={setHover}
        />
        {hover && (
          <div className="tip" style={tipStyle(hover.x, hover.y)} role="tooltip">
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
            <span className="lg home" /> home
            <span className="lg live" /> programs today
            <span className="lg mute" /> quiet
            <span className="lg gap" /> flyer only
          </p>
      </section>

      <div className="chrome" ref={chromeRef}>
        <button
          type="button"
          className="sheet-handle"
          aria-label={expanded ? 'Show more map' : 'Show more of the schedule'}
          aria-expanded={expanded}
          onPointerDown={onHandlePointerDown}
          onPointerUp={onHandlePointerUp}
        >
          <span />
        </button>

        <header className="top">
          <div className="brand">
            <h1>Storytime</h1>
            <p>Austin Public Library · 7 Sep–21 Nov 2026</p>
          </div>
          <div className="top-actions">
            <div className="cal-wrap" ref={calWrap}>
              <button
                type="button"
                className="text-btn primary"
                aria-expanded={calOpen}
                aria-haspopup="menu"
                onClick={() => setCalOpen((v) => !v)}
              >
                <span className="label-wide">Add to calendar</span>
                <span className="label-narrow">Subscribe</span>
              </button>
              {calOpen && (
                <div className="cal-menu" role="menu">
                  <a href={WEBCAL} role="menuitem">
                    Apple Calendar
                  </a>
                  <a href={GOOGLE_CAL} role="menuitem">
                    Google Calendar
                  </a>
                  <a href={`${import.meta.env.BASE_URL}storytime.ics`} download role="menuitem">
                    Download .ics
                  </a>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="lede-row">
          <div className="lede-text">
            <h2>
              <span className="lede-long">{formatLongDay(day)}</span>
              <span className="lede-short">{formatShortDay(day)}</span>
            </h2>
            <p>
              {dayEvents.length} program{dayEvents.length === 1 ? '' : 's'}
              {nearest ? ` · ${shortBranch(nearest.name)} ${formatMiles(nearest.mi)}` : ''}
              {CLOSED_DAYS.has(day) ? ' · libraries closed' : ''}
            </p>
          </div>
          <div className="sort" role="group" aria-label="Order">
            <button
              type="button"
              className={sort === 'time' ? 'chip on' : 'chip'}
              aria-pressed={sort === 'time'}
              onClick={() => setSort('time')}
            >
              Time
            </button>
            <button
              type="button"
              className={sort === 'distance' ? 'chip on' : 'chip'}
              aria-pressed={sort === 'distance'}
              onClick={() => setSort('distance')}
            >
              Distance
            </button>
          </div>
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

        <div className="sheet-scroll">
          <DayRail
            counts={counts}
            max={maxCount}
            selected={day}
            onSelect={pickDay}
            onOpenSeason={() => setSeasonOpen(true)}
          />
          <div className="season-desktop">
            <SeasonGrid counts={counts} max={maxCount} selected={day} onSelect={pickDay} />
          </div>
          <ol className="events">
            {located.length === 0 && unlocated.length === 0 && (
              <li className="empty">No programs this day for the current filter.</li>
            )}
            {located.map((ev) => (
              <EventRow
                key={ev.nid}
                ev={ev}
                open={ev.nid === eventId}
                here={ev.branch === branch}
                home={HOME}
                info={branches[ev.branch]}
                onToggle={() => toggleEvent(ev)}
              />
            ))}
            {unlocated.length > 0 && <li className="online-head">Online</li>}
            {unlocated.map((ev) => (
              <EventRow
                key={ev.nid}
                ev={ev}
                open={ev.nid === eventId}
                here={false}
                home={null}
                info={branches[ev.branch]}
                onToggle={() => toggleEvent(ev)}
              />
            ))}
          </ol>
          <footer>
            Unofficial map of dated Austin Public Library storytimes (
            {SEASON_START.slice(5)} to {SEASON_END.slice(5).replace('-', '/')}). Confirm at{' '}
            <a href={STORYTIMES_INDEX}>library.austintexas.gov</a>. ADA: {ADA_PHONE}. ICS:{' '}
            <a href={ICS_HTTPS}>{ICS_HTTPS}</a>
          </footer>
        </div>
      </div>

      {seasonOpen && (
        <div className="season-overlay" role="dialog" aria-modal="true" aria-label="Season calendar">
          <div className="season-overlay-bar">
            <strong>Fall 2026</strong>
            <button type="button" className="text-btn primary" onClick={() => setSeasonOpen(false)}>
              Done
            </button>
          </div>
          <SeasonGrid counts={counts} max={maxCount} selected={day} onSelect={pickDay} />
        </div>
      )}
    </div>
  )
}

function DayRail({
  counts,
  max,
  selected,
  onSelect,
  onOpenSeason,
}: {
  counts: Map<string, number>
  max: number
  selected: string
  onSelect: (d: string) => void
  onOpenSeason: () => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const idx = DAYS.indexOf(selected)

  useLayoutEffect(() => {
    const btn = scroller.current?.querySelector<HTMLElement>(`[data-day="${selected}"]`)
    btn?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [selected])

  function step(dir: -1 | 1) {
    const next = DAYS[idx + dir]
    if (next) onSelect(next)
  }

  return (
    <div className="day-rail">
      <button type="button" className="rail-nav" aria-label="Previous day" disabled={idx <= 0} onClick={() => step(-1)}>
        ‹
      </button>
      <div className="day-strip" ref={scroller} role="listbox" aria-label="Day">
        {DAYS.map((key) => {
          const c = counts.get(key) ?? 0
          const closed = CLOSED_DAYS.has(key)
          const t = 0.08 + (c / max) * 0.82
          const mark = key.endsWith('-01') || key === SEASON_START
          return (
            <button
              key={key}
              type="button"
              role="option"
              data-day={key}
              aria-selected={key === selected}
              aria-label={`${formatLongDay(key)}${closed ? ', libraries closed' : `, ${c} programs`}`}
              className={`strip-day${key === selected ? ' sel' : ''}${closed ? ' closed' : ''}`}
              style={{ background: `rgba(26, 22, 18, ${c ? t : 0.04})` }}
              onClick={() => onSelect(key)}
            >
              {mark && <span className="strip-mo">{monthShort(key)}</span>}
              <span className="strip-wd">{weekdayNarrow(key)}</span>
              <span className="strip-n">{Number(key.slice(8))}</span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        className="rail-nav"
        aria-label="Next day"
        disabled={idx < 0 || idx >= DAYS.length - 1}
        onClick={() => step(1)}
      >
        ›
      </button>
      <button type="button" className="season-launch" onClick={onOpenSeason}>
        Season
      </button>
    </div>
  )
}

function EventRow({
  ev,
  open,
  here,
  home,
  info,
  onToggle,
}: {
  ev: StoryEvent
  open: boolean
  here: boolean
  home: { lat: number; lon: number } | null
  info?: BranchInfo
  onToggle: () => void
}) {
  const pt = eventPoint(ev)
  const dist = home && pt ? formatMiles(miles(home, pt)) : null
  const cls = `ev${open ? ' open' : ''}${here ? ' here' : ''}`
  return (
    <li id={`ev-${ev.nid}`} className={cls}>
      <button type="button" className="ev-main" onClick={onToggle} aria-expanded={open}>
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
              <a href={`https://maps.apple.com/?daddr=${pt.lat},${pt.lon}&q=${encodeURIComponent(ev.branch)}`}>
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
              aria-label={
                inSeason
                  ? `${formatLongDay(key)}${closed ? ', libraries closed' : `, ${c} programs`}`
                  : undefined
              }
              onClick={() => onSelect(key)}
              onPointerEnter={(e) => {
                if (!inSeason || e.pointerType === 'touch') return
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
        <div className="tip" style={tipStyle(tip.x, tip.y)} role="tooltip">
          <strong>{tip.label}</strong>
          <span>{tip.detail}</span>
          <em>Source: dated APL listings</em>
        </div>
      )}
    </div>
  )
}
