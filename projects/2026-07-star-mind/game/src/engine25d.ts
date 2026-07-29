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
  nearGroundY: 500,
  farGroundY: 310,
  nearScale: 1.2,
  farScale: 0.52,
  vanishPull: 70,
  zMin: 0,
  zMax: 1,
};

export const STAGE_SKY: Stage25D = {
  camX: 0,
  nearGroundY: 420,
  farGroundY: 160,
  nearScale: 1.15,
  farScale: 0.55,
  vanishPull: 40,
  zMin: 0,
  zMax: 1,
};

export const STAGE_VOID: Stage25D = {
  camX: 0,
  nearGroundY: 460,
  farGroundY: 200,
  nearScale: 1.25,
  farScale: 0.48,
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
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(sp.sx, sp.groundSy - 2, rw, rh, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Perspective ground deck with lane guides — the 2.5D stage floor */
export function drawGroundDeck(
  ctx: CanvasRenderingContext2D,
  stage: Stage25D,
  mode: "pad" | "sky" | "void",
) {
  const nearY = stage.nearGroundY;
  const farY = stage.farGroundY;
  const pad = mode === "pad";

  // Deck fill (trapezoid)
  const g = ctx.createLinearGradient(0, farY, 0, H);
  if (mode === "pad") {
    g.addColorStop(0, "#2a2218");
    g.addColorStop(0.5, "#1a1510");
    g.addColorStop(1, "#0c0a08");
  } else if (mode === "sky") {
    g.addColorStop(0, "rgba(30,45,70,0.15)");
    g.addColorStop(1, "rgba(5,8,16,0.55)");
  } else {
    g.addColorStop(0, "rgba(20,40,70,0.2)");
    g.addColorStop(1, "rgba(5,8,16,0.7)");
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
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W * 0.28, farY);
  ctx.lineTo(W * 0.72, farY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Depth lane lines (3 lanes)
  ctx.strokeStyle = pad ? "rgba(244,211,94,0.18)" : "rgba(46,196,182,0.2)";
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

  // Perspective spokes
  ctx.strokeStyle = pad ? "rgba(139,69,19,0.25)" : "rgba(46,196,182,0.12)";
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const xNear = t * W;
    const xFar = W * 0.28 + t * W * 0.44;
    ctx.beginPath();
    ctx.moveTo(xNear, nearY);
    ctx.lineTo(xFar, farY);
    ctx.stroke();
  }

  // Near lip
  ctx.fillStyle = pad ? C.pad : C.cyan;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(0, nearY, W, 3);
  ctx.globalAlpha = 1;
}

/** Soft fog strip between mid and far for depth cue */
export function drawDepthFog(ctx: CanvasRenderingContext2D, stage: Stage25D) {
  const g = ctx.createLinearGradient(0, stage.farGroundY - 80, 0, stage.nearGroundY);
  g.addColorStop(0, "rgba(11,18,32,0.35)");
  g.addColorStop(0.55, "transparent");
  g.addColorStop(1, "rgba(0,0,0,0.15)");
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
    if (a.z !== b.z) return a.z - b.z; // far (high z) first
    return (a.hop ?? 0) - (b.hop ?? 0);
  });
}
