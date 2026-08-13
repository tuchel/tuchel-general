# Intensity pacing — narrative pressure curves

STAR MIND combat pressure is driven by an **Intensity Director**, not a flat spawn timer.

Every **level × goal** has:

1. A **progress** metric (0→1) tied to the narrative beat (truck to Pad 7, gates cleared, spines down, …).
2. An **intensity curve** (keyframed 0→1) with intentional **lulls** and **sprints**.
3. Runtime multipliers: live-enemy cap, spawn period, aggression (fire/move).

Boss fights and boarding/circ codas are first-class beats on those curves — not afterthoughts.

---

## Shared grammar

| Intensity | Feel | Live foes (approx) | Notes |
|-----------|------|--------------------|-------|
| 0.0–0.25 | Lull / breath | 0–2 | Teach, loot, read the next landmark |
| 0.25–0.5 | Patrol pressure | 2–4 | Standard Metal Slug peel |
| 0.5–0.75 | Sprint | 4–6 | Mix heavies; CAPCOM tension |
| 0.75–1.0 | Peak | 5–8 | Set-piece or boss phase |

Rules:

- **Each goal starts low** — never drop the player into a peak.
- **Lull after every major beat** (spine kill, gate cluster, truck near pad, boss down).
- **Sprint before the destination** (Pad 7 approach, last gates, cavity mouth).
- Density director **refuses to spawn** when live count ≥ curve target.

---

## Act difficulty

| Act | HP | Damage | Speed | Notes |
|-----|----|--------|-------|-------|
| L1 Earth | ×1.00 | ×1.00 | ×1.00 | Teaching floor. Kill-clock 170s. |
| L2 Launch | ×1.15 | ×1.20 | ×1.12 | Faster density. Late gates drift. |
| L3 Orbit | ×1.35 | ×1.35 | ×1.08 | More live foes. Spines armored near beetles. |

---

## Enemy jobs (not reskins)

Each kind has a readable job. Telegraph (flash + beep) before the commit.

| Kind | Job |
|------|-----|
| Null Drone | Patrol, then **dive** at Ash |
| Sentry Crab | Telegraph, then **pounce** onto your depth |
| Turret Nest | **Lob** arcing mortars (jump or walk out of the splash) |
| Hackbot | Steal your gun, **flee** — kill it to get the gun back |
| Riot Walker | Far = mortar, close = gun; **clamps the truck** until dead; weak rear |
| Climb Drone | Matches hop, then **rams** |
| SAM Wasp | **Lock-on chase**, ram more than spray |
| Sky Mine | Contact boom; **chain-reacts** nearby mines |
| Tether Mine | Cyan rope **pulls** you off the line |
| Grid Sat | **Formation volley** if siblings are close; kamikaze in Prime panic |
| Ghost Uplink | Cloak, **teleport aft**, fire, recloak |
| Repair Beetle | Paths to the nearest spine and heals **only that one** |
| Spine Node | **0.35× damage** while a beetle is within ~200 |

---

## Authored twists (one real turn per act)

**L1:** Crab pack from the right during the road lull · walker clamps the truck · Reaper P3 **slams a gantry deck** (jump the gap). Reaper P2 is a **laser sweep** across depth — hop or change lane.

**L2:** Gates 4–5 **drift in Z** · after the last gate, **stage-separation debris** (mines + tether) before Seraph spawns · circ rings drift. Seraph P3 **leaves the right edge and spears from aft**.

**L3:** After spine 1, **gravity shear** (floaty hang + EVA current) · spine 3 **beetle rush** · Prime P3: full damage only if you **EVA into the core** (close + high hop); arena shrinks; leftover sats kamikaze.

---

## Level 1 — Earth Escape

### Goal A — Escort to Pad 7 (`progress` = truck path 0→1)

| p | Intensity | Beat |
|---|-----------|------|
| 0.00 | 0.15 | Cold open — first drones, learn depth |
| 0.12 | 0.40 | First push — crabs on the road |
| 0.28 | 0.20 | Lull — tech window / wreckage read |
| 0.42 | 0.65 | Mid sprint — walker + packs |
| 0.58 | 0.25 | Lull — regroup on the truck |
| 0.72 | 0.80 | Pad approach assault |
| 0.90 | 0.55 | Last peel onto the flame trench |
| 1.00 | 0.10 | Pad secure breath → Goal B |

### Goal B — Gantry / Reaper / board (`progress` = climb → board)

| p | Intensity | Beat |
|---|-----------|------|
| 0.00 | 0.20 | Climb start — quiet decks |
| 0.25 | 0.55 | Tower contact — light adds |
| 0.45 | 0.85 | Reaper engages (boss) |
| 0.70 | 1.00 | Reaper late phases |
| 0.88 | 0.15 | Path clear — board Finch |
| 1.00 | 0.05 | Boarded |

---

## Level 2 — Launch!

### Goal A — Trajectory gates (`progress` = gates + scroll)

Precision needs **air between clusters**. Pressure lives *between* gates, not on top of them.

| p | Intensity | Beat |
|---|-----------|------|
| 0.00 | 0.20 | Liftoff calm |
| 0.18 | 0.50 | First interceptors |
| 0.32 | 0.15 | Lull — line up gate |
| 0.48 | 0.70 | Cloud-deck sprint |
| 0.62 | 0.20 | Lull — mid gates |
| 0.78 | 0.75 | Pre-Seraph gauntlet |
| 0.92 | 0.30 | Corridor clean breath |
| 1.00 | 0.40 | Seraph inbound sting |

### Goal B — Seraph → circ rings

| p | Intensity | Beat |
|---|-----------|------|
| 0.00–0.65 | 0.55→1.0 | Boss duel by HP |
| 0.70 | 0.25 | Post-kill breath |
| 0.75–1.00 | 0.35→0.55 | Circ rings — tense, sparse |

---

## Level 3 — Orbit

### Goal A — Sever spines (`progress` = spines + approach)

| p | Intensity | Beat |
|---|-----------|------|
| 0.00 | 0.20 | EVA cold open |
| 0.20 | 0.55 | Pack before spine 1 |
| 0.33 | 0.15 | Post-spine 1 lull |
| 0.50 | 0.70 | Beetle priority sprint |
| 0.66 | 0.20 | Post-spine 2 lull |
| 0.85 | 0.80 | Final spine assault |
| 1.00 | 0.15 | Spines down — cavity beckons |

### Goal B — Prime cavity

| p | Intensity | Beat |
|---|-----------|------|
| 0.00 | 0.20 | Approach dread (sparse) |
| 0.25 | 0.70 | Enter cavity / Prime |
| 0.55 | 0.90 | Mid phases |
| 0.85 | 1.00 | Core panic |
| 1.00 | 0.00 | Rupture |

---

## Files

- `game/src/pacing.ts` — curves, sampling, director helpers
- `game/src/game.ts` — progress probes, density spawns, aggression
- This note — design source of truth
