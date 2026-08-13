/**
 * Metal Slug–style 2.5D projection.
 * World: x (along stage), z (depth into screen 0=near … 1=far), hop (jump height).
 * Screen Y comes from the perspective ground plane + hop scaled by depth.
 */
import { C, H, W } from "./palette";

export interface WorldPose {
  x: number;
  z: number;
  hop: number;
}

export interface ScreenPose {
  sx: number;
  sy: number;
  scale: number;
  groundSy: number;
  z: number;
}

export interface Stage25D {
  /** Camera follow X */
  camX: number;
  /** Ground line near camera (screen Y) */
  nearGroundY: number;
  /** Ground line at far depth (screen Y) */
  farGroundY: number;
  /** Sprite scale near camera */
  nearScale: number;
  /** Sprite scale at far depth */
  farScale: number;
  /** Perspective vanishing pull (px) toward horizon center */
  vanishPull: number;
  zMin: number;
  zMax: number;
}

export const STAGE_GROUND: Stage25D = {
  camX: 0,
  nearGroundY: 505,
  farGroundY: 300,
  nearScale: 2.45,
  farScale: 1.05,
  vanishPull: 70,
  zMin: 0,
  zMax: 1,
};

export const STAGE_SKY: Stage25D = {
  camX: 0,
  nearGroundY: 430,
  farGroundY: 150,
  nearScale: 2.2,
  farScale: 1.0,
  vanishPull: 40,
  zMin: 0,
  zMax: 1,
};

export const STAGE_VOID: Stage25D = {
  camX: 0,
  nearGroundY: 470,
  farGroundY: 190,
  nearScale: 2.35,
  farScale: 0.95,
  vanishPull: 90,
  zMin: 0,
  zMax: 1,
};

export function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export function project(pose: WorldPose, stage: Stage25D): ScreenPose {
  const z = clamp01((pose.z - stage.zMin) / (stage.zMax - stage.zMin || 1));
  const scale = stage.nearScale + (stage.farScale - stage.nearScale) * z;
  const groundSy =
    stage.nearGroundY + (stage.farGroundY - stage.nearGroundY) * z;
  const localX = pose.x - stage.camX;
  // Perspective: far objects squeeze toward screen center
  const sx = W * 0.5 + (localX - W * 0.35) * (1 - z * 0.22) - z * stage.vanishPull * 0.15;
  const sy = groundSy - pose.hop * scale;
  return { sx, sy, scale, groundSy, z };
}

export function zOverlap(a: number, b: number, slack = 0.2) {
  return Math.abs(a - b) <= slack;
}

/** Elliptical shadow on the ground plane */
export function drawShadow(
  ctx: CanvasRenderingContext2D,
  sp: ScreenPose,
  radius = 22,
) {
  const rw = radius * sp.scale * 1.1;
  const rh = radius * sp.scale * 0.28;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.beginPath();
  ctx.ellipse(sp.sx, sp.groundSy - 2, rw, rh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(232,93,4,0.12)";
  ctx.beginPath();
  ctx.ellipse(sp.sx, sp.groundSy - 2, rw * 0.7, rh * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Perspective ground deck — opaque slab actors stand in, world-X locked. */
export function drawGroundDeck(
  ctx: CanvasRenderingContext2D,
  stage: Stage25D,
  mode: "pad" | "sky" | "void",
) {
  const nearY = stage.nearGroundY;
  const farY = stage.farGroundY;
  const pad = mode === "pad";
  const camX = stage.camX;

  // Off-pad drop (sides + under the near lip) so plates never read as the floor
  ctx.fillStyle = pad ? "#0c0a08" : mode === "sky" ? "#05070e" : "#040810";
  ctx.fillRect(0, farY, W, H - farY);

  const g = ctx.createLinearGradient(0, farY, 0, H);
  if (mode === "pad") {
    g.addColorStop(0, "rgba(48,38,28,0.96)");
    g.addColorStop(0.45, "rgba(28,22,16,0.98)");
    g.addColorStop(1, "rgba(12,10,8,1)");
  } else if (mode === "sky") {
    g.addColorStop(0, "rgba(24,36,58,0.88)");
    g.addColorStop(1, "rgba(6,8,16,0.96)");
  } else {
    g.addColorStop(0, "rgba(16,32,58,0.86)");
    g.addColorStop(1, "rgba(5,8,16,0.95)");
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, nearY);
  ctx.lineTo(W, nearY);
  ctx.lineTo(W * 0.72, farY);
  ctx.lineTo(W * 0.28, farY);
  ctx.closePath();
  ctx.fill();

  // Horizon seam
  ctx.strokeStyle = pad ? C.pad : C.cyan;
  ctx.globalAlpha = pad ? 0.7 : 0.4;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W * 0.28, farY);
  ctx.lineTo(W * 0.72, farY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Depth lane lines (fixed Z — world-parallel, do not scroll with X)
  ctx.strokeStyle = pad ? "rgba(244,211,94,0.28)" : "rgba(46,196,182,0.22)";
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const z = i / 4;
    const y = nearY + (farY - nearY) * z;
    const inset = 0.02 + z * 0.2;
    ctx.beginPath();
    ctx.moveTo(W * inset, y);
    ctx.lineTo(W * (1 - inset), y);
    ctx.stroke();
  }

  // World-space perspective spokes + road dashes — scroll under the camera
  const spacing = 96;
  const startWx = Math.floor((camX - 160) / spacing) * spacing;
  const endWx = camX + W + 280;

  ctx.strokeStyle = pad ? "rgba(160,110,55,0.55)" : "rgba(46,196,182,0.22)";
  ctx.lineWidth = 1.5;
  for (let wx = startWx; wx <= endWx; wx += spacing) {
    const near = project({ x: wx, z: 0.02, hop: 0 }, stage);
    const far = project({ x: wx, z: 0.98, hop: 0 }, stage);
    if (near.sx < -40 && far.sx < -40) continue;
    if (near.sx > W + 40 && far.sx > W + 40) continue;
    ctx.beginPath();
    ctx.moveTo(near.sx, near.sy);
    ctx.lineTo(far.sx, far.sy);
    ctx.stroke();
  }

  const dashLen = spacing * 0.42;
  ctx.strokeStyle = pad ? "rgba(244,211,94,0.7)" : "rgba(46,196,182,0.4)";
  ctx.lineWidth = pad ? 3 : 2;
  ctx.lineCap = "butt";
  for (let wx = startWx; wx <= endWx; wx += spacing) {
    const a = project({ x: wx, z: 0.5, hop: 0 }, stage);
    const b = project({ x: wx + dashLen, z: 0.5, hop: 0 }, stage);
    if (Math.max(a.sx, b.sx) < -20 || Math.min(a.sx, b.sx) > W + 20) continue;
    ctx.beginPath();
    ctx.moveTo(a.sx, a.sy);
    ctx.lineTo(b.sx, b.sy);
    ctx.stroke();
  }

  if (pad) {
    ctx.fillStyle = "rgba(244,211,94,0.45)";
    for (let wx = startWx; wx <= endWx; wx += spacing / 2) {
      const p = project({ x: wx, z: 0.08, hop: 0 }, stage);
      if (p.sx < -10 || p.sx > W + 10) continue;
      ctx.fillRect(p.sx - 2, p.sy - 3, 4, 6);
    }
  }

  // Near lip — platform thickness so the pad has a front face
  const lipH = Math.max(18, H - nearY);
  ctx.fillStyle = pad ? "#16120e" : "#070a12";
  ctx.fillRect(0, nearY, W, lipH);
  if (pad) {
    for (let x = 0; x < W; x += 16) {
      ctx.fillStyle = Math.floor(x / 16) % 2 === 0 ? C.warn : C.soot;
      ctx.fillRect(x, nearY + 5, 16, 8);
    }
  }
  ctx.fillStyle = pad ? C.pad : C.cyan;
  ctx.fillRect(0, nearY, W, 3);
  ctx.fillStyle = pad ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.35)";
  ctx.fillRect(0, nearY + lipH - 6, W, 6);
}

/** Soft fog strip between mid and far for depth cue */
export function drawDepthFog(ctx: CanvasRenderingContext2D, stage: Stage25D) {
  const g = ctx.createLinearGradient(0, stage.farGroundY - 80, 0, stage.nearGroundY);
  g.addColorStop(0, "rgba(11,18,32,0.18)");
  g.addColorStop(0.55, "transparent");
  g.addColorStop(1, "rgba(0,0,0,0.08)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Foreground silhouette props (nearest Z) for cabinet depth */
export function drawForegroundProps(
  ctx: CanvasRenderingContext2D,
  camX: number,
  frame: number,
  kind: "pad" | "sky" | "void",
) {
  ctx.save();
  ctx.globalAlpha = 0.55;
  if (kind === "pad") {
    for (let i = 0; i < 3; i++) {
      const x = ((i * 420 - camX * 1.35) % (W + 200)) - 80;
      ctx.fillStyle = "#05070c";
      ctx.fillRect(x, H - 140, 36, 140);
      ctx.fillRect(x - 20, H - 90, 80, 12);
    }
  } else if (kind === "sky") {
    ctx.strokeStyle = "rgba(232,93,4,0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, H - 40 + Math.sin(frame * 0.1) * 4);
    ctx.lineTo(W, H - 55);
    ctx.stroke();
  } else {
    ctx.fillStyle = "rgba(46,196,182,0.08)";
    ctx.beginPath();
    ctx.arc(80, H - 60, 50, 0, Math.PI * 2);
    ctx.arc(W - 60, 80, 40, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function sortByDepth<T extends { z: number; hop?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    // Painter: far (high z) first so near sprites occlude
    if (a.z !== b.z) return b.z - a.z;
    return (a.hop ?? 0) - (b.hop ?? 0);
  });
}
