#!/usr/bin/env python3
"""Pull public whale datasets and emit JSON for the San Juan whale-odds map."""

from __future__ import annotations

import csv
import io
import json
import math
import urllib.request
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw"
OUT = ROOT / "web" / "public" / "data"

# San Juan archipelago focus (slightly wider for approaches)
BBOX = dict(south=48.30, north=48.95, west=-123.45, east=-122.55)

SALISHSEA_ZIP = "https://salishsea.io/dwca/salishsea-occurrences-v1.zip"
ACARTIA_CURRENT = "https://acartia.io/api/v1/sightings/current"
NOAA_CH = (
    "https://maps.fisheries.noaa.gov/server/rest/services/"
    "All_NMFS_Critical_Habitat/MapServer/195/query"
)

# Hex size ~0.04° ≈ 3–4 km — readable at island scale
HEX_SIZE = 0.04

CETACEAN_PREFIXES = (
    "Orcinus",
    "Megaptera",
    "Eschrichtius",
    "Balaenoptera",
    "Physeter",
    "Phocoena",
    "Phocoenoides",
    "Sagmatias",
    "Lagenorhynchus",
    "Delphinus",
)


def species_bucket(scientific_name: str) -> str | None:
    n = (scientific_name or "").strip()
    if n.startswith("Orcinus orca ater"):
        return "srkw"
    if n.startswith("Orcinus orca rectipinnus"):
        return "biggs"
    if n.startswith("Orcinus"):
        return "orca_unspecified"
    if n.startswith("Megaptera"):
        return "humpback"
    if n.startswith("Eschrichtius"):
        return "gray"
    if n.startswith("Balaenoptera acutorostrata"):
        return "minke"
    if n.startswith("Balaenoptera"):
        return "other_baleen"
    if n.startswith("Phocoena") or n.startswith("Phocoenoides"):
        return "porpoise"
    if any(n.startswith(p) for p in CETACEAN_PREFIXES):
        return "other_cetacean"
    return None


def acartia_bucket(type_str: str, comments: str = "") -> str | None:
    t = (type_str or "").lower()
    c = (comments or "").lower()
    if "humpback" in t:
        return "humpback"
    if "gray" in t:
        return "gray"
    if "minke" in t:
        return "minke"
    if "porpoise" in t:
        return "porpoise"
    if "orca" in t or "killer" in t:
        if "bigg" in c or "transient" in c or "t-" in c:
            return "biggs"
        if "resident" in c or "j pod" in c or "k pod" in c or "l pod" in c or "srkw" in c:
            return "srkw"
        return "orca_unspecified"
    if "unspecified" in t or not t:
        return None
    return "other_cetacean"


def in_bbox(lat: float, lon: float) -> bool:
    return BBOX["south"] <= lat <= BBOX["north"] and BBOX["west"] <= lon <= BBOX["east"]


def axial_hex(lon: float, lat: float, size: float = HEX_SIZE) -> tuple[int, int]:
    """Pointy-top axial coords from lon/lat (degrees treated as planar locally)."""
    x, y = lon, lat
    q = (math.sqrt(3) / 3 * x - 1 / 3 * y) / size
    r = (2 / 3 * y) / size
    return cube_round(q, r)


def cube_round(q: float, r: float) -> tuple[int, int]:
    s = -q - r
    rq, rr, rs = round(q), round(r), round(s)
    dq, dr, ds = abs(rq - q), abs(rr - r), abs(rs - s)
    if dq > dr and dq > ds:
        rq = -rr - rs
    elif dr > ds:
        rr = -rq - rs
    return int(rq), int(rr)


def hex_center(q: int, r: int, size: float = HEX_SIZE) -> tuple[float, float]:
    lon = size * (math.sqrt(3) * q + math.sqrt(3) / 2 * r)
    lat = size * (1.5 * r)
    return lon, lat


def hex_polygon(q: int, r: int, size: float = HEX_SIZE) -> list[list[float]]:
    cx, cy = hex_center(q, r, size)
    ring = []
    for i in range(6):
        angle = math.radians(60 * i - 30)
        ring.append([cx + size * math.cos(angle), cy + size * math.sin(angle)])
    ring.append(ring[0])
    return ring


def fetch(url: str, dest: Path | None = None) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "tuchel-general-whale-map/0.1"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = resp.read()
    if dest:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
    return data


def load_salishsea() -> list[dict]:
    zpath = RAW / "salishsea-occurrences-v1.zip"
    print("Downloading SalishSea.io DWCA…")
    fetch(SALISHSEA_ZIP, zpath)
    with zipfile.ZipFile(zpath) as zf:
        text = zf.read("occurrence.txt").decode("utf-8", errors="replace")
    reader = csv.DictReader(io.StringIO(text), delimiter="\t")
    out = []
    for row in reader:
        bucket = species_bucket(row.get("scientificName") or "")
        if not bucket:
            continue
        try:
            lat = float(row["decimalLatitude"])
            lon = float(row["decimalLongitude"])
        except (KeyError, TypeError, ValueError):
            continue
        if not in_bbox(lat, lon):
            continue
        ed = row.get("eventDate") or ""
        out.append(
            {
                "lat": lat,
                "lon": lon,
                "species": bucket,
                "scientificName": row.get("scientificName"),
                "date": ed[:10] if len(ed) >= 10 else ed,
                "month": int(ed[5:7]) if len(ed) >= 7 and ed[5:7].isdigit() else None,
                "year": int(ed[:4]) if len(ed) >= 4 and ed[:4].isdigit() else None,
                "hour": _hour_from_iso(ed),
                "count": _int_or_none(row.get("individualCount")),
                "source": "salishsea.io",
                "remarks": (row.get("occurrenceRemarks") or "")[:240],
            }
        )
    print(f"  SalishSea in-bbox cetacean rows: {len(out)}")
    return out


def _hour_from_iso(ed: str) -> int | None:
    # 2026-07-16T18:00:43Z or with offset
    if "T" not in ed:
        return None
    try:
        t = ed.split("T", 1)[1]
        return int(t[0:2])
    except (IndexError, ValueError):
        return None


def _int_or_none(v) -> int | None:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def load_acartia() -> list[dict]:
    print("Fetching Acartia current sightings…")
    raw = fetch(ACARTIA_CURRENT, RAW / "acartia-current.json")
    data = json.loads(raw)
    out = []
    for d in data:
        try:
            lat = float(d["latitude"])
            lon = float(d["longitude"])
        except (KeyError, TypeError, ValueError):
            continue
        if not in_bbox(lat, lon):
            continue
        comments = d.get("data_source_comments") or ""
        bucket = acartia_bucket(d.get("type") or "", comments)
        if not bucket:
            continue
        created = d.get("created") or ""
        out.append(
            {
                "id": d.get("ssemmi_id") or d.get("entry_id"),
                "lat": lat,
                "lon": lon,
                "species": bucket,
                "label": d.get("type"),
                "date": created[:10],
                "created": created,
                "count": _int_or_none(d.get("no_sighted")),
                "trusted": bool(d.get("trusted")),
                "source": d.get("data_source_entity") or d.get("data_source_name") or "Acartia",
                "remarks": comments[:280],
                "photo": d.get("photo_url") or None,
            }
        )
    print(f"  Acartia in-bbox: {len(out)}")
    return out


def load_critical_habitat() -> dict:
    print("Fetching NOAA SRKW critical habitat (bbox)…")
    params = (
        f"?where=1%3D1"
        f"&geometry={BBOX['west']}%2C{BBOX['south']}%2C{BBOX['east']}%2C{BBOX['north']}"
        f"&geometryType=esriGeometryEnvelope&inSR=4326"
        f"&spatialRel=esriSpatialRelIntersects"
        f"&outFields=UNIT%2CSCIENAME%2CCHSTATUS"
        f"&returnGeometry=true&outSR=4326&f=geojson"
    )
    raw = fetch(NOAA_CH + params, RAW / "srkw_critical_habitat.geojson")
    geo = json.loads(raw)

    try:
        from shapely.geometry import box, mapping, shape
        from shapely.ops import unary_union
    except ImportError as e:
        raise SystemExit("Install shapely to simplify habitat polygons: pip install shapely") from e

    clip = box(BBOX["west"], BBOX["south"], BBOX["east"], BBOX["north"])
    features = []
    for f in geo.get("features", []):
        props = f.get("properties") or {}
        unit = props.get("UNIT") or props.get("unit") or ""
        # Focus on the summer core + Juan de Fuca approaches; skip distant Puget Sound unit
        if "Puget Sound" in str(unit):
            continue
        geom = shape(f["geometry"]).intersection(clip)
        if geom.is_empty:
            continue
        # ~80–150 m tolerance in degrees at this latitude
        simplified = geom.simplify(0.002, preserve_topology=True)
        if simplified.is_empty:
            continue
        # Multi→single collection as GeoJSON
        gj = mapping(simplified)
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "unit": unit,
                    "status": props.get("CHSTATUS") or props.get("chstatus"),
                    "species": props.get("SCIENAME") or "Orcinus orca",
                },
                "geometry": gj,
            }
        )
    # Optional merged outline for a light fill
    if features:
        merged = unary_union([shape(f["geometry"]) for f in features]).simplify(0.003, preserve_topology=True)
        features.insert(
            0,
            {
                "type": "Feature",
                "properties": {
                    "unit": "SRKW critical habitat (simplified, clipped)",
                    "status": "Final",
                    "species": "Orcinus orca",
                    "merged": True,
                },
                "geometry": mapping(merged),
            },
        )
    print(f"  Habitat features (simplified): {len(features)}")
    return {"type": "FeatureCollection", "features": features}


def build_hexes(rows: list[dict]) -> dict:
    cells: dict[tuple[int, int], dict] = {}
    for row in rows:
        if row["month"] is None:
            continue
        key = axial_hex(row["lon"], row["lat"])
        cell = cells.setdefault(
            key,
            {
                "q": key[0],
                "r": key[1],
                "total": 0,
                "bySpecies": Counter(),
                "byMonth": Counter(),
                "bySpeciesMonth": Counter(),
                "byHour": Counter(),
            },
        )
        cell["total"] += 1
        cell["bySpecies"][row["species"]] += 1
        cell["byMonth"][row["month"]] += 1
        cell["bySpeciesMonth"][(row["species"], row["month"])] += 1
        if row.get("hour") is not None:
            cell["byHour"][row["hour"]] += 1

    features = []
    for (q, r), cell in cells.items():
        lon, lat = hex_center(q, r)
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "q": q,
                    "r": r,
                    "total": cell["total"],
                    "bySpecies": dict(cell["bySpecies"]),
                    "byMonth": {str(k): v for k, v in sorted(cell["byMonth"].items())},
                    "bySpeciesMonth": {
                        f"{s}:{m}": v for (s, m), v in cell["bySpeciesMonth"].items()
                    },
                    "byHour": {str(k): v for k, v in sorted(cell["byHour"].items())},
                    "lon": round(lon, 5),
                    "lat": round(lat, 5),
                },
                "geometry": {"type": "Polygon", "coordinates": [hex_polygon(q, r)]},
            }
        )
    return {"type": "FeatureCollection", "features": features}


def build_seasonality(rows: list[dict]) -> dict:
    grid = defaultdict(Counter)  # species -> month -> count
    hours = defaultdict(Counter)
    years = Counter()
    for row in rows:
        if row["month"]:
            grid[row["species"]][row["month"]] += 1
        if row.get("hour") is not None:
            hours[row["species"]][row["hour"]] += 1
        if row.get("year"):
            years[row["year"]] += 1
    return {
        "bySpeciesMonth": {
            sp: {str(m): grid[sp][m] for m in range(1, 13)} for sp in sorted(grid)
        },
        "bySpeciesHour": {
            sp: {str(h): hours[sp][h] for h in range(24)} for sp in sorted(hours)
        },
        "yearCounts": {str(y): years[y] for y in sorted(years)},
        "total": len(rows),
    }


def curated_hotspots() -> list[dict]:
    """Named zones with qualitative priors — citations in notes/sources.md."""
    return [
        {
            "id": "haro-west-side",
            "name": "Haro Strait — west side",
            "kind": "corridor",
            "speciesPriors": ["srkw", "humpback", "orca_unspecified"],
            "bestMonths": [5, 6, 7, 8, 9],
            "lat": 48.516,
            "lon": -123.152,
            "radiusKm": 6,
            "why": "Deep water close to shore; classic Southern Resident travel line past Lime Kiln and County Park.",
            "tip": "Work a slow parallel track offshore of the lighthouse; don’t cut between whales and the rocks.",
        },
        {
            "id": "lime-kiln",
            "name": "Lime Kiln Point",
            "kind": "landmark",
            "speciesPriors": ["srkw", "orca_unspecified", "humpback", "minke"],
            "bestMonths": [5, 6, 7, 8, 9],
            "lat": 48.5158,
            "lon": -123.1525,
            "radiusKm": 1.5,
            "why": "WA Parks “Whale Watch Park”; hydrophone + heavy historical sighting effort.",
            "tip": "Even from a boat, treat the nearshore as a viewing gallery — give shore watchers and whales room.",
        },
        {
            "id": "county-park",
            "name": "San Juan County Park / Smallpox Bay",
            "kind": "landmark",
            "speciesPriors": ["srkw", "orca_unspecified"],
            "bestMonths": [5, 6, 7, 8, 9],
            "lat": 48.541,
            "lon": -123.167,
            "radiusKm": 2,
            "why": "Next public west-side waypoint north of Lime Kiln on the Haro corridor.",
            "tip": "Kayak traffic common; keep wash down near Smallpox Bay.",
        },
        {
            "id": "cattle-pass",
            "name": "Cattle Pass / southern tips",
            "kind": "foraging",
            "speciesPriors": ["biggs", "orca_unspecified", "porpoise"],
            "bestMonths": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
            "lat": 48.45,
            "lon": -122.96,
            "radiusKm": 5,
            "why": "Seal and sea lion habitat draws Bigg’s (transient) orcas year-round.",
            "tip": "Strong currents; watch tide rips. Good Bigg’s backup if Haro is quiet.",
        },
        {
            "id": "heinrich-heavens",
            "name": "Southern Haro / Hein Bank approaches",
            "kind": "corridor",
            "speciesPriors": ["srkw", "humpback", "minke"],
            "bestMonths": [5, 6, 7, 8, 9, 10],
            "lat": 48.42,
            "lon": -123.05,
            "radiusKm": 7,
            "why": "Open water south of the island where travel and bait can concentrate; longer run from Friday Harbor.",
            "tip": "Check sea state before committing — this is where a rental day gets sporty.",
        },
        {
            "id": "spieden",
            "name": "Spieden Channel",
            "kind": "secondary",
            "speciesPriors": ["biggs", "orca_unspecified", "humpback"],
            "bestMonths": [4, 5, 6, 7, 8, 9, 10],
            "lat": 48.64,
            "lon": -123.12,
            "radiusKm": 4,
            "why": "Northern pass traffic; occasional Bigg’s and mysticetes.",
            "tip": "Ferry and recreational traffic; keep a sharp lookout.",
        },
    ]


def launch_points() -> list[dict]:
    return [
        {
            "id": "friday-harbor",
            "name": "Friday Harbor",
            "lat": 48.535,
            "lon": -123.016,
            "note": "Main rental / ferry hub. Budget ~45–75 min to west-side Haro depending on boat and sea state.",
        },
        {
            "id": "roche-harbor",
            "name": "Roche Harbor",
            "lat": 48.608,
            "lon": -123.156,
            "note": "Shorter hop to north and west corridors; resort harbor.",
        },
        {
            "id": "snug-harbor",
            "name": "Snug Harbor / Mitchell Bay",
            "lat": 48.572,
            "lon": -123.172,
            "note": "West-side jump-off closer to the Haro travel line.",
        },
        {
            "id": "deer-harbor",
            "name": "Deer Harbor (Orcas)",
            "lat": 48.618,
            "lon": -123.003,
            "note": "Neighboring island start; useful if your rental is on Orcas.",
        },
        {
            "id": "anacortes",
            "name": "Anacortes / Cap Sante area",
            "lat": 48.511,
            "lon": -122.607,
            "note": "Mainland start — plan fuel and crossing time before island loops.",
        },
    ]


def etiquette() -> dict:
    return {
        "title": "Be Whale Wise — killer whales",
        "rules": [
            "Stay at least 200 yards (183 m) from killer whales in Washington inland waters.",
            "Go slow when whales are nearby; avoid sudden course changes across their path.",
            "If whales approach you, put the engine in neutral and let them pass.",
            "Never pursue, encircle, or trap whales against the shore.",
            "Limit viewing time; give commercial research and monitoring vessels room.",
        ],
        "url": "https://www.bewhalewise.org/",
        "bufferYards": 200,
    }


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":")), encoding="utf-8")
    print(f"  wrote {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)")


def main() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)

    hist = load_salishsea()
    recent = load_acartia()
    habitat = load_critical_habitat()
    hexes = build_hexes(hist)
    seasonality = build_seasonality(hist)

    # Sample of recent historical points for scatter (cap for payload)
    scatter = sorted(hist, key=lambda r: r.get("date") or "", reverse=True)[:800]
    scatter_fc = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "species": r["species"],
                    "date": r["date"],
                    "month": r["month"],
                    "year": r["year"],
                    "hour": r.get("hour"),
                    "source": r["source"],
                    "remarks": r.get("remarks") or "",
                },
                "geometry": {"type": "Point", "coordinates": [r["lon"], r["lat"]]},
            }
            for r in scatter
        ],
    }

    recent_fc = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {k: v for k, v in r.items() if k not in ("lat", "lon")},
                "geometry": {"type": "Point", "coordinates": [r["lon"], r["lat"]]},
            }
            for r in recent
        ],
    }

    meta = {
        "builtAt": datetime.now(timezone.utc).isoformat(),
        "bbox": BBOX,
        "hexSizeDeg": HEX_SIZE,
        "counts": {
            "historicalInBbox": len(hist),
            "hexCells": len(hexes["features"]),
            "recentInBbox": len(recent),
            "scatterSample": len(scatter),
        },
        "sources": [
            {
                "id": "salishsea",
                "name": "SalishSea.io DarwinCore Archive",
                "url": SALISHSEA_ZIP,
                "license": "CC BY-NC 4.0",
            },
            {
                "id": "acartia",
                "name": "Acartia current sightings",
                "url": ACARTIA_CURRENT,
                "license": "Community CC (see acartia.io)",
            },
            {
                "id": "noaa-srkw-ch",
                "name": "NOAA SRKW critical habitat",
                "url": NOAA_CH.split("/query")[0],
                "license": "US Gov public data",
            },
        ],
        "speciesLabels": {
            "srkw": "Southern Resident orca",
            "biggs": "Bigg’s (transient) orca",
            "orca_unspecified": "Orca (ecotype unspecified)",
            "humpback": "Humpback",
            "gray": "Gray whale",
            "minke": "Minke",
            "other_baleen": "Other baleen",
            "porpoise": "Porpoise",
            "other_cetacean": "Other cetacean",
        },
    }

    write_json(OUT / "meta.json", meta)
    write_json(OUT / "hexes.json", hexes)
    write_json(OUT / "seasonality.json", seasonality)
    write_json(OUT / "scatter.json", scatter_fc)
    write_json(OUT / "recent.json", recent_fc)
    write_json(OUT / "habitat.json", habitat)
    write_json(OUT / "hotspots.json", curated_hotspots())
    write_json(OUT / "launches.json", launch_points())
    write_json(OUT / "etiquette.json", etiquette())
    print("Done.")


if __name__ == "__main__":
    main()
