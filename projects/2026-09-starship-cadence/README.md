# Starship cadence to 2035

Explore Starship launch cadence from September 19, 2026 through December 31, 2035 using Falcon 9 launch history, empirical turnaround intervals, and editable scenario assumptions.

The public site includes annual, weekly, and cumulative forecasts; weekly Falcon cadence and decreasing turnaround S-curves; an interactive flight ledger; and downloadable observations, model outputs, and source links. Data is pinned through September 18, 2026. Forecast edits last for the page session; export CSV to retain inputs and outputs.

## Scope and evidence

- 688 Falcon 9 liftoffs, including failures and the January 2020 in-flight abort; excluding Falcon Heavy, hops, and the Amos-6 prelaunch loss.
- 663 certain booster identities and 602 consecutive same-booster intervals. Historical dates and serials come from Jonathan McDowell’s GCAT.
- 13 full-stack Starship attempts through July 24, 2026. The 2026 annual forecast includes two observed flights; cumulative future counts exclude them.
- Turnaround is launch-to-launch time, not hands-on refurbishment. Complete-interval selection introduces censoring bias.
- Scenario spread is not a calibrated statistical confidence interval. No probability mass is assigned to the three cases.

## Starter assumptions

| Parameter | Bearish | Baseline | Bullish |
| --- | ---: | ---: | ---: |
| Falcon fitted growth multiplier | 1× | 1.65× | 2.5× |
| Ramp delay from cutoff | 1.5 years | 0.75 years | 0.25 years |
| Long-run potential ceiling | 120/year | 1,500/year | 10,000/year |
| Flight-ready vehicle equivalents on Jan 1, 2036 | 8 | 30 | 100 |
| Turnaround on Jan 1, 2036 | 25 days | 5 days | 1 day |
| Operating availability | 65% | 80% | 90% |
| Initial potential rate | 6/year | 6/year | 6/year |
| Calculated 2035 launches (rounded) | 67 | 1,144 | 8,992 |

Growth uses Falcon’s logistic fit coefficient, approximately 0.681/year. Two initial vehicle equivalents and the 2026 Falcon median interval (41.27 days) initialize a geometric fleet/turnaround transition. Actual rate is availability times the smaller of logistic potential and vehicle capacity. An equivalent is effective flight capacity from production before reuse and from matched booster/ship availability after reuse. The model assumes net fleet growth after replacement losses; it does not independently forecast attrition or successful payload deliveries. Ceilings bundle demand, pad capacity, and permission to launch. They are analyst assumptions, not existing licenses or company guidance.

## Reproduce

Static app: no framework, runtime dependencies, API keys, or build step.

```sh
python3 -m http.server 5173 --bind 127.0.0.1 --directory dist
python3 scripts/prepare_data.py
node scripts/test_model.mjs
```

Data processing requires Python 3.9+, NumPy, and SciPy (fit generated with SciPy 1.13.1). The pinned raw catalogs are included; the script does not silently fetch new data. `notes/data-audit.json` records snapshot hashes, exclusions, annual totals, and fitted parameters. The app uses the checked-in JSON and a deterministic client-side model. All times are UTC; approximately timed catalog entries retain their catalog estimates.

## Files

- `dist/`: authored public assets and CSV/JSON data
- `scripts/prepare_data.py`: parsing, pairing, weekly aggregation, logistic fits
- `scripts/test_model.mjs`: scope, pairing, integration, units, and model invariant tests
- `notes/sources.md`: claims, evidence, derivations, limitations
- `notes/prior-art.md`: existing-tool comparison
- `.openai/hosting.json`: public Site identity and static directory

Publication uses an isolated project-only checkout to avoid including unrelated monorepo files in the hosted source. All authored project files remain in this repository on `cursor/starship-cadence`.

## Open questions

The first parameters to revisit are timing of routine ship reuse, achievable pad throughput, market demand beyond Starlink, and whether the bullish ceiling needs an explicit pad-by-pad rollout. A probabilistic forecast would require agreed distributions and correlations, plus validation that this analogy cannot currently provide.

## James curve and Falcon overlays

The James curve follows 12/year entering 2027, then year-end flight intervals of 14, 7, 3.5, and 1.5 days for 2027–2030. Cadence doubles annually from 2031 through 2035. Annual totals integrate the accelerating rate; the **Exit rate** view shows annualized year-end cadence. The post-2030 extension is dashed. James's direct cadence targets are independent of the other scenarios' fleet/availability constraints and sit outside the original scenario envelope.

On the Falcon weekly chart, toggle each Starship curve independently. Compare by calendar year or years since debut year (Falcon 2010; Starship 2023), using a linear or log(1 + rate) scale. Overlays track current scenario inputs. Forecast CSV exports include James, year-end rates, and the extension assumption.
