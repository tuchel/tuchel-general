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
  private touchMenuEdge = 0; // -1 | 0 | 1

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
    this.touchMenuEdge = 0;
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
    return Math.max(-1, Math.min(1, x));
  }

  axisZ() {
    let z = 0;
    if (this.hold("w") || this.hold("arrowup")) z += 1;
    if (this.hold("s") || this.hold("arrowdown")) z -= 1;
    if (z === 0) z = this.touchZ;
    return Math.max(-1, Math.min(1, z));
  }

  axisY() {
    return -this.axisZ();
  }

  jumpJust() {
    return this.just(" ") || this.touchJumpEdge;
  }

  shoot() {
    return this.hold("j") || this.hold("z") || this.touchShoot;
  }

  specialJust() {
    return this.just("k") || this.just("x") || this.touchSpecialEdge;
  }

  confirm() {
    return (
      this.just("enter") ||
      this.just(" ") ||
      this.just("j") ||
      this.touchConfirmEdge
    );
  }

  /** Escape / title return (keyboard Escape or touch TITLE) */
  back() {
    return this.just("escape") || this.touchBackEdge;
  }

  /** Menu / upgrade list navigation: −1 up, +1 down, 0 none (edge) */
  menuNav(): -1 | 0 | 1 {
    if (this.just("arrowup") || this.just("w")) return -1;
    if (this.just("arrowdown") || this.just("s")) return 1;
    if (this.touchMenuEdge === -1 || this.touchMenuEdge === 1) return this.touchMenuEdge;
    return 0;
  }
}
