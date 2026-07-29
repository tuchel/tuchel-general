import { C, H, W } from "./palette";
import { Input } from "./input";
import {
  WEAPONS,
  defaultUpgrades,
  type LevelId,
  type Mode,
  type Upgrades,
  type WeaponId,
} from "./types";
import {
  art,
  blitCover,
  blitParallax,
  blitSprite,
  bossAnimLib,
  enemyAnimLib,
  enemySpriteId,
} from "./assets";
import {
  CLIPS,
  animFrameIndex,
  createAnimState,
  playAnim,
  tickAnim,
  type AnimPlayerState,
} from "./anim";
import {
  STAGE_GROUND,
  STAGE_SKY,
  STAGE_VOID,
  type Stage25D,
  clamp01,
  drawDepthFog,
  drawForegroundProps,
  drawGroundDeck,
  drawShadow,
  project,
  sortByDepth,
  zOverlap,
} from "./engine25d";
import {
  SCRIPT_BEATS,
  rollDensityKind,
  sampleIntensity,
  type IntensitySample,
} from "./pacing";
import {
  drawAsh,
  drawBoss,
  drawCircRing,
  drawEnemy,
  drawGantryDeck,
  drawPad7,
  drawPickup,
  drawShip,
  drawSpine,
  drawTruck,
  glow,
  rr,
} from "./draw";

/** L1 truck fuel-drop destination (world X) */
const PAD7_X = 2480;
/** First gantry stair after Pad 7 */
const GANTRY_START_X = 2560;
/** Black Finch boarding deck */
const BOARD_X = 3180;
const BOARD_HOP = 168;
/** L3 Prime cavity entry (walk-right after spines) */
const PRIME_ARENA_X = 2100;

function laneLabel(z: number): string {
  if (z < 0.34) return "NEAR";
  if (z < 0.66) return "MID";
  return "FAR";
}

interface Actor {
  x: number;
  z: number;
  hop: number;
  vx: number;
  vz: number;
  vHop: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  dead: boolean;
  facing: 1 | -1;
  kind: string;
  timer: number;
  phase: number;
  flash: number;
  scrap?: number;
  grounded?: boolean;
  anim: AnimPlayerState;
  animLib: string;
  shooting?: boolean;
}

interface Bullet {
  x: number;
  z: number;
  hop: number;
  vx: number;
  vz: number;
  vHop: number;
  r: number;
  dmg: number;
  life: number;
  friendly: boolean;
  pierce?: boolean;
  blast?: number;
  color: string;
}

interface Particle {
  x: number;
  z: number;
  hop: number;
  vx: number;
  vz: number;
  vHop: number;
  life: number;
  color: string;
  size: number;
}

interface Pickup {
  x: number;
  z: number;
  hop: number;
  kind: "scrap" | WeaponId;
  life: number;
}

interface Platform {
  x: number;
  z: number;
  w: number;
  hop: number;
}

interface LevelRuntime {
  id: LevelId;
  name: string;
  objective: string;
  goalA: string;
  goalB: string;
  goalPhase: 1 | 2;
  scroll: number;
  length: number;
  platforms: Platform[];
  spawnIndex: number;
  elapsed: number;
  bossSpawned: boolean;
  bossDefeated: boolean;
  killClock: number;
  gatesCleared: number;
  spinesDown: number;
  spinesNeeded: number;
  circCleared: number;
  circNeeded: number;
}

interface FuelTruck {
  x: number;
  z: number;
  hop: number;
  hp: number;
  maxHp: number;
  arrived: boolean;
  moving: boolean;
}

const BOSS: Record<LevelId, { id: string; name: string; hp: number }> = {
  1: { id: "reaper", name: "PAD REAPER", hp: 520 },
  2: { id: "seraph", name: "STRATOS SERAPH", hp: 600 },
  3: { id: "prime", name: "STAR MIND PRIME", hp: 900 },
};

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export class Game {
  private ctx: CanvasRenderingContext2D;
  private input = new Input();
  private mode: Mode = "title";
  private levelId: LevelId = 1;
  private level!: LevelRuntime;
  private stage: Stage25D = { ...STAGE_GROUND };
  private player!: Actor;
  private weapon: WeaponId = "coil";
  private ammo = 999;
  private cooldown = 0;
  private special = 3;
  private specialMax = 3;
  private invuln = 0;
  private scrap = 0;
  private upgrades: Upgrades = defaultUpgrades();
  private enemies: Actor[] = [];
  private boss: Actor | null = null;
  private bullets: Bullet[] = [];
  private particles: Particle[] = [];
  private pickups: Pickup[] = [];
  private frame = 0;
  private msg = "";
  private msgTimer = 0;
  private shake = 0;
  private menuIndex = 0;
  private upgradeIndex = 0;
  private camX = 0;
  private shipThrust = 0;
  private heat = 0;
  private gates: { x: number; z: number; hit: boolean }[] = [];
  private circRings: { x: number; z: number; hit: boolean }[] = [];
  private techs: { x: number; z: number; rescued: boolean }[] = [];
  private truck: FuelTruck | null = null;
  private towerReady = false;
  private boardReady = false;
  private primeArenaReady = false;
  private scriptBeatIndex = 0;
  private densityTimer = 0;
  private intensity: IntensitySample = sampleIntensity(1, 1, 0);
  private lastBeat = "";
  private rescued = 0;
  private score = 0;
  private totalScore = 0;
  private last = 0;
  private running = false;
  private stinger = false;
  private camLean = 0;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = true;
  }

  start() {
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.033, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.render();
      this.input.tick();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private announce(text: string, time = 2.2) {
    this.msg = text;
    this.msgTimer = time;
  }

  private syncStage() {
    this.stage.camX = this.camX;
  }

  private animImage(actor: Actor): HTMLImageElement | null {
    const lib = CLIPS[actor.animLib];
    const clip = lib?.[actor.anim.clip];
    if (clip) {
      const idx = animFrameIndex(actor.anim, clip);
      const id = clip.frames[idx];
      if (id) {
        const framed = art.frame(id);
        if (framed) return framed;
      }
    }
    if (actor.animLib === "ash") return art.sprite("ash");
    if (actor.animLib === "ash-eva") return art.sprite("ash-eva");
    if (actor.animLib === "ship") return art.sprite("ship");
    if (actor.animLib.startsWith("boss-")) return art.sprite(actor.animLib);
    return art.sprite(enemySpriteId(actor.kind));
  }

  private drivePlayerAnim(dt: number) {
    tickAnim(this.player.anim, dt);
    const p = this.player;
    if (p.shooting) {
      playAnim(p.anim, "shoot", 0.18);
      if (p.anim.lockedUntil <= 0 && p.anim.clip === "shoot") p.shooting = false;
    } else if (p.kind === "ground") {
      if (!p.grounded) playAnim(p.anim, "jump");
      else if (Math.abs(p.vx) > 20 || Math.abs(p.vz) > 0.05) playAnim(p.anim, "walk");
      else playAnim(p.anim, "idle");
    } else if (p.kind === "ship") {
      if (this.shipThrust > 0.5) playAnim(p.anim, "thrust");
      else playAnim(p.anim, "idle");
    } else {
      if (Math.abs(p.vx) + Math.abs(p.vz) + Math.abs(p.vHop) > 40) playAnim(p.anim, "thrust");
      else playAnim(p.anim, "idle");
    }
  }

  private driveEnemyAnim(e: Actor, dt: number) {
    tickAnim(e.anim, dt);
    const flying = ["drone", "climber", "wasp", "ghost", "gridsat"].includes(e.kind);
    if (e.kind === "spine" || e.kind === "mirror") playAnim(e.anim, "idle");
    else if (e.kind === "turret") playAnim(e.anim, e.timer < 0.25 ? "attack" : "idle");
    else if (flying) playAnim(e.anim, "hover");
    else if (e.kind === "crab" && e.hop > 8) playAnim(e.anim, "attack");
    else playAnim(e.anim, "walk");
  }

  private driveBossAnim(dt: number) {
    const b = this.boss;
    if (!b || b.dead) return;
    tickAnim(b.anim, dt);
    if (b.kind === "reaper") {
      if (b.phase >= 3) playAnim(b.anim, "attack", 0.4);
      else if (b.phase === 2) playAnim(b.anim, "phase2");
      else playAnim(b.anim, "idle");
    } else if (b.kind === "seraph") {
      if (b.phase >= 3) playAnim(b.anim, "attack", 0.5);
      else playAnim(b.anim, "idle");
    } else {
      if (b.phase >= 3) playAnim(b.anim, "phase3");
      else if (b.phase === 2) playAnim(b.anim, "phase2");
      else playAnim(b.anim, "idle");
    }
  }

  private resetPlayer(mode: "ground" | "ship" | "eva") {
    const hp = 100 + this.upgrades.armor * 20;
    const animLib = mode === "ship" ? "ship" : mode === "eva" ? "ash-eva" : "ash";
    this.player = {
      x: mode === "ship" ? 220 : 140,
      z: 0.45,
      hop: mode === "ship" ? 40 : 0,
      vx: 0,
      vz: 0,
      vHop: 0,
      w: mode === "ship" ? 48 : 24,
      h: mode === "ship" ? 28 : 36,
      hp,
      maxHp: hp,
      dead: false,
      facing: 1,
      kind: mode,
      timer: 0,
      phase: 0,
      flash: 0,
      grounded: mode === "ground",
      anim: createAnimState("idle"),
      animLib,
      shooting: false,
    };
    this.weapon = "coil";
    this.ammo = 80 + this.upgrades.mag * 25;
    this.cooldown = 0;
    this.specialMax = 3 + this.upgrades.special;
    this.special = this.specialMax;
    this.invuln = 1;
    this.heat = 0;
  }

  private beginLevel(id: LevelId) {
    this.levelId = id;
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.pickups = [];
    this.boss = null;
    this.camX = 0;
    this.score = 0;
    this.rescued = 0;
    this.stinger = false;
    this.gates = [];
    this.circRings = [];
    this.techs = [];
    this.truck = null;
    this.towerReady = false;
    this.boardReady = false;
    this.primeArenaReady = false;
    this.scriptBeatIndex = 0;
    this.densityTimer = 0.8;
    this.lastBeat = "";
    this.intensity = sampleIntensity(id, 1, 0);
    this.camLean = 0;

    if (id === 1) {
      this.stage = { ...STAGE_GROUND };
      const goalA = "Escort fuel truck to Pad 7";
      const goalB = "Climb gantry · board BLACK FINCH";
      this.level = {
        id,
        name: "EARTH ESCAPE",
        objective: `1/2 · ${goalA}`,
        goalA,
        goalB,
        goalPhase: 1,
        scroll: 0,
        length: 3600,
        platforms: [
          // Early pad props — optional hop crumbs, same Z as road so walk-right stays primary
          { x: 620, z: 0.5, w: 120, hop: 36 },
          { x: 1200, z: 0.5, w: 130, hop: 40 },
          { x: 1850, z: 0.5, w: 130, hop: 36 },
        ],
        spawnIndex: 0,
        elapsed: 0,
        bossSpawned: false,
        bossDefeated: false,
        killClock: 200,
        gatesCleared: 0,
        spinesDown: 0,
        spinesNeeded: 0,
        circCleared: 0,
        circNeeded: 0,
      };
      this.truck = {
        x: 200,
        z: 0.5,
        hop: 0,
        hp: 120,
        maxHp: 120,
        arrived: false,
        moving: false,
      };
      this.techs = [
        { x: 450, z: 0.35, rescued: false },
        { x: 980, z: 0.7, rescued: false },
        { x: 1580, z: 0.4, rescued: false },
      ];
      this.resetPlayer("ground");
    } else if (id === 2) {
      this.stage = { ...STAGE_SKY };
      const goalA = "Thread every trajectory gate";
      const goalB = "Down SERAPH · hold circularization";
      this.level = {
        id,
        name: "LAUNCH!",
        objective: `1/2 · ${goalA}`,
        goalA,
        goalB,
        goalPhase: 1,
        scroll: 0,
        length: 2600,
        platforms: [],
        spawnIndex: 0,
        elapsed: 0,
        bossSpawned: false,
        bossDefeated: false,
        killClock: 0,
        gatesCleared: 0,
        spinesDown: 0,
        spinesNeeded: 0,
        circCleared: 0,
        circNeeded: 3,
      };
      this.gates = [
        { x: 350, z: 0.3, hit: false },
        { x: 650, z: 0.7, hit: false },
        { x: 1000, z: 0.25, hit: false },
        { x: 1350, z: 0.6, hit: false },
        { x: 1700, z: 0.4, hit: false },
      ];
      this.resetPlayer("ship");
    } else {
      this.stage = { ...STAGE_VOID };
      const goalA = "Sever the three regional spines";
      const goalB = "Breach PRIME · rupture the core";
      this.level = {
        id,
        name: "ORBIT",
        objective: `1/2 · ${goalA}`,
        goalA,
        goalB,
        goalPhase: 1,
        scroll: 0,
        length: 3000,
        platforms: [
          { x: 500, z: 0.5, w: 160, hop: 0 },
          { x: 1100, z: 0.5, w: 160, hop: 0 },
          { x: 1700, z: 0.5, w: 160, hop: 0 },
        ],
        spawnIndex: 0,
        elapsed: 0,
        bossSpawned: false,
        bossDefeated: false,
        killClock: 0,
        gatesCleared: 0,
        spinesDown: 0,
        spinesNeeded: 3,
        circCleared: 0,
        circNeeded: 0,
      };
      this.resetPlayer("eva");
      this.spawnEnemy("spine", 720, 0.3, 20, 90);
      this.spawnEnemy("spine", 1200, 0.55, 10, 90);
      this.spawnEnemy("spine", 1750, 0.45, 30, 90);
    }

    this.syncStage();
    this.mode = "briefing";
    this.announce(`${this.level.name}`);
  }

  private setGoalPhase2() {
    if (this.level.goalPhase === 2) return;
    this.level.goalPhase = 2;
    this.level.objective = `2/2 · ${this.level.goalB}`;
    this.scriptBeatIndex = 0;
    this.densityTimer = 1.2;
    this.announce(`GOAL 2/2 · ${this.level.goalB}`, 2.8);
    this.shake = 8;
  }

  private unlockTowerClimb() {
    if (this.towerReady) return;
    this.towerReady = true;
    this.setGoalPhase2();
    // Walk-right Metal Slug stairs: same depth lane, rising hop, wide decks
    this.level.platforms.push(
      { x: GANTRY_START_X, z: 0.5, w: 160, hop: 38 },
      { x: GANTRY_START_X + 130, z: 0.5, w: 160, hop: 72 },
      { x: GANTRY_START_X + 260, z: 0.5, w: 160, hop: 106 },
      { x: GANTRY_START_X + 400, z: 0.5, w: 170, hop: 140 },
      { x: BOARD_X, z: 0.5, w: 200, hop: BOARD_HOP },
    );
    this.announce("NIX: Truck's on Pad 7 — keep RIGHT, climb the gantry!", 3.2);
  }

  private unlockPrimeArena() {
    if (this.primeArenaReady) return;
    this.primeArenaReady = true;
    this.setGoalPhase2();
    this.level.length = Math.max(this.level.length, 3000);
    this.announce("NIX: Spines down — keep RIGHT into the Prime cavity!", 3.2);
  }

  /** Narrative 0–1 progress for the active goal (feeds intensity curves). */
  private goalProgress(): number {
    const phase = this.level.goalPhase;
    if (this.levelId === 1) {
      if (phase === 1) {
        const truck = this.truck;
        if (!truck) return 0;
        if (truck.arrived) return 1;
        return clamp((truck.x - 200) / (PAD7_X - 200), 0, 1);
      }
      if (this.boardReady) return 1;
      if (this.level.bossDefeated) return 0.9;
      if (this.boss && !this.boss.dead) {
        return 0.4 + 0.45 * (1 - this.boss.hp / this.boss.maxHp);
      }
      return clamp((this.player.x - GANTRY_START_X) / (BOARD_X - GANTRY_START_X), 0, 0.38);
    }
    if (this.levelId === 2) {
      if (phase === 1) {
        const n = Math.max(1, this.gates.length);
        const cleared = this.level.gatesCleared / n;
        const lastX = this.gates.reduce((m, g) => Math.max(m, g.x), 400);
        const scrollP = clamp(this.level.scroll / lastX, 0, 1);
        return clamp(0.55 * cleared + 0.45 * scrollP, 0, 1);
      }
      if (this.level.bossDefeated) {
        const need = Math.max(1, this.level.circNeeded);
        return clamp(0.7 + 0.3 * (this.level.circCleared / need), 0, 1);
      }
      if (this.boss && !this.boss.dead) {
        return 0.05 + 0.6 * (1 - this.boss.hp / this.boss.maxHp);
      }
      return 0.02;
    }
    // L3
    if (phase === 1) {
      const need = Math.max(1, this.level.spinesNeeded);
      const base = this.level.spinesDown / need;
      let nextX = Infinity;
      for (const e of this.enemies) {
        if (!e.dead && e.kind === "spine" && e.x < nextX) nextX = e.x;
      }
      const approach =
        nextX < Infinity
          ? clamp(1 - (nextX - this.player.x) / 450, 0, 1) * (0.85 / need)
          : 0;
      return clamp(base + approach, 0, 1);
    }
    if (this.level.bossDefeated) return 1;
    if (this.boss && !this.boss.dead) {
      return 0.22 + 0.78 * (1 - this.boss.hp / this.boss.maxHp);
    }
    return clamp((this.player.x - (PRIME_ARENA_X - 420)) / 420, 0, 0.2);
  }

  private liveFodderCount() {
    return this.enemies.filter((e) => !e.dead && e.kind !== "spine").length;
  }

  private updateIntensityPacing(dt: number) {
    const progress = this.goalProgress();
    this.intensity = sampleIntensity(this.levelId, this.level.goalPhase, progress);

    if (this.intensity.beat !== this.lastBeat) {
      const prev = this.lastBeat;
      this.lastBeat = this.intensity.beat;
      const rising = this.intensity.intensity >= 0.62;
      const lull = this.intensity.intensity <= 0.22;
      if ((rising || lull) && prev && this.msgTimer < 0.35) {
        this.announce(
          rising ? `THREAT · ${this.intensity.beat}` : `LULL · ${this.intensity.beat}`,
          1.35,
        );
      }
    }

    // Scripted set-pieces keyed to narrative progress
    const beats =
      this.level.goalPhase === 1
        ? SCRIPT_BEATS[this.levelId].a
        : SCRIPT_BEATS[this.levelId].b;
    while (
      this.scriptBeatIndex < beats.length &&
      beats[this.scriptBeatIndex]!.at <= progress
    ) {
      const b = beats[this.scriptBeatIndex]!;
      const sx =
        this.levelId === 1 && b.x !== undefined
          ? b.x
          : this.camX + 480 + Math.random() * 120;
      this.spawnEnemy(b.kind, sx, b.z ?? 0.5, b.hop ?? 0);
      if (b.announce) this.announce(b.announce, 2.2);
      this.scriptBeatIndex++;
    }

    // Density director — fill toward curve live-cap during play/boss
    if (this.mode !== "play" && this.mode !== "boss") return;
    // Boarding / pad-secure / cavity approach: respect deep lulls
    if (this.intensity.maxLive <= 0) return;

    this.densityTimer -= dt;
    if (this.densityTimer > 0) return;
    this.densityTimer = this.intensity.spawnPeriod;

    if (this.liveFodderCount() >= this.intensity.maxLive) return;
    // During circ rings keep it sparse even if curve allows more
    if (this.levelId === 2 && this.level.bossDefeated && this.liveFodderCount() >= 2) return;
    // Don't pile on during boarding window
    if (this.levelId === 1 && this.boardReady) return;

    const kind = rollDensityKind(
      this.levelId,
      this.level.goalPhase,
      this.intensity.intensity,
    );
    const sx =
      this.levelId === 1
        ? this.player.x + 280 + Math.random() * 160
        : this.camX + 500 + Math.random() * 100;
    const z = 0.2 + Math.random() * 0.6;
    const hop = ["drone", "climber", "wasp", "ghost", "gridsat"].includes(kind)
      ? 20 + Math.random() * 40
      : 0;
    this.spawnEnemy(kind, sx, z, hop);
  }

  private spawnEnemy(kind: string, x: number, z = 0.5, hop = 0, hp = 0) {
    const stats: Record<string, { hp: number; w: number; h: number; scrap: number }> = {
      drone: { hp: 28, w: 28, h: 20, scrap: 2 },
      crab: { hp: 36, w: 30, h: 20, scrap: 3 },
      turret: { hp: 45, w: 28, h: 24, scrap: 4 },
      hackbot: { hp: 22, w: 24, h: 24, scrap: 5 },
      walker: { hp: 90, w: 40, h: 36, scrap: 8 },
      climber: { hp: 32, w: 24, h: 24, scrap: 3 },
      wasp: { hp: 24, w: 28, h: 18, scrap: 3 },
      mine: { hp: 18, w: 20, h: 20, scrap: 2 },
      gridsat: { hp: 40, w: 34, h: 24, scrap: 4 },
      mirror: { hp: 50, w: 28, h: 28, scrap: 5 },
      beetle: { hp: 30, w: 28, h: 20, scrap: 6 },
      ghost: { hp: 26, w: 24, h: 24, scrap: 4 },
      spine: { hp: 90, w: 36, h: 36, scrap: 12 },
    };
    const s = stats[kind] ?? { hp: 30, w: 24, h: 24, scrap: 2 };
    this.enemies.push({
      x,
      z: clamp01(z),
      hop,
      vx: 0,
      vz: 0,
      vHop: 0,
      w: s.w,
      h: s.h,
      hp: hp || s.hp,
      maxHp: hp || s.hp,
      dead: false,
      facing: -1,
      kind,
      timer: Math.random() * 2,
      phase: 0,
      flash: 0,
      scrap: s.scrap,
      grounded: hop <= 0,
      anim: createAnimState(
        ["drone", "climber", "wasp", "ghost", "gridsat"].includes(kind)
          ? "hover"
          : kind === "spine" || kind === "mirror" || kind === "turret"
            ? "idle"
            : "walk",
      ),
      animLib: enemyAnimLib(kind),
    });
  }

  private spawnBoss() {
    const b = BOSS[this.levelId];
    const x =
      this.levelId === 1
        ? BOARD_X - 40
        : this.camX + W - 180;
    this.boss = {
      x,
      z: 0.5,
      hop: this.levelId === 1 ? 120 : 50,
      vx: 0,
      vz: 0,
      vHop: 0,
      w: this.levelId === 3 ? 100 : 90,
      h: this.levelId === 3 ? 80 : 70,
      hp: b.hp,
      maxHp: b.hp,
      dead: false,
      facing: -1,
      kind: b.id,
      timer: 0,
      phase: 1,
      flash: 0,
      scrap: 40,
      anim: createAnimState("idle"),
      animLib: bossAnimLib(b.id),
    };
    this.level.bossSpawned = true;
    this.mode = "boss";
    this.announce(`BOSS · ${b.name}`, 2.5);
    this.shake = 10;
  }

  private hurtPlayer(dmg: number) {
    if (this.invuln > 0 || this.player.dead) return;
    this.player.hp -= dmg;
    this.player.flash = 0.2;
    this.invuln = 0.9;
    this.shake = 8;
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.player.dead = true;
      this.mode = "dead";
      this.burst(this.player.x, this.player.z, this.player.hop, C.pad, 24);
      this.announce("SIGNAL LOST · ASH DOWN", 99);
    }
  }

  private burst(x: number, z: number, hop: number, color: string, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 140;
      this.particles.push({
        x,
        z,
        hop,
        vx: Math.cos(a) * sp,
        vz: (Math.random() - 0.5) * 0.4,
        vHop: Math.sin(a) * sp * 0.4,
        life: 0.3 + Math.random() * 0.5,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  private fireWeapon() {
    const def = WEAPONS[this.weapon];
    const cdMul = 1 - this.upgrades.fireRate * 0.08;
    if (this.cooldown > 0) return;
    if (def.heat && this.heat > 1) return;
    const dmgMul = 1 + this.upgrades.damage * 0.12;
    const dir = this.player.kind === "ship" ? 1 : this.player.facing;
    const shootOne = (zBias = 0, hopBias = 0) => {
      this.bullets.push({
        x: this.player.x + dir * 18,
        z: clamp01(this.player.z + zBias),
        hop: this.player.hop + 18 + hopBias,
        vx: def.speed * dir + (this.player.kind === "ship" ? 80 : 0),
        vz: zBias * 0.8,
        vHop: hopBias * 0.2,
        r: def.blast ? 5 : 3,
        dmg: def.damage * dmgMul,
        life: def.pierce ? 0.9 : 0.7,
        friendly: true,
        pierce: def.pierce,
        blast: def.blast,
        color: def.color,
      });
    };
    if (def.spread) {
      shootOne(-0.08, 8);
      shootOne(0, 0);
      shootOne(0.08, -8);
    } else if (def.id === "flame") {
      for (let i = 0; i < 3; i++) shootOne((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 10);
    } else {
      shootOne(0, 0);
    }
    this.cooldown = def.cooldown * cdMul;
    if (this.weapon !== "pistol") {
      this.ammo -= 1;
      if (this.ammo <= 0) {
        this.weapon = "pistol";
        this.ammo = 999;
        this.announce("SIDEARM ONLY");
      }
    }
    if (def.heat) this.heat = Math.min(1.4, this.heat + 0.04);
    this.burst(this.player.x + dir * 20, this.player.z, this.player.hop + 16, C.warn, 3);
    this.player.shooting = true;
    playAnim(this.player.anim, "shoot", 0.2, true);
  }

  private fireSpecial() {
    if (this.special <= 0) return;
    this.special -= 1;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      this.bullets.push({
        x: this.player.x,
        z: this.player.z,
        hop: this.player.hop + 10,
        vx: Math.cos(a) * 280,
        vz: Math.sin(a) * 0.35,
        vHop: Math.sin(a) * 120,
        r: 4,
        dmg: 28 + this.upgrades.damage * 4,
        life: 0.45,
        friendly: true,
        color: C.cyan,
        blast: 20,
      });
    }
    this.burst(this.player.x, this.player.z, this.player.hop, C.cyan, 20);
    this.shake = 6;
    this.announce("EMP BURST");
  }

  private killEnemy(e: Actor) {
    e.dead = true;
    this.burst(e.x, e.z, e.hop, e.kind === "spine" ? C.warn : C.cyan, 14);
    this.score += e.kind === "spine" ? 400 : 100;
    this.scrap += e.scrap ?? 2;
    if (e.kind === "spine") {
      this.level.spinesDown += 1;
      this.announce(`SPINE SEVERED ${this.level.spinesDown}/${this.level.spinesNeeded}`);
      if (this.level.spinesDown >= this.level.spinesNeeded) {
        this.unlockPrimeArena();
      }
    }
    if (Math.random() < 0.22 && e.kind !== "spine") {
      const pool: WeaponId[] = ["spread", "beam", "rocket", "flame", "rail", "coil"];
      this.pickups.push({
        x: e.x,
        z: e.z,
        hop: e.hop,
        kind: pool[Math.floor(Math.random() * pool.length)]!,
        life: 8,
      });
    } else if (Math.random() < 0.45) {
      this.pickups.push({ x: e.x, z: e.z, hop: e.hop, kind: "scrap", life: 8 });
    }
  }

  private enemyShot(e: Actor, speed: number, dmg: number, heavy = false) {
    const dx = this.player.x - e.x;
    const dz = this.player.z - e.z;
    const dh = this.player.hop - e.hop;
    const len = Math.hypot(dx, dz * 200, dh) || 1;
    this.bullets.push({
      x: e.x,
      z: e.z,
      hop: e.hop + 10,
      vx: (dx / len) * speed,
      vz: (dz / len) * 0.35,
      vHop: (dh / len) * speed * 0.25,
      r: heavy ? 5 : 3,
      dmg,
      life: 2.2,
      friendly: false,
      color: heavy ? C.pad : C.cyan,
    });
  }

  private updateEnemy(e: Actor, dt: number) {
    e.timer += dt;
    e.flash = Math.max(0, e.flash - dt);
    const pz = this.player.z;
    const agg = this.intensity.aggression;
    const fire = (base: number) => base / agg;
    const move = (base: number) => base * (0.75 + 0.35 * agg);

    switch (e.kind) {
      case "drone":
      case "climber":
      case "gridsat":
      case "ghost":
        e.hop += Math.sin(e.timer * 2) * 18 * dt;
        e.z += Math.sin(e.timer * 1.3) * 0.12 * dt;
        e.x += move(this.levelId === 1 ? -40 : -30) * dt;
        if (e.timer > fire(1.2)) {
          e.timer = 0;
          this.enemyShot(e, 240, 8);
        }
        break;
      case "crab":
        e.x += move(-55) * dt;
        e.z += (pz - e.z) * 0.6 * dt;
        if (Math.random() < 0.008 + 0.006 * agg) e.vHop = 220;
        e.vHop -= 700 * dt;
        e.hop += e.vHop * dt;
        if (e.hop <= 0) {
          e.hop = 0;
          e.vHop = 0;
        }
        break;
      case "turret":
        if (e.timer > fire(1.4)) {
          e.timer = 0;
          this.enemyShot(e, 260, 10);
        }
        break;
      case "hackbot":
        e.x += Math.sign(this.player.x - e.x) * move(70) * dt;
        e.z += (pz - e.z) * 1.4 * dt;
        if (e.timer > fire(2) && Math.hypot(this.player.x - e.x, (pz - e.z) * 180) < 50 && zOverlap(pz, e.z, 0.22)) {
          e.timer = 0;
          if (this.weapon !== "pistol") {
            this.announce("WEAPON JAMMED!");
            this.weapon = "pistol";
            this.ammo = 999;
          }
          this.hurtPlayer(8);
        }
        break;
      case "walker":
        e.x += move(-35) * dt;
        e.z += (pz - e.z) * 0.4 * dt;
        if (e.timer > fire(1.6)) {
          e.timer = 0;
          this.enemyShot(e, 300, 14, true);
        }
        break;
      case "wasp":
        e.x += move(-90) * dt;
        e.z += Math.sin(e.timer * 3) * 0.2 * dt;
        if (e.timer > fire(0.9)) {
          e.timer = 0;
          this.enemyShot(e, 200, 12);
        }
        break;
      case "mine":
        e.hop += Math.sin(e.timer) * 6 * dt;
        if (Math.hypot(this.player.x - e.x, (pz - e.z) * 160) < 55 && zOverlap(pz, e.z, 0.25)) {
          this.burst(e.x, e.z, e.hop, C.blood, 18);
          this.hurtPlayer(22);
          e.dead = true;
        }
        break;
      case "mirror":
        e.x += move(-25) * dt;
        e.z += Math.sin(e.timer) * 0.1 * dt;
        break;
      case "beetle":
        e.x += move(-40) * dt;
        if (e.timer > fire(1.5)) {
          e.timer = 0;
          for (const o of this.enemies) {
            if (!o.dead && o !== e && Math.hypot(o.x - e.x, (o.z - e.z) * 160) < 140) {
              o.hp = Math.min(o.maxHp, o.hp + 8);
              this.burst(o.x, o.z, o.hop, C.warn, 4);
            }
          }
        }
        break;
      case "spine":
        e.hop += Math.sin(e.timer * 1.2) * 8 * dt;
        if (e.timer > fire(1.8)) {
          e.timer = 0;
          this.enemyShot(e, 240, 12);
        }
        break;
    }

    e.z = clamp01(e.z);
    if (
      zOverlap(this.player.z, e.z, 0.2) &&
      Math.hypot(this.player.x - e.x, this.player.hop - e.hop) < 36
    ) {
      this.hurtPlayer(e.kind === "walker" ? 18 : 10);
    }
    if (e.kind !== "spine" && e.x < this.camX - 100) e.dead = true;
  }

  private updateBoss(dt: number) {
    const b = this.boss;
    if (!b || b.dead) return;
    b.timer += dt;
    b.flash = Math.max(0, b.flash - dt);
    const ratio = b.hp / b.maxHp;
    b.phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    b.z = 0.45 + Math.sin(b.timer * 0.7) * 0.12;

    if (b.kind === "reaper") {
      // Hold the upper gantry / boarding deck — player walks right into the fight
      b.x = BOARD_X - 20 + Math.sin(b.timer * 0.5) * 30;
      b.hop = BOARD_HOP - 20;
      if (b.timer > (b.phase === 1 ? 1.4 : 0.9)) {
        b.timer = 0;
        if (b.phase === 1) this.enemyShot(b, 280, 14, true);
        else if (b.phase === 2) {
          for (let i = -1; i <= 1; i++) {
            this.bullets.push({
              x: b.x - 40,
              z: clamp01(b.z + i * 0.12),
              hop: b.hop,
              vx: -320,
              vz: i * 0.15,
              vHop: 0,
              r: 4,
              dmg: 12,
              life: 2,
              friendly: false,
              color: C.cyan,
            });
          }
          if (Math.random() < 0.5) this.spawnEnemy("drone", b.x - 100, 0.5, 40);
        } else {
          this.bullets.push({
            x: this.player.x,
            z: this.player.z,
            hop: 120,
            vx: 0,
            vz: 0,
            vHop: -420,
            r: 8,
            dmg: 22,
            life: 1.2,
            friendly: false,
            color: C.warn,
            blast: 40,
          });
        }
      }
    } else if (b.kind === "seraph") {
      b.x = this.camX + W - 160;
      b.z += (this.player.z - b.z) * 1.4 * dt;
      if (b.timer > (b.phase === 3 ? 0.7 : 1.1)) {
        b.timer = 0;
        if (b.phase < 3) {
          for (let i = 0; i < b.phase + 1; i++) this.enemyShot(b, 300, 12);
          if (b.phase === 2) this.spawnEnemy("climber", b.x - 80, 0.5, 20);
        } else {
          this.bullets.push({
            x: b.x,
            z: b.z,
            hop: b.hop,
            vx: -520,
            vz: (this.player.z - b.z) * 0.5,
            vHop: (this.player.hop - b.hop) * 0.5,
            r: 7,
            dmg: 26,
            life: 1.4,
            friendly: false,
            color: C.pad,
            blast: 36,
          });
        }
      }
    } else if (b.kind === "prime") {
      b.x = this.camX + W - 200;
      b.hop = 40 + Math.sin(b.timer * 0.5) * 20;
      if (b.timer > (b.phase === 3 ? 0.55 : 1.0)) {
        b.timer = 0;
        const n = 6 + b.phase * 2;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          this.bullets.push({
            x: b.x,
            z: clamp01(b.z + Math.cos(a) * 0.2),
            hop: b.hop,
            vx: Math.cos(a) * 200,
            vz: Math.sin(a) * 0.25,
            vHop: Math.sin(a) * 80,
            r: 4,
            dmg: 14,
            life: 2.5,
            friendly: false,
            color: C.cyan,
          });
        }
        if (b.phase >= 2 && Math.random() < 0.4) {
          this.spawnEnemy("gridsat", b.x - 120, Math.random(), 20);
        }
      }
    }

    if (
      zOverlap(this.player.z, b.z, 0.28) &&
      Math.hypot(this.player.x - b.x, this.player.hop - b.hop) < 70
    ) {
      this.hurtPlayer(16);
    }
  }

  private updateTruck(dt: number) {
    const truck = this.truck;
    if (!truck || truck.arrived) return;
    const near =
      Math.abs(this.player.x - truck.x) < 170 &&
      zOverlap(this.player.z, truck.z, 0.28);
    truck.moving = near && this.level.goalPhase === 1;
    if (truck.moving) {
      truck.x += 55 * dt;
      truck.z += (this.player.z - truck.z) * 1.2 * dt;
    }
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - truck.x, (e.z - truck.z) * 160) < 45 && zOverlap(e.z, truck.z, 0.25)) {
        truck.hp -= 12 * dt;
      }
    }
    for (const b of this.bullets) {
      if (b.friendly || b.life <= 0) continue;
      if (Math.hypot(b.x - truck.x, (b.z - truck.z) * 160) < 32 && zOverlap(b.z, truck.z, 0.3)) {
        truck.hp -= b.dmg * 0.5;
        b.life = 0;
      }
    }
    if (truck.hp <= 0) {
      truck.hp = 0;
      this.burst(truck.x, truck.z, 0, C.pad, 30);
      this.announce("FUEL TRUCK DESTROYED");
      this.hurtPlayer(999);
      return;
    }
    if (truck.x >= PAD7_X) {
      truck.x = PAD7_X;
      truck.arrived = true;
      truck.moving = false;
      this.scrap += Math.ceil(truck.hp / 10);
      this.score += 800;
      this.unlockTowerClimb();
    }
  }

  private recycleMissedGates() {
    for (const g of this.gates) {
      if (!g.hit && this.level.scroll > g.x + 100) {
        g.x = this.level.scroll + 350 + Math.random() * 80;
        g.z = 0.2 + Math.random() * 0.6;
        this.announce(`GATE REQUEUED · match ${laneLabel(g.z)}`, 1.6);
      }
    }
  }

  private updatePlay(dt: number) {
    this.frame += 1;
    this.level.elapsed += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.heat = Math.max(0, this.heat - dt * 0.35);
    this.msgTimer = Math.max(0, this.msgTimer - dt);
    this.shake = Math.max(0, this.shake - dt * 20);
    const mob = 1 + this.upgrades.mobility * 0.08;

    if (this.levelId === 1) {
      this.level.killClock = Math.max(0, this.level.killClock - dt);
      if (this.level.killClock <= 0 && !this.level.bossDefeated) {
        this.hurtPlayer(999);
        this.announce("KILL-CLOCK ZERO");
      }
      this.updateTruck(dt);
    }

    this.updateIntensityPacing(dt);

    if (!this.level.bossSpawned) {
      let ready = false;
      if (this.levelId === 1) {
        // Enter the gantry by walking right from Pad 7 — Pad Reaper holds the tower
        ready =
          this.level.goalPhase === 2 &&
          this.towerReady &&
          this.player.x > GANTRY_START_X + 40;
      } else if (this.levelId === 2) {
        ready = this.level.goalPhase === 2 && this.level.gatesCleared >= this.gates.length;
      } else {
        // Enter Prime cavity by walking/flying right after spines fall
        ready =
          this.level.goalPhase === 2 &&
          this.primeArenaReady &&
          this.player.x > PRIME_ARENA_X;
      }
      if (ready) this.spawnBoss();
    }

    // --- Player movement (2.5D) ---
    if (this.player.kind === "ground") {
      const ax = this.input.axisX();
      const az = this.input.axisZ();
      this.player.vx = ax * 210 * mob;
      this.player.vz = az * 0.55 * mob;
      if (ax) this.player.facing = ax > 0 ? 1 : -1;
      this.player.vHop -= 1400 * dt;
      if (this.input.jumpJust() && this.player.grounded) {
        this.player.vHop = 520;
        this.player.grounded = false;
      }
      this.player.x += this.player.vx * dt;
      this.player.z = clamp01(this.player.z + this.player.vz * dt);
      this.player.hop += this.player.vHop * dt;

      let onGround = false;
      if (this.player.hop <= 0) {
        this.player.hop = 0;
        this.player.vHop = 0;
        onGround = true;
      }
      for (const p of this.level.platforms) {
        if (
          this.player.vHop <= 0 &&
          Math.abs(this.player.x - p.x) < p.w * 0.55 &&
          zOverlap(this.player.z, p.z, 0.35) &&
          this.player.hop <= p.hop + 8 &&
          this.player.hop >= p.hop - 22
        ) {
          this.player.hop = p.hop;
          this.player.vHop = 0;
          onGround = true;
          // Soft Z pull onto the deck so walk-right climbs stay forgiving
          this.player.z += (p.z - this.player.z) * 0.35;
        }
      }
      this.player.grounded = onGround;
      this.player.x = clamp(this.player.x, 40, this.level.length - 40);
      this.camX = clamp(this.player.x - W * 0.35, 0, this.level.length - W);
      this.camLean += (az * 0.08 - this.camLean) * 4 * dt;

      // L1 boarding: after Reaper, walk right into BLACK FINCH
      if (
        this.levelId === 1 &&
        this.boardReady &&
        this.mode !== "clear" &&
        this.player.x > BOARD_X - 50 &&
        this.player.hop >= BOARD_HOP - 30
      ) {
        this.mode = "clear";
        this.announce("BLACK FINCH · BOARDED", 3);
        this.score += 1200;
        this.shake = 10;
      }
    } else if (this.player.kind === "ship") {
      this.level.scroll += 140 * dt;
      this.camX = this.level.scroll;
      this.recycleMissedGates();
      const ax = this.input.axisX();
      const az = this.input.axisZ();
      this.player.vx = ax * 220 * mob;
      this.player.vz = az * 0.7 * mob;
      this.shipThrust = Math.abs(ax) + Math.abs(az) > 0 ? 1 : 0.35;
      this.player.x = clamp(this.player.x + this.player.vx * dt, this.camX + 60, this.camX + W - 80);
      this.player.z = clamp01(this.player.z + this.player.vz * dt);
      this.player.hop = 30 + (1 - this.player.z) * 50;
      this.camLean += (az * 0.1 - this.camLean) * 5 * dt;

      for (const g of this.gates) {
        if (
          !g.hit &&
          Math.abs(this.level.scroll - g.x) < 45 &&
          zOverlap(this.player.z, g.z, 0.22)
        ) {
          g.hit = true;
          this.level.gatesCleared++;
          this.scrap += 5;
          this.announce(`GATE ${this.level.gatesCleared}/${this.gates.length} · ${laneLabel(g.z)}`);
          this.burst(this.player.x, this.player.z, this.player.hop, C.warn, 10);
          if (this.level.gatesCleared >= this.gates.length) {
            this.setGoalPhase2();
            this.announce("NIX: Corridor clean — SERAPH inbound ahead!", 2.8);
          }
        }
      }
      for (const ring of this.circRings) {
        if (
          !ring.hit &&
          Math.abs(this.level.scroll - ring.x) < 55 &&
          zOverlap(this.player.z, ring.z, 0.3)
        ) {
          ring.hit = true;
          this.level.circCleared++;
          this.scrap += 6;
          this.announce(
            `CIRC ${this.level.circCleared}/${this.level.circNeeded} · ${laneLabel(ring.z)}`,
          );
          this.burst(this.player.x, this.player.z, this.player.hop, C.cyan, 12);
          if (this.level.circCleared >= this.level.circNeeded) {
            this.mode = "clear";
            this.announce("LEO INSERTION · CLEAN", 3);
            this.score += 1500;
          }
        }
      }
    } else {
      // EVA — full 2.5D free flight
      if (this.level.goalPhase === 2) this.level.scroll += 40 * dt;
      this.camX = clamp(this.player.x - W * 0.4, 0, Math.max(this.level.length - W, this.level.scroll));
      if (this.level.goalPhase === 2) this.camX = Math.max(this.camX, this.level.scroll);
      const ax = this.input.axisX();
      const az = this.input.axisZ();
      this.player.vx += ax * 420 * dt * mob;
      this.player.vz += az * 0.9 * dt * mob;
      this.player.vx *= 0.96;
      this.player.vz *= 0.96;
      if (this.input.jumpJust()) this.player.vHop = 280;
      this.player.vHop -= 200 * dt;
      if (ax) this.player.facing = ax > 0 ? 1 : -1;
      this.player.x += this.player.vx * dt;
      this.player.z = clamp01(this.player.z + this.player.vz * dt);
      this.player.hop = clamp(this.player.hop + this.player.vHop * dt, 0, 160);
      this.player.x = clamp(this.player.x, 40, this.level.length - 40);
      this.camLean += (az * 0.12 - this.camLean) * 5 * dt;
      for (const p of this.level.platforms) {
        if (
          Math.abs(this.player.x - p.x) < p.w * 0.5 &&
          zOverlap(this.player.z, p.z, 0.2) &&
          this.player.hop < 20
        ) {
          this.player.hop = 0;
          this.player.vHop *= 0.4;
        }
      }
    }

    this.syncStage();
    if (this.input.shoot()) this.fireWeapon();
    if (this.input.specialJust()) this.fireSpecial();
    this.drivePlayerAnim(dt);

    for (const e of this.enemies) {
      if (!e.dead) {
        this.updateEnemy(e, dt);
        this.driveEnemyAnim(e, dt);
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.updateBoss(dt);
    this.driveBossAnim(dt);

    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.z = clamp01(b.z + b.vz * dt);
      b.hop += b.vHop * dt;
      b.life -= dt;
      if (b.friendly) {
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (
            zOverlap(b.z, e.z, 0.28) &&
            Math.hypot(b.x - e.x, b.hop - (e.hop + 10)) < 28 * (0.7 + e.z * 0.3)
          ) {
            if (e.kind === "mirror" && e.flash <= 0 && Math.random() < 0.6) {
              b.vx *= -1;
              b.friendly = false;
              b.color = C.blood;
              continue;
            }
            e.hp -= b.dmg;
            e.flash = 0.1;
            if (!b.pierce) b.life = 0;
            if (b.blast) this.aoe(b.x, b.z, b.hop, b.blast, b.dmg * 0.6);
            if (e.hp <= 0) this.killEnemy(e);
          }
        }
        if (this.boss && !this.boss.dead) {
          const boss = this.boss;
          if (
            zOverlap(b.z, boss.z, 0.35) &&
            Math.hypot(b.x - boss.x, b.hop - boss.hop) < 55
          ) {
            boss.hp -= b.dmg;
            boss.flash = 0.12;
            if (!b.pierce) b.life = 0;
            this.burst(b.x, b.z, b.hop, C.warn, 4);
            if (boss.hp <= 0) {
              boss.dead = true;
              this.level.bossDefeated = true;
              this.burst(boss.x, boss.z, boss.hop, C.cyan, 40);
              this.scrap += boss.scrap ?? 40;
              this.score += 2500;
              this.shake = 16;
              if (this.levelId === 2) {
                this.circRings = [
                  { x: this.level.scroll + 280, z: 0.35, hit: false },
                  { x: this.level.scroll + 480, z: 0.65, hit: false },
                  { x: this.level.scroll + 680, z: 0.45, hit: false },
                ];
                this.level.circCleared = 0;
                this.announce("NIX: Hold circularization — thread the rings ahead!", 3.2);
                this.mode = "play";
              } else if (this.levelId === 1) {
                this.boardReady = true;
                this.mode = "play";
                this.announce("NIX: Path clear — keep RIGHT, board BLACK FINCH!", 3.2);
              } else {
                this.mode = "clear";
                this.announce(`${BOSS[this.levelId].name} DOWN`, 3);
                if (this.levelId === 3) this.stinger = true;
              }
            }
          }
        }
      } else if (
        zOverlap(b.z, this.player.z, 0.28) &&
        Math.hypot(b.x - this.player.x, b.hop - (this.player.hop + 12)) < 28
      ) {
        this.hurtPlayer(b.dmg);
        b.life = 0;
      }
    }
    this.bullets = this.bullets.filter(
      (b) => b.life > 0 && b.x > this.camX - 60 && b.x < this.camX + W + 100,
    );

    for (const p of this.pickups) {
      p.life -= dt;
      p.hop += Math.sin(this.frame * 0.2) * 0.2;
      if (
        zOverlap(this.player.z, p.z, 0.25) &&
        Math.hypot(this.player.x - p.x, this.player.hop - p.hop) < 36
      ) {
        if (p.kind === "scrap") {
          this.scrap += 4;
          this.announce("+SCRAP");
        } else {
          this.weapon = p.kind;
          this.ammo = 40 + this.upgrades.mag * 15;
          this.announce(WEAPONS[p.kind].name);
        }
        p.life = 0;
        this.burst(p.x, p.z, p.hop, C.warn, 6);
      }
    }
    this.pickups = this.pickups.filter((p) => p.life > 0);

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.z += p.vz * dt;
      p.hop += p.vHop * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    if (this.levelId === 1) {
      for (const tech of this.techs) {
        if (
          !tech.rescued &&
          Math.hypot(this.player.x - tech.x, (this.player.z - tech.z) * 160) < 40 &&
          zOverlap(this.player.z, tech.z, 0.25)
        ) {
          tech.rescued = true;
          this.rescued += 1;
          this.scrap += 8;
          this.score += 300;
          this.announce(`TECH RESCUED ${this.rescued}/${this.techs.length}`);
        }
      }
    }
  }

  private aoe(x: number, z: number, hop: number, r: number, dmg: number) {
    this.burst(x, z, hop, C.pad, 16);
    for (const e of this.enemies) {
      if (!e.dead && Math.hypot(e.x - x, (e.z - z) * 160) < r && zOverlap(e.z, z, 0.35)) {
        e.hp -= dmg;
        e.flash = 0.1;
        if (e.hp <= 0) this.killEnemy(e);
      }
    }
  }

  private update(dt: number) {
    if (this.mode === "title") {
      if (this.input.just("arrowdown") || this.input.just("s")) this.menuIndex = (this.menuIndex + 1) % 3;
      if (this.input.just("arrowup") || this.input.just("w")) this.menuIndex = (this.menuIndex + 2) % 3;
      if (this.input.confirm() || this.input.just("enter") || this.input.just("j")) {
        this.scrap = 0;
        this.upgrades = defaultUpgrades();
        this.totalScore = 0;
        this.beginLevel((this.menuIndex + 1) as LevelId);
      }
      return;
    }
    if (this.mode === "briefing") {
      if (this.input.confirm() || this.input.just("enter") || this.input.just("j")) {
        this.mode = "play";
        this.announce("GO!", 1);
      }
      return;
    }
    if (this.mode === "upgrade") {
      if (this.input.just("arrowdown") || this.input.just("s")) this.upgradeIndex = (this.upgradeIndex + 1) % 7;
      if (this.input.just("arrowup") || this.input.just("w")) this.upgradeIndex = (this.upgradeIndex + 6) % 7;
      if (this.input.confirm() || this.input.just("j") || this.input.just("enter")) {
        const keys: (keyof Upgrades | "next")[] = [
          "damage",
          "fireRate",
          "armor",
          "mag",
          "special",
          "mobility",
          "next",
        ];
        const pick = keys[this.upgradeIndex]!;
        if (pick === "next") {
          const next = (this.levelId + 1) as LevelId;
          if (next <= 3) this.beginLevel(next);
          else this.mode = "victory";
        } else {
          const cost = 8 + this.upgrades[pick] * 6;
          if (this.scrap >= cost) {
            this.scrap -= cost;
            this.upgrades[pick] += 1;
            this.announce(`UPGRADED ${pick.toUpperCase()}`);
          } else this.announce("NEED MORE SCRAP");
        }
      }
      return;
    }
    if (this.mode === "clear") {
      this.msgTimer -= dt;
      if (this.input.confirm() || this.input.just("enter") || this.msgTimer < -1) {
        this.totalScore += this.score;
        if (this.levelId === 3) this.mode = "victory";
        else {
          this.mode = "upgrade";
          this.upgradeIndex = 6;
          this.announce("FABRICATOR ONLINE");
        }
      }
      return;
    }
    if (this.mode === "dead") {
      if (this.input.confirm() || this.input.just("enter")) this.beginLevel(this.levelId);
      if (this.input.just("escape")) this.mode = "title";
      return;
    }
    if (this.mode === "victory") {
      if (this.input.confirm() || this.input.just("enter")) this.mode = "title";
      return;
    }
    if (this.mode === "play" || this.mode === "boss") this.updatePlay(dt);
  }

  private renderBg() {
    const ctx = this.ctx;
    const kind = this.levelId === 1 ? "pad" : this.levelId === 2 ? "sky" : "void";
    ctx.fillStyle = C.void;
    ctx.fillRect(0, 0, W, H);

    if (this.levelId === 1) {
      blitParallax(ctx, art.bg("l1-sky"), this.camX, 0.12, -60, 1);
      blitParallax(ctx, art.bg("l1-mid"), this.camX, 0.35, 20, 0.85);
      // rain
      ctx.strokeStyle = "rgba(174,198,220,0.2)";
      for (let i = 0; i < 40; i++) {
        const x = ((i * 97 + this.frame * 8) % (W + 40)) - 20;
        const y = ((i * 53 + this.frame * 14) % (H + 40)) - 20;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 2, y + 12);
        ctx.stroke();
      }
    } else if (this.levelId === 2) {
      blitParallax(ctx, art.bg("l2-ascent"), this.camX, 0.2, -30, 1);
      const alt = this.level.scroll / this.level.length;
      ctx.fillStyle = `rgba(5,7,14,${Math.min(0.5, alt * 0.55)})`;
      ctx.fillRect(0, 0, W, H * 0.35);
    } else {
      blitParallax(ctx, art.bg("l3-void"), this.camX, 0.1, 0, 1);
    }

    drawGroundDeck(ctx, this.stage, kind);
    drawDepthFog(ctx, this.stage);

    if (this.levelId === 1) this.renderPad7Landmark();

    // platforms as raised deck plates / gantry stairs
    for (const p of this.level.platforms) {
      const sp = project({ x: p.x, z: p.z, hop: p.hop }, this.stage);
      if (sp.sx < -80 || sp.sx > W + 80) continue;
      const isGantry = this.towerReady && p.x >= GANTRY_START_X - 10;
      if (isGantry) {
        const label =
          p.x >= BOARD_X - 10 ? "BOARD →" : p.x <= GANTRY_START_X + 10 ? "CLIMB →" : undefined;
        drawGantryDeck(ctx, sp.sx, sp.sy, p.w, sp.scale, label);
      } else {
        const w = p.w * sp.scale;
        rr(ctx, sp.sx - w / 2, sp.sy, w, 8 * sp.scale, C.metal, this.levelId === 3 ? C.cyan : C.warn);
      }
    }

    if (this.levelId === 1 && this.towerReady) this.renderGantryAndShip();
  }

  /** Visible Pad 7 fuel-drop destination + off-screen arrow during Goal A */
  private renderPad7Landmark() {
    const ctx = this.ctx;
    const pulse = 0.5 + 0.5 * Math.sin(this.frame * 0.12);
    const sp = project({ x: PAD7_X, z: 0.5, hop: 0 }, this.stage);
    const onScreen = sp.sx > -40 && sp.sx < W + 40;

    if (onScreen) {
      drawShadow(ctx, sp, 48);
      const ok = blitSprite(ctx, art.sprite("pad7"), sp.sx, sp.sy - 10, {
        h: 90,
        scale: sp.scale,
      });
      if (!ok) drawPad7(ctx, sp.sx, sp.sy, sp.scale, pulse);
      if (this.level.goalPhase === 1) {
        glow(ctx, sp.sx, sp.sy - 40 * sp.scale, 36 * sp.scale, C.warn, 0.2 + pulse * 0.25);
        ctx.fillStyle = C.warn;
        ctx.font = "12px 'Share Tech Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("▼ DROP HERE", sp.sx, sp.sy - 100 * sp.scale);
        ctx.textAlign = "left";
      } else if (this.truck?.arrived) {
        ctx.fillStyle = C.cyan;
        ctx.font = "11px 'Share Tech Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("PAD 7 · SECURE", sp.sx, sp.sy - 100 * sp.scale);
        ctx.textAlign = "left";
      }
    } else if (this.level.goalPhase === 1 && sp.sx >= W) {
      // Off-screen destination arrow — always push right toward Pad 7
      ctx.fillStyle = `rgba(244,211,94,${0.55 + pulse * 0.35})`;
      ctx.beginPath();
      ctx.moveTo(W - 28, H * 0.55);
      ctx.lineTo(W - 8, H * 0.55 + 14);
      ctx.lineTo(W - 28, H * 0.55 + 28);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = C.warn;
      ctx.font = "11px 'Share Tech Mono', monospace";
      ctx.textAlign = "right";
      const dist = Math.max(0, Math.floor(PAD7_X - this.player.x));
      ctx.fillText(`PAD 7 → ${dist}m`, W - 34, H * 0.55 + 16);
      ctx.textAlign = "left";
    }

    // Ground chevrons pointing toward Pad 7 while escorting
    if (this.level.goalPhase === 1) {
      const spacing = 220;
      const start = Math.floor((this.camX + 80) / spacing) * spacing;
      for (let wx = start; wx < Math.min(PAD7_X - 60, this.camX + W + 40); wx += spacing) {
        if (wx < this.player.x - 40) continue;
        const a = project({ x: wx, z: 0.5, hop: 0 }, this.stage);
        if (a.sx < 0 || a.sx > W) continue;
        ctx.fillStyle = "rgba(244,211,94,0.4)";
        ctx.beginPath();
        ctx.moveTo(a.sx - 8, a.sy - 4);
        ctx.lineTo(a.sx + 12, a.sy);
        ctx.lineTo(a.sx - 8, a.sy + 4);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  /** Gantry tower prop + Black Finch boarding silhouette */
  private renderGantryAndShip() {
    const ctx = this.ctx;
    const tower = project({ x: GANTRY_START_X + 80, z: 0.72, hop: 0 }, this.stage);
    if (tower.sx > -60 && tower.sx < W + 60) {
      blitSprite(ctx, art.sprite("gantry-tower"), tower.sx, tower.sy - 40, {
        h: 160,
        scale: tower.scale * 0.85,
        alpha: 0.9,
      });
    }

    const ship = project({ x: BOARD_X + 40, z: 0.45, hop: BOARD_HOP + 20 }, this.stage);
    if (ship.sx > -80 && ship.sx < W + 80) {
      const pulse = 0.5 + 0.5 * Math.sin(this.frame * 0.1);
      glow(ctx, ship.sx, ship.sy, 40 * ship.scale, C.cyan, 0.2 + (this.boardReady ? pulse * 0.3 : 0.1));
      blitSprite(ctx, art.sprite("ship"), ship.sx, ship.sy, {
        h: 70,
        scale: ship.scale,
        alpha: this.boardReady ? 1 : 0.7,
      }) || drawShip(ctx, ship.sx, ship.sy, 0.4, false);
      ctx.fillStyle = this.boardReady ? C.warn : C.cyan;
      ctx.font = "11px 'Share Tech Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(this.boardReady ? "▼ BOARD FINCH" : "BLACK FINCH", ship.sx, ship.sy - 50 * ship.scale);
      ctx.textAlign = "left";
    }

    if (this.level.goalPhase === 2 && !this.boardReady && this.player.x < GANTRY_START_X) {
      ctx.fillStyle = "rgba(46,196,182,0.75)";
      ctx.beginPath();
      ctx.moveTo(W - 28, H * 0.5);
      ctx.lineTo(W - 8, H * 0.5 + 14);
      ctx.lineTo(W - 28, H * 0.5 + 28);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = C.cyan;
      ctx.font = "11px 'Share Tech Mono', monospace";
      ctx.textAlign = "right";
      ctx.fillText("GANTRY → keep right", W - 34, H * 0.5 + 16);
      ctx.textAlign = "left";
    }
  }

  private renderEdgeCue(label: string, yFrac = 0.5, color: string = C.cyan) {
    const ctx = this.ctx;
    const pulse = 0.55 + 0.35 * Math.sin(this.frame * 0.14);
    const y = H * yFrac;
    ctx.fillStyle = color;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.moveTo(W - 28, y);
    ctx.lineTo(W - 8, y + 14);
    ctx.lineTo(W - 28, y + 28);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.font = "11px 'Share Tech Mono', monospace";
    ctx.textAlign = "right";
    ctx.fillText(label, W - 34, y + 16);
    ctx.textAlign = "left";
  }

  /** Depth-meter tick target for the current objective */
  private objectiveDepthZ(): number | null {
    if (this.levelId === 2) {
      if (this.level.goalPhase === 1) {
        let next: { z: number; x: number } | null = null;
        let best = Infinity;
        for (const g of this.gates) {
          if (g.hit) continue;
          const d = g.x - this.level.scroll;
          if (d < best) {
            best = d;
            next = g;
          }
        }
        return next?.z ?? null;
      }
      if (this.level.bossDefeated) {
        let next: { z: number; x: number } | null = null;
        let best = Infinity;
        for (const r of this.circRings) {
          if (r.hit) continue;
          const d = r.x - this.level.scroll;
          if (d < best) {
            best = d;
            next = r;
          }
        }
        return next?.z ?? null;
      }
      return this.boss && !this.boss.dead ? this.boss.z : null;
    }
    if (this.levelId === 3) {
      if (this.level.goalPhase === 1) {
        let next: Actor | null = null;
        for (const e of this.enemies) {
          if (e.dead || e.kind !== "spine") continue;
          if (e.x >= this.player.x - 40 && e.x < (next?.x ?? Infinity)) next = e;
        }
        return next?.z ?? null;
      }
      if (this.boss && !this.boss.dead) return this.boss.z;
      return 0.5;
    }
    if (this.levelId === 1 && this.truck && !this.truck.arrived) return this.truck.z;
    return null;
  }

  /** L2: next-gate / Seraph / circ guidance */
  private renderL2ObjectiveCues() {
    const ctx = this.ctx;
    if (this.level.goalPhase === 1) {
      let next: { x: number; z: number; hit: boolean } | null = null;
      let best = Infinity;
      for (const g of this.gates) {
        if (g.hit) continue;
        const d = g.x - this.level.scroll;
        if (d < best) {
          best = d;
          next = g;
        }
      }
      if (next) {
        const dist = Math.max(0, Math.floor(next.x - this.level.scroll));
        ctx.fillStyle = C.warn;
        ctx.font = "12px 'Share Tech Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(
          `NEXT GATE → ${dist}m · match ${laneLabel(next.z)} (W/S)`,
          W / 2,
          78,
        );
        ctx.textAlign = "left";
      }
    } else if (!this.level.bossSpawned) {
      this.renderEdgeCue("SERAPH INBOUND →", 0.42, C.pad);
    } else if (this.level.bossDefeated) {
      let next: { x: number; z: number; hit: boolean } | null = null;
      let best = Infinity;
      for (const r of this.circRings) {
        if (r.hit) continue;
        const d = r.x - this.level.scroll;
        if (d < best) {
          best = d;
          next = r;
        }
      }
      if (next) {
        const dist = Math.max(0, Math.floor(next.x - this.level.scroll));
        ctx.fillStyle = C.cyan;
        ctx.font = "12px 'Share Tech Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(
          `NEXT CIRC → ${dist}m · match ${laneLabel(next.z)} (W/S)`,
          W / 2,
          78,
        );
        ctx.textAlign = "left";
      } else {
        this.renderEdgeCue("CIRC RINGS AHEAD →", 0.45, C.cyan);
      }
    }
  }

  /** L3: spine hunt markers + Prime cavity destination */
  private renderL3ObjectiveCues() {
    const ctx = this.ctx;
    if (this.level.goalPhase === 1) {
      let next: Actor | null = null;
      // Leftmost living spine at/ahead of the player (walk-right order)
      for (const e of this.enemies) {
        if (e.dead || e.kind !== "spine") continue;
        if (e.x >= this.player.x - 40 && e.x < (next?.x ?? Infinity)) next = e;
      }
      if (next) {
        const sp = project(next, this.stage);
        const dist = Math.max(0, Math.floor(next.x - this.player.x));
        if (sp.sx > W - 20 || sp.sx < -20) {
          this.renderEdgeCue(`SPINE → ${dist}m · ${laneLabel(next.z)}`, 0.48, C.warn);
        }
        ctx.fillStyle = C.warn;
        ctx.font = "12px 'Share Tech Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(
          `NEXT SPINE → ${dist}m · ${laneLabel(next.z)} · keep RIGHT`,
          W / 2,
          78,
        );
        ctx.textAlign = "left";
      }
    } else if (this.primeArenaReady && !this.level.bossSpawned) {
      const cavity = project({ x: PRIME_ARENA_X, z: 0.5, hop: 40 }, this.stage);
      const pulse = 0.5 + 0.5 * Math.sin(this.frame * 0.12);
      if (cavity.sx > -40 && cavity.sx < W + 40) {
        glow(ctx, cavity.sx, cavity.sy, 70 * cavity.scale, C.cyan, 0.25 + pulse * 0.25);
        ctx.strokeStyle = C.cyan;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(cavity.sx, cavity.sy, 55 * cavity.scale, 70 * cavity.scale, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = C.pad;
        ctx.beginPath();
        ctx.ellipse(cavity.sx, cavity.sy, 30 * cavity.scale, 40 * cavity.scale, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = C.bone;
        ctx.font = "14px 'Black Ops One', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("PRIME CAVITY", cavity.sx, cavity.sy - 85 * cavity.scale);
        ctx.fillStyle = C.warn;
        ctx.font = "11px 'Share Tech Mono', monospace";
        ctx.fillText("▼ ENTER →", cavity.sx, cavity.sy - 68 * cavity.scale);
        ctx.textAlign = "left";
      } else {
        const dist = Math.max(0, Math.floor(PRIME_ARENA_X - this.player.x));
        this.renderEdgeCue(`PRIME CAVITY → ${dist}m`, 0.48, C.cyan);
      }
      ctx.fillStyle = C.cyan;
      ctx.font = "12px 'Share Tech Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("GOAL 2/2 — keep RIGHT into the cavity", W / 2, 78);
      ctx.textAlign = "left";
    }
  }

  private renderActors() {
    const ctx = this.ctx;
    type DrawItem =
      | { kind: "pickup"; ref: Pickup }
      | { kind: "enemy"; ref: Actor }
      | { kind: "boss"; ref: Actor }
      | { kind: "player" }
      | { kind: "truck"; ref: FuelTruck }
      | { kind: "tech"; ref: { x: number; z: number; rescued: boolean } }
      | { kind: "gate"; ref: { x: number; z: number; hit: boolean }; circ?: boolean };

    const items: (DrawItem & { z: number; hop: number })[] = [];

    for (const p of this.pickups) items.push({ kind: "pickup", ref: p, z: p.z, hop: p.hop });
    for (const e of this.enemies) items.push({ kind: "enemy", ref: e, z: e.z, hop: e.hop });
    if (this.boss && !this.boss.dead) items.push({ kind: "boss", ref: this.boss, z: this.boss.z, hop: this.boss.hop });
    if (!this.player.dead) items.push({ kind: "player", z: this.player.z, hop: this.player.hop });
    if (this.truck) items.push({ kind: "truck", ref: this.truck, z: this.truck.z, hop: 0 });
    for (const t of this.techs) {
      if (!t.rescued) items.push({ kind: "tech", ref: t, z: t.z, hop: 0 });
    }
    if (this.levelId === 2) {
      for (const g of this.gates) {
        if (!g.hit) items.push({ kind: "gate", ref: g, z: g.z, hop: 40 });
      }
      for (const r of this.circRings) {
        if (!r.hit) items.push({ kind: "gate", ref: r, z: r.z, hop: 40, circ: true });
      }
    }

    for (const item of sortByDepth(items)) {
      if (item.kind === "pickup") {
        const p = item.ref;
        const sp = project(p, this.stage);
        drawShadow(ctx, sp, 14);
        blitSprite(ctx, art.sprite("pickup"), sp.sx, sp.sy, {
          h: 40,
          scale: sp.scale,
          bob: Math.sin(this.frame * 0.2) * 3,
        }) || drawPickup(ctx, p.kind === "scrap" ? "scrap" : "weapon", sp.sx, sp.sy, this.frame);
      } else if (item.kind === "tech") {
        const t = item.ref;
        const sp = project({ x: t.x, z: t.z, hop: 0 }, this.stage);
        drawShadow(ctx, sp, 12);
        glow(ctx, sp.sx, sp.sy, 14 * sp.scale, C.warn, 0.25);
        rr(ctx, sp.sx - 6 * sp.scale, sp.sy - 14 * sp.scale, 12 * sp.scale, 18 * sp.scale, C.bone, C.soot);
      } else if (item.kind === "truck") {
        const truck = item.ref;
        const sp = project({ x: truck.x, z: truck.z, hop: 0 }, this.stage);
        drawShadow(ctx, sp, 36);
        const frameId = truck.moving
          ? `truck-move-${Math.floor(this.frame / 5) % 3}`
          : "truck-idle-0";
        const ok =
          blitSprite(ctx, art.frame(frameId), sp.sx, sp.sy - 4, {
            h: 78,
            scale: sp.scale,
          }) ||
          blitSprite(ctx, art.sprite("truck"), sp.sx, sp.sy - 4, {
            h: 78,
            scale: sp.scale,
          });
        if (!ok) drawTruck(ctx, sp.sx, sp.sy, truck.hp / truck.maxHp, truck.moving);
        rr(ctx, sp.sx - 32 * sp.scale, sp.sy - 42 * sp.scale, 64 * sp.scale, 5, C.soot);
        rr(
          ctx,
          sp.sx - 32 * sp.scale,
          sp.sy - 42 * sp.scale,
          64 * sp.scale * (truck.hp / truck.maxHp),
          5,
          truck.hp < 40 ? C.blood : C.pad,
        );
      } else if (item.kind === "gate") {
        const g = item.ref;
        const worldX = this.levelId === 2 ? g.x - this.level.scroll + this.camX + 300 : g.x;
        const sp = project({ x: worldX, z: g.z, hop: 40 }, this.stage);
        if (item.circ) {
          drawCircRing(ctx, sp.sx, sp.sy, false);
          const idx = this.circRings.indexOf(g) + 1;
          ctx.fillStyle = C.cyan;
          ctx.font = "11px 'Share Tech Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillText(`CIRC ${idx} · ${laneLabel(g.z)}`, sp.sx, sp.sy - 36 * sp.scale);
          ctx.textAlign = "left";
          glow(ctx, sp.sx, sp.sy, 34 * sp.scale, C.cyan, 0.22);
        } else {
          blitSprite(ctx, art.sprite("gate"), sp.sx, sp.sy, { h: 120, scale: sp.scale }) ||
            (() => {
              ctx.strokeStyle = C.warn;
              ctx.lineWidth = 3;
              ctx.strokeRect(sp.sx - 28 * sp.scale, sp.sy - 40 * sp.scale, 56 * sp.scale, 80 * sp.scale);
            })();
          glow(ctx, sp.sx, sp.sy, 30 * sp.scale, C.warn, 0.25);
          ctx.fillStyle = C.warn;
          ctx.font = "11px 'Share Tech Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillText(`GATE · ${laneLabel(g.z)}`, sp.sx, sp.sy - 70 * sp.scale);
          ctx.textAlign = "left";
        }
      } else if (item.kind === "enemy") {
        const e = item.ref;
        const sp = project(e, this.stage);
        drawShadow(ctx, sp, e.kind === "walker" ? 28 : 18);
        const baseH = e.kind === "spine" ? 88 : e.kind === "walker" ? 78 : 68;
        const ok = blitSprite(ctx, this.animImage(e), sp.sx, sp.sy, {
          facing: e.facing,
          h: baseH,
          scale: sp.scale,
          alpha: e.kind === "ghost" ? 0.55 : e.flash > 0 ? 0.55 : 1,
          flash: e.flash > 0,
        });
        if (!ok) {
          if (e.kind === "spine") drawSpine(ctx, sp.sx, sp.sy, this.frame);
          else drawEnemy(ctx, e.kind, sp.sx, sp.sy, this.frame, e.facing);
        }
        if (e.kind === "spine" && !e.dead) {
          ctx.fillStyle = C.warn;
          ctx.font = "11px 'Share Tech Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillText(`SPINE · ${laneLabel(e.z)}`, sp.sx, sp.sy - 55 * sp.scale);
          ctx.textAlign = "left";
          glow(ctx, sp.sx, sp.sy, 40 * sp.scale, C.warn, 0.2);
        }
      } else if (item.kind === "boss") {
        const boss = item.ref;
        const sp = project(boss, this.stage);
        drawShadow(ctx, sp, 50);
        const ok = blitSprite(ctx, this.animImage(boss), sp.sx, sp.sy, {
          h: boss.kind === "prime" ? 180 : 155,
          scale: sp.scale,
          alpha: boss.flash > 0 ? 0.6 : 1,
          flash: boss.flash > 0,
        });
        if (!ok) {
          drawBoss(ctx, boss.kind, sp.sx, sp.sy, this.frame, boss.hp / boss.maxHp, boss.phase);
        }
      } else if (item.kind === "player") {
        const sp = project(this.player, this.stage);
        drawShadow(ctx, sp, this.player.kind === "ship" ? 30 : 18);
        const inv = this.invuln > 0 && Math.floor(this.frame / 2) % 2 === 0;
        if (this.player.kind === "ship") {
          const ok = blitSprite(ctx, this.animImage(this.player), sp.sx, sp.sy, {
            h: 72,
            scale: sp.scale,
            alpha: inv ? 0.4 : 1,
          });
          if (!ok) drawShip(ctx, sp.sx, sp.sy, this.shipThrust, this.player.flash > 0);
          else if (this.shipThrust > 0) {
            glow(ctx, sp.sx - 30 * sp.scale, sp.sy, 14 * sp.scale, C.pad, 0.45);
          }
        } else {
          const ok = blitSprite(ctx, this.animImage(this.player), sp.sx, sp.sy, {
            facing: this.player.facing,
            h: this.player.kind === "eva" ? 84 : 78,
            scale: sp.scale,
            alpha: inv ? 0.4 : 1,
            bob: this.player.kind === "eva" ? Math.sin(this.frame * 0.2) * 2 : 0,
          });
          if (!ok) {
            drawAsh(
              ctx,
              sp.sx,
              sp.sy,
              this.player.facing,
              this.frame,
              this.player.kind === "eva" ? "eva" : "ground",
            );
          }
        }
      }
    }

    // bullets + particles (projected)
    for (const b of this.bullets) {
      const sp = project(b, this.stage);
      glow(ctx, sp.sx, sp.sy, b.r * 3 * sp.scale, b.color, 0.25);
      rr(ctx, sp.sx - b.r * sp.scale, sp.sy - b.r * sp.scale, b.r * 2 * sp.scale, b.r * 2 * sp.scale, b.color);
    }
    for (const p of this.particles) {
      const sp = project(p, this.stage);
      ctx.globalAlpha = clamp(p.life * 2, 0, 1);
      rr(ctx, sp.sx, sp.sy, p.size * sp.scale, p.size * sp.scale, p.color);
      ctx.globalAlpha = 1;
    }
  }

  private renderHud() {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(11,18,32,0.72)";
    ctx.fillRect(0, 0, W, 36);
    ctx.fillStyle = C.bone;
    ctx.font = "12px 'Share Tech Mono', monospace";
    ctx.fillText(`HP ${Math.ceil(this.player.hp)}/${this.player.maxHp}`, 12, 22);
    rr(ctx, 110, 12, 120, 10, C.soot);
    rr(
      ctx,
      110,
      12,
      120 * clamp(this.player.hp / this.player.maxHp, 0, 1),
      10,
      this.player.hp < 30 ? C.blood : C.pad,
    );
    ctx.fillStyle = C.cyan;
    ctx.fillText(WEAPONS[this.weapon].name, 250, 22);
    ctx.fillStyle = C.warn;
    ctx.fillText(this.weapon === "pistol" ? "∞" : `AMMO ${this.ammo}`, 400, 22);
    ctx.fillStyle = C.bone;
    ctx.fillText(`EMP ${this.special}`, 500, 22);
    ctx.fillText(`SCRAP ${this.scrap}`, 560, 22);
    ctx.fillStyle = C.cyan;
    ctx.fillText(this.level.objective, 640, 22);

    // Threat meter — tracks Intensity Director sample
    {
      const tx = 640;
      const ty = 30;
      ctx.fillStyle = "rgba(11,18,32,0.65)";
      ctx.fillRect(tx, ty, 120, 8);
      const fill = 120 * this.intensity.intensity;
      ctx.fillStyle =
        this.intensity.intensity > 0.75
          ? C.blood
          : this.intensity.intensity > 0.45
            ? C.pad
            : C.warn;
      ctx.fillRect(tx, ty, fill, 8);
      ctx.strokeStyle = C.cyan;
      ctx.strokeRect(tx + 0.5, ty + 0.5, 119, 7);
      ctx.fillStyle = "rgba(244,237,228,0.7)";
      ctx.font = "9px 'Share Tech Mono', monospace";
      ctx.fillText(`THREAT ${Math.round(this.intensity.intensity * 100)}`, tx + 124, ty + 8);
    }

    // depth meter
    ctx.fillStyle = "rgba(11,18,32,0.55)";
    ctx.fillRect(W - 28, 80, 14, 120);
    rr(ctx, W - 26, 82 + (1 - this.player.z) * 100, 10, 12, C.warn);
    // Objective depth tick (next gate / circ / spine / cavity)
    const objZ = this.objectiveDepthZ();
    if (objZ !== null) {
      ctx.fillStyle = C.cyan;
      ctx.fillRect(W - 30, 82 + (1 - objZ) * 100 + 4, 18, 3);
    }
    ctx.fillStyle = C.cyan;
    ctx.font = "9px monospace";
    ctx.fillText("NEAR", W - 42, 210);
    ctx.fillText("FAR", W - 36, 78);

    if (this.levelId === 1) {
      ctx.fillStyle = this.level.killClock < 30 ? C.blood : C.warn;
      const truckHp = this.truck ? ` · TRUCK ${Math.ceil(this.truck.hp)}` : "";
      let phaseHint = "";
      if (this.level.goalPhase === 1 && this.truck && !this.truck.arrived) {
        phaseHint = ` · PAD 7 ${Math.max(0, Math.floor(PAD7_X - this.truck.x))}m`;
      } else if (this.boardReady) {
        phaseHint = " · BOARD FINCH →";
      } else if (this.level.goalPhase === 2) {
        phaseHint = this.level.bossSpawned ? " · FIGHT UP THE GANTRY →" : " · CLIMB RIGHT →";
      }
      ctx.fillText(
        `KILL-CLOCK ${Math.ceil(this.level.killClock)}s · TECHS ${this.rescued}/${this.techs.length}${truckHp}${phaseHint}`,
        12,
        54,
      );
    }
    if (this.levelId === 2) {
      ctx.fillStyle = C.warn;
      let line: string;
      if (this.level.goalPhase === 1) {
        line = `GATES ${this.level.gatesCleared}/${this.gates.length} · match depth (W/S)`;
      } else if (!this.level.bossDefeated) {
        line = this.level.bossSpawned ? "SERAPH · hold depth lane" : "SERAPH INBOUND →";
      } else {
        line = `CIRC ${this.level.circCleared}/${this.level.circNeeded} · rings ahead · match depth`;
      }
      ctx.fillText(line, 12, 54);
    }
    if (this.levelId === 3) {
      ctx.fillStyle = C.warn;
      let line: string;
      if (this.level.goalPhase === 1) {
        line = `SPINES ${this.level.spinesDown}/${this.level.spinesNeeded} · keep RIGHT`;
      } else if (!this.level.bossSpawned) {
        const dist = Math.max(0, Math.floor(PRIME_ARENA_X - this.player.x));
        line = `PRIME CAVITY → ${dist}m · keep RIGHT`;
      } else {
        line = "PRIME · rupture the core";
      }
      ctx.fillText(line, 12, 54);
    }

    if (this.boss && !this.boss.dead) {
      const name = BOSS[this.levelId].name;
      ctx.fillStyle = "rgba(11,18,32,0.8)";
      ctx.fillRect(W / 2 - 180, 44, 360, 28);
      ctx.fillStyle = C.cyan;
      ctx.font = "11px 'Share Tech Mono', monospace";
      ctx.fillText(`SIGNAL · ${name}`, W / 2 - 170, 56);
      rr(ctx, W / 2 - 170, 62, 340, 8, C.soot);
      rr(ctx, W / 2 - 170, 62, 340 * clamp(this.boss.hp / this.boss.maxHp, 0, 1), 8, C.cyan);
    }

    if (this.msgTimer > 0 || this.mode === "dead") {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(W / 2 - 220, H / 2 - 30, 440, 40);
      ctx.fillStyle = C.warn;
      ctx.font = "16px 'Black Ops One', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(this.msg, W / 2, H / 2 - 4);
      ctx.textAlign = "left";
    }
  }

  private render() {
    const ctx = this.ctx;
    ctx.save();
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    ctx.translate(sx, sy + this.camLean * 20);
    // slight perspective skew feel via scale
    ctx.translate(W / 2, H / 2);
    ctx.scale(1 + Math.abs(this.camLean) * 0.02, 1);
    ctx.translate(-W / 2, -H / 2);

    if (this.mode === "title") {
      this.renderTitle();
      ctx.restore();
      return;
    }
    if (this.mode === "upgrade") {
      this.renderUpgrade();
      ctx.restore();
      return;
    }
    if (this.mode === "victory") {
      this.renderVictory();
      ctx.restore();
      return;
    }

    this.renderBg();
    this.renderActors();
    if (this.levelId === 2 && (this.mode === "play" || this.mode === "boss")) {
      this.renderL2ObjectiveCues();
    }
    if (this.levelId === 3 && (this.mode === "play" || this.mode === "boss")) {
      this.renderL3ObjectiveCues();
    }
    const kind = this.levelId === 1 ? "pad" : this.levelId === 2 ? "sky" : "void";
    // Authored near-camera props for 2.5D cabinet depth
    if (this.levelId === 1) {
      for (let i = 0; i < 3; i++) {
        const x = ((i * 420 - this.camX * 1.35) % (W + 220)) - 60;
        const img =
          i % 2 === 0 ? art.sprite("prop-crate-near") : art.sprite("prop-gantry-near");
        blitSprite(ctx, img, x, H - 70, { h: 110, alpha: 0.9 });
      }
    } else {
      drawForegroundProps(ctx, this.camX, this.frame, kind);
    }

    if (this.mode === "briefing") this.renderBriefingOverlay();
    if (this.mode === "clear") this.renderClearOverlay();
    if (this.mode === "dead") {
      ctx.fillStyle = "rgba(80,0,0,0.35)";
      ctx.fillRect(0, 0, W, H);
    }
    this.renderHud();
    ctx.restore();
  }

  private renderTitle() {
    const ctx = this.ctx;
    ctx.fillStyle = C.void;
    ctx.fillRect(0, 0, W, H);
    const painted = blitCover(ctx, art.bg("title-hero"), 1);
    if (!painted) {
      ctx.fillStyle = C.navy;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.fillStyle = "rgba(5,8,16,0.55)";
      ctx.fillRect(0, 70, W, 160);
    }
    // miniature ground deck for 2.5D tease
    drawGroundDeck(ctx, { ...STAGE_GROUND, nearGroundY: 520, farGroundY: 400 }, "pad");

    ctx.textAlign = "center";
    ctx.fillStyle = C.cyan;
    ctx.font = "14px 'Share Tech Mono', monospace";
    ctx.fillText("OPERATION ORBITAL BREAK · 2.5D", W / 2, 110);
    ctx.fillStyle = C.bone;
    ctx.font = "64px 'Black Ops One', sans-serif";
    ctx.fillText("STAR MIND", W / 2, 175);
    ctx.fillStyle = C.pad;
    ctx.font = "14px 'Share Tech Mono', monospace";
    ctx.fillText("METAL SLUG DNA  ·  DEPTH LANES  ·  SPACE-PUNK", W / 2, 205);

    const items = ["L1 · EARTH ESCAPE", "L2 · LAUNCH!", "L3 · ORBIT"];
    items.forEach((label, i) => {
      const y = 400 + i * 32;
      const sel = i === this.menuIndex;
      if (sel) {
        ctx.fillStyle = "rgba(11,18,32,0.72)";
        ctx.fillRect(W / 2 - 160, y - 20, 320, 28);
      }
      ctx.fillStyle = sel ? C.warn : C.bone;
      ctx.font = sel ? "18px 'Black Ops One', sans-serif" : "15px 'Share Tech Mono', monospace";
      ctx.fillText(`${sel ? "▸ " : "  "}${label}`, W / 2, y);
    });
    ctx.fillStyle = "rgba(244,237,228,0.55)";
    ctx.font = "12px 'Share Tech Mono', monospace";
    ctx.fillText("A/D strafe · W/S depth · SPACE jump · J shoot · K EMP · F full screen", W / 2, 510);
    ctx.textAlign = "left";
    this.frame++;
  }

  private renderBriefingOverlay() {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(5,8,16,0.78)";
    ctx.fillRect(80, 70, W - 160, H - 140);
    ctx.strokeStyle = C.cyan;
    ctx.strokeRect(80.5, 70.5, W - 161, H - 141);
    ctx.fillStyle = C.pad;
    ctx.font = "22px 'Black Ops One', sans-serif";
    ctx.fillText(this.level.name, 110, 120);
    ctx.fillStyle = C.bone;
    ctx.font = "14px 'Share Tech Mono', monospace";
    const lines =
      this.levelId === 1
        ? [
            "2.5D PAD WAR — strafe on X, push depth with W/S.",
            "GOAL 1/2 — Escort the fuel truck to the lit PAD 7 drop.",
            "GOAL 2/2 — Keep walking RIGHT up gantry decks → board Finch.",
            "Space jump between decks. Pad Reaper holds the tower.",
            "",
            "When in doubt: keep moving RIGHT.",
          ]
        : this.levelId === 2
          ? [
              "ASCENT CORRIDOR — auto-scroll; gates sit on depth lanes.",
              "GOAL 1/2 — Thread EVERY gate (match NEAR/MID/FAR with W/S).",
              "GOAL 2/2 — Kill SERAPH, then thread CIRC rings ahead.",
              "Missed gates re-queue ahead. Depth meter shows the target lane.",
              "",
              "When in doubt: stay alive and match the next gate's depth.",
            ]
          : [
              "ORBITAL 2.5D — free-fly X / depth / hop.",
              "GOAL 1/2 — Sever three marked spines (keep RIGHT to find them).",
              "GOAL 2/2 — Fly RIGHT into the lit PRIME cavity, rupture the core.",
              "Repair Beetles knit spines — hunt them first. SPACE = thrust.",
              "",
              "When in doubt: keep moving RIGHT.",
            ];
    lines.forEach((ln, i) => ctx.fillText(ln, 110, 160 + i * 28));
    ctx.fillStyle = C.warn;
    ctx.fillText("PRESS ENTER / J TO DEPLOY", 110, H - 110);
  }

  private renderClearOverlay() {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(5,8,16,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = C.warn;
    ctx.font = "28px 'Black Ops One', sans-serif";
    ctx.fillText("LEVEL CLEAR", W / 2, H / 2 - 40);
    ctx.fillStyle = C.bone;
    ctx.font = "14px 'Share Tech Mono', monospace";
    ctx.fillText(`SCORE ${this.score}   SCRAP ${this.scrap}`, W / 2, H / 2);
    const nextHint =
      this.levelId === 3
        ? "ENTER · final debrief"
        : this.levelId === 1
          ? "ENTER · fabricator → LAUNCH!"
          : "ENTER · fabricator → ORBIT";
    ctx.fillStyle = C.cyan;
    ctx.fillText(nextHint, W / 2, H / 2 + 36);
    ctx.textAlign = "left";
  }

  private renderUpgrade() {
    const ctx = this.ctx;
    ctx.fillStyle = C.void;
    ctx.fillRect(0, 0, W, H);
    glow(ctx, W / 2, 120, 180, C.cyan, 0.2);
    ctx.fillStyle = C.cyan;
    ctx.font = "14px 'Share Tech Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("BLACK FINCH · FABRICATOR", W / 2, 70);
    ctx.fillStyle = C.bone;
    ctx.font = "28px 'Black Ops One', sans-serif";
    ctx.fillText("SCRAP UPGRADES", W / 2, 110);
    ctx.fillStyle = C.warn;
    ctx.font = "14px 'Share Tech Mono', monospace";
    ctx.fillText(`AVAILABLE SCRAP: ${this.scrap}`, W / 2, 140);
    const nextName = this.levelId === 1 ? "LAUNCH!" : this.levelId === 2 ? "ORBIT" : "VICTORY";
    const rows: { key: keyof Upgrades | "next"; label: string }[] = [
      { key: "damage", label: "DAMAGE" },
      { key: "fireRate", label: "FIRE RATE" },
      { key: "armor", label: "ARMOR" },
      { key: "mag", label: "MAG SIZE" },
      { key: "special", label: "EMP CHARGES" },
      { key: "mobility", label: "MOBILITY" },
      { key: "next", label: `▶ NEXT · ${nextName}` },
    ];
    rows.forEach((r, i) => {
      const sel = i === this.upgradeIndex;
      const y = 190 + i * 36;
      const cost = r.key === "next" ? 0 : 8 + this.upgrades[r.key] * 6;
      const lvl = r.key === "next" ? "ENTER to deploy" : `Lv ${this.upgrades[r.key]}  ·  cost ${cost}`;
      ctx.fillStyle = sel ? C.warn : C.bone;
      ctx.font = sel ? "18px 'Black Ops One', sans-serif" : "15px 'Share Tech Mono', monospace";
      ctx.fillText(`${sel ? "▸ " : "  "}${r.label}   ${lvl}`, W / 2, y);
    });
    ctx.fillStyle = "rgba(244,237,228,0.55)";
    ctx.font = "12px 'Share Tech Mono', monospace";
    ctx.fillText("W/S select · ENTER confirm · NEXT is pre-selected", W / 2, H - 40);
    ctx.textAlign = "left";
  }

  private renderVictory() {
    const ctx = this.ctx;
    ctx.fillStyle = C.void;
    ctx.fillRect(0, 0, W, H);
    glow(ctx, W / 2, H / 2, 220, C.cyan, 0.25);
    ctx.textAlign = "center";
    ctx.fillStyle = C.bone;
    ctx.font = "40px 'Black Ops One', sans-serif";
    ctx.fillText("CONSTELLATION DARK", W / 2, 180);
    ctx.fillStyle = C.cyan;
    ctx.font = "14px 'Share Tech Mono', monospace";
    ctx.fillText("STAR MIND PRIME ruptured · uplink silence across LEO", W / 2, 220);
    ctx.fillStyle = C.warn;
    ctx.fillText(`TOTAL SCORE ${this.totalScore + this.score}`, W / 2, 260);
    ctx.fillStyle = C.bone;
    ctx.fillText("CAPCOM NIX: Come home, Ash. Leave the void to the ghosts.", W / 2, 310);
    if (this.stinger) {
      ctx.fillStyle = C.blood;
      ctx.font = "12px 'Share Tech Mono', monospace";
      ctx.fillText("…one sat blinks back online.", W / 2, 360);
    }
    ctx.fillStyle = C.warn;
    ctx.fillText("ENTER · title", W / 2, 420);
    ctx.textAlign = "left";
    if (Math.floor(this.frame / 20) % 2 === 0) {
      glow(ctx, W / 2 + 180, 120, 16, C.cyan, 0.8);
      rr(ctx, W / 2 + 176, 116, 8, 8, C.cyan);
    }
    this.frame++;
  }
}
