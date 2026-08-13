/**
 * Runtime picture — Metal Slug cabinet energy on top of the painted plates.
 * Silhouette, sodium/cyan light, readable explosions. No glassmorphism, no purple.
 */
import { C, H, W } from "./palette";
import { glow } from "./draw";

export type ParticleKind = "spark" | "smoke" | "ember" | "debris" | "shell";

export interface Boom {
  x: number;
  z: number;
  hop: number;
  life: number;
  max: number;
  scale: number;
  kind: "fire" | "ion" | "emp";
}

export function drawRain(
  ctx: CanvasRenderingContext2D,
  frame: number,
  threat: number,
  camX: number,
) {
  const far = 22 + Math.floor(threat * 18);
  ctx.save();
  ctx.strokeStyle = `rgba(174,198,220,${0.1 + threat * 0.1})`;
  ctx.lineWidth = 1;
  for (let i = 0; i < far; i++) {
    const x = ((i * 131 + frame * 5 + camX * 0.08) % (W + 60)) - 30;
    const y = ((i * 79 + frame * 9) % (H + 50)) - 25;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 5, y + 16);
    ctx.stroke();
  }
  const near = 36 + Math.floor(threat * 50);
  ctx.strokeStyle = `rgba(210,224,236,${0.22 + threat * 0.22})`;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < near; i++) {
    const x = ((i * 97 + frame * (11 + threat * 10) + camX * 0.2) % (W + 50)) - 25;
    const y = ((i * 53 + frame * (18 + threat * 14)) % (H + 60)) - 30;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 8 - threat * 4, y + 22 + threat * 8);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawLightning(ctx: CanvasRenderingContext2D, flash: number) {
  if (flash <= 0) return;
  ctx.save();
  ctx.fillStyle = `rgba(200, 230, 255, ${flash * 0.28})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = flash;
  ctx.strokeStyle = C.white;
  ctx.lineWidth = 2;
  const x0 = 80 + (Math.floor(flash * 17) % 7) * 110;
  ctx.beginPath();
  ctx.moveTo(x0, 0);
  ctx.lineTo(x0 - 18, 70);
  ctx.lineTo(x0 + 22, 120);
  ctx.lineTo(x0 - 8, 210);
  ctx.lineTo(x0 + 14, 280);
  ctx.stroke();
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

export function drawSodiumPools(ctx: CanvasRenderingContext2D, camX: number, threat: number) {
  ctx.save();
  const spacing = 280;
  const start = Math.floor((camX - 80) / spacing) * spacing;
  for (let wx = start; wx < camX + W + 80; wx += spacing) {
    const sx = ((wx - camX) * 0.78 + W * 0.12) % (W + 120);
    glow(ctx, sx, 430, 70, C.pad, 0.08 + threat * 0.1);
    glow(ctx, sx + 40, 390, 36, C.warn, 0.05 + threat * 0.06);
  }
  ctx.restore();
}

export function drawExplosion(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  t: number,
  scale: number,
  kind: Boom["kind"],
) {
  const u = 1 - t;
  const s = scale * (0.55 + u * 1.15);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.globalCompositeOperation = "lighter";
  if (kind === "emp") {
    ctx.strokeStyle = C.cyan;
    ctx.globalAlpha = t * 0.9;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 12 + u * 70 * scale, 0, Math.PI * 2);
    ctx.stroke();
    glow(ctx, 0, 0, 40 * s, C.cyan, t * 0.5);
  } else if (kind === "ion") {
    glow(ctx, 0, 0, 38 * s, C.cyan, t * 0.55);
    glow(ctx, 0, 0, 18 * s, C.white, t * 0.4);
    ctx.strokeStyle = C.cyan;
    ctx.globalAlpha = t;
    ctx.lineWidth = 2;
    ctx.strokeRect(-16 * s, -16 * s, 32 * s, 32 * s);
  } else {
    glow(ctx, 0, 0, 46 * s, C.pad, t * 0.55);
    glow(ctx, 0, 0, 22 * s, C.warn, t * 0.7);
    ctx.fillStyle = C.warn;
    ctx.globalAlpha = t;
    ctx.beginPath();
    ctx.arc(0, 0, 10 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.white;
    ctx.globalAlpha = t * 0.8;
    ctx.beginPath();
    ctx.arc(0, 0, 5 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(20,12,8,0.45)";
    ctx.globalAlpha = t * 0.7;
    ctx.beginPath();
    ctx.ellipse(-6 * s, -18 * s, 14 * s, 10 * s, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawMuzzle(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  facing: number,
  t: number,
  scale: number,
) {
  if (t <= 0) return;
  ctx.save();
  ctx.translate(sx + facing * 18 * scale, sy - 6 * scale);
  ctx.globalCompositeOperation = "lighter";
  glow(ctx, 0, 0, 22 * scale, C.warn, t * 0.8);
  ctx.fillStyle = C.white;
  ctx.globalAlpha = t;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(facing * 16 * scale, -5 * scale);
  ctx.lineTo(facing * 22 * scale, 0);
  ctx.lineTo(facing * 16 * scale, 5 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawParticle(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  size: number,
  color: string,
  life: number,
  kind: ParticleKind,
) {
  const a = Math.max(0, Math.min(1, life * 2));
  ctx.save();
  ctx.globalAlpha = a;
  if (kind === "smoke") {
    ctx.fillStyle = "rgba(28,24,20,0.7)";
    ctx.beginPath();
    ctx.ellipse(sx, sy, size * 1.8, size * 1.2, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === "ember") {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = color;
    ctx.fillRect(sx, sy, size, size * 1.6);
  } else if (kind === "debris") {
    ctx.fillStyle = C.metal;
    ctx.fillRect(sx, sy, size + 1, size);
  } else if (kind === "shell") {
    ctx.fillStyle = C.warn;
    ctx.fillRect(sx, sy, 3, 2);
  } else {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = color;
    ctx.fillRect(sx, sy, size, size);
  }
  ctx.restore();
}

export function drawColorGrade(
  ctx: CanvasRenderingContext2D,
  levelId: 1 | 2 | 3,
  threat: number,
) {
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (levelId === 1) {
    g.addColorStop(0, `rgba(18, 28, 48, ${0.08 + threat * 0.08})`);
    g.addColorStop(0.45, "transparent");
    g.addColorStop(1, `rgba(80, 28, 6, ${0.12 + threat * 0.16})`);
  } else if (levelId === 2) {
    g.addColorStop(0, `rgba(6, 8, 18, ${0.1 + threat * 0.12})`);
    g.addColorStop(0.55, "transparent");
    g.addColorStop(1, `rgba(180, 60, 8, ${0.1 + threat * 0.14})`);
  } else {
    g.addColorStop(0, "rgba(4, 8, 20, 0.12)");
    g.addColorStop(0.7, "transparent");
    g.addColorStop(1, `rgba(20, 70, 160, ${0.1 + threat * 0.1})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

export function drawLetterbox(ctx: CanvasRenderingContext2D, a = 1) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "#05070c";
  ctx.fillRect(0, 0, W, 18);
  ctx.fillRect(0, H - 18, W, 18);
  ctx.fillStyle = C.pad;
  ctx.globalAlpha = 0.55 * a;
  ctx.fillRect(0, 18, W, 2);
  ctx.fillStyle = C.cyan;
  ctx.fillRect(0, H - 20, W, 2);
  ctx.restore();
}

export function drawHeatHaze(ctx: CanvasRenderingContext2D, frame: number, threat: number) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const n = 8 + Math.floor(threat * 10);
  for (let i = 0; i < n; i++) {
    const x = ((i * 140 + frame * 2) % (W + 40)) - 20;
    const y = H - 50 - (i % 5) * 18 + Math.sin(frame * 0.12 + i) * 6;
    ctx.fillStyle = `rgba(232,93,4,${0.04 + threat * 0.05})`;
    ctx.fillRect(x, y, 80, 10);
  }
  ctx.restore();
}

export function drawEarthLimb(ctx: CanvasRenderingContext2D, frame: number) {
  ctx.save();
  const g = ctx.createLinearGradient(0, H * 0.62, 0, H);
  g.addColorStop(0, "transparent");
  g.addColorStop(0.45, "rgba(20, 80, 180, 0.12)");
  g.addColorStop(1, "rgba(12, 40, 90, 0.28)");
  ctx.fillStyle = g;
  ctx.fillRect(0, H * 0.58, W, H * 0.42);
  glow(ctx, W * 0.35, H + 40, 180, C.earth, 0.18 + Math.sin(frame * 0.03) * 0.04);
  ctx.restore();
}

export function drawStarTwinkle(ctx: CanvasRenderingContext2D, frame: number) {
  ctx.save();
  for (let i = 0; i < 28; i++) {
    const x = (i * 137) % W;
    const y = (i * 89) % (H * 0.55);
    const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(frame * 0.08 + i));
    ctx.fillStyle = `rgba(244,237,228,${a})`;
    ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
  }
  ctx.restore();
}

/** Stencil plate — HUD chrome, not a glass card */
export function drawPlate(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  edge: string = C.cyan,
) {
  ctx.fillStyle = "rgba(8,12,20,0.72)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = edge;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.globalAlpha = 1;
  ctx.fillStyle = edge;
  ctx.fillRect(x, y, 3, 3);
  ctx.fillRect(x + w - 3, y, 3, 3);
  ctx.fillRect(x, y + h - 3, 3, 3);
  ctx.fillRect(x + w - 3, y + h - 3, 3, 3);
}

export function drawPips(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  n: number,
  filled: number,
  on: string,
  off: string,
) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i < filled ? on : off;
    ctx.fillRect(x + i * 11, y, 9, 8);
  }
}

export function drawSignalMeter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  ratio: number,
  phase: number,
) {
  ctx.strokeStyle = C.cyan;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 11);
  const fill = Math.max(0, Math.min(1, ratio)) * (w - 4);
  ctx.fillStyle = phase >= 3 ? C.pad : C.cyan;
  ctx.fillRect(x + 2, y + 2, fill, 8);
  ctx.fillStyle = "rgba(11,18,32,0.35)";
  for (let i = 1; i < 8; i++) ctx.fillRect(x + (w * i) / 8, y + 2, 1, 8);
}
