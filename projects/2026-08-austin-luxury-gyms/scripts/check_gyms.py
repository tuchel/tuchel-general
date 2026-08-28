#!/usr/bin/env python3
"""Fail if the gym catalog is internally inconsistent."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "web" / "public" / "gyms.json"

TIERS = {
    "equinox",
    "lifetime",
    "localLuxury",
    "privateTraining",
    "membersClub",
    "countryClub",
}


def main() -> None:
    cat = json.loads(DATA.read_text())
    gyms = cat["gyms"]
    assert len(gyms) >= 10, f"expected a shortlist, got {len(gyms)}"
    ids = [g["id"] for g in gyms]
    assert len(ids) == len(set(ids)), "duplicate ids"
    home = cat["home"]
    assert abs(home["lat"] - 30.277964) < 1e-6
    assert abs(home["lon"] - (-97.7902325)) < 1e-6

    soho = next(g for g in gyms if g["id"] == "soho-house-austin")
    quarterly = 937.50
    monthly = quarterly * 4 / 12
    assert abs(soho["price"]["monthlyFrom"] - monthly) < 1e-6, soho["price"]["monthlyFrom"]

    eqx = next(g for g in gyms if g["id"] == "equinox-austin")
    assert eqx["price"]["monthlyFrom"] == 250

    for g in gyms:
        assert g["tier"] in TIERS, g["id"]
        assert -98 < g["lon"] < -97
        assert 30 < g["lat"] < 31
        assert g["driveMin"] > 0
        assert g["driveMi"] > 0
        assert g["website"].startswith("https://")
        assert g["price"]["url"].startswith("https://")
        assert g["mark"] and len(g["mark"]) <= 2
        if g["price"]["kind"] == "quoted":
            assert g["price"]["monthlyFrom"] is not None, g["id"]
        # Commute minutes should be in the same ballpark as miles at ~20–30 mph.
        implied_mph = g["driveMi"] / (g["driveMin"] / 60)
        assert 12 < implied_mph < 55, (g["id"], implied_mph)

    # KOKORO is the closest; North Life Time is the farthest.
    order = sorted(gyms, key=lambda g: g["driveMin"])
    assert order[0]["id"] == "kokoro-westlake"
    assert order[-1]["id"] == "lifetime-austin-north"
    print(f"ok {len(gyms)} gyms")


if __name__ == "__main__":
    main()
