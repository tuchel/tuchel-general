import { useEffect, useState, type CSSProperties } from 'react'
import { WhaleMap, type HeatScale, type HexHover } from './components/WhaleMap'
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
import { fetchSocialPosts, type SocialSnapshot } from './lib/social'
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
  const [showSocial, setShowSocial] = useState(true)
  const [hexHover, setHexHover] = useState<HexHover | null>(null)
  const [heatScale, setHeatScale] = useState<HeatScale | null>(null)
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>('haro-west-side')
  const [panel, setPanel] = useState<'filters' | 'live' | 'plan' | 'ideas'>('filters')
  const [sheetOpen, setSheetOpen] = useState(false)

  const [tides, setTides] = useState<TideSnapshot | null>(null)
  const [wind, setWind] = useState<WindSnapshot | null>(null)
  const [hydro, setHydro] = useState<HydroSnapshot | null>(null)
  const [social, setSocial] = useState<SocialSnapshot | null>(null)
  const [tideError, setTideError] = useState<string | null>(null)
  const [windError, setWindError] = useState<string | null>(null)
  const [hydroError, setHydroError] = useState<string | null>(null)
  const [socialError, setSocialError] = useState<string | null>(null)

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
      try {
        const s = await fetchSocialPosts()
        if (!cancelled) {
          setSocial(s)
          setSocialError(null)
        }
      } catch (e) {
        if (!cancelled) {
          try {
            const baked = await fetch('./data/social.json').then((r) => r.json())
            const posts = (baked.posts || []) as SocialSnapshot['posts']
            setSocial({
              posts,
              mapped: posts.filter((p) => p.lat != null && p.lon != null),
              fetchedAt: baked.meta?.builtAt || new Date().toISOString(),
              sourceNote: 'Baked social.json (live Bluesky refresh failed)',
            })
            setSocialError(null)
          } catch {
            setSocialError(e instanceof Error ? e.message : 'Social fetch failed')
          }
        }
      }
    }
    load()
    const id = window.setInterval(load, 5 * 60 * 1000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  useEffect(() => {
    const onResize = () => window.dispatchEvent(new Event('resize'))
    const t = window.setTimeout(onResize, 320)
    return () => window.clearTimeout(t)
  }, [sheetOpen])

  const labels = meta?.speciesLabels || {}
  const activeHotspot = hotspots.find((h) => h.id === selectedHotspot) || null
  const monthLabel = month === 'all' ? 'All year' : MONTHS[month - 1]
  const recentCount = meta?.counts.recentInBbox ?? 0
  const hydroHot = hydro?.feeds.some((f) => f.pulse === 'hot') ?? false
  const gateLabel =
    wind?.gate === 'go' ? 'Go' : wind?.gate === 'caution' ? 'Caution' : wind?.gate === 'no-go' ? 'No-go' : '…'

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

  const openPanel = (id: typeof panel) => {
    setPanel(id)
    setSheetOpen(true)
  }

  return (
    <div className={`app ${sheetOpen ? 'sheet-open' : ''}`}>
      <div className="atmosphere" aria-hidden>
        <div className="mist mist-a" />
        <div className="mist mist-b" />
        <div className="grain" />
      </div>

      <div className="map-stage">
        <WhaleMap
          month={month}
          species={species}
          showHabitat={showHabitat}
          showHotspots={showHotspots}
          showLaunches={showLaunches}
          showRecent={showRecent}
          showScatter={showScatter}
          showHydros={showHydros}
          showSocial={showSocial}
          effortBias={effortBias}
          viewMode={viewMode}
          windGate={wind?.gate ?? null}
          hydroFeeds={hydro?.feeds ?? []}
          socialPosts={social?.mapped ?? []}
          hotspots={hotspots}
          launches={launches}
          meta={meta}
          onHexHover={setHexHover}
          onSelectHotspot={(id) => {
            setSelectedHotspot(id)
            openPanel('plan')
          }}
          onHeatScale={setHeatScale}
          selectedHotspot={selectedHotspot}
          layoutKey={sheetOpen ? 'open' : 'closed'}
        />

        <div className="chrome-left">
          <header className="brand-float">
            <p className="brand">San Juan Whale Odds</p>
            <p className="tagline">Where should the boat go?</p>
          </header>

          <div className="status-float" aria-label="Live status">
            <div className="status-chip">
              <em>{meta?.counts.historicalInBbox.toLocaleString() ?? '—'}</em>
              <span>reports</span>
            </div>
            <div className="status-chip">
              <em>{recentCount}</em>
              <span>recent</span>
            </div>
            <div className={`status-chip gate-${wind?.gate || 'unknown'}`}>
              <em>{gateLabel}</em>
              <span>wind</span>
            </div>
            <div className={`status-chip ${hydroHot ? 'pulse' : ''}`}>
              <em>{hydroHot ? 'Calls' : 'Quiet'}</em>
              <span>hydro</span>
            </div>
            <div className="status-chip">
              <em>{social?.mapped.length ?? '…'}</em>
              <span>social</span>
            </div>
          </div>
        </div>

        <div className="map-legend">
          <div className="heat-scale" aria-label="Sighting density scale">
            <div className="heat-scale-bar" />
            <div className="heat-scale-labels">
              <span>Low</span>
              <span>Mid</span>
              <span>Hot</span>
            </div>
            <p>
              {effortBias ? 'Effort-adjusted' : 'Raw'} · {heatScale?.positiveCells ?? '—'} cells
              {heatScale
                ? ` · peak ${
                    effortBias ? heatScale.maxScore.toFixed(1) : `${heatScale.maxRaw} reports`
                  }`
                : ''}
            </p>
          </div>
        </div>

        {hexHover && hexHover.score > 0 && (
          <div className="hex-tooltip">
            <strong>
              {effortBias
                ? `Index ${hexHover.score.toFixed(1)} · ${hexHover.raw} reports`
                : `${hexHover.raw} report${hexHover.raw === 1 ? '' : 's'}`}
            </strong>
            <span>
              Top {Math.max(1, Math.round(100 - hexHover.rank))}% · {hexHover.lat.toFixed(2)}°N{' '}
              {Math.abs(hexHover.lon).toFixed(2)}°W
            </span>
          </div>
        )}

        {wind?.gate === 'no-go' && (
          <div className="wind-banner no-go">No-go for open Haro — {wind.gateNote}</div>
        )}
        {wind?.gate === 'caution' && (
          <div className="wind-banner caution">Caution — {wind.gateNote}</div>
        )}

        <button
          type="button"
          className="sheet-launch"
          onClick={() => setSheetOpen(true)}
          aria-expanded={sheetOpen}
        >
          <span className="sheet-launch-label">Plan the day</span>
          <span className="sheet-launch-meta">
            {monthLabel} · {viewMode}
          </span>
        </button>
      </div>

      {sheetOpen && (
        <button
          type="button"
          className="sheet-scrim"
          aria-label="Close panel"
          onClick={() => setSheetOpen(false)}
        />
      )}

      <aside className={`sheet ${sheetOpen ? 'open' : ''}`} aria-label="Trip controls">
        <div className="sheet-handle-wrap">
          <button
            type="button"
            className="sheet-handle"
            aria-label={sheetOpen ? 'Collapse panel' : 'Expand panel'}
            onClick={() => setSheetOpen((v) => !v)}
          >
            <span />
          </button>
          <div className="sheet-head">
            <div>
              <p className="sheet-kicker">Boat day</p>
              <h2>Tune the odds</h2>
            </div>
            <button type="button" className="sheet-close" onClick={() => setSheetOpen(false)}>
              Close
            </button>
          </div>
        </div>

        <nav className="sheet-tabs" aria-label="Panel sections">
          {(
            [
              ['filters', 'Filters'],
              ['live', 'Live'],
              ['plan', 'Plan'],
              ['ideas', 'Ideas'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={panel === id ? 'on' : ''}
              onClick={() => openPanel(id)}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="sheet-body">
          {panel === 'filters' && (
            <div className="panel-block">
              <div className="field">
                <span>View mode</span>
                <div className="seg">
                  {(
                    [
                      ['balanced', 'Balanced'],
                      ['climatology', 'History'],
                      ['nowcast', 'Now'],
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
                <p className="hint">History = multi-year hexes · Now = Acartia + hydrophones</p>
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
                <span>Species</span>
                <div className="seg wrap">
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
                <span>Layers</span>
                <label>
                  <input
                    type="checkbox"
                    checked={effortBias}
                    onChange={(e) => setEffortBias(e.target.checked)}
                  />
                  Effort-bias correction
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showRecent}
                    onChange={(e) => setShowRecent(e.target.checked)}
                  />
                  Recent Acartia sightings
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showHydros}
                    onChange={(e) => setShowHydros(e.target.checked)}
                  />
                  OrcaSound hydrophones
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showSocial}
                    onChange={(e) => setShowSocial(e.target.checked)}
                  />
                  Bluesky social pins
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showHotspots}
                    onChange={(e) => setShowHotspots(e.target.checked)}
                  />
                  Named corridors
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showLaunches}
                    onChange={(e) => setShowLaunches(e.target.checked)}
                  />
                  Launch points
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showHabitat}
                    onChange={(e) => setShowHabitat(e.target.checked)}
                  />
                  NOAA SRKW habitat
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showScatter}
                    onChange={(e) => setShowScatter(e.target.checked)}
                  />
                  Individual points
                </label>
              </div>

              <button
                type="button"
                className="primary-btn"
                onClick={() => downloadHotspotsGpx(hotspots, launches)}
              >
                Download GPX waypoints
              </button>
            </div>
          )}

          {panel === 'live' && (
            <ConditionsPanel
              tides={tides}
              wind={wind}
              hydro={hydro}
              social={social}
              tideError={tideError}
              windError={windError}
              hydroError={hydroError}
              socialError={socialError}
            />
          )}

          {panel === 'plan' && (
            <>
              <div className="panel-block">
                <h3>Named water</h3>
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

              <div className="panel-block">
                <h3>Seasonality</h3>
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
                <div className="panel-block etiquette">
                  <h3>{etiquette.title}</h3>
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
            <div className="panel-block ideas">
              <h3>How the data is pulled</h3>
              <article>
                <h4>Climatology vs nowcast</h4>
                <p>Hexes from SalishSea.io; rings from Acartia. Mode toggle chooses which leads.</p>
              </article>
              <article>
                <h4>Ecotype split</h4>
                <p>
                  Southern Residents along Haro salmon water; Bigg’s near Cattle Pass seal haul-outs.
                </p>
              </article>
              <article>
                <h4>Tide + wind</h4>
                <p>NOAA Friday Harbor tides and Open-Meteo mid-Haro wind gate the small-boat day.</p>
              </article>
              <article>
                <h4>OrcaSound</h4>
                <p>Lab + North San Juan Channel pulses when whale-category detections land.</p>
              </article>
              <article>
                <h4>Effort bias</h4>
                <p>Busy Lime Kiln cells lose weight versus quieter water with the same counts.</p>
              </article>
            </div>
          )}

          <p className="sheet-footnote">
            Opportunistic sightings, not a guarantee. Built{' '}
            {meta ? new Date(meta.builtAt).toLocaleDateString() : '—'}. Sources refresh live every 5
            minutes.
          </p>
        </div>
      </aside>
    </div>
  )
}
