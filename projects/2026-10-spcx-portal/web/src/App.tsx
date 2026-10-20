import { useState } from 'react';

import { CONSENSUS, COVERAGE, PRICES, SRC } from './data.ts';
import { RevenuePrice } from './RevenuePrice.tsx';

const last = PRICES[PRICES.length - 1];
const prev = PRICES[PRICES.length - 2];
const change = last.close / prev.close - 1;
const usd = (v: number) => `$${v.toFixed(2)}`;
const pct = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%`;
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
          <span className="mast-chg" data-sign={change >= 0 ? 'up' : 'down'}>{pct(change)} · {day(last.date)} close</span>
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
              <span className="more-sum">{CONSENSUS.analysts} analysts · {CONSENSUS.rating} · {usd(CONSENSUS.target)} average target</span>
            </summary>
            <div className="more-body">
              <table className="cov">
                <thead>
                  <tr><th scope="col">Firm</th><th scope="col">Rating</th><th scope="col">Target</th><th scope="col">Versus last close</th></tr>
                </thead>
                <tbody>
                  {COVERAGE.map((r) => (
                    <tr key={r.firm}>
                      <th scope="row"><a href={r.source.url} target="_blank" rel="noreferrer">{r.firm}</a></th>
                      <td>{r.rating}</td>
                      <td>${r.target}</td>
                      <td>{pct(r.target / last.close - 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="more-note">
                Ratings and targets at initiation, July 7, 2026. The research notes themselves are distributed to each bank's clients.
                Consensus from <a href={CONSENSUS.source.url} target="_blank" rel="noreferrer">StockAnalysis</a>, {day(CONSENSUS.asOf)}.
              </p>
            </div>
          </details>

          <details className="more-panel">
            <summary>Sources</summary>
            <div className="more-body">
              <ul className="src">
                {Object.values(SRC).filter((s, i, a) => a.findIndex((o) => o.url === s.url) === i).map((s) => (
                  <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>
                ))}
              </ul>
            </div>
          </details>
        </div>
      </main>
    </div>
  );
}
