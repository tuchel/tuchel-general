# AGENTS.md — Personal Operator Schema

Already in context. Do not re-read this file. Do the stated ask.

**tuchel-general** is James Tuchel's personal monorepo. Work lives under `projects/`. Graduate a project when it needs its own repo. `wiki/` stays on disk; do not open it unless asked. Tone: understated, precise, falsifiable. Reader-facing copy is the conclusion, not the lab notebook.

## Hard skips

Unless the human asked:

- Do not re-read this file, or `git fetch`, unless merging / rebasing / the task needs latest `main`
- Do not open, lint, append, or create anything under `wiki/`
- Do not print a prior-art or prior-work tour on polish, copy, bugfix, schema, or conflicts
- Do not research or scaffold a named addition before reading that project's stated constraints. Fail a constraint → stop in the thread; do not build the card
- Do not open a second PR to “log” a scrap. Close the PR. Add a one-file guardrail only if a repeat is likely
- Do not present alternate interpretations when the ask is a single stated action
- Do not browser-verify or record video for schema, policy, or copy
- Do not subscribe to CI unless a `pull_request` workflow in `.github/workflows/` covers the diff
- Do not invent waitlists, tuition, credentials, or other unpublished facts

## Skip unless the condition is true

| Skip | Do it only when |
| --- | --- |
| Prior-art (external) + search of `projects/` | New project or new end-to-end user-facing capability |
| Ingest (summary file) | Asked to ingest, or a load-bearing claim has no project summary |
| Tufte skill + reference files | Designing or critiquing a real chart — not ranking math, copy, or chrome |
| Browser pass | The diff changes user-visible UI, layout, or client behavior |

Schema / policy / copy: open the PR **ready**. No prior-art report. No browser pass. Draft only when UI is still unverified or checks still fail.

## New project / new capability

State the job in one sentence. Search outside the repo and under `projects/`. Report 3–5 closest matches (name, URL, job, gap), then adopt / differentiate / rebuild-for-learning / proceed. Pause if a named incumbent already does the core job — that choice is human-in-loop. File the search in the project README or `notes/prior-art.md`. Scaffold `projects/{yyyy-mm}-{slug}/` with a README; add folders only as needed.

## Ingest

Read the source. Summarize into that project's `raw/_summaries/` or `notes/`. Stop. Distill; do not copy private text.

## Information discipline

claim → primary source URL → derivation (if calculated) → counter-evidence searched.

- Calculated numbers need a re-runnable trail.
- No adjectives without numbers. Unverified claims stay out of headlines.
- Acronyms: full form on first use per page. American English in authored prose.
- Any sentence connecting two or more numbers must multiply through.
- Dimension-tag quantities that have more than one legitimate value.

### Reader-facing prose

Apps, product READMEs, chart labels, ledes: the final conclusion. Present tense. No snapshot names (`ranked-v2`), process residue (`in this pass`, `unfetched`), internal field names, writer instructions, or how-we-got-here. That material belongs in git, comments, and `notes/`.

Test: delete any phrase a stranger would have to ask you to explain.

## Charts

Read [`skills/tufte design/SKILL.md`](skills/tufte%20design/SKILL.md). Pass the 7-question test there. Open the reference files only for a new dense display.

## Git & autonomy

Solo repo. Feature branches off `main`; never push `main`. `cursor/{topic}` agent, `tuchel/{topic}` human. Lowercase. One PR per logical change. Agent may commit and push. Fix failing CI on the same branch.

- **Max autonomy:** project summaries, prior-art on a new capability, scaffolding when no incumbent does the core job, closing a PR the user asked to scrap.
- **Human-in-loop:** user-facing work shared outside the repo, deletions/renames, building when a named incumbent already does the core job, any edit under `wiki/`.
- **Confirm:** force-push, deleting remotes you did not create, publish/deploy, cron, secrets.

## Privacy

Never commit credentials or private personal documents. Summarize `raw/` into that project's notes.

## Code

A stated “do X” is not a fork — do X. Minimum code. Touch only what the task requires. Write the failing check, then make it pass. Stop and name confusion only when the task is actually ambiguous.
