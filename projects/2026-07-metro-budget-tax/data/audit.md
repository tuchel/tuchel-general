# Metro rollup audit — FY2022

- CBSAs with population: **925** (387 metropolitan, 538 micropolitan)
- Sum of local tax across all CBSAs: **$862.18B**
- Sum of direct general spend across all CBSAs: **$1988.13B**
- Metropolitan-only tax: **$810.22B**; spend: **$1838.92B**
- DAT rows scanned: 1,337,591; local: 1,330,465; mapped to a CBSA: 986,750

## Highest local tax per person (metros)

- New York-Newark-Jersey City, NY-NJ: $6,186/person (spend $10,653)
- Washington-Arlington-Alexandria, DC-VA-MD-WV: $4,865/person (spend $8,703)
- Napa, CA: $4,766/person (spend $9,013)
- San Francisco-Oakland-Fremont, CA: $4,671/person (spend $11,743)
- Atlantic City-Hammonton, NJ: $4,615/person (spend $7,069)
- San Jose-Sunnyvale-Santa Clara, CA: $4,569/person (spend $11,222)
- Boulder, CO: $4,477/person (spend $6,276)
- Kingston, NY: $4,415/person (spend $7,078)
- Bridgeport-Stamford-Danbury, CT: $4,373/person (spend $6,705)
- Kiryas Joel-Poughkeepsie-Newburgh, NY: $4,115/person (spend $7,022)

## Highest local spend per person (metros)

- San Francisco-Oakland-Fremont, CA: $11,743/person (tax $4,671)
- Mount Vernon-Anacortes, WA: $11,522/person (tax $2,391)
- San Jose-Sunnyvale-Santa Clara, CA: $11,222/person (tax $4,569)
- Salinas, CA: $10,695/person (tax $2,921)
- New York-Newark-Jersey City, NY-NJ: $10,653/person (tax $6,186)
- El Centro, CA: $10,603/person (tax $1,533)
- Bakersfield-Delano, CA: $10,534/person (tax $1,887)
- Visalia, CA: $10,131/person (tax $1,508)
- Cheyenne, WY: $10,079/person (tax $1,446)
- Jackson, TN: $9,418/person (tax $1,006)

## Method notes

- Taxes = sum of Census T* item codes for local gov types 1–5.
- Spend = direct general expenditure proxy (E*/F* excl. utilities/liquor + I89 + J19).
- Intergovernmental expenditure (L/M) excluded to avoid double-counting across units.
- Local-to-local IG revenue (D*) excluded from transfer totals for the same reason.
- Special districts assigned wholly to GID home county CBSA.
- Population = Census CBSA vintage estimate POPESTIMATE2022.
- Amounts from Census file are in $1,000s; converted to dollars in this pipeline.
