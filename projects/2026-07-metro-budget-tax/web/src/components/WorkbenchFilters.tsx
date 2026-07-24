import type { MetricKey, PopBand } from '../lib/types'
import { METRIC_LABELS, REGIONS } from '../lib/types'

interface Props {
  metric: MetricKey
  onMetric: (m: MetricKey) => void
  includeMicros: boolean
  onMicros: (v: boolean) => void
  includeState: boolean
  onState: (v: boolean) => void
  region: string
  onRegion: (r: string) => void
  popBand: PopBand
  onPopBand: (b: PopBand) => void
  count: number
}

export function WorkbenchFilters({
  metric,
  onMetric,
  includeMicros,
  onMicros,
  includeState,
  onState,
  region,
  onRegion,
  popBand,
  onPopBand,
  count,
}: Props) {
  return (
    <div className="filters" role="search">
      <div className="metric-toggle" role="group" aria-label="Map metric">
        {(Object.keys(METRIC_LABELS) as MetricKey[]).map((key) => (
          <button
            key={key}
            type="button"
            className={metric === key ? 'is-active' : undefined}
            onClick={() => onMetric(key)}
          >
            {METRIC_LABELS[key]}
          </button>
        ))}
      </div>
      <div className="filter-row">
        <label>
          Region
          <select value={region} onChange={(e) => onRegion(e.target.value)}>
            <option value="all">All regions</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label>
          Population
          <select
            value={popBand}
            onChange={(e) => onPopBand(e.target.value as PopBand)}
          >
            <option value="all">All sizes</option>
            <option value="lt500k">&lt; 500k</option>
            <option value="500k-1m">500k–1M</option>
            <option value="1m-3m">1M–3M</option>
            <option value="gt3m">&gt; 3M</option>
          </select>
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={includeMicros}
            onChange={(e) => onMicros(e.target.checked)}
          />
          Include micropolitan areas
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={includeState}
            onChange={(e) => onState(e.target.checked)}
          />
          Include modeled state allocation
        </label>
        <span className="filter-count mono">{count.toLocaleString()} areas</span>
      </div>
      {includeState && (
        <p className="modeled-banner">
          Modeled overlay: state government tax and spend allocated by each CBSA’s share of state
          population. Not a Census metro tabulation — local figures remain the default.
        </p>
      )}
    </div>
  )
}
