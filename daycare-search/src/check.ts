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
assert(names[1] === 'cdc-south', `expected CDC South #2, got ${names[1]}`)
assert(names[2] === 'headwaters-springs', `expected Headwaters #3, got ${names[2]}`)
assert(names[3] === 'butterfly', `expected Butterfly #4, got ${names[3]}`)

const st = ranked[0].r
assert(st.raw != null && near(st.raw, 59.5), `Sunset raw ${st.raw}`)
assert(st.coverage != null && near(st.coverage, 1), `Sunset cov ${st.coverage}`)
assert(st.sort != null && near(st.sort, 59.5), `Sunset sort ${st.sort}`)
assert(fmt1(st.sort!) === '59.5', `Sunset sort display ${fmt1(st.sort!)}`)

const cdcSchool = ranked[1].s
const cdc = ranked[1].r
assert(cdc.raw != null && near(cdc.raw, 49.5) && near(cdc.sort!, 49.5), `CDC ${cdc.sort}`)
assert(cdc.coverage === 1, 'CDC coverage should be 100% (montessori is known 0)')

const hw = ranked[2].r
assert(hw.raw != null && near(hw.raw, 52.2), `Headwaters raw ${hw.raw} (${fmt1(hw.raw!)})`)
assert(hw.coverage != null && near(hw.coverage, 0.9), `Headwaters cov ${hw.coverage}`)
assert(hw.sort != null && near(hw.sort, 47.0), `Headwaters sort ${hw.sort}`)

const bf = ranked[3].r
assert(bf.sort != null && near(bf.sort, 46.5), `Butterfly sort ${bf.sort}`)

const gp = SCHOOLS.find((s) => s.id === 'guidepost-westlake')!
const gpR = rankSchool(gp, FIRST_PASS)
assert(!gpR.used.includes('montessori'), 'Guidepost Montessori unknown must be dropped, not zero')
assert(gpR.coverage != null && near(gpR.coverage, 0.8), `Guidepost cov ${gpR.coverage}`)
assert(gpR.raw != null && near(gpR.raw, 55.0), `Guidepost raw ${gpR.raw}`)
assert(gpR.sort != null && near(gpR.sort, 44.0), `Guidepost sort ${gpR.sort}`)

const lake = SCHOOLS.find((s) => s.id === 'lake-hills')!
assert(lake.tray === 'worth_the_drive', 'Lake Hills must be worth-the-drive')
assert(lake.driveMinutesTypical === 24, 'Lake Hills typical is 24')
assert(lake.straddle, 'Lake Hills range can hit 20')

const casa = SCHOOLS.find((s) => s.id === 'casa-ami')!
const nw = SCHOOLS.find((s) => s.id === 'natures-way')!
assert(casa.tray === 'eligible_at_3', 'Casa AMI must be eligible-at-3')
assert(nw.tray === 'eligible_at_3', 'Nature’s Way must be eligible-at-3')

const parkside = SCHOOLS.find((s) => s.id === 'parkside')!
const cedars = SCHOOLS.find((s) => s.id === 'cedars')!
assert(parkside.tray === 'eligible_at_3', 'Parkside clears 20 typical so lives in eligible-at-3')
assert(cedars.tray === 'eligible_at_3', 'Cedars clears 20 typical so lives in eligible-at-3')
assert((parkside.driveMinutesTypical ?? 99) < 20, 'Parkside typical under 20')
assert((cedars.driveMinutesTypical ?? 99) < 20, 'Cedars typical under 20')

const bloom = SCHOOLS.find((s) => s.id === 'bloom')!
assert(bloom.scores.distance == null, 'Bloom distance is unknown, not 0')
const bloomR = rankSchool(bloom, FIRST_PASS)
assert(!bloomR.used.includes('distance'), 'unknown distance must not enter W')

const earth = SCHOOLS.find((s) => s.id === 'earth-native')!
assert(earth.scoreSource === 'published', 'Earth Native scores are published, not fitted')
assert(earth.scores.outdoor === 100, `Earth Native outdoor ${earth.scores.outdoor}`)
assert(earth.scores.age_fit === 0, `Earth Native age_fit ${earth.scores.age_fit}`)
const earthR = rankSchool(earth, FIRST_PASS)
assert(earthR.raw != null && near(earthR.raw, 42.0), `Earth Native raw ${earthR.raw}`)
assert(earthR.coverage != null && near(earthR.coverage, 1), `Earth Native cov ${earthR.coverage}`)

const lakeScores = SCHOOLS.find((s) => s.id === 'lake-hills')!
assert(lakeScores.scoreSource === 'published', 'Lake Hills scores are published, not fitted')
assert(lakeScores.scores.outdoor === 40, `Lake Hills outdoor ${lakeScores.scores.outdoor}`)
assert(lakeScores.scores.age_fit === 50, `Lake Hills age_fit ${lakeScores.scores.age_fit}`)

const sith = SCHOOLS.find((s) => s.id === 'sith-river-place')!
assert(sith.scoreSource === 'published', 'SITH scores are published, not fitted')
assert(sith.scores.outdoor === 40, `SITH outdoor ${sith.scores.outdoor}`)
assert(sith.scores.montessori === 50, `SITH montessori ${sith.scores.montessori}`)

const gn = SCHOOLS.find((s) => s.id === 'great-northern')!
const gb = SCHOOLS.find((s) => s.id === 'garden-blossom')!
assert(gn.straddle && gn.driveRange?.[0] === 14 && gn.driveRange?.[1] === 20, 'Great Northern range 14–20')
assert(gb.straddle && gb.driveRange?.[0] === 14 && gb.driveRange?.[1] === 20, 'Garden Blossom range 14–20')

const gem = SCHOOLS.find((s) => s.id === 'gem-of-the-forest')!
assert(gem.scoreSource === 'published', 'Gem scores are published, not fitted')
assert(gem.scores.age_fit === 0, 'Gem age_fit is known 0')

const bee = SCHOOLS.find((s) => s.id === 'guidepost-bee-cave')!
assert(bee.scoreSource === 'published', 'Guidepost Bee Cave scores are published, not fitted')
assert(bee.scores.montessori == null, 'Guidepost Bee Cave Montessori unknown')

assert(
  SCHOOLS.filter((s) => s.tray === 'ranked' || s.tray === 'eligible_at_3').every((s) => s.scoreSource === 'published'),
  'ranked and eligible-at-3 stay published',
)

const zeroMont = { ...FIRST_PASS, montessori: 50 }
const cdc2 = rankSchool(cdcSchool, zeroMont)
assert(cdc2.used.includes('montessori'), 'known 0 stays in W when weight > 0')
assert(cdcSchool.scores.montessori === 0, 'CDC montessori is 0, not unknown')

const gpDrive = gp.driveMinutesTypical
const gpDist = gp.scores.distance
assert(gpDrive === 7 && gpDist === 100, 'distance score is stored, not derived at rank time')
const moved = rankSchool(gp, { ...FIRST_PASS, outdoor: 0, nature: 0 })
assert(moved.used.includes('distance') && gp.scores.distance === gpDist, 'weights change must not mutate distance')

assert(fmtPct(0.9) === '90%', fmtPct(0.9))
assert(fmtPct(1) === '100%', fmtPct(1))

for (const s of SCHOOLS) {
  assert(
    typeof s.url === 'string' && s.url.startsWith('https://') && s.url.length > 'https://'.length,
    `${s.id} needs a non-empty https url`,
  )
}

console.log('first-pass checks ok')
console.log(
  ranked
    .slice(0, 4)
    .map((x) => `${x.s.name}  raw ${fmt1(x.r.raw!)}  cov ${fmtPct(x.r.coverage)}  sort ${fmt1(x.r.sort!)}`)
    .join('\n'),
)
