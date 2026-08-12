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
    cooldown: 0.22,
    speed: 520,
    color: "#F4D35E",
  },
  coil: {
    id: "coil",
    name: "COIL RIFLE",
    damage: 14,
    cooldown: 0.14,
    speed: 640,
    color: "#2EC4B6",
  },
  spread: {
    id: "spread",
    name: "SHARD CANNON",
    damage: 9,
    cooldown: 0.2,
    speed: 560,
    spread: 3,
    color: "#F4D35E",
  },
  beam: {
    id: "beam",
    name: "BEAM LANCE",
    damage: 6,
    cooldown: 0.05,
    speed: 900,
    pierce: true,
    heat: true,
    color: "#2EC4B6",
  },
  rocket: {
    id: "rocket",
    name: "MICRO-SPARROW",
    damage: 36,
    cooldown: 0.55,
    speed: 380,
    blast: 56,
    color: "#E85D04",
  },
  flame: {
    id: "flame",
    name: "TORCH PACK",
    damage: 5,
    cooldown: 0.04,
    speed: 280,
    color: "#E85D04",
  },
  rail: {
    id: "rail",
    name: "MAG-SPIKE",
    damage: 48,
    cooldown: 0.7,
    speed: 980,
    pierce: true,
    color: "#3A86FF",
  },
};
