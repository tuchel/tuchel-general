#!/usr/bin/env python3
"""Drive time from home to each branch, with no traffic.

One OSRM table request (car profile) from HOME to every branch with coordinates.
OSRM estimates duration from OpenStreetMap road class and speed limits; it has no
traffic model, so the result is a free-flow drive.

Writes data/drive_times.json and copies it to web/public/.

    python3 scripts/drive_times.py
"""

from __future__ import annotations

import json
import shutil
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
PUBLIC = ROOT / "web" / "public"

# Same point as HOME in web/src/lib/constants.ts (427 Ridgewood Road, West Lake Hills).
HOME = {"lat": 30.277964, "lon": -97.7902325}
OSRM = "https://router.project-osrm.org/table/v1/driving/"
METERS_PER_MILE = 1609.344


def main() -> int:
    branches = json.loads((DATA / "branches.json").read_text())
    names = [n for n, b in branches.items() if b.get("lat") is not None and b.get("lon") is not None]
    coords = [f"{HOME['lon']},{HOME['lat']}"] + [f"{branches[n]['lon']},{branches[n]['lat']}" for n in names]
    url = f"{OSRM}{';'.join(coords)}?sources=0&annotations=duration,distance"
    req = urllib.request.Request(url, headers={"User-Agent": "tuchel-general storytime drive times"})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = json.load(r)
    if body.get("code") != "Ok":
        raise SystemExit(f"OSRM error: {body.get('code')} {body.get('message', '')}")

    durations = body["durations"][0][1:]
    distances = body["distances"][0][1:]
    out = {
        "source": "OSRM table service, car profile, no traffic (router.project-osrm.org)",
        "request": url,
        "fetched": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "home": HOME,
        "branches": {
            name: {"minutes": round(sec / 60), "road_miles": round(m / METERS_PER_MILE, 1)}
            for name, sec, m in zip(names, durations, distances)
            if sec is not None
        },
    }
    path = DATA / "drive_times.json"
    path.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
    shutil.copy(path, PUBLIC / "drive_times.json")
    for name, v in sorted(out["branches"].items(), key=lambda kv: kv[1]["minutes"]):
        print(f"{v['minutes']:>3} min  {v['road_miles']:>5} mi  {name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
