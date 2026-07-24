import { money, people, type Metro } from '../lib/types'

const TAX_LABELS: Record<string, string> = {
  property: 'Property',
  general_sales: 'General sales',
  selective_sales: 'Selective sales',
  licenses: 'Licenses',
  individual_income: 'Individual income',
  corporate_income: 'Corporate income',
  other_taxes: 'Other taxes',
}

const SPEND_LABELS: Record<string, string> = {
  education: 'Education',
  public_safety: 'Public safety',
  health: 'Health & hospitals',
  welfare: 'Welfare',
  transportation: 'Transportation',
  environment_housing: 'Environment & housing',
  administration: 'Administration',
  interest: 'Interest on debt',
  other: 'Other',
}

function Bars({
  title,
  data,
  labels,
}: {
  title: string
  data: Record<string, number>
  labels: Record<string, string>
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  const max = Math.max(...entries.map(([, v]) => v), 1)
  return (
    <div className="bars">
      <h3>{title}</h3>
      <ul>
        {entries.map(([k, v]) => (
          <li key={k}>
            <div className="bar-meta">
              <span>{labels[k] ?? k}</span>
              <span className="mono">{money(v)}/person</span>
            </div>
            <div className="bar-track" aria-hidden>
              <div className="bar-fill" style={{ width: `${(100 * v) / max}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface Props {
  metro: Metro | null
  nationalMedianTax: number
  nationalMedianSpend: number
}

export function MetroDetail({ metro, nationalMedianTax, nationalMedianSpend }: Props) {
  if (!metro) {
    return (
      <aside className="detail empty">
        <p>Select a metropolitan area on the map or search to see tax and spending composition.</p>
      </aside>
    )
  }

  const taxVs = metro.tax_per_capita - nationalMedianTax
  const spendVs = metro.spend_per_capita - nationalMedianSpend

  return (
    <aside className="detail">
      <p className="eyebrow">FY{metro.year} · CBSA {metro.cbsa}</p>
      <h2>{metro.name}</h2>
      <p className="lede">
        Local governments overlapping this metro collected{' '}
        <strong className="mono">{money(metro.tax_per_capita)}</strong> in taxes per resident and spent{' '}
        <strong className="mono">{money(metro.spend_per_capita)}</strong> per resident on direct general
        functions — a gap of <strong className="mono">{money(metro.gap_per_capita)}</strong> filled by
        charges, miscellaneous revenue, and state/federal transfers.
      </p>

      <div className="kpi-grid">
        <div>
          <span className="kpi-label">Tax / person</span>
          <span className="kpi-value mono">{money(metro.tax_per_capita)}</span>
          <span className="kpi-note">
            {taxVs >= 0 ? '+' : ''}
            {money(taxVs)} vs metro median
          </span>
        </div>
        <div>
          <span className="kpi-label">Spend / person</span>
          <span className="kpi-value mono">{money(metro.spend_per_capita)}</span>
          <span className="kpi-note">
            {spendVs >= 0 ? '+' : ''}
            {money(spendVs)} vs metro median
          </span>
        </div>
        <div>
          <span className="kpi-label">Population</span>
          <span className="kpi-value mono">{people(metro.population)}</span>
          <span className="kpi-note">{metro.n_gov_units.toLocaleString()} local gov units</span>
        </div>
        <div>
          <span className="kpi-label">IG share of own+IG</span>
          <span className="kpi-value mono">
            {metro.ig_share_of_own_plus_ig == null
              ? '—'
              : `${(100 * metro.ig_share_of_own_plus_ig).toFixed(1)}%`}
          </span>
          <span className="kpi-note">State + federal transfers</span>
        </div>
      </div>

      <Bars title="Tax composition / person" data={metro.tax_composition} labels={TAX_LABELS} />
      <Bars
        title="Direct general spend / person"
        data={metro.spend_composition}
        labels={SPEND_LABELS}
      />

      <p className="fineprint">
        Tax / person means local tax <em>collections</em> divided by resident population — not what a
        typical household remits. City-hall-only budgets are not shown; figures roll up counties,
        municipalities, townships, school districts, and special districts whose home county sits in
        the CBSA.
      </p>
    </aside>
  )
}
