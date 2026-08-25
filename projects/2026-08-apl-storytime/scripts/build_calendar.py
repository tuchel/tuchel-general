#!/usr/bin/env python3
"""Build a Fall 2026 APL storytime ICS + subscribe page from dated library listings."""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
WEB = ROOT / "web"
PUBLIC = WEB / "public"
TZID = "America/Chicago"
CHICAGO = ZoneInfo(TZID)
SEASON_START = date(2026, 9, 7)
SEASON_END = date(2026, 11, 21)
CLOSED = {date(2026, 9, 6), date(2026, 9, 7), date(2026, 11, 11)}
ADA_PHONE = "512-974-7400"

TAG_PAGES = [
    "https://library.austintexas.gov/events/all-ages-storytime",
    "https://library.austintexas.gov/events/pajama-storytime",
    "https://library.austintexas.gov/events/books-and-babies",
    "https://library.austintexas.gov/events/toddler-storytime",
    "https://library.austintexas.gov/events/preschool-storytime",
    "https://library.austintexas.gov/events/spanish-english-storytime",
    "https://library.austintexas.gov/events/french-english-storytime",
    "https://library.austintexas.gov/events/japanese-english-storytime",
    "https://library.austintexas.gov/events/chinese-mandarin-english-storytime",
    "https://library.austintexas.gov/events/music-movement",
    "https://library.austintexas.gov/events/spanish-storytime",
    "https://library.austintexas.gov/events/cuentos-en-espanol",
]

SKIP_TITLE = re.compile(
    r"baby'?s first symphony|early literacy playgroup|talk time|"
    r"turkish community|steeped in books|tech savvy|senior social|"
    r"^canceled",
    re.I,
)
KEEP_HINT = re.compile(
    r"storytime|story time|story hour|cuentos|cuent|books and babies|baby social|"
    r"music\s*(&|and)\s*movement|music circle|leemos juntos|"
    r"lisons ensemble|isshoni|hora do conto|hora de cuentos|"
    r"mandarin|portuguese|pajama|musical storytime",
    re.I,
)

MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
    "july": 7, "august": 8, "september": 9, "october": 10, "november": 11,
    "december": 12,
}

WHEN_RE = re.compile(
    r"(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), "
    r"(January|February|March|April|May|June|July|August|September|"
    r"October|November|December) (\d{1,2}) - "
    r"(\d{1,2}:\d{2} [AP]M)(?: to (\d{1,2}:\d{2} [AP]M))?",
    re.I,
)


def ages_for(program: str) -> str:
    if program == "Books and Babies":
        return "0–12 months"
    if program in {"Toddler Storytime", "Toddler Music Circle"}:
        return "1–3 years"
    if program == "Preschool Storytime":
        return "3–5 years"
    return "5 and under"


def load_branches() -> dict:
    return json.loads((DATA / "branches.json").read_text())


def fetch(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "tuchel-general-apl-storytime/1.0 (personal calendar)"},
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        return resp.read().decode("utf-8", "replace")


def parse_clock(text: str) -> datetime:
    return datetime.strptime(text.strip(), "%I:%M %p")


def parse_when(raw: str) -> tuple[datetime, datetime] | None:
    m = WHEN_RE.search(html.unescape(raw))
    if not m:
        return None
    month = MONTHS[m.group(2).lower()]
    day = int(m.group(3))
    start_t = parse_clock(m.group(4))
    end_t = parse_clock(m.group(5)) if m.group(5) else start_t + timedelta(minutes=30)
    year = 2026
    start = datetime(year, month, day, start_t.hour, start_t.minute, tzinfo=CHICAGO)
    end = datetime(year, month, day, end_t.hour, end_t.minute, tzinfo=CHICAGO)
    if end <= start:
        end = start + timedelta(minutes=30)
    return start, end


def strip_tags(blob: str) -> str:
    blob = re.sub(r"<br\s*/?>", " | ", blob, flags=re.I)
    blob = re.sub(r"<[^>]+>", " ", blob)
    blob = html.unescape(blob)
    return re.sub(r"\s+", " ", blob).strip()


def parse_articles(page_html: str) -> list[dict]:
    events = []
    for m in re.finditer(
        r'<article data-history-node-id="(\d+)">(.*?)</article>',
        page_html,
        re.S,
    ):
        nid, body = m.group(1), m.group(2)
        title_m = re.search(
            r'<h2 class="event-title"><a href="([^"]+)"[^>]*>([^<]+)</a>',
            body,
        )
        time_m = re.search(r'class="event_time"[^>]*>([^<]+)', body)
        loc_m = re.search(
            r'class="event_location"[^>]*>(.*?)</div></div>', body, re.S
        ) or re.search(r'class="event_location"[^>]*>(.*?)</span>', body, re.S)
        if not title_m or not time_m:
            continue
        events.append(
            {
                "nid": nid,
                "href": title_m.group(1),
                "title": html.unescape(title_m.group(2)).strip(),
                "when": html.unescape(time_m.group(1)).strip(),
                "loc_raw": strip_tags(loc_m.group(1) if loc_m else ""),
            }
        )
    return events


def scrape() -> list[dict]:
    seen: dict[str, dict] = {}
    for base in TAG_PAGES:
        for page in range(0, 12):
            url = base if page == 0 else f"{base}?page={page}"
            try:
                text = fetch(url)
            except urllib.error.HTTPError as exc:
                print(f"skip {url}: {exc}", file=sys.stderr)
                break
            rows = parse_articles(text)
            print(f"{len(rows):3} {url}")
            if not rows:
                break
            for row in rows:
                seen[row["nid"]] = row
            if f"page={page + 1}" not in text:
                break
            time.sleep(0.15)
    return list(seen.values())


def canonical_branch(loc_raw: str, title: str, branches: dict) -> str:
    low = (loc_raw + " " + title).lower()
    if "online" in low or "virtual" in title.lower() or "zoom" in low:
        return "Online"
    for name in branches:
        if name == "Online":
            continue
        if name.lower() in loc_raw.lower():
            return name
        for alias in branches[name].get("aliases", []):
            if alias.lower() in loc_raw.lower():
                return name
    if loc_raw:
        return loc_raw.split("|")[0].strip() or loc_raw
    return "Austin Public Library"


def classify(title: str) -> str:
    t = title.lower()
    if "pajama" in t:
        return "Pajama Storytime"
    if "toddler music" in t:
        return "Toddler Music Circle"
    if "music" in t and "movement" in t:
        if "spanish" in t or "música" in t or "musica" in t:
            return "Spanish-English Music & Movement"
        return "Music & Movement"
    if "books and babies" in t or "baby social" in t:
        return "Books and Babies"
    if "preschool" in t:
        return "Preschool Storytime"
    if "toddler" in t:
        return "Toddler Storytime"
    if "hora do conto" in t or "portuguese" in t:
        return "Portuguese-English Storytime"
    if "mandarin" in t or "chinese community" in t:
        return "Chinese Mandarin-English Storytime"
    if "lisons" in t or "french" in t:
        return "French-English Storytime"
    if "isshoni" in t or "japanese" in t:
        return "Japanese-English Storytime"
    if "hora de cuentos" in t or "virtual de cuentos" in t or "senora lili" in t:
        return "Hora de Cuentos"
    if "leemos juntos" in t or "spanish-english" in t or "spanish/english" in t:
        return "Spanish-English Storytime"
    if "messy art" in t or "musical storytime" in t or "all ages" in t:
        return "All Ages Storytime"
    if "storytime" in t or "cuentos" in t:
        return "Storytime"
    return "Storytime"


def normalize(raw: dict, branches: dict) -> dict | None:
    title = raw["title"]
    if SKIP_TITLE.search(title) and not KEEP_HINT.search(title):
        return None
    if SKIP_TITLE.search(title):
        return None
    if not KEEP_HINT.search(title) and "storytime" not in title.lower():
        return None
    parsed = parse_when(raw["when"])
    if not parsed:
        return None
    start, end = parsed
    day = start.date()
    if day < SEASON_START or day > SEASON_END:
        return None
    branch = canonical_branch(raw["loc_raw"], title, branches)
    if branch != "Online" and day in CLOSED:
        return None
    href = raw["href"]
    if href.startswith("/"):
        href = "https://library.austintexas.gov" + href
    room = ""
    if "Children" in raw["loc_raw"]:
        room = "Children's Area (3rd Floor South)"
    info = branches.get(branch, {})
    program = classify(title)
    event = {
        "nid": raw["nid"],
        "title": title,
        "program": program,
        "ages": ages_for(program),
        "branch": branch,
        "start": start.isoformat(timespec="seconds"),
        "end": end.isoformat(timespec="seconds"),
        "url": href,
        "address": info.get("address", ""),
        "room": room,
        "source": "apl-listing",
    }
    if "lat" in info and "lon" in info:
        event["lat"] = info["lat"]
        event["lon"] = info["lon"]
    return event


def ics_escape(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\n")
        .replace("\n", "\\n")
    )


def fold_line(line: str) -> str:
    raw = line.encode("utf-8")
    if len(raw) <= 75:
        return line
    out = []
    limit = 75
    while raw:
        if len(raw) <= limit:
            out.append(raw.decode("utf-8"))
            break
        cut = limit
        while cut > 0:
            try:
                piece = raw[:cut].decode("utf-8")
                break
            except UnicodeDecodeError:
                cut -= 1
        else:
            raise ValueError(f"cannot fold ICS line: {line[:80]!r}")
        out.append(piece)
        raw = raw[cut:]
        limit = 74
    return "\r\n ".join(out)


def fmt_local(dt: datetime) -> str:
    return dt.strftime("%Y%m%dT%H%M%S")


def vevent(ev: dict, now: datetime) -> str:
    start = datetime.fromisoformat(ev["start"])
    end = datetime.fromisoformat(ev["end"])
    loc_parts = [ev["branch"]]
    if ev.get("room"):
        loc_parts.append(ev["room"])
    if ev.get("address"):
        loc_parts.append(ev["address"])
    location = ", ".join(loc_parts)
    desc = [
        f"{ev['title']} — {ev['program']}",
        f"{ev['branch']}" + (f", {ev['room']}" if ev.get("room") else ""),
        ev.get("address") or "",
        "",
        "Austin Public Library Fall 2026 storytime (7 Sep–21 Nov).",
        "Unofficial feed transcribed from dated APL listings. Confirm before you go; programs move or cancel.",
        ev["url"],
        f"ADA accommodations: {ADA_PHONE}",
    ]
    lines = [
        "BEGIN:VEVENT",
        f"UID:apl-storytime-{ev['nid']}@tuchel.github.io",
        f"DTSTAMP:{now.strftime('%Y%m%dT%H%M%SZ')}",
        f"DTSTART;TZID={TZID}:{fmt_local(start)}",
        f"DTEND;TZID={TZID}:{fmt_local(end)}",
        f"SUMMARY:{ics_escape(ev['title'] + ' — ' + ev['branch'])}",
        f"LOCATION:{ics_escape(location)}",
        f"DESCRIPTION:{ics_escape(chr(10).join(p for p in desc if p is not None))}",
        f"URL:{ev['url']}",
        f"CATEGORIES:{ics_escape(ev['program'])}",
        "STATUS:CONFIRMED",
        "TRANSP:TRANSPARENT",
        "END:VEVENT",
    ]
    return "\r\n".join(fold_line(x) for x in lines)


VTIMEZONE = """BEGIN:VTIMEZONE
TZID:America/Chicago
X-LIC-LOCATION:America/Chicago
BEGIN:DAYLIGHT
TZNAME:CDT
TZOFFSETFROM:-0600
TZOFFSETTO:-0500
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZNAME:CST
TZOFFSETFROM:-0500
TZOFFSETTO:-0600
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE""".replace("\n", "\r\n")


def write_ics(events: list[dict], path: Path, now: datetime) -> None:
    blocks = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//tuchel-general//APL Storytime Fall 2026//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:APL Storytime Fall 2026",
        f"X-WR-TIMEZONE:{TZID}",
        "X-WR-CALDESC:Austin Public Library storytimes, 7 Sep–21 Nov 2026. Unofficial transcription of dated APL listings.",
        VTIMEZONE,
    ]
    for ev in events:
        blocks.append(vevent(ev, now))
    blocks.append("END:VCALENDAR")
    folded = []
    for block in blocks:
        for line in block.split("\r\n"):
            folded.append(fold_line(line))
    path.write_bytes(("\r\n".join(folded) + "\r\n").encode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scrape", action="store_true", help="Refresh listings from APL")
    args = parser.parse_args()
    PUBLIC.mkdir(parents=True, exist_ok=True)
    snapshot = DATA / "events_scraped.json"
    branches = load_branches()
    if args.scrape or not snapshot.exists():
        raw = scrape()
        snapshot.write_text(json.dumps(raw, indent=2, ensure_ascii=False) + "\n")
        print(f"wrote {snapshot} ({len(raw)} raw)")
    else:
        raw = json.loads(snapshot.read_text())
        print(f"loaded {snapshot} ({len(raw)} raw)")

    events = []
    for row in raw:
        ev = normalize(row, branches)
        if ev:
            events.append(ev)
    events.sort(key=lambda e: (e["start"], e["branch"], e["title"]))
    # Dedup identical start/branch/title (same program listed on two tag pages with different nids)
    deduped = []
    seen_keys = set()
    for ev in events:
        key = (ev["start"], ev["branch"], ev["title"])
        if key in seen_keys:
            continue
        seen_keys.add(key)
        deduped.append(ev)
    events = deduped

    now = datetime.now(timezone.utc).replace(microsecond=0)
    (PUBLIC / "events.json").write_text(json.dumps(events, indent=2, ensure_ascii=False) + "\n")
    write_ics(events, PUBLIC / "storytime.ics", now)
    (PUBLIC / "branches.json").write_text((DATA / "branches.json").read_text())
    (PUBLIC / "gaps.json").write_text((DATA / "gaps.json").read_text())
    print(f"{len(events)} events → {PUBLIC / 'storytime.ics'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
