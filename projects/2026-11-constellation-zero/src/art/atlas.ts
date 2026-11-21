import type { MissionId } from "../engine/types";

export interface LoadedArt {
  bgs: Record<MissionId, HTMLImageElement | null>;
  portraits: Record<"zero" | "mirror" | "lark", HTMLImageElement | null>;
  grainPattern: CanvasPattern | null;
}

function loadImg(src: string): HTMLImageElement {
  const img = new Image();
  img.decoding = "async";
  img.src = src;
  return img;
}

export class ArtAtlas {
  private bgs: Record<MissionId, HTMLImageElement>;
  private portraits: Record<"zero" | "mirror" | "lark", HTMLImageElement>;
  private grainCanvas: HTMLCanvasElement | null = null;
  private grainPattern: CanvasPattern | null = null;

  constructor() {
    this.bgs = {
      1: loadImg("./art/bg-m1-starbase.jpg"),
      2: loadImg("./art/bg-m2-ascent.jpg"),
      3: loadImg("./art/bg-m3-orbit.jpg"),
      4: loadImg("./art/bg-m4-core.jpg"),
    };
    this.portraits = {
      zero: loadImg("./art/portrait-zero.jpg"),
      mirror: loadImg("./art/portrait-mirror.jpg"),
      lark: loadImg("./art/portrait-lark.jpg"),
    };
    if (typeof document !== "undefined") {
      this.grainCanvas = this.createInkGrainCanvas();
    }
  }

  public getBg(id: MissionId): HTMLImageElement | null {
    const img = this.bgs[id];
    return img && img.complete && img.naturalWidth > 0 ? img : null;
  }

  public getPortrait(id: "zero" | "mirror" | "lark"): HTMLImageElement | null {
    const img = this.portraits[id];
    return img && img.complete && img.naturalWidth > 0 ? img : null;
  }

  public getGrainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
    if (!this.grainPattern && this.grainCanvas) {
      this.grainPattern = ctx.createPattern(this.grainCanvas, "repeat");
    }
    return this.grainPattern;
  }

  /**
   * Subtle sumi-e paper grain & fine dry-brush speckle texture so live Canvas art
   * blends seamlessly with the painted Shinkawa backdrops.
   */
  private createInkGrainCanvas(): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const g = c.getContext("2d");
    if (!g) return c;

    let seed = 1337;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < 420; i++) {
      const x = rand() * 128;
      const y = rand() * 128;
      const bright = rand() > 0.55;
      g.fillStyle = bright ? "rgba(235, 244, 255, 0.032)" : "rgba(0, 0, 0, 0.055)";
      g.fillRect(x, y, 1 + rand() * 2, 1 + rand() * 1.5);
    }
    // Fine diagonal sumi-e fiber strokes
    g.strokeStyle = "rgba(255, 255, 255, 0.02)";
    g.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      const x = rand() * 128;
      const y = rand() * 128;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 10 + rand() * 14, y - 4 + rand() * 8);
      g.stroke();
    }
    return c;
  }
}
