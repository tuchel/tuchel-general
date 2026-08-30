import { useMemo, useRef, useState } from 'react'
import { SCHOOLS, HOME } from './data/schools'
import { Focus } from './components/Focus'
import { SchoolCard } from './components/SchoolCard'
import { useFlip } from './lib/flip'
import {
  activeShare,
  competitionRank,
  fmt1,
  rankSchool,
  sortValue,
  weightsMatch,
} from './lib/rank'
import {
  CORE_CRITERIA,
  CRITERION_BOUND,
  CRITERION_LABEL,
  EXTRA_CRITERIA,
  FIRST_PASS,
  TRAY_COPY,
  type CriterionId,
  type TrayId,
  type Weights,
} from './lib/types'

const TRAYS: TrayId[] = ['ranked', 'worth_the_drive', 'eligible_at_3']

export default function App() {
  const [weights, setWeights] = useState<Weights>(FIRST_PASS)
  const [rawOnly, setRawOnly] = useState(false)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [extrasOpen, setExtrasOpen] = useState(false)
  const boardRef = useRef<HTMLDivElement>(null)

  const ranked = useMemo(() => {
    return SCHOOLS.map((school) => ({ school, result: rankSchool(school, weights) }))
  }, [weights])

  const trays = useMemo(() => {
    return TRAYS.map((id) => {
      const rows = ranked
        .filter((r) => r.school.tray === id)
        .sort((a, b) => {
          const cmp =
            (sortValue(b.result, rawOnly) ?? -Infinity) - (sortValue(a.result, rawOnly) ?? -Infinity)
          if (cmp !== 0) return cmp
          return 0
        })
      const ranks = competitionRank(rows.map((r) => sortValue(r.result, rawOnly)))
      return { id, rows: rows.map((r, i) => ({ ...r, rank: ranks[i] })) }
    })
  }, [ranked, rawOnly])

  const flipToken = trays
    .map((t) => t.rows.map((r) => `${r.school.id}:${r.rank}:${fmt1(sortValue(r.result, rawOnly) ?? 0)}`).join(','))
    .join('|')
  useFlip(boardRef, flipToken)

  const firstPass = weightsMatch(weights, FIRST_PASS)
  const sumLive = CORE_CRITERIA.reduce((n, id) => n + (weights[id] > 0 ? weights[id] : 0), 0) +
    EXTRA_CRITERIA.reduce((n, id) => n + (weights[id] > 0 ? weights[id] : 0), 0)

  function setWeight(id: CriterionId, value: number) {
    setWeights((w) => ({ ...w, [id]: value }))
  }

  return (
    <div className="page">
      <header className="mast">
        <p className="kicker">
          {HOME.child} · born {HOME.born} · {HOME.ageLabel}
        </p>
        <h1>Schools for Finn</h1>
        <p className="lede">
          No all-day forest kindergarten under 20 minutes takes a 2-year-old this fall. Nature’s Way
          is the closest in-zip preserve — half-day, age 3 by 1 October. Forest days are 25–55 minutes
          out. No NAREA-listed school in Austin. The only pedagogy-100 Reggio is KLA Sweetwater, 35
          minutes away.
        </p>
      </header>

      <p className="banner" role="note">
        Drives are Google typical 8am from {HOME.address}.
      </p>

      <Focus />

      <div className="layout">
        <aside className="rail">
          <div className="rail-head">
            <h2>Weights</h2>
            <button
              type="button"
              className={firstPass ? 'preset on' : 'preset'}
              onClick={() => setWeights(FIRST_PASS)}
              disabled={firstPass}
            >
              First pass
            </button>
          </div>
          <p className="rail-note">
            0 ignores the criterion (it leaves the mix). 100 is the strongest relative weight. Live
            share is of criteria with weight above 0. Unknown scores are labeled unknown and dropped
            from the denominator; a known 0 stays in.
          </p>

          {CORE_CRITERIA.map((id) => (
            <Slider key={id} id={id} value={weights[id]} share={activeShare(weights, id)} onChange={setWeight} />
          ))}

          <button type="button" className="extras-toggle" onClick={() => setExtrasOpen((v) => !v)}>
            {extrasOpen ? 'Hide extra criteria' : 'Extra criteria at 0'}
          </button>
          {extrasOpen &&
            EXTRA_CRITERIA.map((id) => (
              <Slider key={id} id={id} value={weights[id]} share={activeShare(weights, id)} onChange={setWeight} />
            ))}

          <label className="raw-toggle">
            <input type="checkbox" checked={rawOnly} onChange={(e) => setRawOnly(e.target.checked)} />
            Sort by raw only
            <span>Default sort is raw × coverage. No hidden tie-breakers.</span>
          </label>

          {sumLive <= 0 && <p className="warn">All weights are 0. Raise at least one criterion.</p>}

          <section className="why">
            <h2>Why this first pass</h2>
            <p>
              Sunset Trail leads because outdoor and Montessori outweigh Guidepost’s 7-minute drive.
              Guidepost Montessori is unknown, not zero.
            </p>
            <p>
              Atelier Preescolar is second (57.0): Reggio-inspired, 16 minutes, pedagogy 50. CDC South
              is third (49.5): play-based, pedagogy 0.
            </p>
            <p>Butterfly is 46.5 at 14 minutes. Fiorella is 44.5: named Reggio, atelier unverified.</p>
          </section>
        </aside>

        <div className="board" ref={boardRef}>
          {trays.map((tray) => (
            <section key={tray.id} className="tray">
              <header className="tray-head">
                <p className="kicker">{TRAY_COPY[tray.id].kicker}</p>
                <h2>{TRAY_COPY[tray.id].title}</h2>
                <p>{TRAY_COPY[tray.id].rule}</p>
              </header>
              <div className="stack">
                {tray.rows.map((row) => (
                  <SchoolCard
                    key={row.school.id}
                    school={row.school}
                    rank={row.rank}
                    result={row.result}
                    weights={weights}
                    rawOnly={rawOnly}
                    open={!!open[row.school.id]}
                    onToggle={() => setOpen((o) => ({ ...o, [row.school.id]: !o[row.school.id] }))}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

function Slider({
  id,
  value,
  share,
  onChange,
}: {
  id: CriterionId
  value: number
  share: number | null
  onChange: (id: CriterionId, value: number) => void
}) {
  const shareLab = share == null ? 'ignored' : `${Math.round(share * 100)}% of mix`
  return (
    <div className="slat">
      <div className="slat-lab">
        <label htmlFor={`w-${id}`}>{CRITERION_LABEL[id]}</label>
        <span className="slat-num">
          <b>{value}</b>
          <i>{shareLab}</i>
        </span>
      </div>
      <input
        id={`w-${id}`}
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${CRITERION_LABEL[id]} ${value}, ${shareLab}. 0 ignores this criterion. 100 is the strongest relative weight.`}
        onChange={(e) => onChange(id, Number(e.target.value))}
      />
      <p className="slat-bound">
        0 ignore · {value} now · 100 strongest. {CRITERION_BOUND[id]}
      </p>
    </div>
  )
}
