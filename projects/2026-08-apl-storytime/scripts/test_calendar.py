#!/usr/bin/env python3
"""Checks on the generated Fall 2026 APL storytime calendar."""

from __future__ import annotations

import json
import re
import sys
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "web" / "public"
ICS = PUBLIC / "storytime.ics"
EVENTS = PUBLIC / "events.json"
BRANCHES = ROOT / "data" / "branches.json"
CONST = ROOT / "web" / "src" / "lib" / "constants.ts"
SEASON_START = date(2026, 9, 7)
SEASON_END = date(2026, 11, 21)
CLOSED_IN_PERSON = {date(2026, 9, 6), date(2026, 9, 7), date(2026, 11, 11)}


def fail(msg: str) -> None:
    print("FAIL:", msg)
    sys.exit(1)


def main() -> int:
    if not ICS.exists() or not EVENTS.exists():
        fail("run scripts/build_calendar.py first")
    events = json.loads(EVENTS.read_text())
    if len(events) < 200:
        fail(f"expected ≥200 dated programs, got {len(events)}")

    for ev in events:
        start = datetime.fromisoformat(ev["start"])
        end = datetime.fromisoformat(ev["end"])
        day = start.date()
        if day < SEASON_START or day > SEASON_END:
            fail(f"out of season: {ev}")
        if end <= start:
            fail(f"end before start: {ev}")
        if ev["branch"] != "Online" and day in CLOSED_IN_PERSON:
            fail(f"in-person event on a closed holiday: {ev}")
        if not ev.get("url", "").startswith("https://library.austintexas.gov/"):
            fail(f"missing APL url: {ev}")
        if ev["branch"] != "Online" and ("lat" not in ev or "lon" not in ev):
            fail(f"mapped event missing coordinates: {ev['title']} {ev['branch']}")

    branches = json.loads(BRANCHES.read_text())
    for name, info in branches.items():
        if name == "Online":
            continue
        if "lat" not in info or "lon" not in info:
            fail(f"branch missing coordinates: {name}")

    ics = ICS.read_bytes()
    if not ics.startswith(b"BEGIN:VCALENDAR"):
        fail("ICS missing header")
    if b"TZID:America/Chicago" not in ics:
        fail("ICS missing Chicago TZ")
    if ics.count(b"BEGIN:VEVENT") != len(events):
        fail("VEVENT count != events.json")
    for i, line in enumerate(ics.split(b"\r\n")):
        if len(line) > 75:
            fail(f"line {i} is {len(line)} octets: {line[:80]!r}")

    text = ics.decode("utf-8")
    uids = re.findall(r"^UID:(.+)$", text, re.M)
    if len(uids) != len(set(uids)):
        fail("duplicate UIDs")

    pajama = [e for e in events if e["program"] == "Pajama Storytime"]
    if not pajama:
        fail("no pajama events")
    sample = pajama[0]["start"]
    if not sample.endswith("-05:00") and not sample.endswith("-06:00"):
        fail(f"pajama start missing Chicago offset: {sample}")
    hour = datetime.fromisoformat(pajama[0]["start"]).hour
    if hour < 17:
        fail(f"pajama wall-clock hour should be evening, got {hour} from {pajama[0]}")

    programs = {e["program"] for e in events}
    for needed in (
        "All Ages Storytime",
        "Pajama Storytime",
        "Books and Babies",
        "Toddler Storytime",
        "Hora de Cuentos",
        "French-English Storytime",
        "Chinese Mandarin-English Storytime",
    ):
        if needed not in programs:
            fail(f"missing program class {needed}: {sorted(programs)}")

    constants = CONST.read_text()
    if "webcal://tuchel.github.io/tuchel-general/storytime/storytime.ics" not in constants:
        fail("subscribe link missing")
    print(f"ok: {len(events)} events, {len(ics)} byte ICS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
