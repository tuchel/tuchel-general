#!/usr/bin/env python3
"""Pull Salish Sea whale posts from public social APIs → web/public/data/social.json.

What works without secrets (2026-08):
  - Bluesky public AppView author feeds (CORS-open; searchPosts is CDN-blocked here)
  - Puget Sound Whales day threads via getPostThread (author replies only)
What does not (this environment):
  - X/Twitter — paid API; no credentials in env
  - Reddit — IP blocked (403) from this host
"""

from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw" / "social"
OUT = ROOT / "web" / "public" / "data"

BSKY = "https://public.api.bsky.app/xrpc"
PSW_HANDLE = "pugetsoundwhales.bsky.social"
# How many recent PSW day-root posts to expand into full threads
PSW_DAY_THREAD_LIMIT = 6

# Curated Salish Sea whale / sightings accounts (OBI starter pack + locals)
HANDLES = [
    PSW_HANDLE,
    "wscrqb.bsky.social",
    "orcanetwork.bsky.social",
    "orcabehaviorinstitute.org",
    "pacificwhalewatchassociation.com",
    "thewhalemuseum.bsky.social",
    "whaleresearch.bsky.social",
    "orcasound.bsky.social",
    "sanjuanorcas.bsky.social",
    "sjiwhalewatch.bsky.social",
    "acs-ps.bsky.social",
    "ourwildpugetsound.com",
    "orcavision.org",
]

# Longer / more specific place names first
PLACES: list[tuple[str, float, float, str]] = [
    ("lime kiln", 48.5158, -123.1526, "Lime Kiln"),
    ("cattle pass", 48.4505, -122.9635, "Cattle Pass"),
    ("hein bank", 48.366, -123.04, "Hein Bank"),
    ("salmon bank", 48.43, -122.99, "Salmon Bank"),
    ("false bay", 48.48, -123.07, "False Bay"),
    ("mitchell bay", 48.575, -123.17, "Mitchell Bay"),
    ("open bay", 48.58, -123.18, "Open Bay"),
    ("president channel", 48.65, -123.05, "President Channel"),
    ("san juan channel", 48.55, -123.0, "San Juan Channel"),
    ("haro strait", 48.55, -123.22, "Haro Strait"),
    ("rosario strait", 48.55, -122.75, "Rosario Strait"),
    ("active pass", 48.87, -123.3, "Active Pass"),
    ("boundary pass", 48.73, -123.15, "Boundary Pass"),
    ("friday harbor", 48.537, -123.016, "Friday Harbor"),
    ("roche harbor", 48.61, -123.16, "Roche Harbor"),
    ("eagle cove", 48.46, -123.03, "Eagle Cove"),
    ("american camp", 48.464, -123.0, "American Camp"),
    ("south beach", 48.46, -123.01, "South Beach SJI"),
    ("land bank", 48.52, -123.15, "Land Bank west side"),
    ("edward's point", 48.42, -122.67, "Edwards Point"),
    ("edwards point", 48.42, -122.67, "Edwards Point"),
    ("point robinson", 47.388, -122.374, "Point Robinson"),
    ("commencement bay", 47.28, -122.42, "Commencement Bay"),
    ("admiralty inlet", 48.1, -122.7, "Admiralty Inlet"),
    ("saratoga passage", 48.1, -122.5, "Saratoga Passage"),
    ("possession sound", 47.95, -122.25, "Possession Sound"),
    ("port susan", 48.15, -122.4, "Port Susan"),
    ("camano", 48.2, -122.45, "Camano Island"),
    ("elliott bay", 47.6, -122.38, "Elliott Bay"),
    ("elliot bay", 47.6, -122.38, "Elliott Bay"),
    ("hood canal", 47.7, -122.85, "Hood Canal"),
    ("apple tree point", 47.94, -122.45, "Apple Tree Point"),
    ("kingston", 47.81, -122.5, "Kingston"),
    ("richmond beach", 47.77, -122.39, "Richmond Beach"),
    ("carkeek", 47.71, -122.38, "Carkeek Park"),
    ("jefferson head", 47.75, -122.48, "Jefferson Head"),
    ("point jefferson", 47.75, -122.48, "Jefferson Head"),
    ("president point", 47.75, -122.44, "President Point"),
    ("prez pt", 47.75, -122.44, "President Point"),
    ("eglon", 47.87, -122.5, "Eglon"),
    ("langley", 48.04, -122.41, "Langley"),
    ("harbor island", 47.57, -122.35, "Harbor Island"),
    ("andrews bay", 47.64, -122.4, "Andrews Bay"),
    ("naval station everett", 48.0, -122.22, "Naval Station Everett"),
    ("navy base", 48.0, -122.22, "Naval Station Everett"),
    ("everett", 48.0, -122.2, "Everett"),
    ("tacoma", 47.27, -122.42, "Tacoma"),
    ("turn island", 48.53, -122.97, "Turn Island"),
    ("hat island", 48.02, -122.3, "Hat Island"),
    ("whidbey", 48.2, -122.6, "Whidbey Island"),
    ("orca island", 48.65, -122.95, "Orcas Island"),
    ("orcas island", 48.65, -122.95, "Orcas Island"),
    ("lopez island", 48.48, -122.89, "Lopez Island"),
    ("shaw island", 48.57, -122.95, "Shaw Island"),
    ("stuart island", 48.68, -123.2, "Stuart Island"),
    ("spock's ear", 48.52, -123.16, "Spock's Ear"),
    ("kellet bluff", 48.59, -123.2, "Kellet Bluff"),
    ("turn point", 48.69, -123.24, "Turn Point"),
    ("mandarte", 48.63, -123.3, "Mandarte"),
    ("sidney", 48.65, -123.4, "Sidney"),
    ("victoria", 48.42, -123.37, "Victoria"),
    ("race rocks", 48.3, -123.53, "Race Rocks"),
    ("swiftsure", 48.55, -124.75, "Swiftsure Bank"),
    ("juan de fuca", 48.3, -123.6, "Strait of Juan de Fuca"),
    ("puget sound", 47.7, -122.4, "Puget Sound"),
    ("salish sea", 48.5, -123.1, "Salish Sea"),
    ("san juan", 48.54, -123.1, "San Juan Island"),
    ("anacortes", 48.51, -122.61, "Anacortes"),
    ("port townsend", 48.12, -122.76, "Port Townsend"),
    ("bush point", 48.03, -122.61, "Bush Point"),
    ("campbell river", 50.02, -125.25, "Campbell River"),
    ("qualicum", 49.35, -124.45, "Qualicum"),
]

CETACEAN_RE = re.compile(
    r"\b(orca|orcas|killer\s*whale|srkw|bigg'?s|transient|resident|"
    r"humpback|gray\s*whale|grey\s*whale|minke|porpoise|cetacean|"
    r"whale|whales|j\s*pod|k\s*pod|l\s*pod)\b",
    re.I,
)

SIGHTING_HINT_RE = re.compile(
    r"\b(reported|sighting|spotted|seen|northbound|southbound|eastbound|westbound|"
    r"foraging|milling|breaching|spyhop|vocaliz|calls?\b|blow|fluke)\b",
    re.I,
)

CRYPTO_NOISE_RE = re.compile(
    r"\$btc|\$xrp|\$eth|\$usdc|\$usdt|#ripple|transferred from|unlocked at|"
    r"unknown wallet|crypto",
    re.I,
)

DIRECTION_RE = re.compile(
    r"\b(northbound|southbound|eastbound|westbound|inbound|outbound)\b|\b(NB|SB|EB|WB)\b",
    re.I,
)

# PSW day-root headers: "Mon, Aug 3" / "Sun, Aug 2"
DAY_ROOT_RE = re.compile(
    r"\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+"
    r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b",
    re.I,
)
# Timed updates inside a day thread: "07:50 - …" / "10:12- …"
CLOCK_RE = re.compile(r"\b(\d{1,2}):(\d{2})\s*[-–—]")
SPECIES_HEADER_RE = re.compile(
    r"\b(ORCAS?|SRKWs?|HUMPBACKS?|GRAYS?|BIGG|TRANSIENT|PORPOISE|DOLPHIN)\b",
    re.I,
)

BBOX = dict(south=47.0, north=50.3, west=-125.5, east=-122.0)
FOCUS = dict(south=48.3, north=48.95, west=-123.45, east=-122.55)


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "tuchel-general-whale-map/0.1 (social ingest; +https://github.com/tuchel/tuchel-general)",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        return json.loads(resp.read().decode("utf-8"))


def strip_urls(text: str) -> str:
    return re.sub(r"https?://\S+", "", text).strip()


def detect_species(text: str) -> str:
    t = text.lower()
    if re.search(r"\b(srkw|southern\s*resident|j\s*pod|k\s*pod|l\s*pod)\b", t):
        return "srkw"
    if re.search(r"\b(bigg|transient|t[- ]?\d)\b", t):
        return "biggs"
    if "humpback" in t or "humpy" in t:
        return "humpback"
    if re.search(r"\bgr[ae]y\s*whale", t) or re.search(r"\bgrays?\b", t):
        return "gray"
    if "minke" in t:
        return "minke"
    if "porpoise" in t:
        return "porpoise"
    if re.search(r"\b(orca|killer\s*whale)\b", t):
        return "orca_unspecified"
    if re.search(r"\bwhales?\b", t):
        return "other_cetacean"
    return "unknown"


def geocode(text: str) -> tuple[float, float, str] | None:
    low = text.lower()
    for needle, lat, lon, label in PLACES:
        if needle in low:
            return lat, lon, label
    return None


def in_box(lat: float, lon: float, box: dict) -> bool:
    return box["south"] <= lat <= box["north"] and box["west"] <= lon <= box["east"]


def post_url(handle: str, uri: str) -> str:
    # at://did:plc:xxx/app.bsky.feed.post/RKEY
    rkey = uri.rsplit("/", 1)[-1]
    return f"https://bsky.app/profile/{handle}/post/{rkey}"


def detect_direction(text: str) -> str | None:
    m = DIRECTION_RE.search(text)
    if not m:
        return None
    raw = m.group(1) or m.group(2) or ""
    abbr = {"NB": "northbound", "SB": "southbound", "EB": "eastbound", "WB": "westbound"}
    return abbr.get(raw.upper(), raw.lower())


def day_label_from_text(text: str) -> str | None:
    m = DAY_ROOT_RE.search(text or "")
    return m.group(0) if m else None


def is_day_root(record: dict) -> bool:
    if record.get("reply"):
        return False
    return bool(DAY_ROOT_RE.search(record.get("text") or ""))


def relevant(text: str, handle: str) -> bool:
    if CRYPTO_NOISE_RE.search(text):
        return False
    if handle == PSW_HANDLE:
        # Keep day roots + timed/species updates; drop alt-text nag / fan replies
        if DAY_ROOT_RE.search(text):
            return True
        if CLOCK_RE.search(text):
            return True
        if SPECIES_HEADER_RE.search(text) and len(text) > 40:
            return True
        if CETACEAN_RE.search(text) and (SIGHTING_HINT_RE.search(text) or len(text) > 80):
            return True
        return False
    if handle == "wscrqb.bsky.social":
        return bool(text.strip()) and not CRYPTO_NOISE_RE.search(text)
    return bool(CETACEAN_RE.search(text))


def post_to_row(
    post: dict,
    *,
    fallback_handle: str,
    thread_root_id: str | None = None,
    day_label: str | None = None,
    role: str = "standalone",
) -> dict | None:
    record = post.get("record") or {}
    if record.get("$type") and record["$type"] != "app.bsky.feed.post":
        return None
    text = record.get("text") or ""
    author = post.get("author") or {}
    h = author.get("handle") or fallback_handle
    if not text or not relevant(text, h):
        return None
    uri = post.get("uri") or ""
    created = record.get("createdAt") or post.get("indexedAt") or ""
    geo = geocode(text)
    reply = record.get("reply") or {}
    root_uri = (reply.get("root") or {}).get("uri") or (uri if role == "day_root" else None)
    return {
        "id": uri or f"{h}:{created}",
        "platform": "bluesky",
        "handle": h,
        "displayName": author.get("displayName") or h,
        "text": strip_urls(text)[:400],
        "createdAt": created,
        "url": post_url(h, uri) if uri else f"https://bsky.app/profile/{h}",
        "species": detect_species(text),
        "place": geo[2] if geo else None,
        "lat": geo[0] if geo else None,
        "lon": geo[1] if geo else None,
        "geocodePrecision": "place_name" if geo else "none",
        "sightingHint": bool(SIGHTING_HINT_RE.search(text) or CLOCK_RE.search(text)),
        "direction": detect_direction(text),
        "threadRootId": thread_root_id or root_uri,
        "dayLabel": day_label,
        "role": role,
    }


def pull_author(handle: str, limit: int = 60) -> list[dict]:
    q = urllib.parse.urlencode({"actor": handle, "limit": str(limit)})
    data = fetch_json(f"{BSKY}/app.bsky.feed.getAuthorFeed?{q}")
    out = []
    for item in data.get("feed") or []:
        post = item.get("post") or {}
        record = post.get("record") or {}
        role = "day_root" if handle == PSW_HANDLE and is_day_root(record) else "standalone"
        day = day_label_from_text(record.get("text") or "") if role == "day_root" else None
        row = post_to_row(post, fallback_handle=handle, day_label=day, role=role)
        if row:
            if role == "day_root":
                row["threadRootId"] = row["id"]
            out.append(row)
    return out


def walk_author_posts(node: dict | None, author_handle: str, out: list[dict]) -> None:
    if not node:
        return
    post = node.get("post")
    if post:
        h = ((post.get("author") or {}).get("handle")) or ""
        if h == author_handle:
            out.append(post)
    for child in node.get("replies") or []:
        walk_author_posts(child, author_handle, out)


def pull_psw_day_threads(limit: int = PSW_DAY_THREAD_LIMIT) -> tuple[list[dict], list[dict]]:
    """Expand recent PSW day-root posts into full author-only threads."""
    q = urllib.parse.urlencode({"actor": PSW_HANDLE, "limit": "100"})
    feed = fetch_json(f"{BSKY}/app.bsky.feed.getAuthorFeed?{q}")
    roots: list[dict] = []
    for item in feed.get("feed") or []:
        post = item.get("post") or {}
        record = post.get("record") or {}
        if is_day_root(record):
            roots.append(post)
        if len(roots) >= limit:
            break

    threads: list[dict] = []
    posts: list[dict] = []
    for root in roots:
        uri = root.get("uri") or ""
        if not uri:
            continue
        try:
            thr = fetch_json(
                f"{BSKY}/app.bsky.feed.getPostThread?"
                + urllib.parse.urlencode({"uri": uri, "depth": "110"})
            )
        except Exception as e:  # noqa: BLE001
            print(f"  FAIL thread {uri[-16:]}: {e}")
            continue
        author_posts: list[dict] = []
        walk_author_posts(thr.get("thread"), PSW_HANDLE, author_posts)
        day = day_label_from_text((root.get("record") or {}).get("text") or "") or "Day log"
        updates: list[dict] = []
        for post in author_posts:
            is_root = post.get("uri") == uri
            row = post_to_row(
                post,
                fallback_handle=PSW_HANDLE,
                thread_root_id=uri,
                day_label=day,
                role="day_root" if is_root else "update",
            )
            if not row:
                continue
            posts.append(row)
            if not is_root:
                updates.append(row)
        updates.sort(key=lambda p: p.get("createdAt") or "")
        root_row = next((p for p in posts if p["id"] == uri), None)
        threads.append(
            {
                "id": uri,
                "dateLabel": day,
                "createdAt": (root.get("record") or {}).get("createdAt")
                or root.get("indexedAt")
                or "",
                "url": post_url(PSW_HANDLE, uri),
                "summary": strip_urls(((root.get("record") or {}).get("text") or ""))[:500],
                "handle": PSW_HANDLE,
                "displayName": ((root.get("author") or {}).get("displayName") or "Puget Sound Whales"),
                "updateCount": len(updates),
                "mappedCount": sum(1 for u in updates if u.get("lat") is not None),
                "updates": updates,
                "root": root_row,
            }
        )
        print(f"  PSW thread {day}: {len(updates)} updates ({sum(1 for u in updates if u.get('lat') is not None)} mapped)")
    threads.sort(key=lambda t: t.get("createdAt") or "", reverse=True)
    return threads, posts


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    posts: list[dict] = []
    errors: list[str] = []
    day_threads: list[dict] = []

    for handle in HANDLES:
        try:
            rows = pull_author(handle, limit=80 if handle == PSW_HANDLE else 60)
            posts.extend(rows)
            print(f"  {handle}: {len(rows)} relevant posts")
            (RAW / f"{handle.replace('.', '_').replace('/', '_')}.json").write_text(
                json.dumps(rows, indent=2), encoding="utf-8"
            )
        except Exception as e:  # noqa: BLE001 — collect per-account failures
            msg = f"{handle}: {e}"
            errors.append(msg)
            print(f"  FAIL {msg}")

    try:
        print("Expanding Puget Sound Whales day threads…")
        day_threads, thread_posts = pull_psw_day_threads()
        posts.extend(thread_posts)
        (RAW / "pugetsoundwhales_day_threads.json").write_text(
            json.dumps(day_threads, indent=2), encoding="utf-8"
        )
    except Exception as e:  # noqa: BLE001
        msg = f"PSW day threads: {e}"
        errors.append(msg)
        print(f"  FAIL {msg}")

    # Dedupe by id (thread expansion wins on richer role/dayLabel)
    by_id: dict[str, dict] = {}
    for p in posts:
        prev = by_id.get(p["id"])
        if prev is None or (p.get("role") in ("day_root", "update") and prev.get("role") == "standalone"):
            by_id[p["id"]] = p
    posts = list(by_id.values())
    posts.sort(key=lambda p: p.get("createdAt") or "", reverse=True)

    mapped = [
        p
        for p in posts
        if p["lat"] is not None
        and p["lon"] is not None
        and in_box(p["lat"], p["lon"], BBOX)
    ]
    focus = [p for p in mapped if in_box(p["lat"], p["lon"], FOCUS)]

    fc = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {k: v for k, v in p.items() if k not in ("lat", "lon")},
                "geometry": {"type": "Point", "coordinates": [p["lon"], p["lat"]]},
            }
            for p in mapped
        ],
    }

    meta = {
        "builtAt": datetime.now(timezone.utc).isoformat(),
        "platforms": {
            "bluesky": {
                "status": "ok",
                "method": "public AppView getAuthorFeed + getPostThread (PSW day logs)",
                "handles": HANDLES,
                "dayThreadHandle": PSW_HANDLE,
            },
            "x": {
                "status": "unavailable",
                "reason": "X API requires paid credentials; none configured in this environment",
            },
            "reddit": {
                "status": "blocked",
                "reason": "Reddit returns 403 from this host (bot wall); no OAuth app configured",
            },
        },
        "counts": {
            "posts": len(posts),
            "geocoded": len(mapped),
            "inSanJuanFocus": len(focus),
            "dayThreads": len(day_threads),
            "dayUpdates": sum(t.get("updateCount", 0) for t in day_threads),
            "errors": len(errors),
        },
        "errors": errors,
        "caveat": (
            "Coords are gazetteer matches on place names in post text — approximate, "
            "not GPS. Social reports are unverified and often duplicate Acartia / Orca Network. "
            "Puget Sound Whales day threads are author posts only (public replies omitted)."
        ),
    }

    # Newest cetacean post by time; quality only breaks ties within 2h.
    def quality(p: dict) -> int:
        score = 0
        if p.get("sightingHint"):
            score += 4
        if p.get("place"):
            score += 3
        if p.get("lat") is not None:
            score += 1
        if p.get("direction"):
            score += 1
        if p.get("handle") in (
            PSW_HANDLE,
            "wscrqb.bsky.social",
            "orcanetwork.bsky.social",
        ):
            score += 2
        if p.get("role") == "update":
            score += 1
        return score

    candidates = sorted(
        [p for p in posts if p.get("species") not in (None, "unknown") and p.get("role") != "day_root"],
        key=lambda p: p.get("createdAt") or "",
        reverse=True,
    )
    latest = None
    if candidates:
        newest = candidates[0]

        def parse_t(p: dict) -> datetime | None:
            try:
                return datetime.fromisoformat((p.get("createdAt") or "").replace("Z", "+00:00"))
            except ValueError:
                return None

        newest_t = parse_t(newest)
        if newest_t is None:
            latest = newest
        else:
            near = []
            for p in candidates:
                t = parse_t(p)
                if t is not None and (newest_t - t).total_seconds() <= 2 * 3600:
                    near.append(p)
            pool = near or [newest]
            latest = max(pool, key=lambda p: (quality(p), p.get("createdAt") or ""))

    # Trim thread update payloads for the baked JSON (full updates kept, roots light)
    threads_out = []
    for t in day_threads:
        threads_out.append(
            {
                "id": t["id"],
                "dateLabel": t["dateLabel"],
                "createdAt": t["createdAt"],
                "url": t["url"],
                "summary": t["summary"],
                "handle": t["handle"],
                "displayName": t["displayName"],
                "updateCount": t["updateCount"],
                "mappedCount": t["mappedCount"],
                "updates": t["updates"],
            }
        )

    payload = {
        "meta": meta,
        "latest": latest,
        "dayThreads": threads_out,
        "posts": posts[:280],
        "geojson": fc,
    }

    out_path = OUT / "social.json"
    out_path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(
        f"Wrote {out_path.relative_to(ROOT)} — {len(posts)} posts, "
        f"{len(mapped)} geocoded, {len(focus)} in SJ focus, "
        f"{len(day_threads)} day threads"
    )


if __name__ == "__main__":
    main()
