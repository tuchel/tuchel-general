# Metro Budget & Tax Explorer — Project Plan

**Status:** Phases 0–4 complete (full prototype) + Phase 3 extras (modeled state allocation, FiSC-style central city)  
**Goal:** A rich, interactive infographic web page that lets anyone explore **effective local budget (spending) and tax per person** across every US metropolitan area — and actually learn what those numbers mean.

### Run the app

```bash
cd projects/2026-07-metro-budget-tax/web
npm install
npm run dev
```

Dev server URL includes the Pages base path:  
`http://localhost:5173/tuchel-general/tax/`

### Live site

After merge to `main`, GitHub Actions deploys to:

**https://tuchel.github.io/tuchel-general/tax/**

Root `https://tuchel.github.io/tuchel-general/` redirects there. Manual redeploy: Actions → “Deploy Metro Budget & Tax Explorer” → Run workflow.
### Rebuild data

```bash
bash pipeline/download_raw.sh
pip install -r pipeline/requirements.txt
python3 pipeline/build_dataset.py
python3 pipeline/build_geojson.py
python3 pipeline/phase3_extras.py
python3 pipeline/check_anchors.py
cp data/metros_web.json data/cbsa_metros.geojson web/public/data/
```

### What’s in the prototype

- FY2022 + FY2017 history, 387 metros (+ optional 538 micros)
- Tax / spend / gap / tax-as-share-of-personal-income metrics
- Optional modeled state tax/spend allocation (population-share within state)
- FiSC-style central-city contrast (Census reconstruction; Lincoln list flag)
- Scrollytelling chapters (tax≠spend, city-hall contrast, FiSC-style, revenue, spend)
- Peer filters (region, population), compare tray (up to 4), rank table
- BEA personal income join; city-hall-only contrast; floating TOC; KPI info-tips
- Audit anchors (~96% recovery of published US local tax)

Phase 0 audit (FY2022): CBSA rollup recovers **~$862B** of the published **~$894B** US local tax total (~96%). See `data/audit.md`.

This plan remains the build bible; the sections below describe the product design.

---

## 1. Product thesis

Most “city budget” charts lie by omission: they show the **municipal government alone**, ignoring counties, school districts, and special districts that often spend more than city hall. Most “tax burden” charts conflate **where money is collected** with **who pays**.

This page’s job is to make the honest comparison legible:

> **For each metro area, how much do overlapping local governments spend per resident, how much tax revenue do they raise per resident, and where does the gap come from?**

Users should leave able to answer:

1. Which metros spend the most / least per person — and on what?
2. Which raise the most / least tax per person — and from which bases (property, sales, income, other)?
3. Where spending diverges from local tax (fees, charges, state/federal transfers)?
4. How a chosen metro compares to peers of similar size and income?
5. Why two metros with similar tax-per-person can feel fiscally very different?

---

## 2. Definitions (load-bearing — surface these in the UI)

Every number on the page must carry a **dimension tag** in the same sentence / tooltip.

| Metric | Definition | Dimension tag |
|---|---|---|
| **Local spending per person** | Sum of general expenditures of local governments whose counties sit inside the CBSA, ÷ CBSA resident population | *local-gov spending / resident; FY{year}; nominal unless toggled* |
| **Local tax per person** | Sum of local tax collections (property + general sales + selective sales + individual income + corporate + other taxes) inside the CBSA ÷ population | *local tax collections / resident — not incidence* |
| **Own-source revenue per person** | Taxes + charges + miscellaneous general revenue (excludes intergovernmental transfers) ÷ population | *own-source* |
| **Transfer-financed share** | Intergovernmental revenue ÷ general revenue | *% of general revenue from state/federal* |
| **Tax as % of personal income** | Local tax ÷ BEA MSA personal income (or ACS when BEA missing) | *collections / personal income* |
| **Effective budget gap** | Spending per person − tax per person | *accounting identity, not “deficit”* |

### Explicit non-claims (must appear in methodology + first educational beat)

- **Not** household tax burden / incidence (commuters, tourists, and business remittances distort collections ≠ payments by residents).
- **Not** total government footprint (state and federal spending inside the metro is excluded from the default local view; an optional “allocated state share” mode is Phase 2 and labeled modeled).
- **Not** city-government-only (that view is available as a contrast mode, clearly labeled “city hall only — incomplete”).
- **Not** real-time budgets — Census finance years lag; primary year is the latest Census of Governments / Annual Survey year with usable individual-unit coverage.

---

## 3. Geographic unit

- **Primary unit:** OMB **Metropolitan Statistical Areas (MSAs)** — all ~380+ metros.
- **Optional toggle:** include **Micropolitan** Statistical Areas.
- **Crosswalk:** county → CBSA via current OMB delineation file (Census metro-micro delineation).
- **Population denominator:** Census Population Estimates Program CBSA totals for the matching July 1 year (or nearest).
- **Multi-state metros:** keep whole CBSA; show state composition in the detail drawer (e.g. Kansas City MO-KS).

Do **not** default to Combined Statistical Areas (CSAs) — too coarse for “my metro” mental models. Offer CSA as advanced grouping later if needed.

---

## 4. Data architecture

### 4.1 Source stack

| Layer | Source | Role |
|---|---|---|
| A | **Census Annual Survey of State & Local Government Finances** individual-unit files + GID directory | Revenue, expenditure, debt by government unit and item code |
| B | Prefer **Census of Governments** finance years (quinquennial; e.g. 2022) for fullest local coverage; use intervening annual survey years with explicit sample/imputation caveats | Coverage quality |
| C | Census **GID** → FIPS state/county/place | Geography join |
| D | OMB/Census **CBSA delineation** (county components) | Metro rollup |
| E | Census **CBSA population estimates** | Per-person denominator |
| F | **BEA** personal income by MSA | Tax / income normalization |
| G | ACS 5-year (median household income, poverty, tenure) | Context covariates |
| H | Census **Cartographic Boundary** CBSA polygons | Map |
| I | **Lincoln Institute FiSC** (≈212 large cities) | Validation + “central city deep dive” mode — not the universe |
| J | Urban Institute / Tax Policy Center SLF series | Sanity checks vs published state aggregates |

### 4.2 Aggregation method (the hard part)

For each CBSA and fiscal year:

1. Identify all **counties** in the CBSA.
2. Select all **local government units** in the GID whose home county is in that set (municipalities, townships, counties, independent school districts, special districts).
3. Sum Census item codes into canonical buckets (see §4.3).
4. Divide by CBSA population.
5. Flag units that are known metro-spanning special districts whose GID county under/over-assigns (transit authorities, airports). Document allocation rule: **default = assign 100% to the GID home county’s CBSA**; publish a sensitivity note. FiSC methodology (population-share allocation) is the refinement path for Phase 2.

**State governments** are excluded from the default metro total (they are not local). Phase 2 optional overlay: allocate each state’s general expenditure / tax to MSAs by share of state population or personal income — labeled **modeled state allocation**.

### 4.3 Canonical metric buckets

**Taxes (local collections)**

- Property (`T01`)
- General sales
- Selective sales (fuel, alcohol, tobacco, public utilities, other)
- Individual income
- Corporate income
- Other taxes

**Other revenue**

- Current charges (utilities, hospitals, education charges, other)
- Miscellaneous general revenue
- Intergovernmental — from state / from federal

**Expenditures (functional)**

- Education (elementary & secondary + higher if local)
- Public safety (police, fire, corrections)
- Health & hospitals
- Welfare / social services
- Transportation (highways, transit)
- Environment & housing (parks, sewerage, solid waste, natural resources)
- Government administration
- Interest on debt
- Utilities (shown separately; optional “including enterprise” toggle)
- Other / residual

Keep a machine-readable `item_code_map.yml` so every UI number traces to Census codes.

### 4.4 Build-time pipeline (not browser-side ETL)

```
raw Census downloads
  → Python (pandas/polars) clean + join GID + CBSA
  → validate against Urban/Lincoln anchors
  → emit:
      metros.parquet / metros.json   # one row per CBSA × year
      composition.json               # nested revenue/spend shares
      peers.json                     # optional precomputed peer sets
  → web app loads static artifacts (no live Census API required)
```

Ship a short `data/audit.md` with:

- National sum of rolled-up local tax ≈ published US local tax total (± tolerance)
- Spot checks: NYC, SF, Houston, Chicago vs FiSC / published CAFRs (order-of-magnitude)
- Coverage: % of CBSA population with imputed vs reported units
- Known broken metros (list)

### 4.5 Honest coverage limits (UI must disclose)

- Annual survey years are **samples** with imputation — choropleths for non-CoG years should show a coverage indicator.
- Special-district geography is imperfect.
- School district boundaries ≠ counties; assigning by GID county is standard but imperfect for districts crossing CBSA edges.
- Puerto Rico / territories: decide include/exclude up front (recommend **US states + DC metros only** for v1).

---

## 5. Learning design — page narrative

This is an **explainer with a live tool**, not a dashboard dumped on the user. Structure as chapters that unlock understanding, then open into free exploration.

### Chapter 0 — First viewport (hero)

One composition:

- Title: e.g. **“What does your metro spend — and tax — per person?”**
- One supporting sentence defining the two headline metrics.
- One primary CTA: **Find my metro** (search) + secondary **Explore the map**.
- Dominant visual: full-bleed US metro choropleth (or a single elegant national distribution chart as background plane) — not a collage of cards/stats.

No KPI strip, no “key findings” chips in the hero.

### Chapter 1 — Two numbers that are not the same

Sticky scrollytelling:

- Left/right or stacked comparison of **tax per person** vs **spend per person** nationally.
- Reveal the gap and name its sources (charges, transfers).
- Interactive: user picks a metro mid-scroll; the sticky chart re-anchors.

### Chapter 2 — Why “city budget” charts mislead

Show one metro (e.g. Dayton or a FiSC example) as **city hall only** vs **all overlapping local governments**. This is the pedagogical kill shot — borrows the FiSC insight without limiting the product to 212 cities.

### Chapter 3 — Where the money comes from

Stacked composition of tax bases + charges + transfers. User can switch metros; small-multiples of peer metros optional.

### Chapter 4 — Where the money goes

Functional expenditure breakdown. Same interaction pattern as Ch. 3 for cognitive continuity.

### Chapter 5 — Compared to what?

Scatter: tax/person (x) vs spend/person (y), point size = population, color = region or income quartile. Brush to filter. Click → detail.

Secondary scatters (tabs or small multiples):

- Tax/person vs personal income/person
- Spend/person vs median home value / share renter (ACS)
- Education spend/person vs child share of population (if available)

### Chapter 6 — Free exploration workbench

Persistent app shell:

1. **Map** (choropleth of selected metric)
2. **Ranked table** (sortable, filterable, dense — Tufte: table > card grid)
3. **Metro detail panel** (composition, peers, sparklines across years if multi-year)
4. **Compare tray** (pin 2–4 metros)

### Closing — Methodology & caveats

Full chain-of-custody: sources, year, aggregation rules, what we are not measuring. Link to `data/audit.md` summary.

---

## 6. Interaction model (required behaviors)

Per repo chart discipline + Tufte skill (`skills/tufte design/SKILL.md` — **mandatory before shipping any viz**):

### Controls

- **Metro search** (typeahead: name, principal city, state)
- **Metric selector:** tax/person | spend/person | gap | tax/income | transfer share | functional spend buckets
- **Year selector** (if multi-year; v1 can be single latest CoG year with a disabled control labeled for future)
- **Normalization toggle:** per person (default) | % of personal income | total $
- **Inflation toggle** (if multi-year): nominal vs CPI-adjusted
- **Peer filter:** population band, income band, Census region/division, same state
- **Include micropolitans** (off by default)
- Every range slider (if any) must be **bound-grounded** (what min/max mean physically + live interpretation)

### Feedback

- Hover tooltips on every metro polygon, scatter point, bar, and table-adjacent sparkline — rich content (≥3 of: title, raw value, derived value, source year, note). Hit target ≥ 12px.
- URL state (`?metro=31080&metric=tax_pc`) for shareable deep links.
- Keyboard: `/` focuses search; `Esc` clears selection.

### Compare mode

Pin metros → aligned dense table of headline metrics + mirrored composition bars (small multiples, shared scale).

---

## 7. Visual / UX direction

Apply Tufte first; then personal frontend rules:

- **Data-ink over chrome.** No decorative card grids for the unit of analysis — prefer a dense ranked table + map + one focus chart.
- **Single-hue sequential scales** for choropleths (light→dark). No rainbow for sequential metrics. Diverging scale only for gap / vs-national-average.
- **Range-frame axes** on charts; min/max labels at data extents.
- **Typography:** expressive, purposeful pairing (not default Inter/Roboto/system). Distinct display face for chapter titles; readable sans for UI/data; mono for figures and codes.
- **Atmosphere:** subtle paper texture or restrained cartographic base — not flat gray void, not purple-gradient AI default, not cream+terracotta brochure look.
- **Motion:** 2–3 intentional motions only — e.g. chapter sticky-chart fade (≤200ms linear), map selection pulse, compare-tray slide. No bounce.
- **Mobile:** search + ranked list first; map collapses to secondary; detail full-screen sheet.
- **Accessibility:** WCAG AA contrast on data encodings where possible; never color-only (pattern/position backup); screen-reader text for selected metro summary.

This page is a **data exploration tool**, so dense multi-panel layouts after Chapter 0 are appropriate. The hero still obeys “one composition.”

---

## 8. Technical stack (recommended)

| Concern | Choice | Why |
|---|---|---|
| App | Vite + React + TypeScript | Fast, portable inside `projects/` |
| Charts | Observable Plot (+ D3 where needed) | High data-ink defaults; less chartjunk than heavy chart kits |
| Map | MapLibre GL + CBSA GeoJSON (simplified) | Free, performant; avoid Mapbox token dependency |
| State | URL + light React state (`useDeferredValue` for filter typing) | Shareable |
| Data | Build-time Parquet → JSON slices; optional Arrow/DuckDB-WASM later for client queries | Keep v1 simple |
| Pipeline | Python + polars/pandas in `projects/.../pipeline/` | Reproducible ETL |
| Hosting | Static site (GitHub Pages / Cloudflare Pages / Netlify) | Fits monorepo side project |
| Tests | Pipeline parity checks + a few Playwright smoke tests for search/select | Guard regressions |

Monorepo layout:

```
projects/2026-07-metro-budget-tax/
├── README.md                 # this plan + eventual status
├── notes/                    # working notes
├── raw/                      # downloaded Census files (gitignored if large)
│   └── _summaries/           # distilled notes about sources
├── pipeline/                 # Python ETL + audit
├── data/                     # generated artifacts committed or released
└── web/                      # Vite app
```

---

## 9. Information architecture (UI components)

Minimal set — build only these:

1. `HeroMap` — full-bleed choropleth + search
2. `ChapterScroller` — sticky viz + narrative steps (Ch. 1–4)
3. `MetricToggle` — bound-labeled control group
4. `MetroTypeahead`
5. `NationalScatter`
6. `CompositionBars` — revenue or expenditure, shared scale in compare
7. `RankTable` — dense, sortable, with inline sparklines if multi-year
8. `MetroDetail` — drawer/panel
9. `CompareTray`
10. `MethodFooter`
11. `ChartTooltip` + `InfoTip` for every KPI
12. `FloatingToc` once H2 chapters exist

No separate marketing site. One route `/` is the product.

---

## 10. Content outline (words on the page)

Keep published copy tight; depth in methodology.

- Hero: 1 headline + 1 sentence + CTAs
- Each chapter: ≤120 words of prose + the interactive
- Metro detail: auto-generated from data (“In {year}, {metro} local governments spent ${x}/person and collected ${y}/person in local taxes…”) + 2–3 hand-written insight templates triggered by rank/composition patterns
- Methodology: 400–800 words, citations with primary URLs

Voice: claim → definition → comparison → caveat. No adjectives without numbers.

---

## 11. Phased delivery

### Phase 0 — Data spike (must succeed before UI polish)

- Download latest CoG / ASLGF individual-unit + GID
- Implement county→CBSA rollup for tax total + general expenditure total
- Produce one parquet of ~380 MSAs with tax/person and spend/person
- Audit against national totals and 5 FiSC cities
- **Go/no-go:** if CBSA rollups systematically disagree with FiSC/Urban anchors beyond documented methodology differences, revise aggregation before building the page

### Phase 1 — Vertical slice

- Static site with map + search + detail panel for the two headline metrics
- Methodology page section
- Rank table
- Single year

### Phase 2 — Explainer chapters + composition

- Scrollytelling Ch. 1–4
- Revenue and expenditure composition
- Scatter + peer filters
- Compare tray
- URL state

### Phase 3 — Enrichment

- Multi-year sparklines
- Tax / personal income
- Optional micropolitans
- **Modeled state allocation** (toggle; population-share within state; labeled modeled)
- **FiSC-style central-city contrast** (Census reconstruction + Lincoln list flag; not official FiSC $)
- Special-district allocation sensitivity toggle — deferred

### Phase 4 — Hardening

- Full `data/audit.md` + automated anchors
- Accessibility pass
- Performance: map simplify, code-split chapters
- Promote reusable notes into `wiki/concepts/` (e.g. fiscally standardized cities, CBSA vs CSA)

---

## 12. Risks & open questions

| Risk | Mitigation |
|---|---|
| Users read “tax per person” as household burden | Definition chips + Chapter 1; tooltip language “collections, not incidence” |
| City-only mental model | Chapter 2 forced contrast |
| Special-district misallocation | Document default; Phase 3 sensitivity |
| Annual survey holes between CoG years | Prefer CoG year for v1; coverage badges |
| Map performance on mobile | Pre-simplified topology; defer MapLibre until after first paint |
| Scope creep into federal tax | Explicitly out of scope for v1 (optional later IRS SOI county layer is a different product) |
| “Budget” ambiguity (adopted budget vs Census actuals) | Label as **Census-reported finances (actuals/estimates), not adopted budget documents** |

### Open decisions to resolve at Phase 0 end

1. Exact fiscal year for v1 launch (recommend latest CoG finance year with public individual-unit file).
2. Include enterprise utilities in spending totals by default? (Recommend **general government default; utilities toggle**.)
3. DC / multi-state labeling convention.
4. Whether to show micro areas in v1 at all.

---

## 13. Success criteria

The page is successful if:

1. A user can find their metro in &lt;10 seconds and see tax/person and spend/person with year + definition.
2. A skeptical reader can open Methodology and re-derive the headline numbers from cited Census sources.
3. Every chart passes the **7-question Tufte test** (skill gate) before merge.
4. Compare mode makes peer differences visible without switching pages.
5. At least three “aha” pedagogical beats land: (a) tax ≠ spend, (b) city ≠ metro fiscal system, (c) composition beats a single rank.

---

## 14. Immediate next actions (when build starts)

1. Confirm v1 fiscal year + download Census public-use + GID files into `raw/` (gitignored if large; checksums in `_summaries/`).
2. Implement Phase 0 pipeline + audit notebook.
3. Wire a bare Vite app with search + map + two KPIs against the parquet.
4. Only then write chapter copy and scrollytelling.

---

## Sources (planning references)

- [Census Annual Survey of State & Local Government Finances](https://www.census.gov/programs-surveys/gov-finances.html)
- [2023 State & Local Government Finance public-use datasets](https://www.census.gov/data/datasets/2023/econ/local/public-use-datasets.html)
- [Census Metropolitan & Micropolitan](https://www.census.gov/programs-surveys/metro-micro.html)
- [CBSA population estimates](https://www.census.gov/data/tables/time-series/demo/popest/2020s-total-metro-and-micro-statistical-areas.html)
- [Lincoln Institute Fiscally Standardized Cities (FiSC)](https://www.lincolninst.edu/data/fiscally-standardized-cities/)
- [Urban Institute State & Local Finance data tools](https://www.urban.org/policy-centers/cross-center-initiatives/state-and-local-finance-initiative/interactive-data-tools)
- Tufte skill: [`skills/tufte design/SKILL.md`](../../skills/tufte%20design/SKILL.md)
