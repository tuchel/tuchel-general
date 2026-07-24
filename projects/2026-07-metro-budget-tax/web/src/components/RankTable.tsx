import { useMemo, useState } from 'react'
import { formatMetric, money, people, pct, type MetricKey, type Metro } from '../lib/types'

interface Props {
  metros: Metro[]
  metric: MetricKey
  selected: string | null
  onSelect: (cbsa: string) => void
  onPin: (cbsa: string) => void
}

type SortKey =
  | MetricKey
  | 'population'
  | 'name'
  | 'city_hall_tax_per_capita'
  | 'tax_as_share_of_personal_income'

export function RankTable({ metros, selected, onSelect, onPin }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('tax_per_capita')
  const [asc, setAsc] = useState(false)

  const rows = useMemo(() => {
    const copy = [...metros]
    copy.sort((a, b) => {
      const av =
        sortKey === 'name'
          ? a.name
          : sortKey === 'tax_as_share_of_personal_income'
            ? a.tax_as_share_of_personal_income ?? -1
            : a[sortKey]
      const bv =
        sortKey === 'name'
          ? b.name
          : sortKey === 'tax_as_share_of_personal_income'
            ? b.tax_as_share_of_personal_income ?? -1
            : b[sortKey]
      if (typeof av === 'string' && typeof bv === 'string') {
        return asc ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return asc ? Number(av) - Number(bv) : Number(bv) - Number(av)
    })
    return copy
  }, [metros, sortKey, asc])

  function toggle(key: SortKey) {
    if (key === sortKey) setAsc((v) => !v)
    else {
      setSortKey(key)
      setAsc(key === 'name')
    }
  }

  return (
    <div className="rank" id="table">
      <div className="section-head">
        <h2>All areas in view</h2>
        <p>Dense sortable table — click a header to reorder; click a row to select.</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>
                <button type="button" onClick={() => toggle('name')}>
                  Area
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggle('population')}>
                  Population
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggle('tax_per_capita')}>
                  Tax / person
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggle('spend_per_capita')}>
                  Spend / person
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggle('tax_as_share_of_personal_income')}>
                  Tax / income
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggle('city_hall_tax_per_capita')}>
                  City-hall tax
                </button>
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr
                key={m.cbsa}
                className={m.cbsa === selected ? 'is-selected' : undefined}
                onClick={() => onSelect(m.cbsa)}
              >
                <td className="mono muted">{i + 1}</td>
                <td>
                  {m.name}
                  {!m.is_metro && <span className="micro-tag">micro</span>}
                </td>
                <td className="mono">{people(m.population)}</td>
                <td className="mono">{money(m.tax_per_capita)}</td>
                <td className="mono">{money(m.spend_per_capita)}</td>
                <td className="mono">{pct(m.tax_as_share_of_personal_income)}</td>
                <td className="mono">{money(m.city_hall_tax_per_capita)}</td>
                <td>
                  <button
                    type="button"
                    className="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      onPin(m.cbsa)
                    }}
                  >
                    Pin
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sr-only">
        Showing {rows.length} rows. Selected metric context: {formatMetric(rows[0], 'tax_per_capita')}
      </p>
    </div>
  )
}
