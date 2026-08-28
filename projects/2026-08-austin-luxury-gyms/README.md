# Austin luxury gyms — from 427 Ridgewood Road

Map of **Equinox-level and above** clubs in Austin, scored from home at 427 Ridgewood Road, West Lake Hills. Floating glass panel on the map: must-haves, fit weights, commute cost, and a price × drive scatter.

**Status:** Pages path `/gyms/` after merge — https://tuchel.github.io/tuchel-general/gyms/

## Bar

Equinox Austin Select is the floor: **$250/month** on the [club page](https://www.equinox.com/clubs/texas/austin) (2026-08-28). Life Time, Soho House, Monroe, and private country clubs sit at or above that amenity/price band. **KOKORO Wellness** is below on dues ($125/mo) and is kept as the closest Technogym + contrast gym — the commute control.

## What the page decides

1. **Must-haves** hide clubs (pool in dues, contrast, kids, Saturday after 8pm, travel network, public price, no timed garage).
2. **Fit** is a weighted score: commute, price, recovery, family, weekend nights. Sliders state what 0 and 1 mean.
3. **All-in cost** = 12 × monthly dues + round-trip drive hours × visits/week × 52 × value of time.
4. **Price × drive scatter** — country-club dues are open circles (initiation is extra).
5. **Compare** up to three clubs on a dense amenity table.

Drive times are OSRM uncongested (2026-08-28). Peak is a × 1.7 bound, not live traffic.

## Local

```bash
cd projects/2026-08-austin-luxury-gyms
python3 scripts/check_gyms.py
cd web && npm install && npm run dev
# http://localhost:5173/tuchel-general/gyms/
```

## Prior art

See [`notes/prior-art.md`](notes/prior-art.md). Google Maps already finds gyms; this page’s delta is the Equinox-or-above set, quoted dues, and commute cost from this house.

## Sources

[`notes/sources.md`](notes/sources.md). Confirm every quote on a tour.
