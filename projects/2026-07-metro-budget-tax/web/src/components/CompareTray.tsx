import { money, pct, type Metro } from '../lib/types'

interface Props {
  pinned: Metro[]
  onUnpin: (cbsa: string) => void
  onClear: () => void
}

export function CompareTray({ pinned, onUnpin, onClear }: Props) {
  if (!pinned.length) return null
  return (
    <section className="compare-tray" id="compare" aria-label="Compare metros">
      <div className="section-head row">
        <div>
          <h2>Compare</h2>
          <p>Pinned metros, aligned on shared scales.</p>
        </div>
        <button type="button" className="ghost" onClick={onClear}>
          Clear
        </button>
      </div>
      <div className="compare-grid">
        {pinned.map((m) => (
          <article key={m.cbsa} className="compare-card">
            <header>
              <h3>{m.name}</h3>
              <button type="button" className="ghost" onClick={() => onUnpin(m.cbsa)}>
                Remove
              </button>
            </header>
            <dl>
              <div>
                <dt>Tax / person</dt>
                <dd className="mono">{money(m.tax_per_capita)}</dd>
              </div>
              <div>
                <dt>Spend / person</dt>
                <dd className="mono">{money(m.spend_per_capita)}</dd>
              </div>
              <div>
                <dt>Gap</dt>
                <dd className="mono">{money(m.gap_per_capita)}</dd>
              </div>
              <div>
                <dt>Tax / income</dt>
                <dd className="mono">{pct(m.tax_as_share_of_personal_income)}</dd>
              </div>
              <div>
                <dt>City-hall tax</dt>
                <dd className="mono">{money(m.city_hall_tax_per_capita)}</dd>
              </div>
              <div>
                <dt>IG share</dt>
                <dd className="mono">{pct(m.ig_share_of_own_plus_ig)}</dd>
              </div>
            </dl>
            <Spark history={m.history} />
          </article>
        ))}
      </div>
    </section>
  )
}

function Spark({
  history,
}: {
  history: Metro['history']
}) {
  if (history.length < 2) return null
  const vals = history.map((h) => h.tax_per_capita)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const w = 160
  const h = 36
  const pts = vals
    .map((v, i) => {
      const x = (i / (vals.length - 1)) * w
      const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2
      return `${x},${y}`
    })
    .join(' ')
  return (
    <div className="spark">
      <span className="eyebrow">Tax / person {history[0].year}→{history[history.length - 1].year}</span>
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden>
        <polyline fill="none" stroke="#0b5f6b" strokeWidth="2" points={pts} />
      </svg>
    </div>
  )
}
