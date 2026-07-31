import { SPECIES_COLOR, type Seasonality, type SpeciesKey } from '../lib/types'

type Props = {
  data: Seasonality | null
  species: Set<SpeciesKey>
  labels: Record<string, string>
}

export function HourStrip({ data, species, labels }: Props) {
  if (!data) return null
  const keys = species.size ? [...species] : (Object.keys(data.bySpeciesHour) as SpeciesKey[])
  const totals = Array.from({ length: 24 }, (_, h) =>
    keys.reduce((n, sp) => n + (data.bySpeciesHour[sp]?.[String(h)] || 0), 0),
  )
  const max = Math.max(1, ...totals)
  const color = keys.length === 1 ? SPECIES_COLOR[keys[0]] : '#7ec8e3'

  return (
    <div className="hour-strip">
      <div className="hour-label">
        Time of day
        <span>
          {keys.length === 1 ? labels[keys[0]] : 'selected species'} · report hour (local when present)
        </span>
      </div>
      <div className="hour-bars" aria-hidden>
        {totals.map((n, h) => (
          <div key={h} className="hour-bar-wrap" title={`${h}:00 · ${n}`}>
            <div
              className="hour-bar"
              style={{ height: `${(n / max) * 100}%`, background: color }}
            />
          </div>
        ))}
      </div>
      <div className="hour-axis">
        <span>0</span>
        <span>6</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
    </div>
  )
}
