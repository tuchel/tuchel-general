import { C } from "./palette";

export function rr(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke?: string,
) {
  ctx.fillStyle = fill;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(
      Math.round(x) + 0.5,
      Math.round(y) + 0.5,
      Math.round(w) - 1,
      Math.round(h) - 1,
    );
  }
}

export function glow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  a = 0.35,
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, "transparent");
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Chunky astronaut — Ash Calder */
export function drawAsh(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  facing: 1 | -1,
  frame: number,
  mode: "ground" | "ship" | "eva",
) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(facing, 1);

  if (mode === "ship") {
    // Black Finch silhouette under player control is drawn elsewhere
    ctx.restore();
    return;
  }

  const bob = Math.sin(frame * 0.35) * (mode === "eva" ? 2 : 0);

  // jetpack / EVA pack
  if (mode === "eva") {
    rr(ctx, -14, -10 + bob, 8, 18, C.metal, C.soot);
    glow(ctx, -16, 4 + bob, 10, C.pad, 0.5);
    rr(ctx, -18, 2 + bob, 5, 8, C.pad);
  }

  // boots
  rr(ctx, -8, 14 + bob, 7, 6, C.soot);
  rr(ctx, 1, 14 + bob, 7, 6, C.soot);
  // legs
  rr(ctx, -7, 4 + bob, 6, 12, C.bone, C.soot);
  rr(ctx, 1, 4 + bob, 6, 12, C.bone, C.soot);
  // torso
  rr(ctx, -10, -12 + bob, 20, 18, C.bone, C.soot);
  rr(ctx, -10, -8 + bob, 20, 5, C.pad);
  // webbing
  rr(ctx, -3, -12 + bob, 3, 18, C.soot);
  // head
  rr(ctx, -7, -24 + bob, 14, 13, C.bone, C.soot);
  rr(ctx, -1, -20 + bob, 6, 3, C.soot); // visor / scar shadow
  rr(ctx, 3, -21 + bob, 2, 2, C.blood); // scar tick
  // arm + gun
  rr(ctx, 8, -8 + bob, 12, 4, C.bone, C.soot);
  rr(ctx, 18, -9 + bob, 10, 5, C.metal, C.soot);
  rr(ctx, 26, -8 + bob, 4, 3, C.cyan);

  if (mode === "eva") {
    // helmet sealed
    rr(ctx, -9, -26 + bob, 18, 16, C.metalLite, C.soot);
    rr(ctx, -5, -22 + bob, 12, 8, C.cyan);
    ctx.globalAlpha = 0.35;
    rr(ctx, -5, -22 + bob, 12, 8, C.white);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export function drawShip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  thrust: number,
  hurt = false,
) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  // plume
  if (thrust > 0) {
    glow(ctx, -28, 0, 18 + thrust * 8, C.pad, 0.45);
    rr(ctx, -34 - thrust * 10, -4, 14 + thrust * 10, 8, C.warn);
    rr(ctx, -30 - thrust * 6, -2, 10 + thrust * 6, 4, C.pad);
  }
  // body
  rr(ctx, -22, -12, 48, 24, hurt ? C.blood : C.bone, C.soot);
  rr(ctx, -18, -8, 36, 8, C.pad);
  rr(ctx, 18, -6, 16, 12, C.metal, C.soot); // nose
  rr(ctx, 26, -3, 8, 6, C.cyan);
  // fins
  rr(ctx, -16, -18, 10, 8, C.metal, C.soot);
  rr(ctx, -16, 10, 10, 8, C.metal, C.soot);
  // canopy
  rr(ctx, 2, -10, 12, 8, C.earth);
  ctx.restore();
}

export function drawEnemy(
  ctx: CanvasRenderingContext2D,
  kind: string,
  x: number,
  y: number,
  frame: number,
  facing: 1 | -1 = -1,
) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(facing, 1);
  const f = Math.sin(frame * 0.2);

  switch (kind) {
    case "drone":
      glow(ctx, 0, 0, 14, C.cyan, 0.25);
      rr(ctx, -12, -8, 24, 16, C.navy, C.cyan);
      rr(ctx, -4, -4, 8, 8, C.cyan);
      rr(ctx, -14, -2 + f, 4, 4, C.metal);
      rr(ctx, 10, -2 - f, 4, 4, C.metal);
      break;
    case "crab":
      rr(ctx, -14, -6, 28, 14, C.rust, C.soot);
      rr(ctx, -18, 4, 8, 6, C.metal);
      rr(ctx, 10, 4, 8, 6, C.metal);
      rr(ctx, -4, -10, 8, 6, C.cyan);
      break;
    case "turret":
      rr(ctx, -12, 4, 24, 10, C.metal, C.soot);
      rr(ctx, -8, -10, 16, 16, C.navy, C.cyan);
      rr(ctx, 4, -4, 14, 5, C.metal);
      break;
    case "hackbot":
      rr(ctx, -10, -10, 20, 20, C.warn, C.soot);
      rr(ctx, -6, -6, 12, 8, C.soot);
      rr(ctx, -4, 4, 3, 6, C.cyan);
      rr(ctx, 2, 4, 3, 6, C.cyan);
      break;
    case "walker":
      rr(ctx, -18, -14, 36, 22, C.metal, C.soot);
      rr(ctx, -22, 6, 10, 12, C.rust);
      rr(ctx, 12, 6, 10, 12, C.rust);
      rr(ctx, 8, -8, 18, 6, C.pad);
      rr(ctx, -6, -8, 10, 8, C.cyan);
      break;
    case "climber":
      rr(ctx, -10, -10, 20, 20, C.navy, C.cyan);
      rr(ctx, -14, 0, 8, 4, C.pad);
      rr(ctx, 6, 0, 8, 4, C.pad);
      glow(ctx, 0, 8, 10, C.pad, 0.4);
      break;
    case "wasp":
      rr(ctx, -8, -6, 22, 12, C.warn, C.soot);
      rr(ctx, 10, -2, 10, 4, C.metal);
      rr(ctx, -12, -10 + f, 8, 4, C.bone);
      break;
    case "mine":
      rr(ctx, -8, -8, 16, 16, C.blood, C.warn);
      rr(ctx, -3, -3, 6, 6, C.warn);
      break;
    case "gridsat":
      rr(ctx, -16, -6, 32, 12, C.metalLite, C.cyan);
      rr(ctx, -6, -10, 12, 20, C.navy, C.cyan);
      glow(ctx, 0, 0, 12, C.cyan, 0.3);
      break;
    case "mirror":
      rr(ctx, -12, -12, 24, 24, C.bone, C.cyan);
      ctx.globalAlpha = 0.5;
      rr(ctx, -8, -8, 16, 16, C.cyan);
      ctx.globalAlpha = 1;
      break;
    case "beetle":
      rr(ctx, -12, -8, 24, 16, C.pad, C.soot);
      rr(ctx, -4, -4, 8, 8, C.warn);
      break;
    case "ghost":
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(frame * 0.3);
      rr(ctx, -10, -10, 20, 20, C.cyan, C.white);
      ctx.globalAlpha = 1;
      break;
    default:
      rr(ctx, -10, -10, 20, 20, C.blood, C.white);
  }
  ctx.restore();
}

export function drawBoss(
  ctx: CanvasRenderingContext2D,
  id: string,
  x: number,
  y: number,
  frame: number,
  hpRatio: number,
  phase: number,
) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  const pulse = 1 + Math.sin(frame * 0.15) * 0.03;

  if (id === "reaper") {
    ctx.scale(pulse, pulse);
    // crane body
    rr(ctx, -50, -40, 100, 50, C.rust, C.soot);
    rr(ctx, -60, -20, 30, 70, C.metal, C.soot);
    // infection veins
    rr(ctx, -40, -30, 80, 6, C.cyan);
    rr(ctx, -20, -10, 6, 40, C.cyan);
    // claw
    const clawY = phase >= 2 ? 40 + Math.sin(frame * 0.2) * 20 : 50;
    rr(ctx, 30, -10, 12, clawY, C.metal, C.cyan);
    rr(ctx, 20, clawY - 10, 32, 16, C.soot, C.cyan);
    // eye
    glow(ctx, -20, -20, 20, C.cyan, 0.4);
    rr(ctx, -28, -28, 16, 16, C.navy, C.cyan);
    rr(ctx, -24, -24, 8, 8, hpRatio < 0.35 ? C.blood : C.cyan);
  } else if (id === "seraph") {
    // wings
    const flap = Math.sin(frame * 0.12) * 8;
    rr(ctx, -90, -10 + flap, 50, 14, C.metalLite, C.cyan);
    rr(ctx, 40, -10 - flap, 50, 14, C.metalLite, C.cyan);
    rr(ctx, -30, -20, 60, 40, C.navy, C.cyan);
    glow(ctx, 0, 0, 28, C.pad, 0.35);
    rr(ctx, -12, -12, 24, 24, C.soot, C.warn);
    rr(ctx, -6, -6, 12, 12, phase >= 3 ? C.blood : C.pad);
  } else if (id === "prime") {
    // rings
    ctx.strokeStyle = C.cyan;
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 70 + i * 18, 40 + i * 10, frame * 0.02 * (i % 2 ? 1 : -1), 0, Math.PI * 2);
      ctx.stroke();
    }
    // petals
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + frame * 0.01;
      const px = Math.cos(a) * 55;
      const py = Math.sin(a) * 32;
      rr(ctx, px - 8, py - 4, 16, 8, C.warn, C.cyan);
    }
    glow(ctx, 0, 0, 40, C.cyan, 0.45);
    rr(ctx, -22, -22, 44, 44, C.void, C.cyan);
    rr(ctx, -12, -12, 24, 24, hpRatio < 0.3 ? C.blood : C.cyan);
  }
  ctx.restore();
}

export function drawPickup(
  ctx: CanvasRenderingContext2D,
  kind: string,
  x: number,
  y: number,
  frame: number,
) {
  const bob = Math.sin(frame * 0.2) * 3;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y + bob));
  glow(ctx, 0, 0, 12, C.warn, 0.3);
  if (kind === "scrap") {
    rr(ctx, -6, -6, 12, 12, C.pad, C.warn);
  } else {
    rr(ctx, -10, -8, 20, 16, C.navy, C.cyan);
    rr(ctx, -6, -4, 12, 8, C.warn);
  }
  ctx.restore();
}

/** Fuel truck for L1 escort */
export function drawTruck(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hpRatio: number,
  moving: boolean,
) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  rr(ctx, -36, -22, 72, 28, C.metal, C.soot);
  rr(ctx, -30, -28, 40, 12, C.warn, C.soot);
  rr(ctx, 10, -18, 22, 16, C.navy, C.cyan);
  rr(ctx, -28, 4, 14, 10, C.soot);
  rr(ctx, 14, 4, 14, 10, C.soot);
  if (moving) glow(ctx, -40, 0, 14, C.pad, 0.35);
  rr(ctx, -32, -36, 64, 5, C.soot);
  rr(ctx, -32, -36, 64 * Math.max(0, hpRatio), 5, hpRatio < 0.35 ? C.blood : C.pad);
  ctx.restore();
}

/** Regional spine node for L3 goal A */
export function drawSpine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  frame: number,
) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  glow(ctx, 0, 0, 28, C.cyan, 0.4);
  ctx.strokeStyle = C.warn;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.stroke();
  rr(ctx, -14, -14, 28, 28, C.navy, C.cyan);
  rr(ctx, -6, -6, 12, 12, C.warn);
  const a = frame * 0.08;
  rr(ctx, Math.cos(a) * 18 - 3, Math.sin(a) * 18 - 3, 6, 6, C.cyan);
  ctx.restore();
}

/** LEO circularization ring */
export function drawCircRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hit: boolean,
) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.strokeStyle = hit ? C.metal : C.cyan;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 36, 22, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (!hit) glow(ctx, 0, 0, 30, C.cyan, 0.3);
  ctx.restore();
}
