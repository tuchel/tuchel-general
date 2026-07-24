import { useMemo, useState } from 'react'
import { money, type Metro } from '../lib/types'

interface Props {
  metros: Metro[]
  selected: string | null
  onSelect: (cbsa: string) => void
}

export function NationalScatter({ metros, selected, onSelect }: Props) {
  const [hover, setHover] = useState<string | null>(null)

  const { points, xMax, yMax } = useMemo(() => {
    const xMax = Math.max(...metros.map((m) => m.tax_per_capita))
    const yMax = Math.max(...metros.map((m) => m.spend_per_capita))
    const popMax = Math.max(...metros.map((m) => m.population))
    const points = metros.map((m) => ({
      cbsa: m.cbsa,
      name: m.name,
      x: m.tax_per_capita,
      y: m.spend_per_capita,
      r: 3 + 10 * Math.sqrt(m.population / popMax),
    }))
    return { points, xMax, yMax }
  }, [metros])

  const W = 720
  const H = 420
  const pad = { t: 16, r: 16, b: 44, l: 56 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b

  const active = hover ?? selected
  const tip = points.find((p) => p.cbsa === active)

  return (
    <div className="scatter">
      <div className="section-head">
        <h2>Compared to what?</h2>
        <p>
          Each dot is a metro. Horizontal: local tax per person. Vertical: local spend per person.
          Dot size scales with population. The diagonal is tax = spend.
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Scatterplot of tax versus spend per person">
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
        {/* equality line */}
        {(() => {
          const lim = Math.min(xMax, yMax)
          const x1 = pad.l
          const y1 = H - pad.b
          const x2 = pad.l + (lim / xMax) * innerW
          const y2 = H - pad.b - (lim / yMax) * innerH
          return (
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#8a4b12"
              strokeDasharray="4 4"
              strokeOpacity={0.7}
            />
          )
        })()}
        <text x={W / 2} y={H - 10} textAnchor="middle" className="axis-label">
          Local tax / person →
        </text>
        <text
          x={16}
          y={H / 2}
          textAnchor="middle"
          className="axis-label"
          transform={`rotate(-90 16 ${H / 2})`}
        >
          Local spend / person →
        </text>
        {/* range-frame min/max labels */}
        <text x={pad.l} y={H - pad.b + 16} className="tick mono">
          {money(0)}
        </text>
        <text x={W - pad.r} y={H - pad.b + 16} textAnchor="end" className="tick mono">
          {money(xMax)}
        </text>
        <text x={pad.l - 8} y={H - pad.b} textAnchor="end" className="tick mono">
          {money(0)}
        </text>
        <text x={pad.l - 8} y={pad.t + 4} textAnchor="end" className="tick mono">
          {money(yMax)}
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
              r={isActive ? p.r + 1.5 : p.r}
              fill={isActive ? '#8a4b12' : '#0b5f6b'}
              fillOpacity={isActive ? 0.95 : 0.45}
              stroke="#f3efe6"
              strokeWidth={isActive ? 1.5 : 0.5}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover(p.cbsa)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect(p.cbsa)}
            >
              <title>
                {p.name}: tax {money(p.x)}, spend {money(p.y)}
              </title>
            </circle>
          )
        })}
      </svg>
      {tip && (
        <div className="scatter-tip mono">
          <strong>{tip.name}</strong>
          <span>Tax {money(tip.x)} · Spend {money(tip.y)}</span>
        </div>
      )}
    </div>
  )
}
