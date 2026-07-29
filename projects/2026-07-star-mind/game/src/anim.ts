/**
 * Frame animation clips for 2.5D authored sprites.
 * Clips are horizontal strips OR discrete frame images keyed in ArtBank.
 */
export type AnimName =
  | "idle"
  | "walk"
  | "shoot"
  | "jump"
  | "hurt"
  | "hover"
  | "thrust"
  | "attack"
  | "phase2"
  | "phase3";

export interface AnimClip {
  /** Frame image ids relative to actor (resolved by AnimBank) */
  frames: string[];
  fps: number;
  loop: boolean;
}

export interface AnimPlayerState {
  clip: AnimName;
  time: number;
  lockedUntil: number;
}

export function createAnimState(clip: AnimName = "idle"): AnimPlayerState {
  return { clip, time: 0, lockedUntil: 0 };
}

export function playAnim(
  state: AnimPlayerState,
  clip: AnimName,
  lock = 0,
  force = false,
) {
  if (!force && state.lockedUntil > 0 && clip !== state.clip) return;
  if (state.clip !== clip) {
    state.clip = clip;
    state.time = 0;
  }
  if (lock > 0) state.lockedUntil = lock;
}

export function tickAnim(state: AnimPlayerState, dt: number) {
  state.time += dt;
  if (state.lockedUntil > 0) {
    state.lockedUntil = Math.max(0, state.lockedUntil - dt);
  }
}

export function animFrameIndex(
  state: AnimPlayerState,
  clip: AnimClip | undefined,
): number {
  if (!clip || clip.frames.length === 0) return 0;
  const frame = Math.floor(state.time * clip.fps);
  if (clip.loop) return frame % clip.frames.length;
  return Math.min(frame, clip.frames.length - 1);
}

/** Default clip libraries — frame ids match ArtBank keys under anim/ */
export const CLIPS: Record<string, Partial<Record<AnimName, AnimClip>>> = {
  ash: {
    idle: { frames: ["ash-idle-0", "ash-idle-1"], fps: 4, loop: true },
    walk: {
      frames: [
        "ash-walk-0",
        "ash-walk-1",
        "ash-walk-2",
        "ash-walk-3",
        "ash-walk-4",
        "ash-walk-5",
        "ash-walk-6",
        "ash-walk-7",
      ],
      fps: 12,
      loop: true,
    },
    shoot: {
      frames: ["ash-shoot-0", "ash-shoot-1", "ash-shoot-2"],
      fps: 14,
      loop: false,
    },
    jump: { frames: ["ash-jump-0", "ash-jump-1"], fps: 8, loop: true },
  },
  "ash-eva": {
    idle: { frames: ["ash-eva-idle-0", "ash-eva-idle-1"], fps: 5, loop: true },
    thrust: {
      frames: ["ash-eva-thrust-0", "ash-eva-thrust-1", "ash-eva-thrust-2"],
      fps: 12,
      loop: true,
    },
    shoot: {
      frames: ["ash-eva-shoot-0", "ash-eva-shoot-1"],
      fps: 12,
      loop: false,
    },
  },
  ship: {
    idle: { frames: ["ship-idle-0", "ship-idle-1"], fps: 6, loop: true },
    thrust: {
      frames: ["ship-thrust-0", "ship-thrust-1", "ship-thrust-2"],
      fps: 14,
      loop: true,
    },
    shoot: { frames: ["ship-shoot-0", "ship-shoot-1"], fps: 12, loop: false },
  },
  truck: {
    idle: { frames: ["truck-idle-0"], fps: 1, loop: true },
    walk: {
      frames: ["truck-move-0", "truck-move-1", "truck-move-2"],
      fps: 8,
      loop: true,
    },
  },
  drone: {
    hover: {
      frames: ["drone-hover-0", "drone-hover-1", "drone-hover-2"],
      fps: 8,
      loop: true,
    },
    attack: { frames: ["drone-fire-0", "drone-fire-1"], fps: 10, loop: false },
  },
  crab: {
    walk: {
      frames: ["crab-walk-0", "crab-walk-1", "crab-walk-2", "crab-walk-3"],
      fps: 8,
      loop: true,
    },
    attack: { frames: ["crab-leap-0", "crab-leap-1"], fps: 10, loop: false },
  },
  walker: {
    walk: {
      frames: ["walker-walk-0", "walker-walk-1", "walker-walk-2"],
      fps: 6,
      loop: true,
    },
    attack: { frames: ["walker-fire-0", "walker-fire-1"], fps: 8, loop: false },
  },
  wasp: {
    hover: {
      frames: ["wasp-hover-0", "wasp-hover-1", "wasp-hover-2"],
      fps: 10,
      loop: true,
    },
  },
  gridsat: {
    hover: {
      frames: ["gridsat-hover-0", "gridsat-hover-1"],
      fps: 5,
      loop: true,
    },
  },
  spine: {
    idle: {
      frames: ["spine-idle-0", "spine-idle-1", "spine-idle-2"],
      fps: 5,
      loop: true,
    },
  },
  beetle: {
    walk: {
      frames: ["beetle-walk-0", "beetle-walk-1", "beetle-walk-2"],
      fps: 8,
      loop: true,
    },
  },
  "boss-reaper": {
    idle: {
      frames: ["reaper-idle-0", "reaper-idle-1"],
      fps: 4,
      loop: true,
    },
    attack: {
      frames: ["reaper-claw-0", "reaper-claw-1", "reaper-claw-2"],
      fps: 8,
      loop: false,
    },
    phase2: {
      frames: ["reaper-laser-0", "reaper-laser-1"],
      fps: 8,
      loop: true,
    },
  },
  "boss-seraph": {
    idle: {
      frames: ["seraph-idle-0", "seraph-idle-1"],
      fps: 5,
      loop: true,
    },
    attack: {
      frames: ["seraph-dive-0", "seraph-dive-1", "seraph-dive-2"],
      fps: 10,
      loop: false,
    },
  },
  "boss-prime": {
    idle: {
      frames: ["prime-idle-0", "prime-idle-1", "prime-idle-2"],
      fps: 4,
      loop: true,
    },
    phase2: {
      frames: ["prime-petal-0", "prime-petal-1"],
      fps: 6,
      loop: true,
    },
    phase3: {
      frames: ["prime-core-0", "prime-core-1", "prime-core-2"],
      fps: 8,
      loop: true,
    },
  },
  turret: {
    idle: { frames: ["turret-idle-0", "turret-idle-1"], fps: 3, loop: true },
    attack: { frames: ["turret-fire-0", "turret-fire-1"], fps: 10, loop: false },
  },
  hackbot: {
    walk: {
      frames: ["hackbot-walk-0", "hackbot-walk-1", "hackbot-walk-2"],
      fps: 9,
      loop: true,
    },
  },
  mirror: {
    idle: {
      frames: ["mirror-idle-0", "mirror-idle-1"],
      fps: 4,
      loop: true,
    },
  },
  ghost: {
    hover: {
      frames: ["ghost-hover-0", "ghost-hover-1", "ghost-hover-2"],
      fps: 6,
      loop: true,
    },
  },
};
