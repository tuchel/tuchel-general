import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { MetroDetail } from './components/MetroDetail'
import { MetroMap } from './components/MetroMap'
import { MetroSearch } from './components/MetroSearch'
import { NationalScatter } from './components/NationalScatter'
import { RankTable } from './components/RankTable'
import { readCbsaFromUrl, useMetroData, writeCbsaToUrl } from './lib/data'
import { METRIC_LABELS, money, type MetricKey } from './lib/types'

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export default function App() {
  const { data, byCbsa, error, loading } = useMetroData()
  const [metric, setMetric] = useState<MetricKey>('tax_per_capita')
  const [selected, setSelected] = useState<string | null>(readCbsaFromUrl())

  useEffect(() => {
    writeCbsaToUrl(selected)
  }, [selected])

  const metros = data?.metros ?? []
  const selectedMetro = selected ? byCbsa.get(selected) ?? null : null

  const medians = useMemo(
    () => ({
      tax: median(metros.map((m) => m.tax_per_capita)),
      spend: median(metros.map((m) => m.spend_per_capita)),
    }),
    [metros],
  )

  function select(cbsa: string) {
    setSelected(cbsa)
    document.getElementById('detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  if (loading) {
    return (
      <main className="page">
        <p className="loading">Loading metro finance data…</p>
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="page">
        <p className="error">Could not load data: {error}</p>
      </main>
    )
  }

  return (
    <main className="page">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">FY{data.meta.fiscal_year} · {data.audit.n_metropolitan} US metros</p>
          <h1>What does your metro spend — and tax — per person?</h1>
          <p className="hero-lede">
            Local tax collections and direct general spending, rolled up across every overlapping
            local government in each metropolitan area — not city hall alone.
          </p>
          <div className="metric-toggle" role="group" aria-label="Map metric">
            {(Object.keys(METRIC_LABELS) as MetricKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={metric === key ? 'is-active' : undefined}
                onClick={() => setMetric(key)}
              >
                {METRIC_LABELS[key]}
              </button>
            ))}
          </div>
          <MetroSearch metros={metros} selected={selected} onSelect={select} />
        </div>
        <div className="hero-visual">
          <MetroMap
            metros={metros}
            metric={metric}
            selected={selected}
            onSelect={select}
          />
        </div>
      </header>

      <section id="detail" className="detail-section">
        <MetroDetail
          metro={selectedMetro}
          nationalMedianTax={medians.tax}
          nationalMedianSpend={medians.spend}
        />
        <div className="callout">
          <h2>Two numbers that are not the same</h2>
          <p>
            Across these metros, local governments collected about{' '}
            <strong className="mono">
              ${(data.audit.sum_tax_metropolitan_only / 1e9).toFixed(0)}B
            </strong>{' '}
            in taxes and spent about{' '}
            <strong className="mono">
              ${(data.audit.sum_spend_metropolitan_only / 1e9).toFixed(0)}B
            </strong>{' '}
            on direct general functions in FY{data.meta.fiscal_year}. The gap is mostly charges,
            miscellaneous own-source revenue, and transfers from state and federal governments — not
            a metro “deficit” line item.
          </p>
          <p>
            Median metro tax / person: <span className="mono">{money(medians.tax)}</span>. Median
            spend / person: <span className="mono">{money(medians.spend)}</span>.
          </p>
        </div>
      </section>

      <section className="scatter-section">
        <NationalScatter metros={metros} selected={selected} onSelect={select} />
      </section>

      <section className="rank-section">
        <RankTable metros={metros} metric={metric} selected={selected} onSelect={select} />
      </section>

      <section className="method" id="methodology">
        <h2>Methodology</h2>
        <p>
          Source: U.S. Census Bureau, 2022 Census of Governments / Annual Survey of State and Local
          Government Finances individual-unit public-use file, joined via each unit’s embedded state
          and county FIPS codes to OMB July 2023 CBSA delineations, divided by Census CBSA
          population estimates for 2022.
        </p>
        <ul>
          {data.audit.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <p>
          Official published US local tax total for 2022 is about $894B; this CBSA rollup recovers
          about $862B across metros and micros (rural non-CBSA areas and a few unmapped units explain
          the gap).
        </p>
        <p className="fineprint">
          Definitions: {data.meta.definitions.tax_per_capita}.{' '}
          {data.meta.definitions.spend_per_capita}. {data.meta.definitions.gap_per_capita}.
        </p>
      </section>

      <footer className="site-footer">
        <span>Metro Budget & Tax Explorer</span>
        <a href="#methodology">Methodology</a>
      </footer>
    </main>
  )
}
