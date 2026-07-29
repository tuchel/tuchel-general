# Art inventory & approval checkpoint

## Storyboards (approve these for level look)

Full-res refs in `notes/art-refs/`:

| File | Level |
|------|--------|
| `sb-l1-earth-escape.jpg` | Night pad · truck escort · Pad 7 |
| `sb-l2-launch.jpg` | Ascent · gates · Stratos Seraph |
| `sb-l3-orbit.jpg` | EVA · spines · Star Mind Prime |

**Ask:** If any storyboard’s mood/palette/silhouette language is off, say so before we regenerate the matching sprite family. Defaults shipped below match these boards.

## Runtime pack (`game/public/art/`)

### Backgrounds (JPEG parallax plates — calm + peak for intensity crossfade)
- `bg/l1-sky.jpg` / `l1-sky-calm.jpg` / `l1-sky-peak.jpg`
- `bg/l1-mid.jpg` / `l1-mid-calm.jpg` / `l1-mid-peak.jpg`
- `bg/l2-ascent.jpg` / `l2-ascent-calm.jpg` / `l2-ascent-peak.jpg`
- `bg/l3-void.jpg` / `l3-void-calm.jpg` / `l3-void-peak.jpg`
- `ui/title-hero.jpg`

Runtime blends calm→peak via smoothed combat intensity (`blitParallaxEvolve` + threat atmosphere).

### Sprites (PNG, magenta-keyed)
Ash · Ash EVA · Ship · Truck · Drone · Crab · Turret · Hackbot · Walker · Wasp · GridSat · Spine · Beetle · Mirror · Ghost · Gate · Pickup · Boss Reaper / Seraph / Prime

Ash ground clips (idle / walk / shoot / jump) share one white/orange spacesuit look — do not mix the older skeleton/headband set.

### L1 diaspora props
- `sprites/pad7.png` — massive Pad 7 launch spectacle (destination landmark)
- `props/gantry-spectacle.png` — climb tower
- `props/wreck-starship.png`, `wreck-dragon.png`, `wreck-booster.png` — pad wreckage
- `props/cybertruck.png` — rare midground pass (~one every 2.5 min)
- Near props: `prop-crate-near.png`, `prop-gantry-near.png`

### Pipeline
`game/scripts/process-art.py` — chroma key + crop + resize from `/opt/cursor/artifacts/assets`.

## Style target

Vintage Metal Slug cabinet energy (chunky silhouettes, thick outline, exaggerated machines) with modern painted depth — beautiful, stylish, delightful — not CRT mush, not purple neo-AI cliché.
