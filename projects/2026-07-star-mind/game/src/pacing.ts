/**
 * Intensity Director — narrative pressure curves per level × goal.
 * See notes/pacing.md for the design source of truth.
 */
import type { LevelId } from "./types";

export interface IntensityKeyframe {
  /** Goal progress 0–1 */
  p: number;
  /** Target intensity 0–1 */
  v: number;
  /** Short beat label for CAPCOM / HUD */
  beat: string;
}

export interface GoalCurve {
  keys: IntensityKeyframe[];
  /** Concurrent fodder at intensity 1 */
  maxLiveAtPeak: number;
  /** Seconds between density spawns at intensity 1 (higher = calmer) */
  spawnPeriodAtPeak: number;
  /** Enemy kinds the density director may roll, light → heavy */
  light: string[];
  heavy: string[];
  /** Intensity above which heavies can roll */
  heavyFrom: number;
}

export interface IntensitySample {
  progress: number;
  intensity: number;
  beat: string;
  maxLive: number;
  spawnPeriod: number;
  aggression: number;
  allowHeavies: boolean;
}

/** Act-wide HP / damage / move multipliers. L1 is the teaching floor. */
export function actTier(level: LevelId): { hp: number; dmg: number; spd: number } {
  if (level === 1) return { hp: 1, dmg: 1, spd: 1 };
  if (level === 2) return { hp: 1.15, dmg: 1.2, spd: 1.12 };
  return { hp: 1.35, dmg: 1.35, spd: 1.08 };
}

const L1A: GoalCurve = {
  keys: [
    { p: 0.0, v: 0.15, beat: "COLD OPEN" },
    { p: 0.12, v: 0.4, beat: "FIRST CONTACT" },
    { p: 0.28, v: 0.2, beat: "ROAD LULL" },
    { p: 0.42, v: 0.65, beat: "CONVOY SPRINT" },
    { p: 0.58, v: 0.25, beat: "REGROUP" },
    { p: 0.72, v: 0.8, beat: "PAD APPROACH" },
    { p: 0.9, v: 0.55, beat: "TRENCH PEEL" },
    { p: 1.0, v: 0.1, beat: "PAD SECURE" },
  ],
  maxLiveAtPeak: 7,
  spawnPeriodAtPeak: 1.35,
  light: ["drone", "crab", "turret"],
  heavy: ["hackbot", "walker"],
  heavyFrom: 0.55,
};

const L1B: GoalCurve = {
  keys: [
    { p: 0.0, v: 0.2, beat: "CLIMB START" },
    { p: 0.25, v: 0.5, beat: "TOWER CONTACT" },
    { p: 0.45, v: 0.85, beat: "REAPER" },
    { p: 0.7, v: 1.0, beat: "REAPER PEAK" },
    { p: 0.88, v: 0.15, beat: "BOARD WINDOW" },
    { p: 1.0, v: 0.05, beat: "BOARDED" },
  ],
  maxLiveAtPeak: 5,
  spawnPeriodAtPeak: 1.8,
  light: ["drone", "climber", "crab"],
  heavy: ["walker"],
  heavyFrom: 0.6,
};

const L2A: GoalCurve = {
  keys: [
    { p: 0.0, v: 0.2, beat: "LIFTOFF" },
    { p: 0.18, v: 0.5, beat: "INTERCEPT" },
    { p: 0.32, v: 0.15, beat: "GATE BREATH" },
    { p: 0.48, v: 0.7, beat: "CLOUD SPRINT" },
    { p: 0.62, v: 0.2, beat: "MID LULL" },
    { p: 0.78, v: 0.75, beat: "PRE-SERAPH" },
    { p: 0.92, v: 0.3, beat: "CORRIDOR CLEAN" },
    { p: 1.0, v: 0.4, beat: "SERAPH STING" },
  ],
  maxLiveAtPeak: 6,
  spawnPeriodAtPeak: 1.22,
  light: ["climber", "wasp", "mine"],
  heavy: ["wasp", "tether", "mine"],
  heavyFrom: 0.5,
};

const L2B: GoalCurve = {
  keys: [
    { p: 0.0, v: 0.55, beat: "SERAPH" },
    { p: 0.35, v: 0.8, beat: "SERAPH MID" },
    { p: 0.6, v: 1.0, beat: "SERAPH PEAK" },
    { p: 0.7, v: 0.25, beat: "POST-KILL" },
    { p: 0.82, v: 0.4, beat: "CIRC BURN" },
    { p: 1.0, v: 0.5, beat: "LEO INSERT" },
  ],
  maxLiveAtPeak: 4,
  spawnPeriodAtPeak: 2.1,
  light: ["climber", "mine"],
  heavy: ["wasp", "tether"],
  heavyFrom: 0.65,
};

const L3A: GoalCurve = {
  keys: [
    { p: 0.0, v: 0.2, beat: "EVA OPEN" },
    { p: 0.18, v: 0.55, beat: "SPINE 1 PACK" },
    { p: 0.33, v: 0.15, beat: "SPINE 1 LULL" },
    { p: 0.48, v: 0.7, beat: "BEETLE SPRINT" },
    { p: 0.66, v: 0.2, beat: "SPINE 2 LULL" },
    { p: 0.82, v: 0.8, beat: "SPINE 3 ASSAULT" },
    { p: 1.0, v: 0.15, beat: "SPINES DOWN" },
  ],
  maxLiveAtPeak: 8,
  spawnPeriodAtPeak: 1.12,
  light: ["gridsat", "ghost", "tether"],
  heavy: ["beetle", "mirror", "tether"],
  heavyFrom: 0.42,
};

const L3B: GoalCurve = {
  keys: [
    { p: 0.0, v: 0.2, beat: "CAVITY APPROACH" },
    { p: 0.22, v: 0.7, beat: "PRIME CONTACT" },
    { p: 0.5, v: 0.9, beat: "PRIME MID" },
    { p: 0.8, v: 1.0, beat: "CORE PANIC" },
    { p: 1.0, v: 0.0, beat: "RUPTURE" },
  ],
  maxLiveAtPeak: 7,
  spawnPeriodAtPeak: 1.35,
  light: ["gridsat", "ghost", "tether"],
  heavy: ["beetle", "mirror"],
  heavyFrom: 0.5,
};

const CURVES: Record<LevelId, { a: GoalCurve; b: GoalCurve }> = {
  1: { a: L1A, b: L1B },
  2: { a: L2A, b: L2B },
  3: { a: L3A, b: L3B },
};

export function sampleCurve(keys: IntensityKeyframe[], p: number): { v: number; beat: string } {
  const t = Math.max(0, Math.min(1, p));
  if (keys.length === 0) return { v: 0.3, beat: "—" };
  if (t <= keys[0]!.p) return { v: keys[0]!.v, beat: keys[0]!.beat };
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]!;
    const b = keys[i + 1]!;
    if (t <= b.p) {
      const u = (t - a.p) / Math.max(1e-6, b.p - a.p);
      return { v: a.v + (b.v - a.v) * u, beat: u < 0.5 ? a.beat : b.beat };
    }
  }
  const last = keys[keys.length - 1]!;
  return { v: last.v, beat: last.beat };
}

export function goalCurve(levelId: LevelId, goalPhase: 1 | 2): GoalCurve {
  return goalPhase === 1 ? CURVES[levelId].a : CURVES[levelId].b;
}

export function sampleIntensity(
  levelId: LevelId,
  goalPhase: 1 | 2,
  progress: number,
): IntensitySample {
  const curve = goalCurve(levelId, goalPhase);
  const { v, beat } = sampleCurve(curve.keys, progress);
  const intensity = Math.max(0, Math.min(1, v));
  const maxLive = Math.max(
    0,
    Math.round(curve.maxLiveAtPeak * (0.15 + 0.85 * intensity)),
  );
  const spawnPeriod = curve.spawnPeriodAtPeak * (2.4 - 1.5 * intensity);
  const aggression = 0.65 + 0.55 * intensity;
  return {
    progress: Math.max(0, Math.min(1, progress)),
    intensity,
    beat,
    maxLive,
    spawnPeriod: Math.max(0.5, spawnPeriod),
    aggression,
    allowHeavies: intensity >= curve.heavyFrom,
  };
}

/** Pick a fodder kind for the density director */
export function rollDensityKind(
  levelId: LevelId,
  goalPhase: 1 | 2,
  intensity: number,
  rng = Math.random,
): string {
  const curve = goalCurve(levelId, goalPhase);
  const useHeavy = intensity >= curve.heavyFrom && rng() < 0.28 + intensity * 0.25;
  const pool = useHeavy ? curve.heavy : curve.light;
  return pool[Math.floor(rng() * pool.length)] ?? curve.light[0]!;
}

/**
 * Scripted set-piece beats — fire once when progress crosses `at`.
 * These are the authored "moments"; density director fills the gaps.
 */
export type ScriptBeat = {
  at: number;
  kind: string;
  z?: number;
  hop?: number;
  /** L1 uses absolute x; L2/L3 use cam-relative ahead */
  x?: number;
  announce?: string;
  /** Formation size (default 1) */
  n?: number;
  pattern?: "v" | "line";
};

export const SCRIPT_BEATS: Record<LevelId, { a: ScriptBeat[]; b: ScriptBeat[] }> = {
  1: {
    a: [
      { at: 0.02, kind: "drone", x: 480, z: 0.35, hop: 40 },
      { at: 0.08, kind: "drone", x: 560, z: 0.5, hop: 36, n: 3, pattern: "v" },
      { at: 0.14, kind: "crab", x: 640, z: 0.55 },
      { at: 0.3, kind: "turret", x: 900, z: 0.82, announce: "NIX: Turret nest — jump the lobs!" },
      { at: 0.4, kind: "walker", x: 1150, z: 0.5, announce: "NIX: Walker on the road — hit the REAR!" },
      { at: 0.44, kind: "hackbot", x: 1200, z: 0.4 },
      { at: 0.55, kind: "drone", x: 1500, z: 0.3, hop: 35, n: 2, pattern: "line" },
      { at: 0.7, kind: "walker", x: 1850, z: 0.55, announce: "NIX: Heavy contact — Pad 7 ahead!" },
      { at: 0.74, kind: "turret", x: 1920, z: 0.85 },
      { at: 0.78, kind: "crab", x: 2000, z: 0.35, n: 2, pattern: "line" },
      { at: 0.82, kind: "drone", x: 2100, z: 0.65, hop: 50 },
      { at: 0.86, kind: "hackbot", x: 2200, z: 0.45 },
    ],
    b: [
      { at: 0.1, kind: "drone", x: 2580, z: 0.45, hop: 40, n: 2, pattern: "v" },
      { at: 0.2, kind: "climber", x: 2650, z: 0.55, hop: 30 },
      { at: 0.35, kind: "drone", x: 2750, z: 0.4, hop: 55 },
    ],
  },
  2: {
    a: [
      { at: 0.05, kind: "climber", z: 0.3 },
      { at: 0.15, kind: "wasp", z: 0.6 },
      { at: 0.22, kind: "mine", z: 0.45, n: 3, pattern: "v", announce: "NIX: Mine cluster — one pop chains!" },
      { at: 0.4, kind: "climber", z: 0.7, n: 2, pattern: "line", announce: "NIX: Cloud deck hot!" },
      { at: 0.45, kind: "wasp", z: 0.25 },
      { at: 0.5, kind: "tether", z: 0.55, announce: "NIX: Tether mine — break the rope!" },
      { at: 0.72, kind: "climber", z: 0.35, announce: "NIX: Seraph's scouts — finish the gates!" },
      { at: 0.76, kind: "wasp", z: 0.7, n: 2, pattern: "line" },
      { at: 0.8, kind: "mine", z: 0.5, n: 2, pattern: "line" },
      { at: 0.84, kind: "wasp", z: 0.3 },
    ],
    b: [
      { at: 0.75, kind: "mine", z: 0.4 },
      { at: 0.85, kind: "tether", z: 0.55 },
      { at: 0.92, kind: "climber", z: 0.65 },
    ],
  },
  3: {
    a: [
      {
        at: 0.05,
        kind: "gridsat",
        z: 0.5,
        n: 3,
        pattern: "v",
        announce: "NIX: Grid volley — break the formation!",
      },
      { at: 0.12, kind: "ghost", z: 0.65 },
      { at: 0.22, kind: "mirror", z: 0.35 },
      { at: 0.4, kind: "beetle", z: 0.5, announce: "NIX: Repair Beetle — kill it first!" },
      { at: 0.45, kind: "tether", z: 0.4 },
      { at: 0.55, kind: "mirror", z: 0.4 },
      { at: 0.72, kind: "beetle", z: 0.55, announce: "NIX: Another beetle on the spine!" },
      { at: 0.78, kind: "gridsat", z: 0.3, n: 2, pattern: "line" },
      { at: 0.85, kind: "ghost", z: 0.7 },
      { at: 0.9, kind: "tether", z: 0.45 },
    ],
    b: [
      { at: 0.1, kind: "gridsat", z: 0.5 },
      { at: 0.3, kind: "ghost", z: 0.4 },
      { at: 0.55, kind: "beetle", z: 0.55 },
      { at: 0.75, kind: "gridsat", z: 0.35, n: 2, pattern: "v" },
    ],
  },
};

/** Authored twists keyed to goal progress (plus a few fired from combat hooks). */
export type SetPieceId =
  | "ambush-behind"
  | "walker-clamp"
  | "deck-slam"
  | "gate-drift"
  | "stage-sep"
  | "circ-drift"
  | "shear"
  | "beetle-rush"
  | "arena-shrink";

export type SetPiece = {
  id: SetPieceId;
  at: number;
  phase: 1 | 2;
};

export const SET_PIECES: Record<LevelId, SetPiece[]> = {
  1: [{ id: "ambush-behind", at: 0.28, phase: 1 }],
  2: [{ id: "gate-drift", at: 0.52, phase: 1 }],
  3: [
    { id: "shear", at: 0.34, phase: 1 },
    { id: "beetle-rush", at: 0.8, phase: 1 },
  ],
};
