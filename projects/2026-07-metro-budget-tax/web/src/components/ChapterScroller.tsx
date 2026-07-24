import { useEffect, useMemo, useRef, useState } from 'react'
import { money, people, type Metro } from '../lib/types'

interface Step {
  id: string
  title: string
  body: string
}

interface Props {
  metro: Metro | null
  fallback: Metro
  nationalTaxMedian: number
  nationalSpendMedian: number
  includeState?: boolean
}

export function ChapterScroller({
  metro,
  fallback,
  nationalTaxMedian,
  nationalSpendMedian,
  includeState = false,
}: Props) {
  const m = metro ?? fallback
  const fisc = m.fisc_style
  const steps: Step[] = useMemo(() => {
    const tax = includeState
      ? (m.local_plus_state_tax_per_capita ?? m.tax_per_capita)
      : m.tax_per_capita
    const spend = includeState
      ? (m.local_plus_state_spend_per_capita ?? m.spend_per_capita)
      : m.spend_per_capita
    const gap = includeState
      ? (m.local_plus_state_gap_per_capita ?? m.gap_per_capita)
      : m.gap_per_capita
    const out: Step[] = [
      {
        id: 'ch-tax-spend',
        title: 'Two numbers that are not the same',
        body: `In ${m.name}, local governments collected ${money(m.tax_per_capita)} per resident in taxes and spent ${money(m.spend_per_capita)} per resident on direct general functions.${
          includeState && m.modeled_state_tax_per_capita != null
            ? ` With modeled state allocation, the composite is ${money(tax)} tax and ${money(spend)} spend (gap ${money(gap)}).`
            : ` The ${money(m.gap_per_capita)} gap is an accounting identity — filled by charges, miscellaneous own-source revenue, and state/federal transfers — not a metro “deficit.”`
        }`,
      },
      {
        id: 'ch-city-hall',
        title: 'Why “city budget” charts mislead',
        body: `If you only counted municipal (city hall) units, ${m.name} would show ${money(m.city_hall_tax_per_capita)} tax and ${money(m.city_hall_spend_per_capita)} spend per metro resident. The full overlapping local system is ${money(m.tax_per_capita)} and ${money(m.spend_per_capita)} — often several times larger once counties, schools, and special districts are included.`,
      },
    ]
    if (fisc) {
      out.push({
        id: 'ch-fisc',
        title: 'Central city, FiSC-style',
        body: `A Lincoln-style central-city ledger for ${fisc.central_city_name} (${people(fisc.central_city_population)} residents${
          fisc.in_lincoln_fisc_list ? ', on the Lincoln FiSC list' : ''
        }) puts tax at ${money(fisc.tax_per_capita)} and spend at ${money(fisc.spend_per_capita)} per city resident — municipal finances plus a population share of home-county overlays. That is a different denominator from the CBSA rollup (${money(m.tax_per_capita)} / ${money(m.spend_per_capita)} per metro resident). Simplified Census reconstruction — not published Lincoln FiSC figures.`,
      })
    }
    out.push(
      {
        id: 'ch-revenue',
        title: 'Where the money comes from',
        body: `Per resident in ${m.name}: taxes ${money(m.revenue_stack_per_capita.taxes)}, charges ${money(m.revenue_stack_per_capita.charges)}, miscellaneous ${money(m.revenue_stack_per_capita.misc)}, federal transfers ${money(m.revenue_stack_per_capita.ig_federal)}, state transfers ${money(m.revenue_stack_per_capita.ig_state)}. Tax / person means collections, not what a typical household remits.`,
      },
      {
        id: 'ch-spend',
        title: 'Where the money goes',
        body: `Direct general spending in ${m.name} is dominated by the functions below. Education and public safety usually lead; hospitals and interest can swing metro rankings. Median metro tax is ${money(nationalTaxMedian)}; median spend is ${money(nationalSpendMedian)}.`,
      },
    )
    return out
  }, [m, nationalTaxMedian, nationalSpendMedian, includeState, fisc])

  const [active, setActive] = useState(0)
  const stepRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!hit) return
        const idx = stepRefs.current.findIndex((el) => el === hit.target)
        if (idx >= 0) setActive(idx)
      },
      { rootMargin: '-30% 0px -30% 0px', threshold: [0.2, 0.5, 0.8] },
    )
    stepRefs.current.forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [steps])

  const revenue = Object.entries(m.revenue_stack_per_capita)
  const spend = Object.entries(m.spend_composition).sort((a, b) => b[1] - a[1])
  const cityVsFull = [
    { label: 'City hall only', tax: m.city_hall_tax_per_capita, spend: m.city_hall_spend_per_capita },
    { label: 'All local govs', tax: m.tax_per_capita, spend: m.spend_per_capita },
  ]
  const fiscIdx = steps.findIndex((s) => s.id === 'ch-fisc')
  const revenueIdx = steps.findIndex((s) => s.id === 'ch-revenue')
  const spendIdx = steps.findIndex((s) => s.id === 'ch-spend')

  return (
    <section className="scrolly" id="learn">
      <div className="scrolly-sticky" aria-live="polite">
        <p className="eyebrow">Learning chapters · {m.name}</p>
        <h2>{steps[active]?.title}</h2>
        <div className="scrolly-chart">
          {active === 0 && (
            <CompareBars
              items={[
                {
                  label: includeState ? 'Local+state tax' : 'Tax / person',
                  value: includeState
                    ? (m.local_plus_state_tax_per_capita ?? m.tax_per_capita)
                    : m.tax_per_capita,
                },
                {
                  label: includeState ? 'Local+state spend' : 'Spend / person',
                  value: includeState
                    ? (m.local_plus_state_spend_per_capita ?? m.spend_per_capita)
                    : m.spend_per_capita,
                },
              ]}
            />
          )}
          {active === 1 && (
            <div className="dual-bars">
              {cityVsFull.map((row) => (
                <div key={row.label}>
                  <p className="bar-group-label">{row.label}</p>
                  <CompareBars
                    items={[
                      { label: 'Tax', value: row.tax },
                      { label: 'Spend', value: row.spend },
                    ]}
                  />
                </div>
              ))}
            </div>
          )}
          {fisc && active === fiscIdx && (
            <CompareBars
              items={[
                { label: 'CBSA tax / metro resident', value: m.tax_per_capita },
                { label: 'FiSC-style tax / city resident', value: fisc.tax_per_capita },
                { label: 'CBSA spend / metro resident', value: m.spend_per_capita },
                { label: 'FiSC-style spend / city resident', value: fisc.spend_per_capita },
              ]}
            />
          )}
          {active === revenueIdx && (
            <CompareBars
              items={revenue.map(([k, v]) => ({
                label: k.replaceAll('_', ' '),
                value: v,
              }))}
            />
          )}
          {active === spendIdx && (
            <CompareBars
              items={spend.slice(0, 6).map(([k, v]) => ({
                label: k.replaceAll('_', ' '),
                value: v,
              }))}
            />
          )}
        </div>
      </div>
      <div className="scrolly-steps">
        {steps.map((step, i) => (
          <article
            key={step.id}
            id={step.id}
            ref={(el) => {
              stepRefs.current[i] = el
            }}
            className={i === active ? 'is-active' : undefined}
          >
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function CompareBars({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className="compare-bars">
      {items.map((item) => (
        <li key={item.label}>
          <div className="bar-meta">
            <span>{item.label}</span>
            <span className="mono">{money(item.value)}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(100 * item.value) / max}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}
