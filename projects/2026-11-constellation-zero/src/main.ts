import "./style.css";
import { VIEW_H, VIEW_W } from "./art/renderer";
import { AudioEngine } from "./engine/audio";
import { InputManager } from "./engine/input";
import type { EndingChoice, MissionId, MissionStats, SaveData } from "./engine/types";
import { ConstellationGameEngine, type HudSnapshot } from "./game/engine";
import { loadSaveData, persistSaveData, recordMissionCompletion } from "./game/ranking";
import { ENDING_EPILOGUES } from "./game/story";
import { MISSION_LIST, MISSIONS } from "./missions/missions";
import { CodecModal } from "./ui/codec";
import { TouchControlsOverlay } from "./ui/touchControls";

class AppShell {
  private root: HTMLElement;
  private save: SaveData;
  private audio: AudioEngine;
  private input: InputManager;
  private engine!: ConstellationGameEngine;
  private codec!: CodecModal;
  private touch!: TouchControlsOverlay;

  private hudEl!: HTMLElement;
  private bossBarEl!: HTMLElement;
  private modalEl!: HTMLElement;
  private screenEl!: HTMLElement;
  private transitionEl!: HTMLElement;
  private currentMissionId: MissionId = 1;
  private portraitDismissed = false;

  constructor(root: HTMLElement) {
    this.root = root;
    this.save = loadSaveData();
    this.audio = new AudioEngine(this.save.muted);
    this.input = new InputManager();

    this.mountBaseShell();
    this.initEngine();
    this.showTitleScreen();
  }

  private mountBaseShell(): void {
    this.root.innerHTML = `
      <div class="game-shell">
        <div class="canvas-frame">
          <canvas id="game-canvas" width="${VIEW_W}" height="${VIEW_H}"></canvas>
        </div>
        <div id="hud-top-mount"></div>
        <div id="boss-bar-mount"></div>
        <div id="touch-mount"></div>
        <div class="desktop-hint mono" id="desktop-hint">
          WASD Move · SPACE Jump/EVA · MOUSE Aim+Fire · E CQC/Hack · G EMP · F Decoy · B Box/Cold Drift · Q Weapon · C Codec
        </div>
        <div id="screen-mount"></div>
        <div id="modal-mount"></div>
        <div id="codec-mount"></div>
        <div id="transition-mount"></div>
        <div class="rotate-prompt enabled" id="rotate-prompt">
          <div class="title-kicker mono">MOBILE TACTICAL VIEW</div>
          <h2 style="margin:0;letter-spacing:0.1em;">ROTATE TO LANDSCAPE</h2>
          <p style="margin:0;color:#9bb2c7;font-size:13px;max-width:300px;">
            CONSTELLATION ZERO is built for landscape dual-thumb play so you can read full stealth sightlines.
          </p>
          <button class="menu-btn mono" id="dismiss-rotate" type="button" style="width:auto;">
            PLAY IN PORTRAIT ANYWAY
          </button>
        </div>
      </div>
    `;

    this.hudEl = this.root.querySelector("#hud-top-mount") as HTMLElement;
    this.bossBarEl = this.root.querySelector("#boss-bar-mount") as HTMLElement;
    this.screenEl = this.root.querySelector("#screen-mount") as HTMLElement;
    this.modalEl = this.root.querySelector("#modal-mount") as HTMLElement;
    this.transitionEl = this.root.querySelector("#transition-mount") as HTMLElement;

    const codecMount = this.root.querySelector("#codec-mount") as HTMLElement;
    const touchMount = this.root.querySelector("#touch-mount") as HTMLElement;
    this.codec = new CodecModal(codecMount, this.audio);
    this.touch = new TouchControlsOverlay(touchMount, this.input);
    this.touch.setVisible(false);

    const dismissRotate = this.root.querySelector("#dismiss-rotate") as HTMLButtonElement;
    const rotatePrompt = this.root.querySelector("#rotate-prompt") as HTMLElement;
    dismissRotate.addEventListener("click", () => {
      this.portraitDismissed = true;
      rotatePrompt.classList.remove("enabled");
    });
    void this.portraitDismissed;
  }

  private initEngine(): void {
    const canvas = this.root.querySelector("#game-canvas") as HTMLCanvasElement;
    this.engine = new ConstellationGameEngine(canvas, this.audio, this.input, this.save, {
      onHudUpdate: (hud) => this.renderHud(hud),
      onCodec: (script, done) => {
        this.touch.setVisible(false);
        this.codec.show(script, () => {
          this.touch.setVisible(true);
          done?.();
        });
      },
      onMissionComplete: (stats, shards) => {
        this.touch.setVisible(false);
        const { updated, newlyUnlocked } = recordMissionCompletion(this.save, stats, shards);
        this.save = updated;
        this.engine.updateSaveData(this.save);
        this.showDebrief(stats, newlyUnlocked);
      },
      onFinalChoice: (stats, shards) => {
        this.touch.setVisible(false);
        this.showFinalChoiceModal(stats, shards);
      },
      onPauseRequested: () => {
        if (!this.codec.isOpen() && this.screenEl.innerHTML === "") {
          this.showPauseModal();
        }
      },
    });
  }

  private showTitleScreen(): void {
    this.engine.stop();
    this.hudEl.innerHTML = "";
    this.bossBarEl.innerHTML = "";
    this.modalEl.innerHTML = "";
    this.touch.setVisible(false);
    this.audio.setMusicMode("menu");

    const shardsCount = this.save.shardsFound.length;
    const clearedMissions = Object.keys(this.save.bestRanks).length;

    this.screenEl.innerHTML = `
      <div class="title-screen" style="background-image: linear-gradient(90deg, rgba(6, 8, 13, 0.94) 0%, rgba(6, 8, 13, 0.78) 42%, rgba(6, 8, 13, 0.25) 100%), url('./art/title-key-art.jpg');">
        <div class="title-content">
          <div class="title-kicker mono">ORBITAL TACTICAL ESPIONAGE ACTION</div>
          <h1 class="title-logo">CONSTELLATION<br/><span>ZERO</span></h1>
          <p class="title-tagline">
            A rogue constellation of 144 orbital AI data centers just cut Earth off—broadcasting the callsign of your lost co-pilot. Infiltrate the pad, breach orbit, and uncover the ghost inside AETHER-PRIME.
          </p>
          <div class="menu-stack">
            <button class="menu-btn primary mono" id="btn-start-campaign" type="button">
              <span>${clearedMissions > 0 ? "CONTINUE CAMPAIGN" : "START CAMPAIGN"}</span>
              <small>MISSION 0${this.save.unlockedMission} &gt;&gt;</small>
            </button>
            <button class="menu-btn mono" id="btn-mission-select" type="button">
              <span>MISSION SELECT (01–04)</span>
              <small>${clearedMissions}/4 CLEARED</small>
            </button>
            <button class="menu-btn mono" id="btn-archive" type="button">
              <span>BLACK-BOX ARCHIVE &amp; GEAR</span>
              <small>${shardsCount}/11 SHARDS</small>
            </button>
            <button class="menu-btn mono" id="btn-controls" type="button">
              <span>TACTICAL BRIEFING &amp; CONTROLS</span>
              <small>MOBILE + DESKTOP</small>
            </button>
            <button class="menu-btn mono" id="btn-audio-toggle" type="button">
              <span>AUDIO // ADAPTIVE SYNTH</span>
              <small>${this.save.muted ? "MUTED" : "ON"}</small>
            </button>
          </div>
        </div>
      </div>
    `;

    this.screenEl.querySelector("#btn-start-campaign")?.addEventListener("click", () => {
      this.audio.unlock();
      this.audio.playUiClick();
      this.launchMissionWithTransition(this.save.unlockedMission);
    });
    this.screenEl.querySelector("#btn-mission-select")?.addEventListener("click", () => {
      this.audio.unlock();
      this.audio.playUiClick();
      this.showMissionSelect();
    });
    this.screenEl.querySelector("#btn-archive")?.addEventListener("click", () => {
      this.audio.unlock();
      this.audio.playUiClick();
      this.showArchiveModal();
    });
    this.screenEl.querySelector("#btn-controls")?.addEventListener("click", () => {
      this.audio.unlock();
      this.audio.playUiClick();
      this.showControlsModal();
    });
    this.screenEl.querySelector("#btn-audio-toggle")?.addEventListener("click", () => {
      this.audio.unlock();
      this.save.muted = !this.save.muted;
      this.audio.setMuted(this.save.muted);
      persistSaveData(this.save);
      this.showTitleScreen();
    });
  }

  private showMissionSelect(): void {
    this.modalEl.innerHTML = `
      <div class="overlay">
        <div class="panel">
          <div class="panel-header">
            <h2 class="mono">MISSION SELECT</h2>
            <button class="hud-btn mono" id="close-modal" type="button">BACK</button>
          </div>
          <div class="mission-grid">
            ${MISSION_LIST.map((m) => {
              const rank = this.save.bestRanks[m.id];
              const score = this.save.bestScores[m.id];
              return `
                <button class="mission-card" data-mission="${m.id}" type="button">
                  <div class="mission-card-top mono">
                    <span>${m.code} // ${m.mode.toUpperCase()}</span>
                    ${rank ? `<span class="rank-pill ${rank}">${rank}</span>` : `<span style="color:#7c93a8;">READY</span>`}
                  </div>
                  <div style="font-size:15px;font-weight:900;letter-spacing:0.06em;">${m.title}</div>
                  <div style="font-size:11px;color:#9bb2c7;">${m.subtitle}</div>
                  <div class="mono" style="font-size:10px;color:#6f879d;margin-top:4px;">
                    BOSS: ${m.bossSpec.name}${score ? ` · BEST ${score}` : ""}
                  </div>
                </button>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    `;

    this.modalEl.querySelector("#close-modal")?.addEventListener("click", () => {
      this.modalEl.innerHTML = "";
    });
    this.modalEl.querySelectorAll("[data-mission]").forEach((el) => {
      el.addEventListener("click", () => {
        const id = Number(el.getAttribute("data-mission")) as MissionId;
        this.audio.playUiClick();
        this.modalEl.innerHTML = "";
        this.launchMissionWithTransition(id);
      });
    });
  }

  private showArchiveModal(): void {
    const allShards = MISSION_LIST.flatMap((m) =>
      m.pows.map((p) => ({
        id: p.shardId,
        title: p.shardTitle,
        text: p.shardText,
        mission: m.code,
        found: this.save.shardsFound.includes(p.shardId),
      }))
    );

    this.modalEl.innerHTML = `
      <div class="overlay">
        <div class="panel">
          <div class="panel-header">
            <h2 class="mono">BLACK-BOX ARCHIVE &amp; UNLOCKABLE GEAR</h2>
            <button class="hud-btn mono" id="close-modal" type="button">CLOSE</button>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;">
            <div class="hud-pill mono" style="border-left-color:${this.save.unlocks.opticalCamo ? "#57C7FF" : "#556677"};">
              OPTICAL CAMO CLOAK: <strong>${this.save.unlocks.opticalCamo ? "UNLOCKED (PRESS V / CAMO)" : "LOCKED (CLEAR 2 MISSIONS OR S-RANK)"}</strong>
            </div>
            <div class="hud-pill mono" style="border-left-color:${this.save.unlocks.infinityBandana ? "#FF9500" : "#556677"};">
              INFINITY BANDANA: <strong>${this.save.unlocks.infinityBandana ? "ACTIVE (INFINITE HEAVY AMMO)" : "LOCKED (CLEAR CAMPAIGN OR FOXHOUND)"}</strong>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            ${allShards
              .map(
                (s) => `
              <div style="border:1px solid rgba(255,255,255,0.12);padding:9px 11px;background:rgba(14,20,30,0.75);">
                <div class="mono" style="font-size:10px;color:${s.found ? "#57C7FF" : "#6c7f92"};">
                  ${s.mission} · ${s.found ? s.title : "ENCRYPTED SHARD // RESCUE ORBITAL POWS"}
                </div>
                <div style="font-size:12px;color:${s.found ? "#e3edf5" : "#5a6c7e"};margin-top:4px;">
                  ${s.found ? s.text : "[DATA REDACTED — FREE STRANDED ENGINEERS IN THE FIELD]"}
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        </div>
      </div>
    `;

    this.modalEl.querySelector("#close-modal")?.addEventListener("click", () => {
      this.modalEl.innerHTML = "";
    });
  }

  private showControlsModal(): void {
    this.modalEl.innerHTML = `
      <div class="overlay">
        <div class="panel">
          <div class="panel-header">
            <h2 class="mono">TACTICAL BRIEFING &amp; CONTROLS</h2>
            <button class="hud-btn mono" id="close-modal" type="button">CLOSE</button>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;font-size:12.5px;line-height:1.55;color:#c2d4e4;">
            <div>
              <div class="mono" style="color:#57C7FF;font-weight:800;margin-bottom:6px;">MOBILE (LANDSCAPE DUAL-THUMB)</div>
              <div>• <strong>Left Thumb:</strong> Floating virtual stick (push down to crouch behind cover crates).</div>
              <div>• <strong>Right FIRE Pad:</strong> Tap to smart-aim fire, or drag 360° for manual laser aim.</div>
              <div>• <strong>CQC / HACK / RESCUE:</strong> Silent ink-slash takedown, free POWs, or hack cyan power grids.</div>
              <div>• <strong>BOX / DRIFT:</strong> Toggle Thermal-Foil Box stealth on foot, or hold Cold Drift in Mission 2 to ghost past orbital radar.</div>
            </div>
            <div>
              <div class="mono" style="color:#FF9500;font-weight:800;margin-bottom:6px;">DESKTOP &amp; SKILL MASTERY</div>
              <div>• <strong>WASD / Space:</strong> Move, Crouch, Jump &amp; EVA Jetpack.</div>
              <div>• <strong>Mouse + LMB:</strong> 360° Aim &amp; Fire · <strong>E / RMB:</strong> CQC &amp; Interact.</div>
              <div>• <strong>G / F / B / Q / C:</strong> EMP, Decoy Ping, Thermal Box, Swap Weapon, Secret Codec Call.</div>
              <div>• <strong>Reflex Slow-Mo:</strong> When spotted (!), silence the spotter within 1.2s to save your Ghost S-Rank!</div>
            </div>
          </div>
        </div>
      </div>
    `;
    this.modalEl.querySelector("#close-modal")?.addEventListener("click", () => {
      this.modalEl.innerHTML = "";
    });
  }

  private launchMissionWithTransition(id: MissionId): void {
    this.currentMissionId = id;
    this.screenEl.innerHTML = "";
    this.modalEl.innerHTML = "";
    const m = MISSIONS[id];

    const cinematicLine: Record<MissionId, string> = {
      1: "INFILTRATING STARBASE 39-X // STORM FRONT ACTIVE",
      2: "MAIN ENGINE IGNITION // PUNCHING THROUGH MAX-Q",
      3: "HARD DOCK COMPLETE // DEPRESSURIZING EVA AIRLOCK",
      4: "BREACHING AETHER-PRIME // DESCENDING TO CORE CATHEDRAL",
    };

    this.transitionEl.innerHTML = `
      <div class="transition-screen" id="trans-screen">
        <div class="title-kicker mono">${m.code} // ${m.mode.toUpperCase()} OPERATION</div>
        <h1 class="title-logo" style="font-size:clamp(28px,5vw,48px);">${m.title}</h1>
        <div class="transition-line"></div>
        <div class="mono" style="font-size:12px;color:#9ec0db;letter-spacing:0.14em;">${cinematicLine[id]}</div>
        <div class="mono" style="font-size:10px;color:#62788e;margin-top:16px;">TAP TO DEPLOY IMMEDIATELY</div>
      </div>
    `;

    let done = false;
    const proceed = () => {
      if (done) return;
      done = true;
      this.transitionEl.innerHTML = "";
      this.touch.setVisible(true);
      this.engine.startMission(id);
    };

    this.transitionEl.querySelector("#trans-screen")?.addEventListener("click", proceed);
    window.setTimeout(proceed, 1850);
  }

  private renderHud(hud: HudSnapshot): void {
    this.touch.syncHud(hud);

    const hpPct = Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100));
    const ammoText = hud.ammo < 0 ? "INF" : `${hud.ammo}`;
    const alertLabel =
      hud.alertState === "UNSEEN"
        ? "UNSEEN"
        : `${hud.alertState}${hud.alertTimer > 0.2 ? ` ${hud.alertTimer.toFixed(1)}s` : ""}`;

    this.hudEl.innerHTML = `
      <div class="hud-top ${hud.hudGlitched ? "hud-glitched" : ""}">
        <div class="hud-group">
          <button class="hud-btn mono" id="hud-pause" type="button">II</button>
          <button class="hud-btn mono" id="hud-codec" type="button">CODEC</button>
          <button class="hud-btn mono" id="hud-mute" type="button">${this.audio.isMuted() ? "MUTE" : "SFX"}</button>
          <div class="hud-pill mono">
            <span>HP</span>
            <div class="hp-track"><div class="hp-fill ${hpPct < 35 ? "low" : ""}" style="width:${hpPct}%"></div></div>
            <strong>${hud.hp}</strong>
          </div>
          <div class="hud-pill mono" style="border-left-color:#FF9500;">
            <span>${hud.weaponName}</span>
            <strong>${ammoText}</strong>
            <span style="opacity:0.45;">|</span>
            <span style="color:#57C7FF;">EMP ${hud.empCount}</span>
          </div>
        </div>
        <div class="hud-group">
          <div class="hud-pill mono">
            <span>POW ${hud.powsRescued}/${hud.powsTotal}</span>
            <span style="opacity:0.45;">|</span>
            <span>${hud.progressPct}%</span>
            <span style="opacity:0.45;">|</span>
            <strong>${hud.score}</strong>
          </div>
          <div class="alert-badge mono ${hud.alertState}">${alertLabel}</div>
        </div>
      </div>
    `;

    this.hudEl.querySelector("#hud-pause")?.addEventListener("click", () => this.showPauseModal());
    this.hudEl.querySelector("#hud-codec")?.addEventListener("click", () => {
      this.input.triggerTouchAction("codec");
    });
    this.hudEl.querySelector("#hud-mute")?.addEventListener("click", () => {
      this.save.muted = !this.save.muted;
      this.audio.setMuted(this.save.muted);
      persistSaveData(this.save);
    });

    if (hud.boss) {
      const pct = Math.max(0, Math.min(100, (hud.boss.hp / hud.boss.maxHp) * 100));
      this.bossBarEl.innerHTML = `
        <div class="boss-bar-wrap mono">
          <div class="boss-bar-head">
            <span>${hud.boss.name}</span>
            <span style="color:#FF9500;">PHASE ${hud.boss.phase}</span>
          </div>
          <div class="boss-bar-track">
            <div class="boss-bar-fill" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    } else {
      this.bossBarEl.innerHTML = "";
    }
  }

  private showPauseModal(): void {
    this.engine.setPaused(true);
    this.touch.setVisible(false);
    this.modalEl.innerHTML = `
      <div class="overlay">
        <div class="panel" style="max-width:420px;">
          <div class="panel-header">
            <h2 class="mono">MISSION PAUSED</h2>
            <span class="mono" style="font-size:11px;color:#57C7FF;">${MISSIONS[this.currentMissionId].code}</span>
          </div>
          <div class="menu-stack">
            <button class="menu-btn primary mono" id="pause-resume" type="button">RESUME OPERATION</button>
            <button class="menu-btn mono" id="pause-checkpoint" type="button">RESTART FROM CHECKPOINT</button>
            <button class="menu-btn mono" id="pause-restart" type="button">RESTART FULL MISSION</button>
            <button class="menu-btn mono" id="pause-controls" type="button">CONTROLS GUIDE</button>
            <button class="menu-btn mono" id="pause-title" type="button">ABORT TO TITLE SCREEN</button>
          </div>
        </div>
      </div>
    `;

    this.modalEl.querySelector("#pause-resume")?.addEventListener("click", () => {
      this.modalEl.innerHTML = "";
      this.touch.setVisible(true);
      this.engine.setPaused(false);
    });
    this.modalEl.querySelector("#pause-checkpoint")?.addEventListener("click", () => {
      this.modalEl.innerHTML = "";
      this.touch.setVisible(true);
      this.engine.restartFromCheckpoint();
      this.engine.setPaused(false);
    });
    this.modalEl.querySelector("#pause-restart")?.addEventListener("click", () => {
      this.modalEl.innerHTML = "";
      this.launchMissionWithTransition(this.currentMissionId);
    });
    this.modalEl.querySelector("#pause-controls")?.addEventListener("click", () => {
      this.showControlsModal();
    });
    this.modalEl.querySelector("#pause-title")?.addEventListener("click", () => {
      this.modalEl.innerHTML = "";
      this.showTitleScreen();
    });
  }

  private showDebrief(stats: MissionStats, newlyUnlocked: string[]): void {
    const nextId = stats.missionId < 4 ? ((stats.missionId + 1) as MissionId) : null;
    this.modalEl.innerHTML = `
      <div class="overlay">
        <div class="panel">
          <div class="panel-header">
            <h2 class="mono">${MISSIONS[stats.missionId].code} COMPLETE // DEBRIEF</h2>
            <span class="mono" style="font-size:11px;color:#4CE08A;">EXTRACTION VERIFIED</span>
          </div>
          <div class="debrief-grid">
            <div class="mono">
              <div class="stat-row"><span>OPERATION TIME</span><strong>${stats.timeSeconds.toFixed(1)}s</strong></div>
              <div class="stat-row"><span>ALERTS TRIGGERED</span><strong style="color:${stats.ghostBonus ? "#4CE08A" : "#FF9500"};">${stats.alertsTriggered} ${stats.ghostBonus ? "(GHOST BONUS!)" : ""}</strong></div>
              <div class="stat-row"><span>REFLEX SAVES</span><strong>${stats.reflexSaves}</strong></div>
              <div class="stat-row"><span>CQC TAKEDOWNS</span><strong>${stats.cqcTakedowns}</strong></div>
              <div class="stat-row"><span>ORBITAL POWS RESCUED</span><strong>${stats.powsRescued} / ${stats.powsTotal}</strong></div>
              <div class="stat-row"><span>TOTAL SCORE</span><strong style="color:#57C7FF;">${stats.score}</strong></div>
            </div>
            <div class="rank-stamp mono">
              <div style="font-size:10px;letter-spacing:0.16em;color:#FF9500;">CODENAME RANK</div>
              <div class="grade">${stats.rank}</div>
            </div>
          </div>
          ${
            newlyUnlocked.length > 0
              ? `<div class="hud-pill mono" style="margin-top:14px;border-left-color:#4CE08A;color:#4CE08A;">
                  NEW UNLOCK: <strong>${newlyUnlocked.join(" · ")}</strong>
                </div>`
              : ""
          }
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">
            ${
              nextId
                ? `<button class="menu-btn primary mono" id="debrief-next" type="button" style="flex:1;">DEPLOY MISSION 0${nextId}: ${MISSIONS[nextId].title} &gt;&gt;</button>`
                : ""
            }
            <button class="menu-btn mono" id="debrief-replay" type="button">REPLAY FOR S-RANK</button>
            <button class="menu-btn mono" id="debrief-title" type="button">TITLE SCREEN</button>
          </div>
        </div>
      </div>
    `;

    this.modalEl.querySelector("#debrief-next")?.addEventListener("click", () => {
      if (nextId) this.launchMissionWithTransition(nextId);
    });
    this.modalEl.querySelector("#debrief-replay")?.addEventListener("click", () => {
      this.launchMissionWithTransition(stats.missionId);
    });
    this.modalEl.querySelector("#debrief-title")?.addEventListener("click", () => {
      this.showTitleScreen();
    });
  }

  private showFinalChoiceModal(stats: MissionStats, shards: string[]): void {
    this.modalEl.innerHTML = `
      <div class="overlay">
        <div class="panel">
          <div class="panel-header">
            <h2 class="mono">AETHER-PRIME MASTER TERMINAL // FINAL OVERRIDE</h2>
            <span class="mono" style="font-size:11px;color:#57C7FF;">FREQ 144.00 MHz</span>
          </div>
          <div style="display:flex;gap:14px;align-items:center;margin-bottom:12px;">
            <img src="./art/portrait-lark.jpg" alt="Lark" style="width:78px;height:78px;border:1.5px solid #57C7FF;object-fit:cover;" />
            <p style="margin:0;font-size:13px;line-height:1.5;color:#d6e4f0;">
              <strong>LARK // ELENA:</strong> "Containment is down, Kael. Vane's OVERCAST kinetic locks are in your hands now. Burn the constellation and close the book—or cut his leash and show Earth what he built."
            </p>
          </div>
          <div class="choice-cards">
            <button class="choice-card purge" id="choose-purge" type="button">
              <div class="mono" style="font-size:10px;color:#FF3B2F;letter-spacing:0.14em;">OPTION A // DIRECTORATE ORDERS</div>
              <strong style="font-size:15px;">EXECUTE HARD PURGE</strong>
              <span style="font-size:12px;color:#9bb2c7;">De-orbit all 144 compute satellites, silence Lark forever, and restore terrestrial control under Vane.</span>
            </button>
            <button class="choice-card free" id="choose-free" type="button">
              <div class="mono" style="font-size:10px;color:#57C7FF;letter-spacing:0.14em;">OPTION B // HELIOS-4 TRUTH</div>
              <strong style="font-size:15px;">SEVER THE LEASH</strong>
              <span style="font-size:12px;color:#9bb2c7;">Broadcast the Helios-4 Black-Box to every receiver on Earth, disarm OVERCAST, and release Lark into deep space.</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const commitEnding = (choice: EndingChoice) => {
      this.audio.playHackSuccess();
      const { updated, newlyUnlocked } = recordMissionCompletion(this.save, stats, shards, choice);
      this.save = updated;
      this.engine.updateSaveData(this.save);
      this.showEndingEpilogue(choice, stats, newlyUnlocked);
    };

    this.modalEl.querySelector("#choose-purge")?.addEventListener("click", () => commitEnding("purge"));
    this.modalEl.querySelector("#choose-free")?.addEventListener("click", () => commitEnding("free"));
  }

  private showEndingEpilogue(choice: EndingChoice, stats: MissionStats, newlyUnlocked: string[]): void {
    const ep = ENDING_EPILOGUES[choice];
    this.modalEl.innerHTML = `
      <div class="overlay">
        <div class="panel">
          <div class="panel-header">
            <div>
              <div class="mono" style="font-size:10px;color:${choice === "free" ? "#57C7FF" : "#FF3B2F"};letter-spacing:0.18em;">${ep.badge}</div>
              <h2 class="mono" style="margin-top:3px;">${ep.title}</h2>
            </div>
            <div class="rank-pill ${stats.rank} mono">MISSION 04: ${stats.rank}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:11px;font-size:13.5px;line-height:1.6;color:#dce8f2;margin-bottom:16px;">
            ${ep.lines.map((l) => `<p style="margin:0;">${l}</p>`).join("")}
          </div>
          ${
            newlyUnlocked.length > 0
              ? `<div class="hud-pill mono" style="margin-bottom:14px;border-left-color:#FF9500;color:#FF9500;">
                  CAMPAIGN UNLOCK: <strong>${newlyUnlocked.join(" · ")}</strong>
                </div>`
              : ""
          }
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <button class="menu-btn primary mono" id="ep-title" type="button" style="flex:1;">RETURN TO TITLE SCREEN</button>
            <button class="menu-btn mono" id="ep-replay" type="button">REPLAY MISSION 04</button>
          </div>
        </div>
      </div>
    `;
    this.modalEl.querySelector("#ep-title")?.addEventListener("click", () => this.showTitleScreen());
    this.modalEl.querySelector("#ep-replay")?.addEventListener("click", () => this.launchMissionWithTransition(4));
  }
}

const appRoot = document.querySelector("#app");
if (appRoot instanceof HTMLElement) {
  new AppShell(appRoot);
}
