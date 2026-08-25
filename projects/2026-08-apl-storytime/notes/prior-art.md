# Prior art — APL storytime iCal

Job to be done: a caregiver in Austin wants the Fall 2026 Austin Public Library storytime schedule (printed flyer, 7 Sep–21 Nov 2026) in Apple Calendar / iCal, so they can see when and where to go without re-reading the flyer.

Searched 2026-08-24: web products, library calendar pages, ICS/webcal feeds, GitHub, this repo (`wiki/`, `projects/`).

## Closest matches

| Name | URL | Job it covers | Gap vs this job |
| --- | --- | --- | --- |
| APL Events Calendar | https://library.austintexas.gov/events/calendar | Browse upcoming programs by date/branch | No public iCal / webcal subscribe. Must click through the site. |
| APL Storytimes index | https://library.austintexas.gov/events/storytimes | Lists dated storytime events as web cards | Same: HTML only, no feed. “Select” dates are not expanded on the flyer. |
| APL event-type pages (All Ages, Pajama, Books and Babies, …) | e.g. https://library.austintexas.gov/events/all-ages-storytime | Dated instances with start/end and branch | Still no ICS. Individual event pages also have no Add to Calendar / `.ics` link (checked 2026-08-24 on a virtual Hora de Cuentos page). |
| BiblioCommons (APL catalog login) | https://austin.bibliocommons.com/ | Catalog / account | Not the events calendar; no storytime ICS. |
| This repo | `wiki/`, `projects/` | Other personal tools | No library-calendar thread. |

## Recommendation

**Differentiate.** APL already publishes the dates; it does not publish a subscribeable calendar. The delta is a single Fall 2026 `.ics` (plus a small subscribe page) built from those dated listings, limited to the flyer window.

Not adopt/stop: the named incumbent does not do the core action (put the flyer season on iCal).

## Closest matches — map + day explorer

| Name | URL | Job it covers | Gap vs this job |
| --- | --- | --- | --- |
| APL Events Calendar | https://library.austintexas.gov/events/calendar | Browse programs by date/branch | No map, no “near me,” no iCal. |
| Toronto Public Library Events Finder | https://jentacularjava.github.io/tpl_events/ | Filterable table of TPL programs | Toronto only; table, not a map. |
| TPLBrowser | https://github.com/shaheem-pp/TPLBrowser-swiftui | Map of Toronto library *branches* | Branches, not storytimes-by-day. |
| Calendar Map Filter | https://cmf.chadnorwood.com | Generic map+list over calendar feeds | Empty until you wire a feed; not APL storytimes. |
| This project's ICS | `web/public/storytime.ics` | Subscribe the flyer season | No geography. |

## Recommendation

**Differentiate.** No named product maps Austin Public Library Fall 2026 storytimes by day with click-through to listings. CMF is a generic shell, not this dataset. The companion GUI is the map + density calendar + near-me sort on the dated listings already in this project.

## Inspiration only

- Generic “Add to Calendar” widgets on other library LibCal sites (Springshare) — APL is not on a public LibCal ICS for storytime.
- GitHub Pages as a static `text/calendar` host (same pattern as other Pages surfaces in this monorepo).
- San Juan Whale Odds map in this repo — MapLibre, map-first sheet, no Google Maps key.
