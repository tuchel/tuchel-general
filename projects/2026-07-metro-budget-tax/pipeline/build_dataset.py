#!/usr/bin/env python3
"""Build enriched multi-year CBSA dataset for the Metro Budget & Tax Explorer."""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw"
DATA = ROOT / "data"
MAP_PATH = Path(__file__).with_name("item_code_map.yml")

YEAR_FILES = {
    2022: {
        "dat": RAW / "census" / "2022_Individual_Unit_File" / "2022FinEstDAT_06052025modp_pu.txt",
        "pop_col": "POPESTIMATE2022",
    },
    2017: {
        "dat": RAW
        / "census"
        / "2017_Individual_Unit_File"
        / "2017FinEstDAT_09202024modp_pu.txt",
        "pop_col": "POPESTIMATE2020",  # vintage file starts 2020; use closest available below
    },
}

STATE_REGION = {
    "01": "South",
    "02": "West",
    "04": "West",
    "05": "South",
    "06": "West",
    "08": "West",
    "09": "Northeast",
    "10": "South",
    "11": "South",
    "12": "South",
    "13": "South",
    "15": "West",
    "16": "West",
    "17": "Midwest",
    "18": "Midwest",
    "19": "Midwest",
    "20": "Midwest",
    "21": "South",
    "22": "South",
    "23": "Northeast",
    "24": "South",
    "25": "Northeast",
    "26": "Midwest",
    "27": "Midwest",
    "28": "South",
    "29": "Midwest",
    "30": "West",
    "31": "Midwest",
    "32": "West",
    "33": "Northeast",
    "34": "Northeast",
    "35": "West",
    "36": "Northeast",
    "37": "South",
    "38": "Midwest",
    "39": "Midwest",
    "40": "South",
    "41": "West",
    "42": "Northeast",
    "44": "Northeast",
    "45": "South",
    "46": "Midwest",
    "47": "South",
    "48": "South",
    "49": "West",
    "50": "Northeast",
    "51": "South",
    "53": "West",
    "54": "South",
    "55": "Midwest",
    "56": "West",
}


def load_map() -> dict:
    with MAP_PATH.open() as f:
        return yaml.safe_load(f)


def flatten_tax_codes(m: dict) -> dict[str, str]:
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
    with path.open("r", encoding="latin1", newline="") as f:
        for line in f:
            line = line.rstrip("\r\n")
            if len(line) < 32:
                continue
            gov_id = line[0:12]
            item = line[12:15]
            amt_s = line[15:27].strip()
            if not amt_s:
                continue
            try:
                thousands = int(amt_s)
            except ValueError:
                continue
            yield gov_id, item, thousands * 1000


def load_county_to_cbsa(path: Path) -> tuple[dict[str, str], dict[str, dict]]:
    df = pd.read_excel(path, header=2)
    df = df.rename(
        columns={
            "CBSA Code": "cbsa",
            "CBSA Title": "cbsa_title",
            "Metropolitan/Micropolitan Statistical Area": "area_type",
            "FIPS State Code": "state_fips",
            "FIPS County Code": "county_fips_3",
        }
    )
    county_to_cbsa: dict[str, str] = {}
    cbsa_meta: dict[str, dict] = {}
    for _, row in df.iterrows():
        try:
            cbsa = str(int(row["cbsa"])).zfill(5)
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
            # primary state = first county seen
            cbsa_meta[cbsa] = {
                "cbsa": cbsa,
                "name": title,
                "area_type": "Metropolitan" if is_metro else "Micropolitan",
                "is_metro": is_metro,
                "states": set(),
                "region_votes": [],
            }
        cbsa_meta[cbsa]["states"].add(st)
    for meta in cbsa_meta.values():
        states = sorted(meta["states"])
        meta["states"] = states
        regions = sorted({STATE_REGION.get(s, "Other") for s in states})
        meta["region"] = regions[0] if len(regions) == 1 else "Multi-region"
        meta["primary_state"] = states[0] if states else ""
    return county_to_cbsa, cbsa_meta


def load_cbsa_population(path: Path) -> dict[str, dict[str, int]]:
    df = pd.read_csv(path, encoding="latin1", dtype={"CBSA": str, "STCOU": str, "MDIV": str})
    stcou_blank = df["STCOU"].isna() | (df["STCOU"].astype(str).str.strip().isin(["", "nan"]))
    mdiv_blank = df["MDIV"].isna() | (df["MDIV"].astype(str).str.strip().isin(["", "nan"]))
    totals = df[stcou_blank & mdiv_blank]
    out: dict[str, dict[str, int]] = {}
    for _, row in totals.iterrows():
        cbsa = str(row["CBSA"]).zfill(5)
        years = {}
        for col in row.index:
            if str(col).startswith("POPESTIMATE"):
                y = str(col).replace("POPESTIMATE", "")
                if pd.notna(row[col]):
                    years[y] = int(row[col])
        out[cbsa] = years
    return out


def load_county_personal_income(path: Path) -> dict[str, dict[str, float]]:
    """county FIPS -> {year: personal_income_dollars}"""
    df = pd.read_csv(
        path,
        encoding="latin1",
        dtype=str,
        usecols=["GeoFIPS", "LineCode", "2017", "2022"],
    )
    df["GeoFIPS"] = df["GeoFIPS"].str.replace('"', "", regex=False).str.strip()
    df["LineCode"] = df["LineCode"].str.strip()
    # Line 1 = Personal income (thousands of dollars)
    pi = df[df["LineCode"] == "1"]
    out: dict[str, dict[str, float]] = {}
    for _, row in pi.iterrows():
        fips = row["GeoFIPS"]
        if len(fips) != 5 or fips.endswith("000") or fips == "00000":
            continue
        entry = {}
        for y in ("2017", "2022"):
            v = row.get(y)
            if v and v not in ("(NA)", "(NM)", ""):
                try:
                    entry[y] = float(v) * 1000.0  # thousands → dollars
                except ValueError:
                    pass
        if entry:
            out[fips] = entry
    return out


def empty_acc():
    return {
        "tax_total": 0,
        "tax_buckets": defaultdict(int),
        "spend_total": 0,
        "spend_buckets": defaultdict(int),
        "charges": 0,
        "misc": 0,
        "ig_federal": 0,
        "ig_state": 0,
        "units_seen": set(),
        "city_tax": 0,
        "city_spend": 0,
        "city_units": set(),
    }


def rollup_year(
    year: int,
    dat_path: Path,
    county_to_cbsa: dict[str, str],
    m: dict,
) -> dict[str, dict]:
    tax_bucket = flatten_tax_codes(m)
    all_tax = set(tax_bucket)
    spend_fn = spend_function_lookup(m)
    charges = set(m["charges_general"])
    misc = set(m["misc_general_revenue"])
    ig_fed = set(m["ig_federal"])
    local_types = set(m["local_types"])

    accs: dict[str, dict] = defaultdict(empty_acc)
    print(f"Scanning {year} DAT…")
    n = 0
    for gov_id, item, amount in parse_dat(dat_path):
        n += 1
        gtype = gov_id[2]
        if gtype not in local_types:
            continue
        county_fips = gov_id[0:2] + gov_id[3:6]
        cbsa = county_to_cbsa.get(county_fips)
        if not cbsa:
            continue
        acc = accs[cbsa]
        acc["units_seen"].add(gov_id)

        if item in all_tax:
            acc["tax_total"] += amount
            acc["tax_buckets"][tax_bucket[item]] += amount
            if gtype == "2":
                acc["city_tax"] += amount
                acc["city_units"].add(gov_id)
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
            if gtype == "2":
                acc["city_spend"] += amount
                acc["city_units"].add(gov_id)
    print(f"  {year}: {n:,} rows, {len(accs):,} CBSAs with data")
    return accs


def pick_pop(pop_years: dict[str, int], year: int) -> int | None:
    if str(year) in pop_years:
        return pop_years[str(year)]
    # nearest available
    avail = sorted((int(y), p) for y, p in pop_years.items())
    if not avail:
        return None
    return min(avail, key=lambda yp: abs(yp[0] - year))[1]


def main() -> None:
    m = load_map()
    delineation = RAW / "geo" / "list1_2023.xlsx"
    pop_path = RAW / "geo" / "cbsa-est2023-alldata.csv"
    income_path = RAW / "geo" / "CAINC1__ALL_AREAS_1969_2024.csv"

    print("Loading geography…")
    county_to_cbsa, cbsa_meta = load_county_to_cbsa(delineation)
    pop = load_cbsa_population(pop_path)
    print("Loading BEA county personal income…")
    county_pi = load_county_personal_income(income_path)

    # Aggregate county PI → CBSA
    cbsa_pi: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for county, years in county_pi.items():
        cbsa = county_to_cbsa.get(county)
        if not cbsa:
            continue
        for y, dollars in years.items():
            cbsa_pi[cbsa][y] += dollars

    year_accs = {}
    for year, conf in YEAR_FILES.items():
        if not conf["dat"].exists():
            print(f"SKIP missing {conf['dat']}")
            continue
        year_accs[year] = rollup_year(year, conf["dat"], county_to_cbsa, m)

    primary_year = 2022
    metros = []
    for cbsa, meta in sorted(cbsa_meta.items()):
        pop_years = pop.get(cbsa, {})
        history = []
        for year in sorted(year_accs.keys()):
            acc = year_accs[year].get(cbsa)
            population = pick_pop(pop_years, year)
            if not population or not acc:
                continue
            tax = acc["tax_total"]
            spend = acc["spend_total"]
            history.append(
                {
                    "year": year,
                    "population": population,
                    "tax_per_capita": round(tax / population, 2),
                    "spend_per_capita": round(spend / population, 2),
                    "gap_per_capita": round((spend - tax) / population, 2),
                }
            )

        acc = year_accs.get(primary_year, {}).get(cbsa)
        population = pick_pop(pop_years, primary_year)
        if not population:
            continue
        if not acc:
            tax = spend = charges_v = misc_v = igf = igs = city_tax = city_spend = 0
            tax_b: dict = {}
            spend_b: dict = {}
            n_units = n_city = 0
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
            city_tax = acc["city_tax"]
            city_spend = acc["city_spend"]
            n_city = len(acc["city_units"])

        own_source = tax + charges_v + misc_v
        pi = cbsa_pi.get(cbsa, {}).get(str(primary_year))
        income_pc = round(pi / population, 2) if pi else None
        tax_of_income = round(tax / pi, 4) if pi and pi > 0 else None

        metros.append(
            {
                "cbsa": cbsa,
                "name": meta["name"],
                "area_type": meta["area_type"],
                "is_metro": meta["is_metro"],
                "region": meta["region"],
                "states": meta["states"],
                "year": primary_year,
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
                "charges_per_capita": round(charges_v / population, 2),
                "ig_per_capita": round((igf + igs) / population, 2),
                "transfer_share": round((igf + igs) / own_source, 4) if own_source > 0 else None,
                "ig_share_of_own_plus_ig": round((igf + igs) / (own_source + igf + igs), 4)
                if (own_source + igf + igs) > 0
                else None,
                "personal_income_per_capita": income_pc,
                "tax_as_share_of_personal_income": tax_of_income,
                "city_hall_tax_per_capita": round(city_tax / population, 2),
                "city_hall_spend_per_capita": round(city_spend / population, 2),
                "n_city_units": n_city,
                "tax_composition": {k: round(v / population, 2) for k, v in tax_b.items()},
                "spend_composition": {k: round(v / population, 2) for k, v in spend_b.items()},
                "revenue_stack_per_capita": {
                    "taxes": round(tax / population, 2),
                    "charges": round(charges_v / population, 2),
                    "misc": round(misc_v / population, 2),
                    "ig_federal": round(igf / population, 2),
                    "ig_state": round(igs / population, 2),
                },
                "history": history,
            }
        )

    metro_only = [x for x in metros if x["is_metro"]]
    tax_sum = sum(x["tax_total"] for x in metros)
    spend_sum = sum(x["spend_total"] for x in metros)
    tax_metro = sum(x["tax_total"] for x in metro_only)
    spend_metro = sum(x["spend_total"] for x in metro_only)
    with_income = sum(1 for x in metro_only if x["tax_as_share_of_personal_income"] is not None)

    audit = {
        "fiscal_year": primary_year,
        "years_in_history": sorted(year_accs.keys()),
        "n_cbsa_rows": len(metros),
        "n_metropolitan": len(metro_only),
        "n_micropolitan": len(metros) - len(metro_only),
        "metros_with_personal_income": with_income,
        "sum_tax_all_cbsa": tax_sum,
        "sum_spend_all_cbsa": spend_sum,
        "sum_tax_metropolitan_only": tax_metro,
        "sum_spend_metropolitan_only": spend_metro,
        "published_us_local_tax_2022": 894128023000,
        "tax_recovery_vs_published": round(tax_sum / 894128023000, 4),
        "notes": [
            "Taxes = sum of Census T* item codes for local gov types 1–5.",
            "Spend = direct general expenditure proxy (E*/F* excl. utilities/liquor + I89 + J19).",
            "Intergovernmental expenditure (L/M) excluded to avoid double-counting across units.",
            "Local-to-local IG revenue (D*) excluded from transfer totals for the same reason.",
            "Special districts assigned wholly to home-county CBSA.",
            "City-hall contrast = municipal (type 2) units only — incomplete by design.",
            "Personal income = BEA CAINC1 county personal income summed to CBSA (Line 1).",
            "History includes FY2017 and FY2022 where both files were available.",
            "Population = Census CBSA estimates; 2017 uses nearest available vintage year.",
        ],
    }

    DATA.mkdir(parents=True, exist_ok=True)
    payload = {
        "meta": {
            "title": "US CBSA local government tax and spending per person",
            "fiscal_year": primary_year,
            "generated_by": "pipeline/build_dataset.py",
            "definitions": {
                "tax_per_capita": "Local tax collections / CBSA resident population (not household incidence)",
                "spend_per_capita": "Local direct general expenditure / CBSA resident population",
                "gap_per_capita": "spend_per_capita − tax_per_capita (accounting identity, not deficit)",
                "tax_as_share_of_personal_income": "Local tax collections / BEA personal income in the CBSA",
                "city_hall_tax_per_capita": "Municipal (type-2) tax collections only / CBSA population — incomplete",
            },
        },
        "audit": audit,
        "metros": metros,
    }
    (DATA / "metros.json").write_text(json.dumps(payload, separators=(",", ":")))

    web = {
        "meta": payload["meta"],
        "audit": {
            k: audit[k]
            for k in [
                "fiscal_year",
                "years_in_history",
                "n_metropolitan",
                "n_micropolitan",
                "metros_with_personal_income",
                "sum_tax_metropolitan_only",
                "sum_spend_metropolitan_only",
                "tax_recovery_vs_published",
                "notes",
            ]
        },
        "metros": sorted(metros, key=lambda x: -x["population"]),
    }
    (DATA / "metros_web.json").write_text(json.dumps(web, separators=(",", ":")))
    (DATA / "audit.json").write_text(json.dumps(audit, indent=2))

    top_tax = sorted(metro_only, key=lambda x: x["tax_per_capita"], reverse=True)[:8]
    lines = [
        f"# Metro rollup audit — FY{primary_year}",
        "",
        f"- CBSAs: **{len(metros)}** ({len(metro_only)} metro, {len(metros)-len(metro_only)} micro)",
        f"- Tax recovery vs published US local tax: **{audit['tax_recovery_vs_published']*100:.1f}%** (${tax_sum/1e9:.1f}B / $894.1B)",
        f"- History years: {audit['years_in_history']}",
        f"- Metros with BEA personal income join: {with_income}",
        "",
        "## Highest local tax / person (metros)",
        "",
    ]
    for x in top_tax:
        lines.append(
            f"- {x['name']}: ${x['tax_per_capita']:,.0f} tax · ${x['spend_per_capita']:,.0f} spend"
            + (
                f" · {100*x['tax_as_share_of_personal_income']:.1f}% of personal income"
                if x["tax_as_share_of_personal_income"]
                else ""
            )
        )
    lines += ["", "## Method notes", ""] + [f"- {n}" for n in audit["notes"]]
    (DATA / "audit.md").write_text("\n".join(lines) + "\n")
    # machine-readable anchors for Phase 4
    anchors = {
        "tax_recovery_vs_published": {
            "value": audit["tax_recovery_vs_published"],
            "tolerance": 0.05,
            "expected_min": 0.90,
        },
        "n_metropolitan": {"value": len(metro_only), "expected_min": 380},
        "nyc_tax_pc_order": {
            "cbsa": "35620",
            "field": "tax_per_capita",
            "expected_min": 4000,
            "expected_max": 10000,
        },
    }
    (DATA / "audit-anchors.yml").write_text(yaml.dump(anchors, sort_keys=False))
    print(f"Wrote data for {len(metros)} CBSAs; tax recovery {audit['tax_recovery_vs_published']}")


if __name__ == "__main__":
    main()
