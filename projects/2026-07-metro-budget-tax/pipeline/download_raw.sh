#!/usr/bin/env bash
# Download Census + geography + BEA inputs into raw/ (large; gitignored).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/raw/census" "$ROOT/raw/geo"
cd "$ROOT/raw/census"
curl -fsSL -o 2022_Individual_Unit_File.zip \
  "https://www2.census.gov/programs-surveys/gov-finances/tables/2022/2022_Individual_Unit_File.zip"
curl -fsSL -o 2017_Individual_Unit_File.zip \
  "https://www2.census.gov/programs-surveys/gov-finances/tables/2017/2017_Individual_Unit_File.zip"
curl -fsSL -o 22slsstab1.xlsx \
  "https://www2.census.gov/programs-surveys/gov-finances/tables/2022/22slsstab1.xlsx"
unzip -o -q 2022_Individual_Unit_File.zip
unzip -o -q 2017_Individual_Unit_File.zip -d 2017_Individual_Unit_File
cd "$ROOT/raw/geo"
curl -fsSL -o list1_2023.xlsx \
  "https://www2.census.gov/programs-surveys/metro-micro/geographies/reference-files/2023/delineation-files/list1_2023.xlsx"
curl -fsSL -o cbsa-est2023-alldata.csv \
  "https://www2.census.gov/programs-surveys/popest/datasets/2020-2023/metro/totals/cbsa-est2023-alldata.csv"
curl -fsSL -o cb_2023_us_cbsa_20m.zip \
  "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_cbsa_20m.zip"
curl -fsSL -o CAINC1.zip "https://apps.bea.gov/regional/zip/CAINC1.zip"
unzip -o -q cb_2023_us_cbsa_20m.zip
unzip -o -q CAINC1.zip "CAINC1__ALL_AREAS_1969_2024.csv"
echo "Downloads complete."
