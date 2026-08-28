import type { Gym } from './lib/types'
import { driveMin } from './lib/score'
import { money, minutes } from './lib/format'

type Props = {
  gyms: Gym[]
  selectedId: string | null
  peak: boolean
  onSelect: (id: string) => void
  onHover: (id: string | null) => void
}

export function Scatter({ gyms, selectedId, peak, onSelect, onHover }: Props) {
  const priced = gyms.filter((g) => g.price.monthlyFrom != null)
  if (priced.length < 2) return <p className="empty">Need two clubs with a monthly number for the scatter.</p>

  const xs = priced.map((g) => driveMin(g, peak))
  const ys = priced.map((g) => g.price.monthlyFrom as number)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const padX = (maxX - minX) * 0.08 || 2
  const padY = (maxY - minY) * 0.12 || 40
  const x0 = minX - padX
  const x1 = maxX + padX
  const y0 = Math.max(0, minY - padY)
  const y1 = maxY + padY
  const W = 320
  const H = 168
  const L = 36
  const R = 8
  const T = 10
  const B = 28
  const x = (v: number) => L + ((v - x0) / (x1 - x0)) * (W - L - R)
  const y = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B)

  return (
    <figure className="scatter">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Monthly dues versus uncongested drive time from home">
        <line className="axis" x1={x(minX)} y1={y(y0)} x2={x(maxX)} y2={y(y0)} />
        <line className="axis" x1={x(x0)} y1={y(minY)} x2={x(x0)} y2={y(maxY)} />
        <text className="tick" x={x(minX)} y={H - 8} textAnchor="middle">
          {minutes(minX)}
        </text>
        <text className="tick" x={x(maxX)} y={H - 8} textAnchor="middle">
          {minutes(maxX)}
        </text>
        <text className="tick" x={4} y={y(minY) + 3}>
          {money(minY, 0)}
        </text>
        <text className="tick" x={4} y={y(maxY) + 3}>
          {money(maxY, 0)}
        </text>
        {priced.map((g) => {
          const cx = x(driveMin(g, peak))
          const cy = y(g.price.monthlyFrom as number)
          const club = g.tier === 'countryClub' || g.tier === 'membersClub'
          return (
            <g key={g.id}>
              <circle
                className={`pt${g.id === selectedId ? ' on' : ''}${club ? ' club' : ''}`}
                cx={cx}
                cy={cy}
                r={g.id === selectedId ? 6 : 4.5}
                onClick={() => onSelect(g.id)}
                onPointerEnter={() => onHover(g.id)}
                onPointerLeave={() => onHover(null)}
              />
              <text className="plab" x={cx + 7} y={cy + 3} onClick={() => onSelect(g.id)}>
                {g.short.replace('LT ', '')}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption>
        Vertical: quoted monthly (country-club dues omit initiation). Horizontal: drive from Ridgewood Road.
        {peak ? ' Peak × 1.7.' : ' OSRM free-flow.'}
      </figcaption>
    </figure>
  )
}
