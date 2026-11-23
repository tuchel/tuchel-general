import type { AlertState, EnemyEntity, Platform, Rect } from "../engine/types";

export interface StealthSample {
  playerX: number;
  playerY: number;
  playerW: number;
  playerH: number;
  crouching: boolean;
  inBox: boolean;
  boxMovedRecently: boolean;
  camoActive: boolean;
  coldDrift: boolean;
}

/**
 * Segment vs AABB intersection test (Liang-Barsky) to verify line-of-sight occlusion
 * against solid walls and cover crates.
 */
export function segmentIntersectsRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  r: Rect
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let t0 = 0;
  let t1 = 1;

  const p = [-dx, dx, -dy, dy];
  const q = [x1 - r.x, r.x + r.w - x1, y1 - r.y, r.y + r.h - y1];

  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return t0 <= t1;
}

export function hasLineOfSight(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  platforms: Platform[],
  playerCrouching: boolean
): boolean {
  for (const p of platforms) {
    if (p.kind === "solid" || p.kind === "destructible") {
      if (segmentIntersectsRect(x1, y1, x2, y2, p)) return false;
    } else if (p.kind === "cover" && playerCrouching) {
      // Crouching behind a server rack or crate breaks sightlines!
      if (segmentIntersectsRect(x1, y1, x2, y2, p)) return false;
    }
  }
  return true;
}

/**
 * Checks whether an enemy can see the player inside its vision cone,
 * returning visibility strength (0 = hidden, 0..1.5 = detection fill speed multiplier).
 */
export function evaluateEnemyVision(
  enemy: EnemyEntity,
  sample: StealthSample,
  platforms: Platform[]
): number {
  if (enemy.state === "dead" || enemy.state === "stunned" || enemy.disabledByHack) return 0;
  if (sample.camoActive) return 0;
  if (sample.coldDrift && enemy.kind === "interceptor") return 0;

  // Stationary inside thermal-foil box masks thermal/optical signature unless point-blank!
  const ex = enemy.x + enemy.w * 0.5;
  const ey = enemy.y + enemy.h * 0.32;
  const px = sample.playerX + sample.playerW * 0.5;
  const py = sample.playerY + (sample.crouching ? sample.playerH * 0.68 : sample.playerH * 0.35);

  const dx = px - ex;
  const dy = py - ey;
  const dist = Math.hypot(dx, dy);

  const effectiveRange = sample.coldDrift ? enemy.visionRange * 0.35 : enemy.visionRange;
  if (dist > effectiveRange) return 0;

  if (sample.inBox && !sample.boxMovedRecently && dist > 68) {
    return 0;
  }

  // Cone angle check
  const angleToPlayer = Math.atan2(dy, dx);
  let diff = angleToPlayer - enemy.aimAngle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;

  if (Math.abs(diff) > enemy.visionAngle) return 0;

  // Raycast occlusion check
  if (!hasLineOfSight(ex, ey, px, py, platforms, sample.crouching || sample.inBox)) {
    return 0;
  }

  // Closer targets fill awareness faster; crouching slightly slows detection at long range
  const proximity = 1 - dist / effectiveRange;
  const stanceFactor = sample.crouching ? 0.78 : 1.0;
  const boxPenalty = sample.inBox && sample.boxMovedRecently ? 1.35 : 1.0;
  return (0.65 + proximity * 1.15) * stanceFactor * boxPenalty;
}

export interface StealthControllerState {
  alertState: AlertState;
  alertTimer: number;
  evasionTimer: number;
  cautionTimer: number;
  reflexTimer: number;
  reflexSpotterId: string | null;
  alertsTriggered: number;
  reflexSaves: number;
}

export function createStealthState(): StealthControllerState {
  return {
    alertState: "UNSEEN",
    alertTimer: 0,
    evasionTimer: 0,
    cautionTimer: 0,
    reflexTimer: 0,
    reflexSpotterId: null,
    alertsTriggered: 0,
    reflexSaves: 0,
  };
}

/**
 * Triggers MGS V-style Reflex Slow-Mo when first spotted while not already in full ALERT.
 * Returns true if Reflex started (instead of immediate global alert).
 */
export function triggerSpotterDetection(
  state: StealthControllerState,
  spotterId: string,
  allowReflex = true
): "reflex" | "alert" {
  if (state.alertState === "ALERT") {
    state.alertTimer = 14;
    return "alert";
  }

  if (allowReflex && state.reflexTimer <= 0) {
    state.reflexTimer = 1.25;
    state.reflexSpotterId = spotterId;
    state.alertState = "SUSPICIOUS";
    return "reflex";
  }

  escalateToAlert(state);
  return "alert";
}

export function escalateToAlert(state: StealthControllerState): void {
  if (state.alertState !== "ALERT") {
    state.alertsTriggered += 1;
  }
  state.alertState = "ALERT";
  state.alertTimer = 14;
  state.evasionTimer = 0;
  state.cautionTimer = 0;
  state.reflexTimer = 0;
  state.reflexSpotterId = null;
}

/**
 * Called when an enemy is neutralized (killed or EMP-stunned). If that enemy was the active
 * Reflex spotter, cancels the impending alarm and awards a Reflex Save!
 */
export function notifyEnemyNeutralized(
  state: StealthControllerState,
  enemyId: string
): boolean {
  if (state.reflexTimer > 0 && state.reflexSpotterId === enemyId) {
    state.reflexTimer = 0;
    state.reflexSpotterId = null;
    state.reflexSaves += 1;
    state.alertState = state.cautionTimer > 0 ? "CAUTION" : "UNSEEN";
    return true;
  }
  return false;
}

/**
 * Advances timers (using real unscaled dt for reflexTimer so slow-mo feels crisp).
 */
export function updateStealthTimers(
  state: StealthControllerState,
  realDt: number,
  anyEnemySeeingPlayer: boolean,
  anyEnemyInvestigating: boolean
): { reflexExpiredToAlert: boolean } {
  let reflexExpiredToAlert = false;

  if (state.reflexTimer > 0) {
    state.reflexTimer -= realDt;
    if (state.reflexTimer <= 0) {
      escalateToAlert(state);
      reflexExpiredToAlert = true;
    }
    return { reflexExpiredToAlert };
  }

  if (state.alertState === "ALERT") {
    if (anyEnemySeeingPlayer) {
      state.alertTimer = 14;
    } else {
      state.alertTimer -= realDt;
      if (state.alertTimer <= 0) {
        state.alertState = "EVASION";
        state.evasionTimer = 8;
      }
    }
  } else if (state.alertState === "EVASION") {
    if (anyEnemySeeingPlayer) {
      state.alertState = "ALERT";
      state.alertTimer = 14;
    } else {
      state.evasionTimer -= realDt;
      if (state.evasionTimer <= 0) {
        state.alertState = "CAUTION";
        state.cautionTimer = 10;
      }
    }
  } else if (state.alertState === "CAUTION") {
    state.cautionTimer -= realDt;
    if (state.cautionTimer <= 0) {
      state.alertState = anyEnemyInvestigating ? "SUSPICIOUS" : "UNSEEN";
    }
  } else {
    state.alertState = anyEnemyInvestigating ? "SUSPICIOUS" : "UNSEEN";
  }

  return { reflexExpiredToAlert };
}
