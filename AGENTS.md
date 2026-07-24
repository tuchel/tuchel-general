# AGENTS.md — Personal Operator Schema

This file tells any LLM agent entering this repo how to behave. Read it before doing other work. The goal is a disciplined compounding knowledge system for a personal projects monorepo — not a bag of markdown files.

---

## Who this repo is for

**tuchel-general** is James Tuchel's personal monorepo for projects and ideas that do not warrant their own repository. Small experiments, research threads, notes, scripts, and side projects live here. When something grows large enough (or needs its own deploy/CI/secrets boundary), it graduates to a dedicated repo.

What the system amplifies:

1. **First-principles thinking.** Rebuild claims from scratch; do not trust secondhand numbers.
2. **Compounding knowledge.** Distilled lessons, concepts, and methods go into `wiki/` so later work starts smarter.
3. **High-polish artifacts when it matters.** Charts, sims, and writeups that leave this repo should meet the same information and graphic discipline as anything client-facing.

Tone: understated, precise, falsifiable. No showy branding language.

---

## Repo map

```
tuchel-general/
├── AGENTS.md                 # this schema (agent entrypoint)
├── README.md                 # human-facing overview
├── skills/                   # agent skills
│   └── tufte design/         # mandatory for charts / infographics
├── wiki/                     # LLM-owned compounding knowledge base
│   ├── index.md              # catalog of every wiki page
│   ├── log.md                # append-only chronological log
│   ├── concepts/             # reusable primitives (physics, engineering, finance, process)
│   ├── entities/             # people / companies / orgs / tools
│   ├── methods/              # how we analyze or build things
│   ├── lessons/              # compounding lessons-learned
│   └── _templates/           # templates for new wiki pages
└── projects/                 # one folder per project or idea
    └── {yyyy-mm}-{slug}/     # or {slug}/ when date prefix is awkward
        ├── README.md         # purpose, status, pointers
        ├── raw/              # immutable sources (never copy verbatim into wiki/)
        ├── notes/            # working notes
        └── ...               # code, sims, writeups as needed
```

Add folders only when a project needs them. Do not invent empty ceremony directories.

---

## Core workflows

### Ingest a source

When a new file lands in `projects/{slug}/raw/`, or when asked to ingest a source:

1. Read the source in full.
2. Write a summary under `projects/{slug}/raw/_summaries/{source-name}.md` (or `projects/{slug}/notes/` if there is no `raw/`).
3. Extract entities and update `wiki/entities/`. Create or update pages with facts and citations.
4. Extract concepts and update `wiki/concepts/`. Create pages when a concept recurs or is load-bearing.
5. Append to `projects/{slug}/` log if one exists, else `wiki/log.md`: `## [YYYY-MM-DD] ingest | {source-name} | {one-line takeaway}`.
6. Update `wiki/index.md` with any new pages.
7. Surface key takeaways after bookkeeping.

Never copy proprietary or private source text verbatim into `wiki/`. Distill and de-identify.

### Answer a query against the wiki

1. Read `wiki/index.md` first.
2. Read the relevant project README / notes if the query is project-adjacent.
3. Drill into specific pages.
4. Synthesize with citations (paths + line numbers, or wiki-links).
5. If the answer is non-trivial and reusable, file it back into `wiki/` (concepts / methods / lessons).

### Lint the wiki

Run periodically or on request:

1. Scan for contradictions between pages.
2. Flag stale claims superseded by newer sources.
3. Find orphan pages with no inbound links.
4. Find concepts mentioned but lacking a page.
5. Find missing cross-references.
6. Spot repeated ad-hoc analyses that should become `wiki/methods/` or a shared primitive.
7. Suggest new questions, sources, and primitives.

### Start a new project

When asked to start a project for `{name}`:

1. Create `projects/{yyyy-mm}-{slug}/` with at least `README.md` (purpose, status, open questions).
2. Add `raw/`, `notes/`, or code folders only as needed.
3. Run proactive surfacing (below).
4. Append a kickoff line to `wiki/log.md` and register any new entity/concept pages in `wiki/index.md`.

### Proactive surfacing (on task start)

When opening or scaffolding project work:

1. Extract topic keywords from path, headers, and existing content.
2. Search `wiki/concepts/`, `wiki/methods/`, `wiki/lessons/`, and prior `projects/`.
3. Print the top 3–5 relevant prior-work pointers with a one-line reason each.
4. If prior art overlaps strongly (≥80%), recommend reuse vs branch.

---

## Information discipline

Every load-bearing claim follows: **claim → primary source → derivation (if calculated) → counter-evidence searched.**

Rules:

- **Cite primary sources by URL** when asserting facts or numbers. Prefer company/regulator/paper/first-party sources over aggregators (Crunchbase, PitchBook, etc.).
- **Calculated numbers need a re-runnable trail** — a script, notebook cell, or explicit equation the reader can check. Multi-step math does not live in prose alone.
- **No adjectives without numbers.** Cut or quantify ("promising" without a comparison is banned).
- **Unverified claims stay out of headlines** (README summaries, verdicts, top risks). Either verify, reframe without the number, or park in a project research queue.
- **Acronyms:** full form on first use per page (`Full Name (ACRONYM)`), then acronym alone. Each page stands alone.
- **American English** in authored prose (`program`, `defense`, `center`, `behavior`, `analyze`). Preserve original spelling inside quotations.
- **No past-version framing on canonical pages.** State the current best answer in present tense. History belongs in `wiki/log.md`, git, or retrospectives — not "we used to say / previously / reweighted."
- **Arithmetic check:** any sentence connecting two or more numbers with of / per / × / ÷ / for / across must multiply through before it ships.
- **Dimension tags:** when a quantity has more than one legitimate value, name the dimension in the same sentence (design-point vs peak; datasheet vs rounded; 2026 plan vs 2027 ramp).

---

## Wiki compounding

`wiki/` is the durable layer. Projects are ephemeral relative to it.

- Prefer promoting recurring ideas to `wiki/concepts/` or `wiki/methods/` over leaving them buried in one project's notes.
- Lessons from mistakes go in `wiki/lessons/` with a link back to the project that taught them.
- `wiki/index.md` stays thin and current; long synthesis gets its own page.
- `wiki/log.md` is append-only and date-stamped. Append; do not reflow history in the same change as unrelated edits.

---

## Charts & graphics

### Tufte skill — mandatory

When designing, refactoring, or critiquing any chart, infographic, schematic, dashboard, or data visualization:

1. Read and follow [`skills/tufte design/SKILL.md`](skills/tufte%20design/SKILL.md).
2. Apply the workflow (clarify the data story → pick the approach → design for data-ink → run the test).
3. Do not ship the viz until it passes the 7-question Tufte test below.

Also use `skills/tufte design/references__tufte-principles.md` and `references__analytical-design.md` for denser displays.

### The 7-question Tufte test (gate)

1. **Data-ink:** Can I erase any element without losing data? (Erase it.)
2. **Integrity:** Does the visual effect match the data effect? (Lie factor ≈ 1.)
3. **Chartjunk:** Does any element exist for decoration only? (Remove it.)
4. **Excellence:** Does the chart reveal data at multiple levels? (Macro + micro.)
5. **Comparison:** Can the reader easily compare elements? ("Compared to what?")
6. **Density:** Could the chart show more data in the same space? (Condense.)
7. **Context:** Labels, sources, scales, units present?

### Interactive chart standards (when building interactive viz)

- **Hover tooltips** on every data element (rich tooltip, not a bare browser `title`), with at least three of: title, key-values, source, contextual note. Invisible hit target ≥ 12 px.
- **Bound-grounded sliders** on live simulators: each range input states what the lower bound, upper bound, and current value mean physically. Numeric-only sliders are forbidden.
- **Default to live simulator over static SVG** when the curve comes from an equation — expose parameters. Static charts are the exception.

Patterns that usually win: range-frame axes, single-hue sequential ramps (not rainbow for sequential data), dense tables over card grids when the unit of analysis repeats, legends that are data (strips/eyebrows) rather than boxed chrome.

---

## Git & autonomy

Solo repo. No co-author merge theater.

### Branch + PR flow

- Prefer feature branches off `main`. If `main` is protected, never push directly to it.
- Agent may create branches, commit, and push without asking.
- Branch naming: `cursor/{short-topic}` for agent-driven work; `tuchel/{short-topic}` for human-driven work. Lowercase only.
- One PR per logical change. Split sprawling sessions.
- Open PRs as draft when the work is not ready to merge; mark ready when it is.
- If CI exists and fails on an agent-opened PR, diagnose from the logs and push a fix to the same branch — no human ping required for routine lint/test failures.
- Auto-merge on green CI is fine when configured; treat merges as releases of whatever this monorepo publishes.

### Autonomy ladder

- **Max autonomy:** wiki ingest, summarization, cross-references, index/log updates, lint cleanups, scaffolding empty project folders.
- **Human-in-loop by default:** new wiki pages that assert load-bearing claims, new lessons (framing matters), anything user-facing that will be shared outside the repo, deletions/renames of existing content.
- **Explicit confirmation:** irreversible ops (force-push, deleting remote branches you did not create for this task, publishing/deploying, scheduled cron, secrets handling).
- When in doubt: take the action as a draft on a branch, surface it for review. Do not block on small decisions.

### Shared narrative files

`wiki/index.md` and `wiki/log.md` are append-heavy:

- Pull/rebase before editing if the remote may have moved.
- Append; do not reorder existing rows in the same PR as unrelated content.
- Date-stamp every append.
- Long-form synthesis gets its own page; keep indexes thin.

---

## Privacy & secrets

- Never commit credentials, API keys, tokens, or private personal documents.
- `projects/*/raw/` may hold sensitive source material — summarize into wiki; do not paste raw private content into shared wiki pages.
- Distilled, de-identified knowledge may enter `wiki/` freely.
- If a project needs a hard secrecy boundary, graduate it to a private dedicated repo rather than stretching this monorepo's assumptions.

---

## Session-start ritual

1. Read this `AGENTS.md`.
2. `git fetch origin && git status` — surface divergence from `origin/main`.
3. Read `wiki/index.md` (and skim recent `wiki/log.md` entries).
4. Await direction — or continue the stated task.

---

## Coding discipline

Applies to new code under `projects/` and anywhere else code is authored. Does not override max-autonomy wiki maintenance.

### 1. Think before coding

State assumptions. Surface tradeoffs. If multiple interpretations exist, present them — do not pick silently. If something is unclear on a coding/sim task, stop and name the confusion.

### 2. Simplicity first

Minimum code that solves the problem. No speculative features, no abstractions for single-use code, no error handling for impossible cases. If 200 lines could be 50, rewrite.

### 3. Surgical changes

Touch only what the task requires. Match existing style. Do not delete unrelated dead code unless asked. Remove only orphans your change created.

### 4. Goal-driven execution

Define success criteria and loop until verified. Prefer "write the failing check, then make it pass" over vague "make it work."

---

## Pointers

- Tufte skill (mandatory for charts): [`skills/tufte design/SKILL.md`](skills/tufte%20design/SKILL.md)
- Wiki catalog: [`wiki/index.md`](wiki/index.md)
- Wiki log: [`wiki/log.md`](wiki/log.md)
- Projects root: [`projects/`](projects/)
