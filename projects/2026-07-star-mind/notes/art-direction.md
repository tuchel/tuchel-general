# Art direction — Metal Slug × Space Punk

## Pillars

1. **Silhouette first** — every actor readable as a black cutout  
2. **Chunky animation** — 4–8 frame loops; exaggerated squash on landings / recoil  
3. **Pad realism, cartoon proportions** — real gantries / fairings / solar panels, Metal Slug scale  
4. **One horizon grammar per level** — never reuse sky logic across acts  

## Palette

| Token | Hex | Use |
|-------|-----|-----|
| `void` | `#0B1220` | Space / night BG |
| `navy` | `#152238` | Mid BG, panels |
| `rust` | `#8B4513` | Metal, trenches |
| `pad-orange` | `#E85D04` | Flames, suits, danger |
| `bone` | `#F4EDE4` | Highlights, suits |
| `signal-cyan` | `#2EC4B6` | AI, beams, UI uplink |
| `warn` | `#F4D35E` | Hazards, ammo |
| `blood` | `#C1121F` | Damage flashes |
| `earth-glow` | `#3A86FF` | Earth limb (L3) |

Avoid: purple-indigo AI cliché glow-fest, cream+terracotta editorial look, flat white UI cards.

## Level horizons

- **L1:** Storm navy + sodium orange bloom + rain streaks + lightning  
- **L2:** Vertical gradient navy→black, cloud decks, plume bloom, sun rim  
- **L3:** Earth crescent, gold solar blades, hard vacuum shadows, cyan glyphs  

## Character sheets (2.5D authored)

- **Viewpoint:** three-quarter toward camera-right — never pure orthographic side
- Ash: bone suit, pad-orange accents, dark webbing, scar; clips idle/walk/shoot/jump (+ EVA thrust)
- Enemies/bosses: multi-frame hover/walk/attack/phase clips in `public/art/anim/`
- Near-camera props reinforce the ground deck (crates, gantry lips)
- L1 diaspora midground: Starship/Dragon/booster wreckage + frantic cybertruck traffic; Pad 7 is a full painted launch spectacle, not a HUD glyph

See [`art-25d-anim.md`](art-25d-anim.md). 

## Motion language

- Muzzle flash: 1–2 frames, warn yellow  
- Death: pop into scrap squares + cyan sparks (AI) or smoke (mech)  
- Thrusters: asymmetric smear, pad-orange core → warn tip  
- Screen feel: slight camera shake on explosions; never motion-blur mush  

## UI

Stencil numerals, thin cyan hairlines, no glassmorphism. Boss bar is a physical “signal integrity” meter, not a candy health pill.
