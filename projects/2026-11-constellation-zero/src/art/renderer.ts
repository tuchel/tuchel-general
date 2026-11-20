import type {
  AlertState,
  BossEntity,
  Checkpoint,
  DebrisHazard,
  EnemyEntity,
  HackNode,
  LaserBarrier,
  MissionDef,
  PickupItem,
  Platform,
  PowHostage,
  Projectile,
  WeaponId,
} from "../engine/types";
import type { VfxSystem } from "../engine/vfx";

export const VIEW_W = 960;
export const VIEW_H = 540;

export interface PlayerRenderState {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  aimAngle: number;
  crouching: boolean;
  onGround: boolean;
  inBox: boolean;
  camoTimer: number;
  coldDrift: boolean;
  evaFuel: number;
  invulnTimer: number;
  cqcAnim: number;
  weaponId: WeaponId;
  animTime: number;
  hp: number;
  maxHp: number;
}

export interface RenderSnapshot {
  mission: MissionDef;
  time: number;
  cameraX: number;
  player: PlayerRenderState;
  enemies: EnemyEntity[];
  pows: PowHostage[];
  hackNodes: HackNode[];
  lasers: LaserBarrier[];
  pickups: PickupItem[];
  checkpoints: Checkpoint[];
  debris: DebrisHazard[];
  projectiles: Projectile[];
  boss: BossEntity | null;
  vfx: VfxSystem;
  alertState: AlertState;
  reflexTimer: number;
  bossSplash: { active: boolean; timer: number; name: string; subtitle: string; quote: string };
  bannerText: string;
  bannerTimer: number;
  hudGlitchTimer: number;
  exitUnlocked: boolean;
  nearInteractLabel: string | null;
}

export class OrbitalInkRenderer {
  private stars: Array<{ x: number; y: number; r: number; a: number }> = [];
  private rainDrops: Array<{ x: number; y: number; len: number; spd: number }> = [];

  constructor() {
    for (let i = 0; i < 120; i++) {
      this.stars.push({
        x: Math.random() * VIEW_W,
        y: Math.random() * VIEW_H * 0.78,
        r: 0.7 + Math.random() * 1.5,
        a: 0.25 + Math.random() * 0.7,
      });
    }
    for (let i = 0; i < 65; i++) {
      this.rainDrops.push({
        x: Math.random() * VIEW_W,
        y: Math.random() * VIEW_H,
        len: 14 + Math.random() * 18,
        spd: 540 + Math.random() * 260,
      });
    }
  }

  public render(ctx: CanvasRenderingContext2D, snap: RenderSnapshot): void {
    const shake = snap.vfx.getShakeOffset();
    const camX = snap.cameraX - shake.x;
    const camY = -shake.y;

    ctx.save();
    // 1. Parallax Environment Backdrop
    this.drawBackdrop(ctx, snap);

    // 2. World Layer
    ctx.save();
    ctx.translate(-camX, -camY);

    this.drawPlatforms(ctx, snap.mission.platforms, snap.mission.id, snap.time);
    this.drawCheckpoints(ctx, snap.checkpoints, snap.time);
    this.drawHackNodes(ctx, snap.hackNodes, snap.time);
    this.drawLasers(ctx, snap.lasers, snap.time);
    this.drawPows(ctx, snap.pows, snap.time);
    this.drawPickups(ctx, snap.pickups, snap.time);
    this.drawDebris(ctx, snap.debris);
    this.drawExitBeacon(ctx, snap);

    // Enemy vision cones rendered behind characters for crisp readability
    for (const e of snap.enemies) {
      if (e.state !== "dead" && e.state !== "stunned" && !e.disabledByHack) {
        this.drawVisionCone(ctx, e, snap.time);
      }
    }

    // Enemies
    for (const e of snap.enemies) {
      if (e.state !== "dead") {
        this.drawEnemy(ctx, e, snap.time);
      }
    }

    // Boss
    if (snap.boss && snap.boss.active && !snap.boss.defeated) {
      this.drawBoss(ctx, snap.boss, snap.time);
    }

    // Player (Foot / EVA or Starship)
    if (snap.mission.mode === "starship") {
      this.drawStarship(ctx, snap.player, snap.time);
    } else {
      this.drawAstronaut(ctx, snap.player, snap.mission.mode === "eva", snap.time);
    }

    // Projectiles
    this.drawProjectiles(ctx, snap.projectiles);

    // World-space Ink VFX & Callouts
    this.drawVfx(ctx, snap.vfx);

    // Contextual interact prompt above player
    if (snap.nearInteractLabel) {
      this.drawInteractPrompt(ctx, snap.player.x + snap.player.w * 0.5, snap.player.y - 22, snap.nearInteractLabel);
    }

    ctx.restore();

    // 3. Weather / Atmospheric Foreground Overlay
    if (snap.mission.id === 1) {
      this.drawRain(ctx, snap.time);
    }

    // 4. Reflex Slow-Mo Dramatic Shinkawa Ink Freeze
    if (snap.reflexTimer > 0) {
      this.drawReflexOverlay(ctx, snap.reflexTimer);
    }

    // 5. Mirror's 4th-Wall HUD Glitch Overlay
    if (snap.hudGlitchTimer > 0) {
      this.drawMirrorGlitch(ctx, snap.time, snap.hudGlitchTimer);
    }

    // 6. Flash & Cinematic Vignette
    if (snap.vfx.flashAlpha > 0.01) {
      ctx.fillStyle = snap.vfx.flashColor;
      ctx.globalAlpha = snap.vfx.flashAlpha;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }

    this.drawInkVignette(ctx, snap.alertState);

    // 7. Zone Banner
    if (snap.bannerTimer > 0 && snap.bannerText) {
      this.drawZoneBanner(ctx, snap.bannerText, Math.min(1, snap.bannerTimer));
    }

    // 8. Dramatic Ink-Brush Boss Title Splash Card
    if (snap.bossSplash.active) {
      this.drawBossSplash(ctx, snap.bossSplash);
    }

    ctx.restore();
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D, snap: RenderSnapshot): void {
    const id = snap.mission.id;
    const camX = snap.cameraX;
    const t = snap.time;

    if (id === 1) {
      // Storm-lit Starbase 39-X
      const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      g.addColorStop(0, "#070B12");
      g.addColorStop(0.58, "#121B28");
      g.addColorStop(1, "#0B1018");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      // Sweeping distant storm searchlights
      for (let i = 0; i < 3; i++) {
        const bx = ((i * 390 - camX * 0.18) % (VIEW_W + 260) + (VIEW_W + 260)) % (VIEW_W + 260) - 130;
        const sway = Math.sin(t * (0.7 + i * 0.25) + i) * 0.35;
        ctx.save();
        ctx.translate(bx, 470);
        ctx.rotate(-Math.PI * 0.5 + sway);
        const lg = ctx.createLinearGradient(0, 0, 520, 0);
        lg.addColorStop(0, "rgba(130, 195, 235, 0.16)");
        lg.addColorStop(1, "rgba(130, 195, 235, 0)");
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(520, -68);
        ctx.lineTo(520, 68);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Far silhouette hangar & launch towers
      ctx.fillStyle = "#0C121B";
      for (let i = 0; i < 12; i++) {
        const x = i * 240 - (camX * 0.22) % 240 - 120;
        const h = 140 + ((i * 53) % 130);
        ctx.fillRect(x, 470 - h, 110, h);
        // Truss lines
        ctx.strokeStyle = "#1C2A3B";
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 6, 470 - h + 6, 98, h - 12);
        // Blinking tower beacon
        if (i % 2 === 0) {
          ctx.fillStyle = Math.sin(t * 4 + i) > 0 ? "#FF3B2F" : "#4A1515";
          ctx.beginPath();
          ctx.arc(x + 55, 470 - h - 6, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#0C121B";
        }
      }

      // Starship Vesper waiting on Pad 39-X near end of Mission 1
      const shipScreenX = 3590 - camX;
      if (shipScreenX > -180 && shipScreenX < VIEW_W + 180) {
        this.drawPadStarshipSilhouette(ctx, shipScreenX, 468, t);
      }
    } else if (id === 2) {
      // Dynamic altitude ascent gradient: amber atmosphere -> deep orbital black
      const progress = Math.min(1, Math.max(0, camX / Math.max(1, snap.mission.width - VIEW_W)));
      const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      if (progress < 0.45) {
        g.addColorStop(0, "#08101E");
        g.addColorStop(0.6, "#162A44");
        g.addColorStop(1, "#3A231C");
      } else {
        g.addColorStop(0, "#04060A");
        g.addColorStop(0.68, "#0A1526");
        g.addColorStop(1, "#163858");
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      // Stars fade in as we climb
      this.drawStars(ctx, camX * 0.12, 0.3 + progress * 0.7);
      // Curved Earth limb below
      this.drawEarthLimb(ctx, 560 + (1 - progress) * 80, 0.45 + progress * 0.55);
      // Speed streaks
      ctx.strokeStyle = "rgba(220, 240, 255, 0.16)";
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 24; i++) {
        const sx = (((i * 197 - t * 680) % VIEW_W) + VIEW_W) % VIEW_W;
        const sy = (i * 43) % VIEW_H;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 38, sy);
        ctx.stroke();
      }
    } else if (id === 3) {
      // Iconic Style A Orbital View: Deep obsidian space + giant glowing Earth limb + monolithic satellites
      ctx.fillStyle = "#06090F";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      this.drawStars(ctx, camX * 0.08, 1);
      this.drawEarthLimb(ctx, 520, 1);

      // Distant drifting AI data-center satellites (parallax)
      for (let i = 0; i < 6; i++) {
        const sx = ((i * 340 - camX * 0.16) % (VIEW_W + 300) + (VIEW_W + 300)) % (VIEW_W + 300) - 150;
        const sy = 90 + (i % 3) * 72 + Math.sin(t * 0.8 + i) * 7;
        this.drawDistantSatellite(ctx, sx, sy, 0.55 + (i % 2) * 0.25, -0.28 + (i % 3) * 0.16);
      }
    } else {
      // Mission 4: AETHER-PRIME Liquid-Cooled Cathedral Core
      const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      g.addColorStop(0, "#05070C");
      g.addColorStop(0.5, "#0D1520");
      g.addColorStop(1, "#070A10");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      // Towering server monolith columns in parallax
      for (let i = 0; i < 11; i++) {
        const x = i * 165 - (camX * 0.28) % 165 - 80;
        ctx.fillStyle = "#0B111A";
        ctx.fillRect(x, 0, 74, VIEW_H);
        ctx.strokeStyle = "#1E2D40";
        ctx.lineWidth = 2;
        ctx.strokeRect(x, 0, 74, VIEW_H);

        // Glowing data-rack ribs
        for (let r = 0; r < 14; r++) {
          const pulse = Math.sin(t * 3 + i + r * 0.7) > 0.2;
          ctx.fillStyle = pulse ? "rgba(77, 168, 218, 0.55)" : "rgba(255, 59, 47, 0.22)";
          ctx.fillRect(x + 12, 26 + r * 34, 50, 4);
        }
      }

      // Giant orbital core window in boss chamber
      const coreScreenX = 3680 - camX;
      if (coreScreenX > -320 && coreScreenX < VIEW_W + 320) {
        ctx.save();
        ctx.translate(coreScreenX, 230);
        const rg = ctx.createRadialGradient(0, 0, 18, 0, 0, 240);
        rg.addColorStop(0, "rgba(77, 168, 218, 0.28)");
        rg.addColorStop(0.6, "rgba(255, 59, 47, 0.08)");
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(0, 0, 240, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  private drawStars(ctx: CanvasRenderingContext2D, offsetX: number, alphaScale: number): void {
    for (const s of this.stars) {
      const sx = (((s.x - offsetX) % VIEW_W) + VIEW_W) % VIEW_W;
      ctx.fillStyle = `rgba(235, 245, 255, ${s.a * alphaScale})`;
      ctx.fillRect(sx, s.y, s.r, s.r);
    }
  }

  private drawEarthLimb(ctx: CanvasRenderingContext2D, centerY: number, intensity: number): void {
    const r = 740;
    const cx = VIEW_W * 0.36;
    const cy = centerY + r - 180;

    // Outer atmospheric tungsten-blue glow
    const atm = ctx.createRadialGradient(cx, cy, r - 25, cx, cy, r + 62);
    atm.addColorStop(0, `rgba(18, 42, 74, ${0.95 * intensity})`);
    atm.addColorStop(0.45, `rgba(88, 182, 245, ${0.82 * intensity})`);
    atm.addColorStop(0.62, `rgba(225, 246, 255, ${0.55 * intensity})`);
    atm.addColorStop(1, "rgba(10, 22, 42, 0)");
    ctx.fillStyle = atm;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 62, Math.PI * 1.12, Math.PI * 1.88);
    ctx.fill();

    // Dark planet body with crisp ink horizon
    ctx.fillStyle = "#0B192C";
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI * 1.1, Math.PI * 1.9);
    ctx.fill();

    // Rim highlight arc
    ctx.strokeStyle = `rgba(225, 246, 255, ${0.85 * intensity})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }

  private drawDistantSatellite(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scale: number,
    rot: number
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale, scale);

    // Solar wings
    ctx.fillStyle = "#132030";
    ctx.strokeStyle = "#8EC5E8";
    ctx.lineWidth = 1.6;
    ctx.fillRect(-105, -24, 72, 48);
    ctx.strokeRect(-105, -24, 72, 48);
    ctx.fillRect(33, -24, 72, 48);
    ctx.strokeRect(33, -24, 72, 48);

    // Grid lines on solar panels
    ctx.strokeStyle = "rgba(142, 197, 232, 0.35)";
    ctx.lineWidth = 1;
    for (let gx = -90; gx <= -45; gx += 15) {
      ctx.beginPath();
      ctx.moveTo(gx, -24);
      ctx.lineTo(gx, 24);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-gx, -24);
      ctx.lineTo(-gx, 24);
      ctx.stroke();
    }

    // Core data cylinder
    ctx.fillStyle = "#1E2B3A";
    ctx.strokeStyle = "#F2F5F8";
    ctx.lineWidth = 2;
    ctx.fillRect(-26, -34, 52, 68);
    ctx.strokeRect(-26, -34, 52, 68);

    // Glowing red AI eye slit
    ctx.fillStyle = "#FF3B2F";
    ctx.fillRect(-12, -5, 24, 5);
    ctx.restore();
  }

  private drawPadStarshipSilhouette(ctx: CanvasRenderingContext2D, x: number, groundY: number, t: number): void {
    ctx.save();
    ctx.translate(x, groundY);
    // Launch tower steel
    ctx.strokeStyle = "#2E3F54";
    ctx.lineWidth = 3;
    ctx.strokeRect(-95, -360, 44, 360);
    for (let y = -340; y < 0; y += 36) {
      ctx.beginPath();
      ctx.moveTo(-95, y);
      ctx.lineTo(-51, y + 36);
      ctx.stroke();
    }

    // Starship Vesper body (sleek Shinkawa ink)
    ctx.fillStyle = "#DDE6EE";
    ctx.strokeStyle = "#090C11";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -340);
    ctx.quadraticCurveTo(36, -260, 34, -40);
    ctx.lineTo(52, 0);
    ctx.lineTo(-52, 0);
    ctx.lineTo(-34, -40);
    ctx.quadraticCurveTo(-36, -260, 0, -340);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Heavy black ink shadow half
    ctx.fillStyle = "#16202C";
    ctx.beginPath();
    ctx.moveTo(0, -340);
    ctx.quadraticCurveTo(36, -260, 34, -40);
    ctx.lineTo(52, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    // Cryogenic venting steam
    ctx.fillStyle = "rgba(220, 240, 255, 0.25)";
    const puff = (t * 40) % 45;
    ctx.beginPath();
    ctx.arc(-44 - puff * 0.5, -180 - puff, 10 + puff * 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawPlatforms(ctx: CanvasRenderingContext2D, platforms: Platform[], missionId: number, t: number): void {
    for (const p of platforms) {
      if (p.kind === "solid") {
        // High-contrast orbital ink deck
        ctx.fillStyle = "#151E2A";
        ctx.fillRect(p.x, p.y, p.w, p.h);

        // Stark white rim highlight on top edge (Style A signature!)
        ctx.fillStyle = "#DCE7F0";
        ctx.fillRect(p.x, p.y, p.w, 4);

        // Heavy ink border & structural truss diagonals
        ctx.strokeStyle = "#06080D";
        ctx.lineWidth = 3;
        ctx.strokeRect(p.x, p.y, p.w, p.h);

        ctx.strokeStyle = "rgba(130, 175, 210, 0.16)";
        ctx.lineWidth = 1.5;
        for (let tx = p.x + 16; tx < p.x + p.w - 20; tx += 48) {
          ctx.beginPath();
          ctx.moveTo(tx, p.y + 8);
          ctx.lineTo(tx + 24, p.y + Math.min(p.h - 4, 34));
          ctx.lineTo(tx + 48, p.y + 8);
          ctx.stroke();
        }
      } else if (p.kind === "oneway") {
        // Suspended catwalk gantry
        ctx.fillStyle = "#202D3D";
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = "#E8F1F8";
        ctx.fillRect(p.x, p.y, p.w, 3);
        ctx.strokeStyle = "#06080D";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        // Subtle safety railing ticks
        ctx.strokeStyle = "rgba(220, 236, 248, 0.25)";
        ctx.lineWidth = 1;
        for (let rx = p.x + 12; rx < p.x + p.w; rx += 26) {
          ctx.beginPath();
          ctx.moveTo(rx, p.y);
          ctx.lineTo(rx, p.y - 12);
          ctx.stroke();
        }
      } else if (p.kind === "cover") {
        // Server-rack / Tactical cover crate (matches Style A concept art!)
        ctx.fillStyle = "#273545";
        ctx.fillRect(p.x, p.y, p.w, p.h);
        // White top-left cel highlight
        ctx.fillStyle = "#D4E2EE";
        ctx.fillRect(p.x + 2, p.y + 2, p.w - 4, 5);
        // Dark ink right-shadow side
        ctx.fillStyle = "#0F1620";
        ctx.fillRect(p.x + p.w - 14, p.y + 6, 12, p.h - 8);
        // Blinking server LEDs
        for (let r = 0; r < 3; r++) {
          ctx.fillStyle =
            missionId === 4 && r === 1
              ? "#FF3B2F"
              : Math.sin(t * 5 + p.x + r) > 0
              ? "#4DA8DA"
              : "#203344";
          ctx.fillRect(p.x + 8, p.y + 13 + r * 9, 18, 3);
        }
        ctx.strokeStyle = "#06080D";
        ctx.lineWidth = 3;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
      } else if (p.kind === "destructible") {
        const hpRatio = (p.hp ?? 1) / (p.maxHp ?? 1);
        ctx.fillStyle = "#3A2222";
        ctx.fillRect(p.x, p.y, p.w, p.h);
        // Hazard stripes
        ctx.fillStyle = "#FF9500";
        for (let sy = p.y + 6; sy < p.y + p.h - 8; sy += 16) {
          ctx.fillRect(p.x + 4, sy, p.w - 8, 6);
        }
        ctx.strokeStyle = "#06080D";
        ctx.lineWidth = 3;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        if (hpRatio < 1) {
          ctx.fillStyle = "#FF3B2F";
          ctx.fillRect(p.x, p.y - 8, p.w * hpRatio, 4);
        }
      }
    }
  }

  private drawCheckpoints(ctx: CanvasRenderingContext2D, checkpoints: Checkpoint[], t: number): void {
    for (const cp of checkpoints) {
      ctx.save();
      ctx.translate(cp.x, cp.y);
      ctx.strokeStyle = cp.reached ? "#4DA8DA" : "#445566";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -46);
      ctx.stroke();

      ctx.fillStyle = cp.reached ? "#4DA8DA" : "#253240";
      ctx.beginPath();
      ctx.moveTo(0, -46);
      ctx.lineTo(18, -38);
      ctx.lineTo(0, -30);
      ctx.closePath();
      ctx.fill();

      if (cp.reached) {
        ctx.strokeStyle = `rgba(77, 168, 218, ${0.35 + Math.sin(t * 6) * 0.2})`;
        ctx.beginPath();
        ctx.arc(0, -46, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawHackNodes(ctx: CanvasRenderingContext2D, nodes: HackNode[], t: number): void {
    for (const n of nodes) {
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.fillStyle = "#162230";
      ctx.strokeStyle = n.hacked ? "#4DA8DA" : "#FF9500";
      ctx.lineWidth = 2.5;
      ctx.fillRect(-16, -26, 32, 36);
      ctx.strokeRect(-16, -26, 32, 36);

      ctx.fillStyle = n.hacked ? "#4DA8DA" : Math.sin(t * 7) > 0 ? "#FF9500" : "#553311";
      ctx.fillRect(-10, -18, 20, 12);

      ctx.fillStyle = "#E8F1F8";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(n.hacked ? "DARK" : "HACK", 0, -32);
      ctx.restore();
    }
  }

  private drawLasers(ctx: CanvasRenderingContext2D, lasers: LaserBarrier[], t: number): void {
    for (const l of lasers) {
      // Emitter caps
      ctx.fillStyle = "#1C2836";
      ctx.strokeStyle = "#06080D";
      ctx.lineWidth = 2;
      ctx.fillRect(l.x - 8, l.y - 6, 16, 8);
      ctx.strokeRect(l.x - 8, l.y - 6, 16, 8);
      ctx.fillRect(l.x - 8, l.y + l.h - 2, 16, 8);
      ctx.strokeRect(l.x - 8, l.y + l.h - 2, 16, 8);

      if (l.disabled) continue;
      const cycle = ((t + l.phase) % l.period) / l.period;
      const active = cycle < l.duty;
      if (active) {
        ctx.strokeStyle = "rgba(255, 59, 47, 0.35)";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(l.x, l.y + l.h);
        ctx.stroke();

        ctx.strokeStyle = "#FF3B2F";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(l.x, l.y + l.h);
        ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(255, 149, 0, 0.25)";
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(l.x, l.y + l.h);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  private drawPows(ctx: CanvasRenderingContext2D, pows: PowHostage[], t: number): void {
    for (const p of pows) {
      if (p.rescued) continue;
      ctx.save();
      ctx.translate(p.x, p.y);
      // Pressurized cryo-pod / restraint frame
      ctx.fillStyle = "rgba(77, 168, 218, 0.14)";
      ctx.strokeStyle = "#4DA8DA";
      ctx.lineWidth = 2;
      ctx.fillRect(-16, -4, 32, 46);
      ctx.strokeRect(-16, -4, 32, 46);

      // Engineer figure waving
      const wave = Math.sin(t * 7 + p.x) * 6;
      ctx.fillStyle = "#DCE7F0";
      ctx.strokeStyle = "#090C11";
      ctx.lineWidth = 2.5;
      // Head
      ctx.beginPath();
      ctx.arc(0, 8, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Torso
      ctx.fillRect(-7, 15, 14, 18);
      ctx.strokeRect(-7, 15, 14, 18);
      // Waving arm
      ctx.strokeStyle = "#F2F5F8";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(7, 18);
      ctx.lineTo(15, 6 + wave);
      ctx.stroke();

      // Beacon tag
      ctx.fillStyle = "#57C7FF";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText("SOS // POW", 0, -10);
      ctx.restore();
    }
  }

  private drawPickups(ctx: CanvasRenderingContext2D, pickups: PickupItem[], t: number): void {
    for (const item of pickups) {
      if (item.collected) continue;
      const bob = Math.sin(t * 4.5 + item.x) * 4;
      ctx.save();
      ctx.translate(item.x, item.y + bob);

      const color = item.kind === "medgel" ? "#4CE08A" : item.kind === "emp" ? "#4DA8DA" : "#FF9500";
      ctx.fillStyle = "#101822";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.fillRect(-14, -12, 28, 24);
      ctx.strokeRect(-14, -12, 28, 24);

      ctx.fillStyle = color;
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(item.kind === "medgel" ? "+HP" : item.kind === "emp" ? "EMP" : "WPN", 0, 3);
      ctx.restore();
    }
  }

  private drawDebris(ctx: CanvasRenderingContext2D, debris: DebrisHazard[]): void {
    for (const d of debris) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);
      ctx.fillStyle = "#2A3644";
      ctx.strokeStyle = "#080B10";
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const rad = d.r * (i % 2 === 0 ? 1 : 0.72);
        if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // White metallic rim
      ctx.strokeStyle = "rgba(230, 242, 255, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, d.r * 0.6, -1.2, 0.4);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawExitBeacon(ctx: CanvasRenderingContext2D, snap: RenderSnapshot): void {
    if (!snap.exitUnlocked) return;
    const x = snap.mission.exitX;
    const y = snap.mission.mode === "starship" ? 270 : 410;
    const pulse = 0.65 + Math.sin(snap.time * 6) * 0.35;

    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = `rgba(77, 168, 218, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(-26, -54, 52, 108);

    ctx.fillStyle = `rgba(77, 168, 218, ${0.15 * pulse})`;
    ctx.fillRect(-26, -54, 52, 108);

    ctx.fillStyle = "#F2F5F8";
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.fillText(snap.mission.id === 4 ? "CORE TERMINAL" : "EXTRACT >>", 0, -64);
    ctx.restore();
  }

  private drawVisionCone(ctx: CanvasRenderingContext2D, e: EnemyEntity, t: number): void {
    const ox = e.x + e.w * 0.5;
    const oy = e.y + e.h * 0.32;
    const isCombat = e.state === "combat";
    const isSusp = e.awareness > 20 || e.state === "investigate";

    const colorStart = isCombat
      ? "rgba(255, 59, 47, 0.34)"
      : isSusp
      ? "rgba(255, 149, 0, 0.30)"
      : "rgba(255, 130, 60, 0.20)";
    const colorEnd = "rgba(255, 59, 47, 0)";

    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(e.aimAngle);
    const g = ctx.createLinearGradient(0, 0, e.visionRange, 0);
    g.addColorStop(0, colorStart);
    g.addColorStop(1, colorEnd);

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, e.visionRange, -e.visionAngle, e.visionAngle);
    ctx.closePath();
    ctx.fill();

    // Crisp outer scanner edges
    ctx.strokeStyle = isCombat
      ? `rgba(255, 59, 47, ${0.65 + Math.sin(t * 14) * 0.25})`
      : "rgba(255, 155, 80, 0.42)";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(-e.visionAngle) * e.visionRange, Math.sin(-e.visionAngle) * e.visionRange);
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(e.visionAngle) * e.visionRange, Math.sin(e.visionAngle) * e.visionRange);
    ctx.stroke();
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, e: EnemyEntity, t: number): void {
    ctx.save();
    const cx = e.x + e.w * 0.5;
    const cy = e.y + e.h * 0.5;
    ctx.translate(cx, cy);

    const flash = e.hitFlash > 0;
    const stunned = e.state === "stunned" || e.disabledByHack;

    if (e.kind === "trooper") {
      ctx.scale(e.facing, 1);
      const walk = Math.abs(e.vx) > 5 ? Math.sin(t * 10) * 6 : 0;
      ctx.strokeStyle = "#06080D";
      ctx.lineWidth = 3;
      // Legs
      ctx.fillStyle = flash ? "#FFFFFF" : "#1C2733";
      ctx.fillRect(-8 + walk * 0.5, 8, 7, 18);
      ctx.strokeRect(-8 + walk * 0.5, 8, 7, 18);
      ctx.fillRect(1 - walk * 0.5, 8, 7, 18);
      ctx.strokeRect(1 - walk * 0.5, 8, 7, 18);
      // Torso armor
      ctx.fillStyle = flash ? "#FFFFFF" : "#304052";
      ctx.fillRect(-11, -12, 22, 22);
      ctx.strokeRect(-11, -12, 22, 22);
      // Helmet + visor slit
      ctx.fillStyle = flash ? "#FFFFFF" : "#C5D4E2";
      ctx.beginPath();
      ctx.arc(0, -18, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = stunned ? "#4DA8DA" : "#FF3B2F";
      ctx.fillRect(2, -20, 7, 4);
      // Carbine
      ctx.fillStyle = "#0A0E14";
      ctx.fillRect(4, -5, 18, 5);
    } else if (e.kind === "drone" || e.kind === "interceptor") {
      const hover = Math.sin(t * 6 + e.x) * 3;
      ctx.translate(0, hover);
      ctx.scale(e.facing, 1);
      ctx.fillStyle = flash ? "#FFFFFF" : "#1D2835";
      ctx.strokeStyle = "#06080D";
      ctx.lineWidth = 3;
      // Swept orbital wing chassis
      ctx.beginPath();
      ctx.moveTo(20, 0);
      ctx.lineTo(-10, -14);
      ctx.lineTo(-20, -6);
      ctx.lineTo(-14, 12);
      ctx.lineTo(12, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // White ceramic ink highlight
      ctx.strokeStyle = "#E5EFF7";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-8, -10);
      ctx.lineTo(16, -2);
      ctx.stroke();
      // Optical eye
      ctx.fillStyle = stunned ? "#4DA8DA" : e.state === "combat" ? "#FF3B2F" : "#FF9500";
      ctx.beginPath();
      ctx.arc(10, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === "camera" || e.kind === "turret") {
      ctx.fillStyle = flash ? "#FFFFFF" : "#222E3D";
      ctx.strokeStyle = "#06080D";
      ctx.lineWidth = 3;
      ctx.fillRect(-14, -10, 28, 20);
      ctx.strokeRect(-14, -10, 28, 20);
      ctx.rotate(e.aimAngle);
      ctx.fillStyle = "#D4E2EE";
      ctx.fillRect(0, -5, 18, 10);
      ctx.strokeRect(0, -5, 18, 10);
      ctx.fillStyle = stunned ? "#4DA8DA" : "#FF3B2F";
      ctx.fillRect(14, -3, 5, 6);
    } else if (e.kind === "heavy") {
      ctx.scale(e.facing, 1);
      ctx.fillStyle = flash ? "#FFFFFF" : "#232F3E";
      ctx.strokeStyle = "#06080D";
      ctx.lineWidth = 3.5;
      // Exo-walker chassis
      ctx.fillRect(-18, -26, 36, 42);
      ctx.strokeRect(-18, -26, 36, 42);
      ctx.fillStyle = "#D8E4EE";
      ctx.fillRect(-14, -22, 24, 10);
      // Heavy legs
      ctx.fillStyle = "#141C26";
      ctx.fillRect(-14, 16, 11, 16);
      ctx.fillRect(3, 16, 11, 16);
      // Glowing eye
      ctx.fillStyle = stunned ? "#4DA8DA" : "#FF3B2F";
      ctx.fillRect(6, -18, 10, 5);
      // Frontal directional riot shield
      if (e.shielded && !stunned) {
        ctx.fillStyle = "rgba(77, 168, 218, 0.32)";
        ctx.strokeStyle = "#57C7FF";
        ctx.lineWidth = 2.5;
        ctx.fillRect(18, -24, 7, 46);
        ctx.strokeRect(18, -24, 7, 46);
      }
    }

    ctx.restore();

    // EMP Stun electric arcs
    if (stunned) {
      ctx.strokeStyle = "#57C7FF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y + 8);
      ctx.lineTo(e.x + e.w * 0.5, e.y - 4 + Math.sin(t * 30) * 5);
      ctx.lineTo(e.x + e.w, e.y + 10);
      ctx.stroke();
    }

    // Iconic MGS "?" and "!" Ink Alert Emblems
    if (e.state === "combat") {
      this.drawAlertEmblem(ctx, cx, e.y - 20, "!", "#FF3B2F");
    } else if (e.awareness > 18 || e.state === "investigate") {
      this.drawAlertEmblem(ctx, cx, e.y - 20, "?", "#FF9500");
    }

    // Compact HP bar when damaged
    if (e.hp < e.maxHp) {
      ctx.fillStyle = "#080B10";
      ctx.fillRect(e.x, e.y - 9, e.w, 4);
      ctx.fillStyle = "#FF3B2F";
      ctx.fillRect(e.x, e.y - 9, e.w * Math.max(0, e.hp / e.maxHp), 4);
    }
  }

  private drawAlertEmblem(ctx: CanvasRenderingContext2D, x: number, y: number, sym: string, color: string): void {
    ctx.save();
    ctx.translate(x, y);
    // Sumi-e ink diamond backing
    ctx.fillStyle = "#07090D";
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(13, 0);
    ctx.lineTo(0, 14);
    ctx.lineTo(-13, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = "900 16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(sym, 0, 1);
    ctx.restore();
  }

  private drawAstronaut(ctx: CanvasRenderingContext2D, p: PlayerRenderState, eva: boolean, t: number): void {
    ctx.save();
    const cx = p.x + p.w * 0.5;
    const bottomY = p.y + p.h;
    ctx.translate(cx, bottomY);

    // Invulnerability blink & Optical Camo stealth shimmer
    if (p.invulnTimer > 0 && Math.floor(t * 20) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    } else if (p.camoTimer > 0) {
      ctx.globalAlpha = 0.26 + Math.sin(t * 18) * 0.08;
    }

    if (p.inBox) {
      // Iconic MLI Gold-Silver Thermal-Foil Box!
      const bob = Math.abs(p.vx) > 10 ? Math.sin(t * 16) * 2.5 : 0;
      ctx.translate(0, bob);
      ctx.fillStyle = "#C8A951";
      ctx.strokeStyle = "#07090D";
      ctx.lineWidth = 3.5;
      ctx.fillRect(-20, -40, 40, 40);
      ctx.strokeRect(-20, -40, 40, 40);
      // Crinkled metallic foil highlights
      ctx.fillStyle = "rgba(255, 250, 225, 0.42)";
      ctx.beginPath();
      ctx.moveTo(-18, -38);
      ctx.lineTo(8, -38);
      ctx.lineTo(-4, -18);
      ctx.lineTo(-18, -24);
      ctx.closePath();
      ctx.fill();
      // Stencil text
      ctx.fillStyle = "#090C11";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.fillText("MLI-09", 0, -14);
      // Tiny peeking visor eyes when moving!
      if (Math.abs(p.vx) > 8) {
        ctx.fillStyle = "#090C11";
        ctx.fillRect(-9, -31, 18, 5);
        ctx.fillStyle = "#FF3B2F";
        ctx.fillRect(p.facing > 0 ? 1 : -7, -30, 5, 3);
      }
      ctx.restore();
      return;
    }

    const bodyH = p.crouching ? 34 : 52;
    const stride = p.onGround && Math.abs(p.vx) > 15 ? Math.sin(p.animTime * 13) * 8 : 0;

    // Ground contact ink shadow
    if (p.onGround) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.beginPath();
      ctx.ellipse(0, 1, 16, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.scale(p.facing, 1);

    // Tactical ink stroke outline style (Style A!)
    ctx.strokeStyle = "#05070B";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";

    // EVA Life-Support Pack with angular vents & blue telemetry LED
    ctx.fillStyle = "#1E2B3B";
    ctx.beginPath();
    ctx.moveTo(-17, -bodyH + 10);
    ctx.lineTo(-7, -bodyH + 8);
    ctx.lineTo(-7, -bodyH + 10 + bodyH * 0.46);
    ctx.lineTo(-16, -bodyH + 10 + bodyH * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#57C7FF";
    ctx.fillRect(-15, -bodyH + 15, 4, 3);

    // Articulated tactical legs with stark ink shading
    if (p.crouching) {
      // Back knee tucked
      ctx.fillStyle = "#1A2533";
      ctx.beginPath();
      ctx.moveTo(-10, -14);
      ctx.lineTo(2, -14);
      ctx.lineTo(0, 0);
      ctx.lineTo(-12, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // Front knee bent forward
      ctx.fillStyle = "#E4EEF6";
      ctx.beginPath();
      ctx.moveTo(-2, -14);
      ctx.lineTo(13, -11);
      ctx.lineTo(11, 0);
      ctx.lineTo(2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Back leg (ink-shadowed)
      ctx.fillStyle = "#223040";
      ctx.beginPath();
      ctx.moveTo(-5, -21);
      ctx.lineTo(2, -21);
      ctx.lineTo(1 - stride * 0.75, 0);
      ctx.lineTo(-7 - stride * 0.75, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Front leg (stark ceramic white highlight + dark shin guard)
      ctx.fillStyle = "#EDF4F9";
      ctx.beginPath();
      ctx.moveTo(-2, -21);
      ctx.lineTo(7, -21);
      ctx.lineTo(9 + stride * 0.75, 0);
      ctx.lineTo(0 + stride * 0.75, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#0F1620";
      ctx.fillRect(1 + stride * 0.55, -8, 7, 8);
    }

    // Tapered Armored Torso & Tactical Harness
    const torsoY = p.crouching ? -30 : -41;
    const torsoH = p.crouching ? 18 : 22;
    ctx.fillStyle = "#F0F6FA";
    ctx.beginPath();
    ctx.moveTo(-10, torsoY + 2);
    ctx.lineTo(10, torsoY);
    ctx.lineTo(8, torsoY + torsoH);
    ctx.lineTo(-8, torsoY + torsoH);
    ctx.closePath();
    ctx.fill();
    // Heavy sumi-e back-half shadow + diagonal chest strap
    ctx.fillStyle = "#141E2B";
    ctx.beginPath();
    ctx.moveTo(-10, torsoY + 2);
    ctx.lineTo(1, torsoY + 1);
    ctx.lineTo(-1, torsoY + torsoH);
    ctx.lineTo(-8, torsoY + torsoH);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#05070B";
    ctx.stroke();
    // Tactical belt & shoulder pauldron
    ctx.fillStyle = "#0B1018";
    ctx.fillRect(-9, torsoY + torsoH - 5, 18, 5);
    ctx.fillStyle = "#DCE7F0";
    ctx.beginPath();
    ctx.ellipse(-2, torsoY + 4, 7, 4.5, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Helmet with sleek aerospace brow & signature crimson Shinkawa visor brush glint
    const headY = p.crouching ? -37 : -48;
    ctx.fillStyle = "#F2F6FA";
    ctx.beginPath();
    ctx.arc(1, headY, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Helmet dark shadow rim
    ctx.fillStyle = "#192534";
    ctx.beginPath();
    ctx.arc(1, headY, 9.2, Math.PI * 0.65, Math.PI * 1.55);
    ctx.fill();

    // Dark recessed visor
    ctx.fillStyle = "#080C12";
    ctx.beginPath();
    ctx.ellipse(5.2, headY + 0.5, 6.2, 5.4, 0.08, 0, Math.PI * 2);
    ctx.fill();
    // Signature Shinkawa crimson brush streak across visor!
    ctx.strokeStyle = "#FF3B2F";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(2, headY + 1);
    ctx.lineTo(11, headY - 3);
    ctx.stroke();

    ctx.restore();

    // Aimed weapon arm + subtle tactical laser sight
    const shoulderY = p.crouching ? -21 : -33;
    ctx.save();
    ctx.translate(0, shoulderY);
    ctx.rotate(p.aimAngle);

    // Faint tactical laser sight line
    ctx.strokeStyle =
      p.weaponId === "silenced_rail" ? "rgba(77, 168, 218, 0.25)" : "rgba(255, 59, 47, 0.3)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(135, 0);
    ctx.stroke();

    // Weapon silhouette
    ctx.fillStyle = "#0C1118";
    ctx.strokeStyle = "#E8F1F8";
    ctx.lineWidth = 1.2;
    if (p.weaponId === "silenced_rail") {
      ctx.fillRect(6, -3, 22, 5);
      ctx.strokeRect(6, -3, 22, 5);
    } else if (p.weaponId === "piercing_rail") {
      ctx.fillRect(4, -4, 30, 7);
      ctx.fillStyle = "#FF3B2F";
      ctx.fillRect(14, -1.5, 16, 2);
    } else {
      ctx.fillRect(5, -4, 26, 7);
      ctx.strokeRect(5, -4, 26, 7);
    }
    ctx.restore();

    // EVA thruster fuel micro-arc when airborne in Mission 3
    if (eva && !p.onGround) {
      ctx.fillStyle = "rgba(10, 16, 24, 0.7)";
      ctx.fillRect(-16, -bodyH - 14, 32, 4);
      ctx.fillStyle = "#4DA8DA";
      ctx.fillRect(-16, -bodyH - 14, 32 * p.evaFuel, 4);
    }

    // CQC Ink-Slash flourish
    if (p.cqcAnim > 0) {
      ctx.strokeStyle = "#F2F5F8";
      ctx.lineWidth = 5 * (p.cqcAnim / 0.22);
      ctx.beginPath();
      ctx.arc(p.facing * 12, -26, 36, p.facing > 0 ? -1.1 : Math.PI - 0.9, p.facing > 0 ? 0.9 : Math.PI + 1.1);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawStarship(ctx: CanvasRenderingContext2D, p: PlayerRenderState, t: number): void {
    ctx.save();
    const cx = p.x + p.w * 0.5;
    const cy = p.y + p.h * 0.5;
    ctx.translate(cx, cy);

    const pitch = Math.max(-0.28, Math.min(0.28, p.vy * 0.00085));
    ctx.rotate(pitch);

    if (p.invulnTimer > 0 && Math.floor(t * 20) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    } else if (p.coldDrift || p.camoTimer > 0) {
      ctx.globalAlpha = 0.42;
    }

    // Thruster flame (off during Cold Drift thermal stealth!)
    if (!p.coldDrift) {
      const flameLen = 26 + Math.sin(t * 36) * 8;
      const g = ctx.createLinearGradient(-26, 0, -26 - flameLen, 0);
      g.addColorStop(0, "#FFFFFF");
      g.addColorStop(0.4, "#57C7FF");
      g.addColorStop(1, "rgba(77, 168, 218, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-24, -7);
      ctx.lineTo(-26 - flameLen, 0);
      ctx.lineTo(-24, 7);
      ctx.closePath();
      ctx.fill();
    }

    // Sleek delta-wing Starship Vesper in Shinkawa ink
    ctx.fillStyle = p.coldDrift ? "#5C89A8" : "#EDF3F8";
    ctx.strokeStyle = "#06080D";
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(34, 0);
    ctx.lineTo(4, -14);
    ctx.lineTo(-26, -18);
    ctx.lineTo(-18, -6);
    ctx.lineTo(-26, 0);
    ctx.lineTo(-18, 6);
    ctx.lineTo(-26, 18);
    ctx.lineTo(4, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Heavy ink belly shading
    ctx.fillStyle = "#182330";
    ctx.beginPath();
    ctx.moveTo(34, 0);
    ctx.lineTo(4, 14);
    ctx.lineTo(-26, 18);
    ctx.lineTo(-18, 6);
    ctx.lineTo(-26, 0);
    ctx.closePath();
    ctx.fill();

    // Cockpit crimson/cyan visor canopy
    ctx.fillStyle = p.coldDrift ? "#4DA8DA" : "#FF3B2F";
    ctx.beginPath();
    ctx.ellipse(10, -3, 8, 3.5, 0.1, 0, Math.PI * 2);
    ctx.fill();

    if (p.coldDrift) {
      ctx.strokeStyle = "#57C7FF";
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(2, 0, 42, 24, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  private drawBoss(ctx: CanvasRenderingContext2D, b: BossEntity, t: number): void {
    const cx = b.x + b.w * 0.5;
    const cy = b.y + b.h * 0.5;
    const flash = b.hitFlash > 0;

    if (b.id === "iron_gantry") {
      ctx.save();
      ctx.translate(cx, cy);
      // Towering launch-tower crane loader mech
      ctx.fillStyle = flash ? "#FFFFFF" : "#222E3D";
      ctx.strokeStyle = "#06080D";
      ctx.lineWidth = 4;
      ctx.fillRect(-52, -60, 104, 102);
      ctx.strokeRect(-52, -60, 104, 102);

      // White ceramic shoulder cowl
      ctx.fillStyle = flash ? "#FFFFFF" : "#DDE7F0";
      ctx.fillRect(-46, -54, 72, 24);
      ctx.strokeRect(-46, -54, 72, 24);

      // Tank treads / heavy legs
      ctx.fillStyle = "#111720";
      ctx.fillRect(-56, 38, 112, 28);
      ctx.strokeRect(-56, 38, 112, 28);

      // Glowing hydraulic coolant vents (weak point when vulnerable/overheated!)
      const ventOpen = b.vulnerableTimer > 0 || b.stunTimer > 0;
      ctx.fillStyle = ventOpen ? "#FF9500" : "#552020";
      ctx.fillRect(-26, -12, 52, 26);
      ctx.strokeRect(-26, -12, 52, 26);
      if (ventOpen) {
        ctx.fillStyle = "#FFF4D2";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.fillText("VENT OPEN!", 0, -22);
      }

      // Red scanner eye
      ctx.fillStyle = b.stunTimer > 0 ? "#4DA8DA" : "#FF3B2F";
      ctx.fillRect(-38, -44, 24, 8);

      // Hydraulic claw arm
      const clawReach = b.attackTelegraph > 0 ? -18 : Math.sin(t * 4) * 6;
      ctx.fillStyle = "#1A2430";
      ctx.fillRect(-84 + clawReach, -18, 36, 18);
      ctx.strokeRect(-84 + clawReach, -18, 36, 18);
      ctx.restore();
    } else if (b.id === "valkyrie_09") {
      ctx.save();
      ctx.translate(cx, cy);
      // Sleek orbital hunter-killer gunship
      ctx.fillStyle = flash ? "#FFFFFF" : "#1C2634";
      ctx.strokeStyle = "#06080D";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-56, 0);
      ctx.lineTo(12, -36);
      ctx.lineTo(54, -22);
      ctx.lineTo(36, 0);
      ctx.lineTo(54, 22);
      ctx.lineTo(12, 36);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#E4EDF5";
      ctx.beginPath();
      ctx.moveTo(-42, 0);
      ctx.lineTo(12, -24);
      ctx.lineTo(24, 0);
      ctx.closePath();
      ctx.fill();

      // Core eye
      ctx.fillStyle = "#FF3B2F";
      ctx.beginPath();
      ctx.arc(-10, 0, 9, 0, Math.PI * 2);
      ctx.fill();

      // Rotating energy shield arc
      if (b.stunTimer <= 0) {
        ctx.strokeStyle = "#57C7FF";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 66, b.shieldAngle - 0.9, b.shieldAngle + 0.9);
        ctx.stroke();
      }
      ctx.restore();
    } else if (b.id === "mirror") {
      // Optical Relay Prism Nodes around deck
      for (const r of b.relays) {
        if (!r.active) continue;
        ctx.save();
        ctx.translate(r.x, r.y + Math.sin(t * 5 + r.x) * 6);
        ctx.fillStyle = "#172534";
        ctx.strokeStyle = "#FF9500";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(15, 0);
        ctx.lineTo(0, 18);
        ctx.lineTo(-15, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#FF9500";
        ctx.font = "bold 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText("PRISM", 0, -24);
        ctx.restore();
      }

      // Holo clones
      for (const c of b.clones) {
        if (c.hp <= 0) continue;
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.globalAlpha = 0.55 + Math.sin(t * 14) * 0.15;
        this.drawMirrorChassis(ctx, false, t, true);
        ctx.restore();
      }

      // Real Mirror chassis
      ctx.save();
      ctx.translate(cx, cy);
      this.drawMirrorChassis(ctx, flash, t, false);
      ctx.restore();
    } else if (b.id === "lark_prime") {
      ctx.save();
      ctx.translate(cx, cy);

      // Sweeping orbital beam telegraph / active beam
      if (b.sweepingBeamActive) {
        ctx.save();
        ctx.rotate(b.sweepingBeamAngle);
        ctx.strokeStyle = "rgba(255, 59, 47, 0.35)";
        ctx.lineWidth = 22;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(720, 0);
        ctx.stroke();
        ctx.strokeStyle = "#FFF0EE";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(720, 0);
        ctx.stroke();
        ctx.restore();
      }

      // Rotating Directorate containment halos
      ctx.strokeStyle = b.phase === 3 ? "#57C7FF" : "#FF3B2F";
      ctx.lineWidth = 4;
      ctx.save();
      ctx.rotate(t * (1.2 + b.phase * 0.4));
      ctx.strokeRect(-58, -58, 116, 116);
      ctx.restore();

      ctx.strokeStyle = "#DCE7F0";
      ctx.lineWidth = 3;
      ctx.save();
      ctx.rotate(-t * 0.9);
      ctx.beginPath();
      ctx.arc(0, 0, 74, 0, Math.PI * 1.55);
      ctx.stroke();
      ctx.restore();

      // Central neural core sphere
      const cg = ctx.createRadialGradient(0, 0, 6, 0, 0, 48);
      cg.addColorStop(0, flash ? "#FFFFFF" : "#E8F9FF");
      cg.addColorStop(0.55, b.phase === 3 ? "#4DA8DA" : "#FF3B2F");
      cg.addColorStop(1, "#0B111A");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(0, 0, 48, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#06080D";
      ctx.lineWidth = 4;
      ctx.stroke();

      // Inner orbital reticle
      ctx.strokeStyle = "rgba(255,255,255,0.65)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawMirrorChassis(ctx: CanvasRenderingContext2D, flash: boolean, t: number, isClone: boolean): void {
    ctx.fillStyle = flash ? "#FFFFFF" : isClone ? "#1E3A4C" : "#D6E2EC";
    ctx.strokeStyle = "#06080D";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.lineTo(36, -12);
    ctx.lineTo(24, 38);
    ctx.lineTo(-24, 38);
    ctx.lineTo(-36, -12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Split chrome mask shadow
    ctx.fillStyle = "#16202C";
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.lineTo(36, -12);
    ctx.lineTo(24, 38);
    ctx.lineTo(0, 38);
    ctx.closePath();
    ctx.fill();

    // Dual amber / crimson scanner eyes
    ctx.fillStyle = "#FF9500";
    ctx.beginPath();
    ctx.arc(-13, -4, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#FF3B2F";
    ctx.beginPath();
    ctx.arc(13, -4, 7, 0, Math.PI * 2);
    ctx.fill();

    // Shimmering ink slash ring
    ctx.strokeStyle = isClone ? "rgba(87, 199, 255, 0.5)" : "rgba(255, 59, 47, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 48 + Math.sin(t * 7) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D, projectiles: Projectile[]): void {
    for (const p of projectiles) {
      if (p.trail.length > 1) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.piercing ? 4 : 2.2;
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (let i = 1; i < p.trail.length; i++) {
          ctx.lineTo(p.trail[i].x, p.trail[i].y);
        }
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = p.fromPlayer ? "#FFFFFF" : p.color;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  private drawVfx(ctx: CanvasRenderingContext2D, vfx: VfxSystem): void {
    for (const p of vfx.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      if (p.kind === "ring") {
        const progress = 1 - p.life / p.maxLife;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 5 * (1 - progress);
        ctx.beginPath();
        ctx.arc(0, 0, p.size * progress, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === "slash") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 6 * p.alpha;
        ctx.beginPath();
        ctx.moveTo(-p.size * 0.5, -12);
        ctx.quadraticCurveTo(0, 0, p.size * 0.5, 14);
        ctx.stroke();
      } else if (p.kind === "ink") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "casing") {
        ctx.fillStyle = p.color;
        ctx.fillRect(-3, -1.5, 6, 3);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    for (const c of vfx.callouts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (c.life / c.maxLife) * 1.6);
      ctx.font = `900 ${Math.round(13 * c.scale)}px monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#06080D";
      ctx.fillText(c.text, c.x + 1.5, c.y + 1.5);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    }
  }

  private drawInteractPrompt(ctx: CanvasRenderingContext2D, x: number, y: number, label: string): void {
    ctx.save();
    ctx.font = "bold 11px monospace";
    const w = ctx.measureText(label).width + 18;
    ctx.fillStyle = "rgba(9, 12, 17, 0.88)";
    ctx.strokeStyle = "#4DA8DA";
    ctx.lineWidth = 1.6;
    ctx.fillRect(x - w * 0.5, y - 14, w, 20);
    ctx.strokeRect(x - w * 0.5, y - 14, w, 20);
    ctx.fillStyle = "#F2F5F8";
    ctx.textAlign = "center";
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  private drawRain(ctx: CanvasRenderingContext2D, t: number): void {
    ctx.strokeStyle = "rgba(185, 218, 240, 0.22)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const r of this.rainDrops) {
      const rx = (((r.x - t * r.spd * 0.35) % VIEW_W) + VIEW_W) % VIEW_W;
      const ry = (r.y + t * r.spd) % VIEW_H;
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - 5, ry + r.len);
    }
    ctx.stroke();
  }

  private drawReflexOverlay(ctx: CanvasRenderingContext2D, timer: number): void {
    const g = ctx.createRadialGradient(VIEW_W * 0.5, VIEW_H * 0.5, 130, VIEW_W * 0.5, VIEW_H * 0.5, VIEW_W * 0.62);
    g.addColorStop(0, "rgba(255, 59, 47, 0)");
    g.addColorStop(1, "rgba(255, 42, 32, 0.42)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Reflex countdown bar at top center
    ctx.fillStyle = "#07090D";
    ctx.fillRect(VIEW_W * 0.5 - 92, 62, 184, 16);
    ctx.fillStyle = "#FF3B2F";
    ctx.fillRect(VIEW_W * 0.5 - 90, 64, 180 * Math.min(1, timer / 1.25), 12);
    ctx.fillStyle = "#F2F5F8";
    ctx.font = "900 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("REFLEX WINDOW // SILENCE SPOTTER", VIEW_W * 0.5, 57);
  }

  private drawMirrorGlitch(ctx: CanvasRenderingContext2D, t: number, glitchTimer: number): void {
    ctx.save();
    ctx.globalAlpha = Math.min(0.65, glitchTimer * 0.4);
    for (let i = 0; i < 8; i++) {
      const y = ((t * 420 + i * 73) % VIEW_H);
      ctx.fillStyle = i % 2 === 0 ? "rgba(255, 59, 47, 0.25)" : "rgba(87, 199, 255, 0.22)";
      ctx.fillRect(0, y, VIEW_W, 4 + (i % 3) * 4);
    }
    if (Math.sin(t * 16) > -0.2) {
      ctx.fillStyle = "rgba(7, 9, 13, 0.72)";
      ctx.fillRect(VIEW_W * 0.5 - 165, 92, 330, 32);
      ctx.strokeStyle = "#FF3B2F";
      ctx.lineWidth = 2;
      ctx.strokeRect(VIEW_W * 0.5 - 165, 92, 330, 32);
      ctx.fillStyle = "#FF3B2F";
      ctx.font = "900 13px monospace";
      ctx.textAlign = "center";
      ctx.fillText("SIGNAL SPOOFED // SHOOT OPTICAL PRISMS", VIEW_W * 0.5, 112);
    }
    ctx.restore();
  }

  private drawInkVignette(ctx: CanvasRenderingContext2D, alertState: AlertState): void {
    const g = ctx.createRadialGradient(VIEW_W * 0.5, VIEW_H * 0.5, VIEW_W * 0.34, VIEW_W * 0.5, VIEW_H * 0.5, VIEW_W * 0.65);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, alertState === "ALERT" ? "rgba(65, 8, 8, 0.42)" : "rgba(4, 6, 10, 0.46)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  private drawZoneBanner(ctx: CanvasRenderingContext2D, text: string, alpha: number): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(8, 11, 16, 0.84)";
    ctx.fillRect(0, 102, VIEW_W, 38);
    ctx.fillStyle = "#FF3B2F";
    ctx.fillRect(0, 102, VIEW_W, 2);
    ctx.fillRect(0, 138, VIEW_W, 2);
    ctx.fillStyle = "#F2F5F8";
    ctx.font = "900 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, VIEW_W * 0.5, 126);
    ctx.restore();
  }

  private drawBossSplash(
    ctx: CanvasRenderingContext2D,
    splash: { timer: number; name: string; subtitle: string; quote: string }
  ): void {
    ctx.save();
    ctx.fillStyle = "rgba(6, 8, 12, 0.82)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Dramatic diagonal crimson sumi-e brush stripe
    ctx.fillStyle = "#FF3B2F";
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H * 0.44);
    ctx.lineTo(VIEW_W, VIEW_H * 0.32);
    ctx.lineTo(VIEW_W, VIEW_H * 0.58);
    ctx.lineTo(0, VIEW_H * 0.7);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#080B10";
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H * 0.46);
    ctx.lineTo(VIEW_W, VIEW_H * 0.35);
    ctx.lineTo(VIEW_W, VIEW_H * 0.55);
    ctx.lineTo(0, VIEW_H * 0.66);
    ctx.closePath();
    ctx.fill();

    ctx.textAlign = "center";
    ctx.fillStyle = "#FF9500";
    ctx.font = "bold 12px monospace";
    ctx.fillText("TACTICAL INTERCEPT // BOSS ENGAGED", VIEW_W * 0.5, VIEW_H * 0.42);

    ctx.fillStyle = "#F2F5F8";
    ctx.font = "900 44px sans-serif";
    ctx.fillText(splash.name, VIEW_W * 0.5, VIEW_H * 0.515);

    ctx.fillStyle = "#A9C4D9";
    ctx.font = "bold 13px monospace";
    ctx.fillText(splash.subtitle, VIEW_W * 0.5, VIEW_H * 0.57);

    ctx.fillStyle = "#E5EDF5";
    ctx.font = "italic 14px serif";
    ctx.fillText(splash.quote, VIEW_W * 0.5, VIEW_H * 0.66);
    ctx.restore();
  }
}
