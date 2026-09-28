# Reitweg 25 — Solar with gas heating retained
Revised 26 September 2026. Preliminary feasibility, not metered demand or a surveyed installation design.

## Current brief and result
Keep the gas heating system; cover existing electricity plus two Tesla Model Ys travelling 5,000 km each per year. Existing gas heating duties are assumed unchanged. This scenario excludes all new electric space, water, pool and wintergarten heating, plus the prior extra cooling allowance. Existing electric pumps, appliances and cooling remain in baseline electricity.

- Existing electricity: (€412/month × 12 − €180 annual fixed charge) / €0.35 per kWh = 13,611.43 kWh/year.
- Cars: 2 × 5,000 km × 20 kWh/100 km at the socket = 2,000 kWh/year.
- Total: 15,611.43 kWh/year, before battery losses and standby, approximately 42.75 kWh/day.
- The €412 is an advance payment, not measured consumption. €0.35/kWh and €180 fixed are assumptions, not supplier quotes. The gas advance is not used in this calculation.
- Car consumption includes a planning allowance for charging losses; 20 kWh/100 km is not a Tesla rated figure. Exact variant, cold short trips and parked consumption matter. All charging is assumed at home. Persistent Sentry Mode is not separately modelled. Existing EV use in the baseline would need subtraction to avoid double-counting.
- Revised drawing: 50 × 450 W = 22.50 kWp / 97.6374 m² module area. Main east 26, main west 24; guest roof unchanged. Mean output approximately 17.36 MWh/year.
- Annual energy balance before storage losses: 45 panel-equivalents = 20.25 kWp / 87.87 m² at the selected mix. A smaller arrangement has not been separately optimized. Fifty panels provide a modest mean-year allowance for storage losses; they do not guarantee balance every year.
- Two Powerwall-sized storage units: 27 kWh usable nameplate, 24.3 kWh dispatched after 10% reserve. Approximate solar self-sufficiency 71.1%; grid imports 4.57 MWh/year. Four units: 75.0%; imports 3.98 MWh/year. These are model comparisons, not equipment or financial optimization.
- Electricity-grid independence is different from annual balance. Gas supply is still required.

## Demand sensitivities
Lower electricity case: (€4,944 − €240) / €0.40 + 2,000 = 13,760 kWh/year.
Working case: (€4,944 − €180) / €0.35 + 2,000 = 15,611 kWh/year.
Higher case: (€4,944 − €120) / €0.30 + 2,000 = 18,080 kWh/year.
These are tariff-based scenarios, not confidence bounds. Holding the baseline fixed, EV consumption of 16–24 kWh/100 km changes the car allowance to 1,600–2,400 kWh/year.

The previous heat-pump scenario is archived in solar-feasibility-heat-pump.json and solar-method-heat-pump.md. It assumed two cars at 15,000 km each and extra renovation loads. It is no longer the current brief.

## Site and geometry
Address point: 47.8606705 N, 11.2919095 E, Reitweg 25, Bernried am Starnberger See. PVGIS DEM elevation 626 m. North comes from the exposé compass and model registration; dimensions are traced from plans and roof heights inferred. These are not surveyed roof sections.

Main roof azimuths 97.5° east / 277.5° west clockwise from north; model pitch 35.43°. Guest roof 102.8° / 282.8°, pitch 36.12° (used only in the larger-array comparison). PVGIS rounds main pitch to 35°, guest to 36°, and its south-based aspects to −82/+98 and −77/+103.

Each module is 1.722 × 1.134 m, 450 W, in landscape. The same module coordinates drive the 3D view, counted diagram and calculation. The revised layout takes all 26 main east positions and 24 main west positions from the original packing. Assumed clearances: 0.45 m at roof perimeter, 0.25 m around modelled skylights, 25 mm between panels, plus chimney/junction exclusions. These are not regulatory clearances. Window opening, access, roof structure and mounting require survey. Module area excludes gaps and is not gross roof area.

## Solar and hourly method
PVGIS-SARAH3 / ERA5, 2005–2023, 166,536 chronological hours, 1 kWp crystalline silicon per face, ventilated/free-standing mounting, 14% system losses, terrain horizon enabled. Multiply each face by its assigned module kWp. Apply 10% further local shading throughout plus 5% snow loss in December–February. Trees/buildings are not individually resolved. Snow outages, inverter clipping and equipment degradation are not explicitly modelled.

Selected array yield is about 771.45 kWh/kWp/year. Actual near-field shade and roof geometry could materially change winter performance. Raw face-specific yields and yearly/monthly values are in the downloadable JSON.

Existing electricity follows a synthetic morning/evening-peaked daily profile repeated throughout the year. There is no measured seasonal profile; this materially limits winter analysis. EV demand is spread across 19:00–22:59 CET. CET = UTC+1 without daylight saving. No daytime charging optimization or full-power charging sessions are simulated.

PV serves loads first. Batteries start empty, charge only from PV surplus at 90% AC round-trip efficiency (all loss allocated to charging), retain 10% reserve and draw assumed standby of 10 W per storage unit. Inverter power is 4.6 kW per unit, capped at four; seven storage units represent four inverter units plus three expansions. Separate appropriately sized PV inverters are assumed. Solar share = 1 − imports / (load + battery standby); exports are not counted as self-supply.

The cited German Powerwall 3 sheet gives 13.5 kWh usable AC and single-phase 4.6 kW. Its solar-to-battery-to-home efficiency is 89%; the model uses a separate 90% AC round-trip assumption. Final equipment, phases, battery location, peak loads and island operation need an installer design. Two EV wallboxes can demand more instantaneous power than the batteries provide.

## Winter independence
For the 50-panel arrangement, the historical energy-only zero-import bound is approximately 4.65 MWh storage (345 Powerwall capacity equivalents). This is large because winter deficits must be carried from summer.

Scaling the main-roof mix: 100 panels / 45 kWp needs about 1.76 MWh; 150 / 67.5 kWp about 0.85 MWh; 200 / 90 kWp about 0.32 MWh. These scaled arrays are not drawn roof fits.

The separate original 117-panel array uses actual face counts 26 main east / 39 main west / 20 guest east / 32 guest west. It yields approximately 40.03 MWh/year. With the revised demand, solar share is about 86.4% with two batteries and 92.0% with four. Historical zero-import storage lower bound: about 1.43 MWh, or 107 Powerwall capacity equivalents. The current east and west photo renders show the 50-panel main-roof proposal. Earlier guest-wing and east renders are archived. The west reference photograph contains a high roof window not resolved by the simplified model; it is retained in the photo visualization. Reconcile all photographed windows with a measured roof layout before installation. The counted diagram and 3D view remain a 50-panel packing study.

The lower-bound algorithm takes the largest cumulative energy drawdown over two cyclic repetitions of the complete 19-year series, charging surplus at 90%, then divides by 0.9 for reserve. It assumes unlimited power, no self-discharge, no standby, no ageing and no outages. Real storage requirements would be higher. Passing historical weather does not guarantee future availability. Large Powerwall counts are capacity equivalents, not supported linked Tesla installations. True grid-free operation needs an appropriate BESS and a reliability design. The house would still depend on gas.

## Sources and reproduction
- Supplied Operating costs.pdf, page 1: electricity monthly advance €412. Original private document is not republished.
- Supplied exposé floor plans and compass; original roof photographs.
- Address point: https://www.openstreetmap.org/node/7025874846
- EU JRC PVGIS API: https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/api-non-interactive-service_en
- Tesla vehicle figures (model-specific test values, not the 20 kWh allowance): https://www.tesla.com/de_de/support/european-union-energy-label
- Tesla Powerwall 3 German datasheet: https://energylibrary.tesla.com/docs/Public/EnergyStorage/Powerwall/3/Datasheet/de-de/Powerwall-3-Datasheet-DE.pdf
- LONGi 450 W module dimensions: https://static.longi.com/L_Gi_LE_PM_T_PMD_059_F131_LR_5_54_HTH_445_455_M_V1_30_30_and_15_Black_Frame_Scientist_V19_es_web_fef7c3dbf7.pdf

Run node scripts/build-solar-diagram.mjs to generate geometry input. Download hourly inputs with python3 scripts/fetch-solar-weather.py if absent. Run python3 scripts/calculate-solar.py for results. Raw hourly weather remains local and can be re-downloaded from PVGIS.
