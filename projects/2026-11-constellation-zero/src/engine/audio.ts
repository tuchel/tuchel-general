import type { AlertState, SpeakerId, WeaponId } from "./types";

type MusicMode = "menu" | "stealth" | "alert" | "boss" | "ending" | "silent";

/**
 * Procedural Web Audio synthesizer:
 * - Adaptive espionage score that transitions smoothly between Stealth, Alert, and Boss layers
 * - Tactile MGS/Metal Slug sound effects (! alert stinger, Reflex slow-mo drop, weapons, CQC, Codec)
 * - Zero external audio files required; mobile Safari safe.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private muted = false;
  private mode: MusicMode = "silent";
  private step = 0;
  private stepTimer: number | null = null;

  constructor(initialMuted = false) {
    this.muted = initialMuted;
  }

  public unlock(): void {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();

      this.masterGain.gain.value = this.muted ? 0 : 0.72;
      this.musicGain.gain.value = 0.28;
      this.sfxGain.gain.value = 0.78;

      this.musicGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
    }

    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(m: boolean): void {
    this.muted = m;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(m ? 0 : 0.72, this.ctx.currentTime, 0.04);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMusicMode(next: MusicMode): void {
    if (this.mode === next) return;
    this.mode = next;
    if (next === "silent") {
      this.stopSequencer();
      return;
    }
    this.startSequencer();
  }

  public syncAlertState(state: AlertState, bossActive: boolean): void {
    if (bossActive) {
      this.setMusicMode("boss");
    } else if (state === "ALERT") {
      this.setMusicMode("alert");
    } else {
      this.setMusicMode("stealth");
    }
  }

  private startSequencer(): void {
    if (this.stepTimer !== null) return;
    const tick = () => {
      this.playMusicStep();
      const tempoMs =
        this.mode === "boss"
          ? 128
          : this.mode === "alert"
          ? 142
          : this.mode === "menu"
          ? 240
          : this.mode === "ending"
          ? 280
          : 195;
      this.stepTimer = window.setTimeout(tick, tempoMs);
    };
    tick();
  }

  private stopSequencer(): void {
    if (this.stepTimer !== null) {
      window.clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }
  }

  private playMusicStep(): void {
    if (!this.ctx || !this.musicGain || this.muted || this.ctx.state !== "running") return;
    const t = this.ctx.currentTime;
    const s = this.step % 16;
    this.step++;

    // Minor tactical espionage scales (D minor / F minor orbital noir)
    const stealthBass = [73.42, 0, 73.42, 0, 87.31, 0, 82.41, 0, 73.42, 0, 65.41, 0, 73.42, 0, 98.0, 0];
    const alertBass = [73.42, 73.42, 110.0, 73.42, 87.31, 87.31, 130.81, 82.41, 73.42, 73.42, 110.0, 98.0, 65.41, 73.42, 82.41, 87.31];
    const bossBass = [65.41, 65.41, 98.0, 65.41, 77.78, 77.78, 116.54, 73.42, 65.41, 98.0, 130.81, 123.47, 116.54, 98.0, 87.31, 73.42];
    const menuNotes = [146.83, 0, 0, 174.61, 220.0, 0, 196.0, 0, 146.83, 0, 130.81, 0, 164.81, 0, 0, 0];
    const endingNotes = [220.0, 0, 261.63, 0, 329.63, 0, 293.66, 0, 246.94, 0, 220.0, 0, 196.0, 0, 220.0, 0];

    if (this.mode === "stealth") {
      const f = stealthBass[s];
      if (f > 0) this.synthTone(f, "triangle", 0.22, 0.26, this.musicGain, 260);
      if (s === 0 || s === 8) {
        this.synthTone(f * 2 || 146.83, "sine", 0.65, 0.08, this.musicGain, 600);
      }
      if (s === 4 || s === 12) {
        this.synthNoise(0.035, 0.045, 3200, this.musicGain);
      }
    } else if (this.mode === "alert") {
      const f = alertBass[s];
      this.synthTone(f, "sawtooth", 0.13, 0.25, this.musicGain, 540);
      // Driving kick + snare pulse
      if (s % 4 === 0) this.synthKick(t, 0.34, this.musicGain);
      if (s % 4 === 2) this.synthNoise(0.08, 0.14, 1700, this.musicGain);
      if (s % 2 === 1) this.synthNoise(0.025, 0.05, 5500, this.musicGain);
      // Brassy MGS stab on phrase accents
      if (s === 0 || s === 6 || s === 10) {
        const stab = s === 6 ? 349.23 : s === 10 ? 329.63 : 293.66;
        this.synthTone(stab, "sawtooth", 0.18, 0.13, this.musicGain, 1100);
      }
    } else if (this.mode === "boss") {
      const f = bossBass[s];
      this.synthTone(f, "sawtooth", 0.12, 0.3, this.musicGain, 760);
      if (s % 2 === 0) this.synthKick(t, 0.38, this.musicGain);
      if (s % 4 === 2) this.synthNoise(0.09, 0.18, 2200, this.musicGain);
      const lead = [261.63, 0, 311.13, 293.66, 0, 392.0, 349.23, 0, 311.13, 0, 293.66, 261.63, 246.94, 0, 196.0, 233.08][s];
      if (lead > 0) this.synthTone(lead, "square", 0.14, 0.12, this.musicGain, 1400);
    } else if (this.mode === "menu") {
      const f = menuNotes[s];
      if (f > 0) this.synthTone(f, "sine", 0.55, 0.14, this.musicGain, 900);
      if (s === 0) this.synthTone(73.42, "triangle", 1.1, 0.16, this.musicGain, 240);
    } else if (this.mode === "ending") {
      const f = endingNotes[s];
      if (f > 0) this.synthTone(f, "sine", 0.72, 0.15, this.musicGain, 1200);
      if (s === 0 || s === 8) this.synthTone(110, "triangle", 1.2, 0.14, this.musicGain, 320);
    }
  }

  // --- Tactical SFX ---

  public playAlertStinger(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const t = this.ctx.currentTime;
    // Iconic piercing MGS-style "!" twin brass/synth stinger
    const freqs = [987.77, 1318.51, 1479.98];
    freqs.forEach((f, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = idx === 0 ? "sawtooth" : "square";
      osc.frequency.setValueAtTime(f * 0.94, t);
      osc.frequency.exponentialRampToValueAtTime(f, t + 0.04);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.24 / (idx + 1), t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t);
      osc.stop(t + 0.44);
    });
  }

  public playSuspicious(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(360, t);
    osc.frequency.exponentialRampToValueAtTime(540, t + 0.14);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  public playReflexDrop(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.48);
    g.gain.setValueAtTime(0.42, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.52);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.54);
  }

  public playWeaponFire(weapon: WeaponId): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const t = this.ctx.currentTime;
    switch (weapon) {
      case "silenced_rail":
        this.synthNoise(0.055, 0.16, 2600, this.sfxGain);
        this.synthSweep(640, 180, 0.06, "triangle", 0.14, this.sfxGain);
        break;
      case "pulse_carbine":
        this.synthNoise(0.065, 0.22, 1800, this.sfxGain);
        this.synthSweep(460, 120, 0.075, "sawtooth", 0.22, this.sfxGain);
        break;
      case "mag_shotgun":
        this.synthKick(t, 0.45, this.sfxGain);
        this.synthNoise(0.18, 0.36, 950, this.sfxGain);
        break;
      case "piercing_rail":
        this.synthSweep(1500, 180, 0.22, "sawtooth", 0.34, this.sfxGain);
        this.synthNoise(0.14, 0.26, 3600, this.sfxGain);
        break;
      case "micro_missiles":
        this.synthNoise(0.22, 0.24, 1400, this.sfxGain);
        this.synthSweep(280, 620, 0.2, "triangle", 0.2, this.sfxGain);
        break;
    }
  }

  public playCqcSlash(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.synthNoise(0.11, 0.32, 3000, this.sfxGain);
    this.synthSweep(840, 110, 0.13, "sawtooth", 0.28, this.sfxGain);
  }

  public playEmpBlast(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.synthSweep(960, 62, 0.42, "sine", 0.35, this.sfxGain);
    this.synthSweep(420, 880, 0.18, "triangle", 0.16, this.sfxGain);
  }

  public playDecoyPing(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.synthSweep(1240, 1680, 0.09, "sine", 0.18, this.sfxGain);
  }

  public playExplosion(large = false): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const t = this.ctx.currentTime;
    this.synthKick(t, large ? 0.6 : 0.38, this.sfxGain);
    this.synthNoise(large ? 0.48 : 0.24, large ? 0.42 : 0.28, large ? 480 : 820, this.sfxGain);
  }

  public playHit(crit = false): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    if (crit) {
      this.synthSweep(1180, 1760, 0.08, "triangle", 0.24, this.sfxGain);
    } else {
      this.synthSweep(320, 140, 0.05, "square", 0.12, this.sfxGain);
    }
  }

  public playPlayerHurt(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.synthSweep(220, 70, 0.2, "sawtooth", 0.34, this.sfxGain);
    this.synthNoise(0.14, 0.2, 700, this.sfxGain);
  }

  public playBoxToggle(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.synthNoise(0.09, 0.16, 2200, this.sfxGain);
  }

  public playPowRescue(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => {
      window.setTimeout(() => {
        if (this.sfxGain) this.synthTone(n, "triangle", 0.14, 0.2, this.sfxGain, 2400);
      }, i * 65);
    });
  }

  public playCodecRing(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    [0, 110, 220].forEach((delay) => {
      window.setTimeout(() => {
        if (this.sfxGain) this.synthTone(1480, "sine", 0.07, 0.18, this.sfxGain, 2600);
      }, delay);
    });
  }

  public playCodecBlip(speaker: SpeakerId): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const base =
      speaker === "zero"
        ? 230
        : speaker === "control"
        ? 190
        : speaker === "sparx"
        ? 420
        : speaker === "mirror"
        ? 510
        : 360;
    const jitter = (Math.random() - 0.5) * 45;
    this.synthTone(base + jitter, speaker === "mirror" ? "sawtooth" : "triangle", 0.032, 0.07, this.sfxGain, 1500);
  }

  public playBossSplash(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    const t = this.ctx.currentTime;
    this.synthKick(t, 0.55, this.sfxGain);
    this.synthSweep(110, 55, 0.65, "sawtooth", 0.3, this.sfxGain);
    this.synthNoise(0.32, 0.25, 1100, this.sfxGain);
  }

  public playHackSuccess(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    [440, 660, 880].forEach((f, idx) => {
      window.setTimeout(() => {
        if (this.sfxGain) this.synthTone(f, "sine", 0.11, 0.18, this.sfxGain, 2000);
      }, idx * 55);
    });
  }

  public playUiClick(): void {
    if (!this.ctx || !this.sfxGain || this.muted) return;
    this.synthTone(720, "triangle", 0.04, 0.12, this.sfxGain, 2200);
  }

  // --- Low-level synth primitives ---

  private synthTone(
    freq: number,
    type: OscillatorType,
    duration: number,
    volume: number,
    dest: AudioNode,
    cutoff: number
  ): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, t);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private synthSweep(
    startFreq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    dest: AudioNode
  ): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private synthKick(t: number, volume: number, dest: AudioNode): void {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(145, t);
    osc.frequency.exponentialRampToValueAtTime(34, t + 0.14);
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  private synthNoise(duration: number, volume: number, cutoff: number, dest: AudioNode): void {
    if (!this.ctx || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(cutoff, t);
    filter.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}
