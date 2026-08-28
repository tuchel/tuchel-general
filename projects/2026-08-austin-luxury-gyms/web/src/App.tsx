import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { MapPane, type EdgePad, type PinHover } from './MapPane'
import { Scatter } from './Scatter'
import { allInAnnual, annualTimeCost, driveMin, fitScore, matchesMust, reviewMean } from './lib/score'
import { flagLabel, miles, minutes, money, pct } from './lib/format'
import {
  AMENITY_ROWS,
  DEFAULT_WEIGHTS,
  MUSTS,
  TIERS,
  type Catalog,
  type Gym,
  type MustId,
  type SortId,
  type Tier,
  type Weights,
} from './lib/types'

const REST_PAD: EdgePad = { top: 40, right: 52, bottom: 36, left: 24 }

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
  return { top: 40, right: 52, bottom: Math.max(36, Math.round(sheetH + gap)), left: 20 }
}

function sheetRange(): { peek: number; max: number } {
  const fs = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const vh = window.visualViewport?.height ?? window.innerHeight
  const peek = 19.2 * fs
  const max = Math.max(peek + 48, vh - 2.6 * fs - 8)
  return { peek, max }
}

function swallowNextClick() {
  const swallow = (ev: Event) => {
    ev.preventDefault()
    ev.stopPropagation()
  }
  document.addEventListener('click', swallow, true)
  window.setTimeout(() => document.removeEventListener('click', swallow, true), 450)
}

function tipStyle(x: number, y: number): CSSProperties {
  const inset = 10
  const half = 96
  const left = Math.min(Math.max(x, inset + half), window.innerWidth - inset - half)
  const flip = y < 96
  return {
    left,
    top: y,
    transform: flip ? 'translate(-50%, 10px)' : 'translate(-50%, calc(-100% - 10px))',
  }
}

export default function App() {
  const [data, setData] = useState<Catalog | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [compare, setCompare] = useState<string[]>([])
  const [must, setMust] = useState<MustId[]>([])
  const [tiers, setTiers] = useState<Tier[]>(TIERS.map((t) => t.id))
  const [sort, setSort] = useState<SortId>('fit')
  const [peak, setPeak] = useState(false)
  const [visits, setVisits] = useState(4)
  const [wage, setWage] = useState(75)
  const [maxDrive, setMaxDrive] = useState(30)
  const [weights, setWeights] = useState<Weights>(DEFAULT_WEIGHTS)
  const [tab, setTab] = useState<'list' | 'you' | 'chart'>('list')
  const [hover, setHover] = useState<PinHover | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [edgePad, setEdgePad] = useState<EdgePad>(REST_PAD)
  const [dragH, setDragH] = useState<number | null>(null)
  const chromeRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const expandedRef = useRef(false)
  expandedRef.current = expanded
  const drag = useRef<{
    id: number
    startY: number
    startH: number
    lastY: number
    lastT: number
    vy: number
    moved: boolean
    h: number
  } | null>(null)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}gyms.json`)
      .then((r) => r.json() as Promise<Catalog>)
      .then((c) => {
        setData(c)
        const params = new URLSearchParams(window.location.search)
        if (params.get('g')) setSelected(params.get('g'))
        if (params.get('peak') === '1') setPeak(true)
      })
  }, [])

  useEffect(() => {
    if (!data) return
    const u = new URL(window.location.href)
    if (selected) u.searchParams.set('g', selected)
    else u.searchParams.delete('g')
    if (peak) u.searchParams.set('peak', '1')
    else u.searchParams.delete('peak')
    history.replaceState(null, '', u)
  }, [selected, peak, data])

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
  }, [data, tab, selected])

  useLayoutEffect(() => {
    const node = handleRef.current
    const chrome = chromeRef.current
    if (!node || !chrome) return
    let raf = 0
    let listening = false
    const applyY = (clientY: number) => {
      const d = drag.current
      if (!d) return
      const now = performance.now()
      const dt = Math.max(8, now - d.lastT)
      d.vy = (clientY - d.lastY) / dt
      d.lastY = clientY
      d.lastT = now
      if (Math.abs(clientY - d.startY) > 6) d.moved = true
      const { peek, max } = sheetRange()
      d.h = Math.min(max, Math.max(peek * 0.88, d.startH - (clientY - d.startY)))
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        if (drag.current) setDragH(drag.current.h)
      })
    }
    const unbind = () => {
      if (!listening) return
      listening = false
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
    }
    const finish = (clientY?: number) => {
      const d = drag.current
      if (!d) return
      if (clientY != null) applyY(clientY)
      drag.current = null
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
      unbind()
      document.documentElement.classList.remove('sheet-dragging')
      const { peek, max } = sheetRange()
      const mid = peek + (max - peek) * 0.38
      let open = d.h > mid
      if (d.vy > 0.35) open = false
      else if (d.vy < -0.35) open = true
      if (!d.moved) open = !expandedRef.current
      if (d.moved) swallowNextClick()
      setExpanded(open)
      setDragH(null)
    }
    const onMove = (ev: PointerEvent) => {
      if (!drag.current || ev.pointerId !== drag.current.id) return
      applyY(ev.clientY)
    }
    const onUp = (ev: PointerEvent) => {
      if (!drag.current || ev.pointerId !== drag.current.id) return
      finish(ev.clientY)
    }
    const onTouchMove = (ev: TouchEvent) => {
      if (!drag.current) return
      ev.preventDefault()
      if (ev.touches.length) applyY(ev.touches[0].clientY)
    }
    const onTouchEnd = (ev: TouchEvent) => {
      if (!drag.current) return
      if (ev.touches.length) return
      finish(ev.changedTouches[0]?.clientY)
    }
    const onDown = (ev: PointerEvent) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return
      if (drag.current) finish()
      ev.stopPropagation()
      const startH = chrome.getBoundingClientRect().height
      drag.current = {
        id: ev.pointerId,
        startY: ev.clientY,
        startH,
        lastY: ev.clientY,
        lastT: performance.now(),
        vy: 0,
        moved: false,
        h: startH,
      }
      document.documentElement.classList.add('sheet-dragging')
      setDragH(startH)
      if (!listening) {
        listening = true
        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onUp)
        document.addEventListener('touchmove', onTouchMove, { passive: false })
        document.addEventListener('touchend', onTouchEnd)
        document.addEventListener('touchcancel', onTouchEnd)
      }
    }
    node.addEventListener('pointerdown', onDown)
    return () => {
      node.removeEventListener('pointerdown', onDown)
      if (drag.current) finish()
      else unbind()
    }
  }, [data])

  const shown = useMemo(() => {
    if (!data) return []
    return data.gyms.filter((g) => {
      if (!tiers.includes(g.tier)) return false
      if (driveMin(g, peak) > maxDrive + 0.05) return false
      return must.every((m) => matchesMust(g, m))
    })
  }, [data, tiers, must, peak, maxDrive])

  const ranked = useMemo(() => {
    const list = [...shown]
    const w = weights
    list.sort((a, b) => {
      if (sort === 'drive') return driveMin(a, peak) - driveMin(b, peak)
      if (sort === 'price') {
        const pa = a.price.monthlyFrom ?? 9e9
        const pb = b.price.monthlyFrom ?? 9e9
        return pa - pb
      }
      if (sort === 'reviews') {
        const ra = reviewMean(a) ?? -1
        const rb = reviewMean(b) ?? -1
        return rb - ra
      }
      return fitScore(b, w, peak, 400) - fitScore(a, w, peak, 400)
    })
    return list
  }, [shown, sort, weights, peak])

  const gym = ranked.find((g) => g.id === selected) ?? data?.gyms.find((g) => g.id === selected) ?? null
  const hoverGym = hover ? (data?.gyms.find((g) => g.id === hover.id) ?? null) : null
  const tours = ranked.slice(0, 3)

  function toggleMust(id: MustId) {
    setMust((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
    setSelected(null)
  }

  function toggleTier(id: Tier) {
    setTiers((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
      return next.length ? next : cur
    })
    setSelected(null)
  }

  function toggleCompare(id: string) {
    setCompare((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id)
      if (cur.length >= 3) return [...cur.slice(1), id]
      return [...cur, id]
    })
  }

  function pick(id: string | null) {
    setSelected(id)
    if (id) setExpanded(true)
  }

  if (!data) return <div className="boot">Loading clubs…</div>

  const home = { lat: data.home.lat, lon: data.home.lon }
  const compareGyms = compare.map((id) => data.gyms.find((g) => g.id === id)).filter(Boolean) as Gym[]

  return (
    <div className={expanded ? 'app expanded' : 'app'}>
      <section className="map-wrap">
        <MapPane
          gyms={ranked}
          selectedId={selected}
          compareIds={compare}
          home={home}
          peak={peak}
          edgePad={edgePad}
          onSelect={pick}
          onHover={setHover}
        />
        {hover && hoverGym && (
          <div className="tip" style={tipStyle(hover.x, hover.y)} role="tooltip">
            <strong>{hoverGym.name}</strong>
            <span>
              {minutes(driveMin(hoverGym, peak))} · {miles(hoverGym.driveMi)}
              {hoverGym.price.monthlyFrom != null ? ` · from ${money(hoverGym.price.monthlyFrom)}/mo` : ' · dues unpublished'}
            </span>
            <em>{hoverGym.fitNote}</em>
          </div>
        )}
        <p className="map-legend">
          <span className="lg home" /> home
          <span className="lg near" /> &lt;10 min
          <span className="lg mid" /> 10–16
          <span className="lg far" /> 16–22
          <span className="lg out" /> farther
        </p>
      </section>

      <div className={dragH != null ? 'chrome dragging' : 'chrome'} ref={chromeRef} style={dragH != null ? { height: dragH } : undefined}>
        <div
          className="sheet-handle"
          ref={handleRef}
          role="slider"
          tabIndex={0}
          aria-label="Club sheet"
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={expanded ? 100 : 35}
          aria-expanded={expanded}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'Home') {
              e.preventDefault()
              setExpanded(true)
            }
            if (e.key === 'ArrowDown' || e.key === 'End') {
              e.preventDefault()
              setExpanded(false)
            }
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setExpanded((v) => !v)
            }
          }}
        >
          <span />
        </div>

        <header className="mast">
          <p className="kicker">From 427 Ridgewood Road</p>
          <h1>Equinox-level gyms</h1>
          <p className="lede">
            {ranked.length} of {data.gyms.length} clubs
            {tours[0] ? ` · first tour: ${tours[0].short}` : ''}
          </p>
        </header>

        <div className="tabs" role="tablist" aria-label="Panel">
          {(
            [
              ['list', 'Clubs'],
              ['you', 'For you'],
              ['chart', 'Price × drive'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? 'text-btn on' : 'text-btn'}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="sheet-scroll">
          {tab === 'list' && (
            <>
              <div className="filters" role="group" aria-label="Must-haves">
                {MUSTS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={must.includes(m.id) ? 'chip on' : 'chip'}
                    aria-pressed={must.includes(m.id)}
                    title={m.hint}
                    onClick={() => toggleMust(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="filters slim" role="group" aria-label="Club type">
                {TIERS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={tiers.includes(t.id) ? 'chip on' : 'chip'}
                    aria-pressed={tiers.includes(t.id)}
                    onClick={() => toggleTier(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="status">
                <p>
                  Sort
                </p>
                <div className="sort" role="group" aria-label="Order">
                  {(
                    [
                      ['fit', 'Fit'],
                      ['drive', 'Drive'],
                      ['price', 'Price'],
                      ['reviews', 'Reviews'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className={sort === id ? 'text-btn on' : 'text-btn'}
                      aria-pressed={sort === id}
                      onClick={() => setSort(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="slat">
                <span>
                  Max drive {minutes(maxDrive)}
                  <em>{peak ? 'peak bound' : 'free-flow'} — 10 min is neighborhood; 20 is a typical Austin hop; 30 reaches 620</em>
                </span>
                <input type="range" min={8} max={35} value={maxDrive} onChange={(e) => setMaxDrive(Number(e.target.value))} />
              </label>
              <label className="toggle">
                <input type="checkbox" checked={peak} onChange={(e) => setPeak(e.target.checked)} />
                Peak traffic × 1.7 (not live traffic)
              </label>
              {tours.length > 0 && (
                <p className="tour">
                  Tour these {tours.length}: {tours.map((g) => g.short).join(', ')}
                </p>
              )}
              <ol className="clubs">
                {ranked.length === 0 && <li className="empty">No clubs match the must-haves. Drop a filter.</li>}
                {ranked.map((g) => (
                  <ClubRow
                    key={g.id}
                    g={g}
                    open={g.id === selected}
                    compared={compare.includes(g.id)}
                    peak={peak}
                    visits={visits}
                    wage={wage}
                    fit={fitScore(g, weights, peak, 400)}
                    onToggle={() => pick(g.id === selected ? null : g.id)}
                    onCompare={() => toggleCompare(g.id)}
                  />
                ))}
              </ol>
            </>
          )}

          {tab === 'you' && (
            <NeedPanel
              weights={weights}
              setWeights={setWeights}
              visits={visits}
              setVisits={setVisits}
              wage={wage}
              setWage={setWage}
              peak={peak}
              ranked={ranked}
              tours={tours}
              onPick={pick}
            />
          )}

          {tab === 'chart' && (
          <Scatter
            gyms={ranked}
            selectedId={selected}
            peak={peak}
            onSelect={(id) => {
              pick(id)
              setTab('list')
            }}
            onHover={() => undefined}
          />
        )}

          {gym && <Detail g={gym} peak={peak} visits={visits} wage={wage} />}

          {compareGyms.length >= 2 && <CompareTable gyms={compareGyms} peak={peak} />}

          <footer>
            Unofficial shortlist from {data.home.name}, {data.home.city}. {data.bar} Drive: {data.driveNote} Dues
            as of {data.asOf}; confirm on a tour. Sources in the project notes.
          </footer>
        </div>
      </div>
    </div>
  )
}

function ClubRow({
  g,
  open,
  compared,
  peak,
  visits,
  wage,
  fit,
  onToggle,
  onCompare,
}: {
  g: Gym
  open: boolean
  compared: boolean
  peak: boolean
  visits: number
  wage: number
  fit: number
  onToggle: () => void
  onCompare: () => void
}) {
  const allIn = allInAnnual(g, peak, visits, wage)
  const stars = reviewMean(g)
  return (
    <li className={`ev${open ? ' open' : ''}${compared ? ' here' : ''}`}>
      <button type="button" className="ev-main" onClick={onToggle} aria-expanded={open}>
        <span className="ev-time">{minutes(driveMin(g, peak))}</span>
        <span className="ev-title">{g.short}</span>
        <span className="ev-meta">
          {g.price.monthlyFrom != null ? `${money(g.price.monthlyFrom)}/mo` : 'dues unpublished'}
          {stars != null ? ` · ${stars.toFixed(1)}★` : ''}
          {` · fit ${pct(fit)}`}
          {allIn != null ? ` · ${money(allIn / 12)}/mo all-in` : ''}
        </span>
      </button>
      <button type="button" className={compared ? 'text-btn on cmp' : 'text-btn cmp'} onClick={onCompare}>
        {compared ? 'Compared' : 'Compare'}
      </button>
    </li>
  )
}

function Detail({ g, peak, visits, wage }: { g: Gym; peak: boolean; visits: number; wage: number }) {
  const dues = g.price.monthlyFrom
  const time = annualTimeCost(g, peak, visits, wage)
  const allIn = allInAnnual(g, peak, visits, wage)
  const src = g.reviews.sources[0]
  return (
    <article className="detail" id={`gym-${g.id}`}>
      <h2>{g.name}</h2>
      <p className="fitnote">{g.fitNote}</p>
      <p>
        {g.address}
        {g.phone ? ` · ${g.phone}` : ''}
      </p>
      <p>
        {minutes(driveMin(g, peak))} {peak ? 'peak bound' : 'free-flow'} · {miles(g.driveMi)}
      </p>
      <p>
        {g.price.kind === 'quoted' ? 'Quoted' : g.price.kind === 'realtorEstimate' ? 'Realtor estimate' : 'Unpublished'}{' '}
        {dues != null ? `${money(dues)}/mo` : '—'}
        {g.price.initiationFrom ? ` · initiation from ${money(g.price.initiationFrom)}` : ''}
      </p>
      <p className="tiny">{g.price.note}</p>
      <p>
        Weekdays: {g.hours.weekday}
        <br />
        Weekend: {g.hours.weekend}
      </p>
      <p>{g.parking}</p>
      {src && (
        <p>
          {src.name}
          {src.score != null ? ` ${src.score.toFixed(1)}` : ''} / {src.n} reviews
        </p>
      )}
      <ul className="pros">
        {g.reviews.for.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <ul className="cons">
        {g.reviews.against.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      {g.caveats.map((c) => (
        <p key={c} className="caveat">
          {c}
        </p>
      ))}
      {allIn != null && dues != null && (
        <p>
          At {visits} visits/week and {money(wage)}/hour of commute time: dues {money(dues * 12)}/yr + time{' '}
          {money(time)}/yr = <strong>{money(allIn)}/yr</strong> ({money(allIn / 12)}/mo).
        </p>
      )}
      <p className="links">
        <a href={g.website} target="_blank" rel="noreferrer">
          Club site
        </a>
        <a href={g.price.url} target="_blank" rel="noreferrer">
          Price source
        </a>
        <a
          href={`https://maps.apple.com/?daddr=${g.lat},${g.lon}&q=${encodeURIComponent(g.name)}`}
        >
          Directions
        </a>
        {g.phone && <a href={`tel:${g.phone.replace(/\D/g, '')}`}>{g.phone}</a>}
      </p>
    </article>
  )
}

function NeedPanel({
  weights,
  setWeights,
  visits,
  setVisits,
  wage,
  setWage,
  peak,
  ranked,
  tours,
  onPick,
}: {
  weights: Weights
  setWeights: (w: Weights) => void
  visits: number
  setVisits: (n: number) => void
  wage: number
  setWage: (n: number) => void
  peak: boolean
  ranked: Gym[]
  tours: Gym[]
  onPick: (id: string) => void
}) {
  function set(k: keyof Weights, v: number) {
    setWeights({ ...weights, [k]: v })
  }
  const winner = ranked[0]
  const wsum = weights.commute + weights.price + weights.recovery + weights.family + weights.hours
  return (
    <div className="needs">
      <p>
        Weights change the <em>Fit</em> sort. They do not hide clubs — use must-haves for that.
      </p>
      {(
        [
          ['commute', 'Commute', '0 = ignore drive; 1 = punish anything past ~30 min'],
          ['price', 'Price', 'Uses quoted monthly. Unpublished clubs get a middle score.'],
          ['recovery', 'Recovery', 'Sauna / steam / plunge / spa'],
          ['family', 'Family', 'Kids, pool, pickleball, tennis'],
          ['hours', 'Weekend night', 'Saturday open past 8pm'],
        ] as const
      ).map(([k, label, hint]) => (
        <label key={k} className="slat">
          <span>
            {label} {pct(wsum ? weights[k] / wsum : 0)}%
            <em>{hint}</em>
          </span>
          <input type="range" min={0} max={100} value={Math.round(weights[k] * 100)} onChange={(e) => set(k, Number(e.target.value) / 100)} />
        </label>
      ))}
      <label className="slat">
        <span>
          Visits per week {visits}
          <em>0 = dues only; 6 is a daily habit minus one rest day</em>
        </span>
        <input type="range" min={1} max={7} value={visits} onChange={(e) => setVisits(Number(e.target.value))} />
      </label>
      <label className="slat">
        <span>
          Commute time {money(wage)}/hour
          <em>$0 if drive is dead time you enjoy; $150 if it displaces billable work</em>
        </span>
        <input type="range" min={0} max={200} step={5} value={wage} onChange={(e) => setWage(Number(e.target.value))} />
      </label>
      {winner && (
        <p className="tour">
          With these weights{peak ? ' at peak' : ''}, start at{' '}
          <button type="button" className="text-btn on" onClick={() => onPick(winner.id)}>
            {winner.name}
          </button>
          {tours.length > 1 ? ` then ${tours.slice(1).map((g) => g.short).join(', ')}` : ''}.
        </p>
      )}
    </div>
  )
}

function CompareTable({ gyms, peak }: { gyms: Gym[]; peak: boolean }) {
  return (
    <div className="cmp-wrap">
      <table className="cmp">
        <thead>
          <tr>
            <th> </th>
            {gyms.map((g) => (
              <th key={g.id}>{g.short}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th>Drive</th>
            {gyms.map((g) => (
              <td key={g.id}>{minutes(driveMin(g, peak))}</td>
            ))}
          </tr>
          <tr>
            <th>Monthly</th>
            {gyms.map((g) => (
              <td key={g.id}>{g.price.monthlyFrom != null ? money(g.price.monthlyFrom) : '—'}</td>
            ))}
          </tr>
          {AMENITY_ROWS.map((row) => (
            <tr key={row.key}>
              <th>{row.label}</th>
              {gyms.map((g) => (
                <td key={g.id}>{flagLabel(g.amenities[row.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
