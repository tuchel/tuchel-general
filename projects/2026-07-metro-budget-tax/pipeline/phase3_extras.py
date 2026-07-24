#!/usr/bin/env python3
"""
Phase 3 extras:
1) Modeled state tax/spend allocation onto CBSAs (by CBSA share of state population).
2) FiSC-style central-city estimate (simplified Lincoln methodology on Census units)
   + flag for cities on Lincoln's published FiSC list.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

import pandas as pd
import yaml

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "raw"
DATA = ROOT / "data"
MAP_PATH = Path(__file__).with_name("item_code_map.yml")
DAT_2022 = RAW / "census" / "2022_Individual_Unit_File" / "2022FinEstDAT_06052025modp_pu.txt"
PID_2022 = RAW / "census" / "2022_Individual_Unit_File" / "Fin_PID_2022.txt"
DELINEATION = RAW / "geo" / "list1_2023.xlsx"
POP_PATH = RAW / "geo" / "cbsa-est2023-alldata.csv"
FISC_LIST_TXT = ROOT / "raw" / "_summaries" / "lincoln-fisc-city-list.txt"

# Census gov-id state prefix (FIPS) → USPS
FIPS_TO_POSTAL = {
    "01": "AL",
    "02": "AK",
    "04": "AZ",
    "05": "AR",
    "06": "CA",
    "08": "CO",
    "09": "CT",
    "10": "DE",
    "11": "DC",
    "12": "FL",
    "13": "GA",
    "15": "HI",
    "16": "ID",
    "17": "IL",
    "18": "IN",
    "19": "IA",
    "20": "KS",
    "21": "KY",
    "22": "LA",
    "23": "ME",
    "24": "MD",
    "25": "MA",
    "26": "MI",
    "27": "MN",
    "28": "MS",
    "29": "MO",
    "30": "MT",
    "31": "NE",
    "32": "NV",
    "33": "NH",
    "34": "NJ",
    "35": "NM",
    "36": "NY",
    "37": "NC",
    "38": "ND",
    "39": "OH",
    "40": "OK",
    "41": "OR",
    "42": "PA",
    "44": "RI",
    "45": "SC",
    "46": "SD",
    "47": "TN",
    "48": "TX",
    "49": "UT",
    "50": "VT",
    "51": "VA",
    "53": "WA",
    "54": "WV",
    "55": "WI",
    "56": "WY",
}


def load_map() -> dict:
    return yaml.safe_load(MAP_PATH.read_text())


def tax_codes(m: dict) -> set[str]:
    out = set()
    for codes in m["taxes"].values():
        out.update(codes)
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
            amt_s = line[15:27].strip()
            if not amt_s:
                continue
            try:
                amount = int(amt_s) * 1000
            except ValueError:
                continue
            yield line[0:12], line[12:15], amount


def parse_pid(path: Path) -> dict[str, dict]:
    out = {}
    with path.open("r", encoding="latin1", newline="") as f:
        for line in f:
            line = line.rstrip("\r\n")
            if len(line) < 125:
                continue
            gov_id = line[0:12]
            name = line[12:76].strip()
            pop_s = line[116:125].strip()
            out[gov_id] = {
                "name": name,
                "type": gov_id[2],
                "state": gov_id[0:2],
                "county_fips": gov_id[0:2] + gov_id[3:6],
                "unit_pop": int(pop_s) if pop_s.lstrip("-").isdigit() else 0,
            }
    return out


def load_county_to_cbsa(path: Path) -> dict[str, str]:
    df = pd.read_excel(path, header=2)
    out = {}
    for _, row in df.iterrows():
        try:
            cbsa = str(int(row["CBSA Code"])).zfill(5)
            st = str(int(row["FIPS State Code"])).zfill(2)
            co = str(int(row["FIPS County Code"])).zfill(3)
        except (ValueError, TypeError):
            continue
        out[st + co] = cbsa
    return out


def load_county_populations(path: Path) -> dict[str, int]:
    """STCOU FIPS -> POPESTIMATE2022"""
    df = pd.read_csv(path, encoding="latin1", dtype={"CBSA": str, "STCOU": str, "MDIV": str})
    out = {}
    for _, row in df.iterrows():
        stcou = row.get("STCOU")
        if pd.isna(stcou) or str(stcou).strip() in ("", "nan"):
            continue
        try:
            fips = str(int(float(stcou))).zfill(5)
        except (ValueError, TypeError):
            continue
        pop = row.get("POPESTIMATE2022")
        if pd.isna(pop):
            pop = row.get("POPESTIMATE2023")
        if pd.isna(pop):
            continue
        out[fips] = int(pop)
    return out


def normalize_city(name: str) -> str:
    n = name.upper().strip()
    n = re.sub(r"\s+", " ", n)
    # Drop trailing place-type tokens Census uses
    n = re.sub(
        r"\s+(CITY AND COUNTY|CITY|TOWN|VILLAGE|BOROUGH|MUNICIPALITY|TOWNSHIP)$",
        "",
        n,
    )
    n = n.replace("SAINT ", "ST ").replace("FORT ", "FT ")
    n = n.replace("ST.", "ST ").replace("FT.", "FT ")
    n = re.sub(r"[^A-Z0-9 ]", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def load_lincoln_fisc_keys(path: Path) -> set[tuple[str, str]]:
    """Return set of (USPS state, normalized city name)."""
    if not path.exists():
        return set()
    keys: set[tuple[str, str]] = set()
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "|" in line:
            st, city = line.split("|", 1)
            st, city = st.strip().upper(), city.strip()
            if len(st) == 2 and city:
                keys.add((st, normalize_city(city)))
            continue
        # legacy multi-column "AL: Birmingham IN: Anderson ..."
        for m in re.finditer(r"([A-Z]{2}):\s*([^:]+?)(?=\s+[A-Z]{2}:|$)", line):
            st, city = m.group(1), m.group(2).strip()
            city = re.sub(r"\s+[A-Z]{2}$", "", city).strip()
            if city:
                keys.add((st, normalize_city(city)))
    return keys


def city_matches_lincoln(state_fips: str, city_name: str, lincoln: set[tuple[str, str]]) -> bool:
    postal = FIPS_TO_POSTAL.get(state_fips)
    if not postal:
        return False
    norm = normalize_city(city_name)
    if (postal, norm) in lincoln:
        return True
    # Allow "SAN FRANCISCO CITY AND COUNTY" already stripped; also prefix/contains for DC etc.
    for st, ln in lincoln:
        if st != postal:
            continue
        if norm == ln or norm.startswith(ln + " ") or ln.startswith(norm + " "):
            return True
        # "WASHINGTON DC" vs "WASHINGTON"
        if norm.replace(" DC", "") == ln or ln.replace(" DC", "") == norm:
            return True
    return False


def pick_central_city(
    cities: list[tuple[str, dict]], lincoln: set[tuple[str, str]]
) -> tuple[str, dict, bool]:
    """Prefer largest Lincoln-listed municipal unit; else largest by PID population."""
    lincoln_hits = [
        (gid, meta)
        for gid, meta in cities
        if city_matches_lincoln(meta["state"], meta["name"], lincoln) and meta["unit_pop"] > 0
    ]
    if lincoln_hits:
        gid, meta = max(lincoln_hits, key=lambda x: x[1]["unit_pop"])
        return gid, meta, True
    gid, meta = max(cities, key=lambda x: x[1]["unit_pop"])
    return gid, meta, city_matches_lincoln(meta["state"], meta["name"], lincoln)


def main() -> None:
    m = load_map()
    taxes = tax_codes(m)
    pid = parse_pid(PID_2022)
    county_to_cbsa = load_county_to_cbsa(DELINEATION)
    county_pop = load_county_populations(POP_PATH)
    lincoln = load_lincoln_fisc_keys(FISC_LIST_TXT)
    print(f"Lincoln FiSC name keys loaded: {len(lincoln)}")

    unit_tax: dict[str, int] = defaultdict(int)
    unit_spend: dict[str, int] = defaultdict(int)
    state_tax: dict[str, int] = defaultdict(int)
    state_spend: dict[str, int] = defaultdict(int)

    print("Scanning 2022 DAT for units + states…")
    for gov_id, item, amount in parse_dat(DAT_2022):
        gtype = gov_id[2]
        if gtype == "0":
            if item in taxes:
                state_tax[gov_id[0:2]] += amount
            elif is_direct_general_spend(item, m):
                state_spend[gov_id[0:2]] += amount
            continue
        if gtype not in {"1", "2", "3", "4", "5"}:
            continue
        if item in taxes:
            unit_tax[gov_id] += amount
        elif is_direct_general_spend(item, m):
            unit_spend[gov_id] += amount

    state_pop: dict[str, int] = defaultdict(int)
    for fips, pop in county_pop.items():
        state_pop[fips[:2]] += pop

    cbsa_state_pop: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for fips, pop in county_pop.items():
        cbsa = county_to_cbsa.get(fips)
        if not cbsa:
            continue
        cbsa_state_pop[cbsa][fips[:2]] += pop

    county_overlay_tax: dict[str, int] = defaultdict(int)
    county_overlay_spend: dict[str, int] = defaultdict(int)
    cities_by_cbsa: dict[str, list[tuple[str, dict]]] = defaultdict(list)

    for gov_id, meta in pid.items():
        cbsa = county_to_cbsa.get(meta["county_fips"])
        if not cbsa:
            continue
        if meta["type"] == "2":
            cities_by_cbsa[cbsa].append((gov_id, meta))
        elif meta["type"] in {"1", "4", "5"}:
            county_overlay_tax[meta["county_fips"]] += unit_tax.get(gov_id, 0)
            county_overlay_spend[meta["county_fips"]] += unit_spend.get(gov_id, 0)

    payload = json.loads((DATA / "metros_web.json").read_text())
    n_fisc = 0
    n_lincoln = 0
    for metro in payload["metros"]:
        cbsa = metro["cbsa"]
        pop = metro["population"]

        alloc_tax = 0.0
        alloc_spend = 0.0
        for st, part_pop in cbsa_state_pop.get(cbsa, {}).items():
            sp = state_pop.get(st) or 0
            if sp <= 0:
                continue
            share = part_pop / sp
            alloc_tax += state_tax.get(st, 0) * share
            alloc_spend += state_spend.get(st, 0) * share
        modeled_state_tax_pc = round(alloc_tax / pop, 2) if pop else None
        modeled_state_spend_pc = round(alloc_spend / pop, 2) if pop else None
        metro["modeled_state_tax_per_capita"] = modeled_state_tax_pc
        metro["modeled_state_spend_per_capita"] = modeled_state_spend_pc
        metro["local_plus_state_tax_per_capita"] = (
            round(metro["tax_per_capita"] + (modeled_state_tax_pc or 0), 2)
            if modeled_state_tax_pc is not None
            else None
        )
        metro["local_plus_state_spend_per_capita"] = (
            round(metro["spend_per_capita"] + (modeled_state_spend_pc or 0), 2)
            if modeled_state_spend_pc is not None
            else None
        )
        if (
            metro["local_plus_state_tax_per_capita"] is not None
            and metro["local_plus_state_spend_per_capita"] is not None
        ):
            metro["local_plus_state_gap_per_capita"] = round(
                metro["local_plus_state_spend_per_capita"] - metro["local_plus_state_tax_per_capita"],
                2,
            )
        else:
            metro["local_plus_state_gap_per_capita"] = None
        metro["state_allocation_method"] = (
            "Modeled: state government tax/spend allocated by CBSA share of state population"
        )

        cities = cities_by_cbsa.get(cbsa, [])
        if not cities:
            metro["fisc_style"] = None
            continue

        gov_id, cmeta, in_lincoln = pick_central_city(cities, lincoln)
        city_pop = cmeta["unit_pop"] or 0
        county_fips = cmeta["county_fips"]
        cpop = county_pop.get(county_fips) or 0
        share = (city_pop / cpop) if cpop > 0 and city_pop > 0 else 0.0
        city_tax = unit_tax.get(gov_id, 0)
        city_spend = unit_spend.get(gov_id, 0)
        overlay_tax = county_overlay_tax.get(county_fips, 0)
        overlay_spend = county_overlay_spend.get(county_fips, 0)
        fisc_tax = city_tax + share * overlay_tax
        fisc_spend = city_spend + share * overlay_spend

        display_name = cmeta["name"].title() if cmeta["name"].isupper() else cmeta["name"]

        if city_pop > 0:
            n_fisc += 1
            if in_lincoln:
                n_lincoln += 1
            metro["fisc_style"] = {
                "central_city_name": display_name,
                "central_city_population": city_pop,
                "county_fips": county_fips,
                "city_share_of_county_population": round(share, 4),
                "tax_per_capita": round(fisc_tax / city_pop, 2),
                "spend_per_capita": round(fisc_spend / city_pop, 2),
                "city_only_tax_per_capita": round(city_tax / city_pop, 2),
                "city_only_spend_per_capita": round(city_spend / city_pop, 2),
                "in_lincoln_fisc_list": bool(in_lincoln),
                "method": (
                    "FiSC-style (simplified): central-city municipal finances + "
                    "city population share of home-county overlay (county + schools + special districts). "
                    "Per capita uses central-city population, not CBSA population. "
                    "Not Lincoln Institute FiSC published figures."
                ),
            }
        else:
            metro["fisc_style"] = None

    audit = payload.get("audit", {})
    notes = list(audit.get("notes", []))
    extra_notes = [
        "Modeled state allocation = state gov tax/spend × (CBSA population in state / state population).",
        "FiSC-style = simplified Lincoln-style central-city standardization from Census units; not official FiSC values.",
        f"FiSC-style computed for {n_fisc} CBSAs; {n_lincoln} central cities match Lincoln FiSC list names.",
    ]
    for n in extra_notes:
        if n not in notes:
            notes.append(n)
    audit["notes"] = notes
    audit["n_fisc_style"] = n_fisc
    audit["n_lincoln_fisc_name_match"] = n_lincoln
    payload["audit"] = audit
    defs = payload["meta"].setdefault("definitions", {})
    defs["modeled_state_tax_per_capita"] = (
        "State government tax collections allocated to the CBSA by population share within the state "
        "(modeled — not a Census metro tabulation)"
    )
    defs["local_plus_state_tax_per_capita"] = (
        "Local tax_per_capita + modeled_state_tax_per_capita (modeled composite)"
    )
    defs["fisc_style_tax_per_capita"] = (
        "Simplified FiSC-style central-city tax per central-city resident "
        "(municipal + population-share of home-county overlays)"
    )

    (DATA / "metros_web.json").write_text(json.dumps(payload, separators=(",", ":")))
    full_path = DATA / "metros.json"
    if full_path.exists():
        full = json.loads(full_path.read_text())
        by = {m["cbsa"]: m for m in payload["metros"]}
        for row in full["metros"]:
            src = by.get(row["cbsa"])
            if not src:
                continue
            for k in (
                "modeled_state_tax_per_capita",
                "modeled_state_spend_per_capita",
                "local_plus_state_tax_per_capita",
                "local_plus_state_spend_per_capita",
                "local_plus_state_gap_per_capita",
                "state_allocation_method",
                "fisc_style",
            ):
                row[k] = src.get(k)
        full["audit"] = {**full.get("audit", {}), **audit}
        full["meta"]["definitions"].update(defs)
        full_path.write_text(json.dumps(full, separators=(",", ":")))

    print(f"Patched metros_web.json — FiSC-style {n_fisc}, Lincoln name matches {n_lincoln}")


if __name__ == "__main__":
    main()
