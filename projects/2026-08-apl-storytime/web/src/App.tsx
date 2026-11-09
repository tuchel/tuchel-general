import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { MapPane } from './MapPane'
import { AGE_LABEL, ageOf } from './lib/age'
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
import { defaultDay, FILTERS, matchesAny } from './lib/filters'
import { eventPoint, formatMiles, miles, sortByDistance, sortByTime } from './lib/geo'
import { downloadIcs } from './lib/ics'
import { addDays, chicagoToday, dayKey, formatTime, monthName, seasonDays, weekdayNarrow } from './lib/when'
import type { BranchInfo, FilterId, Gap, StoryEvent } from './lib/types'

type SortId = 'time' | 'distance'
/** Free-flow drive from home per branch, from scripts/drive_times.py. */
type DriveTimes = Record<string, { minutes: number; road_miles: number }>
type View = 'list' | 'map'

const FILTER_KEY = 'storytime.filter'
const PICKS_KEY = 'storytime.picks'
const SEASON = seasonDays(SEASON_START, SEASON_END)
const MONTHS = [
  { y: 2026, m: 9 },
  { y: 2026, m: 10 },
  { y: 2026, m: 11 },
]
const LONG_WEEKDAY = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' })
const SHORT_WEEKDAY = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' })
const MONTH_DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric' })

function utcNoon(day: string): Date {
  return new Date(`${day}T12:00:00Z`)
}

export function shortBranch(name: string): string {
  return name.replace(/ Branch$/, '').replace('Hampton Branch at Oak Hill', 'Hampton at Oak Hill')
}

const FILTER_IDS = new Set<string>(FILTERS.map((f) => f.id).filter((id) => id !== 'all'))

/** Accepts "babies,toddler", a JSON array, or the older single id. */
function parseFilters(raw: string | null): FilterId[] {
  if (!raw) return []
  let parts: unknown = raw
  try {
    parts = JSON.parse(raw)
  } catch {
    /* comma list or a bare id */
  }
  const list = Array.isArray(parts) ? parts : String(parts).split(',')
  return [...new Set(list.map(String).filter((id) => FILTER_IDS.has(id)))] as FilterId[]
}

function readStoredFilters(): FilterId[] {
  try {
    return parseFilters(localStorage.getItem(FILTER_KEY))
  } catch {
    return []
  }
}

function storeFilters(ids: FilterId[]) {
  try {
    if (ids.length === 0) localStorage.removeItem(FILTER_KEY)
    else localStorage.setItem(FILTER_KEY, JSON.stringify(ids))
  } catch {
    /* private mode: filter simply isn't remembered */
  }
}

function readPicks(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(PICKS_KEY) ?? '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

function storePicks(ids: string[]) {
  try {
    if (ids.length) localStorage.setItem(PICKS_KEY, JSON.stringify(ids))
    else localStorage.removeItem(PICKS_KEY)
  } catch {
    /* private mode: picks last for this visit only */
  }
}

function untilLabel(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000))
  if (min < 60) return `in ${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `in ${h} hr ${m} min` : `in ${h} hr`
}

function durationLabel(ev: StoryEvent): string {
  const min = Math.round((Date.parse(ev.end) - Date.parse(ev.start)) / 60000)
  return min >= 60 && min % 60 === 0 ? `${min / 60} hr` : `${min} min`
}

function splitTime(iso: string): { clock: string; ampm: string } {
  const t = formatTime(iso)
  const [clock, ampm] = t.split(' ')
  return { clock, ampm: ampm ?? '' }
}

function dotsFor(count: number): number {
  if (count <= 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 8) return 3
  return 4
}

function directionsUrl(ev: StoryEvent): string | null {
  const pt = eventPoint(ev)
  if (!pt) return null
  return `https://maps.apple.com/?daddr=${pt.lat},${pt.lon}&q=${encodeURIComponent(ev.branch)}`
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    const wake = () => document.visibilityState === 'visible' && setNow(Date.now())
    document.addEventListener('visibilitychange', wake)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [])
  return now
}

export default function App() {
  const [events, setEvents] = useState<StoryEvent[]>([])
  const [branches, setBranches] = useState<Record<string, BranchInfo>>({})
  const [gaps, setGaps] = useState<Gap[]>([])
  const [day, setDay] = useState<string | null>(null)
  const [filters, setFiltersState] = useState<FilterId[]>([])
  const [drive, setDrive] = useState<DriveTimes>({})
  const [sort, setSort] = useState<SortId>('time')
  const [view, setView] = useState<View>('list')
  const [openId, setOpenId] = useState<string | null>(null)
  const [mapBranch, setMapBranch] = useState<string | null>(null)
  const [seasonOpen, setSeasonOpen] = useState(false)
  const [showEarlier, setShowEarlier] = useState(false)
  const [picks, setPicksState] = useState<string[]>(readPicks)
  const [picksOpen, setPicksOpen] = useState(false)
  const now = useNow()
  const today = useMemo(() => chicagoToday(), [now])

  useLayoutEffect(() => {
    const el = document.querySelector<HTMLElement>('.top')
    if (!el) return
    const sync = () =>
      document.documentElement.style.setProperty('--top-h', `${Math.round(el.getBoundingClientRect().height)}px`)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [day])

  useEffect(() => {
    const base = import.meta.env.BASE_URL
    Promise.all([
      fetch(`${base}events.json`).then((r) => r.json() as Promise<StoryEvent[]>),
      fetch(`${base}branches.json`).then((r) => r.json() as Promise<Record<string, BranchInfo>>),
      fetch(`${base}gaps.json`).then((r) => r.json() as Promise<Gap[]>),
      fetch(`${base}drive_times.json`)
        .then((r) => r.json() as Promise<{ branches: DriveTimes }>)
        .then((d) => d.branches)
        .catch(() => ({}) as DriveTimes),
    ]).then(([ev, br, gp, dt]) => {
      setEvents(ev)
      setDrive(dt)
      setBranches(br)
      setGaps(gp)
      const params = new URLSearchParams(window.location.search)
      const days = [...new Set(ev.map((e) => dayKey(e.start)))].sort()
      const linked = ev.find((e) => e.nid === params.get('e'))
      setDay(linked ? dayKey(linked.start) : defaultDay(days))
      if (linked) setOpenId(linked.nid)
      const fromUrl = parseFilters(params.get('f'))
      if (fromUrl.length) setFiltersState(fromUrl)
      else if (!linked) setFiltersState(readStoredFilters())
      if (params.get('s') === 'distance') setSort('distance')
    })
  }, [])

  useEffect(() => {
    if (!day) return
    const u = new URL(window.location.href)
    u.searchParams.delete('d')
    u.searchParams.delete('b')
    if (filters.length) u.searchParams.set('f', filters.join(','))
    else u.searchParams.delete('f')
    if (openId) u.searchParams.set('e', openId)
    else u.searchParams.delete('e')
    if (sort === 'distance') u.searchParams.set('s', 'distance')
    else u.searchParams.delete('s')
    history.replaceState(null, '', u)
  }, [day, filters, openId, sort])

  /** "All" clears; any other chip toggles on or off. */
  const toggleFilter = (id: FilterId) => {
    const next = id === 'all' ? [] : filters.includes(id) ? filters.filter((x) => x !== id) : [...filters, id]
    setFiltersState(next)
    storeFilters(next)
    setOpenId(null)
    setMapBranch(null)
  }

  const setPicks = (ids: string[]) => {
    setPicksState(ids)
    storePicks(ids)
  }
  const togglePick = (id: string) =>
    setPicks(picks.includes(id) ? picks.filter((x) => x !== id) : [...picks, id])
  const pickedEvents = useMemo(() => {
    const set = new Set(picks)
    return events.filter((e) => set.has(e.nid)).sort(sortByTime)
  }, [events, picks])

  const pickDay = useCallback((next: string) => {
    setDay(next)
    setOpenId(null)
    setMapBranch(null)
    setShowEarlier(false)
    setSeasonOpen(false)
    window.scrollTo({ top: 0 })
  }, [])

  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const ev of events) {
      if (!matchesAny(ev, filters)) continue
      const k = dayKey(ev.start)
      m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }, [events, filters])

  const dayEvents = useMemo(() => {
    if (!day) return []
    const list = events.filter((e) => dayKey(e.start) === day && matchesAny(e, filters))
    const mins = (e: StoryEvent) => drive[e.branch]?.minutes ?? Infinity
    const cmp =
      sort === 'distance'
        ? (a: StoryEvent, b: StoryEvent) => mins(a) - mins(b) || sortByDistance(HOME, a, b)
        : sortByTime
    return [...list].sort(cmp)
  }, [events, day, filters, sort, drive])

  useEffect(() => {
    if (!openId || view !== 'list') return
    const el = document.getElementById(`ev-${openId}`)
    if (!el) return
    const r = el.getBoundingClientRect()
    const top = document.querySelector('.top')?.getBoundingClientRect().bottom ?? 0
    if (r.top < top + 8 || r.bottom > window.innerHeight - 8) {
      window.scrollBy({ top: r.top - top - 12, behavior: 'smooth' })
    }
  }, [openId, view])

  if (!day) {
    return (
      <div className="boot" role="status">
        <span className="boot-dot" />
        Loading storytimes…
      </div>
    )
  }

  const isToday = day === today
  const closed = CLOSED_DAYS.has(day)
  const ended = isToday ? dayEvents.filter((e) => Date.parse(e.end) <= now) : []
  const endedIds = new Set(ended.map((e) => e.nid))
  const upcoming = dayEvents.filter((e) => !endedIds.has(e.nid))
  const nextStart = isToday
    ? Math.min(...upcoming.map((e) => Date.parse(e.start)).filter((t) => t > now))
    : Infinity

  const showOnMap = (ev: StoryEvent) => {
    setMapBranch(ev.branch === 'Online' ? null : ev.branch)
    setView('map')
    window.scrollTo({ top: 0 })
  }

  const openFromMap = (ev: StoryEvent) => {
    setView('list')
    setOpenId(ev.nid)
    if (endedIds.has(ev.nid)) setShowEarlier(true)
  }

  const step = (dir: -1 | 1) => {
    const next = addDays(day, dir)
    if (next >= SEASON_START && next <= SEASON_END) pickDay(next)
  }

  const card = (ev: StoryEvent) => (
    <EventCard
      key={ev.nid}
      ev={ev}
      open={ev.nid === openId}
      now={isToday ? now : null}
      next={Date.parse(ev.start) === nextStart}
      onToggle={() => setOpenId(ev.nid === openId ? null : ev.nid)}
      onMap={() => showOnMap(ev)}
      phone={branches[ev.branch]?.phone}
      picked={picks.includes(ev.nid)}
      driveMin={drive[ev.branch]?.minutes}
      onPick={() => togglePick(ev.nid)}
    />
  )

  return (
    <div className={`app view-${view}${pickedEvents.length ? ' has-picks' : ''}`}>
      <header className="top">
        <div className="title-row">
          <h1 className="day-title">
            <span className="day-big">
              {isToday ? 'Today' : day === addDays(today, 1) ? 'Tomorrow' : LONG_WEEKDAY.format(utcNoon(day))}
            </span>
            <span className="day-small">
              {isToday || day === addDays(today, 1) ? `${LONG_WEEKDAY.format(utcNoon(day))}, ` : ''}
              {MONTH_DAY.format(utcNoon(day))}
            </span>
          </h1>
          {!isToday && today >= SEASON_START && today <= SEASON_END && (
            <button type="button" className="pill-btn" onClick={() => pickDay(today)}>
              Today
            </button>
          )}
          <button
            type="button"
            className="icon-btn"
            aria-label="Season calendar"
            onClick={() => setSeasonOpen(true)}
          >
            <CalendarIcon />
          </button>
          <div className="seg" role="group" aria-label="View">
            <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
              <ListIcon />
              <span className="sr-only">List</span>
            </button>
            <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>
              <MapIcon />
              <span className="sr-only">Map</span>
            </button>
          </div>
        </div>
        <DayStrip counts={counts} selected={day} today={today} onSelect={pickDay} />
        <div className="chips" role="group" aria-label="Who it’s for">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className="chip"
              aria-pressed={f.id === 'all' ? filters.length === 0 : filters.includes(f.id)}
              onClick={() => toggleFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {view === 'list' && (
        <main className="list" {...swipeHandlers(step)}>
          <div className="summary">
            <p>
              {closed && dayEvents.length === 0 ? (
                'Libraries closed'
              ) : (
                <strong>
                  {dayEvents.length} storytime{dayEvents.length === 1 ? '' : 's'}
                </strong>
              )}
            </p>
            {dayEvents.length > 1 && (
              <div className="sort" role="group" aria-label="Order">
                <button type="button" aria-pressed={sort === 'time'} onClick={() => setSort('time')}>
                  Time
                </button>
                <button type="button" aria-pressed={sort === 'distance'} onClick={() => setSort('distance')}>
                  Nearest
                </button>
              </div>
            )}
          </div>

          {dayEvents.length === 0 && (
            <div className="empty">
              <p>{closed ? 'Libraries are closed today.' : 'Nothing for these filters on this day.'}</p>
              {filters.length > 0 && (
                <button type="button" className="pill-btn" onClick={() => toggleFilter('all')}>
                  Show all storytimes
                </button>
              )}
            </div>
          )}

          {ended.length > 0 && (
            <section className="earlier">
              <button
                type="button"
                className="earlier-toggle"
                aria-expanded={showEarlier}
                onClick={() => setShowEarlier((v) => !v)}
              >
                <span>
                  {ended.length} ended earlier today
                </span>
                <Chevron open={showEarlier} />
              </button>
              {showEarlier && <ol className="cards past">{ended.map(card)}</ol>}
            </section>
          )}

          {upcoming.length > 0 && <ol className="cards">{upcoming.map(card)}</ol>}

          {isToday && ended.length > 0 && upcoming.length === 0 && (
            <div className="empty">
              <p>That’s it for today.</p>
              {addDays(day, 1) <= SEASON_END && (
                <button type="button" className="pill-btn" onClick={() => pickDay(addDays(day, 1))}>
                  See tomorrow
                </button>
              )}
            </div>
          )}

          <Subscribe />
          <Footer gaps={gaps} />
        </main>
      )}

      <MapView
        active={view === 'map'}
        branches={branches}
        dayEvents={dayEvents}
        selected={mapBranch}
        onSelect={setMapBranch}
        onOpen={openFromMap}
        drive={drive}
        now={isToday ? now : null}
      />

      {pickedEvents.length > 0 && (
        <div className="pick-bar" role="region" aria-label="Picked storytimes">
          <button type="button" className="pick-count" onClick={() => setPicksOpen(true)}>
            <b>{pickedEvents.length}</b> picked
            <Chevron open side />
          </button>
          <button type="button" className="act primary" onClick={() => downloadIcs(pickedEvents)}>
            <PlusIcon /> Add to calendar
          </button>
        </div>
      )}

      {picksOpen && (
        <PicksSheet
          events={pickedEvents}
          onRemove={togglePick}
          onClear={() => {
            setPicks([])
            setPicksOpen(false)
          }}
          onAdd={() => downloadIcs(pickedEvents)}
          onClose={() => setPicksOpen(false)}
        />
      )}

      {seasonOpen && (
        <SeasonSheet
          counts={counts}
          selected={day}
          today={today}
          onSelect={pickDay}
          onClose={() => setSeasonOpen(false)}
        />
      )}
    </div>
  )
}

function swipeHandlers(step: (dir: -1 | 1) => void) {
  let x0 = 0
  let y0 = 0
  let t0 = 0
  let ok = false
  return {
    onTouchStart: (e: TouchEvent) => {
      const t = e.touches[0]
      ok = e.touches.length === 1 && !(e.target as HTMLElement).closest('.no-swipe')
      x0 = t.clientX
      y0 = t.clientY
      t0 = performance.now()
    },
    onTouchEnd: (e: TouchEvent) => {
      if (!ok) return
      const t = e.changedTouches[0]
      const dx = t.clientX - x0
      const dy = t.clientY - y0
      if (performance.now() - t0 > 600) return
      if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.5) return
      step(dx < 0 ? 1 : -1)
    },
  }
}

function DayStrip({
  counts,
  selected,
  today,
  onSelect,
}: {
  counts: Map<string, number>
  selected: string
  today: string
  onSelect: (d: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const first = useRef(true)

  useLayoutEffect(() => {
    const box = ref.current
    const cell = box?.querySelector<HTMLElement>(`[data-day="${selected}"]`)
    if (!box || !cell) return
    const left = cell.offsetLeft - box.clientWidth / 2 + cell.offsetWidth / 2
    box.scrollTo({ left, behavior: first.current ? 'auto' : 'smooth' })
    first.current = false
  }, [selected])

  const items: ReactNode[] = []
  for (const key of SEASON) {
    if (key === SEASON_START || key.endsWith('-01')) {
      items.push(
        <span key={`m${key}`} className="strip-month" aria-hidden="true">
          {monthName(key).slice(0, 3)}
        </span>,
      )
    }
    const c = counts.get(key) ?? 0
    const closed = CLOSED_DAYS.has(key)
    const sel = key === selected
    items.push(
      <button
        key={key}
        type="button"
        data-day={key}
        className={`strip-day${sel ? ' sel' : ''}${key === today ? ' today' : ''}${closed ? ' closed' : ''}${c ? '' : ' none'}`}
        aria-pressed={sel}
        aria-current={key === today ? 'date' : undefined}
        aria-label={`${LONG_WEEKDAY.format(utcNoon(key))}, ${MONTH_DAY.format(utcNoon(key))}: ${
          closed ? 'libraries closed' : `${c} storytime${c === 1 ? '' : 's'}`
        }`}
        onClick={() => onSelect(key)}
      >
        <i>{SHORT_WEEKDAY.format(utcNoon(key))}</i>
        <b>{Number(key.slice(8))}</b>
        <span className="dots" aria-hidden="true">
          {closed ? 'closed' : Array.from({ length: dotsFor(c) }, (_, i) => <span key={i} />)}
        </span>
      </button>,
    )
  }

  return (
    <div className="strip no-swipe" ref={ref}>
      {items}
    </div>
  )
}

function EventCard({
  ev,
  open,
  now,
  next,
  phone,
  picked,
  driveMin,
  onToggle,
  onMap,
  onPick,
}: {
  driveMin?: number
  ev: StoryEvent
  open: boolean
  now: number | null
  next: boolean
  phone?: string
  picked: boolean
  onToggle: () => void
  onMap: () => void
  onPick: () => void
}) {
  const pt = eventPoint(ev)
  const dist = driveMin == null && pt ? formatMiles(miles(HOME, pt)) : null
  const start = Date.parse(ev.start)
  const end = Date.parse(ev.end)
  const live = now != null && start <= now && now < end
  const past = now != null && end <= now
  const age = ageOf(ev)
  const t = splitTime(ev.start)
  const dir = directionsUrl(ev)
  const online = ev.branch === 'Online'

  return (
    <li
      id={`ev-${ev.nid}`}
      className={`card${open ? ' open' : ''}${live ? ' live' : ''}${past ? ' past' : ''}${picked ? ' picked' : ''}`}
    >
      <button
        type="button"
        className="pick"
        aria-pressed={picked}
        aria-label={`${picked ? 'Unpick' : 'Pick'} ${ev.title}, ${formatTime(ev.start)}, for your calendar`}
        onClick={onPick}
      >
        {picked ? <CheckIcon /> : <PlusSmallIcon />}
      </button>
      <button type="button" className="card-main" aria-expanded={open} onClick={onToggle}>
        <span className="when">
          <b>{t.clock}</b>
          <small>{t.ampm}</small>
        </span>
        <span className="what">
          {(live || next) && (
            <span className={`badge${live ? ' now' : ''}`}>
              {live ? `Now · until ${formatTime(ev.end)}` : `Next · ${untilLabel(start - (now ?? 0))}`}
            </span>
          )}
          <span className="title">{ev.title}</span>
          <span className="where">
            {online ? 'Online' : shortBranch(ev.branch)}
            {driveMin != null ? (
              <span className="drive" aria-label={`, ${driveMin} minute drive`}>
                <CarIcon />
                {driveMin} min
              </span>
            ) : (
              dist && <span className="mi"> · {dist}</span>
            )}
          </span>
          <span className={`age age-${age}`}>
            {AGE_LABEL[age]} · {durationLabel(ev)}
          </span>
        </span>
      </button>
      {open && (
        <div className="card-more">
          {ev.title !== ev.program && <p className="prog">{ev.program}</p>}
          <p className="addr">
            {formatTime(ev.start)} – {formatTime(ev.end)}
            {ev.room ? ` · ${ev.room}` : ''}
            {ev.address && (
              <>
                <br />
                {ev.address}
              </>
            )}
            {online && (
              <>
                <br />
                Register on the library listing to get the Zoom link.
              </>
            )}
          </p>
          <div className="actions">
            {dir && (
              <a className="act primary" href={dir}>
                <PinIcon /> Directions
              </a>
            )}
            <button type="button" className="act" onClick={() => downloadIcs([ev])}>
              <PlusIcon /> Add to calendar
            </button>
            {!online && (
              <button type="button" className="act" onClick={onMap}>
                <MapIcon /> Show on map
              </button>
            )}
            {phone && (
              <a className="act" href={`tel:${phone.replace(/\D/g, '')}`}>
                <PhoneIcon /> Call
              </a>
            )}
            <a className="act" href={ev.url} target="_blank" rel="noreferrer">
              <LinkIcon /> {online ? 'Register' : 'Library listing'}
            </a>
          </div>
        </div>
      )}
    </li>
  )
}

function MapView({
  active,
  branches,
  dayEvents,
  selected,
  onSelect,
  onOpen,
  now,
  drive,
}: {
  active: boolean
  branches: Record<string, BranchInfo>
  dayEvents: StoryEvent[]
  selected: string | null
  onSelect: (b: string | null) => void
  onOpen: (ev: StoryEvent) => void
  now: number | null
  drive: DriveTimes
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [cardH, setCardH] = useState(120)
  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setCardH(el.getBoundingClientRect().height))
    ro.observe(el)
    return () => ro.disconnect()
  }, [active])

  const here = selected ? dayEvents.filter((e) => e.branch === selected).sort(sortByTime) : []
  const live = new Set(dayEvents.filter((e) => e.branch !== 'Online').map((e) => e.branch))
  const info = selected ? branches[selected] : null
  const leg = selected ? drive[selected] : undefined
  const dist = leg
    ? `${leg.minutes} min drive · ${leg.road_miles} mi`
    : info?.lat != null && info.lon != null
      ? formatMiles(miles(HOME, { lat: info.lat, lon: info.lon }))
      : null

  return (
    <section className="mapview" hidden={!active} aria-label="Map">
      <MapPane
        branches={branches}
        dayEvents={dayEvents}
        selectedBranch={selected}
        home={HOME}
        active={active}
        padBottom={cardH}
        shortName={shortBranch}
        onSelectBranch={onSelect}
      />
      <div className="map-card" ref={cardRef}>
        {selected && info ? (
          <>
            <div className="map-card-head">
              <div>
                <strong>{shortBranch(selected)}</strong>
                <span>
                  {dist}
                  {dist && ' · '}
                  {here.length ? `${here.length} storytime${here.length === 1 ? '' : 's'}` : 'No storytime this day'}
                </span>
              </div>
              <button type="button" className="icon-btn" aria-label="Close" onClick={() => onSelect(null)}>
                <CloseIcon />
              </button>
            </div>
            {here.length > 0 && (
              <ul className="map-list">
                {here.map((ev) => {
                  const past = now != null && Date.parse(ev.end) <= now
                  return (
                    <li key={ev.nid}>
                      <button type="button" className={past ? 'past' : ''} onClick={() => onOpen(ev)}>
                        <b>{formatTime(ev.start)}</b>
                        <span>{ev.title}</span>
                        <Chevron open={false} side />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            {info.lat != null && info.lon != null && (
              <a
                className="act primary wide"
                href={`https://maps.apple.com/?daddr=${info.lat},${info.lon}&q=${encodeURIComponent(selected)}`}
              >
                <PinIcon /> Directions
              </a>
            )}
          </>
        ) : (
          <p className="map-hint">
            <strong>
              {live.size} {live.size === 1 ? 'library' : 'libraries'}
            </strong>{' '}
            with storytime this day. Tap a pin to see times.
          </p>
        )}
      </div>
    </section>
  )
}

function SeasonSheet({
  counts,
  selected,
  today,
  onSelect,
  onClose,
}: {
  counts: Map<string, number>
  selected: string
  today: string
  onSelect: (d: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.documentElement.classList.add('locked')
    ref.current?.querySelector<HTMLElement>('.cell.sel')?.scrollIntoView({ block: 'center' })
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.classList.remove('locked')
    }
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Season calendar"
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <strong>Fall 2026</strong>
          <button type="button" className="pill-btn" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="sheet-body">
          {MONTHS.map((mo) => {
            const firstKey = `${mo.y}-${String(mo.m).padStart(2, '0')}-01`
            const lead = utcNoon(firstKey).getUTCDay()
            const n = new Date(Date.UTC(mo.y, mo.m, 0)).getUTCDate()
            const cells: ReactNode[] = []
            for (let i = 0; i < lead; i++) cells.push(<span key={`e${i}`} className="cell blank" />)
            for (let d = 1; d <= n; d++) {
              const key = `${firstKey.slice(0, 8)}${String(d).padStart(2, '0')}`
              const inSeason = key >= SEASON_START && key <= SEASON_END
              const c = counts.get(key) ?? 0
              const closed = CLOSED_DAYS.has(key)
              cells.push(
                <button
                  key={key}
                  type="button"
                  disabled={!inSeason}
                  className={`cell${key === selected ? ' sel' : ''}${key === today ? ' today' : ''}${closed ? ' closed' : ''}`}
                  aria-pressed={key === selected}
                  aria-label={
                    inSeason
                      ? `${MONTH_DAY.format(utcNoon(key))}: ${closed ? 'libraries closed' : `${c} storytimes`}`
                      : MONTH_DAY.format(utcNoon(key))
                  }
                  onClick={() => onSelect(key)}
                >
                  <b>{d}</b>
                  {inSeason && (
                    <span className="dots" aria-hidden="true">
                      {Array.from({ length: closed ? 0 : dotsFor(c) }, (_, i) => (
                        <span key={i} />
                      ))}
                    </span>
                  )}
                </button>,
              )
            }
            return (
              <section key={mo.m} className="month">
                <h2>{monthName(firstKey)}</h2>
                <div className="dow" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <span key={i}>{weekdayNarrow(addDays('2026-09-06', i))}</span>
                  ))}
                </div>
                <div className="grid">{cells}</div>
              </section>
            )
          })}
          <p className="sheet-note">Dots show how many storytimes match your filters that day.</p>
        </div>
      </div>
    </div>
  )
}

function PicksSheet({
  events,
  onRemove,
  onClear,
  onAdd,
  onClose,
}: {
  events: StoryEvent[]
  onRemove: (id: string) => void
  onClear: () => void
  onAdd: () => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.documentElement.classList.add('locked')
    return () => {
      document.removeEventListener('keydown', onKey)
      document.documentElement.classList.remove('locked')
    }
  }, [onClose])
  useEffect(() => {
    if (!events.length) onClose()
  }, [events.length, onClose])

  const days: [string, StoryEvent[]][] = []
  for (const ev of events) {
    const k = dayKey(ev.start)
    const last = days[days.length - 1]
    if (last && last[0] === k) last[1].push(ev)
    else days.push([k, [ev]])
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Picked storytimes"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <strong>Picked</strong>
          <button type="button" className="pill-btn" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="sheet-body">
          {days.map(([k, list]) => (
            <section key={k} className="pick-day">
              <h2>
                {LONG_WEEKDAY.format(utcNoon(k))}, {MONTH_DAY.format(utcNoon(k))}
              </h2>
              <ul>
                {list.map((ev) => (
                  <li key={ev.nid}>
                    <b>{formatTime(ev.start)}</b>
                    <span>
                      {ev.title}
                      <small>{ev.branch === 'Online' ? 'Online' : shortBranch(ev.branch)}</small>
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Remove ${ev.title}, ${formatTime(ev.start)}`}
                      onClick={() => onRemove(ev.nid)}
                    >
                      <CloseIcon />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <div className="pick-actions">
            <button type="button" className="act primary wide" onClick={onAdd}>
              <PlusIcon /> Add {events.length} to calendar
            </button>
            <button type="button" className="act wide" onClick={onClear}>
              Clear all
            </button>
          </div>
          <p className="sheet-note">Your calendar app opens the file and asks before adding.</p>
        </div>
      </div>
    </div>
  )
}

function Subscribe() {
  return (
    <section className="subscribe">
      <h2>Every storytime in your calendar</h2>
      <p>A live feed of the whole season, updated when the schedule changes.</p>
      <div className="actions">
        <a className="act primary" href={WEBCAL}>
          <PlusIcon /> Apple Calendar
        </a>
        <a className="act" href={GOOGLE_CAL}>
          <PlusIcon /> Google Calendar
        </a>
        <a className="act" href={`${import.meta.env.BASE_URL}storytime.ics`} download>
          <LinkIcon /> Download .ics
        </a>
      </div>
    </section>
  )
}

function Footer({ gaps }: { gaps: Gap[] }) {
  return (
    <footer className="foot">
      {gaps.length > 0 && (
        <details>
          <summary>{gaps.length} weekly flyer slots have no dated listing</summary>
          <ul>
            {gaps.map((g) => (
              <li key={`${g.branch}${g.title}${g.when}`}>
                {g.title}, {shortBranch(g.branch)} — {g.when}
              </li>
            ))}
          </ul>
        </details>
      )}
      <p>
        Unofficial schedule of Austin Public Library storytimes, {MONTH_DAY.format(utcNoon(SEASON_START))} –{' '}
        {MONTH_DAY.format(utcNoon(SEASON_END))}, 2026. Programs can move or cancel; confirm at{' '}
        <a href={STORYTIMES_INDEX}>library.austintexas.gov</a>. Accessibility requests: {ADA_PHONE}. Drive times are from home with no traffic, routed by{' '}
        <a href="https://project-osrm.org/">OSRM</a> on OpenStreetMap roads. Feed:{' '}
        <a href={ICS_HTTPS}>storytime.ics</a>
      </p>
    </footer>
  )
}

function Chevron({ open, side }: { open: boolean; side?: boolean }) {
  return (
    <svg
      className={`chev${open ? ' up' : ''}${side ? ' side' : ''}`}
      viewBox="0 0 20 20"
      width="20"
      height="20"
      aria-hidden="true"
    >
      <path d="M5.5 7.5 10 12l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

const CalendarIcon = () => (
  <Icon>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Icon>
)
const ListIcon = () => (
  <Icon>
    <path d="M9 6.5h11M9 12h11M9 17.5h11" />
    <circle cx="4.5" cy="6.5" r="1" fill="currentColor" />
    <circle cx="4.5" cy="12" r="1" fill="currentColor" />
    <circle cx="4.5" cy="17.5" r="1" fill="currentColor" />
  </Icon>
)
const MapIcon = () => (
  <Icon>
    <path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2-6-2Z" />
    <path d="M9 4.5v13M15 6.5v13" />
  </Icon>
)
const PinIcon = () => (
  <Icon>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </Icon>
)
const PlusIcon = () => (
  <Icon>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M12 10.5v6M9 13.5h6M8 3v4M16 3v4" />
  </Icon>
)
const PhoneIcon = () => (
  <Icon>
    <path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16.5 16.5 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z" />
  </Icon>
)
const LinkIcon = () => (
  <Icon>
    <path d="M14 4.5h5.5V10M19.5 4.5 11 13M17 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7H10" />
  </Icon>
)
const PlusSmallIcon = () => (
  <Icon>
    <path d="M12 6v12M6 12h12" />
  </Icon>
)
const CheckIcon = () => (
  <Icon>
    <path d="m5.5 12.5 4.5 4.5 8.5-9.5" strokeWidth="2.4" />
  </Icon>
)
const CarIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 16.5h14M6.5 16.5v2M17.5 16.5v2M4.5 16.5v-4l2-5h11l2 5v4" />
    <circle cx="8" cy="13.5" r="0.6" fill="currentColor" />
    <circle cx="16" cy="13.5" r="0.6" fill="currentColor" />
  </svg>
)
const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)
