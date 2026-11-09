# Sources

| Source | Used for | URL |
| --- | --- | --- |
| APL Fall 2026 storytime flyer (user-provided scan) | Season window 7 Sep–21 Nov 2026; program taxonomy; “Select” vs weekly | not on the web; do not copy flyer artwork |
| APL Events / Storytimes | Dated instances, durations, branches | https://library.austintexas.gov/events/storytimes |
| APL event-type listings | All Ages, Pajama, Books and Babies, Toddler, Preschool, Spanish-English, French-English, Japanese-English, Mandarin-English, Music & Movement, Spanish storytime, Cuentos en español | https://library.austintexas.gov/events/all-ages-storytime and siblings |
| APL Locations & Hours | Branch street addresses and phones | https://library.austintexas.gov/locations |
| APL Holiday Closure Schedule | Skip Labor Day Sun–Mon 6–7 Sep 2026; Veterans Day Wed 11 Nov 2026 | https://library.austintexas.gov/node/1734929 |
| Nominatim / OpenStreetMap | Branch lat/lon for the map (queried 2026-08-25) | https://nominatim.openstreetmap.org |

Durations in the calendar come from the dated event listings (`10:00 AM to 10:30 AM`), not from a guessed default, except when a listing has a start time and no end (then 30 minutes).

## Drive times

- Source: OSRM table service, car profile (https://router.project-osrm.org), fetched 2026-11-09 by `scripts/drive_times.py`. The exact request URL and fetch time are stored in `data/drive_times.json`.
- What it measures: drive time and road distance from home (30.277964, -97.7902325) to each branch point in `data/branches.json`. OSRM derives speed from OpenStreetMap road class and speed limits and has no traffic model, so the times are free-flow drives.
- Derivation: minutes = round(OSRM seconds / 60); road miles = OSRM meters / 1609.344, to 0.1.
- Counter-evidence: not cross-checked against a traffic-aware router. Expect real midday drives to run longer; free-flow routers tend to underestimate signal and turn delay on arterials.

