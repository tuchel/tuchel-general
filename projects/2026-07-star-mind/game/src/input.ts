/**
 * Unified input — keyboard (desktop) + virtual controls (mobile).
 * Game code only talks to this API; both backends can be active at once.
 */

export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();

  /** Virtual stick −1…1 */
  private touchX = 0;
  private touchZ = 0;
  private touchShoot = false;
  private touchJumpHeld = false;
  private touchJumpEdge = false;
  private touchSpecialEdge = false;
  private touchConfirmEdge = false;
  private touchBackEdge = false;
  private touchPauseEdge = false;
  private touchMenuEdge = 0; // -1 | 0 | 1

  /** Gamepad backend — standard mapping; polled once per frame. */
  private padX = 0;
  private padZ = 0;
  private padShoot = false;
  private padJumpHeld = false;
  private padJumpEdge = false;
  private padSpecialEdge = false;
  private padConfirmEdge = false;
  private padBackEdge = false;
  private padPauseEdge = false;
  private padMenuEdge = 0;
  private padPrev = new Set<number>();

  constructor() {
    window.addEventListener(
      "keydown",
      (e) => {
        const k = e.key.toLowerCase();
        if (
          [
            "arrowup",
            "arrowdown",
            "arrowleft",
            "arrowright",
            " ",
            "w",
            "a",
            "s",
            "d",
            "j",
            "k",
            "z",
            "x",
            "enter",
            "escape",
            "p",
          ].includes(k) ||
          e.code === "Space"
        ) {
          e.preventDefault();
        }
        const key = e.code === "Space" ? " " : k;
        if (!this.down.has(key)) this.pressed.add(key);
        this.down.add(key);
      },
      { passive: false },
    );
    window.addEventListener("keyup", (e) => {
      const key = e.code === "Space" ? " " : e.key.toLowerCase();
      this.down.delete(key);
    });
    window.addEventListener("blur", () => {
      this.down.clear();
      this.pressed.clear();
      this.clearTouchCombat();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.down.clear();
        this.pressed.clear();
        this.clearTouchCombat();
      }
    });
  }

  /** Called each frame after Game.update — clears edge triggers */
  tick() {
    this.pressed.clear();
    this.touchJumpEdge = false;
    this.touchSpecialEdge = false;
    this.touchConfirmEdge = false;
    this.touchBackEdge = false;
    this.touchPauseEdge = false;
    this.touchMenuEdge = 0;
    this.padJumpEdge = false;
    this.padSpecialEdge = false;
    this.padConfirmEdge = false;
    this.padBackEdge = false;
    this.padPauseEdge = false;
    this.padMenuEdge = 0;
  }

  /**
   * Standard-mapping gamepad: left stick / d-pad move, A jump, X or RT fire, B / Y / RB EMP,
   * Start pause, Select back. Edges are computed here against the previous poll.
   */
  pollGamepad() {
    const pads = typeof navigator !== "undefined" && navigator.getGamepads ? navigator.getGamepads() : null;
    const pad = pads ? Array.from(pads).find((p) => p && p.connected) : null;
    if (!pad) {
      if (this.padPrev.size || this.padX || this.padZ || this.padShoot || this.padJumpHeld) {
        this.padPrev.clear();
        this.padX = 0;
        this.padZ = 0;
        this.padShoot = false;
        this.padJumpHeld = false;
      }
      return;
    }
    const down = new Set<number>();
    pad.buttons.forEach((b, i) => {
      if (b.pressed || b.value > 0.5) down.add(i);
    });
    const edge = (i: number) => down.has(i) && !this.padPrev.has(i);
    const dead = 0.22;
    let x = pad.axes[0] ?? 0;
    let y = pad.axes[1] ?? 0;
    if (Math.abs(x) < dead) x = 0;
    if (Math.abs(y) < dead) y = 0;
    if (down.has(14)) x = -1;
    if (down.has(15)) x = 1;
    if (down.has(12)) y = -1;
    if (down.has(13)) y = 1;
    this.padX = Math.max(-1, Math.min(1, x));
    this.padZ = Math.max(-1, Math.min(1, -y));
    this.padShoot = down.has(2) || down.has(7) || down.has(5);
    const jump = down.has(0);
    if (jump && !this.padJumpHeld) this.padJumpEdge = true;
    this.padJumpHeld = jump;
    if (edge(1) || edge(3) || edge(4) || edge(6)) this.padSpecialEdge = true;
    if (edge(0) || edge(2)) this.padConfirmEdge = true;
    if (edge(1) || edge(8)) this.padBackEdge = true;
    if (edge(9)) this.padPauseEdge = true;
    if (edge(12)) this.padMenuEdge = -1;
    if (edge(13)) this.padMenuEdge = 1;
    this.padPrev = down;
  }

  // --- Touch backend API (used by touch-controls.ts) ---

  setTouchAxis(x: number, z: number) {
    const dead = 0.18;
    const nx = Math.max(-1, Math.min(1, x));
    const nz = Math.max(-1, Math.min(1, z));
    this.touchX = Math.abs(nx) < dead ? 0 : nx;
    this.touchZ = Math.abs(nz) < dead ? 0 : nz;
  }

  setTouchShoot(down: boolean) {
    this.touchShoot = down;
  }

  setTouchJump(down: boolean) {
    if (down && !this.touchJumpHeld) this.touchJumpEdge = true;
    this.touchJumpHeld = down;
  }

  pulseTouchSpecial() {
    this.touchSpecialEdge = true;
  }

  pulseTouchConfirm() {
    this.touchConfirmEdge = true;
  }

  pulseTouchBack() {
    this.touchBackEdge = true;
  }

  pulseTouchPause() {
    this.touchPauseEdge = true;
  }

  pulseTouchMenu(dir: -1 | 1) {
    this.touchMenuEdge = dir;
  }

  clearTouchCombat() {
    this.touchX = 0;
    this.touchZ = 0;
    this.touchShoot = false;
    this.touchJumpHeld = false;
  }

  // --- Shared query API ---

  hold(key: string) {
    return this.down.has(key);
  }

  just(key: string) {
    return this.pressed.has(key);
  }

  axisX() {
    let x = 0;
    if (this.hold("a") || this.hold("arrowleft")) x -= 1;
    if (this.hold("d") || this.hold("arrowright")) x += 1;
    if (x === 0) x = this.touchX;
    if (x === 0) x = this.padX;
    return Math.max(-1, Math.min(1, x));
  }

  axisZ() {
    let z = 0;
    if (this.hold("w") || this.hold("arrowup")) z += 1;
    if (this.hold("s") || this.hold("arrowdown")) z -= 1;
    if (z === 0) z = this.touchZ;
    if (z === 0) z = this.padZ;
    return Math.max(-1, Math.min(1, z));
  }

  axisY() {
    return -this.axisZ();
  }

  jumpJust() {
    return this.just(" ") || this.touchJumpEdge || this.padJumpEdge;
  }

  jumpHeld() {
    return this.hold(" ") || this.touchJumpHeld || this.padJumpHeld;
  }

  /** P / II / Start — does not include Escape (Escape pauses in play, quits from pause). */
  pauseJust() {
    return this.just("p") || this.touchPauseEdge || this.padPauseEdge;
  }

  shoot() {
    return this.hold("j") || this.hold("z") || this.touchShoot || this.padShoot;
  }

  specialJust() {
    return this.just("k") || this.just("x") || this.touchSpecialEdge || this.padSpecialEdge;
  }

  confirm() {
    return (
      this.just("enter") ||
      this.just(" ") ||
      this.just("j") ||
      this.touchConfirmEdge ||
      this.padConfirmEdge
    );
  }

  /** Escape / title return (keyboard Escape, touch TITLE, pad B / Select) */
  back() {
    return this.just("escape") || this.touchBackEdge || this.padBackEdge;
  }

  /** Menu / upgrade list navigation: −1 up, +1 down, 0 none (edge) */
  menuNav(): -1 | 0 | 1 {
    if (this.just("arrowup") || this.just("w")) return -1;
    if (this.just("arrowdown") || this.just("s")) return 1;
    if (this.touchMenuEdge === -1 || this.touchMenuEdge === 1) return this.touchMenuEdge;
    if (this.padMenuEdge === -1 || this.padMenuEdge === 1) return this.padMenuEdge;
    return 0;
  }
}
