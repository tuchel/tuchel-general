#!/usr/bin/env python3
"""Phase 0 ETL: Census individual-unit finances → CBSA metro per-person metrics."""

from __future__ import annotations

import json
import math
from collections import defaultdict
from pathlib import Path

import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw"
DATA = ROOT / "data"
DAT_PATH = RAW / "census" / "2022_Individual_Unit_File" / "2022FinEstDAT_06052025modp_pu.txt"
PID_PATH = RAW / "census" / "2022_Individual_Unit_File" / "Fin_PID_2022.txt"
DELINEATION = RAW / "geo" / "list1_2023.xlsx"
POP_PATH = RAW / "geo" / "cbsa-est2023-alldata.csv"
MAP_PATH = Path(__file__).with_name("item_code_map.yml")


def load_map() -> dict:
    with MAP_PATH.open() as f:
        return yaml.safe_load(f)


def flatten_tax_codes(m: dict) -> dict[str, str]:
    """item_code -> tax bucket name"""
    out = {}
    for bucket, codes in m["taxes"].items():
        for c in codes:
            out[c] = bucket
    return out


def spend_function_lookup(m: dict) -> dict[str, str]:
    out = {}
    for bucket, codes in m["expenditure_functions"].items():
        for c in codes:
            out[c] = bucket
    return out


def is_direct_general_spend(code: str, m: dict) -> bool:
    if code in m["spend_interest_general"] or code in m["spend_assistance"]:
        return True
    if code.startswith("E") and code not in m["spend_current_general_prefix_exclude"]:
        return True
    if code.startswith("F") and code not in m["spend_construction_general_prefix_exclude"]:
        return True
    return False


def parse_dat(path: Path):
    """Yield (gov_id, item, amount_dollars, year, flag). Amounts stored as thousands."""
    with path.open("r", encoding="latin1") as f:
        for line in f:
            if len(line) < 32:
                continue
            gov_id = line[0:12]
            item = line[12:15]
            amt_s = line[15:27].strip()
            year = line[27:31]
            flag = line[31:32]
            if not amt_s:
                continue
            try:
                thousands = int(amt_s)
            except ValueError:
                continue
            yield gov_id, item, thousands * 1000, year, flag


def parse_pid(path: Path) -> dict[str, dict]:
    """gov_id -> metadata"""
    out = {}
    with path.open("r", encoding="latin1") as f:
        for line in f:
            if len(line) < 146:
                # allow shorter lines without trailing newline padding
                line = line.rstrip("\n")
                if len(line) < 116:
                    continue
            gov_id = line[0:12]
            name = line[12:76].strip()
            county_name = line[76:111].strip()
            place = line[111:116].strip()
            pop_s = line[116:125].strip()
            out[gov_id] = {
                "name": name,
                "county_name": county_name,
                "place": place,
                "unit_pop": int(pop_s) if pop_s.isdigit() else None,
                "type": gov_id[2],
                "state": gov_id[0:2],
                "county": gov_id[3:6],
                "county_fips": gov_id[0:2] + gov_id[3:6],
            }
    return out


def load_county_to_cbsa(path: Path) -> tuple[dict[str, str], dict[str, dict]]:
    """county FIPS -> CBSA code; CBSA meta."""
    df = pd.read_excel(path, header=2)
    # Expected columns after header row 2 (0-indexed): CBSA Code, ...
    cols = list(df.columns)
    # Normalize
    rename = {}
    for c in cols:
        cl = str(c).strip().lower()
        if "cbsa code" == cl or cl == "cbsa":
            rename[c] = "cbsa"
        elif "metropolitan/micropolitan" in cl or "statistical area type" in cl or "metro" == cl:
            rename[c] = "area_type"
        elif cl.startswith("cbsa title") or "area title" in cl:
            rename[c] = "cbsa_title"
        elif "fips state" in cl:
            rename[c] = "state_fips"
        elif "fips county" in cl:
            rename[c] = "county_fips_3"
        elif "county/county" in cl or cl == "county/county equivalent":
            rename[c] = "county_name"
        elif "central/outlying" in cl:
            rename[c] = "central"
    df = df.rename(columns=rename)
    # Fallback by position if names odd
    if "cbsa" not in df.columns:
        df = pd.read_excel(path, header=2)
        # list1 typical order: CBSA Code, Metropolitan Division Code, CSA Code, CBSA Title, ...
        df.columns = [
            "cbsa",
            "mdiv",
            "csa",
            "cbsa_title",
            "area_type",
            "status",
            "state_name",
            "state_fips",
            "county_fips_3",
            "county_name",
            "county_type",
            "central",
        ][: len(df.columns)]

    county_to_cbsa: dict[str, str] = {}
    cbsa_meta: dict[str, dict] = {}
    for _, row in df.iterrows():
        try:
            cbsa = str(int(row["cbsa"])).zfill(5)
        except (ValueError, TypeError):
            continue
        try:
            st = str(int(row["state_fips"])).zfill(2)
            co = str(int(row["county_fips_3"])).zfill(3)
        except (ValueError, TypeError):
            continue
        area_type = str(row.get("area_type", "")).strip()
        title = str(row.get("cbsa_title", "")).strip()
        county_fips = st + co
        county_to_cbsa[county_fips] = cbsa
        if cbsa not in cbsa_meta:
            is_metro = "Metropolitan" in area_type
            cbsa_meta[cbsa] = {
                "cbsa": cbsa,
                "name": title,
                "area_type": "Metropolitan" if is_metro else "Micropolitan",
                "is_metro": is_metro,
            }
    return county_to_cbsa, cbsa_meta


def load_cbsa_population(path: Path) -> dict[str, int]:
    df = pd.read_csv(path, encoding="latin1", dtype={"CBSA": str, "STCOU": str, "MDIV": str})
    # True CBSA totals: no county component and no metropolitan-division subtotal.
    stcou_blank = df["STCOU"].isna() | (df["STCOU"].astype(str).str.strip().isin(["", "nan"]))
    mdiv_blank = df["MDIV"].isna() | (df["MDIV"].astype(str).str.strip().isin(["", "nan"]))
    totals = df[stcou_blank & mdiv_blank]
    out = {}
    for _, row in totals.iterrows():
        cbsa = str(row["CBSA"]).zfill(5)
        # Prefer 2022 to align with FY2022 finances; fall back to 2023
        pop = row.get("POPESTIMATE2022")
        if pd.isna(pop):
            pop = row.get("POPESTIMATE2023")
        if pd.isna(pop):
            continue
        out[cbsa] = int(pop)
    return out


def main() -> None:
    m = load_map()
    tax_bucket = flatten_tax_codes(m)
    all_tax = set(tax_bucket)
    spend_fn = spend_function_lookup(m)
    charges = set(m["charges_general"])
    misc = set(m["misc_general_revenue"])
    ig_fed = set(m["ig_federal"])

    print("Loading PID…")
    pid = parse_pid(PID_PATH)
    print(f"  {len(pid):,} government units")

    print("Loading CBSA delineation…")
    county_to_cbsa, cbsa_meta = load_county_to_cbsa(DELINEATION)
    print(f"  {len(county_to_cbsa):,} counties → {len(cbsa_meta):,} CBSAs")

    print("Loading population…")
    pop = load_cbsa_population(POP_PATH)
    print(f"  {len(pop):,} CBSA population rows")

    # Accumulators per CBSA
    def zero():
        return {
            "tax_total": 0,
            "tax_buckets": defaultdict(int),
            "spend_total": 0,
            "spend_buckets": defaultdict(int),
            "charges": 0,
            "misc": 0,
            "ig_federal": 0,
            "ig_state": 0,
            "unit_count": 0,
            "units_seen": set(),
        }

    cbsa_acc: dict[str, dict] = defaultdict(zero)
    local_types = set(m["local_types"])
    n_rows = 0
    n_local_rows = 0
    n_mapped = 0
    unknown_items_taxish = set()

    print("Scanning finance DAT (this takes a bit)…")
    for gov_id, item, amount, year, flag in parse_dat(DAT_PATH):
        n_rows += 1
        if gov_id[2] not in local_types:
            continue
        n_local_rows += 1
        county_fips = gov_id[0:2] + gov_id[3:6]
        cbsa = county_to_cbsa.get(county_fips)
        if not cbsa:
            continue
        n_mapped += 1
        acc = cbsa_acc[cbsa]
        acc["units_seen"].add(gov_id)

        if item in all_tax:
            acc["tax_total"] += amount
            acc["tax_buckets"][tax_bucket[item]] += amount
        elif item in charges:
            acc["charges"] += amount
        elif item in misc:
            acc["misc"] += amount
        elif item in ig_fed:
            acc["ig_federal"] += amount
        elif item.startswith(m["ig_state_prefix"]):
            acc["ig_state"] += amount
        elif is_direct_general_spend(item, m):
            acc["spend_total"] += amount
            fn = spend_fn.get(item, "other")
            acc["spend_buckets"][fn] += amount

        if n_rows % 2_000_000 == 0:
            print(f"  …{n_rows:,} rows")

    print(f"DAT rows={n_rows:,} local={n_local_rows:,} mapped_to_cbsa={n_mapped:,}")

    metros = []
    missing_pop = 0
    for cbsa, meta in sorted(cbsa_meta.items()):
        acc = cbsa_acc.get(cbsa)
        population = pop.get(cbsa)
        if not population:
            missing_pop += 1
            continue
        if not acc:
            # CBSA with no finance rows — still emit with zeros?
            tax = spend = charges_v = misc_v = igf = igs = 0
            tax_b = {}
            spend_b = {}
            n_units = 0
        else:
            tax = acc["tax_total"]
            spend = acc["spend_total"]
            charges_v = acc["charges"]
            misc_v = acc["misc"]
            igf = acc["ig_federal"]
            igs = acc["ig_state"]
            tax_b = dict(acc["tax_buckets"])
            spend_b = dict(acc["spend_buckets"])
            n_units = len(acc["units_seen"])

        own_source = tax + charges_v + misc_v
        metros.append(
            {
                "cbsa": cbsa,
                "name": meta["name"],
                "area_type": meta["area_type"],
                "is_metro": meta["is_metro"],
                "year": m["fiscal_year"],
                "population": population,
                "n_gov_units": n_units,
                "tax_total": tax,
                "spend_total": spend,
                "charges_total": charges_v,
                "misc_total": misc_v,
                "ig_federal": igf,
                "ig_state": igs,
                "own_source": own_source,
                "tax_per_capita": round(tax / population, 2),
                "spend_per_capita": round(spend / population, 2),
                "gap_per_capita": round((spend - tax) / population, 2),
                "own_source_per_capita": round(own_source / population, 2),
                "transfer_share": round((igf + igs) / own_source, 4)
                if own_source > 0
                else None,
                # transfer_share vs general-ish revenue proxy
                "ig_share_of_own_plus_ig": round(
                    (igf + igs) / (own_source + igf + igs), 4
                )
                if (own_source + igf + igs) > 0
                else None,
                "tax_composition": {k: round(v / population, 2) for k, v in tax_b.items()},
                "spend_composition": {
                    k: round(v / population, 2) for k, v in spend_b.items()
                },
            }
        )

    # National audit: sum local taxes in metros + micros vs all local mapped
    metro_only = [x for x in metros if x["is_metro"]]
    tax_sum = sum(x["tax_total"] for x in metros)
    spend_sum = sum(x["spend_total"] for x in metros)
    tax_metro = sum(x["tax_total"] for x in metro_only)
    spend_metro = sum(x["spend_total"] for x in metro_only)

    audit = {
        "fiscal_year": m["fiscal_year"],
        "n_cbsa_rows": len(metros),
        "n_metropolitan": len(metro_only),
        "n_micropolitan": len(metros) - len(metro_only),
        "missing_population_cbsas": missing_pop,
        "sum_tax_all_cbsa": tax_sum,
        "sum_spend_all_cbsa": spend_sum,
        "sum_tax_metropolitan_only": tax_metro,
        "sum_spend_metropolitan_only": spend_metro,
        "dat_rows": n_rows,
        "local_rows": n_local_rows,
        "mapped_rows": n_mapped,
        "notes": [
            "Taxes = sum of Census T* item codes for local gov types 1–5.",
            "Spend = direct general expenditure proxy (E*/F* excl. utilities/liquor + I89 + J19).",
            "Intergovernmental expenditure (L/M) excluded to avoid double-counting across units.",
            "Local-to-local IG revenue (D*) excluded from transfer totals for the same reason.",
            "Special districts assigned wholly to GID home county CBSA.",
            "Population = Census CBSA vintage estimate POPESTIMATE2022.",
            "Amounts from Census file are in $1,000s; converted to dollars in this pipeline.",
        ],
    }

    DATA.mkdir(parents=True, exist_ok=True)
    out_path = DATA / "metros.json"
    with out_path.open("w") as f:
        json.dump(
            {
                "meta": {
                    "title": "US CBSA local government tax and spending per person",
                    "fiscal_year": m["fiscal_year"],
                    "generated_by": "pipeline/build_metros.py",
                    "definitions": {
                        "tax_per_capita": "Local tax collections / CBSA resident population (not household incidence)",
                        "spend_per_capita": "Local direct general expenditure / CBSA resident population",
                        "gap_per_capita": "spend_per_capita − tax_per_capita (accounting identity, not deficit)",
                    },
                },
                "audit": audit,
                "metros": metros,
            },
            f,
            separators=(",", ":"),
        )

    with (DATA / "audit.json").open("w") as f:
        json.dump(audit, f, indent=2)

    # Human-readable audit
    audit_md = DATA / "audit.md"
    top_tax = sorted(metro_only, key=lambda x: x["tax_per_capita"], reverse=True)[:10]
    top_spend = sorted(metro_only, key=lambda x: x["spend_per_capita"], reverse=True)[:10]
    lines = [
        "# Metro rollup audit — FY2022",
        "",
        f"- CBSAs with population: **{len(metros)}** ({len(metro_only)} metropolitan, {len(metros)-len(metro_only)} micropolitan)",
        f"- Sum of local tax across all CBSAs: **${tax_sum/1e9:.2f}B**",
        f"- Sum of direct general spend across all CBSAs: **${spend_sum/1e9:.2f}B**",
        f"- Metropolitan-only tax: **${tax_metro/1e9:.2f}B**; spend: **${spend_metro/1e9:.2f}B**",
        f"- DAT rows scanned: {n_rows:,}; local: {n_local_rows:,}; mapped to a CBSA: {n_mapped:,}",
        "",
        "## Highest local tax per person (metros)",
        "",
    ]
    for x in top_tax:
        lines.append(
            f"- {x['name']}: ${x['tax_per_capita']:,.0f}/person (spend ${x['spend_per_capita']:,.0f})"
        )
    lines += ["", "## Highest local spend per person (metros)", ""]
    for x in top_spend:
        lines.append(
            f"- {x['name']}: ${x['spend_per_capita']:,.0f}/person (tax ${x['tax_per_capita']:,.0f})"
        )
    lines += [
        "",
        "## Method notes",
        "",
    ]
    lines += [f"- {n}" for n in audit["notes"]]
    audit_md.write_text("\n".join(lines) + "\n")

    print(f"Wrote {out_path} ({out_path.stat().st_size/1e6:.1f} MB)")
    print(f"Metros: {len(metro_only)} | Micros: {len(metros)-len(metro_only)}")
    print(f"Tax sum ${tax_sum/1e9:.2f}B | Spend sum ${spend_sum/1e9:.2f}B")
    print("Top tax/person:", ", ".join(f"{x['name'].split(',')[0]} ${x['tax_per_capita']:.0f}" for x in top_tax[:5]))


if __name__ == "__main__":
    main()
