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
  drawAsh,
  drawBoss,
  drawEnemy,
  drawPickup,
  drawShip,
  glow,
  rr,
} from "./draw";

interface Actor {
  x: number;
  y: number;
  vx: number;
  vy: number;
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
  weapon?: WeaponId;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  friendly: boolean;
  pierce?: boolean;
  blast?: number;
  color: string;
  fromBoss?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface Pickup {
  x: number;
  y: number;
  kind: "scrap" | WeaponId;
  life: number;
}

interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface LevelRuntime {
  id: LevelId;
  name: string;
  objective: string;
  scroll: number;
  length: number;
  groundY: number;
  platforms: Platform[];
  spawnIndex: number;
  elapsed: number;
  bossSpawned: boolean;
  bossDefeated: boolean;
  killClock: number;
  gatesCleared: number;
  formationsBroken: number;
}

type SpawnEvent = {
  t: number;
  kind: string;
  x: number;
  y: number;
  hp?: number;
};

const LEVEL_SPAWNS: Record<LevelId, SpawnEvent[]> = {
  1: [
    { t: 1, kind: "drone", x: 520, y: 360 },
    { t: 2, kind: "crab", x: 600, y: 440 },
    { t: 3.5, kind: "drone", x: 700, y: 300 },
    { t: 5, kind: "turret", x: 780, y: 430 },
    { t: 6.5, kind: "crab", x: 900, y: 440 },
    { t: 8, kind: "hackbot", x: 980, y: 430 },
    { t: 10, kind: "drone", x: 1100, y: 280 },
    { t: 10.2, kind: "drone", x: 1160, y: 320 },
    { t: 12, kind: "walker", x: 1300, y: 420 },
    { t: 14, kind: "crab", x: 1450, y: 440 },
    { t: 15, kind: "turret", x: 1550, y: 430 },
    { t: 17, kind: "drone", x: 1680, y: 260 },
    { t: 18, kind: "hackbot", x: 1750, y: 430 },
    { t: 20, kind: "walker", x: 1900, y: 420 },
    { t: 22, kind: "drone", x: 2000, y: 300 },
    { t: 22.5, kind: "drone", x: 2060, y: 340 },
    { t: 24, kind: "crab", x: 2150, y: 440 },
  ],
  2: [
    { t: 1, kind: "climber", x: 700, y: 200 },
    { t: 2.5, kind: "wasp", x: 800, y: 120 },
    { t: 4, kind: "mine", x: 650, y: 280 },
    { t: 5, kind: "climber", x: 720, y: 160 },
    { t: 6.5, kind: "wasp", x: 780, y: 100 },
    { t: 8, kind: "climber", x: 700, y: 220 },
    { t: 9, kind: "mine", x: 600, y: 200 },
    { t: 10, kind: "wasp", x: 820, y: 140 },
    { t: 12, kind: "climber", x: 740, y: 180 },
    { t: 13, kind: "climber", x: 700, y: 260 },
    { t: 15, kind: "wasp", x: 760, y: 90 },
    { t: 16, kind: "mine", x: 580, y: 240 },
    { t: 18, kind: "wasp", x: 800, y: 150 },
    { t: 20, kind: "climber", x: 720, y: 200 },
  ],
  3: [
    { t: 1, kind: "gridsat", x: 700, y: 200 },
    { t: 2, kind: "gridsat", x: 760, y: 260 },
    { t: 3.5, kind: "mirror", x: 820, y: 180 },
    { t: 5, kind: "beetle", x: 780, y: 320 },
    { t: 6.5, kind: "gridsat", x: 740, y: 140 },
    { t: 8, kind: "ghost", x: 800, y: 240 },
    { t: 10, kind: "mirror", x: 860, y: 300 },
    { t: 11, kind: "gridsat", x: 720, y: 200 },
    { t: 12, kind: "beetle", x: 780, y: 160 },
    { t: 14, kind: "ghost", x: 840, y: 280 },
    { t: 16, kind: "gridsat", x: 700, y: 220 },
    { t: 16.5, kind: "gridsat", x: 760, y: 280 },
    { t: 18, kind: "mirror", x: 820, y: 180 },
    { t: 20, kind: "beetle", x: 800, y: 240 },
  ],
};

const BOSS: Record<LevelId, { id: string; name: string; hp: number }> = {
  1: { id: "reaper", name: "PAD REAPER", hp: 520 },
  2: { id: "seraph", name: "STRATOS SERAPH", hp: 600 },
  3: { id: "prime", name: "STAR MIND PRIME", hp: 900 },
};

function aabb(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export class Game {
  private ctx: CanvasRenderingContext2D;
  private input = new Input();
  private mode: Mode = "title";
  private levelId: LevelId = 1;
  private level!: LevelRuntime;
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
  private camY = 0;
  private shipThrust = 0;
  private heat = 0;
  private gates: { x: number; y: number; hit: boolean }[] = [];
  private techs: { x: number; y: number; rescued: boolean }[] = [];
  private rescued = 0;
  private score = 0;
  private totalScore = 0;
  private last = 0;
  private running = false;
  private stinger = false;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D context unavailable");
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
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

  private resetPlayer(mode: "ground" | "ship" | "eva") {
    const hp = 100 + this.upgrades.armor * 20;
    this.player = {
      x: mode === "ship" ? 220 : 120,
      y: mode === "ship" ? H / 2 : 400,
      vx: 0,
      vy: 0,
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
    };
    this.weapon = mode === "ship" ? "coil" : mode === "eva" ? "coil" : "coil";
    this.ammo = 80 + this.upgrades.mag * 25;
    this.cooldown = 0;
    this.special = this.specialMax + this.upgrades.special;
    this.specialMax = 3 + this.upgrades.special;
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
    this.camY = 0;
    this.score = 0;
    this.rescued = 0;
    this.stinger = false;
    this.gates = [];
    this.techs = [];

    if (id === 1) {
      this.level = {
        id,
        name: "EARTH ESCAPE",
        objective: "Reach Pad 7 · Board BLACK FINCH",
        scroll: 0,
        length: 2800,
        groundY: 470,
        platforms: [
          { x: 380, y: 380, w: 120, h: 16 },
          { x: 620, y: 320, w: 100, h: 16 },
          { x: 900, y: 360, w: 140, h: 16 },
          { x: 1200, y: 300, w: 110, h: 16 },
          { x: 1500, y: 340, w: 160, h: 16 },
          { x: 1850, y: 300, w: 120, h: 16 },
          { x: 2200, y: 360, w: 180, h: 16 },
          { x: 2500, y: 400, w: 200, h: 16 },
        ],
        spawnIndex: 0,
        elapsed: 0,
        bossSpawned: false,
        bossDefeated: false,
        killClock: 180,
        gatesCleared: 0,
        formationsBroken: 0,
      };
      this.techs = [
        { x: 450, y: 360, rescued: false },
        { x: 980, y: 340, rescued: false },
        { x: 1580, y: 320, rescued: false },
        { x: 2280, y: 340, rescued: false },
      ];
      this.resetPlayer("ground");
    } else if (id === 2) {
      this.level = {
        id,
        name: "LAUNCH!",
        objective: "Survive ascent · Insert to LEO",
        scroll: 0,
        length: 2400,
        groundY: H + 40,
        platforms: [],
        spawnIndex: 0,
        elapsed: 0,
        bossSpawned: false,
        bossDefeated: false,
        killClock: 0,
        gatesCleared: 0,
        formationsBroken: 0,
      };
      this.gates = [
        { x: 400, y: 180, hit: false },
        { x: 700, y: 320, hit: false },
        { x: 1100, y: 140, hit: false },
        { x: 1500, y: 280, hit: false },
        { x: 1900, y: 200, hit: false },
      ];
      this.resetPlayer("ship");
    } else {
      this.level = {
        id,
        name: "ORBIT",
        objective: "Cut the constellation · Destroy PRIME",
        scroll: 0,
        length: 2600,
        groundY: H + 80,
        platforms: [
          { x: 500, y: 360, w: 140, h: 14 },
          { x: 800, y: 280, w: 100, h: 14 },
          { x: 1100, y: 400, w: 160, h: 14 },
          { x: 1450, y: 300, w: 120, h: 14 },
          { x: 1800, y: 360, w: 150, h: 14 },
          { x: 2100, y: 250, w: 130, h: 14 },
        ],
        spawnIndex: 0,
        elapsed: 0,
        bossSpawned: false,
        bossDefeated: false,
        killClock: 0,
        gatesCleared: 0,
        formationsBroken: 0,
      };
      this.resetPlayer("eva");
    }

    this.mode = "briefing";
    this.announce(`${this.level.name}`);
  }

  private spawnEnemy(kind: string, x: number, y: number, hp = 0) {
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
    };
    const s = stats[kind] ?? { hp: 30, w: 24, h: 24, scrap: 2 };
    this.enemies.push({
      x,
      y,
      vx: 0,
      vy: 0,
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
    });
  }

  private spawnBoss() {
    const b = BOSS[this.levelId];
    const x =
      this.levelId === 1
        ? this.level.length - 200
        : this.levelId === 2
          ? this.camX + W - 180
          : this.camX + W - 200;
    const y = this.levelId === 1 ? 280 : this.levelId === 2 ? H / 2 : H / 2;
    this.boss = {
      x,
      y,
      vx: 0,
      vy: 0,
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
      this.burst(this.player.x, this.player.y, C.pad, 24);
      this.announce("SIGNAL LOST · ASH DOWN", 99);
    }
  }

  private burst(x: number, y: number, color: string, n = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
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
    const mode = this.player.kind;
    const muzzleX =
      mode === "ship"
        ? this.player.x + 30
        : this.player.x + this.player.facing * 22;
    const muzzleY = mode === "ship" ? this.player.y : this.player.y - 4;
    const dir = mode === "ship" ? 1 : this.player.facing;

    const shootOne = (angle = 0) => {
      const sp = def.speed;
      this.bullets.push({
        x: muzzleX,
        y: muzzleY,
        vx: Math.cos(angle) * sp * dir + (mode === "ship" ? 80 : 0),
        vy: Math.sin(angle) * sp,
        r: def.blast ? 5 : def.id === "rail" ? 4 : 3,
        dmg: def.damage * dmgMul,
        life: def.pierce ? 0.9 : 0.7,
        friendly: true,
        pierce: def.pierce,
        blast: def.blast,
        color: def.color,
      });
    };

    if (def.spread) {
      shootOne(-0.28);
      shootOne(0);
      shootOne(0.28);
    } else if (def.id === "flame") {
      for (let i = 0; i < 3; i++) shootOne((Math.random() - 0.5) * 0.5);
    } else {
      shootOne(0);
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
    this.burst(muzzleX, muzzleY, C.warn, 3);
  }

  private fireSpecial() {
    if (this.special <= 0) return;
    this.special -= 1;
    const x = this.player.x;
    const y = this.player.y;
    // EMP grenade / ship missile / EVA tether burst
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      this.bullets.push({
        x,
        y,
        vx: Math.cos(a) * 280,
        vy: Math.sin(a) * 280,
        r: 4,
        dmg: 28 + this.upgrades.damage * 4,
        life: 0.45,
        friendly: true,
        color: C.cyan,
        blast: 20,
      });
    }
    this.burst(x, y, C.cyan, 20);
    this.shake = 6;
    this.announce("EMP BURST");
  }

  private killEnemy(e: Actor) {
    e.dead = true;
    this.burst(e.x, e.y, C.cyan, 14);
    this.score += 100;
    this.scrap += e.scrap ?? 2;
    if (Math.random() < 0.22) {
      const pool: WeaponId[] = ["spread", "beam", "rocket", "flame", "rail", "coil"];
      this.pickups.push({
        x: e.x,
        y: e.y,
        kind: pool[Math.floor(Math.random() * pool.length)]!,
        life: 8,
      });
    } else if (Math.random() < 0.45) {
      this.pickups.push({ x: e.x, y: e.y, kind: "scrap", life: 8 });
    }
  }

  private updateEnemy(e: Actor, dt: number) {
    e.timer += dt;
    e.flash = Math.max(0, e.flash - dt);
    const px = this.player.x;
    const py = this.player.y;

    switch (e.kind) {
      case "drone":
      case "climber":
      case "gridsat":
      case "ghost":
        e.y += Math.sin(e.timer * 2) * 20 * dt;
        e.x += (this.levelId === 1 ? -40 : -30) * dt;
        if (e.timer > 1.2) {
          e.timer = 0;
          this.enemyShot(e, px, py, 220, 8);
        }
        break;
      case "crab":
        e.x += -55 * dt;
        if (Math.random() < 0.01) e.vy = -220;
        e.vy += 700 * dt;
        e.y += e.vy * dt;
        if (e.y > this.level.groundY - e.h / 2) {
          e.y = this.level.groundY - e.h / 2;
          e.vy = 0;
        }
        break;
      case "turret":
        if (e.timer > 1.4) {
          e.timer = 0;
          this.enemyShot(e, px, py, 260, 10);
        }
        break;
      case "hackbot":
        e.x += Math.sign(px - e.x) * 70 * dt;
        e.y += Math.sign(py - e.y) * 20 * dt;
        if (e.timer > 2 && Math.hypot(px - e.x, py - e.y) < 40) {
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
        e.x += -35 * dt;
        if (e.timer > 1.6) {
          e.timer = 0;
          this.enemyShot(e, px, py, 300, 14, true);
        }
        break;
      case "wasp":
        e.x += -90 * dt;
        e.y += Math.sin(e.timer * 4) * 40 * dt;
        if (e.timer > 0.9) {
          e.timer = 0;
          const ang = Math.atan2(py - e.y, px - e.x);
          this.bullets.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(ang) * 180,
            vy: Math.sin(ang) * 180,
            r: 4,
            dmg: 12,
            life: 2.5,
            friendly: false,
            color: C.warn,
          });
        }
        break;
      case "mine":
        e.y += Math.sin(e.timer) * 10 * dt;
        if (Math.hypot(px - e.x, py - e.y) < 50) {
          this.burst(e.x, e.y, C.blood, 18);
          this.hurtPlayer(22);
          e.dead = true;
        }
        break;
      case "mirror":
        e.x += -25 * dt;
        e.y += Math.sin(e.timer) * 15 * dt;
        break;
      case "beetle":
        e.x += -40 * dt;
        // heal nearby
        if (e.timer > 1.5) {
          e.timer = 0;
          for (const o of this.enemies) {
            if (!o.dead && o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 120) {
              o.hp = Math.min(o.maxHp, o.hp + 8);
              this.burst(o.x, o.y, C.warn, 4);
            }
          }
        }
        break;
    }

    // contact damage
    if (
      aabb(
        e.x - e.w / 2,
        e.y - e.h / 2,
        e.w,
        e.h,
        this.player.x - this.player.w / 2,
        this.player.y - this.player.h / 2,
        this.player.w,
        this.player.h,
      )
    ) {
      this.hurtPlayer(e.kind === "walker" ? 18 : 10);
    }

    if (this.levelId === 1 && e.x < this.camX - 80) e.dead = true;
    if (this.levelId !== 1 && e.x < this.camX - 40) e.dead = true;
  }

  private enemyShot(
    e: Actor,
    tx: number,
    ty: number,
    speed: number,
    dmg: number,
    heavy = false,
  ) {
    const ang = Math.atan2(ty - e.y, tx - e.x);
    this.bullets.push({
      x: e.x,
      y: e.y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      r: heavy ? 5 : 3,
      dmg,
      life: 2.2,
      friendly: false,
      color: heavy ? C.pad : C.cyan,
    });
  }

  private updateBoss(dt: number) {
    const b = this.boss;
    if (!b || b.dead) return;
    b.timer += dt;
    b.flash = Math.max(0, b.flash - dt);
    const ratio = b.hp / b.maxHp;
    b.phase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;

    const px = this.player.x;
    const py = this.player.y;

    if (b.kind === "reaper") {
      b.x = this.level.length - 180;
      b.y = 260 + Math.sin(b.timer * 0.7) * 30;
      if (b.timer > (b.phase === 1 ? 1.4 : 0.9)) {
        b.timer = 0;
        if (b.phase === 1) {
          this.enemyShot(b, px, py, 280, 14, true);
        } else if (b.phase === 2) {
          for (let i = -1; i <= 1; i++) {
            this.bullets.push({
              x: b.x - 40,
              y: b.y,
              vx: -320,
              vy: i * 90,
              r: 4,
              dmg: 12,
              life: 2,
              friendly: false,
              color: C.cyan,
              fromBoss: true,
            });
          }
          if (Math.random() < 0.5) this.spawnEnemy("drone", b.x - 100, b.y + 40);
        } else {
          // claw slam telegraph — vertical blast
          this.bullets.push({
            x: px,
            y: 80,
            vx: 0,
            vy: 420,
            r: 8,
            dmg: 22,
            life: 1.2,
            friendly: false,
            color: C.warn,
            fromBoss: true,
            blast: 40,
          });
        }
      }
    } else if (b.kind === "seraph") {
      b.x = this.camX + W - 160;
      b.y += (py - b.y) * 1.2 * dt;
      b.y = clamp(b.y, 80, H - 80);
      if (b.timer > (b.phase === 3 ? 0.7 : 1.1)) {
        b.timer = 0;
        if (b.phase < 3) {
          for (let i = 0; i < b.phase + 1; i++) {
            this.enemyShot(b, px, py + (i - 1) * 40, 300, 12);
          }
          if (b.phase === 2) this.spawnEnemy("climber", b.x - 80, b.y);
        } else {
          // spear dive telegraph
          this.bullets.push({
            x: b.x,
            y: b.y,
            vx: -520,
            vy: (py - b.y) * 0.8,
            r: 7,
            dmg: 26,
            life: 1.4,
            friendly: false,
            color: C.pad,
            fromBoss: true,
            blast: 36,
          });
        }
      }
    } else if (b.kind === "prime") {
      b.x = this.camX + W - 200;
      b.y = H / 2 + Math.sin(b.timer * 0.5) * 40;
      if (b.timer > (b.phase === 3 ? 0.55 : 1.0)) {
        b.timer = 0;
        const n = 6 + b.phase * 2;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + b.timer;
          this.bullets.push({
            x: b.x,
            y: b.y,
            vx: Math.cos(a) * 200,
            vy: Math.sin(a) * 200,
            r: 4,
            dmg: 14,
            life: 2.5,
            friendly: false,
            color: C.cyan,
            fromBoss: true,
          });
        }
        if (b.phase >= 2 && Math.random() < 0.4) {
          this.spawnEnemy("gridsat", b.x - 120, b.y + (Math.random() - 0.5) * 160);
        }
        if (b.phase === 3 && Math.random() < 0.35) {
          this.spawnEnemy("ghost", this.player.x + 200, this.player.y);
        }
      }
    }

    // contact
    if (
      aabb(
        b.x - b.w / 2,
        b.y - b.h / 2,
        b.w,
        b.h,
        this.player.x - this.player.w / 2,
        this.player.y - this.player.h / 2,
        this.player.w,
        this.player.h,
      )
    ) {
      this.hurtPlayer(16);
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

    if (this.levelId === 1) {
      this.level.killClock = Math.max(0, this.level.killClock - dt);
      if (this.level.killClock <= 0 && !this.level.bossDefeated) {
        this.hurtPlayer(999);
        this.announce("KILL-CLOCK ZERO");
      }
    }

    // spawns
    const spawns = LEVEL_SPAWNS[this.levelId];
    while (
      this.level.spawnIndex < spawns.length &&
      spawns[this.level.spawnIndex]!.t <= this.level.elapsed
    ) {
      const s = spawns[this.level.spawnIndex]!;
      const sx = this.levelId === 1 ? s.x : this.camX + s.x * 0.4 + 500;
      this.spawnEnemy(s.kind, sx, s.y);
      this.level.spawnIndex++;
    }

    // boss trigger
    if (!this.level.bossSpawned) {
      const progress =
        this.levelId === 1
          ? this.player.x > this.level.length - 450
          : this.level.scroll > this.level.length - 400;
      if (progress || this.level.elapsed > 28) this.spawnBoss();
    }

    // player move
    const mob = 1 + this.upgrades.mobility * 0.08;
    if (this.player.kind === "ground") {
      const ax = this.input.axisX();
      this.player.vx = ax * 210 * mob;
      if (ax) this.player.facing = ax > 0 ? 1 : -1;
      this.player.vy += 1400 * dt;
      if (this.input.jumpJust() && this.player.phase === 0) {
        this.player.vy = -520;
        this.player.phase = 1;
      }
      this.player.x += this.player.vx * dt;
      this.player.y += this.player.vy * dt;

      // ground + platforms
      let onGround = false;
      const feet = this.player.y + this.player.h / 2;
      if (feet >= this.level.groundY) {
        this.player.y = this.level.groundY - this.player.h / 2;
        this.player.vy = 0;
        onGround = true;
      }
      for (const p of this.level.platforms) {
        if (
          this.player.vy >= 0 &&
          aabb(
            this.player.x - this.player.w / 2,
            this.player.y - this.player.h / 2,
            this.player.w,
            this.player.h,
            p.x,
            p.y,
            p.w,
            p.h,
          ) &&
          this.player.y < p.y
        ) {
          this.player.y = p.y - this.player.h / 2;
          this.player.vy = 0;
          onGround = true;
        }
      }
      this.player.phase = onGround ? 0 : 1;
      this.player.x = clamp(this.player.x, 40, this.level.length - 40);
      this.camX = clamp(this.player.x - W * 0.35, 0, this.level.length - W);
    } else if (this.player.kind === "ship") {
      this.level.scroll += 140 * dt;
      this.camX = this.level.scroll;
      const ax = this.input.axisX();
      const ay = this.input.axisY();
      this.player.vx = ax * 220 * mob;
      this.player.vy = ay * 240 * mob;
      this.shipThrust = ay < 0 || ax !== 0 ? 1 : 0.35;
      this.player.x = clamp(this.player.x + this.player.vx * dt, this.camX + 60, this.camX + W - 80);
      this.player.y = clamp(this.player.y + this.player.vy * dt, 50, H - 50);
      // gates
      for (const g of this.gates) {
        if (!g.hit && Math.hypot(this.player.x - (this.camX + (g.x % W)), this.player.y - g.y) < 50) {
          // world-relative gates along scroll
        }
        const gx = g.x;
        if (!g.hit && Math.abs(this.level.scroll - gx) < 40 && Math.abs(this.player.y - g.y) < 55) {
          g.hit = true;
          this.level.gatesCleared++;
          this.scrap += 5;
          this.announce("TRAJECTORY GATE");
          this.burst(this.player.x, this.player.y, C.warn, 10);
        }
      }
    } else {
      // EVA
      this.level.scroll += 70 * dt;
      this.camX = this.level.scroll;
      const ax = this.input.axisX();
      const ay = this.input.axisY();
      this.player.vx += ax * 420 * dt * mob;
      this.player.vy += ay * 420 * dt * mob;
      this.player.vx *= 0.96;
      this.player.vy *= 0.96;
      if (ax) this.player.facing = ax > 0 ? 1 : -1;
      this.player.x += this.player.vx * dt;
      this.player.y += this.player.vy * dt;
      this.player.x = clamp(this.player.x, this.camX + 40, this.camX + W - 40);
      this.player.y = clamp(this.player.y, 40, H - 40);
      // soft platforms
      for (const p of this.level.platforms) {
        const wx = p.x;
        if (
          aabb(
            this.player.x - this.player.w / 2,
            this.player.y - this.player.h / 2,
            this.player.w,
            this.player.h,
            wx,
            p.y,
            p.w,
            p.h,
          )
        ) {
          this.player.vy *= 0.5;
          this.player.y = p.y - this.player.h / 2;
        }
      }
    }

    if (this.input.shoot()) this.fireWeapon();
    if (this.input.specialJust()) this.fireSpecial();

    // enemies
    for (const e of this.enemies) {
      if (!e.dead) this.updateEnemy(e, dt);
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
    this.updateBoss(dt);

    // bullets
    for (const b of this.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.friendly) {
        for (const e of this.enemies) {
          if (e.dead) continue;
          if (aabb(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2, e.x - e.w / 2, e.y - e.h / 2, e.w, e.h)) {
            // mirror reflects until stunned (flash)
            if (e.kind === "mirror" && e.flash <= 0 && Math.random() < 0.6) {
              b.vx *= -1;
              b.friendly = false;
              b.color = C.blood;
              continue;
            }
            e.hp -= b.dmg;
            e.flash = 0.1;
            if (!b.pierce) b.life = 0;
            if (b.blast) this.aoe(b.x, b.y, b.blast, b.dmg * 0.6);
            if (e.hp <= 0) this.killEnemy(e);
          }
        }
        if (this.boss && !this.boss.dead) {
          const boss = this.boss;
          if (
            aabb(
              b.x - b.r,
              b.y - b.r,
              b.r * 2,
              b.r * 2,
              boss.x - boss.w / 2,
              boss.y - boss.h / 2,
              boss.w,
              boss.h,
            )
          ) {
            boss.hp -= b.dmg;
            boss.flash = 0.12;
            if (!b.pierce) b.life = 0;
            this.burst(b.x, b.y, C.warn, 4);
            if (boss.hp <= 0) {
              boss.dead = true;
              this.level.bossDefeated = true;
              this.burst(boss.x, boss.y, C.cyan, 40);
              this.scrap += boss.scrap ?? 40;
              this.score += 2500;
              this.shake = 16;
              this.mode = "clear";
              this.announce(`${BOSS[this.levelId].name} DOWN`, 3);
              if (this.levelId === 3) this.stinger = true;
            }
          }
        }
      } else if (
        aabb(
          b.x - b.r,
          b.y - b.r,
          b.r * 2,
          b.r * 2,
          this.player.x - this.player.w / 2,
          this.player.y - this.player.h / 2,
          this.player.w,
          this.player.h,
        )
      ) {
        this.hurtPlayer(b.dmg);
        b.life = 0;
        if (b.blast) this.burst(b.x, b.y, C.blood, 10);
      }
    }
    this.bullets = this.bullets.filter(
      (b) => b.life > 0 && b.x > this.camX - 40 && b.x < this.camX + W + 80 && b.y > -40 && b.y < H + 40,
    );

    // pickups
    for (const p of this.pickups) {
      p.life -= dt;
      if (
        aabb(
          p.x - 10,
          p.y - 10,
          20,
          20,
          this.player.x - this.player.w / 2,
          this.player.y - this.player.h / 2,
          this.player.w,
          this.player.h,
        )
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
        this.burst(p.x, p.y, C.warn, 6);
      }
    }
    this.pickups = this.pickups.filter((p) => p.life > 0);

    // particles
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    // tech rescues (Metal Slug POW beat)
    if (this.levelId === 1) {
      for (const tech of this.techs) {
        if (
          !tech.rescued &&
          Math.hypot(this.player.x - tech.x, this.player.y - tech.y) < 36
        ) {
          tech.rescued = true;
          this.rescued += 1;
          this.scrap += 8;
          this.score += 300;
          this.announce(`TECH RESCUED ${this.rescued}/${this.techs.length}`);
          this.burst(tech.x, tech.y, C.warn, 10);
        }
      }
    }
  }

  private aoe(x: number, y: number, r: number, dmg: number) {
    this.burst(x, y, C.pad, 16);
    for (const e of this.enemies) {
      if (!e.dead && Math.hypot(e.x - x, e.y - y) < r) {
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
          else {
            this.mode = "victory";
          }
        } else {
          const cost = 8 + this.upgrades[pick] * 6;
          if (this.scrap >= cost) {
            this.scrap -= cost;
            this.upgrades[pick] += 1;
            this.announce(`UPGRADED ${pick.toUpperCase()}`);
          } else {
            this.announce("NEED MORE SCRAP");
          }
        }
      }
      return;
    }

    if (this.mode === "clear") {
      this.msgTimer -= dt;
      if (this.input.confirm() || this.input.just("enter") || this.msgTimer < -1) {
        this.totalScore += this.score;
        if (this.levelId === 3) {
          this.mode = "victory";
        } else {
          this.mode = "upgrade";
          this.upgradeIndex = 6;
          this.announce("FABRICATOR ONLINE");
        }
      }
      return;
    }

    if (this.mode === "dead") {
      if (this.input.confirm() || this.input.just("enter")) {
        this.beginLevel(this.levelId);
      }
      if (this.input.just("escape")) this.mode = "title";
      return;
    }

    if (this.mode === "victory") {
      if (this.input.confirm() || this.input.just("enter")) this.mode = "title";
      return;
    }

    if (this.mode === "play" || this.mode === "boss") {
      this.updatePlay(dt);
    }
  }

  private renderBg() {
    const ctx = this.ctx;
    const t = this.frame;
    if (this.levelId === 1) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0a1328");
      g.addColorStop(0.55, "#152238");
      g.addColorStop(1, "#1a1510");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // rain
      ctx.strokeStyle = "rgba(174,198,220,0.25)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 60; i++) {
        const x = ((i * 97 + t * 8) % (W + 40)) - 20;
        const y = ((i * 53 + t * 14) % (H + 40)) - 20;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 2, y + 12);
        ctx.stroke();
      }
      // lightning flash
      if (Math.sin(t * 0.03) > 0.992) {
        ctx.fillStyle = "rgba(200,220,255,0.12)";
        ctx.fillRect(0, 0, W, H);
      }
      // gantries parallax
      for (let i = 0; i < 8; i++) {
        const gx = ((i * 380 - this.camX * 0.4) % (W + 200)) - 100;
        rr(ctx, gx, 120, 18, 350, "#2a3348", "#0b1220");
        rr(ctx, gx - 30, 140 + (i % 3) * 60, 80, 8, "#3a455c");
      }
      // sodium glow
      glow(ctx, W * 0.7, 80, 160, C.pad, 0.15);
      // ground
      rr(ctx, 0, this.level.groundY - this.camY, W, H, "#2b2118");
      rr(ctx, 0, this.level.groundY - this.camY, W, 6, C.pad);
      // platforms
      for (const p of this.level.platforms) {
        const sx = p.x - this.camX;
        if (sx > -50 && sx < W + 50) {
          rr(ctx, sx, p.y, p.w, p.h, C.metal, C.soot);
          rr(ctx, sx, p.y, p.w, 3, C.warn);
        }
      }
      // stranded techs
      for (const tech of this.techs) {
        if (tech.rescued) continue;
        const tx = tech.x - this.camX;
        if (tx > -20 && tx < W + 20) {
          glow(ctx, tx, tech.y, 14, C.warn, 0.25);
          rr(ctx, tx - 6, tech.y - 14, 12, 18, C.bone, C.soot);
          rr(ctx, tx - 4, tech.y - 22, 8, 8, C.warn, C.soot);
        }
      }
      // pad in distance
      const padX = this.level.length - 280 - this.camX;
      if (padX < W + 100) {
        rr(ctx, padX, 200, 40, 270, C.metalLite, C.soot);
        rr(ctx, padX + 50, 160, 50, 310, C.bone, C.soot);
        glow(ctx, padX + 75, 480, 40, C.pad, 0.4);
        ctx.fillStyle = C.warn;
        ctx.font = "10px monospace";
        ctx.fillText("PAD 7", padX + 55, 150);
      }
    } else if (this.levelId === 2) {
      const alt = this.level.scroll / this.level.length;
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `rgb(${20 - alt * 15},${30 - alt * 20},${60 + alt * 20})`);
      g.addColorStop(1, alt > 0.5 ? "#05070e" : "#3a4a6a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // clouds
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      for (let i = 0; i < 10; i++) {
        const cx = ((i * 200 - this.camX * 0.2) % (W + 120)) - 60;
        const cy = 80 + (i % 5) * 70;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 70, 16, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (alt > 0.45) {
        // stars
        ctx.fillStyle = C.bone;
        for (let i = 0; i < 40; i++) {
          ctx.fillRect((i * 73) % W, (i * 97) % H, 2, 2);
        }
      }
      // gates
      for (const gate of this.gates) {
        const gx = gate.x - this.level.scroll + 300;
        if (gx > -40 && gx < W + 40) {
          ctx.strokeStyle = gate.hit ? C.metal : C.warn;
          ctx.lineWidth = 3;
          ctx.strokeRect(gx - 28, gate.y - 40, 56, 80);
          glow(ctx, gx, gate.y, 30, gate.hit ? C.metal : C.warn, 0.25);
        }
      }
    } else {
      ctx.fillStyle = C.void;
      ctx.fillRect(0, 0, W, H);
      // stars
      ctx.fillStyle = C.bone;
      for (let i = 0; i < 80; i++) {
        const sx = ((i * 67 - this.camX * 0.15) % W + W) % W;
        const sy = (i * 91) % H;
        ctx.globalAlpha = 0.4 + (i % 3) * 0.2;
        ctx.fillRect(sx, sy, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
      }
      ctx.globalAlpha = 1;
      // earth limb
      glow(ctx, W * 0.2, H + 40, 220, C.earth, 0.35);
      ctx.fillStyle = "#1b3a6e";
      ctx.beginPath();
      ctx.ellipse(W * 0.15, H + 60, 260, 120, 0, Math.PI, 0);
      ctx.fill();
      // wreck platforms
      for (const p of this.level.platforms) {
        const sx = p.x - this.camX;
        if (sx > -60 && sx < W + 60) {
          rr(ctx, sx, p.y, p.w, p.h, C.metal, C.cyan);
          glow(ctx, sx + p.w / 2, p.y, 20, C.cyan, 0.15);
        }
      }
      // solar blades parallax
      ctx.strokeStyle = "rgba(244,211,94,0.35)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const x = ((i * 240 - this.camX * 0.3) % (W + 100)) - 50;
        ctx.beginPath();
        ctx.moveTo(x, 40);
        ctx.lineTo(x + 80, 200);
        ctx.stroke();
      }
    }
  }

  private renderHud() {
    const ctx = this.ctx;
    // top bar
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
    ctx.fillText(
      this.weapon === "pistol" ? "∞" : `AMMO ${this.ammo}`,
      400,
      22,
    );
    ctx.fillStyle = C.bone;
    ctx.fillText(`EMP ${this.special}`, 500, 22);
    ctx.fillText(`SCRAP ${this.scrap}`, 580, 22);
    ctx.fillStyle = C.cyan;
    ctx.fillText(this.level.objective, 680, 22);

    if (this.levelId === 1) {
      ctx.fillStyle = this.level.killClock < 30 ? C.blood : C.warn;
      ctx.fillText(
        `KILL-CLOCK ${Math.ceil(this.level.killClock)}s · TECHS ${this.rescued}/${this.techs.length}`,
        12,
        54,
      );
    }
    if (this.levelId === 2) {
      ctx.fillStyle = C.warn;
      ctx.fillText(
        `GATES ${this.level.gatesCleared}/${this.gates.length} · ALT ${Math.floor((this.level.scroll / this.level.length) * 100)}%`,
        12,
        54,
      );
    }

    if (this.boss && !this.boss.dead) {
      const name = BOSS[this.levelId].name;
      ctx.fillStyle = "rgba(11,18,32,0.8)";
      ctx.fillRect(W / 2 - 180, 44, 360, 28);
      ctx.fillStyle = C.cyan;
      ctx.font = "11px 'Share Tech Mono', monospace";
      ctx.fillText(`SIGNAL · ${name}`, W / 2 - 170, 56);
      rr(ctx, W / 2 - 170, 62, 340, 8, C.soot);
      rr(
        ctx,
        W / 2 - 170,
        62,
        340 * clamp(this.boss.hp / this.boss.maxHp, 0, 1),
        8,
        C.cyan,
      );
    }

    if (this.msgTimer > 0 || this.mode === "dead") {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(W / 2 - 200, H / 2 - 30, 400, 40);
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
    ctx.translate(sx, sy);

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

    // entities
    for (const p of this.pickups) {
      drawPickup(ctx, p.kind === "scrap" ? "scrap" : "weapon", p.x - this.camX, p.y, this.frame);
    }
    for (const e of this.enemies) {
      if (e.flash > 0) ctx.globalAlpha = 0.5;
      drawEnemy(ctx, e.kind, e.x - this.camX, e.y, this.frame, e.facing);
      ctx.globalAlpha = 1;
    }
    if (this.boss && !this.boss.dead) {
      if (this.boss.flash > 0) ctx.globalAlpha = 0.55;
      drawBoss(
        ctx,
        this.boss.kind,
        this.boss.x - this.camX,
        this.boss.y,
        this.frame,
        this.boss.hp / this.boss.maxHp,
        this.boss.phase,
      );
      ctx.globalAlpha = 1;
    }

    // player
    if (!this.player.dead) {
      if (this.invuln > 0 && Math.floor(this.frame / 2) % 2 === 0) ctx.globalAlpha = 0.4;
      if (this.player.kind === "ship") {
        drawShip(ctx, this.player.x - this.camX, this.player.y, this.shipThrust, this.player.flash > 0);
      } else {
        drawAsh(
          ctx,
          this.player.x - this.camX,
          this.player.y,
          this.player.facing,
          this.frame,
          this.player.kind === "eva" ? "eva" : "ground",
        );
      }
      ctx.globalAlpha = 1;
    }

    // bullets
    for (const b of this.bullets) {
      glow(ctx, b.x - this.camX, b.y, b.r * 3, b.color, 0.25);
      rr(ctx, b.x - this.camX - b.r, b.y - b.r, b.r * 2, b.r * 2, b.color);
    }
    // particles
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life * 2, 0, 1);
      rr(ctx, p.x - this.camX, p.y, p.size, p.size, p.color);
      ctx.globalAlpha = 1;
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
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#070b14");
    g.addColorStop(0.5, "#152238");
    g.addColorStop(1, "#1a0f0a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // decorative towers
    for (let i = 0; i < 6; i++) {
      rr(ctx, 40 + i * 160, 200 + (i % 2) * 40, 22, 340, "#243044", "#0b1220");
    }
    glow(ctx, W / 2, 180, 200, C.pad, 0.2);
    glow(ctx, W / 2 + 120, 120, 100, C.cyan, 0.15);

    ctx.textAlign = "center";
    ctx.fillStyle = C.cyan;
    ctx.font = "14px 'Share Tech Mono', monospace";
    ctx.fillText("OPERATION ORBITAL BREAK", W / 2, 120);
    ctx.fillStyle = C.bone;
    ctx.font = "64px 'Black Ops One', sans-serif";
    ctx.fillText("STAR MIND", W / 2, 190);
    ctx.fillStyle = C.pad;
    ctx.font = "14px 'Share Tech Mono', monospace";
    ctx.fillText("METAL SLUG DNA  ·  SPACE-PUNK LEO WAR", W / 2, 220);

    drawAsh(ctx, W / 2 - 80, 340, 1, this.frame, "ground");
    drawShip(ctx, W / 2 + 90, 330, 0.8);

    const items = ["L1 · EARTH ESCAPE", "L2 · LAUNCH!", "L3 · ORBIT"];
    items.forEach((label, i) => {
      const y = 390 + i * 32;
      const sel = i === this.menuIndex;
      ctx.fillStyle = sel ? C.warn : C.bone;
      ctx.font = sel
        ? "18px 'Black Ops One', sans-serif"
        : "15px 'Share Tech Mono', monospace";
      ctx.fillText(`${sel ? "▸ " : "  "}${label}`, W / 2, y);
    });
    ctx.fillStyle = "rgba(244,237,228,0.55)";
    ctx.font = "12px 'Share Tech Mono', monospace";
    ctx.fillText("A/D move · W/SPACE jump · J shoot · K EMP · ENTER confirm", W / 2, 510);
    ctx.textAlign = "left";
    this.frame++;
  }

  private renderBriefingOverlay() {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(5,8,16,0.72)";
    ctx.fillRect(80, 80, W - 160, H - 160);
    ctx.strokeStyle = C.cyan;
    ctx.strokeRect(80.5, 80.5, W - 161, H - 161);
    ctx.fillStyle = C.pad;
    ctx.font = "22px 'Black Ops One', sans-serif";
    ctx.fillText(this.level.name, 110, 130);
    ctx.fillStyle = C.bone;
    ctx.font = "14px 'Share Tech Mono', monospace";
    const lines =
      this.levelId === 1
        ? [
            "CAPCOM NIX: Starbase Atlas is dark. STAR MIND owns the uplink.",
            "Get to Pad 7. Board BLACK FINCH before the kill-clock hits zero.",
            "Expect Null Drones, Sentry Crabs, and a gantry that learned to hate.",
            "",
            "BOSS: PAD REAPER — claw, weld-laser, exposed core on slam.",
          ]
        : this.levelId === 2
          ? [
              "CAPCOM NIX: Throttle up. You are the ship now.",
              "Ride the plume through the cloud deck. Thread trajectory gates.",
              "SAMs and Climb Drones will match your altitude.",
              "",
              "BOSS: STRATOS SERAPH — wing guns, mirror drones, spear dive.",
            ]
          : [
              "CAPCOM NIX: Hatch open. EVA authorized.",
              "Break sat formations. Priority-kill Repair Beetles.",
              "Mirror Shards reflect fire until stunned. Cut to the Prime Node.",
              "",
              "FINAL BOSS: STAR MIND PRIME — rings, petals, mind-lash, panic cascade.",
            ];
    lines.forEach((ln, i) => ctx.fillText(ln, 110, 170 + i * 28));
    ctx.fillStyle = C.warn;
    ctx.fillText("PRESS ENTER / J TO DEPLOY", 110, H - 120);
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
    ctx.fillText("ENTER · continue", W / 2, H / 2 + 36);
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

    const rows: { key: keyof Upgrades | "next"; label: string }[] = [
      { key: "damage", label: "DAMAGE" },
      { key: "fireRate", label: "FIRE RATE" },
      { key: "armor", label: "ARMOR" },
      { key: "mag", label: "MAG SIZE" },
      { key: "special", label: "EMP CHARGES" },
      { key: "mobility", label: "MOBILITY" },
      { key: "next", label: "▶ NEXT LEVEL" },
    ];
    rows.forEach((r, i) => {
      const sel = i === this.upgradeIndex;
      const y = 190 + i * 36;
      const cost =
        r.key === "next" ? 0 : 8 + this.upgrades[r.key] * 6;
      const lvl = r.key === "next" ? "" : `Lv ${this.upgrades[r.key]}  ·  cost ${cost}`;
      ctx.fillStyle = sel ? C.warn : C.bone;
      ctx.font = sel
        ? "18px 'Black Ops One', sans-serif"
        : "15px 'Share Tech Mono', monospace";
      ctx.fillText(`${sel ? "▸ " : "  "}${r.label}   ${lvl}`, W / 2, y);
    });
    ctx.textAlign = "left";
    if (this.msgTimer > 0) {
      ctx.fillStyle = C.cyan;
      ctx.textAlign = "center";
      ctx.fillText(this.msg, W / 2, H - 40);
      ctx.textAlign = "left";
      this.msgTimer -= 0.016;
    }
  }

  private renderVictory() {
    const ctx = this.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#05070e");
    g.addColorStop(1, "#0b1220");
    ctx.fillStyle = g;
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
    // blinking sat
    if (Math.floor(this.frame / 20) % 2 === 0) {
      glow(ctx, W / 2 + 180, 120, 16, C.cyan, 0.8);
      rr(ctx, W / 2 + 176, 116, 8, 8, C.cyan);
    }
    this.frame++;
  }
}
