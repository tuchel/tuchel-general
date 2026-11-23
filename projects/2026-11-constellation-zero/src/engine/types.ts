export type MissionId = 1 | 2 | 3 | 4;
export type MissionMode = "foot" | "starship" | "eva";
export type AlertState = "UNSEEN" | "SUSPICIOUS" | "ALERT" | "EVASION" | "CAUTION";
export type RankGrade = "FOXHOUND" | "S" | "A" | "B" | "C";
export type EndingChoice = "purge" | "free";

export type WeaponId =
  | "silenced_rail"
  | "pulse_carbine"
  | "mag_shotgun"
  | "piercing_rail"
  | "micro_missiles";

export type SpeakerId = "zero" | "control" | "sparx" | "lark" | "mirror";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Platform extends Rect {
  kind: "solid" | "oneway" | "cover" | "vent" | "hazard" | "destructible";
  hp?: number;
  maxHp?: number;
  label?: string;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  shortName: string;
  damage: number;
  fireRate: number; // shots per second
  projectileSpeed: number;
  spread: number; // radians
  pellets: number;
  loud: boolean;
  noiseRadius: number;
  piercing?: boolean;
  homing?: boolean;
  critMultiplier: number;
  color: string;
  maxAmmo: number; // -1 for infinite
  pickupAmmo: number;
}

export interface CodecLine {
  speaker: SpeakerId;
  name: string;
  callsign: string;
  freq: string;
  text: string;
  glitch?: boolean;
}

export interface CodecScript {
  id: string;
  lines: CodecLine[];
  secret?: boolean;
}

export interface EnemyEntity {
  id: string;
  kind: "trooper" | "drone" | "camera" | "heavy" | "interceptor" | "turret";
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  facing: 1 | -1;
  patrolMinX: number;
  patrolMaxX: number;
  patrolY?: number;
  speed: number;
  visionRange: number;
  visionAngle: number; // half-angle in radians
  aimAngle: number;
  awareness: number; // 0..100
  state: "patrol" | "investigate" | "combat" | "stunned" | "dead";
  stunTimer: number;
  fireCooldown: number;
  investigateX: number;
  investigateTimer: number;
  alertedByReflex?: boolean;
  shielded?: boolean;
  sectorId?: string;
  disabledByHack?: boolean;
  animTime: number;
  hitFlash: number;
}

export interface PowHostage {
  id: string;
  name: string;
  x: number;
  y: number;
  rescued: boolean;
  dropWeapon: WeaponId;
  shardId: string;
  shardTitle: string;
  shardText: string;
  quip: string;
  animTime: number;
}

export interface HackNode {
  id: string;
  x: number;
  y: number;
  sectorId: string;
  hacked: boolean;
  label: string;
}

export interface LaserBarrier {
  id: string;
  x: number;
  y: number;
  h: number;
  period: number;
  duty: number; // fraction of period active
  phase: number;
  sectorId?: string;
  disabled: boolean;
}

export interface PickupItem {
  id: string;
  x: number;
  y: number;
  vy: number;
  kind: "medgel" | "emp" | "weapon";
  weaponId?: WeaponId;
  collected: boolean;
  bobTime: number;
}

export interface Checkpoint {
  id: string;
  x: number;
  y: number;
  reached: boolean;
}

export interface TriggerZone {
  id: string;
  x: number;
  w: number;
  codecId?: string;
  forceAlert?: boolean;
  bannerText?: string;
  triggered: boolean;
}

export interface DebrisHazard {
  id: string;
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  hp: number;
}

export interface BossEntity {
  id: "iron_gantry" | "valkyrie_09" | "mirror" | "lark_prime";
  name: string;
  subtitle: string;
  quote: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  phase: 1 | 2 | 3;
  maxPhases: number;
  active: boolean;
  defeated: boolean;
  stateTimer: number;
  attackIndex: number;
  attackTelegraph: number;
  vulnerableTimer: number;
  stunTimer: number;
  hitFlash: number;
  shieldAngle: number;
  hudGlitchTimer: number;
  clones: Array<{ x: number; y: number; hp: number; alpha: number }>;
  relays: Array<{ id: string; x: number; y: number; hp: number; maxHp: number; active: boolean }>;
  sweepingBeamAngle: number;
  sweepingBeamActive: boolean;
}

export interface Projectile {
  id: number;
  fromPlayer: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  color: string;
  radius: number;
  life: number;
  piercing?: boolean;
  homing?: boolean;
  emp?: boolean;
  decoy?: boolean;
  weaponId?: WeaponId;
  hitIds?: Set<string>;
  trail: Vec2[];
}

export interface MissionStats {
  missionId: MissionId;
  timeSeconds: number;
  alertsTriggered: number;
  reflexSaves: number;
  cqcTakedowns: number;
  powsRescued: number;
  powsTotal: number;
  damageTaken: number;
  enemiesNeutralized: number;
  score: number;
  rank: RankGrade;
  ghostBonus: boolean;
}

export interface MissionDef {
  id: MissionId;
  code: string;
  title: string;
  subtitle: string;
  location: string;
  mode: MissionMode;
  width: number;
  height: number;
  gravity: number;
  startPos: Vec2;
  bossTriggerX: number;
  bossArenaMinX: number;
  exitX: number;
  introCodecId: string;
  bossCodecId: string;
  outroCodecId: string;
  platforms: Platform[];
  enemies: Omit<EnemyEntity, "awareness" | "state" | "stunTimer" | "fireCooldown" | "investigateX" | "investigateTimer" | "animTime" | "hitFlash">[];
  pows: Omit<PowHostage, "rescued" | "animTime">[];
  hackNodes: Omit<HackNode, "hacked">[];
  lasers: Omit<LaserBarrier, "disabled">[];
  pickups: Omit<PickupItem, "vy" | "collected" | "bobTime">[];
  checkpoints: Omit<Checkpoint, "reached">[];
  triggers: Omit<TriggerZone, "triggered">[];
  bossSpec: {
    id: BossEntity["id"];
    name: string;
    subtitle: string;
    quote: string;
    x: number;
    y: number;
    w: number;
    h: number;
    maxHp: number;
    maxPhases: number;
  };
}

export interface SaveData {
  unlockedMission: MissionId;
  bestRanks: Partial<Record<MissionId, RankGrade>>;
  bestScores: Partial<Record<MissionId, number>>;
  shardsFound: string[];
  endingsSeen: EndingChoice[];
  unlocks: {
    opticalCamo: boolean;
    infinityBandana: boolean;
  };
  muted: boolean;
}
