# Star Mind — Metal Slug–style side shooter

**Status:** design bible + playable vertical slice (3 levels)  
**Working title (default):** *STAR MIND*  
**Genre:** run-and-gun / side-scrolling shooter (Metal Slug DNA)  
**Tone:** vintage Metal Slug cartoon violence + modern Space / AI / SpaceX space-punk

## Premise (default pick)

Ex-marine astronaut **Rex “Ash” Calder** races from a compromised starbase to orbit to cut down **STAR MIND** — a rogue constellation of AI satellites trying to seize Earth’s networks from LEO.

Three acts map 1:1 to levels:

1. **Earth Escape** — reach the launch pad on foot / under fire  
2. **Launch!** — pilot the starship through ascent to LEO  
3. **Orbit** — spacewalk / dogfight the sat network → final boss

## Quick start (prototype)

```bash
cd projects/2026-07-star-mind/game
npm install
npm run dev
```

Dev URL includes the Pages base path:  
`http://localhost:5173/tuchel-general/star-mind/`

### Live site

After merge to `main`, GitHub Actions deploys to:

**https://tuchel.github.io/tuchel-general/star-mind/**

Hub: https://tuchel.github.io/tuchel-general/  
Manual redeploy: Actions → “Deploy GitHub Pages” → Run workflow.

Controls: **A/D or ←/→** move · **W/↑ or Space** jump · **J / Z** shoot · **K / X** special · **Enter** confirm / start

## Docs

| Doc | Purpose |
|-----|---------|
| [DESIGN.md](DESIGN.md) | Full design bible: plot, cast, enemies, weapons, bosses, art |
| [notes/brainstorm.md](notes/brainstorm.md) | Option ranges per pillar (pick / remix) |
| [notes/dual-goals.md](notes/dual-goals.md) | Per-level Goal A → Goal B board (locked + alternates) |
| [notes/art-direction.md](notes/art-direction.md) | Palette, silhouette rules, Metal Slug → space-punk |
| [notes/art-inventory.md](notes/art-inventory.md) | Storyboard approval checkpoint + runtime art pack |

## Prior-work surfacing

No prior game pages in `wiki/`. Closest monorepo neighbors are data-viz (Metro Budget), not gameplay. Greenfield.

## Open questions (for human remix)

See **Recommended defaults** vs **Alternates** in `notes/brainstorm.md`. Defaults are locked into the prototype so it is playable; swap freely.
