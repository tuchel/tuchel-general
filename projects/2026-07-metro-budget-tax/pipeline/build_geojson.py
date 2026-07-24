#!/usr/bin/env python3
"""Build simplified CBSA GeoJSON for the web map (metros only by default)."""

from __future__ import annotations

import json
from pathlib import Path

import shapefile  # pyshp

ROOT = Path(__file__).resolve().parents[1]
SHP = ROOT / "raw" / "geo" / "cb_2023_us_cbsa_20m.shp"
METROS_JSON = ROOT / "data" / "metros.json"
OUT = ROOT / "data" / "cbsa_metros.geojson"


def simplify_ring(ring: list, step: int = 2) -> list:
    if len(ring) <= 8 or step <= 1:
        return [[round(x, 4), round(y, 4)] for x, y in ring]
    out = [[round(x, 4), round(y, 4)] for i, (x, y) in enumerate(ring) if i % step == 0]
    if out[0] != out[-1]:
        out.append(out[0])
    return out


def simplify_geom(shape, step: int = 3):
    """shape.__geo_interface__ style from pyshp."""
    geo = shape.__geo_interface__
    gtype = geo["type"]
    coords = geo["coordinates"]

    def simp_poly(poly):
        return [simplify_ring(ring, step) for ring in poly]

    if gtype == "Polygon":
        return {"type": "Polygon", "coordinates": simp_poly(coords)}
    if gtype == "MultiPolygon":
        return {
            "type": "MultiPolygon",
            "coordinates": [simp_poly(poly) for poly in coords],
        }
    return geo


def main() -> None:
    metros = json.loads(METROS_JSON.read_text())["metros"]
    by_cbsa = {m["cbsa"]: m for m in metros if m["is_metro"]}

    reader = shapefile.Reader(str(SHP))
    fields = [f[0] for f in reader.fields[1:]]
    features = []
    for sr in reader.shapeRecords():
        rec = dict(zip(fields, sr.record))
        geoid = str(rec.get("GEOID") or rec.get("CBSAFP") or "").zfill(5)
        if geoid not in by_cbsa:
            continue
        m = by_cbsa[geoid]
        features.append(
            {
                "type": "Feature",
                "properties": {
                    "cbsa": geoid,
                    "name": m["name"],
                    "tax_per_capita": m["tax_per_capita"],
                    "spend_per_capita": m["spend_per_capita"],
                    "gap_per_capita": m["gap_per_capita"],
                    "population": m["population"],
                },
                "geometry": simplify_geom(sr.shape, step=2),
            }
        )

    fc = {"type": "FeatureCollection", "features": features}
    OUT.write_text(json.dumps(fc, separators=(",", ":")))
    print(f"Wrote {OUT} — {len(features)} metro features, {OUT.stat().st_size/1e6:.2f} MB")


if __name__ == "__main__":
    main()
