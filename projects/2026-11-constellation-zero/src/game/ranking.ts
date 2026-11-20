import type { EndingChoice, MissionId, MissionStats, RankGrade, SaveData } from "../engine/types";

const STORAGE_KEY = "constellation_zero_save_v1";

const RANK_ORDER: Record<RankGrade, number> = {
  FOXHOUND: 5,
  S: 4,
  A: 3,
  B: 2,
  C: 1,
};

export function computeMissionStats(params: {
  missionId: MissionId;
  timeSeconds: number;
  alertsTriggered: number;
  reflexSaves: number;
  cqcTakedowns: number;
  powsRescued: number;
  powsTotal: number;
  damageTaken: number;
  enemiesNeutralized: number;
  baseScore: number;
}): MissionStats {
  const ghostBonus = params.alertsTriggered === 0;
  const parTime = params.missionId === 2 ? 120 : 195;
  const speedBonus = Math.max(0, Math.round((parTime - params.timeSeconds) * 18));
  const stealthBonus = ghostBonus ? 3000 : Math.max(0, 1200 - params.alertsTriggered * 450);
  const powBonus = params.powsRescued * 900;
  const reflexBonus = params.reflexSaves * 500;
  const cqcBonus = params.cqcTakedowns * 300;
  const noDamageBonus = params.damageTaken === 0 ? 2000 : 0;

  const totalScore = Math.max(
    500,
    params.baseScore + speedBonus + stealthBonus + powBonus + reflexBonus + cqcBonus + noDamageBonus
  );

  let rank: RankGrade = "C";
  if (ghostBonus && params.powsRescued >= params.powsTotal && params.damageTaken <= 35 && totalScore >= 6500) {
    rank = "FOXHOUND";
  } else if (totalScore >= 5800 && params.alertsTriggered <= 1) {
    rank = "S";
  } else if (totalScore >= 4200) {
    rank = "A";
  } else if (totalScore >= 2600) {
    rank = "B";
  }

  return {
    missionId: params.missionId,
    timeSeconds: params.timeSeconds,
    alertsTriggered: params.alertsTriggered,
    reflexSaves: params.reflexSaves,
    cqcTakedowns: params.cqcTakedowns,
    powsRescued: params.powsRescued,
    powsTotal: params.powsTotal,
    damageTaken: params.damageTaken,
    enemiesNeutralized: params.enemiesNeutralized,
    score: totalScore,
    rank,
    ghostBonus,
  };
}

export function defaultSaveData(): SaveData {
  return {
    unlockedMission: 1,
    bestRanks: {},
    bestScores: {},
    shardsFound: [],
    endingsSeen: [],
    unlocks: {
      opticalCamo: false,
      infinityBandana: false,
    },
    muted: false,
  };
}

export function loadSaveData(): SaveData {
  if (typeof window === "undefined" || !window.localStorage) return defaultSaveData();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSaveData();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...defaultSaveData(),
      ...parsed,
      unlocks: {
        ...defaultSaveData().unlocks,
        ...(parsed.unlocks || {}),
      },
    };
  } catch {
    return defaultSaveData();
  }
}

export function persistSaveData(data: SaveData): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors in restricted browsers
  }
}

export function recordMissionCompletion(
  save: SaveData,
  stats: MissionStats,
  newShards: string[],
  ending?: EndingChoice
): { updated: SaveData; newlyUnlocked: string[] } {
  const updated: SaveData = {
    ...save,
    bestRanks: { ...save.bestRanks },
    bestScores: { ...save.bestScores },
    shardsFound: Array.from(new Set([...save.shardsFound, ...newShards])),
    endingsSeen: ending
      ? Array.from(new Set([...save.endingsSeen, ending]))
      : [...save.endingsSeen],
    unlocks: { ...save.unlocks },
  };

  if (stats.missionId < 4 && updated.unlockedMission < stats.missionId + 1) {
    updated.unlockedMission = (stats.missionId + 1) as MissionId;
  }

  const prevRank = updated.bestRanks[stats.missionId];
  if (!prevRank || RANK_ORDER[stats.rank] > RANK_ORDER[prevRank]) {
    updated.bestRanks[stats.missionId] = stats.rank;
  }

  const prevScore = updated.bestScores[stats.missionId] ?? 0;
  if (stats.score > prevScore) {
    updated.bestScores[stats.missionId] = stats.score;
  }

  const newlyUnlocked: string[] = [];
  const clearedCount = Object.keys(updated.bestRanks).length;
  const hasHighRank = Object.values(updated.bestRanks).some(
    (r) => r === "S" || r === "FOXHOUND"
  );
  const hasFoxhound = Object.values(updated.bestRanks).some((r) => r === "FOXHOUND");

  if (!updated.unlocks.opticalCamo && (hasHighRank || clearedCount >= 2)) {
    updated.unlocks.opticalCamo = true;
    newlyUnlocked.push("OPTICAL CAMO CLOAK");
  }
  if (!updated.unlocks.infinityBandana && (hasFoxhound || stats.missionId === 4)) {
    updated.unlocks.infinityBandana = true;
    newlyUnlocked.push("INFINITY BANDANA (UNLIMITED HEAVY AMMO)");
  }

  persistSaveData(updated);
  return { updated, newlyUnlocked };
}
