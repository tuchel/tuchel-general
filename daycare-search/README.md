# Schools for Finn

Interactive ranking of Austin / West Lake Hills daycare options for Finn (born 24 Oct 2023, ~2y 10m) from 427 Ridgewood Rd, West Lake Hills, TX 78746.

Quiet Hill Country editorial tool. Frozen **ranked-v2** scores (28 Aug 2026). Dragging the six live weights re-ranks from stored raw scores in the client. Unknown is labeled unknown and dropped from the denominator; a known 0 stays in. The 20% slider is **Montessori / Reggio** (field id `montessori`).

Live: [tuchel.github.io/tuchel-general/daycare-search/](https://tuchel.github.io/tuchel-general/daycare-search/)

## Run

```bash
cd daycare-search
npm i
npm run dev
```

`npm test` checks first-pass Ranked order (Sunset Trail #1 sort 59.5, Atelier Preescolar #2 sort 57.0), Fiorella pedagogy 50, WonderWell pedagogy 50 not 100, and that every school URL is a non-empty https string.

## Ranking

- **A** = criteria with weight > 0
- **W** = subset of A with a numeric score (not unknown)
- **raw** = Σ(weightᵢ × scoreᵢ for i in W) / Σ(weightᵢ for i in W)
- **coverage** = Σ(weightᵢ for i in W) / Σ(weightᵢ for i in A)
- Default sort = raw × coverage. Labeled toggle: Sort by raw only.
- Distance score is stored from ranked-v2. Weights do not recompute it from minutes.

First pass defaults: outdoor 30, Montessori / Reggio 20, age fit 15, distance 15, nature 10, logistics 10. Continuity, cost, staff, availability start at 0.

Trays are frozen with the snapshot, not re-derived from sliders:

1. **Ranked** — typical 8am under 20 minutes and eligible now
2. **Worth the drive** — typical 8am ≥ 20 (Lake Hills sits here because typical is 24; range-high is a flag)
3. **Eligible at 3** — age-gated this fall (Casa AMI, Nature’s Way, Tigerlily, Bloom, Parkside, Cedars, …). Parkside and Cedars typical is under 20; Tigerlily typical is 22 and still sits here.

Do not treat this file as a waitlist, tuition, or credential authority. Notes on those subjects are only what ranked-v2 recorded.

## Prior art (kickoff, 28 Aug 2026)

**Job to be done:** James Tuchel, at home in West Lake Hills, needs to re-rank a researched set of schools for Finn this fall by outdoor / Montessori-Reggio / age / drive / nature / logistics — with unknown scores dropped, not zeroed.

| Match | URL | Job it covers | Gap vs this |
| --- | --- | --- | --- |
| Winnie | https://winnie.com/austin/daycares | Find licensed Austin daycares by map, age, price, reviews | No frozen outdoor/Montessori scores, no coverage math, no three-tray age/drive split for this household |
| Care.com | https://www.care.com/child-care | Marketplace for centers and sitters | Same: discovery, not this ranked-v1 model |
| Texas HHSC Child Care Search | https://childcare.hhs.texas.gov | License and inspection lookup | Verification source, not a ranking tool |
| NAEYC program search | https://www.naeyc.org/ | Accreditation lookup | Credential check only |
| Guidepost / school sites | e.g. https://guidepostmontessori.com/schools/westlake-austin-tx/ | Single-school marketing | Not a comparison |

Internal: [Austin luxury gyms](../projects/2026-08-austin-luxury-gyms/) maps clubs from the same Ridgewood Road point with live weights — commute scoring pattern, different domain. [APL Storytime](../projects/2026-08-apl-storytime/) is the other West Lake Hills family calendar.

**Recommend: differentiate.** Incumbents find daycares. They do not carry this household’s frozen scores or the unknown-dropped-from-denominator rule. Building is the ranking surface, not a second Winnie.

## Pointers

- Data: `src/data/schools.ts`
- Math: `src/lib/rank.ts`
