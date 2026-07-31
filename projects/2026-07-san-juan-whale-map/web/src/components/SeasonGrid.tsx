import { MONTHS, SPECIES_COLOR, SPECIES_ORDER, type Seasonality, type SpeciesKey } from '../lib/types'

type Props = {
  data: Seasonality | null
  labels: Record<string, string>
  month: number | 'all'
  species: Set<SpeciesKey>
  onPick: (month: number, species: SpeciesKey) => void
}

export function SeasonGrid({ data, labels, month, species, onPick }: Props) {
  if (!data) return null
  const max = Math.max(
    1,
    ...SPECIES_ORDER.flatMap((sp) => Object.values(data.bySpeciesMonth[sp] || {}).map(Number)),
  )

  return (
    <div className="season-grid" role="table" aria-label="Sightings by species and month">
      <div className="season-row head" role="row">
        <div className="season-label" />
        {MONTHS.map((m, i) => (
          <div
            key={m}
            className={`season-cell head ${month === i + 1 ? 'active' : ''}`}
            role="columnheader"
          >
            {m}
          </div>
        ))}
      </div>
      {SPECIES_ORDER.map((sp) => {
        const row = data.bySpeciesMonth[sp] || {}
        return (
          <div className="season-row" key={sp} role="row">
            <div className="season-label" style={{ color: SPECIES_COLOR[sp] }} role="rowheader">
              {labels[sp] || sp}
            </div>
            {MONTHS.map((_, i) => {
              const m = i + 1
              const n = row[String(m)] || 0
              const t = n / max
              const active = (month === m || month === 'all') && (species.size === 0 || species.has(sp))
              return (
                <button
                  key={m}
                  type="button"
                  className={`season-cell ${active ? 'active' : ''}`}
                  style={{
                    background: `color-mix(in srgb, ${SPECIES_COLOR[sp]} ${Math.round(t * 85)}%, #0a1c28)`,
                  }}
                  title={`${labels[sp] || sp} · ${MONTHS[i]} · ${n} reports`}
                  onClick={() => onPick(m, sp)}
                >
                  {n > 0 ? n : ''}
                </button>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
