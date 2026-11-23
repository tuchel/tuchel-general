import type { InputManager } from "../engine/input";
import type { HudSnapshot } from "../game/engine";

/**
 * Mobile-first landscape dual-thumb touch controls overlay:
 * - Floating left virtual stick (multi-touch pointer-id isolated)
 * - Right 360° drag-aim / tap-smart-aim fire pad
 * - Context-aware tactical buttons (Jump/EVA/Boost, CQC/Hack/Rescue, EMP, Box/Cold Drift, Weapon, Camo)
 */
export class TouchControlsOverlay {
  private root: HTMLElement;
  private input: InputManager;
  private stickPointerId: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private aimPointerId: number | null = null;
  private aimOrigin = { x: 0, y: 0 };

  private stickVisual!: HTMLElement;
  private stickPuck!: HTMLElement;
  private aimPad!: HTMLElement;
  private aimNub!: HTMLElement;
  private btnJump!: HTMLButtonElement;
  private btnCqc!: HTMLButtonElement;
  private btnEmp!: HTMLButtonElement;
  private btnBox!: HTMLButtonElement;
  private btnWpn!: HTMLButtonElement;
  private btnCamo!: HTMLButtonElement;
  private btnCrouch!: HTMLButtonElement;

  constructor(container: HTMLElement, input: InputManager) {
    this.root = container;
    this.input = input;
    this.render();
    this.bindEvents();
  }

  private render(): void {
    this.root.innerHTML = `
      <div class="touch-layer" id="touch-layer">
        <div class="stick-zone" id="stick-zone"></div>
        <div class="stick-visual" id="stick-visual">
          <div class="stick-puck" id="stick-puck"></div>
        </div>
        <button class="tac-btn small left-sub-btn mono" id="btn-crouch" type="button">LOW</button>

        <div class="right-cluster">
          <div class="aim-pad mono" id="aim-pad">
            <span>FIRE</span>
            <small style="font-size:8px;opacity:0.75;">AIM</small>
            <div class="aim-pad-nub" id="aim-nub"></div>
          </div>
          <button class="tac-btn btn-jump mono" id="btn-jump" type="button">JUMP</button>
          <button class="tac-btn btn-cqc accent-cyan mono" id="btn-cqc" type="button">CQC</button>
          <button class="tac-btn small btn-emp accent-cyan mono" id="btn-emp" type="button">EMP</button>
          <button class="tac-btn small btn-box accent-amber mono" id="btn-box" type="button">BOX</button>
          <button class="tac-btn small btn-wpn mono" id="btn-wpn" type="button">WPN</button>
          <button class="tac-btn small btn-camo accent-cyan mono" id="btn-camo" type="button" style="display:none;">CAMO</button>
        </div>
      </div>
    `;

    this.stickVisual = this.root.querySelector("#stick-visual") as HTMLElement;
    this.stickPuck = this.root.querySelector("#stick-puck") as HTMLElement;
    this.aimPad = this.root.querySelector("#aim-pad") as HTMLElement;
    this.aimNub = this.root.querySelector("#aim-nub") as HTMLElement;
    this.btnJump = this.root.querySelector("#btn-jump") as HTMLButtonElement;
    this.btnCqc = this.root.querySelector("#btn-cqc") as HTMLButtonElement;
    this.btnEmp = this.root.querySelector("#btn-emp") as HTMLButtonElement;
    this.btnBox = this.root.querySelector("#btn-box") as HTMLButtonElement;
    this.btnWpn = this.root.querySelector("#btn-wpn") as HTMLButtonElement;
    this.btnCamo = this.root.querySelector("#btn-camo") as HTMLButtonElement;
    this.btnCrouch = this.root.querySelector("#btn-crouch") as HTMLButtonElement;
  }

  private bindEvents(): void {
    const stickZone = this.root.querySelector("#stick-zone") as HTMLElement;
    const maxR = 42;

    // Left floating joystick
    stickZone.addEventListener("pointerdown", (e) => {
      if (this.stickPointerId !== null) return;
      e.preventDefault();
      this.stickPointerId = e.pointerId;
      stickZone.setPointerCapture(e.pointerId);
      this.stickOrigin = { x: e.clientX, y: e.clientY };
      this.stickVisual.classList.add("active");
      this.stickVisual.style.left = `${e.clientX}px`;
      this.stickVisual.style.top = `${e.clientY}px`;
      this.stickVisual.style.bottom = "auto";
      this.input.setTouchStick(true, e.clientX, e.clientY, 0, 0);
    });

    stickZone.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.stickPointerId) return;
      e.preventDefault();
      const dx = e.clientX - this.stickOrigin.x;
      const dy = e.clientY - this.stickOrigin.y;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(maxR, dist);
      const nx = dist > 0 ? (dx / dist) * clamped : 0;
      const ny = dist > 0 ? (dy / dist) * clamped : 0;
      this.stickPuck.style.transform = `translate(calc(-50% + ${nx}px), calc(-50% + ${ny}px))`;
      this.input.setTouchStick(true, this.stickOrigin.x, this.stickOrigin.y, nx / maxR, ny / maxR);
    });

    const releaseStick = (e: PointerEvent) => {
      if (e.pointerId !== this.stickPointerId) return;
      this.stickPointerId = null;
      this.stickVisual.classList.remove("active");
      this.stickPuck.style.transform = "translate(-50%, -50%)";
      this.input.setTouchStick(false, 0, 0, 0, 0);
    };
    stickZone.addEventListener("pointerup", releaseStick);
    stickZone.addEventListener("pointercancel", releaseStick);

    // Right 360° Aim + Fire pad
    this.aimPad.addEventListener("pointerdown", (e) => {
      if (this.aimPointerId !== null) return;
      e.preventDefault();
      this.aimPointerId = e.pointerId;
      this.aimPad.setPointerCapture(e.pointerId);
      const rect = this.aimPad.getBoundingClientRect();
      this.aimOrigin = { x: rect.left + rect.width * 0.5, y: rect.top + rect.height * 0.5 };
      this.aimPad.classList.add("active");
      this.input.setTouchAimPad(true, this.aimOrigin.x, this.aimOrigin.y, 0, 0, true);
      navigator.vibrate?.(10);
    });

    this.aimPad.addEventListener("pointermove", (e) => {
      if (e.pointerId !== this.aimPointerId) return;
      e.preventDefault();
      const dx = e.clientX - this.aimOrigin.x;
      const dy = e.clientY - this.aimOrigin.y;
      const dist = Math.hypot(dx, dy);
      const clamped = Math.min(36, dist);
      const nx = dist > 0 ? (dx / dist) * clamped : 0;
      const ny = dist > 0 ? (dy / dist) * clamped : 0;
      this.aimNub.style.transform = `translate(${nx}px, ${ny}px)`;
      this.input.setTouchAimPad(true, this.aimOrigin.x, this.aimOrigin.y, dx / 36, dy / 36, false);
    });

    const releaseAim = (e: PointerEvent) => {
      if (e.pointerId !== this.aimPointerId) return;
      this.aimPointerId = null;
      this.aimPad.classList.remove("active");
      this.aimNub.style.transform = "translate(0px, 0px)";
      this.input.setTouchAimPad(false, 0, 0, 0, 0, false);
    };
    this.aimPad.addEventListener("pointerup", releaseAim);
    this.aimPad.addEventListener("pointercancel", releaseAim);

    // Jump / EVA / Afterburner (holdable)
    this.btnJump.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.btnJump.classList.add("lit");
      this.input.setTouchJump(true, true);
    });
    const endJump = () => {
      this.btnJump.classList.remove("lit");
      this.input.setTouchJump(false, false);
    };
    this.btnJump.addEventListener("pointerup", endJump);
    this.btnJump.addEventListener("pointercancel", endJump);

    // Box / Cold Drift (tap toggles box on foot, hold activates Cold Drift in starship)
    this.btnBox.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.btnBox.classList.add("lit");
      this.input.setTouchBoxHeld(true, true);
    });
    const endBox = () => {
      this.btnBox.classList.remove("lit");
      this.input.setTouchBoxHeld(false, false);
    };
    this.btnBox.addEventListener("pointerup", endBox);
    this.btnBox.addEventListener("pointercancel", endBox);

    // Instant tactile buttons
    this.btnCqc.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.input.triggerTouchAction("cqc");
      navigator.vibrate?.(14);
    });
    this.btnEmp.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.input.triggerTouchAction("emp");
    });
    this.btnWpn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.input.triggerTouchAction("weapon");
    });
    this.btnCamo.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.input.triggerTouchAction("camo");
    });
    this.btnCrouch.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.input.triggerTouchAction("crouch");
    });
  }

  public syncHud(hud: HudSnapshot): void {
    this.btnJump.textContent =
      hud.mode === "starship" ? "BOOST" : hud.mode === "eva" ? "EVA" : "JUMP";
    this.btnBox.textContent =
      hud.mode === "starship" ? (hud.coldDrift ? "COLD!" : "DRIFT") : hud.inBox ? "BOX ON" : "BOX";
    this.btnCqc.textContent = hud.nearInteract
      ? hud.nearInteract.startsWith("RESCUE")
        ? "RESCUE"
        : "HACK"
      : "CQC";
    this.btnEmp.textContent = `EMP ${hud.empCount}`;
    this.btnWpn.textContent = hud.weaponName;
    this.btnCrouch.style.display = hud.mode === "starship" ? "none" : "flex";
    this.btnCamo.style.display = hud.camoUnlocked ? "flex" : "none";
    this.btnCamo.textContent = hud.camoActive
      ? "CLOAK"
      : hud.camoCooldown > 0
      ? `${Math.ceil(hud.camoCooldown)}s`
      : "CAMO";
  }

  public setVisible(visible: boolean): void {
    const layer = this.root.querySelector("#touch-layer") as HTMLElement | null;
    if (layer) layer.style.display = visible ? "block" : "none";
  }
}
