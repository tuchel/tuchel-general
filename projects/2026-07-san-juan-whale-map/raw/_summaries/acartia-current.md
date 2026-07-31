# Summary — Acartia current sightings

- **Source:** `https://acartia.io/api/v1/sightings/current`
- **Role in app:** “nowcast” ring markers on the map (bbox-filtered)

## What it is

SSEMMI / Acartia cooperative feed pooling Spotter (Conserve.io), Orca Network-linked reports, and partners. The open `current` endpoint returns recent sightings without an API key; the `trusted` historical endpoint requires registration.

## San Juan bbox slice

On the 2026-07-31 pull: 16 in-bbox rows (of 62 Salish-wide), mostly orca and humpback, with remarks often carrying `[Orca Network]` provenance.

## Use / limits

Good for “what moved this week,” not for seasonality. Always show beside the multi-year heatmap so one lucky pin doesn’t redefine the plan.
