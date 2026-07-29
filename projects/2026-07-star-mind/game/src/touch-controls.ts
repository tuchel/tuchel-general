/**
 * On-screen touch controls for mobile browsers.
 * Left virtual stick (strafe + depth) · right FIRE / JUMP / EMP · menu strip.
 *
 * Landscape: floats over playfield edges inside #game-shell.
 * Portrait: reparents under the canvas in #app so controls sit in a bottom sheet.
 */
import type { Input } from "./input";

export type TouchUiMode = "hidden" | "play" | "menu";

export class TouchControls {
  private root: HTMLElement;
  private stickZone: HTMLElement;
  private stickBase: HTMLElement;
  private stickKnob: HTMLElement;
  private btnFire: HTMLElement;
  private btnJump: HTMLElement;
  private btnEmp: HTMLElement;
  private menuBar: HTMLElement;
  private rotateHint: HTMLElement;
  private btnTitle: HTMLElement;

  private stickId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private mode: TouchUiMode = "hidden";
  private input: Input;
  private shellHost: HTMLElement;
  private appHost: HTMLElement | null;

  constructor(
    input: Input,
    shellHost: HTMLElement,
    appHost: HTMLElement | null = null,
  ) {
    this.input = input;
    this.shellHost = shellHost;
    this.appHost = appHost;

    this.root = document.createElement("div");
    this.root.id = "touch-layer";
    this.root.innerHTML = `
      <div class="touch-rotate-hint" id="touch-rotate">ROTATE DEVICE · landscape plays best</div>
      <div class="touch-stick-zone" id="stick-zone">
        <div class="touch-stick-base" id="stick-base">
          <div class="touch-stick-cross" aria-hidden="true"></div>
          <div class="touch-stick-knob" id="stick-knob"></div>
          <span class="touch-stick-label">MOVE</span>
        </div>
      </div>
      <div class="touch-btns" id="touch-btns">
        <button type="button" class="touch-btn touch-btn-emp" id="btn-emp" aria-label="EMP">EMP</button>
        <button type="button" class="touch-btn touch-btn-jump" id="btn-jump" aria-label="Jump">JUMP</button>
        <button type="button" class="touch-btn touch-btn-fire" id="btn-fire" aria-label="Fire">FIRE</button>
      </div>
      <div class="touch-menu" id="touch-menu">
        <button type="button" class="touch-menu-btn touch-menu-title" id="btn-menu-title" aria-label="Title">TITLE</button>
        <button type="button" class="touch-menu-btn" id="btn-menu-up" aria-label="Previous">▲</button>
        <button type="button" class="touch-menu-btn touch-menu-ok" id="btn-menu-ok" aria-label="Confirm">OK</button>
        <button type="button" class="touch-menu-btn" id="btn-menu-down" aria-label="Next">▼</button>
      </div>
    `;
    this.shellHost.appendChild(this.root);

    this.stickZone = this.root.querySelector("#stick-zone")!;
    this.stickBase = this.root.querySelector("#stick-base")!;
    this.stickKnob = this.root.querySelector("#stick-knob")!;
    this.btnFire = this.root.querySelector("#btn-fire")!;
    this.btnJump = this.root.querySelector("#btn-jump")!;
    this.btnEmp = this.root.querySelector("#btn-emp")!;
    this.menuBar = this.root.querySelector("#touch-menu")!;
    this.rotateHint = this.root.querySelector("#touch-rotate")!;
    this.btnTitle = this.root.querySelector("#btn-menu-title")!;

    this.bindStick();
    this.bindButton(this.btnFire, {
      down: () => this.input.setTouchShoot(true),
      up: () => this.input.setTouchShoot(false),
    });
    this.bindButton(this.btnJump, {
      down: () => this.input.setTouchJump(true),
      up: () => this.input.setTouchJump(false),
    });
    this.bindButton(this.btnEmp, {
      down: () => this.input.pulseTouchSpecial(),
      up: () => undefined,
    });
    this.bindPulse(this.root.querySelector("#btn-menu-up")!, () =>
      this.input.pulseTouchMenu(-1),
    );
    this.bindPulse(this.root.querySelector("#btn-menu-down")!, () =>
      this.input.pulseTouchMenu(1),
    );
    this.bindPulse(this.root.querySelector("#btn-menu-ok")!, () =>
      this.input.pulseTouchConfirm(),
    );
    this.bindPulse(this.btnTitle, () => this.input.pulseTouchBack());

    this.root.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
      },
      { passive: false },
    );
    this.root.addEventListener("contextmenu", (e) => e.preventDefault());

    this.setMode("menu");
    this.syncLayout();
  }

  setMode(
    mode: TouchUiMode,
    opts: { showBack?: boolean; showNav?: boolean } = {},
  ) {
    this.mode = mode;
    this.root.dataset.mode = mode;
    const play = mode === "play";
    const menu = mode === "menu";
    this.stickZone.classList.toggle("is-on", play);
    this.root.querySelector("#touch-btns")!.classList.toggle("is-on", play);
    this.menuBar.classList.toggle("is-on", menu);
    this.btnTitle.classList.toggle("is-on", menu && Boolean(opts.showBack));
    const showNav = menu && opts.showNav !== false;
    this.root.querySelector("#btn-menu-up")!.classList.toggle("is-on", showNav);
    this.root.querySelector("#btn-menu-down")!.classList.toggle("is-on", showNav);
    if (!play) {
      this.input.clearTouchCombat();
      this.resetKnob();
    }
  }

  syncOrientationHint() {
    const portrait = window.matchMedia("(orientation: portrait)").matches;
    this.rotateHint.classList.toggle("is-on", portrait && this.mode !== "hidden");
  }

  /** Reparent between shell overlay (landscape) and app sheet (portrait). */
  syncLayout() {
    const portrait = window.matchMedia("(orientation: portrait)").matches;
    const wantApp = portrait && this.appHost;
    const parent = this.root.parentElement;
    if (wantApp && this.appHost && parent !== this.appHost) {
      // Place after game-shell so it sits under the canvas in flex column
      const shell = this.appHost.querySelector("#game-shell");
      if (shell?.nextSibling) this.appHost.insertBefore(this.root, shell.nextSibling);
      else this.appHost.appendChild(this.root);
    } else if (!wantApp && parent !== this.shellHost) {
      this.shellHost.appendChild(this.root);
    }
    this.root.classList.toggle("touch-sheet", Boolean(wantApp));
    this.syncOrientationHint();
  }

  private bindPulse(el: Element, fn: () => void) {
    el.addEventListener(
      "pointerdown",
      (e) => {
        const pe = e as PointerEvent;
        pe.preventDefault();
        try {
          (pe.currentTarget as HTMLElement).setPointerCapture(pe.pointerId);
        } catch {
          /* ignore */
        }
        (pe.currentTarget as HTMLElement).classList.add("is-active");
        fn();
      },
      { passive: false },
    );
    const clear = (e: Event) => {
      (e.currentTarget as HTMLElement).classList.remove("is-active");
    };
    el.addEventListener("pointerup", clear);
    el.addEventListener("pointercancel", clear);
  }

  private bindButton(
    el: HTMLElement,
    handlers: { down: () => void; up: () => void },
  ) {
    const down = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      el.classList.add("is-active");
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      handlers.down();
    };
    const up = (e: PointerEvent) => {
      e.preventDefault();
      el.classList.remove("is-active");
      handlers.up();
    };
    el.addEventListener("pointerdown", down, { passive: false });
    el.addEventListener("pointerup", up, { passive: false });
    el.addEventListener("pointercancel", up, { passive: false });
    el.addEventListener("pointerleave", (e) => {
      if (el.hasPointerCapture(e.pointerId)) up(e);
    });
  }

  private stickRadius(): number {
    const w = this.stickBase.clientWidth || 118;
    return Math.max(36, w * 0.45);
  }

  private bindStick() {
    const onDown = (e: PointerEvent) => {
      if (this.mode !== "play") return;
      if (this.stickId !== null) return;
      e.preventDefault();
      this.stickId = e.pointerId;
      const rect = this.stickBase.getBoundingClientRect();
      this.stickOrigin = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      try {
        this.stickZone.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      this.updateStick(e.clientX, e.clientY);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      e.preventDefault();
      this.updateStick(e.clientX, e.clientY);
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== this.stickId) return;
      e.preventDefault();
      this.stickId = null;
      this.input.setTouchAxis(0, 0);
      this.resetKnob();
    };
    this.stickZone.addEventListener("pointerdown", onDown, { passive: false });
    this.stickZone.addEventListener("pointermove", onMove, { passive: false });
    this.stickZone.addEventListener("pointerup", onUp, { passive: false });
    this.stickZone.addEventListener("pointercancel", onUp, { passive: false });
  }

  private updateStick(cx: number, cy: number) {
    const radius = this.stickRadius();
    let dx = cx - this.stickOrigin.x;
    let dy = cy - this.stickOrigin.y;
    const len = Math.hypot(dx, dy) || 1;
    const mag = Math.min(1, len / radius);
    dx = (dx / len) * mag;
    dy = (dy / len) * mag;
    // Screen: right = +X strafe, up = farther Z (W)
    this.input.setTouchAxis(dx, -dy);
    this.stickKnob.style.transform = `translate(calc(-50% + ${dx * radius}px), calc(-50% + ${dy * radius}px))`;
  }

  private resetKnob() {
    this.stickKnob.style.transform = "translate(-50%, -50%)";
  }
}
