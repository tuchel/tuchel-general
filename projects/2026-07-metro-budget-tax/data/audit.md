# Metro rollup audit — FY2022

- CBSAs: **925** (387 metro, 538 micro)
- Tax recovery vs published US local tax: **96.4%** ($862.2B / $894.1B)
- History years: [2017, 2022]
- Metros with BEA personal income join: 379

## Highest local tax / person (metros)

- New York-Newark-Jersey City, NY-NJ: $6,186 tax · $10,653 spend · 7.2% of personal income
- Washington-Arlington-Alexandria, DC-VA-MD-WV: $4,865 tax · $8,703 spend · 8.4% of personal income
- Napa, CA: $4,766 tax · $9,013 spend · 5.3% of personal income
- San Francisco-Oakland-Fremont, CA: $4,671 tax · $11,743 spend · 3.8% of personal income
- Atlantic City-Hammonton, NJ: $4,615 tax · $7,069 spend · 7.5% of personal income
- San Jose-Sunnyvale-Santa Clara, CA: $4,569 tax · $11,222 spend · 3.3% of personal income
- Boulder, CO: $4,477 tax · $6,276 spend · 4.7% of personal income
- Kingston, NY: $4,415 tax · $7,078 spend · 7.0% of personal income

## Method notes

- Taxes = sum of Census T* item codes for local gov types 1–5.
- Spend = direct general expenditure proxy (E*/F* excl. utilities/liquor + I89 + J19).
- Intergovernmental expenditure (L/M) excluded to avoid double-counting across units.
- Local-to-local IG revenue (D*) excluded from transfer totals for the same reason.
- Special districts assigned wholly to home-county CBSA.
- City-hall contrast = municipal (type 2) units only — incomplete by design.
- Personal income = BEA CAINC1 county personal income summed to CBSA (Line 1).
- History includes FY2017 and FY2022 where both files were available.
- Population = Census CBSA estimates; 2017 uses nearest available vintage year.
- Modeled state allocation = state gov tax/spend × (CBSA population in state / state population); run via `pipeline/phase3_extras.py`.
- FiSC-style = simplified Lincoln-style central-city standardization from Census units (municipal + city share of home-county overlays); per capita uses central-city population. Not official Lincoln FiSC published figures. FiSC-style computed for 916 CBSAs; 151 central cities match Lincoln FiSC list names.
