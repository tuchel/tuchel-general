import { useMemo, useState } from 'react'
import { formatMetric, money, people, pct, type MetricKey, type Metro } from '../lib/types'

interface Props {
  metros: Metro[]
  metric: MetricKey
  selected: string | null
  onSelect: (cbsa: string) => void
  onPin: (cbsa: string) => void
  includeState?: boolean
}

type SortKey =
  | MetricKey
  | 'population'
  | 'name'
  | 'city_hall_tax_per_capita'
  | 'tax_as_share_of_personal_income'
  | 'fisc_tax'

export function RankTable({
  metros,
  selected,
  onSelect,
  onPin,
  includeState = false,
}: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('tax_per_capita')
  const [asc, setAsc] = useState(false)

  const rows = useMemo(() => {
    const copy = [...metros]
    copy.sort((a, b) => {
      const val = (m: Metro): string | number => {
        if (sortKey === 'name') return m.name
        if (sortKey === 'tax_as_share_of_personal_income') {
          return m.tax_as_share_of_personal_income ?? -1
        }
        if (sortKey === 'fisc_tax') return m.fisc_style?.tax_per_capita ?? -1
        if (sortKey === 'tax_per_capita' && includeState) {
          return m.local_plus_state_tax_per_capita ?? m.tax_per_capita
        }
        if (sortKey === 'spend_per_capita' && includeState) {
          return m.local_plus_state_spend_per_capita ?? m.spend_per_capita
        }
        if (sortKey === 'gap_per_capita' && includeState) {
          return m.local_plus_state_gap_per_capita ?? m.gap_per_capita
        }
        return m[sortKey as keyof Metro] as number
      }
      const av = val(a)
      const bv = val(b)
      if (typeof av === 'string' && typeof bv === 'string') {
        return asc ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return asc ? Number(av) - Number(bv) : Number(bv) - Number(av)
    })
    return copy
  }, [metros, sortKey, asc, includeState])

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
        <p>
          Dense sortable table — click a header to reorder; click a row to select
          {includeState ? '. Tax/spend columns use local + modeled state.' : '.'}
        </p>
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
                  {includeState ? 'Local+state tax' : 'Tax / person'}
                </button>
              </th>
              <th>
                <button type="button" onClick={() => toggle('spend_per_capita')}>
                  {includeState ? 'Local+state spend' : 'Spend / person'}
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
              <th>
                <button type="button" onClick={() => toggle('fisc_tax')}>
                  FiSC-style tax
                </button>
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => {
              const tax = includeState
                ? (m.local_plus_state_tax_per_capita ?? m.tax_per_capita)
                : m.tax_per_capita
              const spend = includeState
                ? (m.local_plus_state_spend_per_capita ?? m.spend_per_capita)
                : m.spend_per_capita
              return (
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
                  <td className="mono">{money(tax)}</td>
                  <td className="mono">{money(spend)}</td>
                  <td className="mono">{pct(m.tax_as_share_of_personal_income)}</td>
                  <td className="mono">{money(m.city_hall_tax_per_capita)}</td>
                  <td className="mono">
                    {m.fisc_style ? money(m.fisc_style.tax_per_capita) : '—'}
                  </td>
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
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="sr-only">
        Showing {rows.length} rows. Selected metric context:{' '}
        {rows[0] ? formatMetric(rows[0], 'tax_per_capita', { includeState }) : '—'}
      </p>
    </div>
  )
}
