#!/usr/bin/env python3
"""Pull Salish Sea whale posts from public social APIs → web/public/data/social.json.

What works without secrets (2026-08):
  - Bluesky public AppView author feeds (CORS-open; searchPosts is CDN-blocked here)
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

# Curated Salish Sea whale / sightings accounts (OBI starter pack + locals)
HANDLES = [
    "pugetsoundwhales.bsky.social",
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
    "whale-alert.io",
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


def relevant(text: str, handle: str) -> bool:
    if handle in (
        "pugetsoundwhales.bsky.social",
        "wscrqb.bsky.social",
    ):
        return bool(text.strip())
    return bool(CETACEAN_RE.search(text))


def pull_author(handle: str, limit: int = 60) -> list[dict]:
    q = urllib.parse.urlencode({"actor": handle, "limit": str(limit)})
    data = fetch_json(f"{BSKY}/app.bsky.feed.getAuthorFeed?{q}")
    out = []
    for item in data.get("feed") or []:
        post = item.get("post") or {}
        record = post.get("record") or {}
        if record.get("$type") and record["$type"] != "app.bsky.feed.post":
            continue
        text = record.get("text") or ""
        if not text or not relevant(text, handle):
            continue
        author = post.get("author") or {}
        h = author.get("handle") or handle
        uri = post.get("uri") or ""
        created = record.get("createdAt") or post.get("indexedAt") or ""
        geo = geocode(text)
        species = detect_species(text)
        row = {
            "id": uri or f"{h}:{created}",
            "platform": "bluesky",
            "handle": h,
            "displayName": author.get("displayName") or h,
            "text": strip_urls(text)[:400],
            "createdAt": created,
            "url": post_url(h, uri) if uri else f"https://bsky.app/profile/{h}",
            "species": species,
            "place": geo[2] if geo else None,
            "lat": geo[0] if geo else None,
            "lon": geo[1] if geo else None,
            "geocodePrecision": "place_name" if geo else "none",
            "sightingHint": bool(SIGHTING_HINT_RE.search(text)),
        }
        out.append(row)
    return out


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    posts: list[dict] = []
    errors: list[str] = []
    for handle in HANDLES:
        try:
            rows = pull_author(handle)
            posts.extend(rows)
            print(f"  {handle}: {len(rows)} relevant posts")
            (RAW / f"{handle.replace('.', '_').replace('/', '_')}.json").write_text(
                json.dumps(rows, indent=2), encoding="utf-8"
            )
        except Exception as e:  # noqa: BLE001 — collect per-account failures
            msg = f"{handle}: {e}"
            errors.append(msg)
            print(f"  FAIL {msg}")

    # Dedupe by id
    by_id: dict[str, dict] = {}
    for p in posts:
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
                "method": "public AppView getAuthorFeed",
                "handles": HANDLES,
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
            "errors": len(errors),
        },
        "errors": errors,
        "caveat": (
            "Coords are gazetteer matches on place names in post text — approximate, "
            "not GPS. Social reports are unverified and often duplicate Acartia / Orca Network."
        ),
    }

    payload = {
        "meta": meta,
        "posts": posts[:200],
        "geojson": fc,
    }

    out_path = OUT / "social.json"
    out_path.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(
        f"Wrote {out_path.relative_to(ROOT)} — {len(posts)} posts, "
        f"{len(mapped)} geocoded, {len(focus)} in SJ focus"
    )


if __name__ == "__main__":
    main()
