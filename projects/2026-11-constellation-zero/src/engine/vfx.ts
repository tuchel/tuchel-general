export interface InkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  kind: "ink" | "spark" | "ring" | "slash" | "smoke" | "casing" | "streak";
  angle: number;
  vangle: number;
  gravity: number;
}

export interface InkDecal {
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
  angle: number;
  kind: "splatter" | "scorch";
}

export interface FloatingCallout {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export class VfxSystem {
  public particles: InkParticle[] = [];
  public decals: InkDecal[] = [];
  public callouts: FloatingCallout[] = [];
  public shakeMagnitude = 0;
  public shakeTime = 0;
  public hitStop = 0;
  public flashAlpha = 0;
  public flashColor = "#FF3B2F";

  public clear(): void {
    this.particles = [];
    this.decals = [];
    this.callouts = [];
    this.shakeMagnitude = 0;
    this.shakeTime = 0;
    this.hitStop = 0;
    this.flashAlpha = 0;
  }

  public addShake(magnitude: number, duration = 0.22): void {
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  public addHitStop(seconds: number): void {
    this.hitStop = Math.max(this.hitStop, seconds);
  }

  public addFlash(color: string, alpha = 0.35): void {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
  }

  public addCallout(x: number, y: number, text: string, color = "#F2F5F8", scale = 1): void {
    this.callouts.push({
      x,
      y,
      text,
      color,
      life: 1.05,
      maxLife: 1.05,
      scale,
    });
  }

  public stampDecal(x: number, y: number, kind: "splatter" | "scorch", color = "#070A0F", radius = 22): void {
    this.decals.push({
      x,
      y,
      radius,
      color,
      alpha: kind === "scorch" ? 0.58 : 0.72,
      angle: Math.random() * Math.PI * 2,
      kind,
    });
    if (this.decals.length > 48) {
      this.decals.shift();
    }
  }

  public spawnInkBurst(x: number, y: number, color = "#090C11", accent = "#FF3B2F", count = 16): void {
    this.stampDecal(x, y, "splatter", accent === "#FF3B2F" && Math.random() < 0.45 ? "#5A1214" : "#06080D", 14 + Math.random() * 14);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 85 + Math.random() * 320;
      const isAccent = i % 3 === 0;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 45,
        size: 3.5 + Math.random() * 9.5,
        color: isAccent ? accent : color,
        alpha: 0.96,
        life: 0.3 + Math.random() * 0.42,
        maxLife: 0.72,
        kind: i % 4 === 0 ? "streak" : "ink",
        angle: a,
        vangle: (Math.random() - 0.5) * 10,
        gravity: 360,
      });
    }
  }

  public spawnSlash(x: number, y: number, facing: number, color = "#F2F5F8"): void {
    this.particles.push({
      x,
      y,
      vx: facing * 65,
      vy: 0,
      size: 72,
      color,
      alpha: 1,
      life: 0.24,
      maxLife: 0.24,
      kind: "slash",
      angle: facing > 0 ? -0.35 : Math.PI + 0.35,
      vangle: facing * 6,
      gravity: 0,
    });
    this.spawnInkBurst(x + facing * 18, y, "#06080D", "#FF3B2F", 16);
  }

  public spawnRing(x: number, y: number, color = "#4DA8DA", maxSize = 160): void {
    this.particles.push({
      x,
      y,
      vx: 0,
      vy: 0,
      size: maxSize,
      color,
      alpha: 0.95,
      life: 0.46,
      maxLife: 0.46,
      kind: "ring",
      angle: 0,
      vangle: 0,
      gravity: 0,
    });
  }

  public spawnMuzzle(x: number, y: number, angle: number, loud: boolean, color: string): void {
    const count = loud ? 10 : 4;
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * (loud ? 0.65 : 0.24);
      const spd = (loud ? 210 : 100) + Math.random() * 170;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: loud ? 5 + Math.random() * 6 : 2.8,
        color: i === 0 ? "#FFFFFF" : color,
        alpha: 0.95,
        life: 0.11 + Math.random() * 0.11,
        maxLife: 0.22,
        kind: i % 2 === 0 ? "streak" : "spark",
        angle: a,
        vangle: 0,
        gravity: 35,
      });
    }
    if (loud) {
      this.particles.push({
        x,
        y,
        vx: -Math.cos(angle) * 65 + (Math.random() - 0.5) * 40,
        vy: -145 - Math.random() * 55,
        size: 3.8,
        color: "#E8C66D",
        alpha: 1,
        life: 0.58,
        maxLife: 0.58,
        kind: "casing",
        angle: Math.random() * Math.PI,
        vangle: 16,
        gravity: 540,
      });
    }
  }

  public spawnExplosion(x: number, y: number, large = false): void {
    this.stampDecal(x, y, "scorch", "#05070B", large ? 48 : 26);
    this.spawnRing(x, y, "#FF9500", large ? 190 : 105);
    this.spawnRing(x, y, "#FFFFFF", large ? 120 : 62);
    this.spawnInkBurst(x, y, "#06080D", "#FF3B2F", large ? 34 : 18);
    for (let i = 0; i < (large ? 26 : 14); i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 45 + Math.random() * (large ? 290 : 180);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: (large ? 12 : 7) + Math.random() * 14,
        color: i % 3 === 0 ? "#FFF4D8" : i % 2 === 0 ? "#FF9500" : "#18222E",
        alpha: 0.9,
        life: 0.36 + Math.random() * 0.38,
        maxLife: 0.74,
        kind: "smoke",
        angle: a,
        vangle: (Math.random() - 0.5) * 4,
        gravity: -45,
      });
    }
    this.addShake(large ? 14 : 6.5, large ? 0.36 : 0.18);
  }

  public spawnThruster(x: number, y: number, vx: number, vy: number, color = "#4DA8DA"): void {
    this.particles.push({
      x,
      y,
      vx: vx + (Math.random() - 0.5) * 35,
      vy: vy + (Math.random() - 0.5) * 35,
      size: 4 + Math.random() * 5,
      color,
      alpha: 0.84,
      life: 0.24,
      maxLife: 0.24,
      kind: "smoke",
      angle: 0,
      vangle: 0,
      gravity: 0,
    });
  }

  public update(dt: number): void {
    if (this.shakeTime > 0) {
      this.shakeTime = Math.max(0, this.shakeTime - dt);
      if (this.shakeTime === 0) this.shakeMagnitude = 0;
    }
    if (this.flashAlpha > 0) {
      this.flashAlpha = Math.max(0, this.flashAlpha - dt * 1.9);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.vangle * dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
    }

    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.life -= dt;
      c.y -= 34 * dt;
      if (c.life <= 0) {
        this.callouts.splice(i, 1);
      }
    }
  }

  public getShakeOffset(): { x: number; y: number } {
    if (this.shakeTime <= 0 || this.shakeMagnitude <= 0) return { x: 0, y: 0 };
    const m = this.shakeMagnitude * Math.min(1, this.shakeTime * 5);
    return {
      x: (Math.random() - 0.5) * 2 * m,
      y: (Math.random() - 0.5) * 2 * m,
    };
  }
}
