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

### Backgrounds (JPEG parallax plates)
- `bg/l1-sky.jpg`, `bg/l1-mid.jpg`
- `bg/l2-ascent.jpg`
- `bg/l3-void.jpg`
- `ui/title-hero.jpg`

### Sprites (PNG, magenta-keyed)
Ash · Ash EVA · Ship · Truck · Drone · Crab · Turret · Hackbot · Walker · Wasp · GridSat · Spine · Beetle · Mirror · Ghost · Gate · Pickup · Boss Reaper / Seraph / Prime

### Pipeline
`game/scripts/process-art.py` — chroma key + crop + resize from `/opt/cursor/artifacts/assets`.

## Style target

Vintage Metal Slug cabinet energy (chunky silhouettes, thick outline, exaggerated machines) with modern painted depth — beautiful, stylish, delightful — not CRT mush, not purple neo-AI cliché.
