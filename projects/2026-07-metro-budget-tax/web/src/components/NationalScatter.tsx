import { useMemo, useState } from 'react'
import { formatMetric, money, metricValue, type MetricKey, type Metro } from '../lib/types'

interface Props {
  metros: Metro[]
  selected: string | null
  onSelect: (cbsa: string) => void
  xKey?: MetricKey
  yKey?: MetricKey
}

export function NationalScatter({
  metros,
  selected,
  onSelect,
  xKey = 'tax_per_capita',
  yKey = 'spend_per_capita',
}: Props) {
  const [hover, setHover] = useState<string | null>(null)

  const { points, xMax, yMax } = useMemo(() => {
    const usable = metros.filter(
      (m) => metricValue(m, xKey) != null && metricValue(m, yKey) != null,
    )
    const xs = usable.map((m) => metricValue(m, xKey) as number)
    const ys = usable.map((m) => metricValue(m, yKey) as number)
    const xMax = Math.max(...xs, 1)
    const yMax = Math.max(...ys, 1)
    const popMax = Math.max(...usable.map((m) => m.population), 1)
    const points = usable.map((m) => ({
      cbsa: m.cbsa,
      name: m.name,
      x: metricValue(m, xKey) as number,
      y: metricValue(m, yKey) as number,
      r: 3 + 10 * Math.sqrt(m.population / popMax),
      metro: m,
    }))
    return { points, xMax, yMax }
  }, [metros, xKey, yKey])

  const W = 720
  const H = 420
  const pad = { t: 16, r: 16, b: 44, l: 56 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b
  const active = hover ?? selected
  const tip = points.find((p) => p.cbsa === active)
  const xIsShare = xKey === 'tax_as_share_of_personal_income'
  const yIsShare = yKey === 'tax_as_share_of_personal_income'

  return (
    <div className="scatter" id="compare-what">
      <div className="section-head">
        <h2>Compared to what?</h2>
        <p>
          Each dot is an area in the current filter set. Dot size scales with population.
          {xKey === 'tax_per_capita' && yKey === 'spend_per_capita'
            ? ' The diagonal marks tax = spend.'
            : ''}
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Scatterplot of metro fiscal metrics">
        <line
          x1={pad.l}
          x2={W - pad.r}
          y1={H - pad.b}
          y2={H - pad.b}
          stroke="currentColor"
          strokeOpacity={0.35}
        />
        <line
          x1={pad.l}
          x2={pad.l}
          y1={pad.t}
          y2={H - pad.b}
          stroke="currentColor"
          strokeOpacity={0.35}
        />
        {xKey === 'tax_per_capita' && yKey === 'spend_per_capita' && (
          (() => {
            const lim = Math.min(xMax, yMax)
            const x2 = pad.l + (lim / xMax) * innerW
            const y2 = H - pad.b - (lim / yMax) * innerH
            return (
              <line
                x1={pad.l}
                y1={H - pad.b}
                x2={x2}
                y2={y2}
                stroke="#8a4b12"
                strokeDasharray="4 4"
                strokeOpacity={0.7}
              />
            )
          })()
        )}
        <text x={W / 2} y={H - 10} textAnchor="middle" className="axis-label">
          {xKey.replaceAll('_', ' ')} →
        </text>
        <text
          x={16}
          y={H / 2}
          textAnchor="middle"
          className="axis-label"
          transform={`rotate(-90 16 ${H / 2})`}
        >
          {yKey.replaceAll('_', ' ')} →
        </text>
        <text x={pad.l} y={H - pad.b + 16} className="tick mono">
          {xIsShare ? '0%' : money(0)}
        </text>
        <text x={W - pad.r} y={H - pad.b + 16} textAnchor="end" className="tick mono">
          {xIsShare ? `${(100 * xMax).toFixed(0)}%` : money(xMax)}
        </text>
        <text x={pad.l - 8} y={H - pad.b} textAnchor="end" className="tick mono">
          {yIsShare ? '0%' : money(0)}
        </text>
        <text x={pad.l - 8} y={pad.t + 4} textAnchor="end" className="tick mono">
          {yIsShare ? `${(100 * yMax).toFixed(0)}%` : money(yMax)}
        </text>
        {points.map((p) => {
          const cx = pad.l + (p.x / xMax) * innerW
          const cy = H - pad.b - (p.y / yMax) * innerH
          const isActive = p.cbsa === active
          return (
            <circle
              key={p.cbsa}
              cx={cx}
              cy={cy}
              r={Math.max(isActive ? p.r + 1.5 : p.r, 6)}
              fill={isActive ? '#8a4b12' : '#0b5f6b'}
              fillOpacity={isActive ? 0.95 : 0.4}
              stroke="#f3efe6"
              strokeWidth={isActive ? 1.5 : 0.5}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover(p.cbsa)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect(p.cbsa)}
            >
              <title>
                {p.name}: {formatMetric(p.metro, xKey)} vs {formatMetric(p.metro, yKey)}
              </title>
            </circle>
          )
        })}
      </svg>
      {tip && (
        <div className="scatter-tip mono">
          <strong>{tip.name}</strong>
          <span>
            {formatMetric(tip.metro, xKey)} · {formatMetric(tip.metro, yKey)}
          </span>
        </div>
      )}
    </div>
  )
}
