import "./style.css";
import { art } from "./assets";
import { Game } from "./game";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) throw new Error("#game canvas missing");

const shell = document.querySelector<HTMLElement>("#game-shell");
const fsBtn = document.querySelector<HTMLButtonElement>("#fs-btn");

function isFullscreen() {
  return Boolean(document.fullscreenElement || (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement);
}

async function toggleFullscreen() {
  if (!shell) return;
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
    // Don't steal F when typing in a field (none expected, but safe)
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    e.preventDefault();
    void toggleFullscreen();
  }
});

const ctx = canvas.getContext("2d");
if (ctx) {
  ctx.fillStyle = "#0B1220";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#2EC4B6";
  ctx.font = "16px monospace";
  ctx.textAlign = "center";
  ctx.fillText("UPLINKING ART…", canvas.width / 2, canvas.height / 2);
}

const game = new Game(canvas);

art
  .load()
  .catch((err) => {
    console.warn("Art bank partial failure; procedural fallbacks active", err);
  })
  .finally(() => {
    game.start();
  });
