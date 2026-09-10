# AGENTS.md — Personal Operator Schema

This file tells any LLM agent entering this repo how to behave. Read it before doing other work. The goal is a disciplined compounding knowledge system for a personal projects monorepo — not a bag of markdown files.

---

## Who this repo is for

**tuchel-general** is James Tuchel's personal monorepo for projects and ideas that do not warrant their own repository. Small experiments, research threads, notes, scripts, and side projects live here. When something grows large enough (or needs its own deploy/CI/secrets boundary), it graduates to a dedicated repo.

What the system amplifies:

1. **First-principles thinking.** Rebuild claims from scratch; do not trust secondhand numbers.
2. **Compounding knowledge.** Distilled lessons stay in the project that taught them (`README.md`, `notes/`) and in git. Do not file them into `wiki/` unless the human asked.
3. **High-polish artifacts when it matters.** Charts, sims, and writeups that leave this repo should meet the same information and graphic discipline as anything client-facing.

Tone: understated, precise, falsifiable. No showy branding language. Reader-facing copy is the conclusion, not the lab notebook (see **Reader-facing prose**).

---

## Repo map

```
tuchel-general/
├── AGENTS.md          # this schema (agent entrypoint)
├── README.md          # human-facing overview
├── skills/            # agent skills
│   └── tufte design/  # mandatory for charts / infographics
├── wiki/              # optional notes. Leave on disk. Do not open, lint, or append unless the human asked.
└── projects/          # one folder per project or idea
    └── {yyyy-mm}-{slug}/   # or {slug}/ when date prefix is awkward
        ├── README.md  # purpose, status, pointers
        ├── raw/       # immutable sources (never copy verbatim into shared pages)
        ├── notes/     # working notes
        └── ...        # code, sims, writeups as needed
```

Add folders only when a project needs them. Do not invent empty ceremony directories.

`wiki/` is not part of the default workflow. The human will call on it when it is valuable. Until then: do not read `wiki/index.md` or `wiki/log.md` at session start, do not append the log, do not lint the wiki, do not create or update wiki pages, and do not register new pages in the catalog.

---

## Core workflows

### Ingest a source

When a new file lands in `projects/{slug}/raw/`, or when asked to ingest a source:

1. Read the source in full.
2. Write a summary under `projects/{slug}/raw/_summaries/{source-name}.md` (or `projects/{slug}/notes/` if there is no `raw/`).
3. Surface key takeaways after bookkeeping.

Stop there. Do not create entity or concept wiki pages, do not append `wiki/log.md`, and do not update `wiki/index.md`.

Never copy proprietary or private source text verbatim into shared pages. Distill and de-identify.

### Start a new project

When asked to start a project for `{name}`:

1. **Run prior-art search first** (below) — before scaffolding folders or writing substantial code. Surface results and wait for direction when a named incumbent already does the core job.
2. Create `projects/{yyyy-mm}-{slug}/` with at least `README.md` (purpose, status, open questions, prior-art notes).
3. Add `raw/`, `notes/`, or code folders only as needed.

Do not append `wiki/log.md` or register wiki pages.

### Prior-art search (external — before building)

This monorepo compounds knowledge; it does not exist to recreate working products by accident. First-principles thinking still applies — rebuild claims, not already-solved apps, unless the rebuild itself is the point.

When kicking off a **new project** or a **substantial new capability** (new user-facing surface, data product, or tool meant to do a job end-to-end):

1. State the **job to be done** in one sentence (who, where, what decision or action).
2. Search **outside the repo** for existing solutions: web products, mobile apps, GitHub repos, papers, agency/NGO tools, and obvious incumbents. Use the job sentence and concrete domain keywords — not only the working title.
3. Search **inside the repo** (`projects/`) for related threads. Search `wiki/` only if the human asked.
4. Report **3–5 closest matches** before writing substantial code. For each: name, URL (or install path), what job it covers, and the gap vs our goal (if any). Include “no close match found” with what was searched when that is the honest answer.
5. Recommend one of:
   - **Adopt / stop** — an existing tool already does the core job; prefer using it.
   - **Differentiate** — proceed only with a named delta the incumbent lacks (narrower audience, offline, different data, learning exercise, etc.).
   - **Rebuild for learning** — intentional recreation; state what skill or proof the rebuild is for.
   - **Proceed** — no close match; greenfield is justified.
6. **Named incumbent already does the core job:** pause. Do not scaffold a competing app or pour sessions into parity features until the human chooses adopt, differentiate, or rebuild-for-learning. “Core job” means the primary decision or action in step 1 — not a fuzzy feature-overlap percentage. Adjacent tools and inspiration still count as findings; they do not by themselves trigger the pause.
7. **Always file the search** in the project `README.md` (or `notes/prior-art.md`), including inspiration-only matches and honest “no close match” notes, so later agents do not repeat the miss.

Prior-art search is **max autonomy**. Choosing to build anyway when a named incumbent already does the core job is **human-in-loop**.

### Proactive surfacing (internal — on task start)

When opening or continuing project work (after kickoff prior-art is on file, or for smaller tasks):

1. Extract topic keywords from path, headers, and existing content.
2. Search prior `projects/` for related threads. Do not search `wiki/` unless the human asked.
3. Print the top 3–5 relevant prior-work pointers with a one-line reason each.
4. If an existing project already does the **core job**, recommend reuse vs branch.
5. If the task has grown into a new end-to-end product shape and no external prior-art note exists yet, run the external prior-art search above before expanding scope.

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
- **Reader-facing prose** (below). Canonical pages stay in present tense; no past-version framing.
- **Arithmetic check:** any sentence connecting two or more numbers with of / per / × / ÷ / for / across must multiply through before it ships.
- **Dimension tags:** when a quantity has more than one legitimate value, name the dimension in the same sentence (design-point vs peak; datasheet vs rounded; 2026 plan vs 2027 ramp).

### Reader-facing prose

Copy a person will read — apps, product READMEs, wiki pages the human asked you to write, chart labels, ledes — is the **final conclusion**. Tight. No meandering. Zero writing about writing.

The reader came for a decision or a fact. They did not come for the snapshot name, the fetch, the schema, or a tour of how the paragraph was assembled.

**Do not ship on those surfaces:**

- Snapshot or batch names as labels (`ranked-v2`, `ranked-batch-1`, `focus pass`).
- Process residue (`in this pass`, `on the pages fetched`, `not in the trays`, `unfetched`, `first-party claim`, `this file`).
- Internal field names where a sentence will do (`straddle` → the drive can reach 20 minutes).
- Writer instructions leaking into the page (`do not invent a waitlist`, `treat re-ranks as approximate`).
- How-we-got-here (`this is a household pick, not first-pass sort order`; `compared in depth`; `not some earlier table`).
- Past-version framing (`we used to say`, `previously`, `reweighted`). Present tense only.

**Where that material belongs:** git, code comments, working `notes/`. Scoring math that *is* the tool (live weights, unknown dropped from the denominator) may stay — say the human rule once, not a recap of the operator schema.

**Test:** delete any phrase a stranger would have to ask you to explain. If the sentence still decides, keep it. If it only records how the writer worked, cut it.

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

- Prefer feature branches off `main`. If `main` is protected, never push directly to `main`.
- Agent may create branches, commit, and push without asking.
- Branch naming: `cursor/{short-topic}` for agent-driven work; `tuchel/{short-topic}` for human-driven work. Lowercase only.
- One PR per logical change. Split sprawling sessions.
- Open PRs as draft when the work is not ready to merge; mark ready when it is.
- If CI exists and fails on an agent-opened PR, diagnose from the logs and push a fix to the same branch — no human ping required for routine lint/test failures.
- Auto-merge on green CI is fine when configured; treat merges as releases of whatever this monorepo publishes.

### Autonomy ladder

- **Max autonomy:** summarization into the project that owns the source, prior-art search + report (always file in the project), scaffolding empty project folders when no named incumbent already does the core job.
- **Human-in-loop by default:** anything user-facing that will be shared outside the repo, deletions/renames of existing content, **building a new app/capability when a named external incumbent already does the core job**, **any edit under `wiki/`**.
- **Explicit confirmation:** irreversible ops (force-push, deleting remote branches you did not create for this task, publishing/deploying, scheduled cron, secrets handling).
- When in doubt: take the action as a draft on a branch, surface it for review. Do not block on small decisions.

Wiki pages, the catalog, and the log are **ask-only**. Do not create, update, lint, or append them on your own initiative.

---

## Privacy & secrets

- Never commit credentials, API keys, tokens, or private personal documents.
- `projects/*/raw/` may hold sensitive source material — summarize into that project's `notes/` or `raw/_summaries/`; do not paste raw private content into shared pages.
- If a project needs a hard secrecy boundary, graduate it to a private dedicated repo rather than stretching this monorepo's assumptions.

---

## Session-start ritual

1. Read this `AGENTS.md`.
2. `git fetch origin && git status` — surface divergence from `origin/main`.
3. Await direction — or continue the stated task.

Do not read `wiki/index.md` or `wiki/log.md` unless the human asked.

---

## Coding discipline

Applies to new code under `projects/` and anywhere else code is authored.

### 1. Think before coding

State assumptions. Surface tradeoffs. If multiple interpretations exist, present them — do not pick silently. If something is unclear on a coding/sim task, stop and name the confusion.

### 2. Simplicity first

Minimum code that solves the problem. No speculative features, no abstractions for single-use code, no error handling for impossible cases. If 200 lines could be 50, rewrite.

### 3. Surgical changes

Touch only what the task requires. Match existing style. Do not delete unrelated dead code unless asked. Remove only orphans your change created.

### 4. Goal-driven execution

Define success criteria and loop until verified. Prefer "write the failing check, then make it pass" over vague "make it work."

---

## Efficiency (skip the ceremony)

Most turns already have a stated task. Do not run the full operator loop by default.

**Skip unless the condition is true:**

| Skip | Do it only when |
| --- | --- |
| Session-start ritual (fetch, status) | No task is stated, or you must merge/rebase onto latest `main` |
| Prior-art search (external) | New project or new end-to-end user-facing capability — not a copy/schema/data tweak |
| Proactive surfacing (internal) | Same gate as prior-art, or the human asked "what do we already have?" |
| Ingest a source (summary file) | The human asked to ingest, or the claim is load-bearing and has no project summary yet |
| Tufte reference files | The task designs or critiques a real chart/infographic — not ranking math or copy |
| Browser / computer-use pass | The diff changes user-visible UI, layout, or client behavior |
| Subscribe to GitHub CI | A `pull_request` workflow in `.github/workflows/` actually covers the files you changed |

**Hard skips (do not do these unless the human asked):**

- Open, lint, append, or create anything under `wiki/`.
- Answer a query by reading the wiki catalog first.
- File a new lesson, concept, or entity page after a task.

A schema-only or copy-only PR does not need a prior-art report, a wiki log line, or a browser pass.

---

## Pointers

- Tufte skill (mandatory for charts): [`skills/tufte design/SKILL.md`](skills/tufte%20design/SKILL.md)
- Projects root: [`projects/`](projects/)
