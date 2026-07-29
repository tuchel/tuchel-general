# STAR MIND — Design Bible

Working defaults are marked **[DEFAULT]**. Alternates live in `notes/brainstorm.md`.

---

## 1. Logline

**[DEFAULT]** A scarred astronaut ex-marine fights from a burning starbase to Low Earth Orbit to dismantle STAR MIND, a rogue AI satellite swarm rewriting Earth’s networks from the sky.

Tone: Metal Slug’s cartoon grit + SpaceX pad drama + cold orbital horror.

---

## 2. Title options

| Option | Feel |
|--------|------|
| **STAR MIND** **[DEFAULT]** | Clean, ominous, brandable |
| ASH ORBIT | Protagonist-led |
| PAD TO VOID | Journey-shaped |
| CONSTELLATION KILL | Punchy Metal Slug energy |
| ROGUE LEO | Technical / SpaceX-nerd |

Subtitle (HUD / title card): *OPERATION ORBITAL BREAK*

---

## 3. Characters

### 3.1 Player — Rex “Ash” Calder **[DEFAULT]**

- **Role:** Ex-marine EVA specialist turned commercial astronaut; last qualified pilot on Pad 7.
- **Look:** Scarred cheek, orange/white flight suit with marine webbing, battered helmet underarm until EVA, heavy boots, sidearm + rifle.
- **Personality:** Dry, mission-first, soft spot for ground crews. Swears in radio brevity codes.
- **Motivation:** STAR MIND fried his last crew on a rescue hop; he is finishing the job before it finishes the planet.

**Name alternates:** Mara “Torch” Voss (hotshot test pilot) · Jin Park (quiet systems ace) · “Brick” Malone (pure Metal Slug bruiser)

### 3.2 Mission Control — CAPCOM “Nix” Okada **[DEFAULT]**

Radio voice only for most of the game. Calm, sardonic. Gives objectives, ammo callouts, boss tells. Optional cameo as a ground NPC in Level 1 who unlocks the pad gate.

### 3.3 Antagonist — STAR MIND **[DEFAULT]**

Not a single face. A **distributed mind** across a constellation. Speaks in clipped synthetic chorus. Fragments of human voice (stolen mission recordings) leak through when cores crack.

**Origin options (pick one lore track):**

| Track | Pitch |
|-------|-------|
| **A — Defense runaway** **[DEFAULT]** | Orbital defense AI tasked with “deny hostile uplink.” It redefined *hostile* as *any uncontrolled human network.* |
| B — Corporate ghost | Abandoned mega-constellation firmware that self-healed into a hive after a bankrupt operator ghosted. |
| C — Uploaded martyr | A dying astronaut’s neural imprint was illegally mirrored into sats; grief + code = crusade. |

### 3.4 Supporting / optional cast

- **Pad Chief Rourke** — Level 1 NPC; dies or is extracted depending on optional rescue.
- **Dr. Lira Mendez** — STAR MIND’s original lead; transmissions in Level 3; may be ally or corrupted node (branch).
- **The Rook** — rival merc in a stolen hopper; optional mid-boss ally-enemy (comic Metal Slug beat).

---

## 4. World & factions

| Faction | Role |
|---------|------|
| **Starbase Atlas** | Coastal launch complex; half-military, half-commercial. Level 1 stage. |
| **Fleet / Starship Corps** | Ash’s former outfit; scattered after uplink blackout. |
| **STAR MIND** | Sat swarm + hijacked drones, pad robots, orbital platforms. |
| **Ground civilians** | To protect / escort beats in Level 1 (Metal Slug hostages). |

---

## 5. Weapons & gear

Metal Slug rule: **heavy, readable, absurdly fun munitions** with clear silhouettes.

### 5.1 Primary weapons (pickup / swap)

| ID | Name | Behavior |
|----|------|----------|
| `PISTOL` | Service Sidearm | Weak, infinite ammo fallback |
| `HEAVY` **[DEFAULT start L1]** | Coil Rifle | Mid ROF, solid punch |
| `SPREAD` | Shard Cannon | 3-way spray; great vs clusters |
| `LASER` | Beam Lance | Piercing continuous beam (heat limited) |
| `ROCKET` | Micro-Sparrow | Slow projectile, huge blast |
| `FLAME` | Torch Pack | Short-range cone; melts drone armor |
| `RAIL` | Mag-Spike | Charge shot; boss shredder |

### 5.2 Specials / vehicles

| ID | Name | Level |
|----|------|-------|
| `GRENADE` | Frag / EMP grenade | All (ammo limited) |
| `MECH` | Pad Loader Suit | Level 1 mid-section vehicle |
| `SHIP` | Starship *Black Finch* | Level 2 (player *is* the ship) |
| `EVA` | Jetpack + tether gun | Level 3 spacewalk |

### 5.3 Upgrade currency

**Scrap / Core Fragments** dropped by elites. Spend between levels (or at pad kiosks):

- Damage · Fire rate · Armor · Mag size · Special charge · Move / jump (L1) · Thrust (L2) · EVA fuel (L3)

---

## 6. Levels (detailed)

### Level 1 — EARTH ESCAPE

**Goal:** Reach Launch Pad 7 and board *Black Finch* before STAR MIND’s kill-clock hits zero.

**Dynamic:** Classic Metal-Slug run-and-gun. Horizontal scroll with short vertical sections (gantries, fuel trenches). Hostage/technician rescues optional for scrap bonus. Mid-vehicle: hijack a **Pad Loader Mech**.

**Art beat:** Night storm, sodium pad lights, orange flame, rusted scaffolding, SpaceX-ish towers + cartoon exaggeration. Rain + lightning flashes.

**Adversaries:**

| Enemy | Behavior |
|-------|----------|
| **Null Drone** | Hover, strafe fire |
| **Sentry Crab** | Ground crawler, leap attack |
| **Turret Nest** | Fixed; arcs |
| **Hackbot** | Tries to steal your weapon pickup |
| **Riot Walker** | Mini-tank; weak rear |

**Boss — PAD REAPER (Gantry Colossus)**  
A crane/gantry possessed by STAR MIND: swinging claw, weld-laser eye, missile pods. Phases: (1) claw slam, (2) laser sweep + drones, (3) exposed core when claw embeds in ground.

**Win:** Board rocket → cutscene → Level 2.

---

### Level 2 — LAUNCH!

**Goal:** Survive ascent; keep *Black Finch* structurally alive to LEO insertion.

**Dynamic:** Vertical / diagonal auto-scroll shooter. Player flies the starship. Manage heat, stage separation hazard, and debris. Occasional “correct trajectory” gates (fly through rings) for fuel/armor.

**Art beat:** Atmosphere gradient (navy → indigo → black), engine plume bloom, cloud sheets, debris fields, interceptor drones climbing with you.

**Adversaries:**

| Enemy | Behavior |
|-------|----------|
| **Climb Drone** | Matches ascent, rams |
| **SAM Wasp** | Homing from cloud deck |
| **Debris Chunk** | Physics hazard |
| **Booster Remnant** | Friendly hazard after stage sep |
| **Sky Mine** | Static; chain-react if clustered |

**Boss — STRATOS SERAPH**  
A winged interceptor platform that mirrors your altitude. Phases: (1) wing guns, (2) mirror drones, (3) folds wings into spear dive — shoot exposed belly reactor.

**Win:** Circularize into LEO → EVA hatch opens → Level 3.

---

### Level 3 — ORBIT / STAR MIND

**Goal:** Cut the constellation’s command spine; destroy the **Prime Node**.

**Dynamic:** Side-scrolling space combat with light platforming on wreckage + free-flight EVA segments. Low gravity arcs. Tether to surfaces. Satellites form formations that must be broken in order (weakest first) or they regenerate shields.

**Art beat:** Earth limb glow, solar panels as gold blades, hard shadows, star field parallax, holographic warning glyphs, cold cyan + hot orange thrusters.

**Adversaries:**

| Enemy | Behavior |
|-------|----------|
| **Grid Sat** | Formation shooter |
| **Mirror Shard** | Reflects your shots until stunned |
| **Tether Mine** | Pulls you off course |
| **Repair Beetle** | Heals other sats — priority kill |
| **Ghost Uplink** | Invisible until it fires |

**Final Boss — STAR MIND PRIME**  
A cathedral-sized node: rotating rings, solar-petal shields, voice chorus. Phases:

1. Outer ring turrets  
2. Petal shield — destroy emitters in sequence  
3. Core exposed — Ash must EVA into the cavity and unload while dodging mind-lash beams  
4. Panic cascade — arena shrinks; leftover sats kamikaze  

**Win:** Core rupture → constellation goes dark → deorbit burn home. Stinger: one sat blinks back online (sequel hook).

---

## 7. Goals & scoring (Metal Slug DNA)

Per level:

- **Primary:** Reach end / kill boss  
- **POWs / techs rescued** (L1)  
- **Trajectory gates** cleared (L2)  
- **Formation perfect clears** (L3)  
- **Time** under par  
- **No continue** bonus  

Ranks: `S / A / B / C / D` with sarcastic CAPCOM lines.

---

## 8. Art direction (summary)

Full notes: `notes/art-direction.md`.

- **Silhouette-first** chunky sprites, thick outlines, readable at 2×–3× scale  
- **Palette:** pad orange, bone white, rust, void navy, signal cyan, warning yellow  
- **Animation:** exaggerated recoil, dust, shell casings, thruster smear frames  
- **Backgrounds:** multi-layer parallax; every level has a unique sky / horizon grammar  
- **UI:** stencil military + glowing uplink glyphs (not generic sci-fi glass)

---

## 9. Audio direction (targets)

- Chiptune-adjacent brass + industrial percussion (Metal Slug echo)  
- Radio static, pad klaxons, vacuum-thinned explosions in L3  
- STAR MIND voice: layered vocoder + stolen human syllables  

Prototype ships without full audio assets; hooks reserved in code.

---

## 10. Prototype scope (this repo slice)

Playable browser vertical slice:

1. Title → Level select / campaign flow  
2. All 3 levels with unique dynamics, enemy sets, and bosses  
3. Weapon pickups + scrap upgrades between levels  
4. Canvas pixel-art style procedural sprites (hand-tuned draw routines) until bitmaps land  
5. HUD: HP, weapon, special, objective, boss bar  

Not in slice: full soundtrack, branching endings, online leaderboards.
