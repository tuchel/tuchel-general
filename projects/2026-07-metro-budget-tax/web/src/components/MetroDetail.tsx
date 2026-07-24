import { InfoTip } from './InfoTip'
import { money, people, pct, type Metro } from '../lib/types'

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
  onPin: (cbsa: string) => void
  isPinned: boolean
}

export function MetroDetail({
  metro,
  nationalMedianTax,
  nationalMedianSpend,
  onPin,
  isPinned,
}: Props) {
  if (!metro) {
    return (
      <aside className="detail empty" id="detail">
        <p>Select a metropolitan area on the map or search to see tax and spending composition.</p>
      </aside>
    )
  }

  const taxVs = metro.tax_per_capita - nationalMedianTax
  const spendVs = metro.spend_per_capita - nationalMedianSpend

  return (
    <aside className="detail" id="detail">
      <p className="eyebrow">
        FY{metro.year} · CBSA {metro.cbsa} · {metro.region}
      </p>
      <div className="detail-head">
        <h2>{metro.name}</h2>
        <button type="button" onClick={() => onPin(metro.cbsa)} disabled={isPinned}>
          {isPinned ? 'Pinned' : 'Pin to compare'}
        </button>
      </div>
      <p className="lede">
        Local governments overlapping this area collected{' '}
        <strong className="mono">{money(metro.tax_per_capita)}</strong> in taxes per resident and spent{' '}
        <strong className="mono">{money(metro.spend_per_capita)}</strong> per resident on direct general
        functions — a gap of <strong className="mono">{money(metro.gap_per_capita)}</strong> filled by
        charges, miscellaneous revenue, and transfers.
      </p>

      <div className="kpi-grid">
        <div>
          <span className="kpi-label">
            Tax / person{' '}
            <InfoTip
              label="Tax / person"
              what="Local tax collections (property, sales, income, licenses, other) ÷ CBSA resident population for FY2022."
              why="Shows how much tax revenue the overlapping local system raises relative to residents — collections, not household incidence."
            />
          </span>
          <span className="kpi-value mono">{money(metro.tax_per_capita)}</span>
          <span className="kpi-note">
            {taxVs >= 0 ? '+' : ''}
            {money(taxVs)} vs peer-set median
          </span>
        </div>
        <div>
          <span className="kpi-label">
            Spend / person{' '}
            <InfoTip
              label="Spend / person"
              what="Direct general expenditure (operations + construction + general interest + subsidies; utilities excluded) ÷ population."
              why="Captures the local public-service footprint without double-counting intergovernmental payments between units."
            />
          </span>
          <span className="kpi-value mono">{money(metro.spend_per_capita)}</span>
          <span className="kpi-note">
            {spendVs >= 0 ? '+' : ''}
            {money(spendVs)} vs peer-set median
          </span>
        </div>
        <div>
          <span className="kpi-label">Tax / personal income</span>
          <span className="kpi-value mono">{pct(metro.tax_as_share_of_personal_income)}</span>
          <span className="kpi-note">
            Income {metro.personal_income_per_capita != null ? money(metro.personal_income_per_capita) : '—'}
            /person (BEA)
          </span>
        </div>
        <div>
          <span className="kpi-label">Population</span>
          <span className="kpi-value mono">{people(metro.population)}</span>
          <span className="kpi-note">{metro.n_gov_units.toLocaleString()} local gov units</span>
        </div>
      </div>

      <div className="contrast">
        <h3>City hall only vs full local system</h3>
        <p>
          Municipal units alone: <span className="mono">{money(metro.city_hall_tax_per_capita)}</span> tax
          and <span className="mono">{money(metro.city_hall_spend_per_capita)}</span> spend per metro
          resident. Full overlapping system: <span className="mono">{money(metro.tax_per_capita)}</span> /{' '}
          <span className="mono">{money(metro.spend_per_capita)}</span>. City-hall-only is intentionally
          incomplete.
        </p>
      </div>

      {metro.history.length > 1 && (
        <div className="history">
          <h3>2017 → 2022</h3>
          <ul>
            {metro.history.map((h) => (
              <li key={h.year} className="mono">
                FY{h.year}: tax {money(h.tax_per_capita)} · spend {money(h.spend_per_capita)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Bars title="Tax composition / person" data={metro.tax_composition} labels={TAX_LABELS} />
      <Bars
        title="Direct general spend / person"
        data={metro.spend_composition}
        labels={SPEND_LABELS}
      />

      <p className="fineprint">
        Tax / person means local tax <em>collections</em> divided by resident population — not what a
        typical household remits. Figures roll up counties, municipalities, townships, school
        districts, and special districts whose home county sits in the CBSA.
      </p>
    </aside>
  )
}
