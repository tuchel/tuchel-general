import { C } from "./palette";
import { CLIPS } from "./anim";

export type SpriteId =
  | "ash"
  | "ash-eva"
  | "ship"
  | "truck"
  | "drone"
  | "crab"
  | "turret"
  | "hackbot"
  | "walker"
  | "wasp"
  | "climber"
  | "gridsat"
  | "mirror"
  | "beetle"
  | "ghost"
  | "spine"
  | "gate"
  | "pickup"
  | "boss-reaper"
  | "boss-seraph"
  | "boss-prime"
  | "prop-crate-near"
  | "prop-gantry-near"
  | "pad7"
  | "gantry-tower"
  | "wreck-starship"
  | "wreck-dragon"
  | "wreck-booster"
  | "cybertruck";

export type BgId =
  | "l1-sky"
  | "l1-sky-calm"
  | "l1-sky-peak"
  | "l1-mid"
  | "l1-mid-calm"
  | "l1-mid-peak"
  | "l2-ascent"
  | "l2-ascent-calm"
  | "l2-ascent-peak"
  | "l3-void"
  | "l3-void-calm"
  | "l3-void-peak"
  | "title-hero";

const SPRITE_FILES: Record<SpriteId, string> = {
  ash: "sprites/ash.png",
  "ash-eva": "sprites/ash-eva.png",
  ship: "sprites/ship.png",
  truck: "sprites/truck.png",
  drone: "sprites/drone.png",
  crab: "sprites/crab.png",
  turret: "sprites/turret.png",
  hackbot: "sprites/hackbot.png",
  walker: "sprites/walker.png",
  wasp: "sprites/wasp.png",
  climber: "sprites/drone.png",
  gridsat: "sprites/gridsat.png",
  mirror: "sprites/mirror.png",
  beetle: "sprites/beetle.png",
  ghost: "sprites/ghost.png",
  spine: "sprites/spine.png",
  gate: "sprites/gate.png",
  pickup: "sprites/pickup.png",
  "boss-reaper": "sprites/boss-reaper.png",
  "boss-seraph": "sprites/boss-seraph.png",
  "boss-prime": "sprites/boss-prime.png",
  "prop-crate-near": "props/prop-crate-near.png",
  "prop-gantry-near": "props/prop-gantry-near.png",
  pad7: "sprites/pad7.png",
  "gantry-tower": "props/gantry-spectacle.png",
  "wreck-starship": "props/wreck-starship.png",
  "wreck-dragon": "props/wreck-dragon.png",
  "wreck-booster": "props/wreck-booster.png",
  cybertruck: "props/cybertruck.png",
};

const BG_FILES: Record<BgId, string> = {
  "l1-sky": "bg/l1-sky.jpg",
  "l1-sky-calm": "bg/l1-sky-calm.jpg",
  "l1-sky-peak": "bg/l1-sky-peak.jpg",
  "l1-mid": "bg/l1-mid.jpg",
  "l1-mid-calm": "bg/l1-mid-calm.jpg",
  "l1-mid-peak": "bg/l1-mid-peak.jpg",
  "l2-ascent": "bg/l2-ascent.jpg",
  "l2-ascent-calm": "bg/l2-ascent-calm.jpg",
  "l2-ascent-peak": "bg/l2-ascent-peak.jpg",
  "l3-void": "bg/l3-void.jpg",
  "l3-void-calm": "bg/l3-void-calm.jpg",
  "l3-void-peak": "bg/l3-void-peak.jpg",
  "title-hero": "ui/title-hero.jpg",
};

/** Collect every authored anim frame id from clip libraries */
function collectAnimFrameIds(): string[] {
  const ids = new Set<string>();
  for (const lib of Object.values(CLIPS)) {
    for (const clip of Object.values(lib)) {
      if (!clip) continue;
      for (const f of clip.frames) ids.add(f);
    }
  }
  return [...ids];
}

function artUrl(rel: string) {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}art/${rel}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

export class ArtBank {
  ready = false;
  private sprites = new Map<string, HTMLImageElement>();
  private frames = new Map<string, HTMLImageElement>();
  private bgs = new Map<string, HTMLImageElement>();

  async load() {
    const spriteEntries = Object.entries(SPRITE_FILES);
    const bgEntries = Object.entries(BG_FILES);
    const animIds = collectAnimFrameIds();
    await Promise.all([
      ...spriteEntries.map(async ([id, rel]) => {
        try {
          this.sprites.set(id, await loadImage(artUrl(rel)));
        } catch (e) {
          console.warn("sprite miss", id, e);
        }
      }),
      ...bgEntries.map(async ([id, rel]) => {
        try {
          this.bgs.set(id, await loadImage(artUrl(rel)));
        } catch (e) {
          console.warn("bg miss", id, e);
        }
      }),
      ...animIds.map(async (id) => {
        try {
          this.frames.set(id, await loadImage(artUrl(`anim/${id}.png`)));
        } catch (e) {
          console.warn("anim miss", id, e);
        }
      }),
    ]);
    this.ready = this.sprites.size > 0 || this.frames.size > 0 || this.bgs.size > 0;
  }

  sprite(id: SpriteId | string) {
    return this.sprites.get(id) ?? null;
  }

  /** Authored animation frame by id (e.g. ash-walk-2) */
  frame(id: string) {
    return this.frames.get(id) ?? null;
  }

  bg(id: BgId) {
    return this.bgs.get(id) ?? null;
  }
}

export const art = new ArtBank();

/**
 * Black silhouette per source image, built once. Replaces `ctx.filter = "brightness(0)"`,
 * which re-filters the bitmap on every draw and is the single most expensive call on phones.
 */
const silhouettes = new WeakMap<HTMLImageElement, HTMLCanvasElement | null>();

function silhouetteOf(img: HTMLImageElement): HTMLCanvasElement | null {
  if (silhouettes.has(img)) return silhouettes.get(img) ?? null;
  let c: HTMLCanvasElement | null = null;
  if (img.width > 0 && img.height > 0) {
    c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    if (g) {
      g.drawImage(img, 0, 0);
      g.globalCompositeOperation = "source-in";
      g.fillStyle = "#000";
      g.fillRect(0, 0, c.width, c.height);
    } else c = null;
  }
  silhouettes.set(img, c);
  return c;
}

export function blitSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  opts: {
    facing?: 1 | -1;
    h?: number;
    w?: number;
    scale?: number;
    alpha?: number;
    bob?: number;
    flash?: boolean;
    outline?: boolean;
    /** center = mid-sprite (default); feet = bottom-center on ground line */
    anchor?: "center" | "feet";
  } = {},
) {
  if (!img) return false;
  const facing = opts.facing ?? 1;
  const baseH = opts.h ?? Math.min(72, img.height);
  const s = opts.scale ?? 1;
  const targetH = baseH * s;
  const scale = targetH / img.height;
  const dw = opts.w ?? img.width * scale;
  const dh = targetH;
  const bob = opts.bob ?? 0;
  const anchorY = opts.anchor === "feet" ? -dh : -dh / 2;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y + bob));
  ctx.scale(facing, 1);
  ctx.globalAlpha = opts.alpha ?? 1;
  if (opts.flash) ctx.globalCompositeOperation = "lighter";
  ctx.imageSmoothingEnabled = true;
  if (opts.outline) {
    const sil = silhouetteOf(img);
    if (sil) {
      ctx.globalAlpha = (opts.alpha ?? 1) * 0.85;
      const o = Math.max(1, Math.round(s));
      ctx.drawImage(sil, -dw / 2 - o, anchorY, dw, dh);
      ctx.drawImage(sil, -dw / 2 + o, anchorY, dw, dh);
      ctx.drawImage(sil, -dw / 2, anchorY - o, dw, dh);
      ctx.drawImage(sil, -dw / 2, anchorY + o, dw, dh);
      ctx.globalAlpha = opts.alpha ?? 1;
    }
  }
  ctx.drawImage(img, -dw / 2, anchorY, dw, dh);
  ctx.restore();
  return true;
}

export type ParallaxBand = {
  destY: number;
  destH: number;
  /** Source top as a fraction of image height (0 = top). */
  srcTop?: number;
  /** Source height as a fraction of image height. */
  srcFrac?: number;
};

export function blitParallax(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  camX: number,
  factor: number,
  yOffset = 0,
  alpha = 1,
  band?: ParallaxBand,
) {
  if (!img) return false;
  const srcTop = Math.max(0, Math.min(img.height - 1, (band?.srcTop ?? 0) * img.height));
  const srcH = Math.max(1, Math.min(img.height - srcTop, (band?.srcFrac ?? 1) * img.height));
  const destY = band ? band.destY : yOffset;
  const destH = band ? band.destH : 540;
  const scale = destH / srcH;
  const dw = img.width * scale;
  const offset = -((camX * factor) % dw);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  for (let x = offset - dw; x < 960 + dw; x += dw) {
    ctx.drawImage(
      img,
      0,
      srcTop,
      img.width,
      srcH,
      Math.round(x),
      destY,
      dw,
      destH,
    );
  }
  ctx.restore();
  return true;
}

/** Crossfade calm→peak parallax plates by threat 0…1 */
export function blitParallaxEvolve(
  ctx: CanvasRenderingContext2D,
  calm: HTMLImageElement | null,
  peak: HTMLImageElement | null,
  camX: number,
  factor: number,
  threat: number,
  yOffset = 0,
  band?: ParallaxBand,
) {
  const t = Math.max(0, Math.min(1, threat));
  const peakA = t * t * (3 - 2 * t);
  blitParallax(ctx, calm, camX, factor, yOffset, 1, band);
  if (peakA > 0.02) blitParallax(ctx, peak, camX, factor, yOffset, peakA, band);
}

export function blitCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  alpha = 1,
) {
  if (!img) return false;
  const cw = 960;
  const ch = 540;
  const scale = Math.max(cw / img.width, ch / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  const g = ctx.createRadialGradient(cw / 2, ch / 2, 120, cw / 2, ch / 2, 520);
  g.addColorStop(0, "transparent");
  g.addColorStop(1, "rgba(5,8,16,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, cw, ch);
  ctx.restore();
  return true;
}

export function enemySpriteId(kind: string): SpriteId {
  const map: Record<string, SpriteId> = {
    drone: "drone",
    crab: "crab",
    turret: "turret",
    hackbot: "hackbot",
    walker: "walker",
    climber: "climber",
    wasp: "wasp",
    gridsat: "gridsat",
    mirror: "mirror",
    beetle: "beetle",
    ghost: "ghost",
    spine: "spine",
    tether: "ghost",
  };
  return map[kind] ?? "drone";
}

export function bossSpriteId(id: string): SpriteId {
  if (id === "reaper") return "boss-reaper";
  if (id === "seraph") return "boss-seraph";
  return "boss-prime";
}

export function enemyAnimLib(kind: string): string {
  if (kind === "climber") return "drone";
  if (kind === "mine") return "drone";
  if (kind === "tether") return "ghost";
  return kind;
}

export function bossAnimLib(id: string): string {
  if (id === "reaper") return "boss-reaper";
  if (id === "seraph") return "boss-seraph";
  return "boss-prime";
}

export { C };
