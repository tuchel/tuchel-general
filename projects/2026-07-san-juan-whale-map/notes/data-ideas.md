# Ideas — pull, organize, present

Audience: a group renting a boat around San Juan Island who want to maximize whale odds without wrecking the day (or the whales).

## Pull

1. **Climatology layer (what we ship first)**  
   Nightly SalishSea.io DWCA → filter bbox → hex-bin by species × month. Answers “where do people usually see X in August?”

2. **Nowcast layer**  
   Acartia `/sightings/current` every few minutes while the app is open. Hollow markers so they don’t fight the heatmap. Optional: OrcaSound “calls detected in last hour” as a soft pulse on Lime Kiln.

3. **Ecotype split**  
   Map `Orcinus orca ater` → Southern Resident, `rectipinnus` → Bigg’s, bare `Orcinus orca` → unspecified orca. Bigg’s vs Residents have different seasons and hunting grounds (seals at Cattle Pass / spit reefs vs salmon along Haro).

4. **Effort bias correction (v1+)**  
   Divide sightings by a crude effort proxy: commercial whale-watch track density, ferry passages, or sunny-weekend days. Without this, Lime Kiln and Friday Harbor approaches look “hotter” than quiet corners with equal whales.

5. **Tide clock join**  
   Tag each historical sighting with tide stage at Friday Harbor (CO-OPS). Test the folk claim: northbound on flood, southbound on ebb along the west side. Present as a small multiples strip, not a slogan.

6. **Weather gate**  
   Pull wind / wave for the rental window. Dim the map and show “odds model paused — small craft” above ~15–20 kt for open Haro. Whales don’t care; your boat does.

7. **Salmon / prey proxies**  
   DFO / WDFW Chinook run timing as a soft prior for Southern Resident summer presence. Don’t pretend it’s real-time fish GPS.

8. **Cross-border BC data**  
   Ocean Wise / BCCSN when licensing allows — Haro is half Canadian. Acartia’s Phase 3 goal is exactly this.

## Organize

| Grain | Use |
| --- | --- |
| Raw occurrence | Provenance, audit, rebuild |
| Hex cell × species × month | Heatmap + odds score |
| Hotspot polygon | Named “go here” cards with why |
| Trip day profile | One row: date → recommended zones + species priors |
| Exclusion / etiquette buffer | 200 yd / slow-zone rings around known animals |

Keep **species**, **ecotype**, **month**, **hour**, **source trust**, **coord precision** as first-class columns. Drop or flag iNaturalist obscured points (public accuracy ~tens of km) from fine heatmaps.

## Present (UI patterns that fit a boat day)

1. **Odds mode (default)** — hex fill = relative likelihood for the selected month + species. One slider for month, chips for species. Macro: whole archipelago; micro: hover a hex for counts + peak months.

2. **Today mode** — recent Acartia pins + “last seen moving toward…” if consecutive reports share a corridor (Haro west side northbound).

3. **Trip planner strip** — pick launch (Friday Harbor / Roche / …), hours available, sea-state comfort. Output: ranked loop (e.g. west-side Haro → turn at Hein Bank approaches → Cattle Pass seal haul-outs for Bigg’s).

4. **Species calendar** — dense month × species table (Tufte-style) beside the map; selecting a cell sets the map filters. Better than twelve separate charts.

5. **Compare days** — “Saturday vs Sunday” if the rental is a weekend; show which forecast wind favors which side of the island.

6. **Hydrophone ear** — tiny Lime Kiln / OrcaSound status: listening / calls / offline. Sound without leaving the map.

7. **Etiquette always-on** — sticky 200-yard killer whale rule + “if whales approach you, put engine in neutral.” Never bury this under a modal.

8. **Shareable waypoint pack** — export GPX of hotspot centroids + “do not chase” corridors for the chartplotter / phone offline.

## Scoring sketch (transparent, not ML theater)

For selected month *m* and species set *S*:

`score(cell) = log(1 + count_{S,m}(cell)) × recency_weight × effort_discount`

Show the ingredients on hover (“12 Aug orca reports 2022–25 · 3 in last 14 months”). No black-box “92% chance.”

## Shipped in the app (2026-07-31)

| Idea | Implementation |
| --- | --- |
| Climatology vs nowcast | View mode toggle (balanced / climatology / nowcast) |
| Ecotype split | Species chips + Residents / Bigg’s / Humpback+ presets |
| Tide clock | NOAA CO-OPS Friday Harbor 9449880 hi/lo, client refresh 5 min |
| Weather gate | Open-Meteo 10 m wind + waves at mid-Haro; go / caution / no-go |
| Hydrophone ear | OrcaSound Lab + North SJC feeds + detection pulse |
| Effort bias | `score = raw × median / (effort + 0.5×median)` toggle |
| GPX export | Corridors + launches waypoints download |
| Social nowcast | Bluesky author feeds → place-tagged pins + Live tab list (X/Reddit blocked) |

## What not to do

- Promise a sighting rate. Commercial “90%” claims are tour-operator statistics under different effort.
- Chase pins. The map is for positioning in productive water, then watching.
- Treat Facebook screenshots as ground truth without the Orca Network / Acartia vetting path.
