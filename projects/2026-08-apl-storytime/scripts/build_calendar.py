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

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
WEB = ROOT / "web"
TZID = "America/Chicago"
SEASON_START = date(2026, 9, 7)
SEASON_END = date(2026, 11, 21)
CLOSED = {date(2026, 9, 6), date(2026, 9, 7), date(2026, 11, 11)}
CAL_URL = "https://tuchel.github.io/tuchel-general/storytime/"
ICS_HTTPS = CAL_URL + "storytime.ics"
SOURCE_INDEX = "https://library.austintexas.gov/events/storytimes"
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

FLYER_GAPS = [
    {
        "title": "All Ages Storytime",
        "branch": "Little Walnut Creek Branch",
        "when": "Wednesdays, 10:30 AM",
        "note": "On the flyer as weekly All Ages; no dated All Ages listing found at this branch in the scraped season.",
    },
    {
        "title": "Spanish-English Storytime",
        "branch": "Southeast Branch",
        "when": "Wednesdays, 11 AM",
        "note": "On the flyer as weekly; no dated listing found in the scraped season.",
    },
    {
        "title": "Books and Babies (0–12 months)",
        "branch": "Spicewood Springs Branch",
        "when": "Mondays, 2:00 PM",
        "note": "On the flyer as weekly; no dated listing found in the scraped season.",
    },
    {
        "title": "Books and Babies (0–12 months)",
        "branch": "Southeast Branch",
        "when": "Fridays, 12:30 PM",
        "note": "On the flyer as weekly; no dated listing found in the scraped season.",
    },
    {
        "title": "Toddler Storytime (1–3 years)",
        "branch": "Spicewood Springs Branch",
        "when": "Wednesdays, 10:15 AM",
        "note": "On the flyer as weekly; no dated listing found in the scraped season.",
    },
    {
        "title": "Preschool Storytime (3–5 years)",
        "branch": "Spicewood Springs Branch",
        "when": "Wednesdays, 11 AM",
        "note": "On the flyer as weekly; no dated listing found in the scraped season.",
    },
]


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
    start = datetime(year, month, day, start_t.hour, start_t.minute)
    end = datetime(year, month, day, end_t.hour, end_t.minute)
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
    return {
        "nid": raw["nid"],
        "title": title,
        "program": classify(title),
        "branch": branch,
        "start": start.isoformat(timespec="minutes"),
        "end": end.isoformat(timespec="minutes"),
        "url": href,
        "address": info.get("address", ""),
        "room": room,
        "source": "apl-listing",
    }


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


def html_page(events: list[dict]) -> str:
    payload = json.dumps(events, ensure_ascii=False)
    gaps = json.dumps(FLYER_GAPS, ensure_ascii=False)
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>APL Storytime Fall 2026</title>
  <style>
    :root {{
      color-scheme: light;
      --ink: #1a1916;
      --muted: #5c5852;
      --rule: #d8d2c8;
      --paper: #f7f4ef;
      --link: #0b3d91;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font: 16px/1.45 "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
      color: var(--ink);
      background: var(--paper);
    }}
    main {{ max-width: 52rem; margin: 0 auto; padding: 1.5rem 1.1rem 3rem; }}
    h1 {{ font-size: 1.55rem; font-weight: 600; margin: 0 0 0.35rem; letter-spacing: -0.02em; }}
    .lede {{ color: var(--muted); margin: 0 0 1.1rem; }}
    .subscribe {{
      display: flex; flex-wrap: wrap; gap: 0.55rem; margin: 0 0 1.25rem;
    }}
    .subscribe a {{
      display: inline-block;
      padding: 0.45rem 0.75rem;
      border: 1px solid var(--ink);
      color: var(--ink);
      text-decoration: none;
      font: 600 0.92rem/1.2 system-ui, -apple-system, sans-serif;
    }}
    .subscribe a.primary {{ background: var(--ink); color: var(--paper); }}
    .subscribe a:hover {{ outline: 2px solid var(--ink); outline-offset: 1px; }}
    label {{ font: 600 0.82rem/1.2 system-ui, sans-serif; color: var(--muted); }}
    .filters {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.6rem 0.8rem;
      margin: 0 0 0.85rem;
    }}
    select {{
      width: 100%;
      font: 15px/1.3 system-ui, sans-serif;
      padding: 0.35rem 0.4rem;
      border: 1px solid var(--rule);
      background: #fff;
      color: var(--ink);
    }}
    .count {{ font: 0.9rem/1.3 system-ui, sans-serif; color: var(--muted); margin: 0 0 0.6rem; }}
    table {{ width: 100%; border-collapse: collapse; font-size: 0.92rem; }}
    th, td {{ text-align: left; padding: 0.38rem 0.4rem 0.38rem 0; border-bottom: 1px solid var(--rule); vertical-align: top; }}
    th {{ font: 600 0.72rem/1.2 system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }}
    td a {{ color: var(--link); text-decoration: none; }}
    td a:hover {{ text-decoration: underline; }}
    .time {{ white-space: nowrap; font-variant-numeric: tabular-nums; }}
    footer {{ margin-top: 1.6rem; color: var(--muted); font-size: 0.88rem; }}
    footer a {{ color: var(--link); }}
    .gaps {{ margin: 1.4rem 0 0; padding: 0; }}
    .gaps li {{ margin: 0 0 0.45rem; }}
    @media (max-width: 640px) {{
      .filters {{ grid-template-columns: 1fr; }}
      table {{ font-size: 0.86rem; }}
      .hide-narrow {{ display: none; }}
    }}
  </style>
</head>
<body>
  <main>
    <h1>Austin Public Library storytime</h1>
    <p class="lede">7 September – 21 November 2026. Subscribe once; dated events from the library listings land on your calendar.</p>
    <div class="subscribe">
      <a class="primary" href="webcal://tuchel.github.io/tuchel-general/storytime/storytime.ics">Add to Apple Calendar</a>
      <a href="https://calendar.google.com/calendar/r?cid={ICS_HTTPS}">Add to Google Calendar</a>
      <a href="storytime.ics" download>Download .ics</a>
    </div>
    <div class="filters">
      <label>Branch
        <select id="branch"><option value="">All branches</option></select>
      </label>
      <label>Program
        <select id="program"><option value="">All programs</option></select>
      </label>
    </div>
    <p class="count" id="count"></p>
    <table>
      <thead>
        <tr>
          <th>When</th>
          <th>Program</th>
          <th>Branch</th>
        </tr>
      </thead>
      <tbody id="rows"></tbody>
    </table>
    <section>
      <h2 style="font-size:1.05rem;margin:1.6rem 0 0.4rem;">On the flyer, not in the dated listings</h2>
      <p class="lede">These weekly slots are on the printed Fall 2026 flyer but had no matching dated event on the library site when this feed was built. They are <em>not</em> on the subscribed calendar.</p>
      <ul class="gaps" id="gaps"></ul>
    </section>
    <footer>
      <p>Unofficial. Built from dated Austin Public Library event pages for the flyer window.
      Confirm at <a href="{SOURCE_INDEX}">library.austintexas.gov/events/storytimes</a>.
      Libraries closed Labor Day (6–7 Sep) and Veterans Day (11 Nov).
      ADA accommodations: <a href="tel:5129747400">{ADA_PHONE}</a>.</p>
      <p>Subscribe URL (any calendar that takes a webcal/ICS feed): <code>{ICS_HTTPS}</code></p>
    </footer>
  </main>
  <script type="application/json" id="events">{payload}</script>
  <script type="application/json" id="gaps-data">{gaps}</script>
  <script>
    const events = JSON.parse(document.getElementById("events").textContent);
    const gaps = JSON.parse(document.getElementById("gaps-data").textContent);
    const branchSel = document.getElementById("branch");
    const programSel = document.getElementById("program");
    const rows = document.getElementById("rows");
    const count = document.getElementById("count");
    const fmt = new Intl.DateTimeFormat("en-US", {{
      timeZone: "America/Chicago",
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit"
    }});
    const fmtTime = new Intl.DateTimeFormat("en-US", {{
      timeZone: "America/Chicago", hour: "numeric", minute: "2-digit"
    }});
    const esc = s => String(s).replace(/[&<>"']/g, c => ({{"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"}}[c]));
    const branches = [...new Set(events.map(e => e.branch))].sort();
    const programs = [...new Set(events.map(e => e.program))].sort();
    for (const b of branches) branchSel.insertAdjacentHTML("beforeend", `<option>${{esc(b)}}</option>`);
    for (const p of programs) programSel.insertAdjacentHTML("beforeend", `<option>${{esc(p)}}</option>`);
    function render() {{
      const b = branchSel.value, p = programSel.value;
      const list = events.filter(e => (!b || e.branch === b) && (!p || e.program === p));
      count.textContent = list.length + " programs";
      rows.innerHTML = list.map(e => {{
        const start = new Date(e.start);
        const end = new Date(e.end);
        const whenText = `${{fmt.format(start)}} – ${{fmtTime.format(end)}}`;
        const room = e.room ? `<div class="hide-narrow" style="color:#5c5852">${{esc(e.room)}}</div>` : "";
        return `<tr>
          <td class="time">${{esc(whenText)}}</td>
          <td><a href="${{esc(e.url)}}">${{esc(e.title)}}</a></td>
          <td>${{esc(e.branch)}}${{room}}</td>
        </tr>`;
      }}).join("");
    }}
    branchSel.addEventListener("change", render);
    programSel.addEventListener("change", render);
    document.getElementById("gaps").innerHTML = gaps.map(g =>
      `<li><strong>${{g.title}}</strong> — ${{g.branch}}, ${{g.when}}. ${{g.note}}</li>`
    ).join("");
    render();
  </script>
</body>
</html>
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--scrape", action="store_true", help="Refresh listings from APL")
    args = parser.parse_args()
    WEB.mkdir(parents=True, exist_ok=True)
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
    (WEB / "events.json").write_text(json.dumps(events, indent=2, ensure_ascii=False) + "\n")
    write_ics(events, WEB / "storytime.ics", now)
    (WEB / "index.html").write_text(html_page(events), encoding="utf-8")
    print(f"{len(events)} events → {WEB / 'storytime.ics'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
