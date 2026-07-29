# Engine — Metal Slug 2.5D

True side-scrollers feel flat. STAR MIND uses a **2.5D depth plane** in the Metal Slug spirit: illustrated perspective, lane combat, scale-by-depth, Z-sorted draw.

## World axes

| Axis | Meaning | Control |
|------|---------|---------|
| **X** | Along the stage | A / D |
| **Z** | Depth into the screen (`0` near camera → `1` far) | W / S |
| **hop** | Jump / altitude above the ground deck | Space |

## Projection

`engine25d.ts` maps `(x, z, hop)` → screen `(sx, sy, scale)`:

- Ground deck is a **trapezoid** (near lip → far horizon seam)
- Farther Z → higher on the deck, **smaller scale**, slight vanish pull
- Elliptical **shadows** sit on the ground seam for lane readability
- Draw order: **far → near** (`sortByDepth`)
- Camera lean on Z input for kinetic punch
- Foreground silhouettes over-draw for cabinet depth

## Combat

Hits require **Z overlap** (lane slack ~0.2–0.28) plus X/hop proximity. Strafing past an enemy on another depth lane does not connect — classic beat-em-up / Metal Slug open-field feel.

## Per level

- **L1:** Escort truck on matching depth · gantry platforms have Z+hop · Pad Reaper
- **L2:** Trajectory gates and circ rings sit on depth lanes · Seraph mirrors your Z
- **L3:** Free-fly X/Z + hop thrust · spines placed across depth space

## Files

- `src/engine25d.ts` — projection, ground deck, fog, shadows, sort
- `src/game.ts` — actors carry `z` + `hop`; bullets/particles projected
- `src/input.ts` — `axisZ()` separate from jump
