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
import { ArtAtlas } from "./atlas";
import { InkSpriteBank } from "./inkSprites";

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
  private atlas = new ArtAtlas();
  private sprites = new InkSpriteBank();
  private stars: Array<{ x: number; y: number; r: number; a: number }> = [];
  private rainDrops: Array<{ x: number; y: number; len: number; spd: number }> = [];
  private motes: Array<{ x: number; y: number; r: number; spd: number; phase: number }> = [];

  constructor() {
    for (let i = 0; i < 110; i++) {
      this.stars.push({
        x: Math.random() * VIEW_W,
        y: Math.random() * VIEW_H * 0.85,
        r: 0.7 + Math.random() * 1.6,
        a: 0.25 + Math.random() * 0.7,
      });
    }
    for (let i = 0; i < 85; i++) {
      this.rainDrops.push({
        x: Math.random() * VIEW_W,
        y: Math.random() * VIEW_H,
        len: 16 + Math.random() * 22,
        spd: 580 + Math.random() * 290,
      });
    }
    for (let i = 0; i < 36; i++) {
      this.motes.push({
        x: Math.random() * VIEW_W,
        y: Math.random() * VIEW_H,
        r: 1 + Math.random() * 2.4,
        spd: 14 + Math.random() * 28,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  public render(ctx: CanvasRenderingContext2D, snap: RenderSnapshot): void {
    const shake = snap.vfx.getShakeOffset();
    const camX = snap.cameraX - shake.x;
    const camY = -shake.y;

    ctx.save();

    // 1. Bespoke Painted Shinkawa Parallax Backdrop + Live Atmosphere
    this.drawBackdrop(ctx, snap);

    // 2. World Layer
    ctx.save();
    ctx.translate(-camX, -camY);

    this.drawPlatforms(ctx, snap.mission.platforms, snap.mission.id, snap.time);
    this.drawDecals(ctx, snap.vfx);
    this.drawCheckpoints(ctx, snap.checkpoints, snap.time);
    this.drawHackNodes(ctx, snap.hackNodes, snap.time);
    this.drawLasers(ctx, snap.lasers, snap.time);
    this.drawPows(ctx, snap.pows, snap.time);
    this.drawPickups(ctx, snap.pickups, snap.time);
    this.drawDebris(ctx, snap.debris);
    this.drawExitBeacon(ctx, snap);

    // Volumetric Vision Cones (behind actors so silhouettes stay razor-crisp)
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

    // Player (Articulated Shinkawa Astronaut or Starship Vesper)
    if (snap.mission.mode === "starship") {
      this.drawStarship(ctx, snap.player, snap.time);
    } else {
      this.drawAstronaut(ctx, snap.player, snap.mission.mode === "eva", snap.time);
    }

    // Projectiles & Glowing Tracers
    this.drawProjectiles(ctx, snap.projectiles);

    // World-space Ink VFX & Floating Callouts
    this.drawVfx(ctx, snap.vfx);

    // Contextual Interact Prompt
    if (snap.nearInteractLabel) {
      this.drawInteractPrompt(ctx, snap.player.x + snap.player.w * 0.5, snap.player.y - 24, snap.nearInteractLabel);
    }

    ctx.restore();

    // 3. Mission-Specific Foreground Weather / Atmospheric FX
    this.drawForegroundAtmosphere(ctx, snap);

    // 4. Tactile Sumi-e Paper Grain Unifier
    const grain = this.atlas.getGrainPattern(ctx);
    if (grain) {
      ctx.fillStyle = grain;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    // 5. Reflex Slow-Mo Dramatic Shinkawa Ink Freeze
    if (snap.reflexTimer > 0) {
      this.drawReflexOverlay(ctx, snap.reflexTimer);
    }

    // 6. Mirror's 4th-Wall HUD Glitch Overlay
    if (snap.hudGlitchTimer > 0) {
      this.drawMirrorGlitch(ctx, snap.time, snap.hudGlitchTimer);
    }

    // 7. Hit/Alert Flash & Cinematic Ink Vignette
    if (snap.vfx.flashAlpha > 0.01) {
      ctx.fillStyle = snap.vfx.flashColor;
      ctx.globalAlpha = snap.vfx.flashAlpha;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
    this.drawInkVignette(ctx, snap.alertState);
    this.drawTacticalRadar(ctx, snap);

    // 8. Zone Banner
    if (snap.bannerTimer > 0 && snap.bannerText) {
      this.drawZoneBanner(ctx, snap.bannerText, Math.min(1, snap.bannerTimer));
    }

    // 9. Illustrated Dramatic Boss Title Splash Card
    if (snap.bossSplash.active) {
      this.drawBossSplash(ctx, snap.bossSplash, snap.boss);
    }

    ctx.restore();
  }

  private drawBackdrop(ctx: CanvasRenderingContext2D, snap: RenderSnapshot): void {
    const id = snap.mission.id;
    const camX = snap.cameraX;
    const t = snap.time;
    const maxCam = Math.max(1, snap.mission.width - VIEW_W);
    const progress = Math.min(1, Math.max(0, camX / maxCam));

    const bgImg = this.atlas.getBg(id);
    if (bgImg) {
      // Pan smoothly across the overscaled 16:9 painted Shinkawa panorama
      const drawW = VIEW_W * 1.24;
      const drawH = VIEW_H * 1.12;
      const offsetX = -progress * (drawW - VIEW_W);
      const offsetY = -(drawH - VIEW_H) * 0.45;
      ctx.drawImage(bgImg, offsetX, offsetY, drawW, drawH);

      // Subtle cinematic readability scrim so foreground silhouettes, vision cones & HUD pop!
      const scrim = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      if (id === 3) {
        scrim.addColorStop(0, "rgba(4, 7, 12, 0.28)");
        scrim.addColorStop(0.55, "rgba(5, 9, 16, 0.22)");
        scrim.addColorStop(1, "rgba(5, 8, 14, 0.56)");
      } else if (id === 2) {
        scrim.addColorStop(0, "rgba(4, 7, 12, 0.34)");
        scrim.addColorStop(0.6, "rgba(5, 9, 15, 0.22)");
        scrim.addColorStop(1, "rgba(6, 9, 14, 0.44)");
      } else {
        scrim.addColorStop(0, "rgba(4, 7, 12, 0.36)");
        scrim.addColorStop(0.55, "rgba(6, 10, 16, 0.28)");
        scrim.addColorStop(1, "rgba(5, 8, 13, 0.68)");
      }
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    } else {
      ctx.fillStyle = "#070B12";
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }

    // Live mission-specific parallax & dynamic lighting layered OVER the painted panorama
    if (id === 1) {
      // Distant lightning pulse in storm clouds
      const lightning = Math.sin(t * 0.9) > 0.965 ? (Math.sin(t * 48) > 0 ? 0.24 : 0.08) : 0;
      if (lightning > 0) {
        ctx.fillStyle = `rgba(180, 224, 255, ${lightning})`;
        ctx.fillRect(0, 0, VIEW_W, VIEW_H * 0.65);
      }

      // Live sweeping volumetric tungsten searchlights
      for (let i = 0; i < 2; i++) {
        const bx = ((i * 520 + 210 - camX * 0.16) % (VIEW_W + 240) + (VIEW_W + 240)) % (VIEW_W + 240) - 120;
        const sway = Math.sin(t * (0.55 + i * 0.22) + i * 2) * 0.32;
        ctx.save();
        ctx.translate(bx, 470);
        ctx.rotate(-Math.PI * 0.5 + sway);
        const lg = ctx.createLinearGradient(0, 0, 560, 0);
        lg.addColorStop(0, "rgba(150, 212, 248, 0.14)");
        lg.addColorStop(1, "rgba(150, 212, 248, 0)");
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(560, -76);
        ctx.lineTo(560, 76);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Towering Starship Vesper silhouette on Pad 39-X near end of Mission 1
      const shipScreenX = 3600 - camX;
      if (shipScreenX > -180 && shipScreenX < VIEW_W + 180) {
        this.drawPadStarshipSilhouette(ctx, shipScreenX, 468, t);
      }
    } else if (id === 2) {
      // High-velocity orbital star parallax + atmospheric friction streaks
      this.drawStars(ctx, camX * 0.22 + t * 55, 0.7);
      ctx.strokeStyle = "rgba(255, 185, 110, 0.2)";
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 22; i++) {
        const sx = (((i * 211 - t * 760) % VIEW_W) + VIEW_W) % VIEW_W;
        const sy = (i * 47) % VIEW_H;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 48, sy);
        ctx.stroke();
      }
    } else if (id === 3) {
      // Subtle twinkling star layer + distant orbital beacon strobes
      this.drawStars(ctx, camX * 0.06, 0.55);
      for (let i = 0; i < 4; i++) {
        const bx = ((i * 280 + 130 - camX * 0.14) % VIEW_W + VIEW_W) % VIEW_W;
        const by = 110 + (i % 2) * 75;
        const blink = Math.sin(t * 3.5 + i * 1.7) > 0.35;
        if (blink) {
          const rg = ctx.createRadialGradient(bx, by, 1, bx, by, 14);
          rg.addColorStop(0, "rgba(255, 59, 47, 0.85)");
          rg.addColorStop(1, "rgba(255, 59, 47, 0)");
          ctx.fillStyle = rg;
          ctx.beginPath();
          ctx.arc(bx, by, 14, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      // Mission 4: Pulsing vertical data-stream columns & core chamber aura
      for (let i = 0; i < 8; i++) {
        const x = ((i * 155 - camX * 0.22) % (VIEW_W + 155) + (VIEW_W + 155)) % (VIEW_W + 155) - 60;
        const dropY = ((t * (120 + i * 19) + i * 97) % (VIEW_H + 120)) - 60;
        const dg = ctx.createLinearGradient(x, dropY - 60, x, dropY + 20);
        dg.addColorStop(0, "rgba(87, 199, 255, 0)");
        dg.addColorStop(0.75, "rgba(87, 199, 255, 0.32)");
        dg.addColorStop(1, "rgba(235, 248, 255, 0.65)");
        ctx.strokeStyle = dg;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, dropY - 60);
        ctx.lineTo(x, dropY + 20);
        ctx.stroke();
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

  private drawPadStarshipSilhouette(ctx: CanvasRenderingContext2D, x: number, groundY: number, t: number): void {
    ctx.save();
    ctx.translate(x, groundY);

    // Tall riveted umbilical launch tower
    ctx.fillStyle = "rgba(8, 12, 18, 0.88)";
    ctx.fillRect(-102, -370, 48, 370);
    ctx.strokeStyle = "#3B526B";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-102, -370, 48, 370);
    for (let y = -350; y < 0; y += 34) {
      ctx.beginPath();
      ctx.moveTo(-102, y);
      ctx.lineTo(-54, y + 34);
      ctx.moveTo(-54, y);
      ctx.lineTo(-102, y + 34);
      ctx.stroke();
    }

    // Starship Vesper sculpted hull on pad
    const bodyGrad = ctx.createLinearGradient(-40, 0, 42, 0);
    bodyGrad.addColorStop(0, "#F2F7FB");
    bodyGrad.addColorStop(0.45, "#9BB3C9");
    bodyGrad.addColorStop(0.55, "#151F2C");
    bodyGrad.addColorStop(1, "#070B11");
    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = "#04060A";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -350);
    ctx.quadraticCurveTo(38, -260, 35, -38);
    ctx.lineTo(54, 0);
    ctx.lineTo(-54, 0);
    ctx.lineTo(-35, -38);
    ctx.quadraticCurveTo(-38, -260, 0, -350);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cryogenic liquid-oxygen vent plume
    for (let i = 0; i < 4; i++) {
      const p = ((t * 36 + i * 16) % 64) / 64;
      ctx.fillStyle = `rgba(215, 238, 255, ${(1 - p) * 0.28})`;
      ctx.beginPath();
      ctx.arc(-42 - p * 46, -185 - p * 38, 8 + p * 22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPlatforms(ctx: CanvasRenderingContext2D, platforms: Platform[], missionId: number, t: number): void {
    for (const p of platforms) {
      if (p.kind === "solid") {
        // Multi-layer steel deck with metallic top plate, I-beam girder web, and rim glow
        const deckGrad = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
        deckGrad.addColorStop(0, "#233244");
        deckGrad.addColorStop(0.18, "#131C27");
        deckGrad.addColorStop(1, "#070A10");
        ctx.fillStyle = deckGrad;
        ctx.fillRect(p.x, p.y, p.w, p.h);

        // Wet/polished steel top specular highlight (Shinkawa stark rim)
        ctx.fillStyle = "#E8F2FA";
        ctx.fillRect(p.x, p.y, p.w, 3.5);
        ctx.fillStyle = "rgba(87, 199, 255, 0.35)";
        ctx.fillRect(p.x, p.y + 3.5, p.w, 2.5);

        // Deep girder recess & diagonal ink cross-trusses
        ctx.strokeStyle = "#04060A";
        ctx.lineWidth = 3;
        ctx.strokeRect(p.x, p.y, p.w, p.h);

        ctx.strokeStyle = "rgba(175, 212, 240, 0.2)";
        ctx.lineWidth = 1.6;
        for (let tx = p.x + 12; tx < p.x + p.w - 24; tx += 52) {
          ctx.beginPath();
          ctx.moveTo(tx, p.y + 9);
          ctx.lineTo(tx + 26, p.y + Math.min(p.h - 5, 34));
          ctx.lineTo(tx + 52, p.y + 9);
          ctx.stroke();
          // Rivet bolts
          ctx.fillStyle = "#8BA8C2";
          ctx.fillRect(tx - 1, p.y + 11, 2.5, 2.5);
        }
      } else if (p.kind === "oneway") {
        // Suspended aerospace gantry catwalk with hanging cable sag & railing stanchions
        ctx.fillStyle = "#192432";
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.fillStyle = "#EDF5FC";
        ctx.fillRect(p.x, p.y, p.w, 3);
        ctx.fillStyle = "#080C12";
        ctx.fillRect(p.x, p.y + p.h - 4, p.w, 4);
        ctx.strokeStyle = "#04060A";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(p.x, p.y, p.w, p.h);

        // Perforated grating cutouts
        ctx.fillStyle = "#0B111A";
        for (let gx = p.x + 10; gx < p.x + p.w - 14; gx += 18) {
          ctx.fillRect(gx, p.y + 6, 10, 4);
        }

        // Subtle hanging power cable loop underneath
        ctx.strokeStyle = "rgba(10, 16, 24, 0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x + 14, p.y + p.h);
        ctx.quadraticCurveTo(p.x + p.w * 0.5, p.y + p.h + 14, p.x + p.w - 14, p.y + p.h);
        ctx.stroke();

        // Safety handrail posts + top rail line
        ctx.strokeStyle = "rgba(215, 234, 248, 0.28)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(p.x + 4, p.y - 13);
        ctx.lineTo(p.x + p.w - 4, p.y - 13);
        for (let rx = p.x + 10; rx < p.x + p.w; rx += 32) {
          ctx.moveTo(rx, p.y);
          ctx.lineTo(rx, p.y - 13);
        }
        ctx.stroke();
      } else if (p.kind === "cover") {
        // High-craft Liquid-Cooled Server Rack Cover Monolith (Style A signature!)
        const glowColor = missionId === 4 ? "rgba(255, 59, 47, 0.24)" : "rgba(87, 199, 255, 0.24)";
        const rg = ctx.createRadialGradient(p.x + p.w * 0.5, p.y + p.h, 4, p.x + p.w * 0.5, p.y + p.h, 52);
        rg.addColorStop(0, glowColor);
        rg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = rg;
        ctx.fillRect(p.x - 28, p.y + p.h - 14, p.w + 56, 28);

        const spr = this.sprites.get(missionId === 4 ? "cover_rack_core" : "cover_rack");
        if (spr) {
          ctx.drawImage(spr, p.x - 4, p.y - 4, p.w + 8, p.h + 6);
        } else {
          ctx.fillStyle = "#1E2B39";
          ctx.fillRect(p.x, p.y, p.w, p.h);
        }
        // Live pulsing server blade indicator shimmer
        const pulseA = 0.25 + 0.45 * Math.max(0, Math.sin(t * 5 + p.x * 0.08));
        ctx.fillStyle = missionId === 4 ? `rgba(255, 59, 47, ${pulseA})` : `rgba(87, 199, 255, ${pulseA})`;
        ctx.fillRect(p.x + 12, p.y + 13, p.w * 0.45, 3);
      } else if (p.kind === "destructible") {
        const hpRatio = (p.hp ?? 1) / (p.maxHp ?? 1);
        ctx.fillStyle = "#2E1A1A";
        ctx.fillRect(p.x, p.y, p.w, p.h);
        ctx.save();
        ctx.beginPath();
        ctx.rect(p.x + 3, p.y + 3, p.w - 6, p.h - 6);
        ctx.clip();
        ctx.fillStyle = "#FF9500";
        for (let s = -p.h; s < p.w + p.h; s += 16) {
          ctx.beginPath();
          ctx.moveTo(p.x + s, p.y);
          ctx.lineTo(p.x + s + 7, p.y);
          ctx.lineTo(p.x + s - 12, p.y + p.h);
          ctx.lineTo(p.x + s - 19, p.y + p.h);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        ctx.strokeStyle = "#05070B";
        ctx.lineWidth = 3;
        ctx.strokeRect(p.x, p.y, p.w, p.h);
        if (hpRatio < 1) {
          ctx.fillStyle = "#06080D";
          ctx.fillRect(p.x, p.y - 9, p.w, 5);
          ctx.fillStyle = "#FF3B2F";
          ctx.fillRect(p.x + 1, p.y - 8, (p.w - 2) * hpRatio, 3);
        }
      }
    }
  }

  private drawDecals(ctx: CanvasRenderingContext2D, vfx: VfxSystem): void {
    for (const d of vfx.decals) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.angle);
      ctx.globalAlpha = d.alpha;
      if (d.kind === "scorch") {
        const g = ctx.createRadialGradient(0, 0, 2, 0, 0, d.radius);
        g.addColorStop(0, "rgba(4, 6, 10, 0.92)");
        g.addColorStop(0.65, "rgba(24, 16, 12, 0.45)");
        g.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, d.radius, d.radius * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, d.radius, d.radius * 0.48, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(d.radius * 0.75, -d.radius * 0.22, d.radius * 0.24, 0, Math.PI * 2);
        ctx.arc(-d.radius * 0.65, d.radius * 0.25, d.radius * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawCheckpoints(ctx: CanvasRenderingContext2D, checkpoints: Checkpoint[], t: number): void {
    for (const cp of checkpoints) {
      ctx.save();
      ctx.translate(cp.x, cp.y);
      ctx.strokeStyle = cp.reached ? "#57C7FF" : "#445566";
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -48);
      ctx.stroke();

      ctx.fillStyle = cp.reached ? "#57C7FF" : "#1E2A38";
      ctx.strokeStyle = "#05070B";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -48);
      ctx.lineTo(22, -39);
      ctx.lineTo(0, -30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (cp.reached) {
        const rg = ctx.createRadialGradient(0, -48, 2, 0, -48, 18);
        rg.addColorStop(0, `rgba(87, 199, 255, ${0.5 + Math.sin(t * 6) * 0.25})`);
        rg.addColorStop(1, "rgba(87, 199, 255, 0)");
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(0, -48, 18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private drawHackNodes(ctx: CanvasRenderingContext2D, nodes: HackNode[], t: number): void {
    for (const n of nodes) {
      ctx.save();
      ctx.translate(n.x, n.y);
      const rg = ctx.createRadialGradient(0, -10, 4, 0, -10, 40);
      rg.addColorStop(0, n.hacked ? "rgba(87, 199, 255, 0.34)" : "rgba(255, 149, 0, 0.34)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(0, -10, 40, 0, Math.PI * 2);
      ctx.fill();

      const spr = this.sprites.get(n.hacked ? "hack_terminal_dark" : "hack_terminal");
      if (spr) {
        ctx.drawImage(spr, -24, -40, 48, 55);
      }

      ctx.fillStyle = n.hacked ? "#57C7FF" : Math.sin(t * 7) > 0 ? "#FFD080" : "#FF9500";
      ctx.font = "900 9px monospace";
      ctx.textAlign = "center";
      ctx.fillText(n.hacked ? "SECTOR DARK" : "HACK GRID", 0, -44);
      ctx.restore();
    }
  }

  private drawLasers(ctx: CanvasRenderingContext2D, lasers: LaserBarrier[], t: number): void {
    for (const l of lasers) {
      ctx.fillStyle = "#1E2B3A";
      ctx.strokeStyle = "#05070B";
      ctx.lineWidth = 2.5;
      ctx.fillRect(l.x - 10, l.y - 7, 20, 9);
      ctx.strokeRect(l.x - 10, l.y - 7, 20, 9);
      ctx.fillRect(l.x - 10, l.y + l.h - 2, 20, 9);
      ctx.strokeRect(l.x - 10, l.y + l.h - 2, 20, 9);

      if (l.disabled) continue;
      const cycle = ((t + l.phase) % l.period) / l.period;
      const active = cycle < l.duty;
      if (active) {
        ctx.strokeStyle = "rgba(255, 59, 47, 0.25)";
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(l.x, l.y + l.h);
        ctx.stroke();

        ctx.strokeStyle = "#FF3B2F";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(l.x, l.y + l.h);
        ctx.stroke();

        ctx.strokeStyle = "#FFF4F2";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(l.x, l.y);
        ctx.lineTo(l.x, l.y + l.h);
        ctx.stroke();
      } else {
        ctx.strokeStyle = "rgba(255, 149, 0, 0.3)";
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

      const pulse = 0.65 + Math.sin(t * 5 + p.x) * 0.35;
      const glow = ctx.createRadialGradient(0, 18, 4, 0, 18, 44);
      glow.addColorStop(0, `rgba(87, 199, 255, ${0.38 * pulse})`);
      glow.addColorStop(1, "rgba(87, 199, 255, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 18, 44, 0, Math.PI * 2);
      ctx.fill();

      const spr = this.sprites.get("pow_pod");
      if (spr) {
        const wobble = Math.sin(t * 4 + p.x) * 1.2;
        ctx.drawImage(spr, -24 + wobble * 0.25, -14, 48, 64);
      }

      ctx.fillStyle = "#8BE8FF";
      ctx.font = "900 9.5px monospace";
      ctx.textAlign = "center";
      ctx.fillText(`SOS // ${p.name}`, 0, -18);
      ctx.restore();
    }
  }

  private drawPickups(ctx: CanvasRenderingContext2D, pickups: PickupItem[], t: number): void {
    for (const item of pickups) {
      if (item.collected) continue;
      const bob = Math.sin(t * 4.5 + item.x) * 4.5;
      const color = item.kind === "medgel" ? "#4CE08A" : item.kind === "emp" ? "#57C7FF" : "#FF9500";
      ctx.save();
      ctx.translate(item.x, item.y + bob);

      const rg = ctx.createRadialGradient(0, 0, 3, 0, 0, 32);
      rg.addColorStop(0, `${color}55`);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.fill();

      const key = item.kind === "medgel" ? "item_medgel" : item.kind === "emp" ? "item_emp" : "item_weapon";
      const spr = this.sprites.get(key);
      if (spr) {
        const w = item.kind === "weapon" ? 42 : 34;
        const h = item.kind === "weapon" ? 33 : 34;
        ctx.drawImage(spr, -w * 0.5, -h * 0.5, w, h);
      }

      ctx.fillStyle = color;
      ctx.font = "900 8.5px monospace";
      ctx.textAlign = "center";
      ctx.fillText(item.kind === "medgel" ? "MED-GEL" : item.kind === "emp" ? "EMP ARC" : "WEAPON", 0, -21);
      ctx.restore();
    }
  }

  private drawDebris(ctx: CanvasRenderingContext2D, debris: DebrisHazard[]): void {
    for (const d of debris) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rot);

      const grad = ctx.createLinearGradient(-d.r, -d.r, d.r, d.r);
      grad.addColorStop(0, "#D4E2EE");
      grad.addColorStop(0.4, "#354659");
      grad.addColorStop(1, "#0B1018");
      ctx.fillStyle = grad;
      ctx.strokeStyle = "#04060A";
      ctx.lineWidth = 3;

      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const rad = d.r * (i % 2 === 0 ? 1 : 0.7);
        if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Shattered panel crease
      ctx.strokeStyle = "rgba(235, 246, 255, 0.55)";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-d.r * 0.4, -d.r * 0.3);
      ctx.lineTo(d.r * 0.35, d.r * 0.25);
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
    const rg = ctx.createRadialGradient(0, 0, 8, 0, 0, 82);
    rg.addColorStop(0, `rgba(87, 199, 255, ${0.38 * pulse})`);
    rg.addColorStop(1, "rgba(87, 199, 255, 0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(0, 0, 82, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = `rgba(87, 199, 255, ${pulse})`;
    ctx.lineWidth = 3;
    ctx.strokeRect(-26, -54, 52, 108);
    ctx.fillStyle = `rgba(87, 199, 255, ${0.14 * pulse})`;
    ctx.fillRect(-26, -54, 52, 108);

    ctx.fillStyle = "#F2F7FB";
    ctx.font = "900 11px monospace";
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
      ? "rgba(255, 59, 47, 0.38)"
      : isSusp
      ? "rgba(255, 149, 0, 0.34)"
      : "rgba(255, 125, 52, 0.24)";
    const colorMid = isCombat
      ? "rgba(255, 59, 47, 0.14)"
      : "rgba(255, 130, 60, 0.08)";

    ctx.save();
    ctx.translate(ox, oy);
    ctx.rotate(e.aimAngle);
    const g = ctx.createLinearGradient(0, 0, e.visionRange, 0);
    g.addColorStop(0, colorStart);
    g.addColorStop(0.65, colorMid);
    g.addColorStop(1, "rgba(255, 59, 47, 0)");

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, e.visionRange, -e.visionAngle, e.visionAngle);
    ctx.closePath();
    ctx.fill();

    // Animated scanner sweep arc inside cone
    const sweepR = ((t * 145) % e.visionRange);
    ctx.strokeStyle = isCombat ? "rgba(255, 90, 75, 0.32)" : "rgba(255, 175, 100, 0.2)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, sweepR, -e.visionAngle, e.visionAngle);
    ctx.stroke();

    // Crisp outer scanner rays
    ctx.strokeStyle = isCombat
      ? `rgba(255, 59, 47, ${0.7 + Math.sin(t * 14) * 0.25})`
      : "rgba(255, 160, 90, 0.45)";
    ctx.lineWidth = 1.5;
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
    if (flash) ctx.filter = "brightness(2.8) contrast(1.4)";

    if (e.kind === "trooper") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
      ctx.beginPath();
      ctx.ellipse(0, e.h * 0.5, 16, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.scale(e.facing, 1);
      const moving = Math.abs(e.vx) > 6;
      const frame = moving && Math.floor(t * 7.5) % 2 === 1 ? "trooper_b" : "trooper_a";
      const spr = this.sprites.get(frame);
      if (spr) {
        const bob = moving ? Math.abs(Math.sin(t * 7.5)) * -2 : 0;
        ctx.drawImage(spr, -31, -33 + bob, 62, 62);
      }
    } else if (e.kind === "drone") {
      const hover = Math.sin(t * 6.5 + e.x) * 4.5;
      ctx.translate(0, hover);
      ctx.scale(e.facing, 1);
      const spr = this.sprites.get("drone");
      if (spr) {
        ctx.drawImage(spr, -34, -24, 68, 48);
      }
      const eyeCol = stunned ? "#57C7FF" : e.state === "combat" ? "#FF3B2F" : "#FF9500";
      const eg = ctx.createRadialGradient(16, 0, 1, 16, 0, 16);
      eg.addColorStop(0, eyeCol);
      eg.addColorStop(1, "rgba(255, 149, 0, 0)");
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.arc(16, 0, 16, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === "interceptor") {
      const hover = Math.sin(t * 5.5 + e.x) * 5;
      ctx.translate(0, hover);
      const spr = this.sprites.get("interceptor");
      if (spr) {
        ctx.drawImage(spr, -34, -20, 68, 40);
      }
    } else if (e.kind === "camera" || e.kind === "turret") {
      ctx.fillStyle = "#1B2736";
      ctx.strokeStyle = "#04060A";
      ctx.lineWidth = 3;
      ctx.fillRect(-15, -11, 30, 22);
      ctx.strokeRect(-15, -11, 30, 22);
      ctx.rotate(e.aimAngle);
      ctx.fillStyle = "#DCE7F0";
      ctx.fillRect(-2, -6, 22, 12);
      ctx.strokeRect(-2, -6, 22, 12);
      ctx.fillStyle = stunned ? "#57C7FF" : "#FF3B2F";
      ctx.fillRect(15, -3.5, 6, 7);
    } else if (e.kind === "heavy") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
      ctx.beginPath();
      ctx.ellipse(0, e.h * 0.5, 28, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.scale(e.facing, 1);
      const bob = Math.abs(e.vx) > 5 ? Math.abs(Math.sin(t * 5.5)) * -3 : 0;
      const spr = this.sprites.get("heavy");
      if (spr) {
        ctx.drawImage(spr, -40, -40 + bob, 80, 76);
      }

      if (e.shielded && !stunned) {
        const sg = ctx.createLinearGradient(20, -30, 32, 26);
        sg.addColorStop(0, "rgba(120, 224, 255, 0.62)");
        sg.addColorStop(1, "rgba(77, 168, 218, 0.2)");
        ctx.fillStyle = sg;
        ctx.strokeStyle = "#7CE0FF";
        ctx.lineWidth = 2.6;
        ctx.fillRect(22, -28, 9, 56);
        ctx.strokeRect(22, -28, 9, 56);
      }
    }

    ctx.filter = "none";
    ctx.restore();

    if (stunned) {
      ctx.strokeStyle = "#7CE0FF";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y + 8);
      ctx.lineTo(e.x + e.w * 0.4, e.y - 6 + Math.sin(t * 32) * 6);
      ctx.lineTo(e.x + e.w * 0.7, e.y + 12);
      ctx.lineTo(e.x + e.w, e.y + 4);
      ctx.stroke();
    }

    if (e.state === "combat") {
      this.drawAlertEmblem(ctx, cx, e.y - 24, "!", "#FF3B2F");
    } else if (e.awareness > 18 || e.state === "investigate") {
      this.drawAlertEmblem(ctx, cx, e.y - 24, "?", "#FF9500");
    }

    if (e.hp < e.maxHp) {
      ctx.fillStyle = "#05070B";
      ctx.fillRect(e.x, e.y - 11, e.w, 4.5);
      ctx.fillStyle = "#FF3B2F";
      ctx.fillRect(e.x + 1, e.y - 10, (e.w - 2) * Math.max(0, e.hp / e.maxHp), 2.5);
    }
  }

  private drawAlertEmblem(ctx: CanvasRenderingContext2D, x: number, y: number, sym: string, color: string): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#05070B";
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(15, 0);
    ctx.lineTo(0, 16);
    ctx.lineTo(-15, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = "900 17px sans-serif";
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

    if (p.invulnTimer > 0 && Math.floor(t * 20) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    } else if (p.camoTimer > 0) {
      ctx.globalAlpha = 0.24 + Math.sin(t * 20) * 0.08;
    }

    if (p.inBox) {
      const bob = Math.abs(p.vx) > 10 ? Math.sin(t * 16) * 2.5 : 0;
      ctx.translate(0, bob);
      const boxSpr = this.sprites.get("mli_box");
      if (boxSpr) {
        ctx.drawImage(boxSpr, -26, -50, 52, 52);
      }
      if (Math.abs(p.vx) > 8) {
        ctx.fillStyle = "#06080D";
        ctx.fillRect(-10, -34, 20, 5.5);
        ctx.fillStyle = "#FF3B2F";
        ctx.fillRect(p.facing > 0 ? 1 : -7, -32.5, 6, 2.8);
      }
      ctx.restore();
      return;
    }

    const bodyH = p.crouching ? 40 : 62;
    const moving = p.onGround && Math.abs(p.vx) > 14;
    const breath = moving ? 0 : Math.sin(t * 3.2) * 1.1;

    if (p.onGround) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
      ctx.beginPath();
      ctx.ellipse(0, 1, 20, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    ctx.scale(p.facing, 1);
    const poseKey = p.crouching
      ? "mercer_crouch"
      : !p.onGround && eva
      ? "mercer_eva"
      : moving
      ? Math.floor(p.animTime * 9.5) % 2 === 0
        ? "mercer_run_a"
        : "mercer_run_b"
      : "mercer_stand";
    const spr = this.sprites.get(poseKey);
    if (spr) {
      const runBob = moving ? Math.abs(Math.sin(p.animTime * 9.5)) * -3 : breath;
      const size = p.crouching ? 62 : 66;
      ctx.drawImage(spr, -size * 0.5, -size + 4 + runBob, size, size);
    }
    ctx.restore();

    // Articulated Aimed Weapon + Laser Sight aligned to Mercer's shoulder!
    const shoulderY = (p.crouching ? -24 : -35) + breath;
    ctx.save();
    ctx.translate(0, shoulderY);
    ctx.rotate(p.aimAngle);

    ctx.strokeStyle =
      p.weaponId === "silenced_rail" ? "rgba(87, 199, 255, 0.3)" : "rgba(255, 59, 47, 0.36)";
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(20, 0);
    ctx.lineTo(155, 0);
    ctx.stroke();

    // Armored forearm & detailed Shinkawa weapon silhouette
    ctx.fillStyle = "#E4EEF6";
    ctx.strokeStyle = "#04060A";
    ctx.lineWidth = 2;
    ctx.fillRect(0, -3.2, 11, 6.4);
    ctx.strokeRect(0, -3.2, 11, 6.4);

    ctx.fillStyle = "#0A0F16";
    ctx.strokeStyle = "#E8F2FA";
    ctx.lineWidth = 1.3;
    if (p.weaponId === "silenced_rail") {
      ctx.fillRect(8, -3.2, 24, 5.2);
      ctx.strokeRect(8, -3.2, 24, 5.2);
      ctx.fillStyle = "#57C7FF";
      ctx.fillRect(16, -1.2, 6, 1.5);
    } else if (p.weaponId === "piercing_rail") {
      ctx.fillRect(5, -4.6, 35, 8.2);
      ctx.strokeRect(5, -4.6, 35, 8.2);
      ctx.fillStyle = "#FF3B2F";
      ctx.fillRect(15, -1.6, 22, 2.5);
    } else if (p.weaponId === "micro_missiles") {
      ctx.fillRect(5, -5.8, 27, 10.5);
      ctx.strokeRect(5, -5.8, 27, 10.5);
      ctx.fillStyle = "#FF9500";
      ctx.fillRect(25, -4.2, 4.5, 3);
      ctx.fillRect(25, 1.2, 4.5, 3);
    } else {
      ctx.fillRect(6, -4.2, 28, 7.6);
      ctx.strokeRect(6, -4.2, 28, 7.6);
      ctx.fillStyle = p.weaponId === "pulse_carbine" ? "#57C7FF" : "#FF9500";
      ctx.fillRect(14, -1.6, 12, 2.2);
    }
    ctx.restore();

    if (eva && !p.onGround) {
      ctx.fillStyle = "rgba(8, 13, 20, 0.82)";
      ctx.fillRect(-16, -bodyH - 12, 32, 4.5);
      ctx.fillStyle = "#57C7FF";
      ctx.fillRect(-15, -bodyH - 11, 30 * p.evaFuel, 2.5);
    }

    if (p.cqcAnim > 0) {
      const k = p.cqcAnim / 0.22;
      ctx.strokeStyle = "#FF3B2F";
      ctx.lineWidth = 10 * k;
      ctx.beginPath();
      ctx.arc(p.facing * 14, -28, 42, p.facing > 0 ? -1.15 : Math.PI - 0.95, p.facing > 0 ? 0.95 : Math.PI + 1.15);
      ctx.stroke();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3.8 * k;
      ctx.beginPath();
      ctx.arc(p.facing * 14, -28, 40, p.facing > 0 ? -1.1 : Math.PI - 0.9, p.facing > 0 ? 0.9 : Math.PI + 1.1);
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
      ctx.globalAlpha = 0.48;
    }

    // Twin Mach Shock-Diamond Plasma Plumes (off during Cold Drift!)
    if (!p.coldDrift) {
      const flameLen = 40 + Math.sin(t * 42) * 11;
      for (const py of [-7, 7]) {
        const g = ctx.createLinearGradient(-32, py, -32 - flameLen, py);
        g.addColorStop(0, "#FFFFFF");
        g.addColorStop(0.35, "#7CE0FF");
        g.addColorStop(0.75, "rgba(77, 168, 218, 0.45)");
        g.addColorStop(1, "rgba(77, 168, 218, 0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-30, py - 5);
        ctx.lineTo(-32 - flameLen, py);
        ctx.lineTo(-30, py + 5);
        ctx.closePath();
        ctx.fill();
      }
    }

    const spr = this.sprites.get("starship");
    if (spr) {
      if (p.coldDrift) ctx.filter = "hue-rotate(155deg) brightness(0.9)";
      ctx.drawImage(spr, -46, -24, 92, 48);
      ctx.filter = "none";
    }

    if (p.coldDrift) {
      ctx.strokeStyle = "#7CE0FF";
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(2, 0, 50, 28, 0, 0, Math.PI * 2);
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
      ctx.fillStyle = "rgba(0, 0, 0, 0.68)";
      ctx.beginPath();
      ctx.ellipse(0, 68, 76, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      const ventOpen = b.vulnerableTimer > 0 || b.stunTimer > 0;
      if (ventOpen) {
        const vg = ctx.createRadialGradient(0, 4, 8, 0, 4, 72);
        vg.addColorStop(0, "rgba(255, 165, 30, 0.6)");
        vg.addColorStop(1, "rgba(255, 149, 0, 0)");
        ctx.fillStyle = vg;
        ctx.beginPath();
        ctx.arc(0, 4, 72, 0, Math.PI * 2);
        ctx.fill();
      }

      if (flash) ctx.filter = "brightness(2.5)";
      const spr = this.sprites.get(ventOpen ? "boss_iron_gantry_vent" : "boss_iron_gantry");
      if (spr) {
        const shakeX = b.attackTelegraph > 0 ? Math.sin(t * 50) * 3 : 0;
        ctx.drawImage(spr, -88 + shakeX, -78, 164, 152);
      }
      ctx.filter = "none";

      if (ventOpen) {
        ctx.fillStyle = "#FFF7DF";
        ctx.font = "900 10.5px monospace";
        ctx.textAlign = "center";
        ctx.fillText("COOLANT VENT OPEN // 2X CRIT!", 0, -82);
      }
      ctx.restore();
    } else if (b.id === "valkyrie_09") {
      ctx.save();
      ctx.translate(cx, cy);
      const pl = ctx.createLinearGradient(44, 0, 108, 0);
      pl.addColorStop(0, "#FF9500");
      pl.addColorStop(1, "rgba(255, 59, 47, 0)");
      ctx.fillStyle = pl;
      ctx.fillRect(46, -18, 56, 9);
      ctx.fillRect(46, 9, 56, 9);

      if (flash) ctx.filter = "brightness(2.5)";
      const spr = this.sprites.get("boss_valkyrie");
      if (spr) {
        ctx.drawImage(spr, -72, -48, 144, 96);
      }
      ctx.filter = "none";

      if (b.stunTimer <= 0) {
        ctx.strokeStyle = "rgba(124, 224, 255, 0.35)";
        ctx.lineWidth = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 72, b.shieldAngle - 0.92, b.shieldAngle + 0.92);
        ctx.stroke();
        ctx.strokeStyle = "#7CE0FF";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, 72, b.shieldAngle - 0.92, b.shieldAngle + 0.92);
        ctx.stroke();
      }
      ctx.restore();
    } else if (b.id === "mirror") {
      for (const r of b.relays) {
        if (!r.active) continue;
        const ry = r.y + Math.sin(t * 5 + r.x) * 6;
        ctx.strokeStyle = "rgba(255, 149, 0, 0.28)";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(r.x, ry);
        ctx.lineTo(cx, cy);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.save();
        ctx.translate(r.x, ry);
        const pg = ctx.createRadialGradient(0, 0, 3, 0, 0, 30);
        pg.addColorStop(0, "rgba(255, 149, 0, 0.5)");
        pg.addColorStop(1, "rgba(255, 149, 0, 0)");
        ctx.fillStyle = pg;
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#162433";
        ctx.strokeStyle = "#FF9500";
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.lineTo(17, 0);
        ctx.lineTo(0, 20);
        ctx.lineTo(-17, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#FFF0D0";
        ctx.font = "900 9px monospace";
        ctx.textAlign = "center";
        ctx.fillText("PRISM", 0, -26);
        ctx.restore();
      }

      for (const c of b.clones) {
        if (c.hp <= 0) continue;
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.globalAlpha = 0.55 + Math.sin(t * 14) * 0.16;
        this.drawMirrorChassis(ctx, false, t, true);
        ctx.restore();
      }

      ctx.save();
      ctx.translate(cx, cy);
      this.drawMirrorChassis(ctx, flash, t, false);
      ctx.restore();
    } else if (b.id === "lark_prime") {
      ctx.save();
      ctx.translate(cx, cy);

      if (b.sweepingBeamActive) {
        ctx.save();
        ctx.rotate(b.sweepingBeamAngle);
        ctx.strokeStyle = "rgba(255, 59, 47, 0.34)";
        ctx.lineWidth = 28;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(740, 0);
        ctx.stroke();
        ctx.strokeStyle = "#FF3B2F";
        ctx.lineWidth = 11;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(740, 0);
        ctx.stroke();
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(740, 0);
        ctx.stroke();
        ctx.restore();
      }

      const aura = ctx.createRadialGradient(0, 0, 20, 0, 0, 140);
      aura.addColorStop(0, b.phase === 3 ? "rgba(87, 199, 255, 0.45)" : "rgba(255, 59, 47, 0.38)");
      aura.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, 140, 0, Math.PI * 2);
      ctx.fill();

      // Triple counter-rotating gyroscopic containment rings
      ctx.save();
      ctx.rotate(t * (1.2 + b.phase * 0.45));
      ctx.strokeStyle = b.phase === 3 ? "#57C7FF" : "#FF3B2F";
      ctx.lineWidth = 4.5;
      ctx.strokeRect(-66, -66, 132, 132);
      ctx.restore();

      ctx.save();
      ctx.rotate(-t * 0.95);
      ctx.strokeStyle = "#E8F2FA";
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, 82, 0, Math.PI * 1.55);
      ctx.stroke();
      ctx.restore();

      if (flash) ctx.filter = "brightness(2.5)";
      const spr = this.sprites.get("boss_lark");
      if (spr) {
        ctx.save();
        ctx.rotate(t * 0.35);
        ctx.drawImage(spr, -72, -72, 144, 144);
        ctx.restore();
      }
      ctx.filter = "none";
      ctx.restore();
    }
  }

  private drawMirrorChassis(ctx: CanvasRenderingContext2D, flash: boolean, t: number, isClone: boolean): void {
    for (let i = 0; i < 4; i++) {
      const a = t * 1.8 + (i * Math.PI) / 2;
      ctx.fillStyle = i % 2 === 0 ? "#0A0F17" : "#DCE7F0";
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 54, Math.sin(a) * 54, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (flash) ctx.filter = "brightness(2.5)";
    else if (isClone) ctx.filter = "hue-rotate(165deg) brightness(0.9)";
    const spr = this.sprites.get("boss_mirror");
    if (spr) {
      ctx.drawImage(spr, -48, -48, 96, 96);
    }
    ctx.filter = "none";

    ctx.strokeStyle = isClone ? "rgba(87, 199, 255, 0.55)" : "rgba(255, 59, 47, 0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 52 + Math.sin(t * 7) * 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawProjectiles(ctx: CanvasRenderingContext2D, projectiles: Projectile[]): void {
    for (const p of projectiles) {
      if (p.trail.length > 1) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.piercing ? 5 : 2.6;
        ctx.globalAlpha = 0.72;
        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (let i = 1; i < p.trail.length; i++) {
          ctx.lineTo(p.trail[i].x, p.trail[i].y);
        }
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Glowing outer bloom on shots
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

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
        ctx.lineWidth = 5.5 * (1 - progress);
        ctx.beginPath();
        ctx.arc(0, 0, p.size * progress, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === "slash") {
        ctx.strokeStyle = "#FF3B2F";
        ctx.lineWidth = 10 * p.alpha;
        ctx.beginPath();
        ctx.moveTo(-p.size * 0.55, -14);
        ctx.quadraticCurveTo(0, 0, p.size * 0.55, 16);
        ctx.stroke();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4 * p.alpha;
        ctx.beginPath();
        ctx.moveTo(-p.size * 0.5, -12);
        ctx.quadraticCurveTo(0, 0, p.size * 0.5, 14);
        ctx.stroke();
      } else if (p.kind === "streak") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 1.9, p.size * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "ink") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === "casing") {
        ctx.fillStyle = p.color;
        ctx.fillRect(-3.5, -1.6, 7, 3.2);
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
      ctx.font = `900 ${Math.round(13.5 * c.scale)}px monospace`;
      ctx.textAlign = "center";
      ctx.fillStyle = "#04060A";
      ctx.fillText(c.text, c.x + 1.8, c.y + 1.8);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    }
  }

  private drawInteractPrompt(ctx: CanvasRenderingContext2D, x: number, y: number, label: string): void {
    ctx.save();
    ctx.font = "900 11px monospace";
    const w = ctx.measureText(label).width + 20;
    ctx.fillStyle = "rgba(7, 10, 16, 0.9)";
    ctx.strokeStyle = "#57C7FF";
    ctx.lineWidth = 1.8;
    ctx.fillRect(x - w * 0.5, y - 14, w, 21);
    ctx.strokeRect(x - w * 0.5, y - 14, w, 21);
    ctx.fillStyle = "#F2F7FB";
    ctx.textAlign = "center";
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  private drawForegroundAtmosphere(ctx: CanvasRenderingContext2D, snap: RenderSnapshot): void {
    const t = snap.time;
    if (snap.mission.id === 1) {
      // Storm rain streaks
      ctx.strokeStyle = "rgba(200, 228, 248, 0.26)";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      for (const r of this.rainDrops) {
        const rx = (((r.x - t * r.spd * 0.35) % VIEW_W) + VIEW_W) % VIEW_W;
        const ry = (r.y + t * r.spd) % VIEW_H;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 6, ry + r.len);
      }
      ctx.stroke();
    } else if (snap.mission.id === 3) {
      // Floating zero-G ice/ink orbital motes
      for (const m of this.motes) {
        const mx = (((m.x - t * m.spd) % VIEW_W) + VIEW_W) % VIEW_W;
        const my = m.y + Math.sin(t * 1.4 + m.phase) * 14;
        ctx.fillStyle = "rgba(210, 238, 255, 0.34)";
        ctx.beginPath();
        ctx.arc(mx, my, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (snap.mission.id === 4) {
      // Drifting liquid-nitrogen floor mist
      const mg = ctx.createLinearGradient(0, VIEW_H - 95, 0, VIEW_H);
      mg.addColorStop(0, "rgba(87, 199, 255, 0)");
      mg.addColorStop(1, "rgba(87, 199, 255, 0.14)");
      ctx.fillStyle = mg;
      ctx.fillRect(0, VIEW_H - 95, VIEW_W, 95);
    }
  }

  private drawReflexOverlay(ctx: CanvasRenderingContext2D, timer: number): void {
    const g = ctx.createRadialGradient(VIEW_W * 0.5, VIEW_H * 0.5, 130, VIEW_W * 0.5, VIEW_H * 0.5, VIEW_W * 0.62);
    g.addColorStop(0, "rgba(255, 59, 47, 0)");
    g.addColorStop(1, "rgba(255, 42, 32, 0.44)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.fillStyle = "#06080D";
    ctx.fillRect(VIEW_W * 0.5 - 92, 62, 184, 16);
    ctx.fillStyle = "#FF3B2F";
    ctx.fillRect(VIEW_W * 0.5 - 90, 64, 180 * Math.min(1, timer / 1.25), 12);
    ctx.fillStyle = "#F2F6FA";
    ctx.font = "900 10px monospace";
    ctx.textAlign = "center";
    ctx.fillText("REFLEX WINDOW // SILENCE SPOTTER", VIEW_W * 0.5, 57);
  }

  private drawMirrorGlitch(ctx: CanvasRenderingContext2D, t: number, glitchTimer: number): void {
    ctx.save();
    ctx.globalAlpha = Math.min(0.68, glitchTimer * 0.42);
    for (let i = 0; i < 9; i++) {
      const y = (t * 440 + i * 67) % VIEW_H;
      ctx.fillStyle = i % 2 === 0 ? "rgba(255, 59, 47, 0.28)" : "rgba(87, 199, 255, 0.24)";
      ctx.fillRect(0, y, VIEW_W, 4 + (i % 3) * 4);
    }
    if (Math.sin(t * 16) > -0.2) {
      ctx.fillStyle = "rgba(6, 9, 14, 0.8)";
      ctx.fillRect(VIEW_W * 0.5 - 170, 92, 340, 32);
      ctx.strokeStyle = "#FF3B2F";
      ctx.lineWidth = 2;
      ctx.strokeRect(VIEW_W * 0.5 - 170, 92, 340, 32);
      ctx.fillStyle = "#FF3B2F";
      ctx.font = "900 13px monospace";
      ctx.textAlign = "center";
      ctx.fillText("SIGNAL SPOOFED // SHOOT OPTICAL PRISMS", VIEW_W * 0.5, 112);
    }
    ctx.restore();
  }

  private drawInkVignette(ctx: CanvasRenderingContext2D, alertState: AlertState): void {
    const g = ctx.createRadialGradient(VIEW_W * 0.5, VIEW_H * 0.5, VIEW_W * 0.36, VIEW_W * 0.5, VIEW_H * 0.5, VIEW_W * 0.66);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, alertState === "ALERT" ? "rgba(70, 8, 8, 0.44)" : "rgba(3, 5, 9, 0.48)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  private drawZoneBanner(ctx: CanvasRenderingContext2D, text: string, alpha: number): void {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(6, 9, 14, 0.86)";
    ctx.fillRect(0, 102, VIEW_W, 38);
    ctx.fillStyle = "#FF3B2F";
    ctx.fillRect(0, 102, VIEW_W, 2);
    ctx.fillRect(0, 138, VIEW_W, 2);
    ctx.fillStyle = "#F2F7FB";
    ctx.font = "900 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText(text, VIEW_W * 0.5, 126);
    ctx.restore();
  }

  private drawBossSplash(
    ctx: CanvasRenderingContext2D,
    splash: { timer: number; name: string; subtitle: string; quote: string },
    boss: BossEntity | null
  ): void {
    ctx.save();
    ctx.fillStyle = "rgba(5, 7, 11, 0.86)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Dramatic diagonal crimson sumi-e calligraphy slash
    ctx.fillStyle = "#FF3B2F";
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H * 0.43);
    ctx.lineTo(VIEW_W, VIEW_H * 0.3);
    ctx.lineTo(VIEW_W, VIEW_H * 0.6);
    ctx.lineTo(0, VIEW_H * 0.72);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#070A10";
    ctx.beginPath();
    ctx.moveTo(0, VIEW_H * 0.45);
    ctx.lineTo(VIEW_W, VIEW_H * 0.33);
    ctx.lineTo(VIEW_W, VIEW_H * 0.57);
    ctx.lineTo(0, VIEW_H * 0.68);
    ctx.closePath();
    ctx.fill();

    // Feature bespoke Shinkawa artwork inside ALL 4 boss splashes!
    const portrait =
      boss?.id === "mirror"
        ? this.atlas.getPortrait("mirror")
        : boss?.id === "lark_prime"
        ? this.atlas.getPortrait("lark")
        : boss?.id === "iron_gantry"
        ? this.sprites.get("boss_iron_gantry_vent")
        : boss?.id === "valkyrie_09"
        ? this.sprites.get("boss_valkyrie")
        : null;
    if (portrait) {
      ctx.save();
      ctx.fillStyle = "rgba(8, 12, 18, 0.9)";
      ctx.fillRect(VIEW_W - 246, VIEW_H * 0.5 - 94, 192, 188);
      ctx.globalAlpha = 0.94;
      ctx.drawImage(portrait, VIEW_W - 240, VIEW_H * 0.5 - 88, 180, 176);
      ctx.strokeStyle = "#FF3B2F";
      ctx.lineWidth = 3;
      ctx.strokeRect(VIEW_W - 246, VIEW_H * 0.5 - 94, 192, 188);
      ctx.restore();
    }

    const textCenterX = portrait ? VIEW_W * 0.38 : VIEW_W * 0.5;
    ctx.textAlign = "center";
    ctx.fillStyle = "#FF9500";
    ctx.font = "900 12px monospace";
    ctx.fillText("TACTICAL INTERCEPT // BOSS ENGAGED", textCenterX, VIEW_H * 0.42);

    ctx.fillStyle = "#F2F7FB";
    ctx.font = "900 44px sans-serif";
    ctx.fillText(splash.name, textCenterX, VIEW_H * 0.515);

    ctx.fillStyle = "#A9C4D9";
    ctx.font = "bold 13px monospace";
    ctx.fillText(splash.subtitle, textCenterX, VIEW_H * 0.575);

    ctx.fillStyle = "#E5EDF5";
    ctx.font = "italic 14px serif";
    ctx.fillText(splash.quote, textCenterX, VIEW_H * 0.66);
    ctx.restore();
  }

  /**
   * MGS Soliton-style compact orbital tactical radar strip showing nearby threats,
   * POW beacons, hack terminals, and Mirror's glitch phantom blips.
   */
  private drawTacticalRadar(ctx: CanvasRenderingContext2D, snap: RenderSnapshot): void {
    const rw = 148;
    const rh = 42;
    const rx = VIEW_W - rw - 14;
    const ry = 46;
    const rangeX = 760;

    ctx.save();
    ctx.fillStyle = snap.alertState === "ALERT" ? "rgba(38, 10, 12, 0.78)" : "rgba(7, 13, 22, 0.76)";
    ctx.strokeStyle = snap.alertState === "ALERT" ? "rgba(255, 59, 47, 0.75)" : "rgba(87, 199, 255, 0.45)";
    ctx.lineWidth = 1.4;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeRect(rx, ry, rw, rh);

    // Subtle radar grid & animated scan sweep line
    ctx.strokeStyle = "rgba(87, 199, 255, 0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rx, ry + rh * 0.5);
    ctx.lineTo(rx + rw, ry + rh * 0.5);
    ctx.moveTo(rx + rw * 0.5, ry);
    ctx.lineTo(rx + rw * 0.5, ry + rh);
    ctx.stroke();

    const sweepX = rx + ((snap.time * 95) % rw);
    ctx.strokeStyle = "rgba(87, 199, 255, 0.35)";
    ctx.beginPath();
    ctx.moveTo(sweepX, ry);
    ctx.lineTo(sweepX, ry + rh);
    ctx.stroke();

    const mapX = (wx: number) => rx + rw * 0.5 + ((wx - snap.player.x) / rangeX) * (rw * 0.5);
    const mapY = (wy: number) => ry + 5 + (wy / VIEW_H) * (rh - 10);

    // POW beacons (cyan diamonds)
    for (const pow of snap.pows) {
      if (pow.rescued) continue;
      const bx = mapX(pow.x);
      if (bx < rx + 3 || bx > rx + rw - 3) continue;
      const by = mapY(pow.y);
      ctx.fillStyle = "#57C7FF";
      ctx.fillRect(bx - 2.5, by - 2.5, 5, 5);
    }

    // Hack nodes (amber)
    for (const h of snap.hackNodes) {
      if (h.hacked) continue;
      const bx = mapX(h.x);
      if (bx < rx + 3 || bx > rx + rw - 3) continue;
      ctx.fillStyle = "#FF9500";
      ctx.fillRect(bx - 2, mapY(h.y) - 2, 4, 4);
    }

    // Enemy blips + mini vision wedge
    for (const e of snap.enemies) {
      if (e.state === "dead") continue;
      const bx = mapX(e.x);
      if (bx < rx + 3 || bx > rx + rw - 3) continue;
      const by = mapY(e.y);
      ctx.fillStyle = e.state === "stunned" ? "#4DA8DA" : e.state === "combat" ? "#FF3B2F" : "#FF9500";
      ctx.beginPath();
      ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (e.state !== "stunned") {
        ctx.strokeStyle = "rgba(255, 149, 0, 0.55)";
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(e.aimAngle) * 8, by + Math.sin(e.aimAngle) * 5);
        ctx.stroke();
      }
    }

    // Mirror HUD Spoof: spawn fake glitching phantom radar blips!
    if (snap.hudGlitchTimer > 0) {
      for (let i = 0; i < 6; i++) {
        const gx = rx + 8 + ((Math.sin(snap.time * 17 + i * 3.1) * 0.5 + 0.5) * (rw - 16));
        const gy = ry + 6 + ((Math.cos(snap.time * 13 + i * 2.3) * 0.5 + 0.5) * (rh - 12));
        ctx.fillStyle = "#FF3B2F";
        ctx.fillRect(gx - 2, gy - 2, 4, 4);
      }
    }

    // Player center blip (stark white)
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(rx + rw * 0.5, mapY(snap.player.y + 20), 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(180, 212, 235, 0.72)";
    ctx.font = "bold 7.5px monospace";
    ctx.textAlign = "left";
    ctx.fillText(snap.hudGlitchTimer > 0 ? "SOLITON // JAMMED" : "SOLITON RADAR", rx + 4, ry + 9);
    ctx.restore();
  }
}

