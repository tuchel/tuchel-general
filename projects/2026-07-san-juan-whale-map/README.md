# San Juan Whale Odds Map

Interactive map of the waters around San Juan Island for a group renting a boat and trying to maximize the chance of seeing whales — by place, season, species, time of day, and recent reports.

**Status:** Live on GitHub Pages after merge — https://tuchel.github.io/tuchel-general/whale/

**Includes:** SalishSea.io hex density · Acartia nowcast · NOAA tides · Open-Meteo wind gate · OrcaSound hydro pulse · effort-bias scoring · GPX export · Be Whale Wise.

## What it answers

- Where around San Juan have whales shown up most often (by species)?
- Which months favor Southern Residents vs Bigg’s vs humpbacks?
- What has been reported in the last ~week (when the feed is up)?
- Where to launch, which corridors are classic, and how far to stay back.

## Run

```bash
cd projects/2026-07-san-juan-whale-map
python3 scripts/build_data.py          # refresh public datasets → web/public/data/
cd web && npm install && npm run dev   # http://localhost:5173/tuchel-general/whale/
```

Deploy: push to `main` (or Actions → “Deploy GitHub Pages”). Artifact path `/whale/`.

## Data sources (public)

| Source | Role | Access |
| --- | --- | --- |
| [SalishSea.io DarwinCore Archive](https://salishsea.io/dwca/) | Historical Salish Sea sightings (Orca Network / Whale Alert / etc.) | Nightly zip, CC BY-NC 4.0 |
| [Acartia / SSEMMI](https://acartia.io/) `GET /api/v1/sightings/current` | Recent cooperative sightings | Open current feed |
| [NOAA SRKW critical habitat](https://maps.fisheries.noaa.gov/server/rest/services/All_NMFS_Critical_Habitat/MapServer/195) | Habitat polygon overlay | ArcGIS REST → GeoJSON |
| [iNaturalist](https://api.inaturalist.org/v1/observations) | Cross-check density (optional pull) | Public API |
| Curated hotspots / calendar | Boat-renter heuristics from NPS, WA Parks, Whale Museum literature | See `notes/` |

Raw downloads stay under `raw/` (gitignored where large). Distilled JSON for the app lives in `web/public/data/`.

## Docs in this project

- [`notes/data-ideas.md`](notes/data-ideas.md) — ways to pull, organize, and present the data
- [`notes/sources.md`](notes/sources.md) — source catalog + citation URLs
- [`notes/boat-playbook.md`](notes/boat-playbook.md) — practical trip heuristics (not guarantees)

## Caveats

Sightings are opportunistic and biased toward boat traffic, good weather, and popular viewpoints. Density ≠ guaranteed whales. Southern Resident killer whales are endangered — [Be Whale Wise](https://www.bewhalewise.org/) distance rules apply (200 yards / 183 m for killer whales in WA inland waters; go slow in the vicinity).
