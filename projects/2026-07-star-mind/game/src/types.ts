export type WeaponId =
  | "pistol"
  | "coil"
  | "spread"
  | "beam"
  | "rocket"
  | "flame"
  | "rail";

export type LevelId = 1 | 2 | 3;

export type Mode =
  | "title"
  | "howto"
  | "briefing"
  | "upgrade"
  | "play"
  | "boss"
  | "pause"
  | "clear"
  | "dead"
  | "victory";

export interface Vec {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Upgrades {
  damage: number;
  fireRate: number;
  armor: number;
  mag: number;
  special: number;
  mobility: number;
}

export type Difficulty = "rookie" | "veteran" | "arcade";

export const DIFFICULTIES: Difficulty[] = ["rookie", "veteran", "arcade"];

/** Multipliers layered on top of the act tier. Arcade pays more score for less HP. */
export const DIFFICULTY_TIER: Record<
  Difficulty,
  { label: string; hp: number; dmg: number; spd: number; playerHp: number; score: number; blurb: string }
> = {
  rookie: { label: "ROOKIE", hp: 0.8, dmg: 0.7, spd: 0.94, playerHp: 1.35, score: 0.8, blurb: "More HP, softer hits. Learn the lanes." },
  veteran: { label: "VETERAN", hp: 1, dmg: 1, spd: 1, playerHp: 1, score: 1, blurb: "The intended run." },
  arcade: { label: "ARCADE", hp: 1.25, dmg: 1.35, spd: 1.08, playerHp: 0.6, score: 1.5, blurb: "Glass Ash, ×1.5 score. Bring quarters." },
};

export const defaultUpgrades = (): Upgrades => ({
  damage: 0,
  fireRate: 0,
  armor: 0,
  mag: 0,
  special: 0,
  mobility: 0,
});

export interface WeaponDef {
  id: WeaponId;
  name: string;
  damage: number;
  cooldown: number;
  speed: number;
  spread?: number;
  pierce?: boolean;
  blast?: number;
  heat?: boolean;
  color: string;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: "pistol",
    name: "SIDEARM",
    damage: 8,
    cooldown: 0.18,
    speed: 520,
    color: "#F4D35E",
  },
  coil: {
    id: "coil",
    name: "COIL RIFLE",
    damage: 14,
    cooldown: 0.12,
    speed: 640,
    color: "#2EC4B6",
  },
  spread: {
    id: "spread",
    name: "SHARD CANNON",
    damage: 9,
    cooldown: 0.16,
    speed: 560,
    spread: 3,
    color: "#F4D35E",
  },
  beam: {
    id: "beam",
    name: "BEAM LANCE",
    damage: 6,
    cooldown: 0.04,
    speed: 900,
    pierce: true,
    heat: true,
    color: "#2EC4B6",
  },
  rocket: {
    id: "rocket",
    name: "MICRO-SPARROW",
    damage: 36,
    cooldown: 0.46,
    speed: 380,
    blast: 56,
    color: "#E85D04",
  },
  flame: {
    id: "flame",
    name: "TORCH PACK",
    damage: 5,
    cooldown: 0.032,
    speed: 280,
    color: "#E85D04",
  },
  rail: {
    id: "rail",
    name: "MAG-SPIKE",
    damage: 48,
    cooldown: 0.58,
    speed: 980,
    pierce: true,
    color: "#3A86FF",
  },
};
