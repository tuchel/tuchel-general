import { music, sfx } from "./audio";
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
  drawArenaRails,
  drawColorGrade,
  drawEarthLimb,
  drawExplosion,
  drawHeatHaze,
  drawHitSpark,
  drawLetterbox,
  drawLightning,
  drawMuzzle,
  drawParticle,
  drawPips,
  drawPlate,
  drawRain,
  drawShearVeil,
  drawSignalMeter,
  drawSodiumPools,
  drawStarTwinkle,
  type Boom,
  type HitSpark,
  type ParticleKind,
} from "./fx";
import {
  CLIPS,
  animFrameIndex,
  createAnimState,
  playAnim,
  tickAnim,
  type AnimName,
  type AnimPlayerState,
} from "./anim";
import {
  art,
  blitCover,
  blitParallaxEvolve,
  blitSprite,
  bossAnimLib,
  bossSpriteId,
  enemyAnimLib,
  enemySpriteId,
} from "./assets";
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
import { mobileZoomFactor, isTouchPrimary } from "./platform";
import {
  SCRIPT_BEATS,
  SET_PIECES,
  actTier,
  rollDensityKind,
  sampleIntensity,
  type IntensitySample,
  type ScriptBeat,
  type SetPieceId,
} from "./pacing";
import {
  drawAsh,
  drawBoss,
  drawBullet,
  drawCircRing,
  drawClampLink,
  drawDeckScar,
  drawEnemy,
  drawGantryDeck,
  drawLaserLane,
  drawPad7,
  drawPickup,
  drawTetherRope,
  drawShip,
  drawSpine,
  drawTruck,
  glow,
  rr,
  type BulletLook,
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

const WEAPON_RANK: Record<WeaponId, number> = {
  pistol: 0,
  coil: 1,
  flame: 2,
  spread: 3,
  beam: 4,
  rocket: 5,
  rail: 6,
};

const KILL_SCORE: Record<string, number> = {
  drone: 120,
  crab: 160,
  turret: 220,
  hackbot: 280,
  walker: 450,
  climber: 140,
  wasp: 200,
  mine: 130,
  gridsat: 220,
  mirror: 320,
  beetle: 380,
  ghost: 240,
  spine: 600,
  tether: 210,
};

const UPGRADE_BLURB: Record<keyof Upgrades, string> = {
  damage: "+12% shot damage",
  fireRate: "−8% fire delay",
  armor: "+20 max HP",
  mag: "+25 / +15 ammo",
  special: "+1 EMP charge",
  mobility: "+8% move speed",
};

function weaponLook(id: WeaponId): BulletLook {
  if (id === "flame") return "flame";
  if (id === "rocket") return "rocket";
  if (id === "beam") return "beam";
  if (id === "rail") return "rail";
  if (id === "spread") return "shard";
  return "pellet";
}

function readBest(): number {
  try {
    return Math.max(0, Number(localStorage.getItem("starmind-best") || 0) || 0);
  } catch {
    return 0;
  }
}

function writeBest(n: number) {
  try {
    localStorage.setItem("starmind-best", String(n));
  } catch {
    /* private mode */
  }
}

let nextUid = 1;
function uid() {
  return nextUid++;
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
  stun?: number;
  revealed?: number;
  uid: number;
  fireAt?: number;
  stolenWpn?: WeaponId;
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
  hits: Set<number>;
  look: BulletLook;
  grav?: number;
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
  kind: ParticleKind;
}

interface ScorePop {
  x: number;
  z: number;
  hop: number;
  text: string;
  life: number;
  color: string;
}

interface Pickup {
  x: number;
  z: number;
  hop: number;
  kind: "scrap" | "health" | WeaponId;
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
  clamped: boolean;
}

interface LaneGate {
  x: number;
  z: number;
  hit: boolean;
  vz?: number;
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
  /** Shared with touch overlay + keyboard — keep public for main.ts wiring */
  readonly input = new Input();
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
  private gates: LaneGate[] = [];
  private circRings: LaneGate[] = [];
  private techs: { x: number; z: number; rescued: boolean }[] = [];
  private truck: FuelTruck | null = null;
  private towerReady = false;
  private boardReady = false;
  private primeArenaReady = false;
  private scriptBeatIndex = 0;
  private densityTimer = 0;
  private intensity: IntensitySample = sampleIntensity(1, 1, 0);
  /** Smoothed 0–1 threat for continuous background evolution */
  private bgThreat = 0;
  private lastBeat = "";
  private rescued = 0;
  private score = 0;
  private totalScore = 0;
  private last = 0;
  private running = false;
  private stinger = false;
  private camLean = 0;
  private walkDustLatch = -1;
  private hitStop = 0;
  private combo = 0;
  private comboTimer = 0;
  private scorePops: ScorePop[] = [];
  private railCharge = 0;
  private wasShooting = false;
  private continues = 0;
  private pausedFrom: Mode | null = null;
  private camXTarget = 0;
  private coyote = 0;
  private jumpBuf = 0;
  private screenFlash = 0;
  private empPulse = 0;
  private muzzle = 0;
  private landSquash = 0;
  private hintT = 0;
  private bestScore = 0;
  private lowHpWarn = 0;
  private booms: Boom[] = [];
  private impacts: HitSpark[] = [];
  private lightning = 0;
  private firedEvents = new Set<string>();
  private laserSweep: { z: number; vz: number; life: number } | null = null;
  private deckSlamX: number | null = null;
  private gScale = 1;
  private shearLife = 0;
  private laneMin = 0;
  private laneMax = 1;
  private stageSepLock = 0;
  private twistCue = "";
  private twistCueT = 0;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = true;
    this.bestScore = readBest();
    document.addEventListener("visibilitychange", () => {
      if (
        document.hidden &&
        (this.mode === "play" || this.mode === "boss")
      ) {
        this.pausedFrom = this.mode;
        this.mode = "pause";
      }
    });
  }

  start() {
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      let dt = Math.min(0.033, (now - this.last) / 1000);
      this.last = now;
      if (this.hitStop > 0) {
        this.hitStop = Math.max(0, this.hitStop - dt);
        dt *= 0.12;
      }
      this.update(dt);
      this.render();
      this.input.tick();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** Touch UI mode for mobile overlay (play combat vs menu strip) */
  uiMode(): "play" | "menu" | "hidden" {
    if (this.mode === "play" || this.mode === "boss") return "play";
    if (
      this.mode === "title" ||
      this.mode === "howto" ||
      this.mode === "briefing" ||
      this.mode === "upgrade" ||
      this.mode === "pause" ||
      this.mode === "clear" ||
      this.mode === "dead" ||
      this.mode === "victory"
    ) {
      return "menu";
    }
    return "hidden";
  }

  showTouchBack(): boolean {
    return (
      this.mode === "briefing" ||
      this.mode === "upgrade" ||
      this.mode === "pause" ||
      this.mode === "howto" ||
      this.mode === "dead" ||
      this.mode === "victory"
    );
  }

  showTouchNav(): boolean {
    return this.mode === "title" || this.mode === "upgrade";
  }

  private announce(text: string, time = 2.2) {
    this.msg = text;
    this.msgTimer = time;
  }

  private syncStage() {
    this.stage.camX = this.camX;
  }

  private animImage(actor: Actor): HTMLImageElement | null {
    const libName = actor.animLib;
    const playerLib = libName === "ash" || libName === "ash-eva" || libName === "ship";
    if (playerLib) {
      const lib = CLIPS[libName];
      const clip = lib?.[actor.anim.clip];
      if (clip) {
        const idx = animFrameIndex(actor.anim, clip);
        const id = clip.frames[idx];
        if (id) {
          const framed = art.frame(id);
          if (framed) return framed;
        }
      }
      if (libName === "ash") return art.sprite("ash");
      if (libName === "ash-eva") return art.sprite("ash-eva");
      return art.sprite("ship");
    }
    if (libName.startsWith("boss-")) return art.sprite(bossSpriteId(actor.kind));
    if (actor.kind === "mine") return null;
    return art.sprite(enemySpriteId(actor.kind));
  }

  private drivePlayerAnim(dt: number) {
    const p = this.player;
    const groundedWalk =
      p.kind === "ground" &&
      !!p.grounded &&
      (Math.abs(p.vx) > 18 || Math.abs(p.vz) > 0.04);

    if (groundedWalk) {
      // Distance-synced stride — stops the "ice skate" glide
      if (p.anim.lockedUntil > 0) {
        p.anim.lockedUntil = Math.max(0, p.anim.lockedUntil - dt);
      }
      if (p.anim.clip !== "walk") {
        playAnim(p.anim, "walk");
      }
      const clip = CLIPS.ash?.walk;
      const speed = Math.hypot(p.vx, p.vz * 150);
      // ~56 world-units per full cycle ≈ heavy Metal Slug boot stride
      const cyclesPerSec = speed / 56;
      const cycleDur = clip ? clip.frames.length / clip.fps : 1;
      p.anim.time += cyclesPerSec * cycleDur * dt;
    } else {
      tickAnim(p.anim, dt);
    }

    if (p.shooting) {
      playAnim(p.anim, "shoot", 0.18);
      if (p.anim.lockedUntil <= 0 && p.anim.clip === "shoot") p.shooting = false;
    } else if (p.kind === "ground") {
      if (!p.grounded) playAnim(p.anim, "jump");
      else if (groundedWalk) playAnim(p.anim, "walk");
      else playAnim(p.anim, "idle");
    } else if (p.kind === "ship") {
      if (this.shipThrust > 0.5) playAnim(p.anim, "thrust");
      else playAnim(p.anim, "idle");
    } else {
      if (Math.abs(p.vx) + Math.abs(p.vz) + Math.abs(p.vHop) > 40) playAnim(p.anim, "thrust");
      else playAnim(p.anim, "idle");
    }

    // Foot-plant dust on contact frames
    if (groundedWalk && p.anim.clip === "walk") {
      const clip = CLIPS.ash?.walk;
      const idx = animFrameIndex(p.anim, clip);
      if ((idx === 0 || idx === 4) && this.walkDustLatch !== idx) {
        this.walkDustLatch = idx;
        this.burst(p.x - p.facing * 6, p.z, 0, C.metal, 4);
      } else if (idx !== 0 && idx !== 4) {
        this.walkDustLatch = -1;
      }
    } else {
      this.walkDustLatch = -1;
    }
  }

  private driveEnemyAnim(e: Actor, dt: number) {
    tickAnim(e.anim, dt);
    // Mines are a procedural spiked orb — never borrow the drone clip pack.
    if (e.kind === "mine") return;
    const lib = CLIPS[e.animLib];
    if (!lib) return;
    const flying = ["drone", "climber", "wasp", "ghost", "gridsat", "tether"].includes(e.kind);
    let want: AnimName | null = null;
    if (e.kind === "spine" || e.kind === "mirror") want = lib.idle ? "idle" : null;
    else if (e.kind === "turret") want = e.timer < 0.25 && lib.attack ? "attack" : lib.idle ? "idle" : null;
    else if (flying) want = lib.hover ? "hover" : null;
    else if (e.kind === "crab" && e.hop > 8) want = lib.attack ? "attack" : lib.walk ? "walk" : null;
    else if (lib.walk) want = "walk";
    else if (lib.hover) want = "hover";
    else if (lib.idle) want = "idle";
    if (want) playAnim(e.anim, want);
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
    const hp = 200 + this.upgrades.armor * 20;
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
      stun: 0,
      revealed: 0,
      uid: uid(),
    };
    this.weapon = "coil";
    this.ammo = 80 + this.upgrades.mag * 25;
    this.cooldown = 0;
    this.specialMax = 3 + this.upgrades.special;
    this.special = this.specialMax;
    this.invuln = 1;
    this.heat = 0;
  }

  private withMobileZoom(stage: Stage25D): Stage25D {
    const z = mobileZoomFactor();
    if (z === 1) return { ...stage };
    return {
      ...stage,
      nearScale: stage.nearScale * z,
      farScale: stage.farScale * z,
    };
  }

  private beginLevel(id: LevelId) {
    this.levelId = id;
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.pickups = [];
    this.booms = [];
    this.impacts = [];
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
    this.bgThreat = this.intensity.intensity;
    this.camLean = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.scorePops = [];
    this.railCharge = 0;
    this.hitStop = 0;
    this.pausedFrom = null;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.screenFlash = 0;
    this.empPulse = 0;
    this.muzzle = 0;
    this.landSquash = 0;
    this.hintT = 0;
    this.lightning = 0;
    this.firedEvents = new Set();
    this.laserSweep = null;
    this.deckSlamX = null;
    this.gScale = 1;
    this.shearLife = 0;
    this.laneMin = 0;
    this.laneMax = 1;
    this.stageSepLock = 0;
    this.twistCue = "";
    this.twistCueT = 0;

    if (id === 1) {
      this.stage = this.withMobileZoom(STAGE_GROUND);
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
        killClock: 170,
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
        clamped: false,
      };
      this.techs = [
        { x: 450, z: 0.35, rescued: false },
        { x: 980, z: 0.7, rescued: false },
        { x: 1580, z: 0.4, rescued: false },
      ];
      this.resetPlayer("ground");
    } else if (id === 2) {
      this.stage = this.withMobileZoom(STAGE_SKY);
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
        { x: 1350, z: 0.6, hit: false, vz: 0.14 },
        { x: 1700, z: 0.4, hit: false, vz: -0.16 },
      ];
      this.resetPlayer("ship");
    } else {
      this.stage = this.withMobileZoom(STAGE_VOID);
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
      this.spawnEnemy("spine", 720, 0.3, 20);
      this.spawnEnemy("spine", 1200, 0.55, 10);
      this.spawnEnemy("spine", 1750, 0.45, 30);
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
    this.lastBeat = "";
    this.announce(`GOAL 2/2 · ${this.level.goalB}`, 2.8);
    this.shake = 8;
    if (this.levelId === 2) this.fireSetPiece("stage-sep");
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

  private cue(text: string, time = 2.4) {
    this.twistCue = text;
    this.twistCueT = time;
    this.announce(text, time);
  }

  private spineArmored(e: Actor): boolean {
    if (e.kind !== "spine") return false;
    return this.enemies.some(
      (o) =>
        !o.dead &&
        o.kind === "beetle" &&
        Math.abs(o.x - e.x) < 200 &&
        Math.abs(o.z - e.z) < 0.4,
    );
  }

  private canFire(e: Actor, period: number): boolean {
    if (this.level.elapsed < (e.fireAt ?? 0)) return false;
    e.fireAt = this.level.elapsed + period;
    return true;
  }

  private spawnScript(b: ScriptBeat) {
    const n = Math.max(1, b.n ?? 1);
    const pattern = b.pattern ?? "line";
    const baseX =
      this.levelId === 1 && b.x !== undefined
        ? b.x
        : this.camX + 480 + Math.random() * 80;
    const baseZ = b.z ?? 0.5;
    const hop = b.hop ?? (["drone", "climber", "wasp", "ghost", "gridsat", "tether"].includes(b.kind) ? 28 : 0);
    for (let i = 0; i < n; i++) {
      let x = baseX;
      let z = baseZ;
      if (pattern === "behind") {
        x = this.player.x - 90 - i * 38;
        z = clamp01(baseZ + (i - (n - 1) / 2) * 0.14);
      } else if (pattern === "v") {
        x = baseX + (i === Math.floor(n / 2) ? 0 : 40);
        z = clamp01(baseZ + (i - (n - 1) / 2) * 0.16);
      } else {
        x = baseX + i * 46;
        z = clamp01(baseZ + (i - (n - 1) / 2) * 0.08);
      }
      this.spawnEnemy(b.kind, x, z, hop);
    }
    if (b.announce) this.announce(b.announce, 2.2);
  }

  private fireSetPiece(id: SetPieceId) {
    if (this.firedEvents.has(id)) return;
    this.firedEvents.add(id);
    if (id === "ambush-behind") {
      this.cue("NIX: Contact AFT — they're behind you!", 2.4);
      sfx.telegraph();
      this.shake = 7;
      for (let i = 0; i < 3; i++) {
        this.spawnEnemy("crab", this.player.x - 70 - i * 36, clamp01(this.player.z + (i - 1) * 0.16), 0);
      }
    } else if (id === "walker-clamp") {
      this.cue("NIX: Walker clamped the truck — kill it!", 2.6);
      sfx.warn();
    } else if (id === "deck-slam") {
      this.deckSlamX = GANTRY_START_X + 260;
      this.cue("DECK SLAM — JUMP THE GAP", 2.6);
      sfx.slam();
      this.shake = 14;
      this.screenFlash = 0.12;
    } else if (id === "gate-drift") {
      this.cue("NIX: Late gates are drifting — match depth!", 2.2);
      sfx.telegraph();
      for (let i = 3; i < this.gates.length; i++) {
        const g = this.gates[i]!;
        if (g.vz === undefined) g.vz = i % 2 === 0 ? 0.14 : -0.15;
      }
    } else if (id === "stage-sep") {
      this.stageSepLock = 4.6;
      this.cue("STAGE SEP — DEBRIS FIELD", 2.8);
      sfx.rumble();
      this.shake = 12;
      this.screenFlash = 0.1;
      for (let i = 0; i < 5; i++) {
        this.spawnEnemy(
          i % 2 === 0 ? "mine" : "climber",
          this.camX + W + 40 + i * 50,
          0.18 + i * 0.16,
          20 + (i % 3) * 12,
        );
      }
      this.spawnEnemy("tether", this.camX + W + 80, 0.5, 30);
    } else if (id === "circ-drift") {
      for (const r of this.circRings) {
        r.vz = r.z < 0.5 ? 0.12 : -0.12;
      }
    } else if (id === "shear") {
      this.shearLife = 8.5;
      this.gScale = 0.38;
      this.cue("GRAVITY SHEAR — hang time", 2.6);
      sfx.shear();
      this.shake = 8;
    } else if (id === "beetle-rush") {
      this.cue("NIX: Beetle rush on the last spine!", 2.4);
      sfx.telegraph();
      const spine = this.enemies.find((e) => !e.dead && e.kind === "spine");
      const sx = spine ? spine.x - 80 : this.player.x + 220;
      const sz = spine ? spine.z : 0.5;
      this.spawnEnemy("beetle", sx, sz, 8);
      this.spawnEnemy("beetle", sx + 50, clamp01(sz + 0.18), 8);
    } else if (id === "arena-shrink") {
      this.laneMin = 0.28;
      this.laneMax = 0.72;
      this.cue("ARENA COLLAPSE — EVA THE CORE", 2.8);
      sfx.rumble();
      this.shake = 10;
      for (let i = 0; i < 3; i++) {
        this.spawnEnemy("gridsat", this.camX + W + 30 + i * 40, 0.3 + i * 0.18, 24);
        const last = this.enemies[this.enemies.length - 1];
        if (last) last.phase = 9;
      }
    }
  }

  private updateIntensityPacing(dt: number) {
    const progress = this.goalProgress();
    this.intensity = sampleIntensity(this.levelId, this.level.goalPhase, progress);
    // Continuous visual evolution — lag slightly so plates crossfade, don't pop
    const k = 1 - Math.exp(-1.35 * dt);
    this.bgThreat += (this.intensity.intensity - this.bgThreat) * k;

    if (this.intensity.beat !== this.lastBeat) {
      const prev = this.lastBeat;
      this.lastBeat = this.intensity.beat;
      const rising = this.intensity.intensity >= 0.62;
      const lull = this.intensity.intensity <= 0.22;
      if ((rising || lull) && prev && this.msgTimer < 0.35) {
        this.announce(
          rising ? "NIX: Contact spike — stay mobile!" : "NIX: Window. Push the objective.",
          1.2,
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
      this.spawnScript(beats[this.scriptBeatIndex]!);
      this.scriptBeatIndex++;
    }

    for (const piece of SET_PIECES[this.levelId]) {
      if (piece.phase === this.level.goalPhase && piece.at <= progress) {
        this.fireSetPiece(piece.id);
      }
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
    const hop = ["drone", "climber", "wasp", "ghost", "gridsat", "tether"].includes(kind)
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
      tether: { hp: 32, w: 28, h: 24, scrap: 5 },
    };
    const s = stats[kind] ?? { hp: 30, w: 24, h: 24, scrap: 2 };
    const tier = actTier(this.levelId);
    const hp0 = (hp || s.hp) * tier.hp;
    const hover = ["drone", "climber", "wasp", "ghost", "gridsat", "tether"].includes(kind);
    this.enemies.push({
      x,
      z: clamp01(z),
      hop,
      vx: 0,
      vz: 0,
      vHop: 0,
      w: s.w,
      h: s.h,
      hp: hp0,
      maxHp: hp0,
      dead: false,
      facing: -1,
      kind,
      timer: Math.random() * 2,
      phase: 0,
      flash: 0,
      scrap: s.scrap,
      grounded: hop <= 0,
      anim: createAnimState(
        hover
          ? "hover"
          : kind === "spine" || kind === "mirror" || kind === "turret"
            ? "idle"
            : "walk",
      ),
      animLib: enemyAnimLib(kind),
      stun: 0,
      revealed: kind === "ghost" ? 0 : 1,
      uid: uid(),
      fireAt: this.level.elapsed + Math.random() * 0.6,
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
      stun: 0,
      uid: uid(),
    };
    this.level.bossSpawned = true;
    this.mode = "boss";
    this.announce(`BOSS · ${b.name}`, 2.5);
    this.shake = 10;
    this.hitStop = 0.12;
    sfx.boss();
  }

  private hurtPlayer(dmg: number) {
    if (this.invuln > 0 || this.player.dead) return;
    this.player.hp -= dmg;
    this.player.flash = 0.25;
    this.invuln = 0.85;
    this.shake = Math.max(this.shake, 7);
    this.combo = 0;
    this.comboTimer = 0;
    this.screenFlash = Math.max(this.screenFlash, 0.16);
    sfx.hurt();
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.player.dead = true;
      this.mode = "dead";
      this.burst(this.player.x, this.player.z, this.player.hop, C.pad, 28);
      this.boom(this.player.x, this.player.z, this.player.hop, 1.6, "fire");
      this.announce("SIGNAL LOST · ASH DOWN", 99);
      sfx.death();
    }
  }

  private popScore(x: number, z: number, hop: number, text: string, color?: string) {
    this.scorePops.push({ x, z, hop: hop + 24, text, life: 0.85, color: color ?? C.warn });
  }

  private hitRadius(a: Actor): number {
    const body = Math.max(a.w, a.h) * 0.58;
    const depth = 1.2 - a.z * 0.18;
    let r = body * depth;
    if (a.kind === "turret") r *= 1.75;
    return r;
  }

  /** Depth slack for a friendly shot vs an actor. Turrets sit far; they need more lane forgive. */
  private hitZSlack(a: Actor): number {
    return a.kind === "turret" ? 0.55 : 0.42;
  }

  private shotHitsActor(b: Bullet, e: Actor): boolean {
    if (!zOverlap(b.z, e.z, this.hitZSlack(e))) return false;
    const hopScale = e.kind === "turret" ? 0.42 : e.hop < 8 ? 0.55 : 0.85;
    const hopErr = (b.hop - (e.hop + e.h * 0.2)) * hopScale;
    return Math.hypot(b.x - e.x, hopErr) < this.hitRadius(e);
  }

  private axes(): { ax: number; az: number } {
    let ax = this.input.axisX();
    let az = this.input.axisZ();
    const mag = Math.hypot(ax, az);
    if (mag > 1) {
      ax /= mag;
      az /= mag;
    }
    return { ax, az };
  }

  private aimHopBias(): number {
    const dir = this.player.kind === "ship" ? 1 : this.player.facing;
    let bestHop = this.player.hop;
    let bestD = 300;
    const consider = (e: Actor) => {
      const dx = (e.x - this.player.x) * dir;
      if (dx < 16 || dx > 340) return;
      if (!zOverlap(this.player.z, e.z, e.kind === "turret" ? 0.58 : 0.45)) return;
      if (dx < bestD) {
        bestD = dx;
        bestHop = e.hop;
      }
    };
    for (const e of this.enemies) if (!e.dead) consider(e);
    if (this.boss && !this.boss.dead) consider(this.boss);
    return (bestHop - this.player.hop) * 0.62;
  }

  private burst(x: number, z: number, hop: number, color: string, n = 12, kind: ParticleKind = "spark") {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 140;
      const k: ParticleKind =
        kind !== "spark"
          ? kind
          : i % 5 === 0
            ? "smoke"
            : i % 5 === 1
              ? "ember"
              : i % 5 === 2
                ? "debris"
                : "spark";
      this.particles.push({
        x,
        z,
        hop,
        vx: Math.cos(a) * sp,
        vz: (Math.random() - 0.5) * 0.4,
        vHop: Math.sin(a) * sp * 0.4,
        life: 0.3 + Math.random() * 0.5,
        color,
        size: k === "smoke" ? 5 + Math.random() * 4 : 2 + Math.random() * 3,
        kind: k,
      });
    }
  }

  private boom(x: number, z: number, hop: number, scale = 1, kind: Boom["kind"] = "fire") {
    this.booms.push({ x, z, hop, life: 0.42, max: 0.42, scale, kind });
  }

  private sparkHit(x: number, z: number, hop: number, look: BulletLook) {
    const max = look === "rocket" ? 0.22 : look === "rail" || look === "beam" ? 0.18 : 0.14;
    this.impacts.push({ x, z, hop, life: max, max, look });
  }

  private spawnBullet(partial: Omit<Bullet, "hits" | "look"> & { hits?: Set<number>; look?: BulletLook }): Bullet {
    const b: Bullet = {
      ...partial,
      hits: partial.hits ?? new Set(),
      look: partial.look ?? (partial.friendly ? "pellet" : "hostile"),
    };
    this.bullets.push(b);
    return b;
  }

  private fireWeapon() {
    const def = WEAPONS[this.weapon];
    const cdMul = 1 - this.upgrades.fireRate * 0.08;
    if (this.cooldown > 0) return;
    if (def.heat && this.heat > 1) return;
    const dmgMul = 1 + this.upgrades.damage * 0.12;
    const dir = this.player.kind === "ship" ? 1 : this.player.facing;
    const hopAim = this.aimHopBias();
    const shootOne = (zBias = 0, hopBias = 0, extra?: Partial<Bullet>) => {
      this.spawnBullet({
        x: this.player.x + dir * 18,
        z: clamp01(this.player.z + zBias),
        hop: this.player.hop + 18 + hopBias + hopAim,
        vx: def.speed * dir + (this.player.kind === "ship" ? 80 : 0),
        vz: zBias * 1.6,
        vHop: hopBias * 0.35 + hopAim * 0.4,
        r: extra?.r ?? (def.blast ? 5 : 3),
        dmg: def.damage * dmgMul,
        life: extra?.life ?? (def.pierce ? 0.9 : 0.7),
        friendly: true,
        pierce: extra?.pierce ?? def.pierce,
        blast: extra?.blast ?? def.blast,
        color: def.color,
        look: extra?.look ?? weaponLook(def.id),
      });
    };
    if (def.spread) {
      shootOne(-0.12, 14);
      shootOne(0, 0);
      shootOne(0.12, -14);
    } else if (def.id === "flame") {
      for (let i = 0; i < 5; i++) {
        shootOne((Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 16, {
          life: 0.22,
          r: 5,
        });
      }
    } else if (def.id === "rocket") {
      shootOne(0, 0, { r: 6, life: 0.85 });
      this.shake = Math.max(this.shake, 3);
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
    if (def.heat) this.heat = Math.min(1.4, this.heat + 0.045);
    this.burst(this.player.x + dir * 20, this.player.z, this.player.hop + 16, C.warn, 3);
    this.player.shooting = true;
    this.muzzle = 0.06;
    this.camX += dir * (def.id === "rocket" ? 4 : 1.5);
    if (this.player.kind === "ground") {
      this.particles.push({
        x: this.player.x + dir * 8,
        z: this.player.z,
        hop: this.player.hop + 14,
        vx: -dir * (40 + Math.random() * 30),
        vz: 0,
        vHop: 80 + Math.random() * 40,
        life: 0.45,
        color: C.warn,
        size: 2,
        kind: "shell",
      });
    }
    playAnim(this.player.anim, "shoot", 0.2, true);
    sfx.shoot(def.id);
  }

  private fireRail(charge: number) {
    const def = WEAPONS.rail;
    const dmgMul = 1 + this.upgrades.damage * 0.12;
    const dir = this.player.kind === "ship" ? 1 : this.player.facing;
    const power = clamp(charge / 0.85, 0.35, 1.25);
    this.spawnBullet({
      x: this.player.x + dir * 18,
      z: this.player.z,
      hop: this.player.hop + 18 + this.aimHopBias(),
      vx: def.speed * dir,
      vz: 0,
      vHop: this.aimHopBias() * 0.5,
      r: 4 + power * 3,
      dmg: def.damage * dmgMul * power,
      life: 0.95,
      friendly: true,
      pierce: true,
      color: C.earth,
      look: "rail",
    });
    this.cooldown = def.cooldown * (1 - this.upgrades.fireRate * 0.08);
    if (this.weapon !== "pistol") {
      this.ammo -= 1;
      if (this.ammo <= 0) {
        this.weapon = "pistol";
        this.ammo = 999;
      }
    }
    this.shake = Math.max(this.shake, 5 + power * 6);
    this.hitStop = 0.045;
    this.muzzle = 0.1;
    this.screenFlash = 0.08 * power;
    this.player.shooting = true;
    playAnim(this.player.anim, "shoot", 0.22, true);
    sfx.shoot("rail");
  }

  private fireSpecial() {
    if (this.special <= 0) return;
    this.special -= 1;
    const p = this.player;
    const R = 320;
    const inBlast = (x: number, z: number) =>
      Math.hypot(x - p.x, (z - p.z) * 160) < R;
    this.bullets = this.bullets.filter((b) => b.friendly || !inBlast(b.x, b.z));
    for (const e of this.enemies) {
      if (e.dead || !inBlast(e.x, e.z)) continue;
      e.stun = 1.35;
      e.flash = 0.25;
      e.hp -= 16 + this.upgrades.damage * 3;
      if (e.kind === "mirror") e.stun = 2.2;
      if (e.hp <= 0) this.killEnemy(e);
    }
    if (this.boss && !this.boss.dead && inBlast(this.boss.x, this.boss.z)) {
      this.boss.stun = 0.55;
      this.boss.hp -= 36 + this.upgrades.damage * 6;
      this.boss.flash = 0.2;
    }
    this.burst(p.x, p.z, p.hop, C.cyan, 28);
    this.boom(p.x, p.z, p.hop, 1.8, "emp");
    this.shake = 9;
    this.hitStop = 0.08;
    this.empPulse = 1;
    this.screenFlash = 0.22;
    this.announce("EMP · GRID DOWN");
    sfx.emp();
  }

  private killEnemy(e: Actor) {
    if (e.dead) return;
    e.dead = true;
    this.burst(e.x, e.z, e.hop, e.kind === "spine" ? C.warn : C.cyan, 16);
    this.boom(e.x, e.z, e.hop, e.kind === "walker" || e.kind === "spine" ? 1.4 : 0.9, e.kind === "spine" ? "ion" : "fire");
    this.combo += 1;
    this.comboTimer = 2.15;
    const base = KILL_SCORE[e.kind] ?? 100;
    const mult = Math.min(4, 1 + this.combo * 0.12);
    const gained = Math.round(base * mult);
    this.score += gained;
    this.scrap += e.scrap ?? 2;
    this.popScore(e.x, e.z, e.hop, this.combo > 1 ? `${gained} x${this.combo}` : `+${gained}`);
    this.shake = Math.max(this.shake, 3);
    this.hitStop = Math.max(this.hitStop, e.kind === "walker" || e.kind === "spine" ? 0.07 : 0.03);
    sfx.kill();
    if (this.combo === 5 || this.combo === 10 || this.combo === 15) sfx.combo();
    if (e.kind === "spine") {
      this.level.spinesDown += 1;
      this.announce(`SPINE SEVERED ${this.level.spinesDown}/${this.level.spinesNeeded}`);
      if (this.level.spinesDown === 1) this.fireSetPiece("shear");
      if (this.level.spinesDown >= this.level.spinesNeeded) {
        this.unlockPrimeArena();
      }
    }
    if (e.kind === "mine") {
      for (const o of this.enemies) {
        if (o.dead || o.kind !== "mine") continue;
        if (Math.hypot(o.x - e.x, (o.z - e.z) * 80) < 120) {
          this.killEnemy(o);
        }
      }
    }
    if (e.kind === "hackbot" && e.stolenWpn) {
      this.pickups.push({
        x: e.x,
        z: e.z,
        hop: e.hop + 8,
        kind: e.stolenWpn,
        life: 8,
      });
    }
    if (Math.random() < 0.18 && e.kind !== "spine") {
      const pool: WeaponId[] = ["spread", "beam", "rocket", "flame", "rail"];
      this.pickups.push({
        x: e.x,
        z: e.z,
        hop: e.hop,
        kind: pool[Math.floor(Math.random() * pool.length)]!,
        life: 8,
      });
    } else if (Math.random() < 0.12) {
      this.pickups.push({ x: e.x, z: e.z, hop: e.hop, kind: "health", life: 8 });
    } else if (Math.random() < 0.42) {
      this.pickups.push({ x: e.x, z: e.z, hop: e.hop, kind: "scrap", life: 8 });
    }
  }

  private enemyShot(e: Actor, speed: number, dmg: number, heavy = false) {
    const t = actTier(this.levelId);
    const dx = this.player.x - e.x;
    const dzWorld = (this.player.z - e.z) * 180;
    const dh = this.player.hop + 12 - (e.hop + 10);
    const len = Math.hypot(dx, dzWorld, dh) || 1;
    this.spawnBullet({
      x: e.x,
      z: e.z,
      hop: e.hop + 10,
      vx: (dx / len) * speed * t.spd,
      vz: (dzWorld / len) * ((speed * t.spd) / 180),
      vHop: (dh / len) * speed * t.spd,
      r: heavy ? 5 : 3,
      dmg: dmg * t.dmg,
      life: 2.2,
      friendly: false,
      color: heavy ? C.pad : C.cyan,
      look: "hostile",
    });
  }

  private enemyLob(e: Actor, dmg: number) {
    const t = actTier(this.levelId);
    const dx = this.player.x - e.x;
    const flight = Math.max(0.55, Math.abs(dx) / 300);
    this.spawnBullet({
      x: e.x,
      z: e.z,
      hop: e.hop + 18,
      vx: dx / flight,
      vz: (this.player.z - e.z) / flight,
      vHop: 220,
      grav: 520,
      r: 6,
      dmg: dmg * t.dmg,
      life: 2.6,
      friendly: false,
      color: C.pad,
      blast: 32,
      look: "rocket",
    });
  }

  private updateEnemy(e: Actor, dt: number) {
    e.flash = Math.max(0, e.flash - dt);
    if (e.stun && e.stun > 0) {
      e.stun -= dt;
      e.z = clamp(e.z, this.laneMin, this.laneMax);
      return;
    }
    e.timer += dt;
    const pz = this.player.z;
    const agg = this.intensity.aggression;
    const spd = actTier(this.levelId).spd;
    const fire = (base: number) => base / agg;
    const move = (base: number) => base * (0.75 + 0.35 * agg) * spd;
    const dist = Math.hypot(this.player.x - e.x, (pz - e.z) * 160, this.player.hop - e.hop);
    const telegraph = () => {
      e.flash = Math.max(e.flash, 0.22);
      sfx.telegraph();
    };

    switch (e.kind) {
      case "drone": {
        if (e.phase === 0) {
          e.hop += Math.sin(e.timer * 2) * 18 * dt;
          e.z += Math.sin(e.timer * 1.3) * 0.12 * dt;
          e.x += move(this.levelId === 1 ? -40 : -30) * dt;
          if (this.canFire(e, fire(1.35))) this.enemyShot(e, 240, 8);
          if (dist < 210 && e.timer > 0.4) {
            e.phase = 1;
            e.timer = 0;
            telegraph();
          }
        } else if (e.phase === 1) {
          e.hop += 12 * dt;
          if (e.timer > 0.32) {
            e.phase = 2;
            e.timer = 0;
            playAnim(e.anim, "attack", 0.25);
          }
        } else if (e.phase === 2) {
          e.x += Math.sign(this.player.x - e.x || -1) * move(220) * dt;
          e.z += (pz - e.z) * 3.2 * dt;
          e.hop += (this.player.hop - e.hop) * 3 * dt;
          if (e.timer > 0.55) {
            e.phase = 3;
            e.timer = 0;
          }
        } else {
          e.x += move(-50) * dt;
          e.hop += (40 - e.hop) * 2 * dt;
          if (e.timer > 0.85) {
            e.phase = 0;
            e.timer = 0;
          }
        }
        break;
      }
      case "climber": {
        e.hop += (this.player.hop - e.hop) * 1.4 * dt;
        e.z += (pz - e.z) * 0.7 * dt;
        if (e.phase === 0) {
          e.x += move(-36) * dt;
          if (this.canFire(e, fire(1.6))) this.enemyShot(e, 220, 7);
          if (dist < 170) {
            e.phase = 1;
            e.timer = 0;
            telegraph();
          }
        } else if (e.phase === 1) {
          if (e.timer > 0.28) {
            e.phase = 2;
            e.timer = 0;
            e.vHop = 180;
            playAnim(e.anim, "attack", 0.3);
          }
        } else {
          e.x += Math.sign(this.player.x - e.x || -1) * move(200) * dt;
          e.vHop -= 420 * dt;
          e.hop += e.vHop * dt;
          if (e.timer > 0.7) {
            e.phase = 0;
            e.timer = 0;
            e.vHop = 0;
          }
        }
        break;
      }
      case "gridsat": {
        if (e.phase === 9) {
          e.x += (this.player.x - e.x) * 2.6 * dt;
          e.z += (pz - e.z) * 2.6 * dt;
          e.hop += (this.player.hop - e.hop) * 2.2 * dt;
          e.flash = 0.2;
          if (dist < 44) {
            this.hurtPlayer(18);
            this.killEnemy(e);
            sfx.explode();
          }
          break;
        }
        e.hop += Math.sin(e.timer * 2) * 14 * dt;
        e.x += move(-28) * dt;
        const pack = this.enemies.filter(
          (o) => !o.dead && o.kind === "gridsat" && o.phase !== 9 && Math.abs(o.x - e.x) < 170,
        ).length;
        if (pack >= 2) {
          const aligned = Math.floor(this.level.elapsed / fire(1.05));
          if (aligned !== Math.floor((this.level.elapsed - dt) / fire(1.05))) {
            this.enemyShot(e, 280, 9);
            playAnim(e.anim, "attack", 0.2);
          }
        } else if (this.canFire(e, fire(1.2))) {
          this.enemyShot(e, 250, 8);
        }
        break;
      }
      case "ghost": {
        e.revealed = Math.max(0, (e.revealed ?? 0) - dt);
        if (e.phase === 0) {
          e.x += move(-24) * dt;
          e.hop += Math.sin(e.timer * 2) * 10 * dt;
          if (e.timer > fire(1.4)) {
            e.phase = 1;
            e.timer = 0;
            e.x = this.player.x - this.player.facing * 78;
            e.z = pz;
            e.hop = this.player.hop + 8;
            e.revealed = 1.15;
            telegraph();
          }
        } else {
          if (e.timer > 0.18 && e.timer < 0.22) this.enemyShot(e, 260, 10);
          if (e.timer > 0.7) {
            e.phase = 0;
            e.timer = 0;
            e.revealed = 0.25;
          }
        }
        break;
      }
      case "crab": {
        if (e.phase === 0) {
          e.x += move(-55) * dt;
          e.z += (pz - e.z) * 0.9 * dt;
          if (dist < 180) {
            e.phase = 1;
            e.timer = 0;
            telegraph();
          }
        } else if (e.phase === 1) {
          e.x += move(-12) * dt;
          if (e.timer > 0.38) {
            e.phase = 2;
            e.timer = 0;
            e.vHop = 320;
            playAnim(e.anim, "attack", 0.35);
          }
        } else {
          e.x += Math.sign(this.player.x - e.x || -1) * move(210) * dt;
          e.z += (pz - e.z) * 4 * dt;
          e.vHop -= 780 * dt;
          e.hop += e.vHop * dt;
          if (e.hop <= 0) {
            e.hop = 0;
            e.vHop = 0;
            e.phase = 0;
            e.timer = 0;
          }
        }
        break;
      }
      case "turret":
        if (this.canFire(e, fire(1.35))) {
          this.enemyLob(e, 12);
          playAnim(e.anim, "attack", 0.25);
        }
        break;
      case "hackbot":
        if (e.phase >= 3) {
          const away = Math.sign(e.x - this.player.x) || 1;
          e.x += away * move(110) * dt;
          e.z += (0.5 - e.z) * dt;
        } else {
          e.x += Math.sign(this.player.x - e.x) * move(70) * dt;
          e.z += (pz - e.z) * 1.4 * dt;
          if (
            dist < 50 &&
            zOverlap(pz, e.z, 0.22)
          ) {
            if (this.weapon !== "pistol" && !e.stolenWpn) {
              e.stolenWpn = this.weapon;
              this.weapon = "pistol";
              this.ammo = 999;
              e.phase = 3;
              this.cue("WEAPON STOLEN — chase the hackbot!", 2.2);
              sfx.warn();
            }
            this.hurtPlayer(8);
          }
        }
        break;
      case "walker": {
        const truck = this.truck;
        const clamping =
          !!truck &&
          !truck.arrived &&
          Math.abs(e.x - truck.x) < 86 &&
          zOverlap(e.z, truck.z, 0.3);
        if (clamping) {
          truck.clamped = true;
          e.x += (truck.x + 40 - e.x) * 3 * dt;
          e.z += (truck.z - e.z) * 3 * dt;
          this.fireSetPiece("walker-clamp");
          if (this.canFire(e, fire(1.4))) this.enemyShot(e, 300, 12, true);
        } else {
          e.x += move(-35) * dt;
          e.z += (pz - e.z) * 0.4 * dt;
          if (dist > 260) {
            if (this.canFire(e, fire(1.7))) this.enemyLob(e, 16);
          } else if (this.canFire(e, fire(1.15))) {
            this.enemyShot(e, 320, 14, true);
          }
        }
        break;
      }
      case "wasp":
        e.x += (this.player.x - e.x > 40 ? move(-40) : move(-110)) * dt;
        e.x += Math.sign(this.player.x - e.x) * move(70) * dt * 0.35;
        e.z += (pz - e.z) * 1.6 * dt;
        e.hop += (this.player.hop - e.hop) * 1.3 * dt;
        if (this.canFire(e, fire(1.45))) this.enemyShot(e, 200, 10);
        break;
      case "mine":
        e.hop += Math.sin(e.timer) * 6 * dt;
        if (dist < 55 && zOverlap(pz, e.z, 0.25)) {
          this.burst(e.x, e.z, e.hop, C.blood, 18);
          this.hurtPlayer(22);
          this.killEnemy(e);
          sfx.explode();
        }
        break;
      case "tether": {
        e.hop += Math.sin(e.timer * 2.4) * 10 * dt;
        e.x += move(this.levelId === 1 ? -28 : -22) * dt;
        e.z += Math.sin(e.timer * 0.9) * 0.08 * dt;
        const pull = 1 / Math.max(1, dist / 90);
        this.player.vx += ((e.x - this.player.x) / Math.max(40, dist)) * 140 * pull * dt;
        this.player.vz += (e.z - this.player.z) * 1.8 * pull * dt;
        if (this.player.kind === "ship") {
          this.player.x += Math.sign(e.x - this.player.x) * 28 * pull * dt;
        }
        if (Math.floor(this.level.elapsed * 1.4) !== Math.floor((this.level.elapsed - dt) * 1.4)) {
          sfx.tether();
        }
        break;
      }
      case "mirror":
        e.x += move(-25) * dt;
        e.z += Math.sin(e.timer) * 0.1 * dt;
        break;
      case "beetle": {
        let best: Actor | null = null;
        let bestD = Infinity;
        for (const o of this.enemies) {
          if (o.dead || o.kind !== "spine") continue;
          const d = Math.hypot(o.x - e.x, (o.z - e.z) * 160);
          if (d < bestD) {
            bestD = d;
            best = o;
          }
        }
        if (best) {
          e.x += Math.sign(best.x - e.x) * move(55) * dt;
          e.z += (best.z - e.z) * 1.6 * dt;
          if (bestD < 90 && this.canFire(e, fire(1.15))) {
            best.hp = Math.min(best.maxHp, best.hp + 14);
            best.flash = 0.18;
            this.burst(best.x, best.z, best.hop, C.warn, 6);
            sfx.heal();
          }
        } else {
          e.x += move(-40) * dt;
        }
        break;
      }
      case "spine":
        e.hop += Math.sin(e.timer * 1.2) * 8 * dt;
        if (this.canFire(e, fire(this.spineArmored(e) ? 2.1 : 1.55))) this.enemyShot(e, 250, 12);
        break;
    }

    e.z = clamp(e.z, this.laneMin, this.laneMax);
    const ghostHidden = e.kind === "ghost" && (e.revealed ?? 0) <= 0;
    const ram =
      e.kind === "wasp" || e.kind === "climber" || (e.kind === "drone" && e.phase === 2);
    if (
      e.kind !== "tether" &&
      !ghostHidden &&
      zOverlap(this.player.z, e.z, 0.2) &&
      Math.hypot(this.player.x - e.x, this.player.hop - e.hop) < 36
    ) {
      this.hurtPlayer(e.kind === "walker" ? 18 : ram ? 14 : 10);
    }
    if (e.kind !== "spine" && e.x < this.camX - 100) e.dead = true;
  }

  private updateBoss(dt: number) {
    const b = this.boss;
    if (!b || b.dead) return;
    b.flash = Math.max(0, b.flash - dt);
    if (b.stun && b.stun > 0) {
      b.stun -= dt;
      return;
    }
    b.timer += dt;
    const ratio = b.hp / b.maxHp;
    const nextPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (nextPhase !== b.phase) {
      b.phase = nextPhase;
      this.announce(
        b.kind === "reaper"
          ? b.phase === 2
            ? "REAPER · LASER SWEEP — CHANGE DEPTH"
            : "REAPER · CLAW EMBED — CORE OPEN"
          : b.kind === "seraph"
            ? b.phase === 3
              ? "SERAPH · SPEAR FROM AFT"
              : "SERAPH · MIRROR WINGS"
            : b.phase === 3
              ? "PRIME · EVA THE CORE"
              : "PRIME · PETAL SHIELD",
        2.2,
      );
      sfx.boss();
      this.shake = 8;
      if (b.kind === "reaper" && b.phase === 3) this.fireSetPiece("deck-slam");
      if (b.kind === "prime" && b.phase === 3) this.fireSetPiece("arena-shrink");
      b.timer = 0;
    }
    b.z = clamp(0.45 + Math.sin(b.timer * 0.7) * 0.12, this.laneMin, this.laneMax);

    if (b.kind === "reaper") {
      b.x = BOARD_X - 20 + Math.sin(b.timer * 0.5) * 30;
      b.hop = BOARD_HOP - 20;
      if (b.phase === 1) {
        if (b.timer > 1.5) {
          b.timer = 0;
          this.enemyShot(b, 280, 14, true);
        }
      } else if (b.phase === 2) {
        if (!this.laserSweep && b.timer > 1.15) {
          b.timer = 0;
          this.laserSweep = { z: 0.1, vz: 0.52, life: 1.65 };
          sfx.laser();
          this.cue("LASER SWEEP — hop or change depth", 1.5);
          if (Math.random() < 0.5) this.spawnEnemy("drone", b.x - 100, 0.5, 40);
        }
      } else if (b.timer > 1.25) {
        b.timer = 0;
        this.announce("CLAW!", 0.55);
        this.spawnBullet({
          x: this.player.x,
          z: this.player.z,
          hop: 150,
          vx: 0,
          vz: 0,
          vHop: -480,
          r: 9,
          dmg: 24,
          life: 1.15,
          friendly: false,
          color: C.warn,
          blast: 44,
          look: "claw",
        });
      }
    } else if (b.kind === "seraph") {
      if (b.phase < 3) {
        b.x = this.camX + W - 160;
        b.z += (this.player.z - b.z) * 1.8 * dt;
        b.hop += (this.player.hop - b.hop) * 1.1 * dt;
        if (b.timer > 1.1) {
          b.timer = 0;
          for (let i = 0; i < b.phase + 1; i++) this.enemyShot(b, 310, 12);
          if (b.phase === 2) this.spawnEnemy("climber", b.x - 80, 0.5, 20);
        }
      } else if (b.timer < 0.7) {
        b.x += (this.camX + W + 90 - b.x) * 5 * dt;
        b.flash = 0.2;
      } else if (b.timer < 0.82) {
        if (b.x > this.camX + W * 0.7) {
          b.x = this.camX - 70;
          b.z = this.player.z;
          b.hop = this.player.hop;
          sfx.telegraph();
          this.cue("SERAPH AFT — SPEAR", 1.1);
        }
      } else if (b.timer < 1.9) {
        b.x += 640 * dt;
      } else {
        b.timer = 0;
        b.x = this.camX + W - 160;
      }
    } else if (b.kind === "prime") {
      b.x = this.camX + W - 200;
      b.hop = 40 + Math.sin(b.timer * 0.5) * 20;
      const period = b.phase === 3 ? 0.7 : 1.05;
      if (b.timer > period) {
        b.timer = 0;
        const n = 6 + b.phase * 2;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          this.spawnBullet({
            x: b.x,
            z: clamp(b.z + Math.cos(a) * 0.2, this.laneMin, this.laneMax),
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
          if (b.phase === 3) {
            const last = this.enemies[this.enemies.length - 1];
            if (last) last.phase = 9;
          }
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
    truck.clamped = this.enemies.some(
      (e) => !e.dead && e.kind === "walker" && Math.abs(e.x - truck.x) < 86 && zOverlap(e.z, truck.z, 0.3),
    );
    truck.moving = this.level.goalPhase === 1 && !truck.clamped;
    if (truck.moving) {
      const gap = this.player.x - truck.x;
      const speed = gap > 40 ? Math.min(250, 90 + (gap - 40) * 1.8) : 70;
      truck.x += speed * dt;
      truck.z += (this.player.z - truck.z) * 1.8 * dt;
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
      if (!g.hit && this.player.x > g.x + 90) {
        g.x = this.player.x + 380 + Math.random() * 80;
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
    this.player.flash = Math.max(0, this.player.flash - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    if (this.comboTimer <= 0) this.combo = 0;
    this.screenFlash = Math.max(0, this.screenFlash - dt * 2.4);
    this.empPulse = Math.max(0, this.empPulse - dt * 1.6);
    this.muzzle = Math.max(0, this.muzzle - dt);
    this.hintT += dt;
    this.lowHpWarn += dt;
    this.lightning = Math.max(0, this.lightning - dt * 3.2);
    this.twistCueT = Math.max(0, this.twistCueT - dt);
    if (this.twistCueT <= 0) this.twistCue = "";
    this.stageSepLock = Math.max(0, this.stageSepLock - dt);
    if (this.shearLife > 0) {
      this.shearLife = Math.max(0, this.shearLife - dt);
      this.gScale = 0.38;
      if (this.shearLife <= 0) this.gScale = 1;
    }
    if (this.laserSweep) {
      this.laserSweep.z += this.laserSweep.vz * dt;
      this.laserSweep.life -= dt;
      if (this.laserSweep.z > 0.9 || this.laserSweep.z < 0.1) this.laserSweep.vz *= -1;
      if (
        Math.abs(this.player.z - this.laserSweep.z) < 0.09 &&
        this.player.hop < 52
      ) {
        this.hurtPlayer(16);
      }
      if (this.laserSweep.life <= 0) {
        this.laserSweep = null;
        if (this.boss && this.boss.kind === "reaper") this.boss.timer = 0;
      }
    }
    if (this.levelId === 1 && this.bgThreat > 0.35 && Math.random() < 0.012 + this.bgThreat * 0.02) {
      this.lightning = 1;
    }
    const mob = 1 + this.upgrades.mobility * 0.08;

    if (this.levelId === 1) {
      const prevClock = this.level.killClock;
      this.level.killClock = Math.max(0, this.level.killClock - dt);
      if (
        this.level.killClock < 12 &&
        this.level.killClock > 0 &&
        Math.ceil(this.level.killClock) !== Math.ceil(prevClock)
      ) {
        sfx.warn();
      }
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
        ready =
          this.level.goalPhase === 2 &&
          this.level.gatesCleared >= this.gates.length &&
          this.stageSepLock <= 0;
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
      const { ax, az } = this.axes();
      const targetVx = ax * 220 * mob;
      const rate = ax !== 0 ? 14 : 18;
      this.player.vx += (targetVx - this.player.vx) * (1 - Math.exp(-rate * dt));
      this.player.vz = az * 0.55 * mob;
      if (ax) this.player.facing = ax > 0 ? 1 : -1;
      this.player.vHop -= 1400 * this.gScale * dt;
      if (this.input.jumpJust()) this.jumpBuf = 0.14;
      else this.jumpBuf = Math.max(0, this.jumpBuf - dt);
      this.coyote = this.player.grounded ? 0.12 : Math.max(0, this.coyote - dt);
      if (this.jumpBuf > 0 && this.coyote > 0) {
        this.player.vHop = 520;
        this.player.grounded = false;
        this.coyote = 0;
        this.jumpBuf = 0;
        sfx.jump();
      }
      this.player.x += this.player.vx * dt;
      this.player.z = clamp(this.player.z + this.player.vz * dt, this.laneMin, this.laneMax);
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
          !(this.deckSlamX !== null && Math.abs(p.x - this.deckSlamX) < 24) &&
          zOverlap(this.player.z, p.z, 0.35) &&
          this.player.hop <= p.hop + 8 &&
          this.player.hop >= p.hop - 22
        ) {
          this.player.hop = p.hop;
          this.player.vHop = 0;
          onGround = true;
          this.player.z += (p.z - this.player.z) * 0.35;
        }
      }
      if (onGround && !this.player.grounded) {
        this.burst(this.player.x, this.player.z, 0, C.metal, 6);
        this.landSquash = 0.12;
        sfx.land();
      }
      this.player.grounded = onGround;
      this.landSquash = Math.max(0, this.landSquash - dt);
      this.player.x = clamp(this.player.x, 40, this.level.length - 40);
      const look = this.player.facing * 70;
      this.camXTarget = clamp(this.player.x - W * 0.36 + look, 0, this.level.length - W);
      this.camX += (this.camXTarget - this.camX) * (1 - Math.exp(-7 * dt));
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
      const { ax, az } = this.axes();
      const tvx = ax * 230 * mob;
      const tvz = az * 0.72 * mob;
      this.player.vx += (tvx - this.player.vx) * (1 - Math.exp(-11 * dt));
      this.player.vz += (tvz - this.player.vz) * (1 - Math.exp(-11 * dt));
      this.shipThrust = Math.hypot(ax, az) > 0.12 ? 1 : 0.35;
      const padL = isTouchPrimary() ? 90 : 60;
      const padR = isTouchPrimary() ? 130 : 80;
      this.player.x = clamp(this.player.x + this.player.vx * dt, this.camX + padL, this.camX + W - padR);
      this.player.z = clamp(this.player.z + this.player.vz * dt, this.laneMin, this.laneMax);
      this.player.hop = 30 + (1 - this.player.z) * 50;
      this.camLean += (az * 0.1 - this.camLean) * 5 * dt;
      for (const g of this.gates) {
        if (g.vz) {
          g.z += g.vz * dt;
          if (g.z < 0.16 || g.z > 0.84) g.vz *= -1;
        }
      }
      for (const r of this.circRings) {
        if (r.vz) {
          r.z += r.vz * dt;
          if (r.z < 0.18 || r.z > 0.82) r.vz *= -1;
        }
      }
      if (this.shipThrust > 0.6 && this.frame % 2 === 0) {
        this.particles.push({
          x: this.player.x - 22,
          z: this.player.z,
          hop: this.player.hop,
          vx: -80 - Math.random() * 40,
          vz: (Math.random() - 0.5) * 0.1,
          vHop: (Math.random() - 0.5) * 20,
          life: 0.25,
          color: Math.random() > 0.5 ? C.pad : C.warn,
          size: 3,
          kind: "ember",
        });
      }

      for (const g of this.gates) {
        if (!g.hit && Math.abs(this.player.x - g.x) < 88 && zOverlap(this.player.z, g.z, 0.24)) {
          g.hit = true;
          this.level.gatesCleared++;
          this.scrap += 5;
          this.score += 250;
          this.popScore(this.player.x, this.player.z, this.player.hop, "+GATE");
          this.announce(`GATE ${this.level.gatesCleared}/${this.gates.length} · ${laneLabel(g.z)}`);
          this.burst(this.player.x, this.player.z, this.player.hop, C.warn, 10);
          sfx.gate();
          if (this.level.gatesCleared >= this.gates.length) {
            this.setGoalPhase2();
            this.announce("NIX: Corridor clean — SERAPH inbound ahead!", 2.8);
          }
        }
      }
      for (const ring of this.circRings) {
        if (
          !ring.hit &&
          Math.abs(this.player.x - ring.x) < 80 &&
          zOverlap(this.player.z, ring.z, 0.28)
        ) {
          ring.hit = true;
          this.level.circCleared++;
          this.scrap += 6;
          this.score += 300;
          this.popScore(this.player.x, this.player.z, this.player.hop, "+CIRC");
          this.announce(
            `CIRC ${this.level.circCleared}/${this.level.circNeeded} · ${laneLabel(ring.z)}`,
          );
          this.burst(this.player.x, this.player.z, this.player.hop, C.cyan, 12);
          sfx.gate();
          if (this.level.circCleared >= this.level.circNeeded) {
            this.mode = "clear";
            this.announce("LEO INSERTION · CLEAN", 3);
            this.score += 1500;
          }
        }
      }
    } else {
      // EVA — hold JUMP for thrust, S/stick-down still depth; hop damps with dt
      if (this.level.goalPhase === 2) this.level.scroll += 40 * dt;
      const { ax, az } = this.axes();
      this.player.vx += ax * 420 * dt * mob;
      this.player.vz += az * 0.9 * dt * mob;
      const drag = Math.exp(-2.4 * dt);
      this.player.vx *= drag;
      this.player.vz *= drag;
      if (this.input.jumpHeld()) this.player.vHop += 520 * dt * mob;
      else this.player.vHop -= 260 * dt;
      if (this.input.jumpJust()) sfx.jump();
      if (this.shearLife > 0) {
        this.player.vx += Math.sin(this.level.elapsed * 2.2) * 150 * dt;
        this.player.vz += Math.cos(this.level.elapsed * 1.7) * 0.16 * dt;
      }
      if (this.input.jumpHeld() && this.frame % 2 === 0) {
        this.particles.push({
          x: this.player.x,
          z: this.player.z,
          hop: this.player.hop - 8,
          vx: (Math.random() - 0.5) * 20,
          vz: 0,
          vHop: -40 - Math.random() * 30,
          life: 0.22,
          color: C.cyan,
          size: 2,
          kind: "ember",
        });
      }
      if (ax) this.player.facing = ax > 0 ? 1 : -1;
      this.player.x += this.player.vx * dt;
      this.player.z = clamp(this.player.z + this.player.vz * dt, this.laneMin, this.laneMax);
      this.player.hop = clamp(this.player.hop + this.player.vHop * dt, 0, 160);
      this.player.x = clamp(this.player.x, 40, this.level.length - 40);
      this.camXTarget = clamp(
        this.player.x - W * 0.4,
        0,
        Math.max(this.level.length - W, this.level.scroll),
      );
      if (this.level.goalPhase === 2) this.camXTarget = Math.max(this.camXTarget, this.level.scroll);
      this.camX += (this.camXTarget - this.camX) * (1 - Math.exp(-6 * dt));
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
    const shooting = this.input.shoot();
    if (this.weapon === "rail") {
      if (shooting) this.railCharge = Math.min(1.15, this.railCharge + dt);
      else if (this.wasShooting && this.railCharge > 0.15) {
        this.fireRail(this.railCharge);
        this.railCharge = 0;
      } else this.railCharge = 0;
    } else if (shooting) this.fireWeapon();
    this.wasShooting = shooting;
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
      if (b.grav) b.vHop -= b.grav * dt;
      b.hop += b.vHop * dt;
      b.life -= dt;
      if (b.grav && b.hop < 0) {
        b.hop = 0;
        b.life = 0;
        if (b.blast) this.aoe(b.x, b.z, 0, b.blast, b.dmg * 0.55);
        if (
          zOverlap(this.player.z, b.z, 0.3) &&
          Math.hypot(this.player.x - b.x, this.player.hop) < 42
        ) {
          this.hurtPlayer(b.dmg);
        }
      }
      if (b.friendly) {
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (b.hits.has(e.uid)) continue;
          if (this.shotHitsActor(b, e)) {
            if (e.kind === "mirror" && !(e.stun && e.stun > 0) && Math.random() < 0.55) {
              b.vx *= -1;
              b.friendly = false;
              b.color = C.blood;
              e.stun = 0.35;
              continue;
            }
            let dmg = b.dmg;
            if (e.kind === "walker" && this.player.x > e.x) dmg *= 1.85;
            if (e.kind === "spine" && this.spineArmored(e)) dmg *= 0.35;
            e.hp -= dmg;
            e.flash = 0.06;
            b.hits.add(e.uid);
            this.sparkHit(b.x, b.z, b.hop, b.look);
            sfx.hit(b.look);
            if (!b.pierce) b.life = 0;
            if (b.blast) this.aoe(b.x, b.z, b.hop, b.blast, b.dmg * 0.6, e.uid);
            if (e.hp <= 0) this.killEnemy(e);
            if (!b.pierce) break;
          }
        }
        if (this.boss && !this.boss.dead && b.life > 0) {
          const boss = this.boss;
          if (!b.hits.has(boss.uid)) {
            if (
              zOverlap(b.z, boss.z, 0.35) &&
              Math.hypot(b.x - boss.x, b.hop - boss.hop) < this.hitRadius(boss)
            ) {
              let dmg = b.dmg;
              if (boss.kind === "prime" && boss.phase === 2) dmg *= 0.4;
              if (boss.kind === "prime" && boss.phase === 3) {
                const close =
                  Math.hypot(this.player.x - boss.x, (this.player.z - boss.z) * 160) < 120;
                const high = this.player.hop > 42;
                dmg *= close && high ? 2.15 : 0.42;
              }
              if (boss.kind === "reaper" && boss.phase < 3) dmg *= 0.7;
              if (boss.kind === "seraph" && boss.phase < 3) dmg *= 0.75;
              boss.hp -= dmg;
              boss.flash = 0.06;
              b.hits.add(boss.uid);
              if (!b.pierce) b.life = 0;
              this.sparkHit(b.x, b.z, b.hop, b.look);
              sfx.hit(b.look);
              if (boss.hp <= 0) {
                boss.dead = true;
                this.level.bossDefeated = true;
                this.burst(boss.x, boss.z, boss.hop, C.cyan, 40);
                this.boom(boss.x, boss.z, boss.hop, 2.4, "ion");
                this.scrap += boss.scrap ?? 40;
                this.score += 2500;
                this.popScore(boss.x, boss.z, boss.hop, "+2500", C.cyan);
                this.shake = 16;
                this.hitStop = 0.16;
                sfx.explode();
                if (this.levelId === 2) {
                  this.circRings = [
                    { x: this.player.x + 280, z: 0.35, hit: false, vz: 0.11 },
                    { x: this.player.x + 520, z: 0.65, hit: false, vz: -0.13 },
                    { x: this.player.x + 760, z: 0.45, hit: false, vz: 0.1 },
                  ];
                  this.level.circCleared = 0;
                  this.fireSetPiece("circ-drift");
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
        }
      } else if (
        b.life > 0 &&
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
      const pull = Math.hypot(
        this.player.x - p.x,
        (this.player.z - p.z) * 160,
        this.player.hop - p.hop,
      );
      if (pull < 120) {
        const k = 6 * dt;
        p.x += (this.player.x - p.x) * k;
        p.z += (this.player.z - p.z) * k;
        p.hop += (this.player.hop - p.hop) * k * 0.4;
      }
      if (
        zOverlap(this.player.z, p.z, 0.25) &&
        Math.hypot(this.player.x - p.x, this.player.hop - p.hop) < 36
      ) {
        if (p.kind === "scrap") {
          this.scrap += 4;
          this.score += 40;
          this.announce("+SCRAP");
          sfx.pickup();
        } else if (p.kind === "health") {
          const heal = 40 + this.upgrades.armor * 4;
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
          this.announce(`+${heal} HP`);
          this.popScore(p.x, p.z, p.hop, `+${heal} HP`, C.pad);
          sfx.heal();
        } else {
          const incoming = WEAPON_RANK[p.kind];
          const current = WEAPON_RANK[this.weapon];
          if (incoming < current && this.ammo > 12 && this.weapon !== "pistol") {
            this.announce(`LEFT ${WEAPONS[p.kind].name}`);
          } else {
            this.weapon = p.kind;
            this.ammo = 40 + this.upgrades.mag * 15;
            this.announce(WEAPONS[p.kind].name);
          }
          sfx.pickup();
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
    for (const b of this.booms) b.life -= dt;
    this.booms = this.booms.filter((b) => b.life > 0);
    for (const s of this.impacts) s.life -= dt;
    this.impacts = this.impacts.filter((s) => s.life > 0);
    for (const pop of this.scorePops) {
      pop.life -= dt;
      pop.hop += 28 * dt;
    }
    this.scorePops = this.scorePops.filter((p) => p.life > 0);

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
          sfx.pickup();
          this.popScore(tech.x, tech.z, 20, "+300");
        }
      }
    }
  }

  private aoe(x: number, z: number, hop: number, r: number, dmg: number, skipUid?: number) {
    this.burst(x, z, hop, C.pad, 16);
    this.boom(x, z, hop, 1.2, "fire");
    sfx.explode();
    for (const e of this.enemies) {
      if (e.dead || e.uid === skipUid) continue;
      if (Math.hypot(e.x - x, (e.z - z) * 160) < r && zOverlap(e.z, z, 0.35)) {
        e.hp -= dmg;
        e.flash = 0.1;
        if (e.hp <= 0) this.killEnemy(e);
      }
    }
  }

  private update(dt: number) {
    if (this.mode === "play" || this.mode === "boss") {
      if (this.input.pauseJust() || this.input.just("escape")) {
        this.pausedFrom = this.mode;
        this.mode = "pause";
        sfx.ui();
        return;
      }
    }
    music.tick(
      dt,
      this.bgThreat,
      this.mode === "play" || this.mode === "boss",
    );
    if (this.mode === "pause") {
      if (this.input.confirm() || this.input.pauseJust()) {
        this.mode = this.pausedFrom ?? "play";
        this.pausedFrom = null;
        sfx.ui();
      } else if (this.input.back()) {
        this.mode = "title";
        this.pausedFrom = null;
        sfx.ui();
      }
      return;
    }
    if (this.mode === "howto") {
      if (this.input.confirm() || this.input.back()) {
        this.mode = "title";
        sfx.ui();
      }
      return;
    }
    if (this.mode === "title") {
      const nav = this.input.menuNav();
      if (nav === 1) this.menuIndex = (this.menuIndex + 1) % 4;
      if (nav === -1) this.menuIndex = (this.menuIndex + 3) % 4;
      if (this.input.confirm()) {
        sfx.confirm();
        this.scrap = 0;
        this.upgrades = defaultUpgrades();
        this.totalScore = 0;
        this.continues = 0;
        if (this.menuIndex === 1) {
          this.mode = "howto";
          return;
        }
        const id = (this.menuIndex === 0 ? 1 : this.menuIndex === 2 ? 2 : 3) as LevelId;
        this.beginLevel(id);
      }
      return;
    }
    if (this.mode === "briefing") {
      if (this.input.confirm()) {
        this.mode = "play";
        this.announce("GO!", 1);
        sfx.confirm();
      }
      if (this.input.back()) this.mode = "title";
      return;
    }
    if (this.mode === "upgrade") {
      const nav = this.input.menuNav();
      if (nav === 1) this.upgradeIndex = (this.upgradeIndex + 1) % 7;
      if (nav === -1) this.upgradeIndex = (this.upgradeIndex + 6) % 7;
      if (this.input.back()) {
        this.mode = "title";
        return;
      }
      if (this.input.confirm()) {
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
          if (this.upgrades[pick] >= 5) {
            this.announce("MAXED");
          } else {
            const cost = 8 + this.upgrades[pick] * 6;
            if (this.scrap >= cost) {
              this.scrap -= cost;
              this.upgrades[pick] += 1;
              this.announce(`UPGRADED ${pick.toUpperCase()}`);
              sfx.pickup();
            } else this.announce("NEED MORE SCRAP");
          }
        }
      }
      return;
    }
    if (this.mode === "clear") {
      this.msgTimer -= dt;
      if (this.input.confirm() || this.msgTimer < -1) {
        this.totalScore += this.score;
        this.score = 0;
        this.bestScore = Math.max(this.bestScore, this.totalScore);
        writeBest(this.bestScore);
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
      if (this.input.confirm()) {
        this.continues += 1;
        this.beginLevel(this.levelId);
      }
      if (this.input.back()) this.mode = "title";
      return;
    }
    if (this.mode === "victory") {
      if (this.input.confirm() || this.input.back()) this.mode = "title";
      return;
    }
    if (this.mode === "play" || this.mode === "boss") this.updatePlay(dt);
  }

  private renderBg() {
    const ctx = this.ctx;
    const kind = this.levelId === 1 ? "pad" : this.levelId === 2 ? "sky" : "void";
    const threat = this.bgThreat;
    ctx.fillStyle = C.void;
    ctx.fillRect(0, 0, W, H);

    if (this.levelId === 1) {
      const horizon = this.stage.farGroundY;
      const band = { destY: 0, destH: horizon, srcTop: 0, srcFrac: 0.62 };
      blitParallaxEvolve(
        ctx,
        art.bg("l1-sky-calm") ?? art.bg("l1-sky"),
        art.bg("l1-sky-peak"),
        this.camX,
        0.12,
        threat,
        0,
        band,
      );
      blitParallaxEvolve(
        ctx,
        art.bg("l1-mid-calm") ?? art.bg("l1-mid"),
        art.bg("l1-mid-peak"),
        this.camX,
        0.35,
        threat,
        0,
        { destY: 0, destH: horizon, srcTop: 0.06, srcFrac: 0.56 },
      );
      drawSodiumPools(ctx, this.camX, threat);
      drawRain(ctx, this.frame, threat, this.camX);
      drawLightning(ctx, this.lightning);
    } else if (this.levelId === 2) {
      const horizon = this.stage.farGroundY;
      blitParallaxEvolve(
        ctx,
        art.bg("l2-ascent-calm") ?? art.bg("l2-ascent"),
        art.bg("l2-ascent-peak"),
        this.camX,
        0.2,
        threat,
        0,
        { destY: 0, destH: horizon, srcTop: 0, srcFrac: 0.58 },
      );
      const alt = this.level.scroll / this.level.length;
      ctx.fillStyle = `rgba(5,7,14,${Math.min(0.35, alt * 0.28 + threat * 0.18)})`;
      ctx.fillRect(0, 0, W, H * 0.28);
      drawHeatHaze(ctx, this.frame, threat);
    } else {
      const horizon = this.stage.farGroundY;
      blitParallaxEvolve(
        ctx,
        art.bg("l3-void-calm") ?? art.bg("l3-void"),
        art.bg("l3-void-peak"),
        this.camX,
        0.1,
        threat,
        0,
        { destY: 0, destH: horizon, srcTop: 0, srcFrac: 0.6 },
      );
      drawStarTwinkle(ctx, this.frame);
      drawEarthLimb(ctx, this.frame);
    }

    this.renderThreatAtmosphere(threat);

    drawGroundDeck(ctx, this.stage, kind);
    drawDepthFog(ctx, this.stage);

    if (this.levelId === 1) this.renderL1Diaspora();
    if (this.levelId === 1) this.renderPad7Landmark();

    // platforms as raised deck plates / gantry stairs
    for (const p of this.level.platforms) {
      const sp = project({ x: p.x, z: p.z, hop: p.hop }, this.stage);
      if (sp.sx < -80 || sp.sx > W + 80) continue;
      const isGantry = this.towerReady && p.x >= GANTRY_START_X - 10;
      const slammed = this.deckSlamX !== null && Math.abs(p.x - this.deckSlamX) < 24;
      if (slammed) {
        drawDeckScar(ctx, sp.sx, sp.sy, p.w, sp.scale);
      } else if (isGantry) {
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

  /** Embers / ion haze / vignette that ramp with smoothed threat */
  private renderThreatAtmosphere(threat: number) {
    if (threat < 0.08) return;
    const ctx = this.ctx;
    const t = threat;

    // Warm wash — keep the painted plates readable
    ctx.fillStyle = `rgba(180, 40, 12, ${0.02 + t * 0.08})`;
    ctx.fillRect(0, 0, W, H * 0.55);

    const g = ctx.createRadialGradient(W / 2, H * 0.45, 80, W / 2, H * 0.5, 520);
    g.addColorStop(0, "transparent");
    g.addColorStop(1, `rgba(5, 4, 8, ${0.08 + t * 0.28})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Rising embers / debris sparks
    const n = Math.floor(6 + t * 28);
    for (let i = 0; i < n; i++) {
      const seed = i * 97.3;
      const x = ((seed * 13 + this.frame * (0.7 + t) + this.camX * 0.08) % (W + 40)) - 20;
      const y = H - ((seed * 7 + this.frame * (1.2 + t * 2.5)) % (H * 0.85));
      const a = 0.25 + t * 0.55;
      ctx.fillStyle =
        i % 3 === 0
          ? `rgba(232, 93, 4, ${a})`
          : i % 3 === 1
            ? `rgba(244, 211, 94, ${a * 0.85})`
            : `rgba(46, 196, 182, ${a * 0.5})`;
      ctx.fillRect(x, y, 2, 2 + (i % 2));
    }

    // Occasional distant flash bloom when threat is high
    if (t > 0.55 && Math.sin(this.frame * 0.11 + t * 4) > 0.92) {
      glow(ctx, W * (0.2 + (this.frame % 7) * 0.1), H * 0.3, 90 + t * 40, C.pad, 0.12 + t * 0.1);
    }
  }

  /**
   * SpaceX/Tesla diaspora wreckage + rare cybertruck pass —
   * dystopian race-to-orbit midground for Earth Escape.
   */
  private renderL1Diaspora() {
    const ctx = this.ctx;
    const wrecks: {
      x: number;
      z: number;
      kind: "wreck-starship" | "wreck-dragon" | "wreck-booster";
      h: number;
      facing?: 1 | -1;
    }[] = [
      { x: 340, z: 0.88, kind: "wreck-booster", h: 120 },
      { x: 680, z: 0.82, kind: "wreck-dragon", h: 100, facing: -1 },
      { x: 980, z: 0.9, kind: "wreck-starship", h: 160 },
      { x: 1320, z: 0.78, kind: "wreck-booster", h: 110, facing: -1 },
      { x: 1680, z: 0.86, kind: "wreck-dragon", h: 105 },
      { x: 2050, z: 0.8, kind: "wreck-starship", h: 170, facing: -1 },
      { x: 2320, z: 0.88, kind: "wreck-booster", h: 115 },
    ];

    for (const w of wrecks) {
      const sp = project({ x: w.x, z: w.z, hop: 0 }, this.stage);
      if (sp.sx < -160 || sp.sx > W + 160) continue;
      const alpha = 0.55 + (1 - w.z) * 0.35;
      blitSprite(ctx, art.sprite(w.kind), sp.sx, sp.sy - 8, {
        h: w.h,
        scale: sp.scale * 0.92,
        facing: w.facing ?? 1,
        alpha,
      });
    }

    // One cybertruck every ~2.5 minutes — brief on-screen pass, not a traffic jam
    const PERIOD = 150; // seconds between passes
    const CROSS = 11; // seconds visible while crossing
    const cycle = this.level.elapsed % PERIOD;
    if (cycle < CROSS) {
      const facing: 1 | -1 = Math.floor(this.level.elapsed / PERIOD) % 2 === 0 ? 1 : -1;
      const u = cycle / CROSS; // 0→1 across the pass
      const local = facing === 1 ? u * (W + 200) - 100 : (1 - u) * (W + 200) - 100;
      const wx = this.camX + local;
      const z = 0.9;
      const sp = project({ x: wx, z, hop: 0 }, this.stage);
      if (sp.sx > -120 && sp.sx < W + 120) {
        if (Math.floor(this.frame / 5) % 6 !== 0) {
          glow(ctx, sp.sx + facing * 18 * sp.scale, sp.sy - 8, 14 * sp.scale, C.warn, 0.18);
        }
        blitSprite(ctx, art.sprite("cybertruck"), sp.sx, sp.sy - 4, {
          h: 46,
          scale: sp.scale,
          facing,
          alpha: 0.7,
        });
      }
    }
  }

  /** Visible Pad 7 fuel-drop destination — massive painted spectacle */
  private renderPad7Landmark() {
    const ctx = this.ctx;
    const pulse = 0.5 + 0.5 * Math.sin(this.frame * 0.12);
    // Far scaffold layer slightly behind the pad proper
    const far = project({ x: PAD7_X + 30, z: 0.78, hop: 0 }, this.stage);
    if (far.sx > -200 && far.sx < W + 200) {
      blitSprite(ctx, art.sprite("pad7"), far.sx, far.sy - 20, {
        h: 220,
        scale: far.scale * 0.75,
        alpha: 0.45,
      });
    }

    const sp = project({ x: PAD7_X, z: 0.55, hop: 0 }, this.stage);
    const onScreen = sp.sx > -120 && sp.sx < W + 120;

    if (onScreen) {
      // Flame-trench bloom under the spectacle
      glow(ctx, sp.sx, sp.sy + 10, 90 * sp.scale, C.pad, 0.22 + pulse * 0.2);
      glow(ctx, sp.sx - 40 * sp.scale, sp.sy, 50 * sp.scale, C.warn, 0.12 + pulse * 0.1);
      drawShadow(ctx, sp, 70);
      const ok = blitSprite(ctx, art.sprite("pad7"), sp.sx, sp.sy - 18, {
        h: 280,
        scale: sp.scale,
      });
      if (!ok) drawPad7(ctx, sp.sx, sp.sy, sp.scale * 1.6, pulse);
      // Beacon wash
      glow(ctx, sp.sx, sp.sy - 120 * sp.scale, 55 * sp.scale, C.pad, 0.18 + pulse * 0.2);

      if (this.level.goalPhase === 1) {
        ctx.fillStyle = C.warn;
        ctx.font = "14px 'Black Ops One', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("▼ PAD 7 · FUEL DROP", sp.sx, Math.max(36, sp.sy - 155 * sp.scale));
        ctx.font = "11px 'Share Tech Mono', monospace";
        ctx.fillStyle = C.cyan;
        ctx.fillText("ESCORT TARGET", sp.sx, Math.max(52, sp.sy - 138 * sp.scale));
        ctx.textAlign = "left";
      } else if (this.truck?.arrived) {
        ctx.fillStyle = C.cyan;
        ctx.font = "12px 'Share Tech Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText("PAD 7 · SECURE", sp.sx, Math.max(40, sp.sy - 150 * sp.scale));
        ctx.textAlign = "left";
      }
    } else if (this.level.goalPhase === 1 && sp.sx >= W) {
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
    const tower = project({ x: GANTRY_START_X + 60, z: 0.7, hop: 0 }, this.stage);
    if (tower.sx > -100 && tower.sx < W + 100) {
      blitSprite(ctx, art.sprite("gantry-tower"), tower.sx, tower.sy - 30, {
        h: 260,
        scale: tower.scale,
        alpha: 0.95,
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
      | { kind: "gate"; ref: LaneGate; circ?: boolean };

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
        ctx.fillStyle = p.kind === "scrap" ? C.warn : p.kind === "health" ? C.pad : C.cyan;
        ctx.font = "10px 'Share Tech Mono', monospace";
        ctx.textAlign = "center";
        ctx.fillText(
          p.kind === "scrap" ? "SCRAP" : p.kind === "health" ? "+HP" : WEAPONS[p.kind].name,
          sp.sx,
          sp.sy - 28 * sp.scale,
        );
        ctx.textAlign = "left";
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
            outline: true,
          }) ||
          blitSprite(ctx, art.sprite("truck"), sp.sx, sp.sy - 4, {
            h: 78,
            scale: sp.scale,
            outline: true,
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
        if (truck.clamped) {
          ctx.fillStyle = C.warn;
          ctx.font = "10px 'Share Tech Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillText("CLAMPED", sp.sx, sp.sy - 50 * sp.scale);
          ctx.textAlign = "left";
        }
      } else if (item.kind === "gate") {
        const g = item.ref;
        const sp = project({ x: g.x, z: g.z, hop: 40 }, this.stage);
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
          ctx.fillText(
            `GATE · ${laneLabel(g.z)}${g.vz ? " DRIFT" : ""}`,
            sp.sx,
            sp.sy - 70 * sp.scale,
          );
          ctx.textAlign = "left";
        }
      } else if (item.kind === "enemy") {
        const e = item.ref;
        const sp = project(e, this.stage);
        drawShadow(ctx, sp, e.kind === "walker" ? 28 : 18);
        const baseH = e.kind === "spine" ? 88 : e.kind === "walker" ? 78 : 68;
        const ghostA = e.kind === "ghost" ? ((e.revealed ?? 0) > 0 ? 0.85 : 0.08) : e.flash > 0 ? 0.55 : 1;
        const ok = blitSprite(ctx, this.animImage(e), sp.sx, sp.sy, {
          facing: e.facing,
          h: baseH,
          scale: sp.scale,
          alpha: ghostA,
          flash: e.flash > 0,
          outline: e.kind !== "ghost" || ghostA > 0.4,
        });
        if (!ok) {
          if (e.kind === "spine") drawSpine(ctx, sp.sx, sp.sy, this.frame);
          else drawEnemy(ctx, e.kind, sp.sx, sp.sy, this.frame, e.facing);
        }
        if (e.kind === "spine" && !e.dead) {
          const armored = this.spineArmored(e);
          ctx.fillStyle = armored ? C.cyan : C.warn;
          ctx.font = "11px 'Share Tech Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillText(
            armored ? `ARMORED · ${laneLabel(e.z)}` : `SPINE · ${laneLabel(e.z)}`,
            sp.sx,
            sp.sy - 55 * sp.scale,
          );
          ctx.textAlign = "left";
          glow(ctx, sp.sx, sp.sy, 40 * sp.scale, armored ? C.cyan : C.warn, armored ? 0.42 : 0.2);
          if (armored) {
            ctx.strokeStyle = C.cyan;
            ctx.globalAlpha = 0.7;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(sp.sx, sp.sy - 10 * sp.scale, 28 * sp.scale, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
        if (!e.dead && (e.kind === "walker" || e.kind === "spine" || e.kind === "beetle")) {
          const bw = 28 * sp.scale;
          rr(ctx, sp.sx - bw / 2, sp.sy - (e.h + 14) * sp.scale, bw, 3, C.soot);
          rr(
            ctx,
            sp.sx - bw / 2,
            sp.sy - (e.h + 14) * sp.scale,
            bw * clamp(e.hp / e.maxHp, 0, 1),
            3,
            e.kind === "walker" ? C.pad : C.cyan,
          );
        }
        if (e.kind === "walker") {
          ctx.fillStyle = C.warn;
          ctx.font = "9px 'Share Tech Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillText("REAR", sp.sx + 18 * sp.scale, sp.sy - 8 * sp.scale);
          ctx.textAlign = "left";
        }
        if (e.kind === "tether") {
          ctx.fillStyle = C.cyan;
          ctx.font = "9px 'Share Tech Mono', monospace";
          ctx.textAlign = "center";
          ctx.fillText("TETHER", sp.sx, sp.sy - 28 * sp.scale);
          ctx.textAlign = "left";
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
          outline: true,
        });
        if (!ok) {
          drawBoss(ctx, boss.kind, sp.sx, sp.sy, this.frame, boss.hp / boss.maxHp, boss.phase);
        }
      } else if (item.kind === "player") {
        const sp = project(this.player, this.stage);
        drawShadow(ctx, sp, this.player.kind === "ship" ? 30 : 18);
        const inv = this.invuln > 0 && Math.floor(this.frame / 2) % 2 === 0;
        if (this.player.kind === "ship") {
          if (this.muzzle > 0) {
            drawMuzzle(ctx, sp.sx, sp.sy, 1, this.muzzle / 0.06, sp.scale);
          }
          const ok = blitSprite(ctx, this.animImage(this.player), sp.sx, sp.sy, {
            h: 72,
            scale: sp.scale,
            alpha: inv ? 0.4 : this.player.flash > 0 ? 0.65 : 1,
            outline: true,
          });
          if (!ok) drawShip(ctx, sp.sx, sp.sy, this.shipThrust, this.player.flash > 0);
          else if (this.shipThrust > 0) {
            glow(ctx, sp.sx - 30 * sp.scale, sp.sy, 14 * sp.scale, C.pad, 0.45);
          }
        } else {
          const walking =
            this.player.kind === "ground" &&
            this.player.grounded &&
            this.player.anim.clip === "walk";
          let bob = this.player.kind === "eva" ? Math.sin(this.frame * 0.2) * 2 : 0;
          if (walking) {
            const clip = CLIPS.ash?.walk;
            const phase =
              clip && clip.frames.length
                ? ((this.player.anim.time * clip.fps) % clip.frames.length) / clip.frames.length
                : 0;
            bob = -Math.abs(Math.sin(phase * Math.PI * 2)) * 4.5 * sp.scale;
          }
          if (this.landSquash > 0) bob += 5 * (this.landSquash / 0.12) * sp.scale;
          const squash = this.landSquash > 0 ? 1 - this.landSquash * 1.4 : 1;
          if (this.muzzle > 0) {
            drawMuzzle(
              ctx,
              sp.sx,
              sp.sy + bob,
              this.player.facing,
              this.muzzle / 0.06,
              sp.scale,
            );
          }
          if (this.weapon === "rail" && this.railCharge > 0.1) {
            glow(ctx, sp.sx, sp.sy - 8 * sp.scale, 18 * sp.scale * this.railCharge, C.earth, 0.35);
          }
          const ok = blitSprite(ctx, this.animImage(this.player), sp.sx, sp.sy, {
            facing: this.player.facing,
            h: this.player.kind === "eva" ? 84 : 78,
            scale: sp.scale * squash,
            alpha: inv ? 0.4 : this.player.flash > 0 ? 0.65 : 1,
            bob,
            anchor: this.player.kind === "ground" ? "feet" : "center",
            outline: true,
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

    for (const e of this.enemies) {
      if (e.dead || e.kind !== "tether") continue;
      const a = project(e, this.stage);
      const b = project(this.player, this.stage);
      drawTetherRope(ctx, a.sx, a.sy, b.sx, b.sy, this.frame);
    }
    if (this.truck?.clamped) {
      const walker = this.enemies.find((e) => !e.dead && e.kind === "walker");
      if (walker) {
        const a = project(walker, this.stage);
        const b = project({ x: this.truck.x, z: this.truck.z, hop: 8 }, this.stage);
        drawClampLink(ctx, a.sx, a.sy, b.sx, b.sy);
      }
    }
    if (this.laserSweep) {
      const sp = project({ x: this.camX + W * 0.5, z: this.laserSweep.z, hop: 8 }, this.stage);
      drawLaserLane(ctx, sp.sy, this.laserSweep.life);
    }

    // bullets + particles (projected)
    for (const b of this.bullets) {
      const sp = project(b, this.stage);
      drawBullet(ctx, sp.sx, sp.sy, sp.scale, b.vx, b.vHop, b.r, b.color, b.look);
    }
    for (const p of this.particles) {
      const sp = project(p, this.stage);
      drawParticle(ctx, sp.sx, sp.sy, p.size * sp.scale, p.color, p.life, p.kind);
    }
    for (const b of this.booms) {
      const sp = project(b, this.stage);
      drawExplosion(ctx, sp.sx, sp.sy, b.life / b.max, b.scale * sp.scale, b.kind);
    }
    for (const s of this.impacts) {
      const sp = project(s, this.stage);
      drawHitSpark(ctx, sp.sx, sp.sy, sp.scale, s.life / s.max, s.look);
    }
    if (this.empPulse > 0) {
      const sp = project(this.player, this.stage);
      const u = 1 - this.empPulse;
      ctx.save();
      ctx.strokeStyle = C.cyan;
      ctx.globalAlpha = this.empPulse * 0.85;
      ctx.lineWidth = 3 + (1 - u) * 4;
      ctx.beginPath();
      ctx.arc(sp.sx, sp.sy, 20 + u * 220, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = C.warn;
      ctx.globalAlpha = this.empPulse * 0.4;
      ctx.beginPath();
      ctx.arc(sp.sx, sp.sy, 12 + u * 160, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.textAlign = "center";
    for (const pop of this.scorePops) {
      const sp = project(pop, this.stage);
      ctx.globalAlpha = clamp(pop.life * 1.6, 0, 1);
      ctx.fillStyle = pop.color;
      ctx.font = "13px 'Black Ops One', sans-serif";
      ctx.fillText(pop.text, sp.sx, sp.sy);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = "left";
  }

  private renderHud() {
    const ctx = this.ctx;
    const touch = isTouchPrimary();
    const hpRatio = clamp(this.player.hp / this.player.maxHp, 0, 1);
    const fade = ctx.createLinearGradient(0, 0, 0, 64);
    fade.addColorStop(0, "rgba(5,8,16,0.55)");
    fade.addColorStop(1, "transparent");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, 64);

    drawPlate(ctx, 8, 6, 196, 28, hpRatio < 0.28 ? C.blood : C.pad);
    ctx.fillStyle = C.bone;
    ctx.font = "11px 'Share Tech Mono', monospace";
    ctx.fillText("HP", 14, 17);
    drawPips(ctx, 36, 10, 10, Math.ceil(hpRatio * 10), hpRatio < 0.28 ? C.blood : C.pad, C.soot);
    ctx.fillStyle = C.bone;
    ctx.fillText(`${Math.ceil(this.player.hp)}`, 150, 24);

    drawPlate(ctx, 210, 6, 168, 28, C.cyan);
    ctx.fillStyle = C.cyan;
    ctx.font = "12px 'Black Ops One', sans-serif";
    ctx.fillText(WEAPONS[this.weapon].name, 218, 24);
    ctx.fillStyle = C.warn;
    ctx.font = "12px 'Share Tech Mono', monospace";
    ctx.fillText(this.weapon === "pistol" ? "∞" : `${this.ammo}`, 338, 24);
    if (this.weapon === "rail" && this.railCharge > 0) {
      ctx.fillStyle = C.soot;
      ctx.fillRect(218, 28, 56, 3);
      ctx.fillStyle = C.earth;
      ctx.fillRect(218, 28, 56 * clamp(this.railCharge / 1.15, 0, 1), 3);
    }
    if (WEAPONS[this.weapon].heat) {
      ctx.fillStyle = C.soot;
      ctx.fillRect(218, 28, 56, 3);
      ctx.fillStyle = this.heat > 0.9 ? C.blood : C.cyan;
      ctx.fillRect(218, 28, 56 * clamp(this.heat, 0, 1), 3);
    }

    drawPlate(ctx, 384, 6, 88, 28, C.warn);
    ctx.fillStyle = C.warn;
    ctx.font = "11px 'Share Tech Mono', monospace";
    ctx.fillText(`EMP ${this.special}`, 392, 24);

    drawPlate(ctx, 478, 6, 100, 28, C.pad);
    ctx.fillStyle = C.bone;
    ctx.fillText(`SCRAP ${this.scrap}`, 486, 24);

    drawPlate(ctx, 584, 6, 118, 28, C.warn);
    ctx.fillStyle = C.warn;
    ctx.font = "13px 'Black Ops One', sans-serif";
    ctx.fillText(`${this.score}`, 592, 25);
    if (this.combo > 1) {
      ctx.fillStyle = C.pad;
      ctx.fillText(`x${this.combo}`, 700, 25);
    }

    ctx.fillStyle = C.cyan;
    ctx.font = `${touch ? 12 : 11}px 'Share Tech Mono', monospace`;
    ctx.fillText(this.level.objective, 12, 48);
    if (this.twistCueT > 0 && this.twistCue) {
      ctx.fillStyle = C.warn;
      ctx.globalAlpha = Math.min(1, this.twistCueT * 1.4);
      ctx.font = `${touch ? 13 : 12}px 'Share Tech Mono', monospace`;
      ctx.fillText(this.twistCue, 12, H - 22);
      ctx.globalAlpha = 1;
    }

    ctx.strokeStyle = C.cyan;
    ctx.globalAlpha = 0.55;
    ctx.strokeRect(W - 26.5, 78.5, 12, 118);
    ctx.globalAlpha = 1;
    rr(ctx, W - 24, 82 + (1 - this.player.z) * 100, 8, 12, C.warn);
    const objZ = this.objectiveDepthZ();
    if (objZ !== null) {
      const pulse = 0.55 + 0.45 * Math.sin(this.frame * 0.2);
      ctx.fillStyle = C.cyan;
      ctx.globalAlpha = pulse;
      ctx.fillRect(W - 28, 82 + (1 - objZ) * 100 + 4, 16, 3);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = C.cyan;
    ctx.font = "9px 'Share Tech Mono', monospace";
    ctx.fillText("NEAR", W - 44, 208);
    ctx.fillText("FAR", W - 38, 76);

    const depthHint = touch ? "stick ↑↓ depth" : "W/S depth";
    const y2 = 62;
    if (this.levelId === 1) {
      const urgent = this.level.killClock < 30;
      ctx.fillStyle = urgent ? C.blood : C.warn;
      if (urgent && Math.floor(this.frame / 8) % 2 === 0) ctx.globalAlpha = 0.55;
      const truckHp = this.truck ? ` · TRUCK ${Math.ceil(this.truck.hp)}` : "";
      let phaseHint = "";
      if (this.level.goalPhase === 1 && this.truck && !this.truck.arrived) {
        phaseHint = this.truck.clamped
          ? " · WALKER CLAMP — KILL IT"
          : ` · PAD 7 ${Math.max(0, Math.floor(PAD7_X - this.truck.x))}m`;
      } else if (this.boardReady) {
        phaseHint = " · BOARD FINCH →";
      } else if (this.level.goalPhase === 2) {
        phaseHint = this.level.bossSpawned ? " · FIGHT UP THE GANTRY →" : " · CLIMB RIGHT →";
      }
      ctx.font = `${touch ? 13 : 12}px 'Share Tech Mono', monospace`;
      ctx.fillText(
        `CLOCK ${Math.ceil(this.level.killClock)}s · TECHS ${this.rescued}/${this.techs.length}${truckHp}${phaseHint}`,
        12,
        y2,
      );
      ctx.globalAlpha = 1;
    }
    if (this.levelId === 2) {
      ctx.fillStyle = C.warn;
      ctx.font = `${touch ? 13 : 12}px 'Share Tech Mono', monospace`;
      let line: string;
      if (this.level.goalPhase === 1) {
        line = `GATES ${this.level.gatesCleared}/${this.gates.length} · fly THROUGH the ring · ${depthHint}`;
      } else if (!this.level.bossDefeated) {
        line =
          this.stageSepLock > 0
            ? "STAGE SEP — punch through debris"
            : this.level.bossSpawned
              ? this.boss?.phase === 3
                ? "SERAPH SPEAR — watch AFT"
                : "SERAPH · match its depth tick"
              : "SERAPH INBOUND →";
      } else {
        line = `CIRC ${this.level.circCleared}/${this.level.circNeeded} · thread rings`;
      }
      ctx.fillText(line, 12, y2);
    }
    if (this.levelId === 3) {
      ctx.fillStyle = C.warn;
      ctx.font = `${touch ? 13 : 12}px 'Share Tech Mono', monospace`;
      let line: string;
      if (this.level.goalPhase === 1) {
        line = this.shearLife > 0
          ? `SPINES ${this.level.spinesDown}/${this.level.spinesNeeded} · GRAVITY SHEAR`
          : `SPINES ${this.level.spinesDown}/${this.level.spinesNeeded} · beetles first · keep RIGHT`;
      } else if (!this.level.bossSpawned) {
        const dist = Math.max(0, Math.floor(PRIME_ARENA_X - this.player.x));
        line = `PRIME CAVITY → ${dist}m · hold JUMP to thrust`;
      } else {
        line =
          this.boss && this.boss.phase >= 3
            ? "PRIME · EVA INTO THE CORE — jump in close"
            : "PRIME · rupture the core";
      }
      ctx.fillText(line, 12, y2);
    }

    if (this.boss && !this.boss.dead) {
      const name = BOSS[this.levelId].name;
      const by = 78;
      drawPlate(ctx, W / 2 - 190, by, 380, 32, C.cyan);
      ctx.fillStyle = C.cyan;
      ctx.font = "11px 'Share Tech Mono', monospace";
      ctx.fillText(`SIGNAL INTEGRITY · ${name} · P${this.boss.phase}`, W / 2 - 178, by + 13);
      drawSignalMeter(ctx, W / 2 - 178, by + 16, 356, this.boss.hp / this.boss.maxHp, this.boss.phase);
    }

    if (this.msgTimer > 0 || this.mode === "dead") {
      drawPlate(ctx, W / 2 - 230, H / 2 - 34, 460, this.mode === "dead" ? 62 : 44, C.warn);
      ctx.fillStyle = C.warn;
      ctx.font = "18px 'Black Ops One', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(this.msg, W / 2, H / 2 - 6);
      if (this.mode === "dead") {
        ctx.fillStyle = "rgba(244,237,228,0.75)";
        ctx.font = "12px 'Share Tech Mono', monospace";
        ctx.fillText(
          isTouchPrimary() ? "OK retry · TITLE quit" : "ENTER / J retry · ESC title",
          W / 2,
          H / 2 + 16,
        );
      }
      ctx.textAlign = "left";
    }
  }

  private renderScreenFx() {
    const ctx = this.ctx;
    if (this.screenFlash > 0) {
      ctx.fillStyle = `rgba(180, 230, 255, ${this.screenFlash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
    const hpRatio = this.player.maxHp > 0 ? this.player.hp / this.player.maxHp : 1;
    if (hpRatio < 0.32 && this.mode !== "dead") {
      const a = (0.32 - hpRatio) * 1.4 * (0.65 + 0.35 * Math.sin(this.lowHpWarn * 8));
      const g = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 520);
      g.addColorStop(0, "transparent");
      g.addColorStop(1, `rgba(140, 12, 18, ${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    if (
      this.mode === "play" &&
      this.levelId === 1 &&
      this.hintT < 8 &&
      this.level.goalPhase === 1
    ) {
      const fade = this.hintT < 1 ? this.hintT : this.hintT > 7 ? 8 - this.hintT : 1;
      ctx.globalAlpha = clamp(fade, 0, 0.9);
      ctx.fillStyle = "rgba(11,18,32,0.72)";
      ctx.fillRect(W / 2 - 250, H - 78, 500, 44);
      ctx.fillStyle = C.warn;
      ctx.font = "13px 'Share Tech Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        isTouchPrimary()
          ? "Escort the fuel truck · stick UP/DOWN = depth"
          : "Escort the fuel truck · W/S = depth lanes · J fire",
        W / 2,
        H - 52,
      );
      ctx.textAlign = "left";
      ctx.globalAlpha = 1;
    }
  }

  private render() {
    const ctx = this.ctx;
    ctx.save();
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    ctx.translate(sx, sy + this.camLean * 20);
    ctx.translate(W / 2, H / 2);
    ctx.scale(1 + Math.abs(this.camLean) * 0.02, 1);
    ctx.translate(-W / 2, -H / 2);

    if (this.mode === "title") {
      ctx.restore();
      this.renderTitle();
      return;
    }
    if (this.mode === "howto") {
      ctx.restore();
      this.renderHowto();
      return;
    }
    if (this.mode === "upgrade") {
      ctx.restore();
      this.renderUpgrade();
      return;
    }
    if (this.mode === "victory") {
      ctx.restore();
      this.renderVictory();
      return;
    }

    this.renderBg();
    this.renderActors();
    if (this.levelId === 2 && (this.mode === "play" || this.mode === "boss" || this.mode === "pause")) {
      this.renderL2ObjectiveCues();
    }
    if (this.levelId === 3 && (this.mode === "play" || this.mode === "boss" || this.mode === "pause")) {
      this.renderL3ObjectiveCues();
    }
    const kind = this.levelId === 1 ? "pad" : this.levelId === 2 ? "sky" : "void";
    if (this.levelId === 1) {
      for (let i = 0; i < 5; i++) {
        const x = ((i * 340 - this.camX * 1.45) % (W + 260)) - 80;
        const img =
          i % 2 === 0 ? art.sprite("prop-crate-near") : art.sprite("prop-gantry-near");
        blitSprite(ctx, img, x, H - 58, { h: 130, alpha: 0.92, outline: true });
      }
      ctx.fillStyle = "rgba(5,6,10,0.55)";
      ctx.fillRect(0, H - 18, W, 18);
    } else {
      drawForegroundProps(ctx, this.camX, this.frame, kind);
    }
    drawColorGrade(ctx, this.levelId, this.bgThreat);
    if (this.shearLife > 0) drawShearVeil(ctx, this.frame, this.shearLife);
    if (this.laneMin > 0.02) {
      const near = project({ x: this.camX + 80, z: this.laneMin, hop: 0 }, this.stage);
      const far = project({ x: this.camX + 80, z: this.laneMax, hop: 0 }, this.stage);
      drawArenaRails(ctx, near.sy, far.sy);
    }
    if (this.mode === "boss") drawLetterbox(ctx, 0.85);
    ctx.restore();

    if (this.mode === "briefing") this.renderBriefingOverlay();
    if (this.mode === "clear") this.renderClearOverlay();
    if (this.mode === "dead") {
      ctx.fillStyle = "rgba(80,0,0,0.35)";
      ctx.fillRect(0, 0, W, H);
    }
    if (this.mode === "pause") this.renderPauseOverlay();
    this.renderHud();
    this.renderScreenFx();
  }

  private renderTitle() {
    const ctx = this.ctx;
    ctx.fillStyle = C.void;
    ctx.fillRect(0, 0, W, H);
    const painted = blitCover(ctx, art.bg("title-hero"), 1);
    if (!painted) {
      ctx.fillStyle = C.navy;
      ctx.fillRect(0, 0, W, H);
    }
    drawRain(ctx, this.frame, 0.55, 0);
    drawLetterbox(ctx, 1);
    const vg = ctx.createLinearGradient(0, 0, 0, H);
    vg.addColorStop(0, "rgba(5,8,16,0.15)");
    vg.addColorStop(0.45, "transparent");
    vg.addColorStop(1, "rgba(5,8,16,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.fillStyle = C.cyan;
    ctx.font = "13px 'Share Tech Mono', monospace";
    ctx.fillText("OPERATION ORBITAL BREAK", W / 2, 52);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "64px 'Black Ops One', sans-serif";
    ctx.fillText("STAR MIND", W / 2 + 3, 118);
    ctx.fillStyle = C.pad;
    ctx.fillText("STAR MIND", W / 2, 115);
    ctx.fillStyle = C.bone;
    ctx.font = "13px 'Share Tech Mono', monospace";
    ctx.fillText("METAL SLUG DNA  ·  DEPTH LANES  ·  SPACE-PUNK", W / 2, 148);
    if (this.bestScore > 0) {
      ctx.fillStyle = C.warn;
      ctx.font = "12px 'Share Tech Mono', monospace";
      ctx.fillText(`BEST ${this.bestScore}`, W / 2, 172);
    }

    const items = [
      "▶ START OPERATION",
      "HOW TO PLAY",
      "PRACTICE · LAUNCH",
      "PRACTICE · ORBIT",
    ];
    items.forEach((label, i) => {
      const y = 368 + i * 34;
      const sel = i === this.menuIndex;
      drawPlate(ctx, W / 2 - 190, y - 22, 380, 30, sel ? C.warn : C.cyan);
      ctx.textAlign = "center";
      ctx.fillStyle = sel ? C.warn : C.bone;
      ctx.font = sel ? "18px 'Black Ops One', sans-serif" : "15px 'Share Tech Mono', monospace";
      ctx.fillText(`${sel ? "▸ " : "  "}${label}`, W / 2, y);
    });
    ctx.fillStyle = "rgba(244,237,228,0.7)";
    ctx.font = "12px 'Share Tech Mono', monospace";
    ctx.fillText(
      isTouchPrimary()
        ? "▲▼ select · OK · stick move · FIRE hold · JUMP · EMP · II pause"
        : "A/D strafe · W/S depth · SPACE jump · J shoot · K EMP · P pause · ESC back",
      W / 2,
      H - 28,
    );
    ctx.textAlign = "left";
    this.frame++;
  }

  private renderHowto() {
    const ctx = this.ctx;
    ctx.fillStyle = C.void;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = C.cyan;
    ctx.font = "14px 'Share Tech Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText("FIELD MANUAL", W / 2, 70);
    ctx.fillStyle = C.bone;
    ctx.font = "28px 'Black Ops One', sans-serif";
    ctx.fillText("HOW TO PLAY", W / 2, 110);
    const touch = isTouchPrimary();
    const lines = touch
      ? [
          "Each level has two goals. Finish 1/2 to unlock 2/2.",
          "Stick = strafe + depth (NEAR / FAR). Match the cyan tick.",
          "Hold FIRE. JUMP hops — on orbit, hold JUMP to thrust.",
          "EMP wipes nearby enemy shots and stuns the grid.",
          "Earth: the fuel truck rolls with you to Pad 7.",
          "Launch: fly THROUGH the glowing rings, not beside them.",
          "Keep moving RIGHT. II pauses.",
        ]
      : [
          "Each level has two goals. Finish 1/2 to unlock 2/2.",
          "A/D strafe · W/S depth (NEAR / FAR). Match the cyan tick.",
          "Hold J to shoot · Space jump (orbit: hold Space to thrust).",
          "K EMP — strips nearby hostile fire and stuns.",
          "Earth: the fuel truck rolls with you to Pad 7.",
          "Launch: fly THROUGH the glowing rings, not beside them.",
          "Keep moving RIGHT. P pauses · Esc from pause returns here.",
        ];
    ctx.font = "15px 'Share Tech Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = C.bone;
    lines.forEach((ln, i) => ctx.fillText(ln, 88, 158 + i * 32));
    ctx.fillStyle = C.warn;
    ctx.textAlign = "center";
    ctx.fillText(touch ? "OK · back" : "ENTER · back", W / 2, 480);
    ctx.textAlign = "left";
    this.frame++;
  }

  private renderPauseOverlay() {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(5,8,16,0.62)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = C.warn;
    ctx.font = "32px 'Black Ops One', sans-serif";
    ctx.fillText("PAUSED", W / 2, H / 2 - 10);
    ctx.fillStyle = C.bone;
    ctx.font = "14px 'Share Tech Mono', monospace";
    ctx.fillText(
      isTouchPrimary() ? "OK resume · TITLE quit" : "ENTER / P resume · ESC title",
      W / 2,
      H / 2 + 28,
    );
    ctx.textAlign = "left";
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
            isTouchPrimary()
              ? "Stick LEFT/RIGHT to run. Stick UP/DOWN for depth lanes."
              : "A/D run. W/S switch NEAR / MID / FAR lanes.",
            "GOAL 1/2 — Stay with the fuel truck until the lit PAD 7 drop.",
            "GOAL 2/2 — Keep walking RIGHT up the gantry · board Finch.",
            isTouchPrimary() ? "JUMP between decks. EMP clears incoming fire." : "Space jump. K EMP clears incoming fire.",
            "",
            "When in doubt: keep moving RIGHT.",
          ]
        : this.levelId === 2
          ? [
              "Auto-scroll ascent. Fly THROUGH the glowing rings — not beside them.",
              "GOAL 1/2 — Thread every gate (match the cyan depth tick).",
              "GOAL 2/2 — Kill SERAPH, then thread CIRC rings.",
              "Missed gates re-queue ahead. Stay off the screen edges.",
              "",
              "When in doubt: match depth, then center the ship in the ring.",
            ]
          : [
              isTouchPrimary()
                ? "Hold JUMP to thrust. Stick for X / depth. Release to drift."
                : "Hold SPACE to thrust. WASD for X / depth. Release to drift.",
              "GOAL 1/2 — Sever three spines. Kill Repair Beetles first.",
              "GOAL 2/2 — Fly RIGHT into the lit PRIME cavity.",
              "Ghosts are nearly invisible until they fire. EMP stuns mirrors.",
              "",
              "When in doubt: keep moving RIGHT.",
            ];
    lines.forEach((ln, i) => ctx.fillText(ln, 110, 160 + i * 28));
    ctx.fillStyle = C.warn;
    ctx.fillText(
      isTouchPrimary() ? "OK TO DEPLOY" : "PRESS ENTER / J TO DEPLOY",
      110,
      H - 110,
    );
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
        ? isTouchPrimary()
          ? "OK · final debrief"
          : "ENTER · final debrief"
        : this.levelId === 1
          ? isTouchPrimary()
            ? "OK · fabricator → LAUNCH!"
            : "ENTER · fabricator → LAUNCH!"
          : isTouchPrimary()
            ? "OK · fabricator → ORBIT"
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
      const lvl =
        r.key === "next"
          ? isTouchPrimary()
            ? "OK to deploy"
            : "ENTER to deploy"
          : `Lv ${this.upgrades[r.key]}  ·  cost ${cost}  ·  ${UPGRADE_BLURB[r.key]}`;
      ctx.fillStyle = sel ? C.warn : C.bone;
      ctx.font = sel ? "18px 'Black Ops One', sans-serif" : "15px 'Share Tech Mono', monospace";
      ctx.fillText(`${sel ? "▸ " : "  "}${r.label}   ${lvl}`, W / 2, y);
    });
    ctx.fillStyle = "rgba(244,237,228,0.55)";
    ctx.font = "12px 'Share Tech Mono', monospace";
    ctx.fillText(
      isTouchPrimary()
        ? "▲▼ select · OK buy / advance · TITLE returns"
        : "W/S select · ENTER confirm · NEXT is pre-selected",
      W / 2,
      H - 40,
    );
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
    ctx.fillText(`TOTAL SCORE ${this.totalScore}`, W / 2, 260);
    if (this.bestScore >= this.totalScore && this.bestScore > 0) {
      ctx.fillStyle = C.pad;
      ctx.fillText(`BEST ${this.bestScore}`, W / 2, 282);
    }
    ctx.fillStyle = C.bone;
    ctx.fillText("CAPCOM NIX: Come home, Ash. Leave the void to the ghosts.", W / 2, 310);
    if (this.stinger) {
      ctx.fillStyle = C.blood;
      ctx.font = "12px 'Share Tech Mono', monospace";
      ctx.fillText("…one sat blinks back online.", W / 2, 360);
    }
    ctx.fillStyle = C.warn;
    ctx.fillText(isTouchPrimary() ? "OK · title" : "ENTER · title", W / 2, 420);
    ctx.textAlign = "left";
    if (Math.floor(this.frame / 20) % 2 === 0) {
      glow(ctx, W / 2 + 180, 120, 16, C.cyan, 0.8);
      rr(ctx, W / 2 + 176, 116, 8, 8, C.cyan);
    }
    this.frame++;
  }
}
