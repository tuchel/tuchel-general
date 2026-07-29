# 2.5D authored animation pack

Hand-authored **three-quarter** sprites + multi-frame clips so depth lanes read like Metal Slug — not flat side profiles stuck in Z-space.

## Mandate

1. **3/4 view toward camera-right** (body twist sells the ground deck)
2. **Chunky 4–8 frame loops** — walk / hover / thrust / shoot / jump / boss phases
3. **Shadows + Z-sort** already in engine; art must read at near *and* far scale
4. Magenta-keyed frames in `public/art/anim/`; near props in `public/art/props/`

## Runtime

| Module | Role |
|--------|------|
| `src/anim.ts` | Clip libraries + player state |
| `src/assets.ts` | Loads every clip frame via `art.frame(id)` |
| `src/game.ts` | Drives idle/walk/jump/shoot/thrust/hover/phase clips |

## Clip coverage

- **Ash:** idle · walk×4 · shoot×3 · jump×2  
- **Ash EVA:** idle · thrust×3 · shoot×2  
- **Ship:** idle · thrust×3 · shoot×2  
- **Truck:** idle · move×3  
- **Enemies:** drone, crab, walker, wasp, spine, gridsat, beetle, turret, hackbot, mirror, ghost  
- **Bosses:** Reaper (idle/claw/laser) · Seraph (idle/dive) · Prime (idle/petal/core)  
- **Props:** near crate + gantry for L1 foreground depth  

Pipeline: `scripts/process-anim.py`
