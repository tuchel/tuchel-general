# SPCX portal

A dashboard for Space Exploration Technologies Corp. (SpaceX, Nasdaq: SPCX). It opens on one figure: quarterly revenue and the daily closing share price on a shared time axis. Analyst coverage and sources sit behind disclosures below it.

**Status:** first figure live. Data through the Q3 2026 release (October 20, 2026).

## Run

```sh
cd web
npm install
npm run dev            # local
npm run build:single   # one self-contained HTML file in dist-single/
```

The figure is registered in `web/src/figures.tsx`, so `npm run check` in `shared/charts` gates it.

## Data

`web/src/data.ts` holds every number with its source. `notes/sources.md` records where each came from, the derivations, and the cross-checks. `notes/prior-art.md` lists the closest existing tools.

## Open questions

- Q3 2026 primary source is the release PDF; swap in the 10-Q link once SpaceX files it.
- Full analyst research notes (JPMorgan, Morgan Stanley, others) are distributed to each bank's clients; the portal carries ratings and targets as reported.
