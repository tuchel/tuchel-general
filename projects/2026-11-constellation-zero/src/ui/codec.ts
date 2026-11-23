import type { AudioEngine } from "../engine/audio";
import type { CodecScript, SpeakerId } from "../engine/types";

const PORTRAIT_MAP: Record<SpeakerId, string> = {
  zero: "./art/portrait-zero.jpg",
  control: "./art/portrait-control.jpg",
  sparx: "./art/portrait-sparx.jpg",
  lark: "./art/portrait-lark.jpg",
  mirror: "./art/portrait-mirror.jpg",
};

export class CodecModal {
  private root: HTMLElement;
  private audio: AudioEngine;
  private script: CodecScript | null = null;
  private lineIndex = 0;
  private charIndex = 0;
  private typeTimer: number | null = null;
  private onComplete?: () => void;
  private keyHandler: (e: KeyboardEvent) => void;

  constructor(container: HTMLElement, audio: AudioEngine) {
    this.root = container;
    this.audio = audio;
    this.keyHandler = (e: KeyboardEvent) => {
      if (!this.script) return;
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        this.advance();
      } else if (e.code === "Escape") {
        e.preventDefault();
        this.finish();
      }
    };
    window.addEventListener("keydown", this.keyHandler);
  }

  public show(script: CodecScript, onComplete?: () => void): void {
    this.script = script;
    this.lineIndex = 0;
    this.charIndex = 0;
    this.onComplete = onComplete;
    this.audio.playCodecRing();
    this.renderCurrentLine();
  }

  public isOpen(): boolean {
    return this.script !== null;
  }

  private renderCurrentLine(): void {
    if (!this.script) return;
    const line = this.script.lines[this.lineIndex];
    if (!line) {
      this.finish();
      return;
    }

    const otherSpeaker: SpeakerId =
      line.speaker === "zero"
        ? this.findNonZeroSpeaker()
        : line.speaker;

    const leftSpeaking = line.speaker !== "zero";
    const rightSpeaking = line.speaker === "zero";

    this.root.innerHTML = `
      <div class="codec-overlay" id="codec-overlay">
        <div class="codec-box ${line.glitch ? "glitch" : ""}">
          <div class="codec-portrait-wrap ${leftSpeaking ? "speaking" : "dim"}">
            <img class="codec-portrait" src="${PORTRAIT_MAP[otherSpeaker]}" alt="${otherSpeaker}" />
            <div class="codec-scanlines"></div>
          </div>
          <div class="codec-center">
            <div class="codec-meta mono">
              <span>${line.callsign} // ${line.name}</span>
              <span>FREQ ${line.freq} MHz</span>
            </div>
            <div class="codec-text" id="codec-text"></div>
            <div class="codec-footer mono">
              <span>TAP / SPACE TO CONTINUE (${this.lineIndex + 1}/${this.script.lines.length})</span>
              <button class="codec-skip mono" id="codec-skip-btn" type="button">SKIP &gt;&gt;</button>
            </div>
          </div>
          <div class="codec-portrait-wrap ${rightSpeaking ? "speaking" : "dim"}">
            <img class="codec-portrait" src="${PORTRAIT_MAP.zero}" alt="zero" />
            <div class="codec-scanlines"></div>
          </div>
        </div>
      </div>
    `;

    const overlay = this.root.querySelector("#codec-overlay") as HTMLElement;
    const skipBtn = this.root.querySelector("#codec-skip-btn") as HTMLButtonElement;
    const textEl = this.root.querySelector("#codec-text") as HTMLElement;

    overlay.addEventListener("click", (e) => {
      if (e.target === skipBtn) return;
      this.advance();
    });
    skipBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.finish();
    });

    this.charIndex = 0;
    this.stopTyping();
    this.typeTimer = window.setInterval(() => {
      this.charIndex += 2;
      if (this.charIndex >= line.text.length) {
        textEl.textContent = line.text;
        this.stopTyping();
      } else {
        textEl.textContent = line.text.slice(0, this.charIndex);
        if (this.charIndex % 6 === 0) {
          this.audio.playCodecBlip(line.speaker);
        }
      }
    }, 22);
  }

  private findNonZeroSpeaker(): SpeakerId {
    if (!this.script) return "control";
    for (let i = this.lineIndex; i >= 0; i--) {
      if (this.script.lines[i].speaker !== "zero") return this.script.lines[i].speaker;
    }
    for (const l of this.script.lines) {
      if (l.speaker !== "zero") return l.speaker;
    }
    return "control";
  }

  private advance(): void {
    if (!this.script) return;
    const line = this.script.lines[this.lineIndex];
    const textEl = this.root.querySelector("#codec-text");
    if (this.typeTimer !== null && line && textEl) {
      this.stopTyping();
      textEl.textContent = line.text;
      return;
    }
    this.lineIndex += 1;
    this.renderCurrentLine();
  }

  private stopTyping(): void {
    if (this.typeTimer !== null) {
      window.clearInterval(this.typeTimer);
      this.typeTimer = null;
    }
  }

  private finish(): void {
    this.stopTyping();
    this.script = null;
    this.root.innerHTML = "";
    const cb = this.onComplete;
    this.onComplete = undefined;
    cb?.();
  }
}
