# Source catalog — San Juan whale odds

Primary / first-party where possible. Aggregators noted as such.

## Live & cooperative sightings

- **Acartia (SSEMMI)** — `https://acartia.io/api/v1/sightings/current`  
  Pools Spotter / Conserve.io, Orca Network, Whale Alert partners. Creative Commons community data. Trusted historical endpoint needs an API key; current feed is open.
- **SalishSea.io DWCA** — `https://salishsea.io/dwca/salishsea-occurrences-v1.zip`  
  Nightly DarwinCore Archive + GeoParquet. Includes native + Whale Alert / Orca Network-style reports; excludes iNaturalist & Happywhale (those publish via GBIF). License: CC BY-NC 4.0.  
  About: `https://salishsea.io/` · code: `https://github.com/salish-sea/salishsea-io`
- **Orca Network Whale Sighting Network** — `https://orcanetwork.org/our-programs/whale-sighting-network/`  
  Community reports, monthly summaries, shore viewpoints map, hydrophone pointers (OrcaSound).

## Biodiversity APIs (cross-check)

- **iNaturalist Observations API** — `https://api.inaturalist.org/v1/observations`  
  Research-grade + casual; coords often obscured for threatened taxa (orca public accuracy can be tens of km — use for coarse density only).
- **GBIF Occurrence API** — `https://api.gbif.org/v1/occurrence/search`  
  Aggregates iNaturalist and other publishers; good for long-tail mysticete records.

## Habitat & regulation

- **NOAA SRKW critical habitat (MapServer 195)** —  
  `https://maps.fisheries.noaa.gov/server/rest/services/All_NMFS_Critical_Habitat/MapServer/195`  
  Inland WA (2006) + coastal revision (2021). Final rules: 71 FR 69054; 86 FR 41668.  
  Narrative: `https://www.fisheries.noaa.gov/west-coast/endangered-species-conservation/critical-habitat-southern-resident-killer-whales`
- **Be Whale Wise** — `https://www.bewhalewise.org/`  
  Approach distances, slow zones, reporting.
- **WA State Parks — Lime Kiln Point** — whale-watch park brochure / site pages.

## Seasonal & hotspot literature (curated into app, not scraped wholesale)

- Olson et al. / Whale Museum Orca Master — long-term SRKW presence patterns (summer central Salish Sea; fall Puget Sound shift). Example: *ESR* 2018 DOI `10.3354/esr00918`.
- NPS San Juan Island NHP — *Land-Based Whale Watching Guide for San Juan Island* PDF:  
  `https://www.nps.gov/sajh/planyourvisit/upload/Land-Based-Whale-Watching-Guide-for-San-Juan-Island-accessible.pdf`
- Frontiers 2024 mysticete space-time shifts in Central Salish Sea — humpback rebound post-~2010, SJF / SJI clusters:  
  `https://www.frontiersin.org/journals/conservation-science/articles/10.3389/fcosc.2024.1401838/full`

## Hydrophones & “are they nearby right now?”

- **OrcaSound** — listen pages at `https://live.orcasound.net/listen/{slug}` (e.g. `orcasound-lab`, `north-sjc`). Feeds JSON:API on live/beta.
- OrcaHello / automated detectors sometimes feed SalishSea.io remarks (see occurrence remarks).

## Weather / sea state (not yet wired; candidates)

- NWS marine forecasts — `https://www.weather.gov/` zones PZZ132 / PZZ133 (Northern Inland Waters / Admiralty Inlet).
- NOAA CO-OPS tides — Friday Harbor station `9449880`.
- Open-Meteo marine API — wave height / wind for small-boat go/no-go.

## Boat logistics (reference points)

- Friday Harbor, Roche Harbor, Snug Harbor / Mitchell Bay, Deer Harbor (Orcas), Anacortes / Washington Park — typical rental / charter departure areas.
- Shipping lanes & ferry routes — NOAA charts / Washington State Ferries; keep clear when whales are near ferry tracks (Orca Network alerts ferries).
