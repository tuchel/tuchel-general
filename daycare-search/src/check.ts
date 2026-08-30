import { FOCUS_SCHOOLS } from './data/focus'
import { SCHOOLS } from './data/schools'
import { fmt1, fmtPct, rankSchool } from './lib/rank'
import { FIRST_PASS } from './lib/types'

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg)
}

function near(a: number, b: number, eps = 0.06): boolean {
  return Math.abs(a - b) < eps
}

const ranked = SCHOOLS.filter((s) => s.tray === 'ranked').map((s) => ({
  s,
  r: rankSchool(s, FIRST_PASS),
}))
ranked.sort((a, b) => (b.r.sort ?? -1) - (a.r.sort ?? -1))

const names = ranked.map((x) => x.s.id)
assert(names[0] === 'sunset-trail', `expected Sunset Trail #1, got ${names[0]}`)
assert(names[1] === 'atelier-preescolar', `expected Atelier Preescolar #2, got ${names[1]}`)
assert(names[2] === 'cdc-south', `expected CDC South #3, got ${names[2]}`)

const st = ranked[0].r
assert(st.raw != null && near(st.raw, 59.5), `Sunset raw ${st.raw}`)
assert(st.sort != null && near(st.sort, 59.5), `Sunset sort ${st.sort}`)
assert(fmt1(st.sort!) === '59.5', `Sunset sort display ${fmt1(st.sort!)}`)

const atelier = ranked[1]
assert(atelier.r.sort != null && near(atelier.r.sort, 57.0), `Atelier sort ${atelier.r.sort}`)
assert(fmt1(atelier.r.sort!) === '57.0', `Atelier sort display ${fmt1(atelier.r.sort!)}`)

const cdcSchool = SCHOOLS.find((s) => s.id === 'cdc-south')!
const cdc = rankSchool(cdcSchool, FIRST_PASS)
assert(cdcSchool.scores.montessori === 0, 'CDC pedagogy is known 0 (play-based)')
assert(cdc.sort != null && near(cdc.sort, 49.5), `CDC sort ${cdc.sort}`)

const fiorella = SCHOOLS.find((s) => s.id === 'fiorella')!
assert(fiorella.scores.montessori === 50, `Fiorella ped ${fiorella.scores.montessori}`)
const fioR = rankSchool(fiorella, FIRST_PASS)
assert(fioR.sort != null && near(fioR.sort, 44.5), `Fiorella sort ${fioR.sort}`)
assert(fioR.coverage != null && near(fioR.coverage, 0.9), `Fiorella cov ${fioR.coverage}`)

const ww = SCHOOLS.find((s) => s.id === 'wonderwell')!
assert(ww.scores.montessori === 50, `WonderWell ped ${ww.scores.montessori}`)
assert(ww.scores.montessori !== 100, 'WonderWell ped is 50, not 100')
const wwR = rankSchool(ww, FIRST_PASS)
assert(wwR.sort != null && near(wwR.sort, 39.0), `WonderWell sort ${wwR.sort}`)

const gp = SCHOOLS.find((s) => s.id === 'guidepost-westlake')!
const gpR = rankSchool(gp, FIRST_PASS)
assert(!gpR.used.includes('montessori'), 'Guidepost pedagogy unknown must be dropped, not zero')
assert(gpR.sort != null && near(gpR.sort, 44.0), `Guidepost sort ${gpR.sort}`)

const bloom = SCHOOLS.find((s) => s.id === 'bloom')!
assert(bloom.tray === 'eligible_at_3', 'Bloom stays eligible-at-3')
assert(bloom.scores.distance === 50, `Bloom dist ${bloom.scores.distance}`)
assert(bloom.driveMinutesTypical === 14, `Bloom minutes ${bloom.driveMinutesTypical}`)
const bloomR = rankSchool(bloom, FIRST_PASS)
assert(bloomR.sort != null && near(bloomR.sort, 41.5), `Bloom sort ${bloomR.sort}`)

const tiger = SCHOOLS.find((s) => s.id === 'tigerlily')!
assert(tiger.tray === 'eligible_at_3', 'Tigerlily primary tray is eligible-at-3')
assert(tiger.driveMinutesTypical === 22, 'Tigerlily typical is 22')
assert(
  !SCHOOLS.some((s) => s.id === 'tigerlily' && s.tray === 'worth_the_drive'),
  'Tigerlily must not be duplicated in Worth the drive',
)

const kla = SCHOOLS.find((s) => s.id === 'kla-sweetwater')!
assert(kla.tray === 'worth_the_drive', 'KLA is worth-the-drive')
assert(kla.scores.montessori === 100, `KLA ped ${kla.scores.montessori}`)
const klaR = rankSchool(kla, FIRST_PASS)
assert(klaR.sort != null && near(klaR.sort, 62.0), `KLA sort ${klaR.sort}`)
assert(klaR.coverage === 1, 'KLA coverage 100%')

const wtd = SCHOOLS.filter((s) => s.tray === 'worth_the_drive').map((s) => ({
  s,
  r: rankSchool(s, FIRST_PASS),
}))
wtd.sort((a, b) => (b.r.sort ?? -1) - (a.r.sort ?? -1))
assert(wtd[0].s.id === 'kla-sweetwater', `WTD #1 should be KLA, got ${wtd[0].s.id}`)

const pio = SCHOOLS.find((s) => s.id === 'pio-pio')!
assert(pio.tray === 'worth_the_drive', 'Pío Pío is worth-the-drive (typical 20)')
assert(pio.driveMinutesTypical === 20, 'Pío Pío typical is 20')
const pioR = rankSchool(pio, FIRST_PASS)
assert(pioR.sort != null && near(pioR.sort, 47.0), `Pío Pío sort ${pioR.sort}`)

const lake = SCHOOLS.find((s) => s.id === 'lake-hills')!
assert(lake.tray === 'worth_the_drive', 'Lake Hills must be worth-the-drive')

const casa = SCHOOLS.find((s) => s.id === 'casa-ami')!
const nw = SCHOOLS.find((s) => s.id === 'natures-way')!
assert(casa.tray === 'eligible_at_3', 'Casa AMI must be eligible-at-3')
assert(nw.tray === 'eligible_at_3', 'Nature’s Way must be eligible-at-3')

const earth = SCHOOLS.find((s) => s.id === 'earth-native')!
assert(earth.scores.outdoor === 100, `Earth Native outdoor ${earth.scores.outdoor}`)

const zeroPed = { ...FIRST_PASS, montessori: 50 }
const cdc2 = rankSchool(cdcSchool, zeroPed)
assert(cdc2.used.includes('montessori'), 'known 0 stays in W when weight > 0')

for (const s of SCHOOLS) {
  assert(
    typeof s.url === 'string' && s.url.startsWith('https://') && s.url.length > 'https://'.length,
    `${s.id} needs a non-empty https url`,
  )
}

assert(FOCUS_SCHOOLS.length === 4, `focus should be 4, got ${FOCUS_SCHOOLS.length}`)
assert(FOCUS_SCHOOLS[0].id === 'sunset-trail', 'focus #1 Sunset Trail')
assert(FOCUS_SCHOOLS[1].id === 'mariposa', 'focus #2 Mariposa')
assert(FOCUS_SCHOOLS[2].id === 'primrose-westlake', 'focus #3 Primrose')
assert(FOCUS_SCHOOLS[3].id === 'st-michaels', 'focus #4 St. Michael’s')
assert(FOCUS_SCHOOLS[0].scores.montessori === 100, 'Sunset ped 100')
assert(FOCUS_SCHOOLS[1].scores.montessori === 70, 'Mariposa ped 70')
assert(FOCUS_SCHOOLS[2].scores.montessori === 0, 'Primrose ped is known 0')
assert(FOCUS_SCHOOLS[3].scores.montessori === 50, 'St. Michael’s ped 50')
assert(FOCUS_SCHOOLS[3].scores.age_fit === 100, 'St. Michael’s age fit 100')
assert(FOCUS_SCHOOLS[3].scores.logistics === 0, 'St. Michael’s logistics is known 0 (part-day)')
assert(FOCUS_SCHOOLS[2].rankedId == null, 'Primrose stays out of ranked trays')
assert(FOCUS_SCHOOLS[3].rankedId == null, 'St. Michael’s stays out of ranked trays')
assert(
  SCHOOLS.some((s) => s.id === 'sunset-trail') && SCHOOLS.some((s) => s.id === 'mariposa'),
  'Sunset and Mariposa remain in SCHOOLS',
)
assert(!SCHOOLS.some((s) => s.id === 'primrose-westlake'), 'Primrose is Focus-only')
assert(!SCHOOLS.some((s) => s.id === 'st-michaels'), 'St. Michael’s is Focus-only')

for (const s of FOCUS_SCHOOLS) {
  assert(s.url.startsWith('https://'), `${s.id} focus url`)
  assert(s.photos.length >= 1, `${s.id} needs a photo`)
  for (const p of s.photos) {
    assert(p.file.endsWith('.jpg'), `${s.id} photo should be a local jpg`)
  }
  for (const r of s.reviews) {
    assert(r.sourceUrl.startsWith('https://'), `${s.id} review source`)
  }
  const blob = [...s.whyFinn, ...s.downsides, ...s.missing, ...s.reviews.map((r) => r.summary)].join(' ')
  assert(!/finn is on (the )?wait/i.test(blob), `${s.id} invented a waitlist`)
}

console.log('first-pass checks ok')
console.log(
  ranked
    .slice(0, 6)
    .map((x) => `${x.s.name}  raw ${fmt1(x.r.raw!)}  cov ${fmtPct(x.r.coverage)}  sort ${fmt1(x.r.sort!)}`)
    .join('\n'),
)
