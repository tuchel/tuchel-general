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
  includeState?: boolean
}

export function MetroDetail({
  metro,
  nationalMedianTax,
  nationalMedianSpend,
  onPin,
  isPinned,
  includeState = false,
}: Props) {
  if (!metro) {
    return (
      <aside className="detail empty" id="detail">
        <p>Select a metropolitan area on the map or search to see tax and spending composition.</p>
      </aside>
    )
  }

  const taxPc = includeState
    ? (metro.local_plus_state_tax_per_capita ?? metro.tax_per_capita)
    : metro.tax_per_capita
  const spendPc = includeState
    ? (metro.local_plus_state_spend_per_capita ?? metro.spend_per_capita)
    : metro.spend_per_capita
  const gapPc = includeState
    ? (metro.local_plus_state_gap_per_capita ?? metro.gap_per_capita)
    : metro.gap_per_capita
  const taxVs = taxPc - nationalMedianTax
  const spendVs = spendPc - nationalMedianSpend
  const fisc = metro.fisc_style

  return (
    <aside className="detail" id="detail">
      <p className="eyebrow">
        FY{metro.year} · CBSA {metro.cbsa} · {metro.region}
        {includeState ? ' · local + modeled state' : ''}
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
        {includeState && metro.modeled_state_tax_per_capita != null && (
          <>
            {' '}
            With modeled state allocation, the composite is{' '}
            <strong className="mono">{money(taxPc)}</strong> tax and{' '}
            <strong className="mono">{money(spendPc)}</strong> spend per resident (gap{' '}
            <strong className="mono">{money(gapPc)}</strong>).
          </>
        )}
      </p>

      <div className="kpi-grid">
        <div>
          <span className="kpi-label">
            {includeState ? 'Local+state tax / person' : 'Tax / person'}{' '}
            <InfoTip
              label="Tax / person"
              what={
                includeState
                  ? 'Local tax collections plus state government tax allocated by CBSA share of state population, ÷ CBSA residents.'
                  : 'Local tax collections (property, sales, income, licenses, other) ÷ CBSA resident population for FY2022.'
              }
              why="Shows how much tax revenue the overlapping system raises relative to residents — collections, not household incidence."
            />
          </span>
          <span className="kpi-value mono">{money(taxPc)}</span>
          <span className="kpi-note">
            {taxVs >= 0 ? '+' : ''}
            {money(taxVs)} vs peer-set median
          </span>
        </div>
        <div>
          <span className="kpi-label">
            {includeState ? 'Local+state spend / person' : 'Spend / person'}{' '}
            <InfoTip
              label="Spend / person"
              what={
                includeState
                  ? 'Local direct general spend plus modeled state direct general spend allocated by population share.'
                  : 'Direct general expenditure (operations + construction + general interest + subsidies; utilities excluded) ÷ population.'
              }
              why="Captures the public-service footprint without double-counting intergovernmental payments between units."
            />
          </span>
          <span className="kpi-value mono">{money(spendPc)}</span>
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
            /person (BEA); local taxes only
          </span>
        </div>
        <div>
          <span className="kpi-label">Population</span>
          <span className="kpi-value mono">{people(metro.population)}</span>
          <span className="kpi-note">{metro.n_gov_units.toLocaleString()} local gov units</span>
        </div>
      </div>

      {includeState && metro.modeled_state_tax_per_capita != null && (
        <div className="contrast modeled">
          <h3>Modeled state allocation</h3>
          <p>
            State government share attributed here:{' '}
            <span className="mono">{money(metro.modeled_state_tax_per_capita)}</span> tax and{' '}
            <span className="mono">{money(metro.modeled_state_spend_per_capita ?? 0)}</span> spend per
            CBSA resident (population-share within each overlapping state). Local-only remains{' '}
            <span className="mono">{money(metro.tax_per_capita)}</span> /{' '}
            <span className="mono">{money(metro.spend_per_capita)}</span>.
          </p>
        </div>
      )}

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

      {fisc && (
        <div className="contrast fisc">
          <h3>
            FiSC-style central city{' '}
            <InfoTip
              label="FiSC-style"
              what="Simplified Lincoln-style standardization: central-city municipal finances plus the city’s population share of home-county overlays (county, schools, special districts), ÷ central-city population."
              why="Shows the pedagogical contrast between metro-wide CBSA rollups and a central-city “standardized city” ledger — not official Lincoln FiSC published figures."
            />
          </h3>
          <p>
            {fisc.central_city_name}
            {fisc.in_lincoln_fisc_list ? ' (on Lincoln FiSC list)' : ''}:{' '}
            <span className="mono">{money(fisc.tax_per_capita)}</span> tax and{' '}
            <span className="mono">{money(fisc.spend_per_capita)}</span> spend per{' '}
            <em>city</em> resident ({people(fisc.central_city_population)} people; city is{' '}
            {pct(fisc.city_share_of_county_population)} of home-county population). City-only
            municipal: <span className="mono">{money(fisc.city_only_tax_per_capita)}</span> /{' '}
            <span className="mono">{money(fisc.city_only_spend_per_capita)}</span>.
          </p>
          <p className="fineprint">{fisc.method}</p>
        </div>
      )}

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
