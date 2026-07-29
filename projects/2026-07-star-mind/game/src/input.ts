export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();

  constructor() {
    window.addEventListener("keydown", (e) => {
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
    });
    window.addEventListener("keyup", (e) => {
      const key = e.code === "Space" ? " " : e.key.toLowerCase();
      this.down.delete(key);
    });
    window.addEventListener("blur", () => {
      this.down.clear();
      this.pressed.clear();
    });
  }

  tick() {
    this.pressed.clear();
  }

  hold(key: string) {
    return this.down.has(key);
  }

  just(key: string) {
    return this.pressed.has(key);
  }

  /** Strafe along the stage (X) */
  axisX() {
    let x = 0;
    if (this.hold("a") || this.hold("arrowleft")) x -= 1;
    if (this.hold("d") || this.hold("arrowright")) x += 1;
    return x;
  }

  /**
   * Depth into the screen (Z).
   * W / ↑ = farther (into scene), S / ↓ = nearer (toward camera).
   */
  axisZ() {
    let z = 0;
    if (this.hold("w") || this.hold("arrowup")) z += 1;
    if (this.hold("s") || this.hold("arrowdown")) z -= 1;
    return z;
  }

  /** @deprecated use axisZ — kept for ship altitude aliases */
  axisY() {
    return -this.axisZ();
  }

  jumpJust() {
    return this.just(" ");
  }

  shoot() {
    return this.hold("j") || this.hold("z");
  }

  specialJust() {
    return this.just("k") || this.just("x");
  }

  confirm() {
    return this.just("enter") || this.just(" ");
  }
}
