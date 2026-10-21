import { useState } from 'react';

import { CONSENSUS, FY26_ESTIMATES, NINE_MONTHS_2026, Q1_27_GUIDE, PRICES, QUARTERS, SRC, type Source } from './data.ts';
import { RevenuePrice } from './RevenuePrice.tsx';
import { median, targetsAt } from './targets.ts';

const last = PRICES[PRICES.length - 1];
const prev = PRICES[PRICES.length - 2];
const change = last.close / prev.close - 1;
const usd = (v: number) => `$${v.toFixed(2)}`;
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%`;
const billions = (m: number) => `$${(m / 1000).toFixed(1)}B`;
const q3 = QUARTERS[QUARTERS.length - 1];
const coverage = targetsAt('oct21');
const med = median(coverage.map((r) => r.target));
const cite = (s: Source, text: string) => (s.url ? <a href={s.url} target="_blank" rel="noreferrer">{text}</a> : text);
const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function App() {
  const [notes, setNotes] = useState(false);
  return (
    <div className="portal" data-notes={notes ? '1' : undefined}>
      <header className="mast">
        <div className="mast-id">
          <span className="mast-tick">SPCX</span>
          <span className="mast-name">Space Exploration Technologies · Nasdaq</span>
        </div>
        <div className="mast-px">
          <span className="mast-last">{usd(last.close)}</span>
          <span className="mast-chg" data-sign={change >= 0 ? 'up' : 'down'}>{pct(change)} · {day(last.date)}{last.intraday ? `, ${last.intraday}` : ' close'}</span>
        </div>
      </header>

      <main>
        <RevenuePrice />

        <div className="more">
          <button type="button" className="more-toggle" aria-expanded={notes} onClick={() => setNotes(!notes)}>
            Reading notes
          </button>

          <details className="more-panel">
            <summary>
              Analyst coverage
              <span className="more-sum">{coverage.length} firms · median target ${med}</span>
            </summary>
            <div className="more-body">
              <table className="cov">
                <thead>
                  <tr><th scope="col">Firm</th><th scope="col">Rating</th><th scope="col">Target</th><th scope="col">Versus latest price</th><th scope="col">As of</th></tr>
                </thead>
                <tbody>
                  {coverage.map((r) => (
                    <tr key={r.firm}>
                      <th scope="row" title={r.source.label}>{cite(r.source, r.firm)}</th>
                      <td>{r.rating}</td>
                      <td>
                        ${r.target}
                        {r.before !== undefined && r.before !== r.target && <span className="cov-was">from ${r.before}</span>}
                      </td>
                      <td>{pct(r.target / last.close - 1)}</td>
                      <td>{day(r.since)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="more-est">
                {FY26_ESTIMATES.map((e) => `${e.firm} models 2026 revenue of ${billions(e.revenue)}, implying ${billions(e.revenue - NINE_MONTHS_2026)} in Q4`).join('; ')}, against {billions(q3.revenue)} in Q3.
                Management guided Q1 2027 revenue to ${Q1_27_GUIDE.low / 1000}–{Q1_27_GUIDE.high / 1000}B.
              </p>
              <p className="more-note">
                Targets as of Oct 21, 2026, after Q3 results; "from" is the target in force before the report. A Jul 7 date means the July initiation is the latest report found.
                J.P. Morgan and Morgan Stanley rows come from their research notes. StockAnalysis showed {CONSENSUS.analysts} analysts with a {usd(CONSENSUS.target)} average target on {day(CONSENSUS.asOf)}, before the post-Q3 changes.
              </p>
            </div>
          </details>

          <details className="more-panel">
            <summary>Sources</summary>
            <div className="more-body">
              <ul className="src">
                {(Object.values(SRC) as Source[]).filter((s, i, a) => !s.url || a.findIndex((o) => o.url === s.url) === i).map((s) => (
                  <li key={s.label}>{cite(s, s.label)}</li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      </main>
    </div>
  );
}
