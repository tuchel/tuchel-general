#!/usr/bin/env python3
"""Chroma-key authored 2.5D animation frames → public/art/anim/"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

SRC = Path("/opt/cursor/artifacts/assets")
OUT = Path("/workspace/projects/2026-07-star-mind/game/public/art/anim")
PROP_OUT = Path("/workspace/projects/2026-07-star-mind/game/public/art/props")

# All generated frame basenames (without path)
FRAMES = [
    # Ash
    "ash-idle-0", "ash-idle-1",
    "ash-walk-0", "ash-walk-1", "ash-walk-2", "ash-walk-3",
    "ash-shoot-0", "ash-shoot-1", "ash-shoot-2",
    "ash-jump-0", "ash-jump-1",
    "ash-eva-idle-0", "ash-eva-idle-1",
    "ash-eva-thrust-0", "ash-eva-thrust-1", "ash-eva-thrust-2",
    "ash-eva-shoot-0", "ash-eva-shoot-1",
    # Ship / truck
    "ship-idle-0", "ship-idle-1",
    "ship-thrust-0", "ship-thrust-1", "ship-thrust-2",
    "ship-shoot-0", "ship-shoot-1",
    "truck-idle-0", "truck-move-0", "truck-move-1", "truck-move-2",
    # Enemies
    "drone-hover-0", "drone-hover-1", "drone-hover-2", "drone-fire-0", "drone-fire-1",
    "crab-walk-0", "crab-walk-1", "crab-walk-2", "crab-walk-3", "crab-leap-0", "crab-leap-1",
    "walker-walk-0", "walker-walk-1", "walker-walk-2", "walker-fire-0", "walker-fire-1",
    "wasp-hover-0", "wasp-hover-1", "wasp-hover-2",
    "spine-idle-0", "spine-idle-1", "spine-idle-2",
    "gridsat-hover-0", "gridsat-hover-1",
    "beetle-walk-0", "beetle-walk-1", "beetle-walk-2",
    "turret-idle-0", "turret-idle-1", "turret-fire-0", "turret-fire-1",
    "hackbot-walk-0", "hackbot-walk-1", "hackbot-walk-2",
    "mirror-idle-0", "mirror-idle-1",
    "ghost-hover-0", "ghost-hover-1", "ghost-hover-2",
    # Bosses
    "reaper-idle-0", "reaper-idle-1",
    "reaper-claw-0", "reaper-claw-1", "reaper-claw-2",
    "reaper-laser-0", "reaper-laser-1",
    "seraph-idle-0", "seraph-idle-1",
    "seraph-dive-0", "seraph-dive-1", "seraph-dive-2",
    "prime-idle-0", "prime-idle-1", "prime-idle-2",
    "prime-petal-0", "prime-petal-1",
    "prime-core-0", "prime-core-1", "prime-core-2",
]

PROPS = ["prop-crate-near", "prop-gantry-near"]


def is_magenta(r: int, g: int, b: int) -> bool:
    if r > 180 and b > 180 and g < 120:
        return True
    if r > 200 and b > 160 and g < 160 and abs(r - b) < 80:
        return True
    return False


def key_frame(src: Path, dst: Path, max_dim: int) -> None:
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_magenta(r, g, b):
                px[x, y] = (0, 0, 0, 0)
            elif r > 160 and b > 140 and g < 170:
                alpha = max(0, min(255, int(255 - ((r + b) / 2 - g) * 1.8)))
                px[x, y] = (0, 0, 0, 0) if alpha < 40 else (r, g, b, alpha)

    bbox = im.getbbox()
    if bbox:
        pad = 4
        x0, y0, x1, y1 = bbox
        im = im.crop((max(0, x0 - pad), max(0, y0 - pad), min(w, x1 + pad), min(h, y1 + pad)))

    if max(im.size) > max_dim:
        scale = max_dim / max(im.size)
        im = im.resize(
            (max(1, int(im.width * scale)), max(1, int(im.height * scale))),
            Image.Resampling.LANCZOS,
        )
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, "PNG", optimize=True)
    print(f"{src.name} -> {dst.name} {im.size[0]}x{im.size[1]}")


def main() -> int:
    missing = []
    for name in FRAMES:
        src = SRC / f"{name}.png"
        if not src.exists():
            missing.append(name)
            continue
        boss = name.startswith(("reaper", "seraph", "prime"))
        max_dim = 220 if boss else (160 if name.startswith(("ship", "truck")) else 128)
        key_frame(src, OUT / f"{name}.png", max_dim)
    for name in PROPS:
        src = SRC / f"{name}.png"
        if not src.exists():
            missing.append(name)
            continue
        key_frame(src, PROP_OUT / f"{name}.png", 180)
    if missing:
        print("MISSING:", ", ".join(missing), file=sys.stderr)
        return 1
    total = sum(p.stat().st_size for p in OUT.rglob("*.png"))
    print(f"anim bytes: {total // 1024} KB, files: {len(list(OUT.glob('*.png')))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
