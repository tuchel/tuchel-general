import { describe, expect, it } from "vitest";
import type { EnemyEntity, Platform } from "../engine/types";
import { MISSION_LIST } from "../missions/missions";
import { computeMissionStats, defaultSaveData, recordMissionCompletion } from "./ranking";
import {
  createStealthState,
  evaluateEnemyVision,
  notifyEnemyNeutralized,
  triggerSpotterDetection,
  updateStealthTimers,
} from "./stealth";
import { CODEC_SCRIPTS } from "./story";

function makeEnemy(overrides: Partial<EnemyEntity> = {}): EnemyEntity {
  return {
    id: "e1",
    kind: "trooper",
    x: 300,
    y: 416,
    w: 30,
    h: 52,
    vx: 0,
    vy: 0,
    hp: 60,
    maxHp: 60,
    facing: -1,
    patrolMinX: 200,
    patrolMaxX: 400,
    speed: 80,
    visionRange: 260,
    visionAngle: 0.4,
    aimAngle: Math.PI,
    awareness: 0,
    state: "patrol",
    stunTimer: 0,
    fireCooldown: 0,
    investigateX: 300,
    investigateTimer: 0,
    animTime: 0,
    hitFlash: 0,
    ...overrides,
  };
}

describe("Stealth vision & cover mechanics", () => {
  const coverCrate: Platform = { x: 200, y: 424, w: 50, h: 44, kind: "cover" };

  it("hides crouching player behind cover crate while spotting standing player", () => {
    const enemy = makeEnemy();
    const crouchingVis = evaluateEnemyVision(
      enemy,
      {
        playerX: 145,
        playerY: 416,
        playerW: 28,
        playerH: 52,
        crouching: true,
        inBox: false,
        boxMovedRecently: false,
        camoActive: false,
        coldDrift: false,
      },
      [coverCrate]
    );
    const standingVis = evaluateEnemyVision(
      enemy,
      {
        playerX: 145,
        playerY: 416,
        playerW: 28,
        playerH: 52,
        crouching: false,
        inBox: false,
        boxMovedRecently: false,
        camoActive: false,
        coldDrift: false,
      },
      [coverCrate]
    );

    expect(crouchingVis).toBe(0);
    expect(standingVis).toBeGreaterThan(0);
  });

  it("masks player stationary in Thermal-Foil Box but reveals them if moving inside it", () => {
    const enemy = makeEnemy();
    const stillBox = evaluateEnemyVision(
      enemy,
      {
        playerX: 150,
        playerY: 416,
        playerW: 28,
        playerH: 52,
        crouching: false,
        inBox: true,
        boxMovedRecently: false,
        camoActive: false,
        coldDrift: false,
      },
      []
    );
    const movingBox = evaluateEnemyVision(
      enemy,
      {
        playerX: 150,
        playerY: 416,
        playerW: 28,
        playerH: 52,
        crouching: false,
        inBox: true,
        boxMovedRecently: true,
        camoActive: false,
        coldDrift: false,
      },
      []
    );
    expect(stillBox).toBe(0);
    expect(movingBox).toBeGreaterThan(0);
  });

  it("masks starship from orbital interceptors during Cold Drift", () => {
    const interceptor = makeEnemy({ kind: "interceptor", visionRange: 300 });
    const coldVis = evaluateEnemyVision(
      interceptor,
      {
        playerX: 140,
        playerY: 416,
        playerW: 56,
        playerH: 30,
        crouching: false,
        inBox: false,
        boxMovedRecently: false,
        camoActive: false,
        coldDrift: true,
      },
      []
    );
    expect(coldVis).toBe(0);
  });
});

describe("Reflex Slow-Mo & Alert escalation", () => {
  it("cancels alarm and awards Reflex Save if spotter is neutralized during window", () => {
    const st = createStealthState();
    const outcome = triggerSpotterDetection(st, "guard_1", true);
    expect(outcome).toBe("reflex");
    expect(st.reflexTimer).toBeGreaterThan(0);
    expect(st.alertsTriggered).toBe(0);

    const saved = notifyEnemyNeutralized(st, "guard_1");
    expect(saved).toBe(true);
    expect(st.reflexSaves).toBe(1);
    expect(st.alertsTriggered).toBe(0);
    expect(st.alertState).toBe("UNSEEN");
  });

  it("escalates to full ALERT when Reflex timer expires", () => {
    const st = createStealthState();
    triggerSpotterDetection(st, "guard_1", true);
    const res = updateStealthTimers(st, 1.5, true, false);
    expect(res.reflexExpiredToAlert).toBe(true);
    expect(st.alertState).toBe("ALERT");
    expect(st.alertsTriggered).toBe(1);
  });
});

describe("FOXHOUND Ranking, Unlocks & Campaign Integrity", () => {
  it("awards FOXHOUND rank on ghost full-POW run and unlocks Infinity Bandana", () => {
    const stats = computeMissionStats({
      missionId: 1,
      timeSeconds: 95,
      alertsTriggered: 0,
      reflexSaves: 2,
      cqcTakedowns: 3,
      powsRescued: 3,
      powsTotal: 3,
      damageTaken: 10,
      enemiesNeutralized: 7,
      baseScore: 2200,
    });
    expect(stats.rank).toBe("FOXHOUND");
    expect(stats.ghostBonus).toBe(true);

    const { updated, newlyUnlocked } = recordMissionCompletion(defaultSaveData(), stats, ["shard_01"]);
    expect(updated.unlockedMission).toBe(2);
    expect(updated.unlocks.opticalCamo).toBe(true);
    expect(updated.unlocks.infinityBandana).toBe(true);
    expect(newlyUnlocked.length).toBe(2);
  });

  it("verifies all 4 missions have valid Codec links and unique Black-Box shards", () => {
    expect(MISSION_LIST.length).toBe(4);
    const shardIds = new Set<string>();
    for (const m of MISSION_LIST) {
      expect(CODEC_SCRIPTS[m.introCodecId]).toBeDefined();
      expect(CODEC_SCRIPTS[m.bossCodecId]).toBeDefined();
      expect(m.exitX).toBeGreaterThan(m.bossTriggerX);
      for (const pow of m.pows) {
        expect(shardIds.has(pow.shardId)).toBe(false);
        shardIds.add(pow.shardId);
      }
    }
    expect(shardIds.size).toBe(11);
  });
});
