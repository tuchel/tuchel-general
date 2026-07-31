import { useEffect, useState, type CSSProperties } from 'react'
import { WhaleMap, type HexHover } from './components/WhaleMap'
import { SeasonGrid } from './components/SeasonGrid'
import { HourStrip } from './components/HourStrip'
import { ConditionsPanel } from './components/ConditionsPanel'
import {
  downloadHotspotsGpx,
  fetchHydrophones,
  fetchTides,
  fetchWind,
  type HydroSnapshot,
  type TideSnapshot,
  type WindSnapshot,
} from './lib/live'
import {
  MONTHS,
  SPECIES_COLOR,
  SPECIES_ORDER,
  type Etiquette,
  type Hotspot,
  type Launch,
  type Meta,
  type Seasonality,
  type SpeciesKey,
  type ViewMode,
} from './lib/types'

const nowMonth = new Date().getMonth() + 1

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [seasonality, setSeasonality] = useState<Seasonality | null>(null)
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [launches, setLaunches] = useState<Launch[]>([])
  const [etiquette, setEtiquette] = useState<Etiquette | null>(null)

  const [month, setMonth] = useState<number | 'all'>(nowMonth)
  const [species, setSpecies] = useState<Set<SpeciesKey>>(
    () => new Set(['srkw', 'biggs', 'orca_unspecified', 'humpback']),
  )
  const [viewMode, setViewMode] = useState<ViewMode>('balanced')
  const [effortBias, setEffortBias] = useState(true)
  const [showHabitat, setShowHabitat] = useState(true)
  const [showHotspots, setShowHotspots] = useState(true)
  const [showLaunches, setShowLaunches] = useState(true)
  const [showRecent, setShowRecent] = useState(true)
  const [showScatter, setShowScatter] = useState(false)
  const [showHydros, setShowHydros] = useState(true)
  const [hexHover, setHexHover] = useState<HexHover | null>(null)
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>('haro-west-side')
  const [panel, setPanel] = useState<'plan' | 'live' | 'ideas'>('live')

  const [tides, setTides] = useState<TideSnapshot | null>(null)
  const [wind, setWind] = useState<WindSnapshot | null>(null)
  const [hydro, setHydro] = useState<HydroSnapshot | null>(null)
  const [tideError, setTideError] = useState<string | null>(null)
  const [windError, setWindError] = useState<string | null>(null)
  const [hydroError, setHydroError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('./data/meta.json').then((r) => r.json()),
      fetch('./data/seasonality.json').then((r) => r.json()),
      fetch('./data/hotspots.json').then((r) => r.json()),
      fetch('./data/launches.json').then((r) => r.json()),
      fetch('./data/etiquette.json').then((r) => r.json()),
    ]).then(([m, s, h, l, e]) => {
      setMeta(m)
      setSeasonality(s)
      setHotspots(h)
      setLaunches(l)
      setEtiquette(e)
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const t = await fetchTides()
        if (!cancelled) {
          setTides(t)
          setTideError(null)
        }
      } catch (e) {
        if (!cancelled) setTideError(e instanceof Error ? e.message : 'Tide fetch failed')
      }
      try {
        const w = await fetchWind()
        if (!cancelled) {
          setWind(w)
          setWindError(null)
        }
      } catch (e) {
        if (!cancelled) setWindError(e instanceof Error ? e.message : 'Wind fetch failed')
      }
      try {
        const h = await fetchHydrophones()
        if (!cancelled) {
          setHydro(h)
          setHydroError(null)
        }
      } catch (e) {
        if (!cancelled) setHydroError(e instanceof Error ? e.message : 'Hydrophone fetch failed')
      }
    }
    load()
    const id = window.setInterval(load, 5 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  const labels = meta?.speciesLabels || {}
  const activeHotspot = hotspots.find((h) => h.id === selectedHotspot) || null
  const monthLabel = month === 'all' ? 'All months' : MONTHS[month - 1]

  const toggleSpecies = (sp: SpeciesKey) => {
    setSpecies((prev) => {
      const next = new Set(prev)
      if (next.has(sp)) next.delete(sp)
      else next.add(sp)
      return next
    })
  }

  const presetEcotype = (kind: 'residents' | 'biggs' | 'mysticetes' | 'all-orca') => {
    if (kind === 'residents') setSpecies(new Set(['srkw', 'orca_unspecified']))
    if (kind === 'biggs') setSpecies(new Set(['biggs', 'orca_unspecified']))
    if (kind === 'mysticetes') setSpecies(new Set(['humpback', 'minke', 'gray']))
    if (kind === 'all-orca') setSpecies(new Set(['srkw', 'biggs', 'orca_unspecified']))
  }

  const recentCount = meta?.counts.recentInBbox ?? 0
  const hydroHot = hydro?.feeds.some((f) => f.pulse === 'hot') ?? false

  return (
    <div className="app">
      <div className="sea-wash" aria-hidden />
      <header className="top">
        <div className="brand-block">
          <p className="brand">San Juan Whale Odds</p>
          <h1>Where should the boat go?</h1>
          <p className="lede">
            Historical density, live Acartia pins, tides, wind gate, and OrcaSound pulses — filtered
            by species and month so a rental group can sit in productive water without chasing.
          </p>
        </div>
        <aside className="stat-rail" aria-label="Dataset snapshot">
          <div>
            <strong>{meta?.counts.historicalInBbox.toLocaleString() ?? '—'}</strong>
            <span>historical reports in view</span>
          </div>
          <div>
            <strong>{recentCount}</strong>
            <span>recent Acartia pins</span>
          </div>
          <div>
            <strong className={wind ? `gate-text-${wind.gate}` : ''}>
              {wind?.gate === 'go' ? 'Go' : wind?.gate === 'caution' ? 'Caution' : wind?.gate === 'no-go' ? 'No-go' : '…'}
            </strong>
            <span>Haro wind gate</span>
          </div>
          <div>
            <strong className={hydroHot ? 'pulse-hot-text' : ''}>{hydroHot ? 'Calls' : 'Quiet'}</strong>
            <span>San Juan hydrophones</span>
          </div>
        </aside>
      </header>

      <main className="workspace">
        <section className="map-panel">
          <WhaleMap
            month={month}
            species={species}
            showHabitat={showHabitat}
            showHotspots={showHotspots}
            showLaunches={showLaunches}
            showRecent={showRecent}
            showScatter={showScatter}
            showHydros={showHydros}
            effortBias={effortBias}
            viewMode={viewMode}
            windGate={wind?.gate ?? null}
            hydroFeeds={hydro?.feeds ?? []}
            hotspots={hotspots}
            launches={launches}
            meta={meta}
            onHexHover={setHexHover}
            onSelectHotspot={setSelectedHotspot}
            selectedHotspot={selectedHotspot}
          />
          <div className="map-legend">
            <span className="swatch heat" /> {effortBias ? 'Effort-adjusted density' : 'Raw report density'}
            <span className="swatch recent" /> Recent pin
            <span className="swatch hotspot" /> Corridor
            <span className="swatch hydro" /> Hydrophone
            <span className="swatch launch" /> Launch
          </div>
          {hexHover && hexHover.score > 0 && (
            <div className="hex-tooltip">
              <strong>
                {effortBias
                  ? `Index ${hexHover.score.toFixed(1)} (${hexHover.raw} reports)`
                  : `${hexHover.raw} report${hexHover.raw === 1 ? '' : 's'}`}
              </strong>{' '}
              for current filters
              <span>
                {hexHover.lat.toFixed(2)}°N {Math.abs(hexHover.lon).toFixed(2)}°W · cell effort{' '}
                {hexHover.total} all-time
              </span>
            </div>
          )}
          {wind?.gate === 'no-go' && (
            <div className="wind-banner no-go">Wind gate: no-go for open Haro — {wind.gateNote}</div>
          )}
          {wind?.gate === 'caution' && (
            <div className="wind-banner caution">Wind gate: caution — {wind.gateNote}</div>
          )}
        </section>

        <aside className="side">
          <div className="control-card">
            <div className="field">
              <span>View mode</span>
              <div className="mode-row">
                {(
                  [
                    ['balanced', 'Balanced'],
                    ['climatology', 'Climatology'],
                    ['nowcast', 'Nowcast'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={viewMode === id ? 'on' : ''}
                    onClick={() => setViewMode(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="bound-note">
                Climatology = multi-year hexes · Nowcast = Acartia + hydrophones · Balanced keeps both.
              </p>
            </div>

            <label className="field">
              <span>Month</span>
              <input
                type="range"
                min={0}
                max={12}
                value={month === 'all' ? 0 : month}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setMonth(v === 0 ? 'all' : v)
                }}
              />
              <div className="range-meta">
                <span>All year</span>
                <strong>{monthLabel}</strong>
                <span>Dec</span>
              </div>
            </label>

            <div className="field">
              <span>Species / ecotype</span>
              <div className="preset-row">
                <button type="button" onClick={() => presetEcotype('residents')}>
                  Residents
                </button>
                <button type="button" onClick={() => presetEcotype('biggs')}>
                  Bigg’s
                </button>
                <button type="button" onClick={() => presetEcotype('mysticetes')}>
                  Humpback+
                </button>
                <button type="button" onClick={() => presetEcotype('all-orca')}>
                  All orca
                </button>
              </div>
              <div className="chips">
                {SPECIES_ORDER.map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    className={`chip ${species.has(sp) ? 'on' : ''}`}
                    style={{ '--chip': SPECIES_COLOR[sp] } as CSSProperties}
                    onClick={() => toggleSpecies(sp)}
                  >
                    {labels[sp] || sp}
                  </button>
                ))}
              </div>
            </div>

            <div className="field layers">
              <span>Layers & scoring</span>
              <label>
                <input
                  type="checkbox"
                  checked={effortBias}
                  onChange={(e) => setEffortBias(e.target.checked)}
                />
                Effort-bias correction (down-weight busy watch water)
              </label>
              <label>
                <input type="checkbox" checked={showRecent} onChange={(e) => setShowRecent(e.target.checked)} />
                Recent Acartia sightings
              </label>
              <label>
                <input type="checkbox" checked={showHydros} onChange={(e) => setShowHydros(e.target.checked)} />
                OrcaSound hydrophones
              </label>
              <label>
                <input type="checkbox" checked={showHotspots} onChange={(e) => setShowHotspots(e.target.checked)} />
                Named corridors
              </label>
              <label>
                <input type="checkbox" checked={showLaunches} onChange={(e) => setShowLaunches(e.target.checked)} />
                Launch points
              </label>
              <label>
                <input type="checkbox" checked={showHabitat} onChange={(e) => setShowHabitat(e.target.checked)} />
                NOAA SRKW critical habitat
              </label>
              <label>
                <input type="checkbox" checked={showScatter} onChange={(e) => setShowScatter(e.target.checked)} />
                Individual historical points
              </label>
            </div>

            <button
              type="button"
              className="gpx-btn"
              onClick={() => downloadHotspotsGpx(hotspots, launches)}
            >
              Download corridors + launches (GPX)
            </button>
          </div>

          <div className="tabs three">
            <button type="button" className={panel === 'live' ? 'on' : ''} onClick={() => setPanel('live')}>
              Live
            </button>
            <button type="button" className={panel === 'plan' ? 'on' : ''} onClick={() => setPanel('plan')}>
              Trip plan
            </button>
            <button type="button" className={panel === 'ideas' ? 'on' : ''} onClick={() => setPanel('ideas')}>
              Data ideas
            </button>
          </div>

          {panel === 'live' && (
            <ConditionsPanel
              tides={tides}
              wind={wind}
              hydro={hydro}
              tideError={tideError}
              windError={windError}
              hydroError={hydroError}
            />
          )}

          {panel === 'plan' && (
            <>
              <div className="control-card">
                <h2>Named water</h2>
                <ul className="hotspot-list">
                  {hotspots.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        className={selectedHotspot === h.id ? 'on' : ''}
                        onClick={() => setSelectedHotspot(h.id)}
                      >
                        <strong>{h.name}</strong>
                        <span>{h.kind}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {activeHotspot && (
                  <div className="hotspot-detail">
                    <p>{activeHotspot.why}</p>
                    <p className="tip">{activeHotspot.tip}</p>
                    <p className="meta-line">
                      Better months:{' '}
                      {activeHotspot.bestMonths.map((m) => MONTHS[m - 1]).join(' · ')}
                    </p>
                  </div>
                )}
              </div>

              <div className="control-card">
                <h2>Seasonality</h2>
                <SeasonGrid
                  data={seasonality}
                  labels={labels}
                  month={month}
                  species={species}
                  onPick={(m, sp) => {
                    setMonth(m)
                    setSpecies(new Set([sp]))
                  }}
                />
                <HourStrip data={seasonality} species={species} labels={labels} />
              </div>

              {etiquette && (
                <div className="control-card etiquette">
                  <h2>{etiquette.title}</h2>
                  <ul>
                    {etiquette.rules.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <a href={etiquette.url} target="_blank" rel="noreferrer">
                    bewhalewise.org
                  </a>
                </div>
              )}
            </>
          )}

          {panel === 'ideas' && (
            <div className="control-card ideas">
              <h2>How this data is pulled</h2>
              <article>
                <h3>Climatology vs nowcast</h3>
                <p>
                  Hexes from SalishSea.io DWCA; rings from Acartia current. Mode toggle changes which
                  layer leads.
                </p>
              </article>
              <article>
                <h3>Ecotype split</h3>
                <p>
                  `ater` → Southern Resident, `rectipinnus` → Bigg’s. Presets jump the species chips.
                </p>
              </article>
              <article>
                <h3>Tide + wind gates</h3>
                <p>
                  NOAA CO-OPS Friday Harbor highs/lows + Open-Meteo 10 m wind / waves at mid-Haro.
                  Gate dims the basemap when gusts get sporty.
                </p>
              </article>
              <article>
                <h3>OrcaSound pulse</h3>
                <p>
                  Live feeds API for Orcasound Lab + North San Juan Channel; whale-category detections
                  in the last 2h / 12h drive the pulse.
                </p>
              </article>
              <article>
                <h3>Effort-bias correction</h3>
                <p>
                  Score = filtered reports × median_effort / (cell_total + 0.5×median). Busy Lime Kiln
                  cells lose weight vs quieter water with the same counts.
                </p>
              </article>
              <article>
                <h3>GPX export</h3>
                <p>Corridors + launches as waypoints for phone / plotter — with a do-not-chase note.</p>
              </article>
              <p className="meta-line">
                Details in <code>notes/data-ideas.md</code> and <code>notes/sources.md</code>.
              </p>
            </div>
          )}
        </aside>
      </main>

      <footer className="foot">
        <p>
          Density is opportunistic (effort-biased toward popular water and fair weather), not a
          probability of whales on your day. Built{' '}
          {meta ? new Date(meta.builtAt).toUTCString() : '—'}. Live tides/wind/hydro refresh every 5
          minutes in the browser. Sources: {meta?.sources.map((s) => s.name).join(' · ')} · NOAA
          CO-OPS · Open-Meteo · OrcaSound.
        </p>
      </footer>
    </div>
  )
}
