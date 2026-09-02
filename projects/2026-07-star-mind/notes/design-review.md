# STAR MIND — design interrogation (2026-09)

A veteran's pass over the whole game, high to low. Verdicts first, then the fixes shipped in the same change, then what is parked. Line refs point at `game/src/game.ts` unless noted.

---

## 0. One-paragraph verdict

The skeleton is strong: three acts with distinct verbs (run-and-gun, auto-scroll flight, EVA), a real intensity director, a dual-goal spine per level, painted plates, procedural audio, and a dual keyboard/touch build from one URL. What it lacks is the **arcade contract**: the loop that makes a Metal Slug run *mean* something. Deaths cost nothing, continues are free, the level-clear screen is a toast, bosses die in six seconds, and enemies vanish on death. The game plays like a tech demo of a good design, not like a cabinet you feed quarters into. Every fix below is in service of that contract.

---

## 1. Intent & identity

| Claim in `DESIGN.md` | What the build actually does | Verdict |
|---|---|---|
| "Metal Slug DNA" | 300 HP sponge + 0.85 s i-frames + free retries | Wrong fantasy. Slug is fragile Ash, generous i-frames, *lives* and a shared score, instant respawn. HP bars belong to bosses. |
| "Kill-clock still ticks" (L1) | 170 s hard fail through escort **and** gantry **and** Reaper | A timer that kills you is anxiety without agency. Timers should reward speed, not punish learning. |
| "Escort the fuel truck" | Truck death = `hurtPlayer(999)` (instant player death) | Mission fail dressed as a death. Fail states need their own read. |
| "S/A/B/C/D ranks with sarcastic CAPCOM lines" | Not implemented. Clear overlay shows score + scrap | The single biggest missing piece. Rank is the *reason to replay*. |
| Scrap shop between levels | Works, but scrap persists through death → farm on retry | Exploit and wrong incentive. Continue must cost. |

## 2. Level & mission design

- **L1 Earth Escape** is the best level: escort → climb → board is legible, walk-right is the answer to every question, Pad 7 is a real landmark. Problems: the kill-clock (see above), the one-line HUD that stuffs clock/techs/truck/hint into 80 characters (`renderHud` L1 branch), and techs reading as mandatory because they sit beside the clock.
- **L2 Launch!** fights the engine. `hop = 30 + (1 − z) × 50` (ship branch of `updatePlay`) makes depth *be* height, so the vertical-shooter fantasy is faked with the same lane input. Gates are the right idea; recycling a missed gate to a **random** Z (`recycleMissedGates`) punishes the player twice. Seraph "spear from aft" is the one great moment.
- **L3 Orbit** has the most texture (spines, beetles, mirrors, shear, arena shrink) and the least teaching. Prime's phase-3 damage multiplier (×2.15 close-and-high vs ×0.42) is the game's best boss idea and it is communicated with one HUD string.
- **Checkpoints do not exist.** Die at Reaper → replay the whole escort. Die at Prime → replay three spines. That is the single largest fun-killer in the build.

## 3. Combat

- **Weapons.** Nominal single-target DPS: pistol 44, coil 117, spread 169 (all pellets), beam 150 peak / ~53 sustained, rocket 78 + splash, flame ~780 point-blank, rail 23–35. Rail — the "boss shredder" — is the worst gun in the game. The `WEAPON_RANK` refusal (pickup branch of `updatePlay`) means a new gun on the floor is often *not yours to take*; pickups should always be a yes.
- **Enemies.** Dives (drone/crab/climber) telegraph well. Turret, wasp, walker, mine, hackbot, ghost commit with **no wind-up**: ghost teleports behind you and fires in 0.18 s; hackbot steals on contact. Those are the "unfair" moments players remember.
- **Bosses.** HP 520 / 600 / 900 against a 117-DPS default gun = ~6 s effective per boss. Patterns never get to teach. No intro card, no outro — one boom and a mode flip.
- **Feedback.** Hit-stop only on kills (0.03) and heavies (0.07). Regular hits are a 0.06 s flash. Kills delete the sprite the same frame. Enemy shots are **cyan** — the same hue as the AI props, the UI, and half the player FX.

## 4. Controls & feel

- X is eased (`rate 14/18`), Z is instant (`vz = az × 0.55`) — the depth axis twitches under stick noise and telegraphs lanes.
- No jump cut: every hop is the full 520 impulse.
- Variable timestep with a 33 ms clamp: fire rate and physics drift with frame time.
- No gamepad. A Metal Slug homage in 2026 with no pad support is a miss.
- Touch layer is thoughtfully done (portrait sheet, safe areas, reparenting). EMP/pause targets are under 44 px.

## 5. Art & presentation

- The painted plates are good and the opaque deck fix made the ground read as ground. Where it breaks: `ctx.filter = "brightness(0)"` ×4 per outlined sprite (`assets.ts blitSprite`) is the single most expensive call in the frame on a phone; `glow()` builds a `createRadialGradient` per call; HUD gradient is rebuilt every frame.
- Enemies pop out of existence. Art direction asks for "pop into scrap squares + cyan sparks"; the build does a burst and a filter.
- Announce plate is the same 460×44 center box for `+SCRAP`, `GATE 3/5`, and `SIGNAL LOST · ASH DOWN`. Center screen is for events that change what you are doing, not for pickups.
- `ghost-hover-2.png` is 143 bytes (broken export).

## 6. Audio

Solid SFX coverage; the music is an A-minor pentatonic pulse with no lead line and no ducking. Explosions and music sit at the same level. Bosses have no theme change.

## 7. Code

`game.ts` is a 4 142-line class. It works, and it is the right shape for a solo arcade prototype, but: `continues` was dead state; `UPGRADE_BLURB.armor` says +20 while `resetPlayer` grants +24; the victory screen's "BEST" branch could never fire; `beginLevel` resets score but not scrap; `.filter()` rebuilds every entity list every tick; magic numbers (fireRate 0.08, mobility 0.08, W×0.36 camera lead) are duplicated.

---

## What ships in this change (priority order)

1. **Arcade contract.** Results screen with itemized tallies (kills, objective bonus, escort/rescue, par time, continues) and an S/A/B/C/D rank with a CAPCOM line. Continues cost: score and scrap revert to the last checkpoint. Kill-clock becomes a **par timer** (bonus, never death). Truck loss is a mission fail with its own card. Victory shows a real total and a true "NEW BEST".
2. **Checkpoints.** Reaching goal 2/2 saves a checkpoint; death restarts *there* (truck on Pad 7 / gates cleared / spines severed) with the checkpoint's scrap and score.
3. **Bosses.** HP ×2.5 with intro card (nameplate, letterbox, slow-mo hold) and a staged outro (chain booms, slow-mo, letterbox) before the mode flips. Rail does ×2.5 in every boss's phase 3 so the charge gun earns its "shredder" name.
4. **Enemy fairness + deaths.** Wind-up telegraph before turret/walker/wasp fire, ghost and hackbot commit delays, hostile bullets in blood/warn only. Killed enemies leave a tumbling, fading husk plus debris instead of vanishing.
5. **Feel.** Fixed 120 Hz simulation step, eased depth axis, jump cut on early release, hit-stop on every landed shot, gamepad support (sticks, d-pad, face buttons, start).
6. **Presentation & performance.** Cached silhouette outlines (no `ctx.filter`), cached glow sprites, cached HUD gradient, pickup icons by kind, center plate reserved for state changes with a bottom ticker for NIX chatter, weapon pickups always swap.
7. **Audio.** SFX-triggered music ducking and a per-level lead line so the bed reads as music, with a boss variant.

## Parked (bigger than one change)

- L2 as a true vertical shooter (separate projection, not depth-as-height).
- Lives + shared HP à la Slug instead of a 300 HP pool — the current HP model is now *fair* with checkpoints; converting it is a tuning project.
- Seraph belly collider and Reaper claw-core mesh as separate hitboxes.
- Weapon stash / dual-slot.
- Enemy anim clips — the authored packs are variation packs, not frames; real loops need re-authoring.
- Attract mode, difficulty select (wire `actTier`), per-level best table.
