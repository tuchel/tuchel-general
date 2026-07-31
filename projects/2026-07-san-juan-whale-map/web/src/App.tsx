import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { WhaleMap, type HexHover } from './components/WhaleMap'
import { SeasonGrid } from './components/SeasonGrid'
import { HourStrip } from './components/HourStrip'
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
  const [showHabitat, setShowHabitat] = useState(true)
  const [showHotspots, setShowHotspots] = useState(true)
  const [showLaunches, setShowLaunches] = useState(true)
  const [showRecent, setShowRecent] = useState(true)
  const [showScatter, setShowScatter] = useState(false)
  const [hexHover, setHexHover] = useState<HexHover | null>(null)
  const [selectedHotspot, setSelectedHotspot] = useState<string | null>('haro-west-side')
  const [panel, setPanel] = useState<'plan' | 'ideas'>('plan')

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

  const recentCount = meta?.counts.recentInBbox ?? 0

  const ideas = useMemo(
    () => [
      {
        title: 'Climatology vs nowcast',
        body: 'Heatmap = years of SalishSea.io reports. Rings = Acartia “current” pins from the last days. Use both: park in productive water, then react to this week’s reports.',
      },
      {
        title: 'Ecotype split',
        body: 'Southern Residents track salmon along Haro; Bigg’s hunt seals near Cattle Pass. Filtering species changes which corridors light up.',
      },
      {
        title: 'Month × species grid',
        body: 'Click a cell to set both filters. Dense table beats twelve pie charts for a boat-day decision.',
      },
      {
        title: 'Next pulls',
        body: 'Friday Harbor tides, NWS marine wind, OrcaSound hydrophone pulse, effort-bias correction, GPX export of hotspots — see notes/data-ideas.md.',
      },
    ],
    [],
  )

  return (
    <div className="app">
      <div className="sea-wash" aria-hidden />
      <header className="top">
        <div className="brand-block">
          <p className="brand">San Juan Whale Odds</p>
          <h1>Where should the boat go?</h1>
          <p className="lede">
            Historical sighting density around San Juan Island, recent cooperative reports, and
            named corridors — filtered by species and month so a rental group can place itself in
            productive water.
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
            <strong>{monthLabel}</strong>
            <span>season filter</span>
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
            hotspots={hotspots}
            launches={launches}
            meta={meta}
            onHexHover={setHexHover}
            onSelectHotspot={setSelectedHotspot}
            selectedHotspot={selectedHotspot}
          />
          <div className="map-legend">
            <span className="swatch heat" /> Low → high report density
            <span className="swatch recent" /> Recent pin
            <span className="swatch hotspot" /> Named corridor
            <span className="swatch launch" /> Launch
          </div>
          {hexHover && hexHover.score > 0 && (
            <div className="hex-tooltip">
              <strong>
                {hexHover.score} report{hexHover.score === 1 ? '' : 's'}
              </strong>{' '}
              for current filters
              <span>
                {hexHover.lat.toFixed(2)}°N {Math.abs(hexHover.lon).toFixed(2)}°W · cell total{' '}
                {hexHover.total}
              </span>
            </div>
          )}
        </section>

        <aside className="side">
          <div className="control-card">
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
              <p className="bound-note">
                Lower bound = ignore season · Upper bound = December · Current = climatology month
                for the heatmap
              </p>
            </label>

            <div className="field">
              <span>Species</span>
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
                <input type="checkbox" checked={showRecent} onChange={(e) => setShowRecent(e.target.checked)} />
                Recent sightings
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
          </div>

          <div className="tabs">
            <button type="button" className={panel === 'plan' ? 'on' : ''} onClick={() => setPanel('plan')}>
              Trip plan
            </button>
            <button type="button" className={panel === 'ideas' ? 'on' : ''} onClick={() => setPanel('ideas')}>
              Data ideas
            </button>
          </div>

          {panel === 'plan' ? (
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
          ) : (
            <div className="control-card ideas">
              <h2>How to pull & present this</h2>
              {ideas.map((idea) => (
                <article key={idea.title}>
                  <h3>{idea.title}</h3>
                  <p>{idea.body}</p>
                </article>
              ))}
              <p className="meta-line">
                Full catalog in <code>notes/data-ideas.md</code> and <code>notes/sources.md</code>.
              </p>
            </div>
          )}
        </aside>
      </main>

      <footer className="foot">
        <p>
          Density is opportunistic sightings (effort-biased toward popular water and fair weather),
          not a probability of whales on your day. Built{' '}
          {meta ? new Date(meta.builtAt).toUTCString() : '—'}. Sources:{' '}
          {meta?.sources.map((s) => s.name).join(' · ')}.
        </p>
      </footer>
    </div>
  )
}
