import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { ChapterScroller } from './components/ChapterScroller'
import { CompareTray } from './components/CompareTray'
import { FloatingToc } from './components/InfoTip'
import { MetroDetail } from './components/MetroDetail'
import { MetroMap } from './components/MetroMap'
import { MetroSearch } from './components/MetroSearch'
import { NationalScatter } from './components/NationalScatter'
import { RankTable } from './components/RankTable'
import { WorkbenchFilters } from './components/WorkbenchFilters'
import { readUrlState, useMetroData, writeUrlState } from './lib/data'
import {
  inPopBand,
  median,
  money,
  type MetricKey,
  type PopBand,
  METRIC_LABELS,
} from './lib/types'

const TOC = [
  { id: 'hero', label: 'Explore' },
  { id: 'learn', label: 'Learn' },
  { id: 'detail', label: 'Selected area' },
  { id: 'compare-what', label: 'Compared to what' },
  { id: 'compare', label: 'Compare tray' },
  { id: 'table', label: 'Table' },
  { id: 'methodology', label: 'Methodology' },
]

export default function App() {
  const { data, byCbsa, error, loading } = useMetroData()
  const initial = readUrlState()
  const [metric, setMetric] = useState<MetricKey>(
    initial.metric && initial.metric in METRIC_LABELS
      ? (initial.metric as MetricKey)
      : 'tax_per_capita',
  )
  const [selected, setSelected] = useState<string | null>(initial.metro)
  const [compare, setCompare] = useState<string[]>(initial.compare.slice(0, 4))
  const [includeMicros, setIncludeMicros] = useState(initial.micros)
  const [region, setRegion] = useState('all')
  const [popBand, setPopBand] = useState<PopBand>('all')

  useEffect(() => {
    writeUrlState({ metro: selected, compare, metric, micros: includeMicros })
  }, [selected, compare, metric, includeMicros])

  const filtered = useMemo(() => {
    if (!data) return []
    return data.metros.filter((m) => {
      if (!includeMicros && !m.is_metro) return false
      if (region !== 'all' && m.region !== region) return false
      if (!inPopBand(m.population, popBand)) return false
      return true
    })
  }, [data, includeMicros, region, popBand])

  const selectedMetro = selected ? byCbsa.get(selected) ?? null : null
  const fallbackMetro = filtered.find((m) => m.is_metro) ?? filtered[0] ?? null
  const pinned = compare.map((c) => byCbsa.get(c)).filter(Boolean) as NonNullable<
    ReturnType<typeof byCbsa.get>
  >[]

  const medians = useMemo(
    () => ({
      tax: median(filtered.map((m) => m.tax_per_capita)),
      spend: median(filtered.map((m) => m.spend_per_capita)),
    }),
    [filtered],
  )

  function select(cbsa: string) {
    setSelected(cbsa)
  }

  function pin(cbsa: string) {
    setCompare((prev) => {
      if (prev.includes(cbsa)) return prev
      return [...prev, cbsa].slice(-4)
    })
  }

  if (loading) {
    return (
      <main className="page">
        <p className="loading">Loading metro finance data…</p>
      </main>
    )
  }

  if (error || !data || !fallbackMetro) {
    return (
      <main className="page">
        <p className="error">Could not load data: {error ?? 'empty'}</p>
      </main>
    )
  }

  return (
    <div className="shell">
      <FloatingToc items={TOC} />
      <main className="page">
        <header className="hero" id="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              FY{data.meta.fiscal_year} · {data.audit.n_metropolitan} metros
              {includeMicros ? ` + ${data.audit.n_micropolitan} micros` : ''}
            </p>
            <h1>What does your metro spend — and tax — per person?</h1>
            <p className="hero-lede">
              Local tax collections and direct general spending, rolled up across every overlapping
              local government — not city hall alone.
            </p>
            <WorkbenchFilters
              metric={metric}
              onMetric={setMetric}
              includeMicros={includeMicros}
              onMicros={setIncludeMicros}
              region={region}
              onRegion={setRegion}
              popBand={popBand}
              onPopBand={setPopBand}
              count={filtered.length}
            />
            <MetroSearch metros={filtered} selected={selected} onSelect={select} />
          </div>
          <div className="hero-visual">
            <MetroMap
              metros={filtered}
              metric={metric}
              selected={selected}
              onSelect={select}
            />
          </div>
        </header>

        <ChapterScroller
          metro={selectedMetro}
          fallback={fallbackMetro}
          nationalTaxMedian={medians.tax}
          nationalSpendMedian={medians.spend}
        />

        <section className="detail-section">
          <MetroDetail
            metro={selectedMetro}
            nationalMedianTax={medians.tax}
            nationalMedianSpend={medians.spend}
            onPin={pin}
            isPinned={selected ? compare.includes(selected) : false}
          />
          <div className="callout">
            <h2>National snapshot</h2>
            <p>
              Across metros, local governments collected about{' '}
              <strong className="mono">
                ${(data.audit.sum_tax_metropolitan_only / 1e9).toFixed(0)}B
              </strong>{' '}
              in taxes and spent about{' '}
              <strong className="mono">
                ${(data.audit.sum_spend_metropolitan_only / 1e9).toFixed(0)}B
              </strong>{' '}
              on direct general functions in FY{data.meta.fiscal_year}. CBSA rollup recovers{' '}
              <strong className="mono">
                {(100 * data.audit.tax_recovery_vs_published).toFixed(1)}%
              </strong>{' '}
              of published US local tax.
            </p>
            <p>
              Median in current filter — tax {money(medians.tax)}/person, spend{' '}
              {money(medians.spend)}/person.
            </p>
          </div>
        </section>

        <section className="scatter-section">
          <NationalScatter
            metros={filtered}
            selected={selected}
            onSelect={select}
            xKey={metric === 'tax_as_share_of_personal_income' ? 'tax_as_share_of_personal_income' : 'tax_per_capita'}
            yKey="spend_per_capita"
          />
        </section>

        <CompareTray
          pinned={pinned}
          onUnpin={(cbsa) => setCompare((p) => p.filter((c) => c !== cbsa))}
          onClear={() => setCompare([])}
        />

        <section className="rank-section">
          <RankTable
            metros={filtered}
            metric={metric}
            selected={selected}
            onSelect={select}
            onPin={pin}
          />
        </section>

        <section className="method" id="methodology">
          <h2>Methodology</h2>
          <p>
            Source: U.S. Census Bureau individual-unit State & Local Government Finances files
            (FY2017, FY2022), joined via embedded state/county FIPS to OMB July 2023 CBSA
            delineations, divided by Census CBSA population estimates. Personal income from BEA
            CAINC1 county personal income summed to CBSAs.
          </p>
          <ul>
            {data.audit.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <p className="fineprint">
            Definitions: {Object.values(data.meta.definitions).join(' ')}
          </p>
        </section>

        <footer className="site-footer">
          <span>Metro Budget & Tax Explorer</span>
          <a href="#methodology">Methodology</a>
        </footer>
      </main>
    </div>
  )
}
