#!/usr/bin/env python3
"""Check audit-anchors.yml against metros_web.json (Phase 4 hardening)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def main() -> int:
    metros = {m["cbsa"]: m for m in json.loads((DATA / "metros_web.json").read_text())["metros"]}
    audit = json.loads((DATA / "audit.json").read_text())
    anchors = yaml.safe_load((DATA / "audit-anchors.yml").read_text())
    failures = []

    rec = anchors["tax_recovery_vs_published"]
    if audit["tax_recovery_vs_published"] < rec["expected_min"]:
        failures.append(
            f"tax recovery {audit['tax_recovery_vs_published']} < {rec['expected_min']}"
        )

    n = anchors["n_metropolitan"]
    if audit["n_metropolitan"] < n["expected_min"]:
        failures.append(f"n_metropolitan {audit['n_metropolitan']} < {n['expected_min']}")

    nyc = anchors["nyc_tax_pc_order"]
    row = metros.get(nyc["cbsa"])
    if not row:
        failures.append("NYC CBSA missing")
    else:
        v = row[nyc["field"]]
        if not (nyc["expected_min"] <= v <= nyc["expected_max"]):
            failures.append(f"NYC {nyc['field']}={v} outside [{nyc['expected_min']},{nyc['expected_max']}]")

    if failures:
        print("FAIL")
        for f in failures:
            print(" -", f)
        return 1
    print("PASS — audit anchors OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
