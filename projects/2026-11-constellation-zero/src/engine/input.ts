export interface InputState {
  moveX: number; // -1..1
  moveY: number; // -1..1
  crouch: boolean;
  jumpHeld: boolean;
  jumpPressed: boolean;
  fireHeld: boolean;
  firePressed: boolean;
  aimActive: boolean;
  aimX: number; // normalized aim vector
  aimY: number;
  mouseWorldAim: boolean;
  mouseScreenX: number;
  mouseScreenY: number;
  cqcPressed: boolean;
  empPressed: boolean;
  decoyPressed: boolean;
  boxPressed: boolean;
  boxHeld: boolean;
  camoPressed: boolean;
  weaponNextPressed: boolean;
  weaponSelect: number | null; // 0..4
  codecPressed: boolean;
  pausePressed: boolean;
}

export class InputManager {
  private keys = new Set<string>();
  private justPressed = new Set<string>();

  // Touch state
  public stickActive = false;
  public stickOriginX = 0;
  public stickOriginY = 0;
  public stickX = 0;
  public stickY = 0;

  public aimPadActive = false;
  public aimPadOriginX = 0;
  public aimPadOriginY = 0;
  public aimPadDx = 0;
  public aimPadDy = 0;

  private touchButtons = {
    jumpHeld: false,
    jumpPressed: false,
    crouchToggled: false,
    cqcPressed: false,
    empPressed: false,
    decoyPressed: false,
    boxPressed: false,
    boxHeld: false,
    camoPressed: false,
    weaponNextPressed: false,
    codecPressed: false,
    pausePressed: false,
    firePressed: false,
  };

  private mouseDown = false;
  private mouseJustPressed = false;
  private mouseX = 0;
  private mouseY = 0;
  private hasMouseAim = false;

  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;

  constructor() {
    this.boundKeyDown = (e: KeyboardEvent) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      if (!this.keys.has(e.code)) {
        this.justPressed.add(e.code);
      }
      this.keys.add(e.code);
    };
    this.boundKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
    };
    window.addEventListener("keydown", this.boundKeyDown);
    window.addEventListener("keyup", this.boundKeyUp);
  }

  public destroy(): void {
    window.removeEventListener("keydown", this.boundKeyDown);
    window.removeEventListener("keyup", this.boundKeyUp);
  }

  public attachCanvasMouse(canvas: HTMLCanvasElement): void {
    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - rect.left;
      this.mouseY = e.clientY - rect.top;
      this.hasMouseAim = true;
    });
    canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseJustPressed = true;
        const rect = canvas.getBoundingClientRect();
        this.mouseX = e.clientX - rect.left;
        this.mouseY = e.clientY - rect.top;
        this.hasMouseAim = true;
      } else if (e.button === 2) {
        this.touchButtons.cqcPressed = true;
      }
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // --- Touch bindings called by mobile overlay ---
  public setTouchStick(active: boolean, ox: number, oy: number, dx: number, dy: number): void {
    this.stickActive = active;
    this.stickOriginX = ox;
    this.stickOriginY = oy;
    this.stickX = Math.max(-1, Math.min(1, dx));
    this.stickY = Math.max(-1, Math.min(1, dy));
    if (active) this.hasMouseAim = false;
  }

  public setTouchAimPad(active: boolean, ox: number, oy: number, dx: number, dy: number, justDown = false): void {
    this.aimPadActive = active;
    this.aimPadOriginX = ox;
    this.aimPadOriginY = oy;
    this.aimPadDx = dx;
    this.aimPadDy = dy;
    if (justDown) this.touchButtons.firePressed = true;
    if (active) this.hasMouseAim = false;
  }

  public setTouchJump(held: boolean, justDown = false): void {
    this.touchButtons.jumpHeld = held;
    if (justDown) this.touchButtons.jumpPressed = true;
  }

  public setTouchBoxHeld(held: boolean, justDown = false): void {
    this.touchButtons.boxHeld = held;
    if (justDown) this.touchButtons.boxPressed = true;
  }

  public triggerTouchAction(
    action: "cqc" | "emp" | "decoy" | "box" | "camo" | "weapon" | "codec" | "pause" | "crouch"
  ): void {
    if (action === "cqc") this.touchButtons.cqcPressed = true;
    if (action === "emp") this.touchButtons.empPressed = true;
    if (action === "decoy") this.touchButtons.decoyPressed = true;
    if (action === "box") this.touchButtons.boxPressed = true;
    if (action === "camo") this.touchButtons.camoPressed = true;
    if (action === "weapon") this.touchButtons.weaponNextPressed = true;
    if (action === "codec") this.touchButtons.codecPressed = true;
    if (action === "pause") this.touchButtons.pausePressed = true;
    if (action === "crouch") this.touchButtons.crouchToggled = !this.touchButtons.crouchToggled;
  }

  public resetTransient(): void {
    this.justPressed.clear();
    this.mouseJustPressed = false;
    this.touchButtons.jumpPressed = false;
    this.touchButtons.cqcPressed = false;
    this.touchButtons.empPressed = false;
    this.touchButtons.decoyPressed = false;
    this.touchButtons.boxPressed = false;
    this.touchButtons.camoPressed = false;
    this.touchButtons.weaponNextPressed = false;
    this.touchButtons.codecPressed = false;
    this.touchButtons.pausePressed = false;
    this.touchButtons.firePressed = false;
  }

  public clearAll(): void {
    this.keys.clear();
    this.mouseDown = false;
    this.stickActive = false;
    this.stickX = 0;
    this.stickY = 0;
    this.aimPadActive = false;
    this.touchButtons.jumpHeld = false;
    this.touchButtons.boxHeld = false;
    this.touchButtons.crouchToggled = false;
    this.resetTransient();
  }

  public poll(): InputState {
    let moveX = 0;
    let moveY = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) moveX -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) moveX += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) moveY -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) moveY += 1;

    if (this.stickActive) {
      moveX = Math.abs(this.stickX) > 0.14 ? this.stickX : 0;
      moveY = Math.abs(this.stickY) > 0.14 ? this.stickY : 0;
    }

    const crouch =
      this.keys.has("KeyS") ||
      this.keys.has("ArrowDown") ||
      this.keys.has("ControlLeft") ||
      (this.stickActive && this.stickY > 0.58) ||
      this.touchButtons.crouchToggled;

    const jumpHeld =
      this.keys.has("Space") || this.keys.has("KeyW") || this.keys.has("ArrowUp") || this.touchButtons.jumpHeld;
    const jumpPressed =
      this.justPressed.has("Space") ||
      this.justPressed.has("KeyW") ||
      this.justPressed.has("ArrowUp") ||
      this.touchButtons.jumpPressed;

    const aimLen = Math.hypot(this.aimPadDx, this.aimPadDy);
    const aimActive = this.aimPadActive && aimLen > 0.22;

    let weaponSelect: number | null = null;
    if (this.justPressed.has("Digit1")) weaponSelect = 0;
    else if (this.justPressed.has("Digit2")) weaponSelect = 1;
    else if (this.justPressed.has("Digit3")) weaponSelect = 2;
    else if (this.justPressed.has("Digit4")) weaponSelect = 3;
    else if (this.justPressed.has("Digit5")) weaponSelect = 4;

    const state: InputState = {
      moveX,
      moveY,
      crouch,
      jumpHeld,
      jumpPressed,
      fireHeld: this.mouseDown || this.keys.has("KeyJ") || this.aimPadActive,
      firePressed: this.mouseJustPressed || this.justPressed.has("KeyJ") || this.touchButtons.firePressed,
      aimActive,
      aimX: aimActive ? this.aimPadDx / aimLen : 0,
      aimY: aimActive ? this.aimPadDy / aimLen : 0,
      mouseWorldAim: this.hasMouseAim && !this.aimPadActive,
      mouseScreenX: this.mouseX,
      mouseScreenY: this.mouseY,
      cqcPressed: this.justPressed.has("KeyE") || this.justPressed.has("KeyK") || this.touchButtons.cqcPressed,
      empPressed: this.justPressed.has("KeyG") || this.touchButtons.empPressed,
      decoyPressed: this.justPressed.has("KeyF") || this.touchButtons.decoyPressed,
      boxPressed:
        this.justPressed.has("KeyB") || this.justPressed.has("ShiftLeft") || this.touchButtons.boxPressed,
      boxHeld: this.keys.has("KeyB") || this.keys.has("ShiftLeft") || this.touchButtons.boxHeld,
      camoPressed: this.justPressed.has("KeyV") || this.touchButtons.camoPressed,
      weaponNextPressed: this.justPressed.has("KeyQ") || this.touchButtons.weaponNextPressed,
      weaponSelect,
      codecPressed: this.justPressed.has("KeyC") || this.touchButtons.codecPressed,
      pausePressed:
        this.justPressed.has("Escape") || this.justPressed.has("KeyP") || this.touchButtons.pausePressed,
    };

    this.resetTransient();
    return state;
  }
}
