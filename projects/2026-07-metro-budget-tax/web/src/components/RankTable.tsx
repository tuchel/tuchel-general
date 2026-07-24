import { useMemo, useState } from 'react'
import { money, people, type MetricKey, type Metro, METRIC_LABELS } from '../lib/types'

interface Props {
  metros: Metro[]
  metric: MetricKey
  selected: string | null
  onSelect: (cbsa: string) => void
}

type SortKey = MetricKey | 'population' | 'name'

export function RankTable({ metros, metric, selected, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>(metric)
  const [asc, setAsc] = useState(false)

  const rows = useMemo(() => {
    const copy = [...metros]
    copy.sort((a, b) => {
      const av = sortKey === 'name' ? a.name : a[sortKey]
      const bv = sortKey === 'name' ? b.name : b[sortKey]
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
    <div className="rank">
      <div className="section-head">
        <h2>All metros</h2>
        <p>Sorted dense table — click a header to reorder; click a row to select.</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>
                <button type="button" onClick={() => toggle('name')}>
                  Metro
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggle('population')}>
                  Population
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggle('tax_per_capita')}>
                  {METRIC_LABELS.tax_per_capita}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggle('spend_per_capita')}>
                  {METRIC_LABELS.spend_per_capita}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggle('gap_per_capita')}>
                  {METRIC_LABELS.gap_per_capita}
                </button>
              </th>
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
                <td>{m.name}</td>
                <td className="mono">{people(m.population)}</td>
                <td className="mono">{money(m.tax_per_capita)}</td>
                <td className="mono">{money(m.spend_per_capita)}</td>
                <td className="mono">{money(m.gap_per_capita)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
