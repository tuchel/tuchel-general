import { sfx } from "./audio";
import "./style.css";
import { art } from "./assets";
import { Game } from "./game";
import { applyPlatformClass, isIOS, isTouchPrimary } from "./platform";
import { TouchControls } from "./touch-controls";

const touchPrimary = applyPlatformClass();

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) throw new Error("#game canvas missing");

const shell = document.querySelector<HTMLElement>("#game-shell");
const fsBtn = document.querySelector<HTMLButtonElement>("#fs-btn");
const app = document.querySelector<HTMLElement>("#app");

function isFullscreen() {
  return Boolean(
    document.fullscreenElement ||
      (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement,
  );
}

async function toggleFullscreen() {
  if (!shell || isIOS()) return;
  try {
    if (isFullscreen()) {
      const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen();
    } else {
      const el = shell as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
      if (shell.requestFullscreen) await shell.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    }
  } catch (err) {
    console.warn("Fullscreen unavailable", err);
  }
}

function syncFsLabel() {
  if (!fsBtn) return;
  fsBtn.textContent = isFullscreen() ? "EXIT FULL" : "FULL SCREEN";
}

fsBtn?.addEventListener("click", () => {
  void toggleFullscreen();
});

document.addEventListener("fullscreenchange", syncFsLabel);
document.addEventListener("webkitfullscreenchange", syncFsLabel);

window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey && !e.altKey) {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    e.preventDefault();
    void toggleFullscreen();
  }
});

// Stop iOS rubber-band scroll / pinch while playing
if (touchPrimary) {
  document.addEventListener(
    "touchmove",
    (e) => {
      if ((e.target as HTMLElement | null)?.closest?.("#touch-layer, #game-shell, #app")) {
        e.preventDefault();
      }
    },
    { passive: false },
  );
  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("contextmenu", (e) => {
    if ((e.target as HTMLElement | null)?.closest?.("#game-shell, #touch-layer")) {
      e.preventDefault();
    }
  });
}

const ctx = canvas.getContext("2d", { alpha: false });
if (ctx) {
  ctx.fillStyle = "#0B1220";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#2EC4B6";
  ctx.font = "16px monospace";
  ctx.textAlign = "center";
  ctx.fillText("UPLINKING ART…", canvas.width / 2, canvas.height / 2);
}

const game = new Game(canvas);
window.addEventListener("pointerdown", () => sfx.unlock(), { once: true });
window.addEventListener("keydown", () => sfx.unlock(), { once: true });

let touch: TouchControls | null = null;

function mountTouch() {
  if (touch || !shell) return;
  touch = new TouchControls(game.input, shell, app);
  const syncTouchUi = () => {
    const mode = game.uiMode();
    touch?.setMode(mode === "play" ? "play" : mode === "hidden" ? "hidden" : "menu", {
      showBack: game.showTouchBack(),
      showNav: game.showTouchNav(),
    });
    touch?.syncLayout();
  };
  let lastKey = "";
  const watch = () => {
    const key = `${game.uiMode()}:${game.showTouchBack()}:${game.showTouchNav()}`;
    if (key !== lastKey) {
      lastKey = key;
      syncTouchUi();
    }
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);

  const onViewport = () => {
    applyPlatformClass();
    touch?.syncLayout();
  };
  window.addEventListener("orientationchange", onViewport);
  window.addEventListener("resize", onViewport);
  window.visualViewport?.addEventListener("resize", onViewport);
  window.visualViewport?.addEventListener("scroll", onViewport);
}

if (touchPrimary) mountTouch();

// Desktop/laptop with touch later (or DevTools device mode flip)
if (!touchPrimary && app) {
  window.addEventListener("resize", () => {
    if (isTouchPrimary() && !touch) {
      applyPlatformClass();
      mountTouch();
    }
  });
}

art
  .load()
  .catch((err) => {
    console.warn("Art bank partial failure; procedural fallbacks active", err);
  })
  .finally(() => {
    game.start();
  });
