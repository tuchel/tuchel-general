import { AudioEngine } from "../engine/audio";
import { InputManager, type InputState } from "../engine/input";
import type {
  AlertState,
  BossEntity,
  Checkpoint,
  CodecScript,
  DebrisHazard,
  EnemyEntity,
  HackNode,
  LaserBarrier,
  MissionDef,
  MissionId,
  MissionStats,
  PickupItem,
  Platform,
  PowHostage,
  Projectile,
  SaveData,
  WeaponId,
} from "../engine/types";
import { VfxSystem } from "../engine/vfx";
import { OrbitalInkRenderer, VIEW_H, VIEW_W } from "../art/renderer";
import { MISSIONS } from "../missions/missions";
import { computeMissionStats } from "./ranking";
import {
  createStealthState,
  escalateToAlert,
  evaluateEnemyVision,
  notifyEnemyNeutralized,
  triggerSpotterDetection,
  updateStealthTimers,
  type StealthControllerState,
} from "./stealth";
import { CODEC_SCRIPTS } from "./story";
import { WEAPON_ORDER, WEAPONS } from "./weapons";

export interface HudSnapshot {
  missionCode: string;
  missionTitle: string;
  mode: MissionDef["mode"];
  hp: number;
  maxHp: number;
  weaponId: WeaponId;
  weaponName: string;
  ammo: number; // -1 infinite
  empCount: number;
  inBox: boolean;
  coldDrift: boolean;
  camoUnlocked: boolean;
  camoActive: boolean;
  camoCooldown: number;
  alertState: AlertState;
  alertTimer: number;
  score: number;
  powsRescued: number;
  powsTotal: number;
  boss: { name: string; hp: number; maxHp: number; phase: number } | null;
  hudGlitched: boolean;
  nearInteract: string | null;
  progressPct: number;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudSnapshot) => void;
  onCodec: (script: CodecScript, onComplete?: () => void) => void;
  onMissionComplete: (stats: MissionStats, newShards: string[]) => void;
  onFinalChoice: (stats: MissionStats, newShards: string[]) => void;
  onPauseRequested: () => void;
}

export class ConstellationGameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer = new OrbitalInkRenderer();
  private vfx = new VfxSystem();
  public audio: AudioEngine;
  public input: InputManager;
  private callbacks: EngineCallbacks;
  private saveData: SaveData;

  private rafId: number | null = null;
  private lastTimestamp = 0;
  private paused = false;
  private modalHold = false; // held during Codec or final choice
  private running = false;

  private mission: MissionDef = MISSIONS[1];
  private platforms: Platform[] = [];
  private enemies: EnemyEntity[] = [];
  private pows: PowHostage[] = [];
  private hackNodes: HackNode[] = [];
  private lasers: LaserBarrier[] = [];
  private pickups: PickupItem[] = [];
  private checkpoints: Checkpoint[] = [];
  private triggers: Array<MissionDef["triggers"][number] & { triggered: boolean }> = [];
  private debris: DebrisHazard[] = [];
  private projectiles: Projectile[] = [];
  private boss: BossEntity | null = null;

  private stealth: StealthControllerState = createStealthState();

  // Player state
  private player = {
    x: 80,
    y: 400,
    w: 28,
    h: 52,
    vx: 0,
    vy: 0,
    facing: 1 as 1 | -1,
    aimAngle: 0,
    crouching: false,
    onGround: false,
    coyoteTimer: 0,
    inBox: false,
    boxMovedTimer: 0,
    coldDrift: false,
    evaFuel: 1,
    hp: 100,
    maxHp: 100,
    invulnTimer: 0,
    fireCooldown: 0,
    cqcCooldown: 0,
    cqcAnim: 0,
    camoTimer: 0,
    camoCooldown: 0,
    weaponId: "silenced_rail" as WeaponId,
    ammo: {} as Record<WeaponId, number>,
    empCount: 3,
    animTime: 0,
  };

  private checkpointPos = { x: 80, y: 400 };
  private cameraX = 0;
  private missionTime = 0;
  private worldTime = 0;
  private score = 0;
  private damageTaken = 0;
  private cqcTakedowns = 0;
  private enemiesNeutralized = 0;
  private collectedShards: string[] = [];
  private nextProjId = 1;
  private hudEmitAccum = 0;
  private debrisSpawnTimer = 0;
  private missionFinished = false;
  private exitUnlocked = false;
  private nearInteractLabel: string | null = null;
  private bannerText = "";
  private bannerTimer = 0;
  private bossSplash = { active: false, timer: 0, name: "", subtitle: "", quote: "" };

  constructor(
    canvas: HTMLCanvasElement,
    audio: AudioEngine,
    input: InputManager,
    saveData: SaveData,
    callbacks: EngineCallbacks
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.ctx = ctx;
    this.audio = audio;
    this.input = input;
    this.saveData = saveData;
    this.callbacks = callbacks;
    this.input.attachCanvasMouse(canvas);
  }

  public updateSaveData(save: SaveData): void {
    this.saveData = save;
  }

  public startMission(id: MissionId): void {
    this.mission = MISSIONS[id];
    this.loadMissionFresh();
    this.running = true;
    this.paused = false;
    this.modalHold = false;
    this.lastTimestamp = performance.now();
    this.audio.unlock();
    this.audio.setMusicMode("stealth");

    // Intro Codec call
    const intro = CODEC_SCRIPTS[this.mission.introCodecId];
    if (intro) {
      this.modalHold = true;
      this.callbacks.onCodec(intro, () => {
        this.modalHold = false;
        this.showBanner(`${this.mission.code} // ${this.mission.title}`);
      });
    } else {
      this.showBanner(`${this.mission.code} // ${this.mission.title}`);
    }

    this.emitHud();
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  public stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public setPaused(p: boolean): void {
    this.paused = p;
    if (!p) this.lastTimestamp = performance.now();
  }

  public setModalHold(hold: boolean): void {
    this.modalHold = hold;
    if (!hold) {
      this.input.clearAll();
      this.lastTimestamp = performance.now();
    }
  }

  public restartFromCheckpoint(): void {
    this.player.x = this.checkpointPos.x;
    this.player.y = this.checkpointPos.y - 54;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.hp = this.player.maxHp;
    this.player.invulnTimer = 1.6;
    this.player.inBox = false;
    this.projectiles = [];
    this.stealth.alertState = "CAUTION";
    this.stealth.alertTimer = 0;
    this.stealth.reflexTimer = 0;
    this.stealth.cautionTimer = 4;
    this.vfx.addFlash("#4DA8DA", 0.35);
    this.showBanner("CHECKPOINT RESTORED // RESUME INFILTRATION");
  }

  private loadMissionFresh(): void {
    const m = this.mission;
    this.vfx.clear();
    this.platforms = m.platforms.map((p) => ({ ...p }));
    this.enemies = m.enemies.map((e) => ({
      ...e,
      awareness: 0,
      state: "patrol",
      stunTimer: 0,
      fireCooldown: 0.6 + Math.random() * 0.6,
      investigateX: e.x,
      investigateTimer: 0,
      animTime: Math.random() * 5,
      hitFlash: 0,
    }));
    this.pows = m.pows.map((p) => ({ ...p, rescued: false, animTime: 0 }));
    this.hackNodes = m.hackNodes.map((n) => ({ ...n, hacked: false }));
    this.lasers = m.lasers.map((l) => ({ ...l, disabled: false }));
    this.pickups = m.pickups.map((p) => ({ ...p, vy: 0, collected: false, bobTime: 0 }));
    this.checkpoints = m.checkpoints.map((c) => ({ ...c, reached: false }));
    this.triggers = m.triggers.map((t) => ({ ...t, triggered: false }));
    this.debris = [];
    this.projectiles = [];

    const bs = m.bossSpec;
    this.boss = {
      id: bs.id,
      name: bs.name,
      subtitle: bs.subtitle,
      quote: bs.quote,
      x: bs.x,
      y: bs.y,
      w: bs.w,
      h: bs.h,
      vx: 0,
      vy: 0,
      hp: bs.maxHp,
      maxHp: bs.maxHp,
      phase: 1,
      maxPhases: bs.maxPhases,
      active: false,
      defeated: false,
      stateTimer: 1.4,
      attackIndex: 0,
      attackTelegraph: 0,
      vulnerableTimer: 0,
      stunTimer: 0,
      hitFlash: 0,
      shieldAngle: Math.PI,
      hudGlitchTimer: 0,
      clones: [],
      relays:
        bs.id === "mirror"
          ? [
              { id: "r1", x: 3160, y: 240, hp: 60, maxHp: 60, active: true },
              { id: "r2", x: 3430, y: 175, hp: 60, maxHp: 60, active: true },
              { id: "r3", x: 3690, y: 240, hp: 60, maxHp: 60, active: true },
            ]
          : [],
      sweepingBeamAngle: Math.PI,
      sweepingBeamActive: false,
    };

    this.stealth = createStealthState();
    this.player.x = m.startPos.x;
    this.player.y = m.startPos.y;
    this.player.w = m.mode === "starship" ? 56 : 28;
    this.player.h = m.mode === "starship" ? 30 : 52;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.facing = 1;
    this.player.aimAngle = 0;
    this.player.crouching = false;
    this.player.inBox = false;
    this.player.coldDrift = false;
    this.player.evaFuel = 1;
    this.player.hp = 100;
    this.player.maxHp = 100;
    this.player.invulnTimer = 0.5;
    this.player.fireCooldown = 0;
    this.player.cqcCooldown = 0;
    this.player.cqcAnim = 0;
    this.player.camoTimer = 0;
    this.player.camoCooldown = 0;
    this.player.weaponId = m.mode === "starship" ? "pulse_carbine" : "silenced_rail";
    this.player.ammo = {
      silenced_rail: -1,
      pulse_carbine: m.mode === "starship" ? 140 : 40,
      mag_shotgun: 0,
      piercing_rail: 0,
      micro_missiles: m.mode === "starship" ? 8 : 0,
    };
    this.player.empCount = 3;

    this.checkpointPos = { x: m.startPos.x, y: m.startPos.y + 52 };
    this.cameraX = 0;
    this.missionTime = 0;
    this.worldTime = 0;
    this.score = 0;
    this.damageTaken = 0;
    this.cqcTakedowns = 0;
    this.enemiesNeutralized = 0;
    this.collectedShards = [];
    this.missionFinished = false;
    this.exitUnlocked = false;
    this.bossSplash = { active: false, timer: 0, name: "", subtitle: "", quote: "" };
  }

  private showBanner(text: string): void {
    this.bannerText = text;
    this.bannerTimer = 3.0;
  }

  private loop = (ts: number): void => {
    if (!this.running) return;
    const rawDt = Math.min(0.05, Math.max(0.001, (ts - this.lastTimestamp) / 1000));
    this.lastTimestamp = ts;

    if (!this.paused && !this.modalHold) {
      this.step(rawDt);
    }

    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private step(realDt: number): void {
    const inp = this.input.poll();

    if (inp.pausePressed) {
      this.callbacks.onPauseRequested();
      return;
    }

    // Secret contextual Codec call!
    if (inp.codecPressed && !this.bossSplash.active) {
      this.triggerContextualCodec();
      return;
    }

    // Boss intro splash card pause
    if (this.bossSplash.active) {
      this.bossSplash.timer -= realDt;
      if (this.bossSplash.timer <= 0 || inp.firePressed || inp.jumpPressed) {
        this.bossSplash.active = false;
      }
      return;
    }

    // Impact hit-stop freeze
    if (this.vfx.hitStop > 0) {
      this.vfx.hitStop = Math.max(0, this.vfx.hitStop - realDt);
      this.vfx.update(realDt * 0.25);
      return;
    }

    // Reflex Slow-Mo scales world simulation to 22% while player aiming stays crisp!
    const timeScale = this.stealth.reflexTimer > 0 ? 0.22 : 1.0;
    const dt = realDt * timeScale;

    this.missionTime += realDt;
    this.worldTime += dt;
    if (this.bannerTimer > 0) this.bannerTimer = Math.max(0, this.bannerTimer - realDt);

    this.updatePlayer(inp, dt, realDt);
    this.updateTriggersAndCheckpoints();
    this.updateEnemies(dt, realDt);
    this.updateBoss(dt, realDt);
    this.updateDebris(dt);
    this.updateProjectiles(dt);
    this.updatePickupsAndLasers(dt);
    this.vfx.update(realDt);

    // Smooth lookahead camera
    const targetCam = this.boss?.active
      ? this.mission.bossArenaMinX
      : Math.max(
          0,
          Math.min(
            this.mission.width - VIEW_W,
            this.player.x - VIEW_W * 0.34 + this.player.facing * 52
          )
        );
    this.cameraX += (targetCam - this.cameraX) * Math.min(1, realDt * 7.5);

    this.audio.syncAlertState(this.stealth.alertState, Boolean(this.boss?.active && !this.boss.defeated));

    this.hudEmitAccum += realDt;
    if (this.hudEmitAccum >= 0.06) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private triggerContextualCodec(): void {
    let script = CODEC_SCRIPTS.secret_general;
    if (this.player.inBox) {
      script = CODEC_SCRIPTS.secret_box;
    } else if (this.mission.id === 3) {
      script = CODEC_SCRIPTS.secret_earth;
    }
    this.audio.playCodecRing();
    this.modalHold = true;
    this.callbacks.onCodec(script, () => {
      this.modalHold = false;
    });
  }

  private updatePlayer(inp: InputState, dt: number, realDt: number): void {
    const p = this.player;
    const mode = this.mission.mode;

    p.animTime += dt;
    p.invulnTimer = Math.max(0, p.invulnTimer - realDt);
    p.fireCooldown = Math.max(0, p.fireCooldown - realDt);
    p.cqcCooldown = Math.max(0, p.cqcCooldown - realDt);
    p.cqcAnim = Math.max(0, p.cqcAnim - realDt);
    p.boxMovedTimer = Math.max(0, p.boxMovedTimer - realDt);
    p.camoTimer = Math.max(0, p.camoTimer - realDt);
    p.camoCooldown = Math.max(0, p.camoCooldown - realDt);

    // Weapon swapping
    if (inp.weaponNextPressed) this.cycleWeapon();
    if (inp.weaponSelect !== null) {
      const target = WEAPON_ORDER[inp.weaponSelect];
      if (target && this.hasAmmoFor(target)) {
        p.weaponId = target;
        this.audio.playUiClick();
      }
    }

    // Unlockable Optical Camo Cloak
    if (inp.camoPressed && this.saveData.unlocks.opticalCamo && p.camoCooldown <= 0) {
      p.camoTimer = 5.5;
      p.camoCooldown = 14;
      this.vfx.spawnRing(p.x + p.w * 0.5, p.y + p.h * 0.5, "#57C7FF", 70);
      this.vfx.addCallout(p.x + p.w * 0.5, p.y - 12, "OPTICAL CAMO", "#57C7FF", 1.1);
      this.audio.playHackSuccess();
    }

    // Mode-specific movement
    if (mode === "starship") {
      // Mission 2: Smooth 2D Starship Flight + Cold Drift thermal stealth!
      p.coldDrift = inp.boxHeld;
      const boost = inp.jumpHeld && !p.coldDrift ? 1.45 : 1.0;
      const autoCruise = this.boss?.active ? 0 : p.coldDrift ? 115 : 175;
      const moveSpeedX = (p.coldDrift ? 160 : 250) * boost;
      const moveSpeedY = (p.coldDrift ? 185 : 275) * boost;

      p.vx = autoCruise + inp.moveX * moveSpeedX;
      p.vy = inp.moveY * moveSpeedY;
      p.facing = 1;

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const minX = this.boss?.active ? this.mission.bossArenaMinX + 20 : this.cameraX + 22;
      const maxX = this.boss?.active
        ? this.mission.bossArenaMinX + VIEW_W * 0.55
        : this.mission.width - 70;
      p.x = Math.max(minX, Math.min(maxX, p.x));
      p.y = Math.max(46, Math.min(VIEW_H - 64, p.y));

      if (!p.coldDrift && Math.random() < 0.55) {
        this.vfx.spawnThruster(p.x - 4, p.y + p.h * 0.5, -140, (Math.random() - 0.5) * 20, "#57C7FF");
      }
    } else {
      // Foot & EVA movement
      if (inp.boxPressed) {
        p.inBox = !p.inBox;
        this.audio.playBoxToggle();
        this.vfx.addCallout(p.x + p.w * 0.5, p.y - 10, p.inBox ? "MLI BOX ON" : "BOX OFF", "#E8C66D", 0.9);
      }

      p.crouching = inp.crouch && p.onGround && !p.inBox;
      const speed = p.inBox ? 92 : p.crouching ? 115 : mode === "eva" ? 235 : 265;
      p.vx = inp.moveX * speed;
      if (Math.abs(inp.moveX) > 0.15) {
        p.facing = inp.moveX > 0 ? 1 : -1;
        if (p.inBox) p.boxMovedTimer = 0.65;
      }

      if (p.onGround) {
        p.coyoteTimer = 0.11;
        p.evaFuel = Math.min(1, p.evaFuel + realDt * 0.9);
      } else {
        p.coyoteTimer = Math.max(0, p.coyoteTimer - realDt);
      }

      // Jump / EVA thruster burst
      if (inp.jumpPressed && p.coyoteTimer > 0) {
        p.vy = mode === "eva" ? -310 : -470;
        p.onGround = false;
        p.coyoteTimer = 0;
        p.inBox = false;
        if (mode === "eva") {
          this.vfx.spawnThruster(p.x + p.w * 0.5, p.y + p.h, 0, 90, "#57C7FF");
        }
      } else if (mode === "eva" && inp.jumpHeld && !p.onGround && p.evaFuel > 0.04) {
        p.vy = Math.max(-230, p.vy - 690 * dt);
        p.evaFuel = Math.max(0, p.evaFuel - dt * 0.72);
        if (Math.random() < 0.7) {
          this.vfx.spawnThruster(p.x + p.w * 0.5 - p.facing * 8, p.y + p.h - 4, -p.vx * 0.2, 120, "#4DA8DA");
        }
      }

      p.vy += this.mission.gravity * dt;
      p.vy = Math.min(680, p.vy);

      this.moveAndCollidePlayer(dt, inp.crouch);

      // EVA magnetic safety tether (no cheap pit deaths in Mission 3!)
      if (p.y > VIEW_H + 35) {
        p.y = 260;
        p.vy = -220;
        p.evaFuel = 1;
        this.damagePlayer(12);
        this.vfx.addCallout(p.x, 300, "MAG-TETHER RECOVERY", "#4DA8DA", 1.1);
      }
    }

    // Aiming (360° touch drag, mouse world aim, OR smart-aim assist on tap!)
    this.updateAim(inp);

    // Firing
    if (inp.fireHeld && p.fireCooldown <= 0 && !p.inBox) {
      this.firePlayerWeapon();
    }

    // Gadgets: EMP Grenade & Acoustic Decoy
    if (inp.empPressed) this.throwEmp();
    if (inp.decoyPressed) this.throwDecoy();

    // Contextual Interact (POW rescue / Hack node) OR Close Quarters Combat (CQC)!
    this.updateNearInteractLabel();
    if (inp.cqcPressed) {
      if (!this.tryInteract()) {
        this.performCqc();
      }
    }

    // Mission Exit check
    if (this.exitUnlocked && p.x + p.w >= this.mission.exitX - 36 && !this.missionFinished) {
      this.finishMission();
    }
  }

  private moveAndCollidePlayer(dt: number, dropThrough: boolean): void {
    const p = this.player;
    const prevBottom = p.y + p.h;

    // Horizontal
    p.x += p.vx * dt;
    const minX = this.boss?.active ? this.mission.bossArenaMinX : 8;
    p.x = Math.max(minX, Math.min(this.mission.width - p.w - 8, p.x));

    for (const plat of this.platforms) {
      if (plat.kind !== "solid" && plat.kind !== "destructible") continue;
      if (this.rectsOverlap(p.x, p.y, p.w, p.h, plat.x, plat.y, plat.w, plat.h)) {
        if (p.vx > 0) p.x = plat.x - p.w;
        else if (p.vx < 0) p.x = plat.x + plat.w;
      }
    }

    // Vertical
    p.y += p.vy * dt;
    p.onGround = false;

    for (const plat of this.platforms) {
      if (plat.kind === "cover") continue;
      if (plat.kind === "oneway") {
        if (
          !dropThrough &&
          p.vy >= 0 &&
          prevBottom <= plat.y + 8 &&
          p.y + p.h >= plat.y &&
          p.x + p.w > plat.x + 2 &&
          p.x < plat.x + plat.w - 2
        ) {
          p.y = plat.y - p.h;
          p.vy = 0;
          p.onGround = true;
        }
        continue;
      }

      if (this.rectsOverlap(p.x, p.y, p.w, p.h, plat.x, plat.y, plat.w, plat.h)) {
        if (p.vy >= 0) {
          p.y = plat.y - p.h;
          p.vy = 0;
          p.onGround = true;
        } else {
          p.y = plat.y + plat.h;
          p.vy = 0;
        }
      }
    }
  }

  private updateAim(inp: InputState): void {
    const p = this.player;
    const px = p.x + p.w * 0.5;
    const py = p.y + (p.crouching ? 31 : 19);

    if (inp.aimActive) {
      p.aimAngle = Math.atan2(inp.aimY, inp.aimX);
      if (this.mission.mode !== "starship") {
        p.facing = Math.cos(p.aimAngle) >= 0 ? 1 : -1;
      }
      return;
    }

    if (inp.mouseWorldAim) {
      const rect = this.canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const vx = (inp.mouseScreenX / rect.width) * VIEW_W + this.cameraX;
        const vy = (inp.mouseScreenY / rect.height) * VIEW_H;
        p.aimAngle = Math.atan2(vy - py, vx - px);
        if (this.mission.mode !== "starship") {
          p.facing = vx >= px ? 1 : -1;
        }
        return;
      }
    }

    // Mobile tap smart-aim assist toward nearest visible hostile in front
    let bestAngle = p.facing > 0 ? 0 : Math.PI;
    let bestDist = 420;
    const targets: Array<{ x: number; y: number }> = [];
    for (const e of this.enemies) {
      if (e.state !== "dead") targets.push({ x: e.x + e.w * 0.5, y: e.y + e.h * 0.35 });
    }
    if (this.boss?.active && !this.boss.defeated) {
      for (const r of this.boss.relays) {
        if (r.active) targets.push({ x: r.x, y: r.y });
      }
      targets.push({ x: this.boss.x + this.boss.w * 0.5, y: this.boss.y + this.boss.h * 0.45 });
    }

    for (const t of targets) {
      const dx = t.x - px;
      const dy = t.y - py;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist && (this.mission.mode === "starship" ? dx > -20 : dx * p.facing > -35)) {
        bestDist = dist;
        bestAngle = Math.atan2(dy, dx);
      }
    }
    p.aimAngle = bestAngle;
  }

  private hasAmmoFor(id: WeaponId): boolean {
    if (id === "silenced_rail" || this.saveData.unlocks.infinityBandana) return true;
    return (this.player.ammo[id] ?? 0) > 0;
  }

  private cycleWeapon(): void {
    const idx = WEAPON_ORDER.indexOf(this.player.weaponId);
    for (let step = 1; step <= WEAPON_ORDER.length; step++) {
      const next = WEAPON_ORDER[(idx + step) % WEAPON_ORDER.length];
      if (this.hasAmmoFor(next)) {
        this.player.weaponId = next;
        this.audio.playUiClick();
        this.vfx.addCallout(this.player.x + 14, this.player.y - 12, WEAPONS[next].shortName, WEAPONS[next].color, 0.95);
        return;
      }
    }
  }

  private firePlayerWeapon(): void {
    const p = this.player;
    let wid = p.weaponId;
    if (!this.hasAmmoFor(wid)) {
      wid = "silenced_rail";
      p.weaponId = wid;
    }
    const w = WEAPONS[wid];
    p.fireCooldown = 1 / w.fireRate;
    if (w.maxAmmo > 0 && !this.saveData.unlocks.infinityBandana) {
      p.ammo[wid] = Math.max(0, (p.ammo[wid] ?? 0) - 1);
      if (p.ammo[wid] === 0 && wid !== "silenced_rail") {
        // Keep weapon selectable until next press, then fall back cleanly
      }
    }

    const ox = p.x + p.w * 0.5 + Math.cos(p.aimAngle) * 18;
    const oy = p.y + (this.mission.mode === "starship" ? p.h * 0.5 : p.crouching ? 31 : 19) + Math.sin(p.aimAngle) * 18;

    for (let i = 0; i < w.pellets; i++) {
      const spread = (Math.random() - 0.5) * w.spread;
      const a = p.aimAngle + spread;
      this.projectiles.push({
        id: this.nextProjId++,
        fromPlayer: true,
        x: ox,
        y: oy,
        vx: Math.cos(a) * w.projectileSpeed,
        vy: Math.sin(a) * w.projectileSpeed,
        damage: w.damage,
        color: w.color,
        radius: w.piercing ? 5 : w.homing ? 4.5 : 3.2,
        life: 1.5,
        piercing: w.piercing,
        homing: w.homing,
        weaponId: wid,
        hitIds: new Set(),
        trail: [{ x: ox, y: oy }],
      });
    }

    this.audio.playWeaponFire(wid);
    this.vfx.spawnMuzzle(ox, oy, p.aimAngle, w.loud, w.color);
    if (w.loud) {
      this.vfx.addShake(wid === "piercing_rail" ? 5 : 2.5, 0.08);
      this.emitSoundNoise(ox, oy, w.noiseRadius);
    }
  }

  private emitSoundNoise(x: number, y: number, radius: number): void {
    for (const e of this.enemies) {
      if (e.state === "dead" || e.state === "stunned" || e.disabledByHack) continue;
      if (Math.hypot(e.x - x, e.y - y) <= radius) {
        if (e.state === "patrol") {
          e.state = "investigate";
          e.investigateX = x;
          e.investigateTimer = 5.5;
          e.awareness = Math.max(e.awareness, 42);
        }
      }
    }
  }

  private throwEmp(): void {
    const p = this.player;
    if (p.empCount <= 0) {
      this.vfx.addCallout(p.x + 14, p.y - 10, "NO EMP", "#FF9500", 0.9);
      return;
    }
    p.empCount -= 1;
    p.inBox = false;
    const ox = p.x + p.w * 0.5;
    const oy = p.y + 18;
    const a = p.aimAngle;
    this.projectiles.push({
      id: this.nextProjId++,
      fromPlayer: true,
      x: ox,
      y: oy,
      vx: Math.cos(a) * 440,
      vy: Math.sin(a) * 440 - (this.mission.mode === "starship" ? 0 : 120),
      damage: 20,
      color: "#57C7FF",
      radius: 6,
      life: 0.72,
      emp: true,
      trail: [{ x: ox, y: oy }],
    });
    this.audio.playUiClick();
  }

  private throwDecoy(): void {
    const p = this.player;
    const ox = p.x + p.w * 0.5;
    const oy = p.y + 18;
    const a = p.aimAngle;
    this.projectiles.push({
      id: this.nextProjId++,
      fromPlayer: true,
      x: ox,
      y: oy,
      vx: Math.cos(a) * 380,
      vy: Math.sin(a) * 380 - 110,
      damage: 0,
      color: "#E8C66D",
      radius: 4.5,
      life: 0.62,
      decoy: true,
      trail: [{ x: ox, y: oy }],
    });
    this.audio.playDecoyPing();
  }

  private updateNearInteractLabel(): void {
    const px = this.player.x + this.player.w * 0.5;
    const py = this.player.y + this.player.h * 0.5;
    this.nearInteractLabel = null;

    for (const pow of this.pows) {
      if (!pow.rescued && Math.hypot(pow.x - px, pow.y + 16 - py) < 64) {
        this.nearInteractLabel = `RESCUE ${pow.name}`;
        return;
      }
    }
    for (const n of this.hackNodes) {
      if (!n.hacked && Math.hypot(n.x - px, n.y - py) < 62) {
        this.nearInteractLabel = `HACK ${n.label}`;
        return;
      }
    }
  }

  private tryInteract(): boolean {
    const px = this.player.x + this.player.w * 0.5;
    const py = this.player.y + this.player.h * 0.5;

    for (const pow of this.pows) {
      if (!pow.rescued && Math.hypot(pow.x - px, pow.y + 16 - py) < 68) {
        this.rescuePow(pow);
        return true;
      }
    }

    for (const n of this.hackNodes) {
      if (!n.hacked && Math.hypot(n.x - px, n.y - py) < 66) {
        n.hacked = true;
        this.audio.playHackSuccess();
        this.vfx.spawnRing(n.x, n.y, "#4DA8DA", 130);
        this.vfx.addCallout(n.x, n.y - 26, `${n.label} DARKENED!`, "#4DA8DA", 1.15);
        this.score += 350;
        // Disable all enemies & lasers on that sector!
        for (const e of this.enemies) {
          if (e.sectorId === n.sectorId && e.state !== "dead") {
            e.disabledByHack = true;
            e.state = "stunned";
            e.stunTimer = 999;
          }
        }
        for (const l of this.lasers) {
          if (l.sectorId === n.sectorId) l.disabled = true;
        }
        return true;
      }
    }
    return false;
  }

  private rescuePow(pow: PowHostage): void {
    pow.rescued = true;
    this.audio.playPowRescue();
    this.vfx.spawnRing(pow.x, pow.y + 12, "#57C7FF", 110);
    this.vfx.addCallout(pow.x, pow.y - 16, `POW RESCUED +900`, "#57C7FF", 1.2);
    this.showBanner(`${pow.name}: "${pow.quip}"`);
    this.collectedShards.push(pow.shardId);
    this.grantWeaponAmmo(pow.dropWeapon);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
  }

  private grantWeaponAmmo(wid: WeaponId): void {
    const w = WEAPONS[wid];
    if (w.maxAmmo > 0) {
      this.player.ammo[wid] = Math.min(w.maxAmmo, (this.player.ammo[wid] ?? 0) + w.pickupAmmo);
      this.player.weaponId = wid;
    }
  }

  private performCqc(): void {
    const p = this.player;
    if (p.cqcCooldown > 0) return;
    p.cqcCooldown = 0.38;
    p.cqcAnim = 0.22;
    p.inBox = false;

    const sx = p.x + p.w * 0.5 + p.facing * 26;
    const sy = p.y + p.h * 0.45;
    this.audio.playCqcSlash();
    this.vfx.spawnSlash(sx, sy, p.facing, "#F2F5F8");

    let hitAny = false;
    for (const e of this.enemies) {
      if (e.state === "dead") continue;
      if (Math.hypot(e.x + e.w * 0.5 - sx, e.y + e.h * 0.5 - sy) < 62) {
        hitAny = true;
        const stealthKill = e.state !== "combat" || this.stealth.reflexTimer > 0;
        const dmg = stealthKill ? e.maxHp : 72;
        this.damageEnemy(e, dmg, true, true);
      }
    }
    if (hitAny) {
      this.vfx.addHitStop(0.055);
      this.vfx.addShake(6, 0.14);
    }
  }

  private updateTriggersAndCheckpoints(): void {
    const px = this.player.x + this.player.w * 0.5;

    for (const cp of this.checkpoints) {
      if (!cp.reached && px >= cp.x) {
        cp.reached = true;
        this.checkpointPos = { x: cp.x, y: cp.y };
        this.vfx.addCallout(cp.x, cp.y - 54, "CHECKPOINT", "#4DA8DA", 1.0);
      }
    }

    // Starship auto-rescue for floating escape pods on proximity!
    if (this.mission.mode === "starship") {
      for (const pow of this.pows) {
        if (!pow.rescued && Math.hypot(pow.x - px, pow.y - (this.player.y + 15)) < 68) {
          this.rescuePow(pow);
        }
      }
    }

    for (const tr of this.triggers) {
      if (!tr.triggered && px >= tr.x) {
        tr.triggered = true;
        if (tr.bannerText) this.showBanner(tr.bannerText);
        if (tr.codecId && CODEC_SCRIPTS[tr.codecId]) {
          this.audio.playCodecRing();
          this.modalHold = true;
          this.callbacks.onCodec(CODEC_SCRIPTS[tr.codecId], () => {
            this.modalHold = false;
          });
        }
      }
    }

    // Boss activation!
    if (this.boss && !this.boss.active && !this.boss.defeated && px >= this.mission.bossTriggerX) {
      this.boss.active = true;
      this.checkpointPos = { x: this.mission.bossArenaMinX + 45, y: this.mission.mode === "starship" ? 270 : 468 };
      this.audio.playBossSplash();
      this.bossSplash = {
        active: true,
        timer: 2.35,
        name: this.boss.name,
        subtitle: this.boss.subtitle,
        quote: this.boss.quote,
      };
      const bossCodec = CODEC_SCRIPTS[this.mission.bossCodecId];
      if (bossCodec) {
        this.modalHold = true;
        this.callbacks.onCodec(bossCodec, () => {
          this.modalHold = false;
        });
      }
    }
  }

  private updateEnemies(dt: number, realDt: number): void {
    const p = this.player;
    const sample = {
      playerX: p.x,
      playerY: p.y,
      playerW: p.w,
      playerH: p.h,
      crouching: p.crouching,
      inBox: p.inBox,
      boxMovedRecently: p.boxMovedTimer > 0,
      camoActive: p.camoTimer > 0,
      coldDrift: p.coldDrift,
    };

    let anySeeing = false;
    let anyInvestigating = false;

    for (const e of this.enemies) {
      if (e.state === "dead") continue;
      e.animTime += dt;
      e.hitFlash = Math.max(0, e.hitFlash - realDt);
      e.fireCooldown = Math.max(0, e.fireCooldown - dt);

      if (e.state === "stunned") {
        if (!e.disabledByHack) {
          e.stunTimer -= dt;
          if (e.stunTimer <= 0) e.state = "patrol";
        }
        continue;
      }

      // Vision evaluation
      const vis = evaluateEnemyVision(e, sample, this.platforms);
      if (vis > 0) {
        anySeeing = true;
        const prevAware = e.awareness;
        e.awareness = Math.min(100, e.awareness + vis * 115 * dt);
        if (prevAware < 25 && e.awareness >= 25 && e.state === "patrol") {
          this.audio.playSuspicious();
          e.state = "investigate";
          e.investigateX = p.x;
          e.investigateTimer = 4.5;
        }
        if (e.awareness >= 100 && e.state !== "combat") {
          const outcome = triggerSpotterDetection(this.stealth, e.id, true);
          e.state = "combat";
          if (outcome === "reflex") {
            this.audio.playReflexDrop();
            this.audio.playAlertStinger();
            this.vfx.addFlash("#FF3B2F", 0.25);
            this.vfx.spawnInkBurst(e.x + e.w * 0.5, e.y - 10, "#090C11", "#FF3B2F", 12);
          } else {
            this.audio.playAlertStinger();
            this.alertNearbyEnemies();
          }
        }
      } else {
        e.awareness = Math.max(0, e.awareness - 24 * dt);
      }

      // Movement & Aim AI
      if (e.kind === "camera") {
        const sweep = Math.sin(e.animTime * 1.15) * 0.55;
        e.aimAngle = Math.PI * 0.72 + sweep;
        if (e.state === "combat" && this.stealth.alertState === "ALERT" && e.fireCooldown <= 0) {
          this.fireEnemyShot(e, Math.atan2(p.y + 20 - e.y, p.x - e.x), 420, 10);
          e.fireCooldown = 1.25;
        }
        continue;
      }

      if (e.kind === "turret") {
        if (e.state === "combat" || vis > 0) {
          e.aimAngle = Math.atan2(p.y + p.h * 0.5 - (e.y + 15), p.x - e.x);
          if (e.fireCooldown <= 0 && Math.abs(e.x - p.x) < 560) {
            this.fireEnemyShot(e, e.aimAngle, 440, 12);
            e.fireCooldown = 1.05;
          }
        } else {
          e.aimAngle = Math.PI + Math.sin(e.animTime * 1.4) * 0.5;
        }
        continue;
      }

      if (e.state === "patrol") {
        e.vx = e.facing * e.speed;
        e.x += e.vx * dt;
        if (e.x <= e.patrolMinX) {
          e.x = e.patrolMinX;
          e.facing = 1;
        } else if (e.x >= e.patrolMaxX) {
          e.x = e.patrolMaxX;
          e.facing = -1;
        }
        if (e.kind === "drone" || e.kind === "interceptor") {
          e.y = (e.patrolY ?? e.y) + Math.sin(e.animTime * 2.2) * 18;
        }
        e.aimAngle = e.facing > 0 ? 0 : Math.PI;
      } else if (e.state === "investigate") {
        anyInvestigating = true;
        const dx = e.investigateX - e.x;
        if (Math.abs(dx) > 22) {
          e.facing = dx > 0 ? 1 : -1;
          e.vx = e.facing * e.speed * 1.15;
          e.x = Math.max(e.patrolMinX - 80, Math.min(e.patrolMaxX + 80, e.x + e.vx * dt));
        } else {
          e.vx = 0;
        }
        e.aimAngle = e.facing > 0 ? 0 : Math.PI;
        e.investigateTimer -= dt;
        if (e.investigateTimer <= 0) e.state = "patrol";
      } else if (e.state === "combat") {
        const dx = p.x - e.x;
        const dy = p.y + p.h * 0.4 - (e.y + e.h * 0.35);
        const dist = Math.hypot(dx, dy);
        e.facing = dx >= 0 ? 1 : -1;
        e.aimAngle = Math.atan2(dy, dx);

        if (dist > 220) {
          e.vx = e.facing * e.speed * 1.25;
          e.x = Math.max(e.patrolMinX - 110, Math.min(e.patrolMaxX + 110, e.x + e.vx * dt));
        } else {
          e.vx = 0;
        }

        // Fire when global alert active (or Reflex expired)
        if (this.stealth.reflexTimer <= 0 && e.fireCooldown <= 0 && dist < 520) {
          if (e.kind === "heavy") {
            this.fireEnemyShot(e, e.aimAngle - 0.08, 430, 14);
            this.fireEnemyShot(e, e.aimAngle + 0.08, 430, 14);
            e.fireCooldown = 1.45;
          } else {
            this.fireEnemyShot(e, e.aimAngle, 460, 11);
            e.fireCooldown = e.kind === "drone" ? 1.15 : 1.3;
          }
        }

        if (this.stealth.alertState === "EVASION" || this.stealth.alertState === "UNSEEN") {
          e.state = "investigate";
          e.investigateTimer = 3;
        }
      }
    }

    const { reflexExpiredToAlert } = updateStealthTimers(this.stealth, realDt, anySeeing, anyInvestigating);
    if (reflexExpiredToAlert) {
      this.audio.playAlertStinger();
      this.alertNearbyEnemies();
      this.vfx.addCallout(this.player.x + 14, this.player.y - 24, "ALERT!", "#FF3B2F", 1.3);
    }
  }

  private alertNearbyEnemies(): void {
    for (const e of this.enemies) {
      if (e.state === "dead" || e.state === "stunned" || e.disabledByHack) continue;
      if (Math.abs(e.x - this.player.x) < 620) {
        e.state = "combat";
        e.awareness = 100;
      }
    }
  }

  private fireEnemyShot(e: EnemyEntity, angle: number, speed: number, dmg: number): void {
    const ox = e.x + e.w * 0.5 + Math.cos(angle) * 16;
    const oy = e.y + e.h * 0.35 + Math.sin(angle) * 16;
    this.projectiles.push({
      id: this.nextProjId++,
      fromPlayer: false,
      x: ox,
      y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage: dmg,
      color: "#FF3B2F",
      radius: 4.5,
      life: 2.2,
      trail: [{ x: ox, y: oy }],
    });
  }

  private updateBoss(dt: number, realDt: number): void {
    const b = this.boss;
    if (!b || !b.active || b.defeated) return;

    const p = this.player;
    b.hitFlash = Math.max(0, b.hitFlash - realDt);
    b.vulnerableTimer = Math.max(0, b.vulnerableTimer - dt);
    b.hudGlitchTimer = Math.max(0, b.hudGlitchTimer - realDt);

    if (b.stunTimer > 0) {
      b.stunTimer -= dt;
      return;
    }

    // Phase transitions
    const hpRatio = b.hp / b.maxHp;
    const nextPhase = b.maxPhases === 3 ? (hpRatio < 0.35 ? 3 : hpRatio < 0.7 ? 2 : 1) : hpRatio < 0.5 ? 2 : 1;
    if (nextPhase > b.phase) {
      b.phase = nextPhase as 1 | 2 | 3;
      this.audio.playExplosion(true);
      this.vfx.spawnExplosion(b.x + b.w * 0.5, b.y + b.h * 0.5, true);
      this.vfx.addFlash("#FF3B2F", 0.32);
      this.showBanner(`${b.name} // PHASE ${b.phase} ENGAGED`);
    }

    b.stateTimer -= dt;
    b.attackTelegraph = Math.max(0, b.attackTelegraph - dt);

    const bcx = b.x + b.w * 0.5;
    const bcy = b.y + b.h * 0.5;
    const angleToPlayer = Math.atan2(p.y + p.h * 0.5 - bcy, p.x + p.w * 0.5 - bcx);

    if (b.id === "iron_gantry") {
      // Stalks gantry, fires rotary bursts, slams claw, then vents heat (vulnerable!)
      b.x += Math.sin(this.worldTime * (0.7 + b.phase * 0.3)) * 55 * dt;
      b.x = Math.max(this.mission.bossArenaMinX + 320, Math.min(this.mission.width - 170, b.x));

      if (b.stateTimer <= 0) {
        b.attackIndex = (b.attackIndex + 1) % 3;
        if (b.attackIndex === 0) {
          // Rotary burst
          for (let i = -1; i <= 1; i++) {
            this.fireBossShot(bcx - 36, bcy - 18, angleToPlayer + i * 0.16, 420, 12, "#FF9500");
          }
          b.stateTimer = b.phase === 2 ? 1.15 : 1.55;
        } else if (b.attackIndex === 1) {
          // Shockwave slam
          b.attackTelegraph = 0.5;
          this.fireBossShot(bcx - 45, 452, Math.PI, 460, 16, "#FF3B2F", 9);
          this.vfx.addShake(7, 0.2);
          b.stateTimer = 1.4;
        } else {
          // Overheat vent open! (2x damage window)
          b.vulnerableTimer = 2.6;
          this.vfx.addCallout(bcx, b.y - 18, "COOLANT VENTS OPEN!", "#FF9500", 1.15);
          b.stateTimer = 2.6;
        }
      }
    } else if (b.id === "valkyrie_09") {
      // Smooth orbital figure-8 + rotating directional shield
      b.shieldAngle += (1.2 + b.phase * 0.55) * dt;
      b.y = 225 + Math.sin(this.worldTime * 1.5) * 145;
      b.x = this.mission.bossArenaMinX + 670 + Math.cos(this.worldTime * 1.1) * 90;

      if (b.stateTimer <= 0) {
        const shots = b.phase === 2 ? 5 : 3;
        for (let i = 0; i < shots; i++) {
          const offset = (i - (shots - 1) * 0.5) * 0.18;
          this.fireBossShot(bcx - 42, bcy, angleToPlayer + offset, 460, 12, "#FF3B2F", 5.5);
        }
        b.stateTimer = b.phase === 2 ? 1.05 : 1.4;
      }
    } else if (b.id === "mirror") {
      const anyRelayAlive = b.relays.some((r) => r.active);
      b.x = this.mission.bossArenaMinX + 540 + Math.cos(this.worldTime * 1.1) * 190;
      b.y = 200 + Math.sin(this.worldTime * 1.7) * 75;

      // Update holo clones
      for (let i = 0; i < b.clones.length; i++) {
        const c = b.clones[i];
        c.x = this.mission.bossArenaMinX + 260 + i * 320 + Math.sin(this.worldTime * 2 + i) * 70;
        c.y = 190 + Math.cos(this.worldTime * 1.6 + i * 2) * 70;
      }

      if (b.stateTimer <= 0) {
        b.attackIndex = (b.attackIndex + 1) % 3;
        if (b.attackIndex === 0 && anyRelayAlive) {
          // 4th-Wall HUD Spoof + Spawn Holo-Clones!
          b.hudGlitchTimer = 3.2;
          b.clones = [
            { x: this.mission.bossArenaMinX + 260, y: 210, hp: 25, alpha: 0.7 },
            { x: this.mission.bossArenaMinX + 620, y: 180, hp: 25, alpha: 0.7 },
          ];
          this.vfx.addCallout(bcx, b.y - 24, "TELEMETRY SPOOFED!", "#FF3B2F", 1.2);
          b.stateTimer = 2.0;
        } else {
          // Prism fan barrage
          const n = b.phase === 2 ? 5 : 3;
          for (let i = 0; i < n; i++) {
            const off = (i - (n - 1) * 0.5) * 0.2;
            this.fireBossShot(bcx, bcy, angleToPlayer + off, 430, 12, "#FF9500", 5);
          }
          b.stateTimer = anyRelayAlive ? 1.45 : 1.15;
        }
      }
    } else if (b.id === "lark_prime") {
      // Multi-phase orbital neural core!
      b.y = 190 + Math.sin(this.worldTime * (1.0 + b.phase * 0.25)) * 68;
      b.x = this.mission.bossArenaMinX + 540 + Math.cos(this.worldTime * 0.7) * 140;

      if (b.sweepingBeamActive) {
        b.sweepingBeamAngle += (b.phase === 3 ? 0.95 : 0.72) * dt;
        // Beam collision check against player
        const px = p.x + p.w * 0.5 - bcx;
        const py = p.y + p.h * 0.5 - bcy;
        const dist = Math.hypot(px, py);
        if (dist < 690) {
          const beamDx = Math.cos(b.sweepingBeamAngle);
          const beamDy = Math.sin(b.sweepingBeamAngle);
          const proj = px * beamDx + py * beamDy;
          if (proj > 40) {
            const perp = Math.abs(px * -beamDy + py * beamDx);
            if (perp < 22) this.damagePlayer(14);
          }
        }
      }

      if (b.stateTimer <= 0) {
        b.attackIndex = (b.attackIndex + 1) % 3;
        b.sweepingBeamActive = false;

        if (b.attackIndex === 0) {
          // Radial containment ring pulse
          const count = b.phase === 3 ? 10 : 7;
          for (let i = 0; i < count; i++) {
            const a = (i / count) * Math.PI * 2 + this.worldTime;
            this.fireBossShot(bcx, bcy, a, 340, 12, "#57C7FF", 5.5);
          }
          b.stateTimer = 1.6;
        } else if (b.attackIndex === 1) {
          // Sweeping orbital laser arc!
          b.sweepingBeamActive = true;
          b.sweepingBeamAngle = Math.PI * 0.65;
          this.vfx.addCallout(bcx, b.y - 26, "CONTAINMENT SWEEP!", "#FF3B2F", 1.2);
          b.stateTimer = 2.1;
        } else {
          // Aimed precision triplet
          for (let i = -1; i <= 1; i++) {
            this.fireBossShot(bcx, bcy, angleToPlayer + i * 0.14, 470, 13, "#FF3B2F", 5);
          }
          b.stateTimer = b.phase === 3 ? 1.05 : 1.35;
        }
      }
    }
  }

  private fireBossShot(x: number, y: number, angle: number, speed: number, dmg: number, color: string, r = 5.5): void {
    this.projectiles.push({
      id: this.nextProjId++,
      fromPlayer: false,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage: dmg,
      color,
      radius: r,
      life: 3.0,
      trail: [{ x, y }],
    });
  }

  private updateDebris(dt: number): void {
    if (this.mission.mode !== "starship") return;
    this.debrisSpawnTimer -= dt;
    if (this.debrisSpawnTimer <= 0 && (!this.boss?.active || this.boss.defeated)) {
      this.debrisSpawnTimer = 1.15;
      this.debris.push({
        id: `deb_${this.nextProjId++}`,
        x: this.cameraX + VIEW_W + 40,
        y: 65 + Math.random() * (VIEW_H - 130),
        r: 14 + Math.random() * 16,
        vx: -130 - Math.random() * 140,
        vy: (Math.random() - 0.5) * 45,
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 3,
        hp: 40,
      });
    }

    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rot += d.vrot * dt;

      if (d.x < this.cameraX - 80 || d.hp <= 0) {
        if (d.hp <= 0) {
          this.vfx.spawnExplosion(d.x, d.y, false);
          this.score += 100;
        }
        this.debris.splice(i, 1);
        continue;
      }

      // Collision with starship
      const px = this.player.x + this.player.w * 0.5;
      const py = this.player.y + this.player.h * 0.5;
      if (Math.hypot(d.x - px, d.y - py) < d.r + 18) {
        this.damagePlayer(14);
        d.hp = 0;
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      pr.trail.push({ x: pr.x, y: pr.y });
      if (pr.trail.length > 6) pr.trail.shift();

      if (pr.emp || pr.decoy) {
        if (this.mission.mode !== "starship") pr.vy += 580 * dt;
      }

      if (pr.homing && pr.fromPlayer) {
        const target = this.findNearestHostile(pr.x, pr.y);
        if (target) {
          const desired = Math.atan2(target.y - pr.y, target.x - pr.x);
          const cur = Math.atan2(pr.vy, pr.vx);
          let diff = desired - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const nextA = cur + Math.max(-5.5 * dt, Math.min(5.5 * dt, diff));
          const spd = Math.hypot(pr.vx, pr.vy);
          pr.vx = Math.cos(nextA) * spd;
          pr.vy = Math.sin(nextA) * spd;
        }
      }

      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;

      let remove = pr.life <= 0;

      // Solid & destructible platform hits
      for (let pi = this.platforms.length - 1; pi >= 0; pi--) {
        const plat = this.platforms[pi];
        if (plat.kind !== "solid" && plat.kind !== "destructible") continue;
        if (pr.x >= plat.x && pr.x <= plat.x + plat.w && pr.y >= plat.y && pr.y <= plat.y + plat.h) {
          if (plat.kind === "destructible" && pr.fromPlayer) {
            plat.hp = (plat.hp ?? 50) - pr.damage;
            this.vfx.spawnInkBurst(pr.x, pr.y, "#221616", "#FF9500", 6);
            if (plat.hp <= 0) {
              this.audio.playExplosion(false);
              this.vfx.spawnExplosion(plat.x + plat.w * 0.5, plat.y + plat.h * 0.5, false);
              this.platforms.splice(pi, 1);
            }
          }
          if (pr.emp) this.detonateEmp(pr.x, pr.y);
          if (pr.decoy) this.detonateDecoy(pr.x, pr.y);
          if (!pr.piercing) remove = true;
          break;
        }
      }

      if (!remove && pr.fromPlayer && !pr.decoy) {
        // Debris hit (Mission 2)
        for (const d of this.debris) {
          if (Math.hypot(pr.x - d.x, pr.y - d.y) < d.r + pr.radius) {
            d.hp -= pr.damage;
            this.audio.playHit(false);
            if (!pr.piercing) remove = true;
            break;
          }
        }

        // Enemies hit
        for (const e of this.enemies) {
          if (e.state === "dead") continue;
          if (pr.hitIds?.has(e.id)) continue;
          if (pr.x >= e.x - 4 && pr.x <= e.x + e.w + 4 && pr.y >= e.y - 4 && pr.y <= e.y + e.h + 4) {
            if (pr.emp) {
              this.detonateEmp(pr.x, pr.y);
              remove = true;
              break;
            }
            // Heavy frontal shield blocks light rounds from front!
            const fromFront = (pr.vx < 0 && e.facing === 1) || (pr.vx > 0 && e.facing === -1);
            if (e.shielded && e.state !== "stunned" && fromFront && !pr.piercing && !pr.homing) {
              this.vfx.spawnInkBurst(pr.x, pr.y, "#57C7FF", "#FFFFFF", 5);
              this.vfx.addCallout(pr.x, pr.y - 10, "SHIELDED", "#57C7FF", 0.85);
              this.audio.playHit(false);
              remove = true;
              break;
            }
            const headshot = pr.y < e.y + e.h * 0.34;
            const stealthCrit = e.state !== "combat" || this.stealth.reflexTimer > 0;
            const w = pr.weaponId ? WEAPONS[pr.weaponId] : null;
            const mult = headshot || stealthCrit ? w?.critMultiplier ?? 1.6 : 1;
            this.damageEnemy(e, pr.damage * mult, headshot || stealthCrit, false);
            pr.hitIds?.add(e.id);
            if (!pr.piercing) {
              remove = true;
              break;
            }
          }
        }

        // Boss hit
        if (!remove && this.boss?.active && !this.boss.defeated) {
          const b = this.boss;
          // Mirror optical relays & clones
          for (const r of b.relays) {
            if (r.active && Math.hypot(pr.x - r.x, pr.y - r.y) < 24) {
              r.hp -= pr.damage;
              this.audio.playHit(true);
              this.vfx.spawnInkBurst(r.x, r.y, "#FF9500", "#FFFFFF", 8);
              if (r.hp <= 0) {
                r.active = false;
                b.clones = [];
                b.hudGlitchTimer = 0;
                this.vfx.spawnExplosion(r.x, r.y, false);
                this.vfx.addCallout(r.x, r.y - 18, "OPTICAL PRISM SHATTERED!", "#4DA8DA", 1.15);
              }
              if (!pr.piercing) remove = true;
            }
          }
          for (const c of b.clones) {
            if (c.hp > 0 && Math.hypot(pr.x - c.x, pr.y - c.y) < 36) {
              c.hp = 0;
              this.vfx.spawnInkBurst(c.x, c.y, "#57C7FF", "#090C11", 12);
              this.vfx.addCallout(c.x, c.y - 20, "DECOY!", "#57C7FF", 0.95);
              if (!pr.piercing) remove = true;
            }
          }

          if (
            !remove &&
            !pr.hitIds?.has("boss") &&
            pr.x >= b.x &&
            pr.x <= b.x + b.w &&
            pr.y >= b.y &&
            pr.y <= b.y + b.h
          ) {
            if (pr.emp) {
              this.detonateEmp(pr.x, pr.y);
              remove = true;
            } else {
              this.damageBoss(b, pr);
              pr.hitIds?.add("boss");
              if (!pr.piercing) remove = true;
            }
          }
        }
      } else if (!remove && !pr.fromPlayer) {
        // Enemy shot vs Player
        const p = this.player;
        const hitY = p.crouching ? p.y + 18 : p.y;
        const hitH = p.crouching ? p.h - 18 : p.h;
        if (pr.x >= p.x && pr.x <= p.x + p.w && pr.y >= hitY && pr.y <= hitY + hitH) {
          this.damagePlayer(pr.damage);
          remove = true;
        }
      }

      if (remove) {
        if (pr.life <= 0 && pr.emp) this.detonateEmp(pr.x, pr.y);
        if (pr.life <= 0 && pr.decoy) this.detonateDecoy(pr.x, pr.y);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private detonateEmp(x: number, y: number): void {
    this.audio.playEmpBlast();
    this.vfx.spawnRing(x, y, "#57C7FF", 175);
    this.vfx.addShake(6, 0.16);

    for (const e of this.enemies) {
      if (e.state === "dead") continue;
      if (Math.hypot(e.x + e.w * 0.5 - x, e.y + e.h * 0.5 - y) <= 175) {
        e.state = "stunned";
        e.stunTimer = 6.0;
        e.hitFlash = 0.2;
        this.vfx.addCallout(e.x + e.w * 0.5, e.y - 12, "EMP STUN!", "#57C7FF", 1.0);
        if (notifyEnemyNeutralized(this.stealth, e.id)) {
          this.awardReflexSave(e.x, e.y);
        }
      }
    }

    if (this.boss?.active && !this.boss.defeated) {
      const bcx = this.boss.x + this.boss.w * 0.5;
      const bcy = this.boss.y + this.boss.h * 0.5;
      if (Math.hypot(bcx - x, bcy - y) <= 190) {
        this.boss.stunTimer = 2.6;
        this.boss.vulnerableTimer = 3.0;
        this.boss.hp = Math.max(1, this.boss.hp - 35);
        this.vfx.addCallout(bcx, this.boss.y - 20, "SYSTEMS DISRUPTED!", "#57C7FF", 1.25);
      }
    }
  }

  private detonateDecoy(x: number, y: number): void {
    this.audio.playDecoyPing();
    this.vfx.spawnRing(x, y, "#E8C66D", 145);
    this.vfx.addCallout(x, y - 16, "PING!", "#E8C66D", 0.95);
    this.emitSoundNoise(x, y, 360);
  }

  private damageEnemy(e: EnemyEntity, dmg: number, crit: boolean, fromCqc: boolean): void {
    e.hp -= dmg;
    e.hitFlash = 0.12;
    this.audio.playHit(crit);
    this.vfx.spawnInkBurst(e.x + e.w * 0.5, e.y + e.h * 0.4, "#090C11", crit ? "#FF3B2F" : "#F2F5F8", crit ? 14 : 7);

    if (e.hp <= 0) {
      e.state = "dead";
      this.enemiesNeutralized += 1;
      this.score += fromCqc ? 400 : crit ? 300 : 200;
      if (fromCqc) this.cqcTakedowns += 1;

      if (notifyEnemyNeutralized(this.stealth, e.id)) {
        this.awardReflexSave(e.x + e.w * 0.5, e.y);
      } else if (fromCqc) {
        this.vfx.addCallout(e.x + e.w * 0.5, e.y - 10, "CQC TAKEDOWN!", "#F2F5F8", 1.1);
      } else if (crit) {
        this.vfx.addCallout(e.x + e.w * 0.5, e.y - 10, "CRIT!", "#FF3B2F", 1.05);
      }

      if (e.kind === "drone" || e.kind === "heavy" || e.kind === "interceptor" || e.kind === "turret") {
        this.audio.playExplosion(false);
        this.vfx.spawnExplosion(e.x + e.w * 0.5, e.y + e.h * 0.5, false);
      }
    } else if (e.state !== "combat") {
      e.state = "investigate";
      e.investigateX = this.player.x;
      e.investigateTimer = 4;
      e.awareness = Math.min(90, e.awareness + 45);
    }
  }

  private awardReflexSave(x: number, y: number): void {
    this.score += 500;
    this.vfx.addHitStop(0.06);
    this.vfx.addFlash("#57C7FF", 0.22);
    this.vfx.addCallout(x, y - 24, "REFLEX SAVE +500!", "#57C7FF", 1.25);
  }

  private damageBoss(b: BossEntity, pr: Projectile): void {
    const bcx = b.x + b.w * 0.5;
    const bcy = b.y + b.h * 0.5;
    let dmg = pr.damage;

    // Boss-specific tactical counter-play!
    if (b.id === "iron_gantry") {
      if (b.vulnerableTimer > 0 || b.stunTimer > 0) {
        dmg *= 1.85;
        this.vfx.addCallout(pr.x, pr.y - 12, "CRIT VENT!", "#FF9500", 1.1);
      } else if (!pr.piercing && !pr.homing) {
        dmg *= 0.55;
      }
    } else if (b.id === "valkyrie_09" && b.stunTimer <= 0 && !pr.homing) {
      const hitA = Math.atan2(pr.y - bcy, pr.x - bcx);
      let diff = hitA - b.shieldAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) < 0.92) {
        this.vfx.spawnInkBurst(pr.x, pr.y, "#57C7FF", "#FFFFFF", 6);
        this.vfx.addCallout(pr.x, pr.y - 12, "SHIELD DEFLECT", "#57C7FF", 0.9);
        this.audio.playHit(false);
        return;
      }
    } else if (b.id === "mirror") {
      const relaysUp = b.relays.filter((r) => r.active).length;
      if (relaysUp > 0) dmg *= 0.45;
    }

    b.hp -= dmg;
    b.hitFlash = 0.09;
    this.audio.playHit(dmg > pr.damage);
    this.vfx.spawnInkBurst(pr.x, pr.y, "#090C11", "#FF3B2F", 9);

    if (b.hp <= 0) {
      b.hp = 0;
      b.defeated = true;
      b.sweepingBeamActive = false;
      b.hudGlitchTimer = 0;
      this.score += 1800;
      this.audio.playExplosion(true);
      this.vfx.spawnExplosion(bcx, bcy, true);
      this.vfx.addHitStop(0.11);
      this.vfx.addFlash("#FFFFFF", 0.55);
      this.exitUnlocked = true;

      if (this.mission.id === 4) {
        this.showBanner("CONTAINMENT SHATTERED // APPROACH MASTER TERMINAL");
      } else {
        this.showBanner(`${b.name} DESTROYED // PROCEED TO EXTRACTION`);
      }
    }
  }

  private damagePlayer(amount: number): void {
    const p = this.player;
    if (p.invulnTimer > 0) return;
    p.hp = Math.max(0, p.hp - amount);
    p.invulnTimer = 0.85;
    this.damageTaken += amount;
    this.audio.playPlayerHurt();
    this.vfx.addShake(9, 0.22);
    this.vfx.addFlash("#FF3B2F", 0.3);

    if (p.hp <= 0) {
      this.restartFromCheckpoint();
    }
  }

  private updatePickupsAndLasers(dt: number): void {
    const p = this.player;
    const px = p.x + p.w * 0.5;
    const py = p.y + p.h * 0.5;

    for (const item of this.pickups) {
      if (item.collected) continue;
      if (Math.hypot(item.x - px, item.y - py) < 36) {
        item.collected = true;
        this.audio.playPowRescue();
        if (item.kind === "medgel") {
          p.hp = Math.min(p.maxHp, p.hp + 40);
          this.vfx.addCallout(item.x, item.y - 12, "+40 MED-GEL", "#4CE08A", 1.0);
        } else if (item.kind === "emp") {
          p.empCount = Math.min(6, p.empCount + 2);
          this.vfx.addCallout(item.x, item.y - 12, "+2 EMP", "#57C7FF", 1.0);
        } else if (item.kind === "weapon" && item.weaponId) {
          this.grantWeaponAmmo(item.weaponId);
          this.vfx.addCallout(item.x, item.y - 12, WEAPONS[item.weaponId].shortName, "#FF9500", 1.05);
        }
      }
    }

    for (const l of this.lasers) {
      if (l.disabled) continue;
      const cycle = ((this.worldTime + l.phase) % l.period) / l.period;
      if (cycle < l.duty) {
        if (p.x + p.w > l.x - 4 && p.x < l.x + 4 && p.y + p.h > l.y && p.y < l.y + l.h) {
          this.damagePlayer(18);
          escalateToAlert(this.stealth);
          this.alertNearbyEnemies();
          this.audio.playAlertStinger();
        }
      }
    }
    void dt;
  }

  private findNearestHostile(x: number, y: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestD = 540;
    for (const e of this.enemies) {
      if (e.state === "dead") continue;
      const d = Math.hypot(e.x + e.w * 0.5 - x, e.y + e.h * 0.5 - y);
      if (d < bestD) {
        bestD = d;
        best = { x: e.x + e.w * 0.5, y: e.y + e.h * 0.5 };
      }
    }
    if (this.boss?.active && !this.boss.defeated) {
      const d = Math.hypot(this.boss.x + this.boss.w * 0.5 - x, this.boss.y + this.boss.h * 0.5 - y);
      if (d < bestD) {
        best = { x: this.boss.x + this.boss.w * 0.5, y: this.boss.y + this.boss.h * 0.5 };
      }
    }
    return best;
  }

  private finishMission(): void {
    this.missionFinished = true;
    this.modalHold = true;

    const stats = computeMissionStats({
      missionId: this.mission.id,
      timeSeconds: this.missionTime,
      alertsTriggered: this.stealth.alertsTriggered,
      reflexSaves: this.stealth.reflexSaves,
      cqcTakedowns: this.cqcTakedowns,
      powsRescued: this.pows.filter((p) => p.rescued).length,
      powsTotal: this.pows.length,
      damageTaken: this.damageTaken,
      enemiesNeutralized: this.enemiesNeutralized,
      baseScore: this.score,
    });

    if (this.mission.id === 4) {
      this.audio.setMusicMode("ending");
      this.callbacks.onFinalChoice(stats, this.collectedShards);
      return;
    }

    const outro = CODEC_SCRIPTS[this.mission.outroCodecId];
    if (outro) {
      this.audio.playCodecRing();
      this.callbacks.onCodec(outro, () => {
        this.callbacks.onMissionComplete(stats, this.collectedShards);
      });
    } else {
      this.callbacks.onMissionComplete(stats, this.collectedShards);
    }
  }

  private rectsOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  private draw(): void {
    this.renderer.render(this.ctx, {
      mission: this.mission,
      time: this.worldTime,
      cameraX: this.cameraX,
      player: this.player,
      enemies: this.enemies,
      pows: this.pows,
      hackNodes: this.hackNodes,
      lasers: this.lasers,
      pickups: this.pickups,
      checkpoints: this.checkpoints,
      debris: this.debris,
      projectiles: this.projectiles,
      boss: this.boss,
      vfx: this.vfx,
      alertState: this.stealth.alertState,
      reflexTimer: this.stealth.reflexTimer,
      bossSplash: this.bossSplash,
      bannerText: this.bannerText,
      bannerTimer: this.bannerTimer,
      hudGlitchTimer: this.boss?.hudGlitchTimer ?? 0,
      exitUnlocked: this.exitUnlocked,
      nearInteractLabel: this.nearInteractLabel,
    });
  }

  private emitHud(): void {
    const p = this.player;
    const w = WEAPONS[p.weaponId];
    const ammo =
      w.maxAmmo < 0 || this.saveData.unlocks.infinityBandana ? -1 : p.ammo[p.weaponId] ?? 0;

    this.callbacks.onHudUpdate({
      missionCode: this.mission.code,
      missionTitle: this.mission.title,
      mode: this.mission.mode,
      hp: Math.ceil(p.hp),
      maxHp: p.maxHp,
      weaponId: p.weaponId,
      weaponName: w.shortName,
      ammo,
      empCount: p.empCount,
      inBox: p.inBox,
      coldDrift: p.coldDrift,
      camoUnlocked: this.saveData.unlocks.opticalCamo,
      camoActive: p.camoTimer > 0,
      camoCooldown: p.camoCooldown,
      alertState: this.stealth.alertState,
      alertTimer: Math.max(this.stealth.alertTimer, this.stealth.evasionTimer, this.stealth.cautionTimer),
      score: this.score,
      powsRescued: this.pows.filter((x) => x.rescued).length,
      powsTotal: this.pows.length,
      boss:
        this.boss && this.boss.active && !this.boss.defeated
          ? { name: this.boss.name, hp: Math.ceil(this.boss.hp), maxHp: this.boss.maxHp, phase: this.boss.phase }
          : null,
      hudGlitched: (this.boss?.hudGlitchTimer ?? 0) > 0,
      nearInteract: this.nearInteractLabel,
      progressPct: Math.min(100, Math.round((p.x / this.mission.exitX) * 100)),
    });
  }
}
