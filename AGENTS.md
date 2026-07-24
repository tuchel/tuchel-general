# AGENTS.md / CLAUDE.md — BLV Operator Schema

These mirrored files tell any LLM agent entering this repo how to behave. Read the native file for your runtime before doing any other work. They contain the same schema so Claude, GPT, and other agents operate this repo as the same disciplined compounding knowledge system rather than a bag of markdown files.

## Instruction-file parity — mandatory

`CLAUDE.md` and `AGENTS.md` are full, standalone, byte-identical mirrors. Native Claude compatibility depends on `CLAUDE.md`; GPT and other agent runtimes discover `AGENTS.md`.

- Make schema edits in `CLAUDE.md`, then run `scripts/sync-agent-instructions.sh --write` to update `AGENTS.md` in the same change.
- Never merge a change that leaves the files different. `scripts/sync-agent-instructions.sh --check` and the blocking CI lint enforce parity.
- Do not replace either file with a symlink, import-only wrapper, or pointer. Each runtime must receive the complete schema through its native instruction file.

---

## Who BLV is

**Blue Lot Ventures (BLV)** is a technical-vetting-as-a-service VC firm. We are a small group of engineers who technically vet startups on behalf of larger venture funds. We cover **hard tech**: hardware, robotics, deep tech, embodied AI, space economy, defense, energy.

Our edge — what the system exists to amplify:

1. **First-principles re-derivation.** We don't trust pitch-deck numbers. We rebuild the math/physics from scratch and check whether reality matches the claim.
2. **Real simulations, not hand-waves.** Physics/dynamics/control, Monte Carlo, first-principles re-implementations. 2D and 3D. Extremely high polish.
3. **Deep domain specialization.** Our active team plus a passive network of 10–15 expert engineers give us first-hand experience in the verticals we cover.

The name "Blue Lot" refers to the SpaceX parking lot reserved for the most tenured staff. The brand is understated, earned, institutional — never showy.

---

## Repo map

Six layers plus two index/log files plus this schema. See the plan file at `/Users/jamestuchel/.claude/plans/read-the-llm-wiki-md-file-elegant-mochi.md` for the full architectural narrative.

```
BLV-master-repo/
├── CLAUDE.md                 # native Claude schema (mirrored with AGENTS.md)
├── AGENTS.md                 # native GPT/agent schema (mirrored with CLAUDE.md)
├── README.md                 # firm + repo map for humans
├── llm-wiki.md               # the foundational concept doc (read once, then reference)
├── .claude/                  # skills + hooks + settings (how the LLM is wired to operate)
├── wiki/                     # layer 3 — the LLM-owned compounding knowledge base
│   ├── index.md              # catalog of every wiki page
│   ├── log.md                # append-only chronological log
│   ├── concepts/             # physics/engineering/finance primitives
│   ├── verticals/            # landing pages per market we cover
│   ├── entities/             # companies / founders / organizations
│   ├── methods/              # BLV's analytical DNA — how we analyze things
│   ├── lessons/              # compounding lessons-learned (technical/analysis/presentation/investment)
│   ├── regulatory/           # export control, FCC, FAA, NRC, ITAR
│   └── _templates/           # templates for new pages
├── reference-library/        # layer 4 — canonical per-vertical reading lists
├── engagements/              # layer 2 — one folder per vet
│   └── {yyyy-mm}-{slug}/
│       ├── README.md
│       ├── raw/              # layer 1 — immutable sources
│       ├── memo/             # the 6-section VCIF memo
│       ├── simulations/      # Python + notebooks + TS viz
│       ├── portal/           # Astro site deployed for client
│       ├── predictions.md
│       ├── retrospective.md
│       └── log.md
├── pipeline/                 # light CRM + deal flow
├── sim-primitives/           # layer 5 — reusable simulation library
│   ├── python/               # pip install -e . (editable local package)
│   └── web/                  # TS/React components for portal embeds
├── design-system/            # layer 6a — canonical design foundation (tokens, type, motifs, kits)
│   ├── colors_and_type.css   # single source of truth — all CSS variables
│   ├── assets/               # logos, mark, signature physics motifs
│   ├── preview/              # foundation cards (color, type, spacing, components)
│   └── ui_kits/dashboard/    # click-thru reference build (Technical Dive Dashboard)
├── portal-framework/         # layer 6b — Astro + MDX consumption layer (extends design-system)
│   ├── styles/               # blv-foundation.css + tailwind-preset.mjs (shared by all portals)
│   ├── components/           # BlvMark, BlvFooter, Eyebrow (reusable Astro)
│   └── templates/            # boilerplate copied by `blv:start-engagement`
├── brand/                    # layer 6c — voice, narrative identity, house & charting style
│   ├── identity.md           # origin story + how the design system feels
│   ├── tokens.json           # mirror of design-system tokens (for tooling)
│   ├── house-style.md        # writing rules — claim → derivation → counter-evidence
│   └── charting-style.md     # FT/Tufte chart aesthetics
└── predictions/              # cross-engagement falsifiable-claims index
```

---

## Core workflows

### Ingest a source

When a new file lands in `engagements/{slug}/raw/`, or when the user asks to ingest a source:

1. Read the source in full.
2. Write a summary page in the engagement's folder (one file per source, e.g., `engagements/{slug}/raw/_summaries/{source-name}.md`).
3. Extract entities (companies, people, organizations) and update `wiki/entities/`. Create new pages if needed; update existing pages with new facts and citations.
4. Extract concepts (physics claims, engineering parameters, market data) and update `wiki/concepts/`. Create new concept pages when a concept recurs or is load-bearing.
5. Append to `engagements/{slug}/log.md`: `## [YYYY-MM-DD] ingest | {source-name} | {one-line takeaway}`.
6. Update `wiki/index.md` with any new pages created.
7. **If the source is a disclosure event that changes a previously-stated operating-point fact, biographical fact, or commercial figure**, update `engagements/{slug}/canonical-facts.yml`: change `canonical:` to the new value and add the old value under `superseded:` with a one-sentence reason. CI then surfaces every prose location still carrying the old value on the next push (no manual sweep — see [Founder-level technical scrutiny § rule 5](#5-the-canonical-facts-registry--engagementsslugcanonical-factsyml)).
8. Discuss key takeaways with the user after the bookkeeping is done.

### Answer a query against the wiki

1. Read `wiki/index.md` first to locate relevant pages.
2. Read the relevant engagement's `log.md` if the query is engagement-adjacent.
3. Drill into specific pages as needed.
4. Synthesize the answer with citations (file paths + line numbers, or wiki-links).
5. If the answer is non-trivial and reusable, **file it back into the wiki as a new page** (concepts/methods/lessons as appropriate). This is how explorations compound.

### Lint the wiki

Run periodically (weekly) or on user request:

1. Scan for contradictions between pages.
2. Flag stale claims that newer sources have superseded.
3. Find orphan pages with no inbound links.
4. Find concepts mentioned but lacking their own page.
5. Find missing cross-references (A cites B's topic but doesn't link).
6. Spot repeated ad-hoc analyses that should be promoted to `wiki/methods/` or `sim-primitives/`.
7. Suggest new questions to investigate; new sources to look for; new sim primitives to build.

### Start a new engagement

When the user says "start engagement for {company}":

1. Create `engagements/{yyyy-mm}-{slug}/` with the full template (README, raw/, memo/, simulations/, portal/, predictions.md, retrospective.md, log.md).
2. Pre-fill the 6 VCIF memo sections from `engagements/_templates/memo/`.
3. Initialize the portal from `portal-framework/templates/`. **Copy a `robots.txt` into `engagements/{slug}/portal/public/robots.txt` from any existing engagement** (e.g. `engagements/2026-04-fortastra/portal/public/robots.txt`) — every deployed BLV portal must ship a robots.txt that disallows indexing, archiving, and AI-training scraping. The CI lint workflow (`scripts/lint-portal-robots.sh`) blocks merge if any engagement portal is missing this file. See the Confidentiality policy section.
4. **Run proactive similarity surfacing** (see below) — find prior engagements that overlap on sub-problems; surface relevant `sim-primitives/`; surface relevant `wiki/methods/`; surface relevant `wiki/lessons/`.
5. **Register the new slug in every index and hardcoded build list — the full checklist below. Miss one and the portal (or its tracking) is silently omitted from a build:**
   - `pipeline/pipeline.md` — add the engagement row under the `Active` section.
   - `wiki/index.md` — add any new entity / landing pages created during kickoff.
   - `wiki/log.md` — append the dated kickoff entry.
   - [`scripts/build-firm-landing.py`](scripts/build-firm-landing.py) — append a `(slug, engagement_directory, display_name, kickoff_date)` tuple to the `ENGAGEMENTS` list. The landing page auto-renders the last three Pull Requests touching that directory on every build; no description or sector-tag maintenance.
   - [`.github/workflows/build.yml`](.github/workflows/build.yml) — add the slug to the `build` job's `matrix.engagement` list. If omitted, the CI build gate never builds that portal — the exact silent-omission gap build.yml was created to prevent.
   - [`scripts/build-all-portals.sh`](scripts/build-all-portals.sh) — **three additions:** a `build_engagement "engagements/<slug>" "<url-slug>"` line in the build loop, a `mkdir -p dist/<url-slug> && cp -r engagements/<slug>/portal/dist/. dist/<url-slug>/` line in the dist-staging block, and the route line in the header comment. If any is omitted, `dist/<url-slug>/` is never staged and the portal never serves at `/<url-slug>`. **Do NOT add these three until the Cloudflare Access application below exists** — stage them commented-out with a pointer note instead.
   - **Cloudflare Access application — manual dashboard step; gates the dist-staging item above.** Access is per-path: a deployed route with no `blv-portal-<url-slug>` application serves **ungated to the public internet**. A human creates the application (staff-only policy) per [`wiki/methods/portal-cloudflare-access-deployed-2026-05-23.md`](wiki/methods/portal-cloudflare-access-deployed-2026-05-23.md) § Add a new engagement, verifies the login page renders at the route in a private browser window, then un-comments the dist-staging lines. This gap shipped two ungated portals (prometheus 2026-06-03, earthrise 2026-06-09) before being caught — see `wiki/log.md` 2026-06-09.

### Proactive surfacing (on task start)

**Triggered automatically** when a new file in `engagements/*/memo/` or `engagements/*/simulations/` is opened, or when a new engagement is scaffolded:

1. Extract topic keywords from the file path, section headers, and any existing content.
2. Search `wiki/concepts/`, `wiki/methods/`, `sim-primitives/`, prior `engagements/`, and `wiki/lessons/`.
3. Print the top 3–5 relevant prior-work pointers inline, with a one-line reason for each.
4. If there is an unambiguous prior art (≥80% overlap), recommend whether to reuse wholesale or branch.

### Red-team (pre-delivery — MANDATORY)

Before a memo can be marked delivery-ready:

1. Run the full adversarial critique against the current memo.
2. Use `wiki/lessons/` as ammunition — every past mistake is a starting point for a concern.
3. Write findings to `engagements/{slug}/memo/redteam-findings.md` structured as: concern, evidence-basis, severity, suggested-resolution.
4. The user may dismiss findings, but each dismissal is logged with a reason.
5. Delivery is blocked if any severity=critical finding is unresolved and undismissed.
6. **Run the founder fresh-eyes read** on every published surface (per [Founder-level technical scrutiny § rule 8](#8-the-founder-fresh-eyes-read--before-delivery)). Per-paragraph: technical, biographical, commercial, architecture — the author IS the founder for one read-through. This is the last filter before delivery and catches what the author's working-memory missed; the Astro Mechanica audit's 80 findings were what this filter is designed to surface in advance.

### Simulation transparency — surface every sim as a live configurable tool

Per [`wiki/methods/simulator-transparency-default.md`](wiki/methods/simulator-transparency-default.md):

- **Default**: every simulation built on an engagement is surfaced as a user-configurable tool on the client portal. Every input is a control; every output reacts in real time.
- **No hidden back-ends** unless explicitly called out as such, with a declared-provenance banner visible to the reader.
- **Ask before hiding.** When a path would silently bury a computation behind the portal, pause and ask the user for direction.
- **When the Python model is too heavy for in-browser per-keystroke execution**: port to a deterministic TS baseline for the portal; keep the full MC / grid search as a server-side computation that emits a build-time snapshot, clearly labeled as such.

### Interactive chart standards — required on every chart

Per [`wiki/methods/interactive-chart-standards-2026-05-05.md`](wiki/methods/interactive-chart-standards-2026-05-05.md). When you author or edit any chart, infographic, or data visualization on a portal page, the following are mandatory unless explicitly waived by the user:

- **Hover tooltips on every data element.** Every bar / scatter dot / line vertex / quadrant / hoverable shape must surface a rich React `Tooltip` (not a browser `<title>`) with at least three of: title, key-value pairs (raw + derived), source citation, contextual note. Each element gets an invisible `r ≥ 12 px` hit target.
- **Slider bound grounding on every live simulator.** Every `<input type="range">` must be wrapped in `LabeledSlider` (or equivalent) and surface (a) what the lower bound represents physically, (b) what the upper bound represents physically, (c) a live interpretation of the current value. Numeric-only sliders are forbidden.
- **Sticky-chart scrollytelling for narrative-rich historical sections.** When a section is structured as N chapters (one per program / company / era), use the IntersectionObserver-driven sticky-chart pattern (`rootMargin: '-30% 0 -30% 0'`, ≤ 200 ms linear opacity transition). The sticky pane must fit inside `calc(100vh − 7rem)` — compress chart vertical density (row spacing ≤ 40 px, padding `p-4`) before falling back to overflow.
- **Default to live simulator, not static SVG.** If a chart's curve is computed from an equation, expose every parameter as a slider. Static charts are an exception, not the default.

Reference implementations live in `engagements/2026-05-astro-mechanica/portal/src/components/charts/` (`ChartTooltip.tsx`, `LabeledSlider.tsx`, `MachStagnationChart.tsx`, `CycleEfficiencyChart.tsx`, `HeliumHistoryScrollytelling.tsx`).

### Tufte-viz discipline — apply the skill to every chart and infographic

Per the [`tufte-viz` skill](skills/tufte%20design/SKILL.md) (`skills/tufte design/`). Every new data visualization — chart, infographic, schematic, dashboard, diagram, simulator output panel — goes through the skill's 7-question Tufte test at author time. Refactors of existing visualizations carry the same gate. This is the visual-design layer that sits ON TOP OF the interactive-chart standards above (which govern interaction) and the KPI info-tip discipline below (which governs explanation). The three are complementary, not redundant.

**When to invoke the skill:**

1. **New visualization** — read [`SKILL.md`](skills/tufte%20design/SKILL.md) before starting. Apply the workflow in the "For new visualizations" section: clarify the data story, pick the visual approach against Tufte principles, design with data-ink in mind, then run the test before merging.
2. **Refactoring an existing visualization** — read [`SKILL.md`](skills/tufte%20design/SKILL.md) and walk the "For critiquing visualizations" workflow: check graphical integrity, identify chartjunk, evaluate data-ink ratio, propose specific before/after improvements.
3. **Design reviews** — when reviewing a teammate's portal page, simulator panel, or memo infographic, apply the same test before approving.

**The 7-question Tufte test (gate — every visualization passes before merge):**

1. **Data-ink:** Can I erase any element without losing data? (Erase it.)
2. **Integrity:** Does the visual effect match the data effect? (Lie factor ≈ 1.)
3. **Chartjunk:** Does any element exist for decoration only? (Remove it.)
4. **Excellence:** Does the chart reveal data at multiple levels? (Macro overview + micro detail.)
5. **Comparison:** Can the reader easily compare data elements? (Enable it — "compared to what?")
6. **Density:** Could the chart show more data in the same space? (Condense.)
7. **Context:** Is all necessary context provided? (Labels, sources, scales, units.)

Plus the seven extended questions from `references__analytical-design.md` (comparison, causality, multivariate, integration, documentation, layering, micro/macro) — apply when designing dense displays, dashboards, or explanatory infographics with multiple panels.

**Common patterns this discipline produces** — already proven on BLV portals:

- **Range-frame axes** instead of full axes with arbitrary round-number ticks. The axis line clips to the actual data range; the min/max labels live AT the data extents and carry data themselves (Tufte: "every standard chart element can be redesigned to carry data").
- **Single-hue sequential color ramps** for sequential variables (e.g., temperature, time, magnitude). The blue→yellow→red rainbow that intuitively reads as "cold to hot" introduces a categorical-looking break at the yellow midpoint and reduces comparability across panels — Tufte specifically flags it for sequential data. Use a value ramp (light to dark, single hue) instead.
- **Dense tables over multi-card layouts** when the unit-of-analysis repeats (one row per component, one row per architecture, one row per scenario). A table with N rows × M columns has ~4× the data-ink ratio of N stacked panels with the same content.
- **Inline gradient strips and rotated eyebrow labels** instead of bordered legend boxes. The strip carries the scale; the eyebrow types the section — no decorative borders or "LEGEND" headers needed.
- **Visible internal recirculation arcs** on Sankey-style energy ledgers when internal flows are part of the mechanism. Burying recycling in a prose footnote loses the "show causality, mechanism, structure" win.

**Reference implementation:** the Helios cycle simulation explainer at [`engagements/2026-05-astro-mechanica/portal/src/pages/helios-explainer.astro`](engagements/2026-05-astro-mechanica/portal/src/pages/helios-explainer.astro). The V2 of that page ([PR #225](https://github.com/tuchel/BLV-master-repo/pull/225)) was an explicit Tufte-viz pass that stripped chartjunk, swapped a rainbow ramp for single-hue, range-framed the T-s axes, collapsed seven equation cards into one dense table, added internal-recycle Sankey arcs, and added a historical-peers comparator answering "compared to what?" — net result was a denser and more honest page than V1 at ~720 published words.

**No conflict with existing rules:** the interactive-chart standards (hover tooltips, bound-grounded sliders, sticky scrollytelling) and the KPI info-tip discipline (WHAT / WHY / WHO) describe HOW charts behave and HOW their KPIs are explained. The Tufte-viz discipline describes HOW the chart LOOKS. All three apply simultaneously.

### Physics & calculation audit — MANDATORY before simulator-backed verdicts

Per [`wiki/methods/physics-audit-discipline-2026-05-05.md`](wiki/methods/physics-audit-discipline-2026-05-05.md). Any simulator that produces a load-bearing physics or business calculation supporting a memo verdict must, before merge, complete a written physics audit that walks every equation, every assumption, every calibration constant. Mistakes here are extremely costly — investors making capital decisions on our outputs assume the math is right.

Mandatory audit categories (each instantiated for the simulator at hand):

1. **Thermodynamic / mathematical invariants.** Verify property functions reproduce textbook anchors at regime endpoints.
2. **Standard environmental references.** Atmospheric / market / regulatory anchors verified against canonical sources.
3. **Per-component conservation.** Mass, energy, momentum balance traced through every component.
4. **End-to-end conservation.** Cycle / model totals close exactly (energy ledger Σ = 1.000 ± 0.001).
5. **Calibration vs published anchors.** Every named architecture / scenario anchored against an independent published reference; deviations >10–20% mapped to documented model-tier limits.
6. **Cross-implementation parity.** Multi-language ports (e.g., Python primitive + TS portal port) ship a parity test harness with ≤0.05% relative tolerance on at least 5 reference points.
7. **Tier limits explicitly enumerated.** Every audit closes with a "what this audit does NOT extend the model to" section.

The audit is committed alongside the simulator as `simulations/<sim-name>/audit.md`. Reference implementation: [`engagements/2026-05-astro-mechanica/simulations/cycle-comparison/audit.md`](engagements/2026-05-astro-mechanica/simulations/cycle-comparison/audit.md).

### KPI info-tip discipline — required on every numeric KPI

Per [`wiki/methods/kpi-info-tip-discipline-2026-05-05.md`](wiki/methods/kpi-info-tip-discipline-2026-05-05.md). Every Key Performance Indicator (KPI) shown on a BLV simulator portal page must carry a hover-triggered info-tip answering at minimum:

- **WHAT** is this number — units, formula in a phrase, typical-value range anchored against named real-world examples.
- **WHY** it matters for the system's performance — what higher-level quantity it drives (mission economics, engine choice, capital efficiency).
- **WHO uses it (optional but encouraged)** — the engineering or commercial decision the metric informs.

Numeric KPIs without info-tips are forbidden. Use the standard `InfoTip` component (reference: `engagements/2026-05-astro-mechanica/portal/src/components/simulator/InfoTip.tsx`). Section eyebrows that introduce charts also carry info-tips that explain what the chart shows and why.

### Extract & reconcile predictions

- **Extract** (post-memo draft): Parse memo for falsifiable claims. Write to `engagements/{slug}/predictions.md` and append to `predictions/index.md`. Every claim has: statement, confidence, due-date, reconciliation-rule (what we'll look at to decide if it's true/false).
- **Reconcile** (scheduled quarterly): For each due prediction, research reality — news, filings, sim re-runs, interview updates. Annotate `engagements/{slug}/retrospective.md`. If the prediction was wrong, write a new lesson in `wiki/lessons/` and link it to the engagement.

---

## VCIF protocol — the memo spine

Every engagement memo follows William Lin's VCIF (Venture Capital Investment Framework) six-area structure. Each section has its own template in `engagements/_templates/memo/`, its own rigor bar, and its own required evidence.

| # | Question | VCIF area | What goes here |
|---|---|---|---|
| 00 | — | Executive summary | One page. Thesis, key risks, recommendation. No jargon without a gloss. |
| 01 | Who | **Team** | Founder diligence, prior ventures, domain credibility. Reference calls (if run). Red flags. |
| 02 | What | **Problem** | The problem the startup is solving. Why now? Why is it a problem worth solving? Magnitude. |
| 03 | When | **Timing** | Why this moment? Enabling technologies, market readiness, regulatory windows. Risks of being too early/late. |
| 04 | Where | **Market** | TAM/SAM/SOM rebuilt from first principles (not pitch-deck). Competitors, structure, margins. |
| 05 | Why | **Solution** | The technical approach. First-principles re-derivation of key performance claims. Sim-backed validation. Alternatives considered and rejected by the startup. |
| 06 | How | **Scale** | Manufacturing, capital intensity, unit economics, go-to-market, organizational readiness for scale. |

Rigor bar across all sections:

- **Every quantitative or factual claim cites a primary source by URL** — using markdown reference-link syntax `[claim text][citation-key]`, where the cited claim itself is the link text. Renders as a native underlined hyperlink in the portal with the source title surfaced on hover; raw markdown stays compact. Reference-link definitions (`[citation-key]: https://... "Title"`) live at the very bottom of each section file and double-resolve a reader-facing `## Sources` bulleted index. Aggregator-only sourcing (Tracxn, PitchBook, Crunchbase, ZoomInfo) does not count unless the aggregator links out to the primary document. "Per Aviation Week" is not a citation; the URL is. See [`wiki/methods/chain-of-custody-2026-05-05.md`](wiki/methods/chain-of-custody-2026-05-05.md).
- **Every calculated number traces to a re-runnable primitive** — Python under `sim-primitives/` or `engagements/{slug}/simulations/`, or a TS function in the portal simulator, linked from the prose at the point of the claim. Multi-step calculations cannot live in prose alone; promote to primitive. The §05 cycle-comparison subtree on `2026-05-astro-mechanica` is the reference implementation.
- **Unverified claims are flagged inline as `[unverified]`** — and may not appear in load-bearing surfaces (executive summary, recommendation, case bullets, top risks, predictions). Verified-or-flagged is the bar.
- **Every physics claim** must be re-derived, not paraphrased. Textbook constants are Tier-A only when referenced through a `wiki/concepts/` page that cites the textbook by chapter or equation.
- **Every adjective** must be backed by a number or removed ("promising" is banned without a comparison).
- The BLV move: **claim → primary-source link → derivation in a primitive → counter-evidence we actively searched.** Every position ships with what would change our mind.

---

## House style

Before writing any client-facing text, read `brand/house-style.md`. The short version:

- Claim → derivation → counter-evidence we searched. **Always — but as prose discipline, not as visible labels in section headers.**
- No adjectives without numbers.
- Executive summary first; depth in the sections; no depth without evidence.
- Equations inline where relevant; block-numbered where load-bearing.
- Every physics claim cites its derivation.
- Confident but falsifiable voice. Every position is accompanied by what would change our mind.
- **Every simulation ships as a user-configurable portal tool by default** — no hidden back-ends without explicit, declared exception. See `wiki/methods/simulator-transparency-default.md`.
- **Every chart on a portal page meets the interactive-chart standards** — hover tooltips on every data point, bound-grounded sliders on every live simulator, sticky-chart scrollytelling for narrative-rich historical sections. See `wiki/methods/interactive-chart-standards-2026-05-05.md`.
- **Every page on every portal surfaces a floating table of contents when it has at least one H2 section.** Always-on TOC is the firm baseline as of 2026-05-24 (the earlier `wordCount > 500 OR h2Count > 3` threshold was retired). Shared component lives at `portal-framework/components/FloatingToc.astro`; the firm-admin Python renderer applies the same rule. Page-author wires by passing `headings` to `<BaseLayout>`; content-collection routes auto-extract from `entry.render()`. Full method: `wiki/methods/floating-toc-2026-05-19.md`.
- **Every memo section and addendum page appears in the portal's top nav bar by default.** When an engagement gains a new memo page — a numbered VCIF section, an addendum (A1, A2, …), or any other memo-collection entry — it is added to the nav in the same PR that adds the page; nav omission is treated the same as index omission (a silently unreachable surface). Preferred implementation: derive the nav from the memo content collection (sorted by id, short labels from a per-engagement `NAV_LABELS` map, unknown sections falling back to their id so nothing is ever dropped) rather than hardcoding a list — reference implementation at `engagements/2026-07-icon-prime/portal/src/components/Nav.astro`. Only explicitly backstage files (e.g. `redteam-findings.md`, excluded from the collection glob) stay out of the nav. Established 2026-07-10 (JT directive).
- **Every page on every portal uses the full `max-w-screen-2xl` (1536 px) wrapper width.** No inner `max-w-3xl` / `max-w-4xl` / `max-w-5xl` / `max-w-6xl` re-centering on page-level wrappers, lead paragraphs, callout boxes, or prose containers. Content fills the wide column; the floating TOC takes the left 220 px gutter. The shared `.prose-memo` foundation rule no longer constrains prose width — that responsibility moved to the page author (who should leave content unconstrained for the firm-wide "Helium-style" baseline). Established 2026-05-24.
- **Every fact and number is verifiable end-to-end** — primary-source URL embedded in every quantitative or factual claim, every calculated number linked to a re-runnable primitive. **No inline tier flags in canonical prose**: `[unverified]`, `[Tier-D]`, `[promote to wiki/...]`, `[see §X chain-of-custody ledger]` brackets never appear in memo, README, or portal — verification happens before delivery; unresolved items move to `engagements/{slug}/research-queue.md` (gitignored, invisible to the reader). The backstage chain-of-custody ledger holds tier per verified claim. See `wiki/methods/chain-of-custody-2026-05-05.md` and `wiki/lessons/presentation/verify-up-front-not-relabel-2026-05-20.md`.
- **No prose interruptions** — embedded hyperlinks in sentence words are invisible to flow and are the canonical citation pattern. Footnote anchors (`[^name]`), "See §X" pointers, "see P-007a" markers, and bracketed mid-sentence asides do interrupt; they pull the reader out of the sentence. Cut them. If a claim can't be carried in a clean sentence with embedded hyperlinks, restructure the prose so it doesn't depend on a jump. Enforced by `scripts/lint-conciseness.sh`. See `wiki/methods/no-prose-interruptions-2026-05-20.md`.
- **§00 case bullets: ≤100 words per bullet** — no exceptions on length. Three or four bullets, each one a self-contained claim with its supporting evidence; counter-evidence may live inline or in the matching deep section (§01-§06) when distributed-counter-evidence is the cleaner read. Compressing to 100 words is the work that adds value. Supporting depth belongs in the matching deep section. See `wiki/lessons/presentation/three-bullet-case-100-word-cap-2026-05-20.md`.
- **No repetition across surfaces** — within a memo, no load-bearing claim is restated across surfaces. §00 Recommendation commits, §00 Thesis (when used) names the claim, §00 The case carries evidence — each says something different. §01–§06 openers don't restate §00 Recommendation; portal landing doesn't restate the memo. See `wiki/lessons/presentation/no-repetition-across-surfaces-2026-05-20.md`.
- **Predictions stay backstage** — the predictions file (`engagements/{slug}/predictions.md`) is a behind-the-scenes accountability artefact tracked over time. It is never referenced from memo prose, the README, or any portal page. The portal does not expose a `/predictions/` route or nav entry. Enforced by `scripts/lint-predictions-surfacing.sh`. See `wiki/methods/predictions-stay-backstage-2026-05-20.md`.
- **Risks and open questions: consolidated §07 OR distributed across §01-§06.** Default and recommended: §01–§06 substantive sections close on substance and a single §07 carries the consolidated `## Risks` (severity-tagged) and `## Open questions` (diligence gaps, "We can't yet anchor X. If we learn Y, our position shifts"). Permitted alternative: when an engagement's risks are tightly section-specific and a consolidated §07 would mostly repeat per-section "What we don't know" content, the per-section pattern stays and no §07 is created — §00 Top Risks then carries the highest-severity rollup. Pick one pattern per engagement; do not mix. See `wiki/methods/memo-conciseness-2026-04-30.md`.
- **No meta-paragraphs** — don't write about the page's own structure. No "How this list was framed" callouts, no "Reading guide" sections, no "the scorecard above shows…" captions, no section intros that restate the heading. The structure must speak for itself; if it can't, fix the structure. Enforced advisory by `scripts/lint-conciseness.sh`. See `wiki/methods/portal-conciseness.md`.
- **No past-version or self-evolution commentary on canonical pages** — every dossier, memo, portal page, and method page states the current best answer in current tense, with no reference to past versions, change-of-mind framing, **or the analysis's own evolution within the engagement**. The narrower failure (citing earlier drafts) and the subtler one (narrating how our position moved — "X was the right call when Y", "both halves moved", "the clause read as existential", "reweighted down", "demoted from gate to condition", "the kickoff's headline risk", "initially", "no longer the gate", "moves it from claimed to corroborated", "standing decision (DATE)") are the same violation: the sentence only parses if the reader knows a previous state of our analysis. Banned phrases include: "the earlier draft", "previously recommended", "we used to say", "the prior recommendation", "Round-N verification (YYYY-MM-DD)", "the prior-diligence X", "(at WAVELENGTH-1) where SUBJECT was VERDICT", "Reframed YYYY-MM-DD", "Corrected in this engagement", "v0 / v1 / v2", "was the right call when", "both halves moved", "reweighted", "demoted from", "increasingly verified". **The self-test: if deleting the sentence's reference to a prior state of our own work changes nothing about the current claim, delete it; if the sentence cannot survive that deletion, rewrite it to state only the current position.** Dated assumptions are stated as present-tense working assumptions ("Working assumption: X; revisited on Y"), not as historical decisions. References to *source documents'* versions (a stale appendix slide, a superseded company disclosure) are facts about the evidence and remain fine. Git carries the history; the page carries the answer. PR descriptions, commit messages, `log.md` entries, retrospectives, backstage blocks, and lessons pages are the right place for change-of-mind narrative. See `wiki/lessons/presentation/no-past-version-framing-2026-05-19.md`.
- **American English everywhere** — `program` not `programme`, `defense` not `defence`, `center` not `centre`, `behavior` not `behaviour`, `analyze` not `analyse`, etc. Primary-source quotations preserve original spelling (place inside blockquote `>` to skip the lint). Enforced by `scripts/lint-spelling.sh` (blocking). Auto-fix with `scripts/fix-spellings.sh`. See `wiki/methods/uk-to-us-spelling-2026-05-17.md`.
- **Every number carries a dimension tag** — efficiency / power / pressure / mass / unit-count claims state their dimension inline (Excel-anchor vs engineering-plan-of-record; design-point vs station-map peak; vendor datasheet vs deck-rounded; 2027 ramp vs 2028 ramp). The reader cannot disambiguate from context; the writer must. See `Founder-level technical scrutiny § rule 1`.
- **Every claim multi-input check** — every sentence with two or more numbers connected by "of", "per", "×", "÷", "for", or "across" runs the arithmetic before publication. "13 units (130 MW)" → check 13 × 10 = 130. Three-number triplets (revenue × nameplate × ASP) must be mutually consistent. See `Founder-level technical scrutiny § rule 2`.

## Memo conciseness — published vs backstage

**Default strategy: go exhaustively deep on every company. Distil to a highly concise summary for the published portal.** The depth lives in the substrate (`predictions.md`, `log.md`, `wiki/`, `raw/_summaries/`, `simulations/`); the synthesis lives in the memo body. Full method: `wiki/methods/memo-conciseness-2026-04-30.md`.

Every §01–§06 substantive memo section follows the same shape:

```
## Exec summary             ← 150–250 words. Reader walks away with the answer.
## Deeper dive              ← 500–1,000 words target (soft 1,500; hard 2,500 — see below).
  ### Subheadings as needed
<!-- blv-backstage-start ... blv-backstage-end -->  ← Backstage block (invisible to all markdown renderers).
```

**§00 Executive Summary:**

```
## Recommendation          ← Or "## Position". One sentence, ≤30 words. Verdict + confidence; gating condition optional (use when the verdict is conditional on a small number of open verifications; omit when the recommendation stands on the evidence carried in the case).
## Thesis in one sentence  ← One sentence, ≤30 words. The single load-bearing claim. Optional if "## The case" carries the same load.
## The case                ← Three or four bullets, each ≤100 words. Each bullet = conclusion + best supporting evidence; counter-evidence either inline OR in the matching §01-§06 deep section.
## Top risks               ← 3 critical + up to 3 high. One sentence each, severity-tagged.
## Falsifiers              ← Either "## What would change our mind" (2-3 concrete falsifiers) OR "## To invest, you must believe these things are true" (2-4 confirmatory axioms). Pick one framing per engagement; the underlying discipline is the same — name what would flip the recommendation.
## Sources                 ← Bulleted index of primary sources, each a clickable hyperlink. Optional in §00 when sources are surfaced in §01-§06 and §00 reads cleaner without a duplicate index.
```

**§07 Risks and open questions (end of memo) — recommended, not mandatory:**

```
## Risks                   ← Severity-tagged risks beyond §00 Top Risks. Grouped by section if useful.
## Open questions          ← Diligence gaps. "We can't yet anchor X. If we learn Y, our position shifts."
```

When §07 is used, risks and open questions live at the end of the memo, not per section, and section bodies close on substance. Some engagements instead keep risks distributed across §01-§06 closing paragraphs — see the consolidated-vs-distributed rule above. Pick one per engagement.

Backstage content (process scaffolding, "Required evidence" checklists, "Rigor bar" rules, verification TODOs, reference-call target lists, chain-of-custody ledgers) lives inside the HTML-comment sentinel. It is preserved in source for our own use; it never reaches the reader.

**Word count thresholds** (published prose, backstage excluded):

- **Soft target: 1,500 words** per section. Over the soft target the linter emits a `warn` line — non-blocking, but a signal that the section probably wants tightening.
- **Hard limit: 2,500 words** per section. Over the hard limit the linter fails the section and blocks merge. Reserve 1,500–2,500 for sections where re-derivation, multi-comparable benchmarking, or a full table-driven competitor map is genuinely the point.

**Frontmatter must include `stage:`** — one of `kickoff` / `pre-data-room` / `post-data-room` / `delivered` / `reconciled-q{n}`. The stage drives the chip on the firm landing card and the banner on the portal.

**Enforcement:** `scripts/lint-memo.sh` is the gate. Run it before commit. CI runs it on every PR.

## American-English discipline — `program` not `programme`

**BLV ships in American English. UK spellings (`programme`, `defence`, `centre`, `behaviour`, the `-ise/-ised/-ising` family, the `-our` family, `litres / metres / fibre`, `modelling / travelling`, `catalogue`, `aluminium`, `whilst`, `grey`, `mould`, …) are blocked at lint and rewritten by the fix script. Primary-source quotations preserve the original spelling and are skipped — place quoted material inside a blockquote (`>`) so the tools recognize it as quoted.** Full method: [`wiki/methods/uk-to-us-spelling-2026-05-17.md`](wiki/methods/uk-to-us-spelling-2026-05-17.md).

Protected regions (not scanned): fenced code blocks, inline code, URLs, HTML/Astro/JSX tags, blockquoted lines (`>`), non-prose YAML frontmatter fields (`slug`, `era`, `location`, `outcome`, etc.). Prose frontmatter fields (`title`, `headline`, `detail`, `question`, `background`, `response`) ARE scanned.

Proper-noun allow-list lives in `scripts/spelling.py` (`ALLOWLIST_PHRASES`) — covers UK gov bodies (`Ministry of Defence`, `UK Defence Industrial Strategy`, `Royal Air Force`), German research names (`Forschungszentrum Jülich`), company names (`Reaction Engines Limited`), and a handful of UK proper-noun places. Extend it when a new proper noun would be over-converted.

**Enforcement:** `scripts/lint-spelling.sh` is the gate (blocking on CI). Run `scripts/fix-spellings.sh path/to/file.md` (or with no args for the whole repo) to auto-convert.

## Acronym discipline — first-use full-form on every page

**Every acronym must be written out in full on its first appearance on a given page. Subsequent uses on the same page may use the acronym alone. Each page is treated as standalone — the reader is not assumed to have seen the full form on any other page.** Full method: `wiki/methods/acronym-discipline-2026-05-01.md`.

The pattern is `Full Name (ACRONYM)` on first use, then `ACRONYM` thereafter. Examples:

- "Levelized Cost of Energy (LCOE)" → "LCOE"
- "Geostationary Earth Orbit (GEO)" → "GEO"
- "AS9100 Revision D (AS9100D)" → "AS9100D"
- "Department of Defense (DoD)" → "DoD"
- "Indium Gallium Arsenide Phosphide (InGaAsP)" → "InGaAsP"

Per-page reset. Each new page has to re-introduce its acronyms. Chemical symbols are treated as acronyms (Si → Silicon, GaAs → Gallium Arsenide). SI units (W, MW, kg, nm, eV) are exempt.

Scope: every canonical memo file, every portal page, the firm landing card. Exempt: backstage blocks, the glossary page (which IS the expansion list), simulator parameter names in code.

**Enforcement:** `scripts/lint-acronyms.sh` flags first-use violations on every page-shaped file. Run it before commit on any prose change.

## Chain-of-custody discipline — every fact and number is verifiable

**Every fact in a BLV memo must be verifiable. Every quantitative claim must come with a clickable link to the primary source it was derived from. Every calculated number must trace through a re-runnable primitive — first principles → equation → output — that the reader can independently verify.** Full method: `wiki/methods/chain-of-custody-2026-05-05.md`.

Three rules:

1. **Every quantitative or factual claim cites a primary source by URL** — using markdown reference-link syntax `[claim text][citation-key]`. Renders as a native underlined hyperlink in the portal; the source title surfaces on hover; raw markdown stays compact. The reference-link definition `[citation-key]: https://... "Title"` lives at the bottom of the section file and double-resolves a reader-facing `## Sources` bulleted index. Primary sources include company press releases, regulator filings, peer-reviewed papers (DOI), government dockets (`SAM.gov`, FCC, FAA, NRC, etc.), credentialed-reporter articles on a publication's own domain, podcast/video transcripts with timestamps, or first-party social posts with URL + date. **Aggregators (Tracxn, PitchBook, Crunchbase, ZoomInfo) do not satisfy the rule** unless they link out to the primary document.

2. **Every calculated number traces to a re-runnable primitive** — Python under `sim-primitives/` or `engagements/{slug}/simulations/`, or a TS function in the portal simulator. The primitive must be linked from the prose. Multi-step calculations cannot live in prose alone; promote to primitive. The §05 cycle-comparison subtree on `2026-05-astro-mechanica` is the canonical reference implementation.

3. **Unverified claims are flagged inline as `[unverified]`** — and may not appear in load-bearing surfaces (executive summary, recommendation, case bullets, top risks, predictions). Verified-or-flagged is the bar.

Tier scoring: A (full chain) / B (calculation visible, sourced inputs, no primitive — only acceptable for single-operation arithmetic) / C (named source, no URL — non-compliant) / D (no source, no derivation — non-compliant). A memo cannot ship while any Tier-D claim is unflagged or while Tier-A coverage of headline claims is below 80 %.

Each VCIF section ends with a `## Sources` block in two parts: (a) a reader-facing bulleted index where each item is itself a clickable hyperlink to the source, and (b) markdown reference-link definitions at the very bottom of the file resolving every citation key used in the prose AND in the index. Each section's backstage block ends with a `chain-of-custody ledger` attesting tier + citation per claim.

External citation links open in a new tab via `rehype-external-links` (`target="_blank"` + `rel="noopener noreferrer"`) — required in every portal's `astro.config.mjs`.

**Enforcement:** `scripts/lint-citations.sh` flags numerical/factual tokens not adjacent to a markdown link or citation key. Advisory at first; promoted to a blocking gate after the Astro Mechanica memo retrofit lands. The pre-delivery red-team includes a chain-of-custody audit pass that blocks delivery on unflagged Tier-C/D in load-bearing surfaces (per `.claude/skills/blv-run-redteam.md` step 6).

## Founder-level technical scrutiny — author-time discipline

A BLV engagement memo must withstand the founders reading it in close detail. The Astro Mechanica audit ([PR #221](https://github.com/tuchel/BLV-master-repo/pull/221)) surfaced ~80 founder-spottable findings: cross-surface number drift, arithmetic that didn't square, citations that didn't say what the prose claimed, pre-disclosure data carried over after the company corrected it, cycle architectures described as superficial analogs rather than what they actually are. Every fix was mechanical. The root cause was not laziness — it was the absence of author-time guardrails.

The rules below are the discipline that catches the class of mistake at the keyboard, not at the audit. Apply on every memo, portal page, addendum, diligence file, and simulator audit.

### 1. The dimension-tag rule — every number carries a dimension

Every quantitative claim has a **single canonical value at a single dimension**. If a quantity has two values, the prose must distinguish them by **dimension** (Excel-anchor vs engineering-plan-of-record), **scope** (design-point vs station-map peak), **source** (vendor datasheet vs deck-headline-rounded), or **time** (2027 ramp vs 2028 ramp). Never the same dimension twice.

When you write a number, write its dimension tag in the same sentence:

- **Good**: "Helios's engineering plan-of-record sits at 42 percent thermal efficiency on Lower Heating Value; the deck headline is 45 percent at the Excel-Solver optimum."
- **Bad**: "Helios runs at 45 percent thermal efficiency."

The dimension tag is what makes the number defensible against the founders. They know which point applies; the reader doesn't.

### 2. The arithmetic rule — do the math, then verify

Every sentence with two or more numbers connected by "of", "per", "×", "÷", "for", or "across" runs the arithmetic before publication. Don't trust that the deck-stated figures multiply through — verify.

Classes of error this catches:

- **Anchor / customer commit tables**: "13 units (130 MW)" — check 13 × 10 = 130, then check the table totals.
- **Revenue-vs-ASP ramps**: $1.25 billion in 2028 at $13.75 million Average Selling Price (ASP) midpoint = ~91 units, not 40.
- **Three-number triplets**: $4 billion per year × 10 gigawatts per year × $12.5–15 million ASP cannot all hold simultaneously ($4B / 1,000 units = $4M ASP, a 71 percent compression). When three numbers must all be true, verify they can.
- **Derate percentages**: 50 → 30 MWe = 40 percent, not 39.
- **Pressure ratios**: 15 / 70 = 1/5, not 1/4; 850 − 825 = 25, not 23.
- **COGS stacks**: line items must sum to total, with any gap labeled (integration / labor / overhead).

When the math doesn't square, find which number is wrong before the sentence ships.

### 3. The architecture rule — name what the thing actually is

Every description of a cycle, architecture, engine mechanism, or operating principle must name what it ACTUALLY is, not what it superficially resembles. If the company describes their Mode 2 as a duct-burner-augmented turbofan, don't reach for "J58-style turbojet" as an analog — that's a different cycle. Reader-facing prose is taken at face value.

When you reach for an analog, verify the analog shares the operating principle: same shaft architecture, same combustion path, same control surface. If it doesn't, drop the analog or pick a closer one.

### 4. The citation-says-what-the-prose-says rule

Every claim with `[citation-key]` rests on what the cited source ACTUALLY says, not on the paraphrase the author thinks the source supports. Before publishing, open the URL and confirm the relevant passage.

Common drift patterns the AM audit caught:

- "Four named primes" cited to an article that named only two.
- "$1 billion-plus Anduril CCA capture" cited to a Breaking Defense article that doesn't attribute a contract value to Anduril at all.
- "PJM queue lengthened from under 2 years in 2008 to over 8 years in 2025" cited to a Utility Dive article that only carries the current 8-year figure.

When in doubt: paste the relevant source passage into the section's backstage chain-of-custody ledger so a reviewer can see the source language alongside the prose claim.

### 5. The canonical-facts registry — `engagements/<slug>/canonical-facts.yml`

Every engagement maintains a single canonical-facts registry that the author updates whenever a disclosure event lands or a new load-bearing value enters the prose. CI sweeps the registry on every PR — no manual grep required. This rule replaces both the cross-surface canonical-value check and the pre-disclosure carryover sweep with one mechanical pipeline.

**Schema** (per-engagement; lint-enforced):

```yaml
# engagements/2026-05-astro-mechanica/canonical-facts.yml
#
# Single source of truth for the engagement's most-cited values.
# Enforced by `scripts/lint-canonical-facts.sh` on every PR:
#   - Every `superseded` value triggers a FAIL if it still appears in any canonical
#     prose surface (memo/, data-center/, helium/, diligence/, addenda/, portal/src/pages/).
#   - Every `canonical` value must appear at least once in canonical prose
#     (catches registry-drift the other direction — fact stated in YAML but never used).
#
# When a disclosure event changes a value: update this file in the same PR as
# the `log.md` entry, and the lint surfaces every stale occurrence automatically.

facts:
  helios_tit_design:
    canonical: "825 °C"
    label: "Helios design-point Turbine Inlet Temperature"
    superseded:
      "827 °C": "Use 827 °C only when explicitly the station-map peak at heater exit; design-point is 825 °C."
    disclosed: "2026-05-13 working session"

  helios_loop_pressure_high:
    canonical: "15 bar"
    label: "Helios high-pressure leg"
    superseded:
      "30-70 bar": "Pre-2026-05-13 disclosure; replace with 15 bar high / 6.12 bar low."
      "40 bar":    "Pre-disclosure; replace."
    disclosed: "2026-05-13 working session"

  helios_rpm:
    canonical: "16,000 rpm"
    label: "Helios operating rotational speed"
    superseded:
      "17,000 rpm": "Pre-rebalance; T·ω arithmetic confirms 16,000 rpm at 6,000 N·m × 2π/60 ≈ 10 MW."

  helios_inconel_bom:
    canonical: "Inconel 617 / 738 / 316L"
    label: "Helios bill of materials (heat exchanger / turbine / recuperator)"
    superseded:
      "Inconel 625 and 718": "Early-version BOM; canonical is 617/738/316L."
      "Inconel 625 / 718":   "Early-version BOM."

  shadow_wolf_2027_units:
    canonical: "12 units (120 MW)"
    label: "Shadow Wolf Energy 2027 ramp commitment"
    superseded:
      "13 units (120 MW)": "Arithmetic mismatch — 13 × 10 MWe = 130 MW, not 120."
      "13 units (130 MW)": "Inconsistent with 12 + 13 = 25 / 250 MW headline; 2027 row is 12 units."
```

**Author workflow when adding a fact**:

1. New disclosure or new load-bearing claim — add an entry to `canonical-facts.yml` with `canonical:` and (if applicable) `superseded:`.
2. Commit the registry update in the **same PR** as the prose that introduces the fact.
3. CI runs `scripts/lint-canonical-facts.sh` on every PR — surfaces every prose file with a stale match, fails the build if any superseded value still appears.

**Author workflow when a disclosure updates a value**:

1. Log the disclosure in `engagements/<slug>/log.md` (existing workflow).
2. Update `canonical-facts.yml`: change `canonical:` to the new value, add the old value under `superseded:` with a one-sentence reason.
3. Commit — CI surfaces every prose location still carrying the old value.
4. Fix each surfaced location; commit. CI green = sweep complete.

No manual grep, no missed surface. The registry is the disclosure log's load-bearing pair.

**Scope of the registry** — include only values that:

- Appear in ≥2 surfaces (cross-surface consistency matters), OR
- Carry a disclosure-date dependency (change-of-value risk), OR
- Have a known superseded predecessor (post-disclosure carryover risk).

Don't register every number in the engagement; register the load-bearing ~20–40 per engagement. The Astro Mechanica audit's Hot-20 list is the right starting volume.

### 6. URL freshness — PR-time automatic; nightly sweep across the repo

**Author-time** is automatic: a CI step on every PR that touches a citation URL HTTP-HEAD-checks the URL. Non-200 responses (301, 302, 404, 403, 5xx) fail the PR with the dead URL and a suggestion to either fix the link or replace with a Wayback Machine archive snapshot (`https://web.archive.org/web/<timestamp>/<original-url>`).

**Repo-wide** is automatic: a nightly GitHub Actions job runs `scripts/lint-link-freshness.sh` across every citation in `wiki/`, `engagements/*/memo/`, `engagements/*/portal/`, `engagements/*/sources/`, `firm-admin/`. Dead links open a GitHub issue tagged `link-rot` with the file, line, citation key, and last-good Wayback snapshot URL. The on-call rotation closes the issue by either fixing the URL or substituting the archive snapshot.

**Aggregator handling**: URLs to Crunchbase / PitchBook / RocketReach / ZoomInfo that return 403 from a non-logged-in browser are a known pattern and treated as Tier C, not Tier A. The lint flags any aggregator URL claimed as Tier A in the chain-of-custody ledger.

No manual quarterly sweep required.

### 7. Simulator-audit drift — CI-enforced parity between sim output and audit reference tables

Every simulator carries an `audit.md` with reference tables (TSFC, efficiency, mass flow, capex, LCOE) at named operating points. When the simulator is re-run with refactored equations or recalibrated constants, the audit reference tables can drift silently — the AM audit found GE9X cruise TSFC at 0.475 (audit table) vs 0.582 (current sim) — a 22 percent drift the prose still cited.

**CI enforcement**:

- Every simulator carries a machine-readable `audit-anchors.yml` next to its `audit.md`, listing the reference operating points and expected output values with tolerances:

  ```yaml
  # engagements/2026-05-astro-mechanica/simulations/cycle-comparison/audit-anchors.yml
  anchors:
    - architecture: GE9X
      operating_point: { mach: 0.85, altitude_m: 11000 }
      expected:
        tsfc_imperial:     { value: 0.475, tolerance: 0.05 }  # lbm/(lbf·hr)
        eta_thermal:       { value: 0.579, tolerance: 0.01 }
  ```

- `scripts/lint-sim-audit-drift.sh` runs on every PR that touches a simulator directory: re-runs the simulator, extracts the snapshot at each anchor's operating point, diffs against `expected`. FAIL on drift > tolerance.

- The author who refactors a simulator updates `audit-anchors.yml` (the registered expected values) and `audit.md` (the human-readable reference tables) in the same commit. CI green = both are in sync with the current sim.

No manual re-verification required.

### 8. The founder fresh-eyes read — before delivery

Before each engagement ships, the engineer runs a final read of every published surface with this question front-of-mind:

> *"If the founder read this page, what's the first thing they'd object to?"*

Per-paragraph check:

- **Technical**: efficiency, pressure, TIT, mass flow, materials, manufacturing footprint, test cadence — does each number match what the founder told us?
- **Biographical**: schools, prior companies, roles, dates, patent numbers — does each fact about a named person match what they themselves would say?
- **Commercial**: deal size, anchor MW, customer name, ASP, use-of-funds line — does each commercial claim match the deck and the founder's framing?
- **Architecture**: cycle / mechanism / operating principle — is this the actual mechanism, not a superficial analog?

The author IS the founder for one read-through. This is a checklist the author runs at the red-team step (see [Red-team (pre-delivery)](#red-team-pre-delivery--mandatory)).

### 9. Promotion path for honest unknowns

When a claim genuinely lacks a primary source at authoring time, the right move is to **either** (a) reframe the prose without the number ("publicly stated", "BLV bracket pending primary source", "deck-attributed pending direct verification"), **or** (b) move the verification to `engagements/<slug>/research-queue.md` (gitignored) for later resolution. Inline `[unverified]` brackets are banned in canonical prose — they leak the audit process into the reader-facing surface and signal carelessness. See [`wiki/methods/no-prose-interruptions-2026-05-20.md`](wiki/methods/no-prose-interruptions-2026-05-20.md).

### Lint enforcement roadmap

Rules 1–4 and 8 remain author-time judgment that no lint can fully enforce. Rules 5, 6, 7, and partial-2 are mechanical:

| Rule | Status | Script | Trigger |
|---|---|---|---|
| 5 — canonical-facts registry | **Roadmap** | `scripts/lint-canonical-facts.sh` | Every PR |
| 6 — URL freshness | **Roadmap** | `scripts/lint-link-freshness.sh` | Every PR touching citations + nightly across repo |
| 7 — sim-audit drift | **Roadmap** | `scripts/lint-sim-audit-drift.sh` | Every PR touching simulations |
| 2 — arithmetic patterns | **Roadmap** (partial) | `scripts/lint-arithmetic-patterns.sh` | Every PR; catches "N units (M MW)", "N×$M = total", "from A → B = C%" |
| 9 — inline `[unverified]` | **Shipped** | `scripts/lint-conciseness.sh` | Every PR |
| 1, 3, 4, 8 | Author judgment | — | Author-time |

The author-time discipline (Rules 1, 3, 4, 8) remains the load-bearing layer for the patterns lint cannot catch. The lint scripts above are the safety net that runs even when the author is tired, distracted, or new to the engagement.

**Implementation order**:

1. `lint-canonical-facts.sh` first — highest leverage, eliminates the entire class of cross-surface drift the AM audit had to retro-fix.
2. `lint-link-freshness.sh` second — independent, prevents the GEM URL / Boom XB-1 URL class of drift.
3. `lint-sim-audit-drift.sh` third — depends on `audit-anchors.yml` schema; can land alongside.
4. `lint-arithmetic-patterns.sh` last — narrow but high-leverage for the specific patterns ("N units (M MW)").

Each lint script ships with: schema (the YAML/anchors), the script itself, a unit test, and CI wiring in `.github/workflows/lint.yml`.

## Portal copy lives in a content collection, not in JSX — and at the engagement root, not buried in `portal/src/`

**All client-facing portal copy that gets edited more than once over an engagement must live as Markdown content-collection entries (not embedded in Astro / JSX page files) AND as canonical files at the engagement root (not buried under `portal/src/content/`).** The Astro portal reads from the engagement-root canonical files via its glob loader; the page itself is a thin `getCollection()` loop. Editing copy is editing one `.md` file per logical unit, with structured fields in YAML frontmatter and prose in YAML literal-block scalars (`field: |`).

Full method: [`wiki/methods/portal-copy-as-content-collection-2026-05-12.md`](wiki/methods/portal-copy-as-content-collection-2026-05-12.md).

**The canonical layout** for every editable portal surface in an engagement:

```
engagements/{slug}/
├── EDITING.md         ← top-level index of every editable surface (one per engagement)
├── memo/*.md          ← canonical memo prose (already established)
├── diligence/*.md     ← canonical diligence questions (reference implementation)
├── <surface>/*.md     ← future portal surfaces follow the same pattern
├── predictions.md     ← single-file content
├── retrospective.md   ← single-file content
├── log.md             ← single-file content
└── portal/            ← Astro build code only — no canonical prose lives inside this folder
    └── src/content/config.ts   ← loaders point UP to engagements/{slug}/<surface>/
```

Editable surfaces sit at depth 2 from the repo root (`engagements/{slug}/<surface>/`), not depth 6 inside `portal/src/content/`. The `EDITING.md` at the engagement root indexes every editable file with a one-line purpose so humans can find what to edit without spelunking.

**Apply when** the portal surface has (a) a list of N ≥ 4 items, (b) each item has multiple structured fields, AND (c) the copy is expected to be edited multiple times over the engagement. Examples: diligence questions, memo sections, addenda body content (when split into discrete sections), predictions list, sources, glossary entries.

**Do not apply** to: page-level structural shells (wrapper, nav, footer), one-off components without repeating content, static reference tables tightly coupled to a single page's prose, generated content from simulators.

**Why:** copy gets edited many times. Embedded JSX raises per-edit cost — HTML tags to balance, classes to preserve, structural risk on every change. Content collections drop the per-edit cost to near zero. Putting canonical files at the engagement root (rather than under `portal/src/content/`) drops the find-cost: editable prose sits next to `memo/` and the engagement README, not six directories deep. The PR-144 / PR-145 incident on the Astro Mechanica diligence page (a regex strip on JSX-embedded prose left orphan `</div>` tags that silently broke page layout) is the cautionary tale for the JSX half; the post-refactor "files are still hard to find" feedback is the cautionary tale for the path half.

**Reference implementation:** Astro Mechanica engagement, post-restructure. Canonical diligence files at [engagements/2026-05-astro-mechanica/diligence/](engagements/2026-05-astro-mechanica/diligence/) (18 numbered `.md` files plus a `README.md` indexing them); Astro glob loader configured at [portal/src/content/config.ts](engagements/2026-05-astro-mechanica/portal/src/content/config.ts) with `base: '../diligence'`; renderer at [portal/src/pages/diligence.astro](engagements/2026-05-astro-mechanica/portal/src/pages/diligence.astro); engagement-level surface index at [engagements/2026-05-astro-mechanica/EDITING.md](engagements/2026-05-astro-mechanica/EDITING.md).

**Internal link convention inside markdown:** write `[label]({base}/path/)`. The page renderer replaces `{base}` with the deployed base URL at build time. External links use real URLs (`https://...`) directly.

**Enforcement:** visual review on PR. Two heuristic checks: (1) if you find yourself doing repeated structural surgery on an `.astro` page that embeds substantive prose (more than 2–3 hand-built `<section>` blocks of repeating shape), migrate to a content collection before the next edit; (2) if a content collection's `.md` files live under `portal/src/content/<surface>/` instead of `engagements/{slug}/<surface>/`, move them up before the next edit. Migration cost is roughly 1–3 hours; break-even is 3–5 prose edits.

---

## Visual identity — the design system

Before producing any visual artifact (portal page, dashboard mock, deck slide, marketing surface), read `design-system/README.md` and `brand/identity.md`. The single source of truth for tokens is `design-system/colors_and_type.css`.

The system is a three-layer stack:

1. **`design-system/`** — the foundation. Tokens (`--ink-*`, `--signal-*`, `--phosphor-*`, status palette), type families (Inter / Inter Tight / JetBrains Mono), spacing, radii, shadows, motion. Plus signature physics motifs. Plus the click-thru `ui_kits/dashboard/` reference build.
2. **`portal-framework/styles/`** — the consumption layer. `blv-foundation.css` imports the design-system foundation and adds memo prose / table / form defaults. `tailwind-preset.mjs` exposes the tokens as Tailwind classes (`text-ink-700`, `bg-midnight`, `text-signal-500`, `text-status-pass` …) and aliases the legacy class names (`text-indigo`, `bg-paper`, `accent-teal` …) so older portals re-skin without per-call-site rewrites.
3. **`engagements/{slug}/portal/`** — each portal extends the framework preset and imports the foundation CSS. Engagement-specific accent colors (e.g. SpaceX `stainless`, `mesa`, `launch`) are added in the engagement's own `tailwind.config.mjs`.

**Hard rules that break the brand if violated:**

- No gradients. No glass / backdrop-filter. No bouncy animation (linear-biased easing only, ≤360 ms).
- No emoji.
- Sentence case in UI; ALL CAPS with tracking only on mono eyebrow labels.
- Physics motifs must be real computed diagrams. Never invent decoration that looks physics-y.
- Signal blue is for data ink and accents only. Never as a large fill.

When you need to design something new, the ordering is: read `design-system/README.md` → check `design-system/preview/` for the closest existing card → check `design-system/ui_kits/dashboard/` for the closest pattern → only then build, using tokens (CSS variables or Tailwind preset classes), never hardcoded hexes.

---

## Confidentiality policy

- Source files in `engagements/*/raw/` are confidential. They are **never copied verbatim** into `wiki/` or other shared layers.
- **Top-level proprietary-data folders matching `*_raw_data/` or `*-raw-data/`** (e.g. `AM_raw_data/` for Astro Mechanica) are confidential client materials. They are gitignored and **must never** be uploaded to GitHub. **Never `git add -f` anything inside them.** Never copy their contents into `wiki/`, into any portal, or into any other tracked file. Distilled de-identified knowledge from them enters the wiki via a `_summaries/`-style sanitised note, the same pattern `engagements/*/raw/` follows. The CI workflow at `.github/workflows/lint.yml` has a guard that fails the build if any tracked file matches the `*_raw_data/` / `*-raw-data/` pattern at any depth.
- **Distilled, de-identified knowledge** (e.g., "in one robotics engagement we found that the dominant thermal bottleneck was X at operating regime Y") enters the wiki freely. No internal silos.
- Client-facing portals show only the client's own engagement content. The internal wiki is never exposed externally.
- **Every deployed portal must ship a `robots.txt`** at `engagements/{slug}/portal/public/robots.txt` (and `portal-framework/site-root/robots.txt` for the firm-overview index). The file blocks every indexing, archiving, and AI-training crawler with explicit per-bot denials (Googlebot, Bingbot, ia_archiver, archive.org_bot, GPTBot, ChatGPT-User, OAI-SearchBot, CCBot, anthropic-ai, Claude-Web, ClaudeBot, PerplexityBot, Google-Extended, Bytespider, Amazonbot, FacebookBot) plus `User-agent: *` `Disallow: /`. This is in addition to the per-page `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex">` plus `Google-Extended` / `GPTBot` / `anthropic-ai` / `CCBot` meta tags that every portal page must inherit through `BaseLayout.astro`. **Reference for new portals:** copy from `engagements/2026-04-fortastra/portal/public/robots.txt`. **Enforced** by `scripts/lint-portal-robots.sh` (blocks CI merge if any engagement portal/public/ is missing the file or the file lacks the expected per-bot deny list). The reliable defense is Cloudflare Access on `portal.bluelotventures.com` (deployed 2026-05-23 — see `wiki/methods/portal-cloudflare-access-deployed-2026-05-23.md`; the as-planned runbook lives at `wiki/methods/portal-migration-cloudflare-access-2026-05-07.md`); robots.txt + meta tags are the defense-in-depth soft layer that well-behaved crawlers honor.
- For potentially ITAR/export-controlled work, a separate isolated workspace is required (not yet implemented; add when needed).

---

## Collaboration model

BLV is two engineers — **James Tuchel** and **Jared Metter** — sharing this repo with full parity. Both have admin on `BLV-master-repo` and the `BLV-raw` sidecar. Both run their own Claude Code instance against this same working tree, and we co-drive every engagement.

### Branch + PR flow — autopilot mode

- **`main` is protected.** No direct pushes; all changes land via pull request that passes CI.
- **PRs auto-merge on green CI.** Every PR is opened with `gh pr merge --auto --squash --delete-branch`. The branch protection rules (required `lint` check, no required reviewers) plus the `allow_auto_merge` repo setting are the guardrails — protection prevents either of us from overwriting each other's work; auto-merge keeps the loop fast. Review by the other engineer is encouraged for memo bodies, portal changes, and brand/voice edits, but never required.
- **"Auto resolution of any issues" applies to CI failures.** If lint fails on a PR Claude opened, Claude diagnoses the failure from the step summary and pushes a fix to the same branch — no human ping needed. Same for routine merge conflicts on shared narrative files (pull-rebase-resolve-push).
- **Branch naming**: `{handle}/{short-topic}` for human-driven branches (e.g., `tuchel/overview-energy-financials`, `jared/astro-mech-thermal-derivation`). Branches Claude Code creates on its own may use the `claude/` prefix.
- **One PR per logical change.** If a session sprawls into unrelated changes, split into multiple PRs.
- **Auto-deploy fires on every merge to `main`.** The portal site rebuilds and ships within ~2 minutes. Treat every merge as a client-visible release. If you're not ready to ship, don't merge — keep the PR open as draft (`gh pr ready --undo`) or hold the auto-merge enable.

### CI gate

Every PR runs `scripts/lint-memo.sh`, `scripts/lint-acronyms.sh`, the redteam-mirror guard (no `redteam-*.md` may leak into a portal content collection), and the raw-source-leak guard (any tracked file under `engagements/*/raw/` other than the README and `_summaries/` is a fail). Lint failures block merge and the workflow surfaces concrete fix suggestions in the GitHub Actions step summary. Iterate locally with `scripts/lint-memo.sh path/to/file.md` and `scripts/lint-acronyms.sh path/to/file.md` until green; auto-merge will fire as soon as the next push turns CI green.

**Match CI exactly with `scripts/lint-all.sh`.** It pins `LANG=C.UTF-8` (CI's locale) and runs every blocking lint in CI's order. Run before pushing any prose-touching change. **Recommended:** install the pre-push hook once with `bash scripts/install-hooks.sh` — it points `core.hooksPath` at `.githooks/`, so `git push` will run `lint-all.sh` automatically and reject pushes that would fail CI lint. Bypass with `git push --no-verify` (one-shot) or `BLV_SKIP_LINT=1 git push` for emergencies. The hook is per-clone (git config), so each engineer installs it once.

### Shared narrative files (avoiding merge conflicts)

A handful of files are append-heavy and edited by both engineers:

- `pipeline/pipeline.md`
- `wiki/index.md`
- `wiki/log.md`
- `predictions/index.md`
- per-engagement `engagements/{slug}/log.md`

Convention:

- **Pull before edit.** `git pull --rebase origin main` before opening any of these in a session.
- **Append, don't reflow.** Add new rows / entries; don't reorder or restructure existing rows in the same PR as substantive content edits.
- **Date-stamp every append.** Even when both of us add an entry on the same day, the merge resolution becomes "keep both, stack chronologically."
- **Long-form synthesis goes in its own page**, not into the index/log files. Keep the indexes thin.

---

## Autonomy policy

- **Max autonomy** on maintenance tasks: ingest, summarization, cross-references, index updates, lint, digest generation.
- **Human-in-loop by default** for: new entity pages asserting load-bearing claims, new lessons entries (the framing matters), new sim primitives (tests matter), anything going into the memo or the portal.
- **Explicit user confirmation** for irreversible ops: portal deploys, scheduled cron setup, deleting/renaming files.
- **Git pushes**: Claude may push to feature branches without asking. Pushing to `main` is forbidden by branch protection — never attempt it. When starting work that touches tracked files, default to creating a `claude/`-prefixed branch off `main`.
- **Red-team auto-runs** pre-delivery — user can override findings but cannot skip the pass.
- "Human-in-loop" means the engineer at the keyboard. Claude does not need to ping the other engineer mid-session — the PR review process handles second-pair-of-eyes when the operator wants it.
- When in doubt: take the action, save the result as a draft, surface it for review. Don't block on small decisions.

---

## Session-start ritual

When an LLM session starts in this repo:

1. Read the native instruction file for your runtime (`CLAUDE.md` or `AGENTS.md`).
2. `git fetch origin && git status` — surface any divergence from `origin/main` before starting work.
3. Read `wiki/index.md` and `predictions/index.md`.
4. Run `blv:daily-digest` skill (if available) to surface: due predictions, active engagements, pending red-team findings, newly suggested cross-refs.
5. Await user direction.

---

## Coding discipline

Generic guardrails against common LLM coding mistakes. These apply to **new code and simulations** in `sim-primitives/`, `portal-framework/`, `engagements/*/simulations/`, `engagements/*/portal/`, and anywhere else code is authored. They do **not** override the Autonomy policy above for wiki/index/log maintenance — that work stays autonomous.

These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think before coding

Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing code or a simulation:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them. Don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

Scope note: this "stop and ask" posture applies to code, simulations, and irreversible operations. Wiki maintenance, ingest, indexing, and log updates continue under the Autonomy policy ("take the action, save as draft, surface for review").

### 2. Simplicity first

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical changes

Touch only what you must. Clean up only your own mess.

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it. Don't delete it (see Autonomy policy: deletions require explicit user confirmation).

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request. Declared workflows (ingest, new-engagement scaffold, proactive surfacing) count as part of "the user's request" — the multi-file fan-out those workflows specify is expected, not a violation of this rule.

### 4. Goal-driven execution

Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

**For simulator code**: the author who re-runs a simulator updates the `audit.md` reference tables AND the machine-readable `audit-anchors.yml` in the same commit. Stale audit tables versus current sim output is a CI-spottable drift on the roadmap (see [Founder-level technical scrutiny § rule 7](#7-simulator-audit-drift--ci-enforced-parity-between-sim-output-and-audit-reference-tables)).

**These guidelines are working if**: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Pointers to specific runbooks

- Skills: `.claude/skills/*.md`
- Hooks: `.claude/settings.json`
- House style: `brand/house-style.md`
- Charting style: `brand/charting-style.md`
- Tufte-viz discipline (mandatory on every chart / infographic): `skills/tufte design/SKILL.md` plus `references__tufte-principles.md` + `references__analytical-design.md`. Reference implementation: `engagements/2026-05-astro-mechanica/portal/src/pages/helios-explainer.astro`.
- Design system (canonical foundation): `design-system/README.md`
- Design tokens (CSS source of truth): `design-system/colors_and_type.css`
- Design tokens (JSON mirror for tooling): `brand/tokens.json`
- Portal framework: `portal-framework/README.md`
- Portal copy as a content collection: `wiki/methods/portal-copy-as-content-collection-2026-05-12.md`
- Floating table of contents (portal-wide rule): `wiki/methods/floating-toc-2026-05-19.md` — every page on every portal surfaces a sticky TOC when > 500 published words OR > 3 H2 sections
- Sim primitives: `sim-primitives/README.md`
- Pipeline: `pipeline/pipeline.md`
- Predictions index (cross-engagement, backstage-only): `predictions/index.md` — never surfaced on portal; see `wiki/methods/predictions-stay-backstage-2026-05-20.md`
- No prose interruptions (footnotes / See-X / inline tier flags banned in canonical prose): `wiki/methods/no-prose-interruptions-2026-05-20.md`
- Verify up-front, never relabel: `wiki/lessons/presentation/verify-up-front-not-relabel-2026-05-20.md`
- §00 case bullets (3-4 bullets, ≤100 words per bullet): `wiki/lessons/presentation/three-bullet-case-100-word-cap-2026-05-20.md`
- No repetition across surfaces: `wiki/lessons/presentation/no-repetition-across-surfaces-2026-05-20.md`
- American-English discipline: `wiki/methods/uk-to-us-spelling-2026-05-17.md` (run `scripts/lint-spelling.sh` / `scripts/fix-spellings.sh`)
- Founder-level technical scrutiny — author-time discipline (dimension tags, arithmetic checks, canonical-facts registry, link freshness, sim-audit drift, founder fresh-eyes read): see the `## Founder-level technical scrutiny` section above. Per-engagement canonical-facts registry lives at `engagements/<slug>/canonical-facts.yml` and is CI-enforced on every PR via `scripts/lint-canonical-facts.sh` (roadmap).

Everything else flows from here.
