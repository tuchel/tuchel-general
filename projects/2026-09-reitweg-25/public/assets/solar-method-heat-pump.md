> Archived scenario: superseded by the gas-retained, 5,000 km-per-car brief. The reproduction instructions below refer to Site version 18 (source commit 44ced5c43f056dce34205510cc449daaed6eab92); current scripts calculate the revised case.

# Reitweg 25 — Solar and storage feasibility
Prepared 25 September 2026. Preliminary study, not a measured design or an off-grid guarantee.

## Outcome
- Illustrated roof packing: 117 × 450 W = 52.65 kWp, 228.47 m² of module surface.
- Working annual solar output after stated losses: 40.03 MWh; historical annual range 36.54–42.95 MWh.
- Working post-heat-pump electricity demand: 46.73 MWh/year, including two electric cars. Demand scenario range 36.59–62.74 MWh/year.
- Average annual energy balance: 137 panels, 61.65 kWp, 267.53 m² at the same orientation mix. This requires 20 more panels than the illustrated layout; additional roof fit is unproven. No battery is needed for annual accounting. Roughly 145–150 panels is an initial allowance including practical battery losses and a modest margin, not a guaranteed annual result.
- Four 13.5 kWh battery capacities: 54 kWh usable nameplate, 48.6 kWh dispatched after 10% reserve. Approximately 56% hourly solar self-sufficiency with the illustrated roof; 20.9 MWh/year still imported.
- True 100% solar-only independence is not achievable with this illustrated roof and any finite battery, because annual energy is insufficient in the working case.
- An optimistic historical energy-only test at 210.6 kWp (468 modules / 913.89 m²) needs at least 5.52 MWh nameplate storage, equivalent in capacity to 409 Powerwall-sized batteries. At 315.9 kWp / 1,370.83 m² it still needs at least 1.82 MWh / 135 equivalents. These are not supported Tesla installations or engineering recommendations. They omit standby, self-discharge, ageing and inverter constraints; real requirements are larger. Passing historic weather does not guarantee future availability.
- Module area is not land area. Roof slope area is approximately 570 m² gross before openings and access. A 211 kWp array cannot be honestly represented as a roof-only proposal here. The portal images and 3D layer show the feasible-to-investigate 117-panel packing study, NOT a self-sufficient system.

## Evidence and demand derivation
The exposé lists Reitweg 25, 82347 Bernried am Starnberger See; about 488 m² advertised living area; gas heating; EA-V 139.0 kWh/m²/year, class E. The certificate itself and its energy reference area are absent. The advertised area includes fractional outdoor areas. Do not multiply the two numbers as if they were a measured annual heat load.

The supplied Operating costs.pdf lists monthly ADVANCE payments of €412 electricity and €1,248 gas. It contains no metered kWh or tariffs. The original private document is not republished with the Site; only the energy figures needed for this requested analysis are summarized.

Working tariff assumptions (not supplier quotes): gas €0.12/kWh plus €240/year standing charge; electricity €0.35/kWh plus €180/year standing charge. Therefore inferred gas = (1248×12−240)/0.12 = 122,800 kWh/year. Existing electricity = (412×12−180)/0.35 = 13,611 kWh/year. Advances may be unrelated to actual reconciled use.

Working useful heat = inferred gas × 90% boiler efficiency, allocated 75% to space heat, 5% to hot water, 20% to seasonal pool heat. This split is not observed. Divide by assumed ground-source performance of 4.3 space, 3.2 hot water, 5.0 pool. Add extension heat of 3,000 kWh thermal / 4.3, plus 1,000 kWh additional cooling electricity. Glazing and other renovations have not undergone a thermal model.

Two EVs × 15,000 km each × 20 kWh/100km measured at the socket = 6,000 kWh/year. The user confirmed two vehicles; mileage and charging profile are assumed. Existing electricity already includes miscellaneous household, pool circulation and sauna loads. Do not add those again. Occupancy is unconfirmed.

Lower scenario: gas €0.15/kWh + €300 standing; electricity €0.40/kWh + €240 standing; boiler 85%; space SPF 4.8, DHW 3.5, pool 5.5. Higher: gas €0.10 + €180; electricity €0.30 + €120; boiler 95%; space SPF 3.6, DHW 2.8, pool 4.0. These are planning sensitivities, not statistical confidence bounds.

Electricity independence does not eliminate any gas still used by retained cooking appliances or fireplaces. The heat-pump conversion is assumed feasible, not established by this study. Ask for reconciled meter readings, tariffs and the full energy certificate before refining equipment sizes.

## Geometry and generation
Address geocode: 47.8606705 N, 11.2919095 E, OpenStreetMap address node 7025874846. This is an address point, not a roof survey. PVGIS DEM elevation is 626 m.

Plan compass gives approximate main roof azimuths 97.5°/277.5° clockwise from true north; guest 102.8°/282.8°. Main model pitch 35.43°, guest 36.12°. These derive from plan registration and inferred roof heights, not measured sections. PVGIS rounds the submissions to main 35°, guest 36°, with south-based aspects −82/+98 and −77/+103. Roof heights, pitches and exact north alignment are material uncertainties.

PVGIS-SARAH3 / ERA5, 2005–2023, 166,536 chronological hours; crystalline silicon; 1 kWp per face; ventilated mounting (`mountingplace=free`), fixed array, 14% system loss, terrain horizon enabled. Multiply face power by its assigned kWp: main east 26 modules, main west 39, guest east 20, guest west 32. Before extra shade/snow, specific yields are 893.93, 826.85, 915.53 and 798.64 kWh/kWp/year respectively.

Apply an additional 10% local shading allowance throughout and 5% further snow loss in Dec-Feb. PVGIS terrain horizon does not model the individual trees/buildings here. These extra factors are explicit assumptions. At 0%, 10%, 25% extra local shading (holding winter snow fixed), mean annual PV is about 44.5, 40.0, 33.4 MWh. Storm/snow outage sequences are not explicitly resolved by this blanket snow loss; a shading and snow study may materially worsen winter autonomy.

Pitch sensitivity on the main-house azimuths, before extra shade/snow: 30° vs 40° gives 918.92 vs 893.54 kWh/kWp east and 857.64 vs 819.69 west. This is a sensitivity, not a measured roof angle.

450 W module reference: LONGi LR5-54HTH, 1722 × 1134 × 30 mm. The 3D module dimensions/counts are deterministic; photo edits are appearance studies with approximate module shapes. Packing uses landscape modules, 25 mm intermodule gaps, 450 mm perimeter and 250 mm clearance around the modelled skylights. The chimney and roof junctions receive additional exclusions. All clearances are study assumptions, not regulatory claims. Roof-window opening envelopes, fire/chimney access, structural load, roofing condition and mounting need an installer survey. Connector and kitchen-extension roofs are excluded. The packing is one arrangement, not a proof of maximum capacity.

## Hourly model
Space heat is proportional to max(18−T2m,0) when temperature is below 15°C, normalized over all 19 years to the assumed average demand. Colder years therefore require more heat. Base electricity uses synthetic morning and evening peaks. EV charging is uniform 19:00–22:59 CET; pool heating May–Sept 09:00–18:59 CET; cooling June–Aug 10:00–20:59 CET; hot water flat. CET is UTC+1 without DST adjustment. No smart daytime EV shifting assumed.

PV goes to loads first. Batteries start empty, charge only from PV surplus at 90% roundtrip efficiency (loss allocated to charging), and retain 10% reserve. Storage capacity is deliverable AC nameplate; discharge uses that AC accounting. Power is 4.6 kW per inverter unit, capped at four units; seven storage units mean four inverter units + three expansions. Standby assumed 10 W per unit. Reported solar share is 1−imports/(load+standby), over all 19 years. Exports and unused final charge are not counted as served demand.

Zero-import bounds use two cyclic repetitions of the full 19-year series. The increment is PV−load when negative, and (PV−load)×0.9 when positive. Find the maximum cumulative drawdown; divide by 0.9 for 10% reserve. If mean net energy is nonpositive, no finite capacity can work. The test has unlimited charging/discharging power, no standby or self-discharge, no ageing and no component outages: an OPTIMISTIC ENERGY-ONLY LOWER BOUND.

No long-term climate guarantee follows from historic weather. PV output also degrades. A truly islanded system must meet loss-of-load criteria, peak loads, three-phase motor starting, inverter and protection requirements and black-start constraints. All quoted >7 Powerwall counts are CAPACITY EQUIVALENTS ONLY. The German Powerwall 3 sheet supports up to 4 inverter units plus 3 Expansions, 94.5 kWh total, not hundreds of linked units. Evaluate an appropriate commercial/industrial BESS and seasonal/dispatchable supply if grid-free operation remains essential.

The documented German Powerwall 3 is single-phase 4.6 kW and 13.5 kWh; it cites 89% solar-to-battery-to-home efficiency. The model’s 90% AC roundtrip is a separate assumption. A current three-phase product may be more suitable, but has not been selected. Four Powerwalls alone do not establish three-phase heat-pump backup. Appropriately sized separate PV inverters are assumed, avoiding a false 52.65 kWp-through-18.4 kW inverter bottleneck; actual inverter clipping is not modelled.

## Sources
- EU JRC PVGIS API: https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/api-non-interactive-service_en
- Example actual hourly request (main east): https://re.jrc.ec.europa.eu/api/v5_3/seriescalc?lat=47.8606705&lon=11.2919095&startyear=2005&endyear=2023&pvcalculation=1&peakpower=1&loss=14&angle=35.4&aspect=-82.5&raddatabase=PVGIS-SARAH3&pvtechchoice=crystSi&mountingplace=free&usehorizon=1&outputformat=json
- OpenStreetMap address point: https://www.openstreetmap.org/node/7025874846
- Tesla German Powerwall 3 datasheet: https://energylibrary.tesla.com/docs/Public/EnergyStorage/Powerwall/3/Datasheet/de-de/Powerwall-3-Datasheet-DE.pdf
- Fraunhofer measured ground-source performance (mean 4.3, range 3.6–5.4): https://www.ise.fraunhofer.de/de/presse-und-medien/presseinformationen/2025/waermepumpen-heizen-auch-im-altbau-klimafreundlich-forschungsprojekt-des-fraunhofer-ise-abgeschlossen.html
- Module dimensions and 450 W rating: https://static.longi.com/L_Gi_LE_PM_T_PMD_059_F131_LR_5_54_HTH_445_455_M_V1_30_30_and_15_Black_Frame_Scientist_V19_es_web_fef7c3dbf7.pdf
- Supplied property exposé, printed pp. 4–5, 36–41; supplied Operating costs.pdf, p. 1; original roof photographs.

## Reproduction
`node scripts/build-solar-diagram.mjs` generates the shared layout input and counted diagram.
`python3 scripts/fetch-solar-weather.py` downloads the four hourly PVGIS series and pitch sensitivities to local temporary storage.
`python3 scripts/calculate-solar.py` produces solar-feasibility.json. Original hourly weather files remain local and can be redownloaded from the cited service.
