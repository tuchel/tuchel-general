/**
 * Procedural arcade SFX + bed music — Web Audio, no asset files.
 * Unlock on the first pointer/key gesture (iOS requirement).
 */

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private unlocked = false;
  private lastShot = 0;

  unlock() {
    if (this.unlocked && this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.ctx.destination);
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.0;
    this.musicBus.connect(this.master);
    void this.ctx.resume();
    this.unlocked = true;
  }

  ac(): AudioContext | null {
    if (!this.unlocked) this.unlock();
    return this.ctx;
  }

  musicNode(): GainNode | null {
    return this.musicBus;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = "square",
    gain = 0.18,
    slide = 0,
  ) {
    const ctx = this.ac();
    const master = this.master;
    if (!ctx || !master) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, gain = 0.12, hp = 800) {
    const ctx = this.ac();
    const master = this.master;
    if (!ctx || !master) return;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = hp;
    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
  }

  shoot(kind: string) {
    const now = performance.now();
    if (now - this.lastShot < 40) return;
    this.lastShot = now;
    if (kind === "rocket") {
      this.tone(140, 0.18, "sawtooth", 0.16, -80);
      this.noise(0.12, 0.1, 400);
    } else if (kind === "flame") {
      this.noise(0.08, 0.08, 300);
      this.tone(90, 0.07, "sawtooth", 0.08, -20);
    } else if (kind === "beam") {
      this.tone(880, 0.05, "square", 0.07, 200);
    } else if (kind === "rail") {
      this.tone(220, 0.22, "sawtooth", 0.2, 600);
      this.noise(0.1, 0.12, 1200);
    } else if (kind === "spread") {
      this.tone(320, 0.07, "square", 0.12, -120);
      this.tone(480, 0.06, "square", 0.08, -80);
    } else {
      this.tone(420, 0.055, "square", 0.11, -90);
    }
  }

  hit() {
    this.tone(180, 0.05, "square", 0.1, -60);
  }

  kill() {
    this.tone(240, 0.12, "square", 0.14, -160);
    this.noise(0.08, 0.08, 600);
  }

  explode() {
    this.noise(0.22, 0.16, 200);
    this.tone(90, 0.2, "sawtooth", 0.14, -50);
  }

  emp() {
    this.tone(140, 0.28, "sine", 0.16, 400);
    this.tone(900, 0.12, "square", 0.08, -400);
    this.noise(0.18, 0.1, 900);
  }

  pickup() {
    this.tone(520, 0.08, "square", 0.12, 200);
    this.tone(780, 0.1, "square", 0.1, 120);
  }

  heal() {
    this.tone(392, 0.1, "sine", 0.1, 80);
    this.tone(523, 0.14, "sine", 0.1, 120);
  }

  jump() {
    this.tone(260, 0.08, "square", 0.08, 180);
  }

  land() {
    this.noise(0.06, 0.07, 180);
    this.tone(90, 0.05, "sine", 0.06, -30);
  }

  hurt() {
    this.tone(110, 0.16, "sawtooth", 0.16, -80);
    this.noise(0.1, 0.1, 200);
  }

  death() {
    this.tone(160, 0.4, "sawtooth", 0.18, -120);
    this.noise(0.3, 0.12, 150);
  }

  ui() {
    this.tone(660, 0.06, "square", 0.1, 80);
  }

  confirm() {
    this.tone(440, 0.08, "square", 0.12, 220);
    this.tone(660, 0.1, "square", 0.1, 80);
  }

  gate() {
    this.tone(520, 0.1, "sine", 0.12, 260);
    this.tone(780, 0.12, "sine", 0.1, 120);
  }

  boss() {
    this.tone(70, 0.35, "sawtooth", 0.18, 40);
    this.noise(0.25, 0.12, 180);
  }

  combo() {
    this.tone(880, 0.07, "square", 0.1, 200);
  }

  warn() {
    this.tone(880, 0.04, "square", 0.06, 40);
  }

  telegraph() {
    this.tone(420, 0.08, "square", 0.1, 280);
    this.tone(660, 0.12, "square", 0.08, 220);
  }

  rumble() {
    this.noise(0.42, 0.18, 80);
    this.tone(55, 0.38, "sawtooth", 0.16, -12);
  }

  tether() {
    this.tone(180, 0.16, "sine", 0.09, 40);
    this.tone(240, 0.12, "sine", 0.06, -30);
  }

  shear() {
    this.noise(0.28, 0.12, 400);
    this.tone(520, 0.22, "sine", 0.12, -280);
  }

  slam() {
    this.noise(0.28, 0.2, 90);
    this.tone(70, 0.28, "sawtooth", 0.2, -30);
  }

  laser() {
    this.tone(1400, 0.35, "sine", 0.1, -700);
    this.tone(220, 0.2, "sawtooth", 0.08, 80);
  }
}

/** Low bed under combat — A-minor pentatonic pulse, ducks on pause. */
class Music {
  private acc = 0;
  private step = 0;
  private target = 0;
  private readonly notes = [110, 130.81, 146.83, 164.81, 196, 220, 261.63];

  tick(dt: number, intensity: number, active: boolean) {
    const ctx = sfx.ac();
    const bus = sfx.musicNode();
    if (!ctx || !bus) return;
    this.target = active ? 0.055 + intensity * 0.05 : 0;
    const g = bus.gain;
    const now = ctx.currentTime;
    g.cancelScheduledValues(now);
    g.linearRampToValueAtTime(this.target, now + 0.12);
    if (!active) return;

    const beat = 0.24 - intensity * 0.07;
    this.acc += dt;
    while (this.acc >= beat) {
      this.acc -= beat;
      this.hit(ctx, bus, intensity);
      this.step++;
    }
  }

  private hit(ctx: AudioContext, bus: GainNode, intensity: number) {
    const t0 = ctx.currentTime;
    const bass = this.step % 4 === 0;
    const freq = bass
      ? this.notes[0]! * (this.step % 8 === 0 ? 0.5 : 0.5)
      : this.notes[(this.step * 3 + Math.floor(intensity * 4)) % this.notes.length]!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    osc.type = bass ? "sawtooth" : "triangle";
    osc.frequency.setValueAtTime(freq, t0);
    f.type = "lowpass";
    f.frequency.setValueAtTime(420 + intensity * 900, t0);
    g.gain.setValueAtTime(bass ? 0.22 : 0.09, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + (bass ? 0.28 : 0.12));
    osc.connect(f);
    f.connect(g);
    g.connect(bus);
    osc.start(t0);
    osc.stop(t0 + 0.32);
  }
}

export const sfx = new Sfx();
export const music = new Music();
