# Search prior art before building

Before scaffolding a new product-shaped project, search for named tools that already do the core job — or you may rebuild a solved problem by accident.

## Summary

Kickoff work that only looks inside this monorepo misses external incumbents. The job sentence (“who needs what decision, where”) is the search key. If a named product already does that core job, pause for adopt / differentiate / rebuild-for-learning. Always file the search, including inspiration-only hits.

## Detail

### What went wrong

[`projects/2026-07-san-juan-whale-map/`](../../projects/2026-07-san-juan-whale-map/README.md) was kicked off as a boat-renter map for Salish Sea whale odds: where to go, seasonality, recent reports, live social pins. Substantial work landed (Pages deploy, heat windows, Puget Sound Whales day threads, conditions). After that investment, [Whale Locator](https://apps.apple.com/us/app/whale-locator/id6761505286) surfaced as a live Salish Sea sightings + AIS fleet map aimed at boaters and land-based watchers — the same core job of “where are the whales right now / where should I look.”

Internal proactive surfacing would not have caught it. There was no external prior-art gate in `AGENTS.md` at kickoff.

### What “core job” means here

Not a feature checklist score. The whale-map core job was real-time / recent whale location awareness for someone on the water or shore in the Salish Sea. Whale Locator ships that (community reports, push notifications, AIS whale-watch fleet, interactive map). Adjacent tools (Orca Network reporting, Ocean Wise Whale Report / WRAS for mariners, Acartia feeds) are still prior art worth filing even when they are not full substitutes.

### Rule now in force

See [`AGENTS.md`](../../AGENTS.md) → **Prior-art search (external — before building)**. Pause when a named incumbent does the core job. Always file findings in the project README or `notes/prior-art.md`.

## Sources

- [Whale Locator on the App Store](https://apps.apple.com/us/app/whale-locator/id6761505286) — Melonping Technologies Corp.; Salish Sea live sightings + AIS (accessed 2026-08-07)
- [Whale Locator terms](https://whalelocator.com/terms) / [privacy](https://whalelocator.com/privacy) — first-party site linked from the store listing
- Project that taught the lesson: [San Juan Whale Odds](../../projects/2026-07-san-juan-whale-map/README.md)

## Related

- [`AGENTS.md` prior-art search](../../AGENTS.md)
- [San Juan Whale Odds](../../projects/2026-07-san-juan-whale-map/README.md)
