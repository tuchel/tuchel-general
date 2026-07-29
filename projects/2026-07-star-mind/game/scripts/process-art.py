#!/usr/bin/env python3
"""Chroma-key magenta (#FF00FF-ish) sprites → transparent PNG + auto-crop."""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

SRC = Path("/opt/cursor/artifacts/assets")
OUT = Path("/workspace/projects/2026-07-star-mind/game/public/art")

SPRITE_MAP = {
    "spr-ash.png": "sprites/ash.png",
    "spr-ash-eva.png": "sprites/ash-eva.png",
    "spr-ship.png": "sprites/ship.png",
    "spr-truck.png": "sprites/truck.png",
    "spr-drone.png": "sprites/drone.png",
    "spr-crab.png": "sprites/crab.png",
    "spr-walker.png": "sprites/walker.png",
    "spr-wasp.png": "sprites/wasp.png",
    "spr-gridsat.png": "sprites/gridsat.png",
    "spr-spine.png": "sprites/spine.png",
    "spr-beetle.png": "sprites/beetle.png",
    "spr-turret.png": "sprites/turret.png",
    "spr-hackbot.png": "sprites/hackbot.png",
    "spr-mirror.png": "sprites/mirror.png",
    "spr-ghost.png": "sprites/ghost.png",
    "spr-gate.png": "sprites/gate.png",
    "spr-pickup.png": "sprites/pickup.png",
    "spr-boss-reaper.png": "sprites/boss-reaper.png",
    "spr-boss-seraph.png": "sprites/boss-seraph.png",
    "spr-boss-prime.png": "sprites/boss-prime.png",
}

BG_MAP = {
    "bg-l1-sky.png": "bg/l1-sky.png",
    "bg-l1-mid.png": "bg/l1-mid.png",
    "bg-l2-ascent.png": "bg/l2-ascent.png",
    "bg-l3-void.png": "bg/l3-void.png",
    "ui-title-hero.png": "ui/title-hero.png",
    "sb-l1-earth-escape.png": "storyboards/sb-l1-earth-escape.png",
    "sb-l2-launch.png": "storyboards/sb-l2-launch.png",
    "sb-l3-orbit.png": "storyboards/sb-l3-orbit.png",
}


def is_magenta(r: int, g: int, b: int) -> bool:
    # Magenta key + near-magenta fringes from generation
    if r > 180 and b > 180 and g < 120:
        return True
    if r > 200 and b > 160 and g < 160 and abs(r - b) < 80:
        return True
    # checkerboard greys sometimes left by generators — treat very flat mid-grey near edges later
    return False


def key_sprite(src: Path, dst: Path) -> None:
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_magenta(r, g, b):
                px[x, y] = (0, 0, 0, 0)
            elif r > 160 and b > 140 and g < 170:
                # soft fringe
                alpha = max(0, min(255, int(255 - ((r + b) / 2 - g) * 1.8)))
                if alpha < 40:
                    px[x, y] = (0, 0, 0, 0)
                else:
                    px[x, y] = (r, g, b, alpha)

    # Crop to opaque bounds with padding
    bbox = im.getbbox()
    if bbox:
        pad = 4
        x0, y0, x1, y1 = bbox
        x0 = max(0, x0 - pad)
        y0 = max(0, y0 - pad)
        x1 = min(w, x1 + pad)
        y1 = min(h, y1 + pad)
        im = im.crop((x0, y0, x1, y1))

    # Downscale large sprites for game perf while keeping crispness
    max_dim = 256 if "boss" in dst.name else (180 if dst.name in {"truck.png", "ship.png"} else 128)
    if max(im.size) > max_dim:
        scale = max_dim / max(im.size)
        im = im.resize((max(1, int(im.width * scale)), max(1, int(im.height * scale))), Image.Resampling.LANCZOS)

    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "PNG", optimize=True)
    print(f"sprite {src.name} -> {dst} ({im.size[0]}x{im.size[1]})")


def copy_bg(src: Path, dst: Path, max_w: int = 1280) -> None:
    im = Image.open(src).convert("RGB")
    if im.width > max_w:
        scale = max_w / im.width
        im = im.resize((max_w, max(1, int(im.height * scale))), Image.Resampling.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "PNG", optimize=True)
    print(f"bg {src.name} -> {dst} ({im.size[0]}x{im.size[1]})")


def main() -> int:
    missing = []
    for src_name, rel in SPRITE_MAP.items():
        src = SRC / src_name
        if not src.exists():
            missing.append(src_name)
            continue
        key_sprite(src, OUT / rel)
    for src_name, rel in BG_MAP.items():
        src = SRC / src_name
        if not src.exists():
            missing.append(src_name)
            continue
        mw = 1600 if "storyboard" in rel or "title" in rel else 1280
        copy_bg(src, OUT / rel, max_w=mw)
    if missing:
        print("MISSING:", ", ".join(missing), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
