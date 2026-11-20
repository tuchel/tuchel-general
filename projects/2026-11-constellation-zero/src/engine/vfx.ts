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
  kind: "ink" | "spark" | "ring" | "slash" | "smoke" | "casing";
  angle: number;
  vangle: number;
  gravity: number;
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
  public callouts: FloatingCallout[] = [];
  public shakeMagnitude = 0;
  public shakeTime = 0;
  public hitStop = 0;
  public flashAlpha = 0;
  public flashColor = "#FF3B2F";

  public clear(): void {
    this.particles = [];
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

  public spawnInkBurst(x: number, y: number, color = "#090C11", accent = "#FF3B2F", count = 16): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 70 + Math.random() * 290;
      const isAccent = i % 3 === 0;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd - 40,
        size: 3 + Math.random() * 8,
        color: isAccent ? accent : color,
        alpha: 0.95,
        life: 0.28 + Math.random() * 0.38,
        maxLife: 0.66,
        kind: "ink",
        angle: a,
        vangle: (Math.random() - 0.5) * 10,
        gravity: 340,
      });
    }
  }

  public spawnSlash(x: number, y: number, facing: number, color = "#F2F5F8"): void {
    this.particles.push({
      x,
      y,
      vx: facing * 60,
      vy: 0,
      size: 56,
      color,
      alpha: 1,
      life: 0.2,
      maxLife: 0.2,
      kind: "slash",
      angle: facing > 0 ? -0.35 : Math.PI + 0.35,
      vangle: facing * 6,
      gravity: 0,
    });
    this.spawnInkBurst(x + facing * 18, y, "#0B0E14", "#FF3B2F", 12);
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
      life: 0.44,
      maxLife: 0.44,
      kind: "ring",
      angle: 0,
      vangle: 0,
      gravity: 0,
    });
  }

  public spawnMuzzle(x: number, y: number, angle: number, loud: boolean, color: string): void {
    const count = loud ? 8 : 3;
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - 0.5) * (loud ? 0.6 : 0.22);
      const spd = (loud ? 190 : 90) + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: loud ? 4 + Math.random() * 5 : 2.5,
        color,
        alpha: 0.9,
        life: 0.12 + Math.random() * 0.1,
        maxLife: 0.22,
        kind: "spark",
        angle: a,
        vangle: 0,
        gravity: 40,
      });
    }
    if (loud) {
      // Shell casing
      this.particles.push({
        x,
        y,
        vx: -Math.cos(angle) * 55 + (Math.random() - 0.5) * 35,
        vy: -130 - Math.random() * 50,
        size: 3.5,
        color: "#E8C66D",
        alpha: 1,
        life: 0.55,
        maxLife: 0.55,
        kind: "casing",
        angle: Math.random() * Math.PI,
        vangle: 14,
        gravity: 520,
      });
    }
  }

  public spawnExplosion(x: number, y: number, large = false): void {
    this.spawnRing(x, y, "#FF9500", large ? 170 : 95);
    this.spawnInkBurst(x, y, "#090C11", "#FF3B2F", large ? 28 : 14);
    for (let i = 0; i < (large ? 22 : 12); i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * (large ? 260 : 160);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: (large ? 10 : 6) + Math.random() * 12,
        color: i % 2 === 0 ? "#FF9500" : "#F2F5F8",
        alpha: 0.85,
        life: 0.35 + Math.random() * 0.35,
        maxLife: 0.7,
        kind: "smoke",
        angle: a,
        vangle: (Math.random() - 0.5) * 4,
        gravity: -40,
      });
    }
    this.addShake(large ? 13 : 6, large ? 0.34 : 0.16);
  }

  public spawnThruster(x: number, y: number, vx: number, vy: number, color = "#4DA8DA"): void {
    this.particles.push({
      x,
      y,
      vx: vx + (Math.random() - 0.5) * 35,
      vy: vy + (Math.random() - 0.5) * 35,
      size: 3.5 + Math.random() * 4.5,
      color,
      alpha: 0.8,
      life: 0.22,
      maxLife: 0.22,
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
