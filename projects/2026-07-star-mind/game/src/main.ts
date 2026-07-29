import "./style.css";
import { art } from "./assets";
import { Game } from "./game";

const canvas = document.querySelector<HTMLCanvasElement>("#game");
if (!canvas) throw new Error("#game canvas missing");

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
