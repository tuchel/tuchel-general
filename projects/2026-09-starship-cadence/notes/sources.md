# Evidence and calculation notes

Cutoff: September 18, 2026 inclusive, UTC. Acquisition: September 18, 2026 local time. The site is a dated analytical snapshot with no automatic refresh.

## Flight records

Primary compiled catalog: [Jonathan McDowell, GCAT, Falcon family](https://planet4589.org/space/gcat/data/launch/Falcon9.html), catalog updated 2026-09-18 07:30 UTC. The source is an independent observational compilation with row-level citations, not an official SpaceX maintenance database. Raw bytes and SHA-256 are retained.

Parse the catalog’s fixed-width header positions, rather than split on arbitrary whitespace. Select exactly Falcon 9. Exclude launch code OE (Amos-6 prelaunch explosion), include the actual January 19, 2020 in-flight abort liftoff, and include failures. This yields 688 liftoffs. GCAT's F689 identifier includes the Amos-6 scheduled mission; subtracting that prelaunch loss leaves 688 actual liftoffs.

Weekly bins are Monday–Sunday UTC and include zero-launch weeks, beginning January 4, 2010. The last complete week begins September 7, 2026. A 13-week trailing mean yields 2.846 flights/week. Fit raw weekly counts to L / (1 + exp(-k*(year-midpoint))) by bounded nonlinear least squares, with L in [0.1,20], k in [0.01,3], midpoint in [2010,2040]. The fitted rate is ~0.681/year; the fit is descriptive and autocorrelation/overdispersion preclude naive inferential interpretation of R².

Booster serials with a question mark are treated as uncertain. Unsuffixed known serials are treated as first flights. Pair only the same serial with adjacent flight numbers; do not bridge an intervening Falcon Heavy flight or any numbering gap. Derive intervals in days from UTC timestamps. The 602 valid intervals include the first SES-10 reflight (356.0719 days) and B1088's March 12–21, 2025 pair (9.1519 days). 2026 has 104 pairs and median 41.2719 days.

Quarterly medians and 10th–90th percentiles use completed intervals grouped by the later launch. Fit only complete quarters with at least 3 pairs. Fix the descending logistic's upper asymptote to the first observed interval (356.0719 days); estimate floor, k, midpoint. This stabilization is an explicit fit assumption: a free four-parameter curve has an unidentifiable upper plateau in these data. Bounds: floor [0,200] days, k [.01,5]/year, midpoint [2015,2027]. Sparse quarters and partial Q3 2026 remain plotted, excluded from the fit. R² is ~0.76 on eligible quarterly medians. The 10–90% band is empirical dispersion, not confidence limits.

Counter-evidence/limits: the launch rate softens in 2026; median turnaround is not monotonically decreasing; mission scheduling and growing fleets confound the interpretation. Faster refurbishment cannot be inferred from every shorter launch interval. Never-reflown vehicles have censored intervals. Some catalog times are estimates. No claim of a full maintenance-duration dataset is made.

## Starship observed starting point

[GCAT Starship catalog](https://planet4589.org/space/gcat/data/launch/Starship.html), updated September 16, 2026. Select named full-stack Starship Flights 1–13, exclude prototype hops and accidental post-landing explosion. Counts: 2023=2, 2024=4, 2025=5, 2026=2. Latest: July 24, 2026. A future scheduled test is not an observed flight. Counts measure launch attempts, not successful orbital missions.

## Refurbishment evidence

[SpaceX Falcon User's Guide, May 2025](https://www.spacex.com/assets/media/falcon-users-guide-2025-05-09.pdf) describes refurbishment facilities and operations; it does not expose per-flight time sheets.

[Jeff Foust's September 11, 2018 conference account, reproduced in Spaceflight Now's September 12 report](https://spaceflightnow.com/2018/09/12/another-recovered-falcon-9-booster-arrives-back-in-port/) reports Gwynne Shotwell's claim that Block 5 refurbishment had reached four weeks. Label as a dated management statement rather than measured time series. The same contemporaneous report records a one-day reflight target for 2019; the observed record in this dataset is still 9.15 days in 2025, illustrating why targets are not evidence of realized cadence.

## Aspirations and operating constraints

[SpaceX Starship vehicle page](https://new.spacex.com/vehicles/starship) describes both stages returning and rapid relaunch without refurbishment. This is a stated design objective, not routine achieved capability.

[FAA, Kennedy LC-39A final EIS page](https://www.faa.gov/space/stakeholder_engagement/spacex_starship_ksc), updated January 30, 2026: review covers up to 44 Starship launches/year. It explicitly states that completed environmental review does not guarantee an operating license.

[FAA general statements](https://www.faa.gov/newsroom/statements/general-statements), May 2025: Boca Chica license modified for up to 25 launches/year. This dated statement is not presented as an exhaustive September 2026 network-wide legal cap. Later documents were searched; current review scope and flight licensing are separate.

The scenario ceilings of 120, 1,500, and 10,000/year require different future infrastructure and permissions. They are deliberately chosen analyst scenarios, not sourced SpaceX forecasts. All cases assume funding and demand; cancellation is outside the band.

## Model boundaries

Full source formula is in `dist/model.js`. Annual output uses 104 midpoint samples per year; tests compare with independent 10,000-sample integration. Year 2026 adds observed flights only to annual/weekly totals. Cumulative output counts only future flights beginning September 19, 2026. All parameters, including current edits, accompany the downloadable forecast CSV.

The forecast's gray envelope is the min/max across three deterministic cases. It is not a probability interval and cannot support an asserted 80% or 90% coverage. The baseline is a starting scenario, not an empirically identified median outcome.

## James milestones and overlay comparison

User-supplied achieved cadence: 12/year entering 2027; one flight every 14 days at end-2027, 7 days at end-2028, 3.5 days at end-2029, and 1.5 days at end-2030. The user explicitly selected annual doubling for 2031–2035. Interpret “in 2030” as year-end, consistent with the preceding milestones.

Interpolate log-linearly in flight rate between milestones and integrate exactly over each year. Rates in days use 365.25 days/year consistently with the existing model. Year-end 2027 therefore means rate at January 1, 2028, not 26 launches during the whole calendar year. The 2026 bridge is an analyst assumption: it grows from the observed 2026 YTD annualized rate at the data cutoff to 12/year entering 2027. James is a direct operating-cadence hypothesis, so the original model's downtime and fleet constraints are not applied again. Annual totals are approximately 18, 38, 75, 164 for 2027–2030 and 5,621 for 2035; exit-2035 rate is 7,792/year. The dashed post-2030 segment identifies the requested doubling extension. The original three-case envelope excludes James.

Falcon-chart overlays use instantaneous modeled operating rate × 7/365.25, in flights/week, with independent toggles for bearish, baseline, bullish, and James. The age comparison aligns debut calendar years (Falcon 9 2010; full-stack Starship 2023), not first-reuse dates or exact first-flight anniversaries. Calendar alignment preserves actual dates. Optional log(1 + rate) scaling preserves zero-launch weeks. No Falcon fit is extrapolated beyond its observed window. Editing a model scenario refreshes its active overlay.
