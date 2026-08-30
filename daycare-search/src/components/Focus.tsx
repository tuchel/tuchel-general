import { FOCUS_AS_OF, FOCUS_COMPARE_ROWS, FOCUS_SCHOOLS, type FocusSchool } from '../data/focus'
import { SCHOOLS } from '../data/schools'
import { fmt1, fmtPct, rankSchool } from '../lib/rank'
import {
  CORE_CRITERIA,
  CRITERION_LABEL,
  FIRST_PASS,
  type CriterionId,
  type School,
  type Score,
} from '../lib/types'
import { Profile } from './Profile'

function photoSrc(file: string): string {
  return `${import.meta.env.BASE_URL}focus/${file}`
}

const NONE: Record<CriterionId, Score> = {
  outdoor: null,
  montessori: null,
  age_fit: null,
  distance: null,
  nature: null,
  logistics: null,
  continuity: null,
  cost: null,
  staff: null,
  availability: null,
}

function asSchool(f: FocusSchool): School {
  const existing = f.rankedId ? SCHOOLS.find((s) => s.id === f.rankedId) : undefined
  if (existing) return existing
  return {
    id: f.id,
    name: f.name,
    bluntClass: f.blunt,
    tray: 'ranked',
    scores: { ...NONE, ...f.scores },
    scoreSource: 'published',
    driveMinutesTypical: null,
    driveRange: null,
    straddle: false,
    address: f.address,
    url: f.url,
    flags: [],
    notes: [],
    missingUnverified: f.missing,
  }
}

export function Focus() {
  return (
    <section className="focus" id="focus" aria-labelledby="focus-title">
      <header className="focus-mast">
        <p className="kicker">Focus · household shortlist · {FOCUS_AS_OF}</p>
        <h2 id="focus-title">Three finalists</h2>
        <p className="focus-lede">
          Sunset Trail, Mariposa, and Primrose West Lake Hills — compared in depth. This is a
          household pick, not first-pass sort order. Sunset Trail is ranked-v2 #1 (59.5). Mariposa
          ties at 39.0. Primrose is not in the ranked-v2 trays; it is here because it is in-zip and
          full-day. Unknown stays unknown. No waitlists invented.
        </p>
      </header>

      <div className="focus-table-wrap">
        <table className="focus-cmp">
          <caption>
            Side-by-side facts. Hover a cell for the full line. Sources sit on each card below.
          </caption>
          <thead>
            <tr>
              <th scope="col">Compared</th>
              {FOCUS_SCHOOLS.map((s) => (
                <th key={s.id} scope="col">
                  <a href={s.url} target="_blank" rel="noreferrer">
                    {s.name}
                  </a>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FOCUS_COMPARE_ROWS.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.label}</th>
                {FOCUS_SCHOOLS.map((s) => {
                  const text = row.pick(s)
                  return (
                    <td key={s.id}>
                      <span className="tip">
                        <span className="tip-short">{text}</span>
                        <span className="tip-pop" role="tooltip">
                          <b>
                            {s.name} · {row.label}
                          </b>
                          <span>{text}</span>
                          <i>Full notes and sources on the card below.</i>
                        </span>
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
            <tr>
              <th scope="row">First-pass sort</th>
              {FOCUS_SCHOOLS.map((s) => {
                const r = rankSchool(asSchool(s), FIRST_PASS)
                const inRanked = s.rankedId != null
                return (
                  <td key={s.id}>
                    {r.sort == null ? (
                      'unknown'
                    ) : (
                      <>
                        <b className="num">{fmt1(r.sort)}</b>
                        <span className="quiet">
                          {' '}
                          raw {fmt1(r.raw!)} · {fmtPct(r.coverage)} coverage
                          {inRanked ? '' : ' · not in a tray'}
                        </span>
                      </>
                    )}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="focus-grid">
        {FOCUS_SCHOOLS.map((s) => (
          <FocusCard key={s.id} school={s} />
        ))}
      </div>

      <p className="focus-src">
        Photos from official school sites ({FOCUS_AS_OF}). Drive trail:{' '}
        <code>scripts/drive-osrm.mjs</code> (uncongested, not typical 8am). GreatSchools, Niche,
        Yelp, Listen360, and CourtListener are named where used. Tuition numbers only where the
        school published a table.
      </p>
    </section>
  )
}

function FocusCard({ school }: { school: FocusSchool }) {
  const record = asSchool(school)
  const result = rankSchool(record, FIRST_PASS)

  return (
    <article className="focus-card" id={`focus-${school.id}`}>
      <div className="focus-photos">
        {school.photos.map((p, i) => (
          <figure key={p.file} className={i === 0 ? 'hero' : 'extra'}>
            <img src={photoSrc(p.file)} alt={p.alt} width={1400} height={800} />
            <figcaption>{p.credit}</figcaption>
          </figure>
        ))}
      </div>

      <header className="focus-card-head">
        <p className="kicker">{school.blunt}</p>
        <h3>
          <a href={school.url} target="_blank" rel="noreferrer">
            {school.name}
          </a>
        </h3>
        <p className="where">
          {school.address} ·{' '}
          <a href={school.url} target="_blank" rel="noreferrer">
            Visit site
          </a>
        </p>
      </header>

      <div className="focus-scoreline">
        <Profile school={record} weights={FIRST_PASS} />
        <p>
          {result.sort == null ? (
            'sort unknown'
          ) : (
            <>
              <b>{fmt1(result.sort)}</b> first-pass sort · {fmtPct(result.coverage)} coverage
            </>
          )}
        </p>
      </div>

      <table className="mix focus-mix">
        <thead>
          <tr>
            <th>criterion</th>
            <th>score</th>
          </tr>
        </thead>
        <tbody>
          {CORE_CRITERIA.map((id) => (
            <tr key={id} className={school.scores[id] == null ? 'dropped' : undefined}>
              <td>{CRITERION_LABEL[id]}</td>
              <td>{school.scores[id] == null ? 'unknown' : Math.round(school.scores[id] as number)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>Why Finn</h4>
      <ul>
        {school.whyFinn.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>

      <h4>Possible downsides</h4>
      <ul>
        {school.downsides.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>

      <h4>Reviews</h4>
      <ul className="focus-reviews">
        {school.reviews.map((r) => (
          <li key={r.sourceUrl}>
            <p>{r.summary}</p>
            <a href={r.sourceUrl} target="_blank" rel="noreferrer">
              {r.sourceLabel}
            </a>
          </li>
        ))}
      </ul>

      {school.missing.length > 0 && (
        <p className="missing">
          <span>Missing / unverified.</span> {school.missing.join(' · ')}
        </p>
      )}
    </article>
  )
}
