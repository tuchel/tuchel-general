# Source notes — Metro Budget & Tax Explorer

## Core insight from prior art

Lincoln Institute **FiSC** solves the “city hall only” problem for ~212 large cities by allocating overlying county / school / special-district finances onto the central city. This project needs the **metro-wide** analog: roll all local governments in a CBSA’s counties into one per-person ledger. FiSC remains the validation set and the pedagogical contrast for Chapter 2.

## Census join path

Individual-unit finance file (gov ID × item code × amount) → GID directory (FIPS state/county/place) → OMB county→CBSA delineation → sum → ÷ CBSA population estimates.

## Language trap

“Tax per person” on this page means **local tax collections per resident**, not tax incidence on households. UI copy must say so everywhere the number appears.

## Out of scope for v1

Federal income tax by county (Brookings/TPC maps), state tax allocation to metros (Phase 3 modeled overlay), adopted municipal budget PDFs.
