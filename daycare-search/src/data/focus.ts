import type { Score } from '../lib/types'

export type FocusPhoto = {
  /** Filename under `public/focus/`. */
  file: string
  alt: string
  credit: string
}

export type FocusReview = {
  summary: string
  sourceLabel: string
  sourceUrl: string
}

export type FocusSchool = {
  id: string
  /** Matches `SCHOOLS[].id` when the school is in ranked-v2. */
  rankedId: string | null
  name: string
  blunt: string
  url: string
  address: string
  photos: FocusPhoto[]
  pedagogy: string
  credential: string
  ages: string
  hours: string
  drive: string
  outdoor: string
  continuity: string
  cost: string
  /** Scores for the six first-pass bars. Primrose is editorial, not in ranked-v2. */
  scores: {
    outdoor: Score
    montessori: Score
    age_fit: Score
    distance: Score
    nature: Score
    logistics: Score
  }
  whyFinn: string[]
  downsides: string[]
  reviews: FocusReview[]
  missing: string[]
}

export const FOCUS_AS_OF = '30 Aug 2026'

export const FOCUS_SCHOOLS: FocusSchool[] = [
  {
    id: 'sunset-trail',
    rankedId: 'sunset-trail',
    name: 'Austin Montessori Sunset Trail',
    blunt: 'AMI cottages in the trees · ranked-v2 #1',
    url: 'https://austinmontessori.org',
    address: '5006 Sunset Trail / Jones Rd cottages, Austin 78745',
    photos: [
      {
        file: 'sunset-trail-hero.jpg',
        alt: 'Aerial view of metal-roof cottages among trees on the Sunset Trail campus',
        credit: 'austinmontessori.org hero still, 30 Aug 2026',
      },
    ],
    pedagogy: 'AMI Montessori. Three-hour work cycle; Children’s House 2½–6.',
    credential: 'AMI-recognized. School says lead Guides are AMI-trained.',
    ages: 'YCC 16–36 months; Children’s House from about 2½. Toilet-independent for CH.',
    hours: 'Morning to noon; extended day to 3:15. Early arrival 7:30 published on the tuition page.',
    drive: '12 min typical 8am (ranked-v2). OSRM uncongested 11.0 min / 5.02 mi.',
    outdoor: 'Cottages, gardens, outdoor work. Frozen outdoor 40 / nature 50.',
    continuity: '16 months to 15 years across three campuses (Sunset Trail, Great Northern, Gaines Creek).',
    cost: 'Published table. Children’s House traditional-year morning (2.5–4.5) listed at $16,506.',
    scores: {
      outdoor: 40,
      montessori: 100,
      age_fit: 50,
      distance: 200 / 3,
      nature: 50,
      logistics: 50,
    },
    whyFinn: [
      'This is the only AMI-recognized campus in the shortlist. Pedagogy 100 in ranked-v2 — the slider the household weighted at 20%.',
      'Finn at ~2y 10m sits in the overlap: Youngest Children’s Community through 36 months, or Children’s House if he is about 2½ and toilet-independent.',
      'Twelve minutes typical 8am. Outdoor file is the strongest of these three (cottages, gardens, rain-or-shine outdoor time on the YCC page).',
      'Same community can run through elementary and the Gaines Creek adolescent farm. That is the continuity Primrose cannot offer.',
    ],
    downsides: [
      'Age fit is 50, not 100: Children’s House is a beginning cycle with a toilet-independence expectation. A 2-year-10-month-old may still be in YCC.',
      'Logistics 50: published day is morning / mid-afternoon, not a 6:30 close. After-school care exists at elementary; preschool hours are shorter than Primrose.',
      'Parent reviews are split. GreatSchools shows 3.4 from 30 reviews. Children’s House years are often praised; later years and administration are more contested.',
      'A 2025 federal complaint (W.D. Tex. 1:25-cv-02020) names Austin Montessori School, Inc. Allegations are unadjudicated. It is a public-record flag, not a score.',
    ],
    reviews: [
      {
        summary:
          'GreatSchools 3.4 from 30 reviews (school-level, not campus-split). Older reviews praise YCC and Children’s House authenticity; 2023–2024 notes flag literacy oversight and administration.',
        sourceLabel: 'GreatSchools reviews',
        sourceUrl: 'https://www.greatschools.org/texas/austin/7587-Austin-Montessori-School/reviews/',
      },
      {
        summary:
          'Niche reviews split: some current parents describe guides who know the children and inclusion support; others describe administration as opaque on progress and safety.',
        sourceLabel: 'Niche · Austin Montessori School',
        sourceUrl: 'https://www.niche.com/k12/austin-montessori-school-austin-tx/reviews/',
      },
      {
        summary:
          'School site (Living Montessori) publishes parent and guide voices on independence, gardens, and screen-free early years. That is first-party, not a review site.',
        sourceLabel: 'austinmontessori.org',
        sourceUrl: 'https://austinmontessori.org/',
      },
    ],
    missing: [
      'Seat for this fall unpublished — do not treat as a waitlist.',
      'Which cottage Finn would join (YCC vs Children’s House) unpublished.',
    ],
  },
  {
    id: 'mariposa',
    rankedId: 'mariposa',
    name: 'Mariposa Montessori School',
    blunt: 'AMS-claimed South Austin campus · 8 weeks–15 years',
    url: 'https://www.mariposamontessori.com/',
    address: '3338 Paisano Trail, Austin 78745',
    photos: [
      {
        file: 'mariposa-front.jpg',
        alt: 'Walkway and Elementary Community building at Mariposa Montessori',
        credit: 'mariposamontessori.com front picture, 30 Aug 2026',
      },
      {
        file: 'mariposa-outing.jpg',
        alt: 'Mariposa Montessori School van on an outing',
        credit: 'mariposamontessori.com about page, 30 Aug 2026',
      },
    ],
    pedagogy: 'School says undiluted Montessori; MACTE-trained lead guides. Frozen pedagogy 70.',
    credential: 'School: Austin’s only AMS Fully Accredited Member. AMS public locator did not return this campus on 30 Aug 2026.',
    ages: '8 weeks to 15 years. Nido, YCC, Children’s House, elementary, adolescent.',
    hours: 'Not on the pages fetched. Admissions page describes a Waiting Pool, not daily hours.',
    drive: '16 min typical 8am; range 12–22 (straddle). OSRM uncongested 14.0 min / 7.58 mi.',
    outdoor: 'Ranked-v2 outdoor and nature unknown. School site claims 7–9 acres, gardens, animals.',
    continuity: 'Infant through 9th grade on one campus. Enrollment more than 180 (school site).',
    cost: 'Unpublished in this pass. Do not invent tuition.',
    scores: {
      outdoor: null,
      montessori: 70,
      age_fit: 100,
      distance: 100 / 3,
      nature: null,
      logistics: 50,
    },
    whyFinn: [
      'Age fit 100: Nido through Children’s House, so Finn is eligible now without a toilet-independence gate published on the pages fetched.',
      'Pedagogy 70 with a first-party AMS Fully Accredited Member claim and MACTE-trained leads — the middle of this shortlist, not a play-based franchise.',
      'One-campus continuity from infancy through adolescent. If a sibling or a long stay matters, this is the acreage village model.',
      'School site leans hard on land stewardship. That is the nature story ranked-v2 left unknown.',
    ],
    downsides: [
      'Outdoor and nature are still unknown in the ranking file. Acres on a marketing page are not a scored 100.',
      'Sixteen minutes typical; range can hit 20. Farthest of the three on both typical 8am and OSRM.',
      'AMS directory page for this Paisano address was not found in this pass. Treat “only fully accredited in Austin” as the school’s claim plus an AMS impact-report name collision risk (another Mariposa exists in California).',
      'Public review file is thin and mixed with an old Brodie Lane address in some directories. Do not invent a rating.',
    ],
    reviews: [
      {
        summary:
          'School site: applications enter a Waiting Pool; offers when a space opens. That is process language, not a current wait for Finn.',
        sourceLabel: 'Mariposa admissions',
        sourceUrl: 'https://www.mariposamontessori.com/admissions',
      },
      {
        summary:
          'Older parent write-ups (republished on local directories) praise Nido calm and the Falcon ownership. Sample is small and not dated to 2026.',
        sourceLabel: 'Unilocal reprint of older reviews',
        sourceUrl: 'https://unilocal.net/united-states/austin/mariposa-montessori-school',
      },
    ],
    missing: [
      'Hours unpublished on fetched pages.',
      'Tuition unpublished.',
      'Outdoor / nature still unknown in ranked-v2.',
      'AMS directory row for 3338 Paisano Trail not found 30 Aug 2026.',
    ],
  },
  {
    id: 'primrose-westlake',
    rankedId: null,
    name: 'Primrose School of West Lake Hills',
    blunt: 'In-zip Balanced Learning® · not in ranked-v2 trays',
    url: 'https://www.primroseschools.com/schools/west-lake-hills',
    address: '3423 Bee Cave Rd Suite A, Austin, TX 78746',
    photos: [
      {
        file: 'primrose-exterior.jpg',
        alt: 'Stone wall and Primrose Schools sign on Bee Cave Road',
        credit: 'primroseschools.com West Lake Hills exterior, 30 Aug 2026',
      },
      {
        file: 'primrose-playground.jpg',
        alt: 'Shaded playground with turf and play structure at Primrose West Lake Hills',
        credit: 'primroseschools.com West Lake Hills playground, 30 Aug 2026',
      },
    ],
    pedagogy: 'Primrose Balanced Learning®: teacher-guided plus purposeful play. Not Montessori or Reggio.',
    credential: 'Franchise. Owner-operators Christy and Jared Black (on-site story on the school page). Cognia/SEA seals on the site; not AMI/AMS.',
    ages: 'Infant through pre-K on the school site; third-party listings say 6 weeks–5 years.',
    hours: 'Monday–Friday 7:30 am–6:30 pm (school FAQ).',
    drive: 'Typical 8am unpublished. OSRM uncongested 2.2 min / 0.86 mi to the 3423 Bee Caves pin. Guidepost on Bee Cave is 7 min typical.',
    outdoor: 'Published playground under a shade sail. Outdoor and nature unknown in ranking terms (yard, not woods).',
    continuity: 'Stops at kindergarten. Eanes ISD is next door (Cedar Creek / Forest Trail, per the school page).',
    cost: 'Unpublished. Do not invent tuition.',
    scores: {
      outdoor: null,
      montessori: 0,
      age_fit: 100,
      distance: null,
      nature: null,
      logistics: 100,
    },
    whyFinn: [
      'Closest door: about a mile, same zip. If the household is choosing among three finalists, this is the only in-neighborhood full day.',
      'Hours 7:30–6:30, five days. Logistics 100 if scored. That is the gap AMI morning programs do not close.',
      'Age fit is clean: toddler / early preschool / preschool pathways exist for a child born 24 Oct 2023. No toilet-independence gate published.',
      'Owner-operators live the brand (four children through Primrose, per the school page). Franchise overlay is real; so is a named local couple.',
    ],
    downsides: [
      'Pedagogy is a known 0 on the Montessori / Reggio slider. Balanced Learning is purposeful play, not an atelier and not AMI.',
      'Not in ranked-v2. Outdoor, nature, and typical-8am distance are unknown — a first-pass sort built only from known cells would be coverage-thin.',
      'Continuity ends at kindergarten. The AMI/AMS arc is the thing this school cannot sell.',
      'Reviews are mixed and the independent sample is small (Yelp 4.1 from 8 via MapQuest). Listen360 is a school-managed channel.',
    ],
    reviews: [
      {
        summary:
          'Yelp 4.08 from 8 reviews (MapQuest feed). Recent praise for teachers and flexibility; older 2021 notes are sharply negative on tours and feeding.',
        sourceLabel: 'Yelp via MapQuest',
        sourceUrl: 'https://www.yelp.com/biz/primrose-school-of-west-lake-hills-austin',
      },
      {
        summary:
          'Listen360 (school review channel): long-stay families praise teachers and the app; several mention uneven classroom fit, tablet use, and weak transition notes.',
        sourceLabel: 'Listen360',
        sourceUrl: 'https://reviews.listen360.com/primrose-school-of-west-lake-hills-austin',
      },
    ],
    missing: [
      'Typical 8am drive unpublished — OSRM only.',
      'Tuition unpublished.',
      'HHSC operation number not confirmed on childcare.hhs.texas.gov in this pass (Daycare.com lists 1661183; unverified).',
      'Seats this fall unpublished — do not invent a waitlist.',
    ],
  },
]

export const FOCUS_COMPARE_ROWS: {
  id: string
  label: string
  pick: (s: FocusSchool) => string
}[] = [
  { id: 'pedagogy', label: 'Pedagogy', pick: (s) => s.pedagogy },
  { id: 'credential', label: 'Credential', pick: (s) => s.credential },
  { id: 'ages', label: 'Ages / Finn', pick: (s) => s.ages },
  { id: 'drive', label: 'Drive', pick: (s) => s.drive },
  { id: 'hours', label: 'Hours', pick: (s) => s.hours },
  { id: 'outdoor', label: 'Outdoor / nature', pick: (s) => s.outdoor },
  { id: 'continuity', label: 'Continuity', pick: (s) => s.continuity },
  { id: 'cost', label: 'Cost', pick: (s) => s.cost },
]
