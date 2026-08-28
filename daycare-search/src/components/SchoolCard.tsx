import { type MouseEvent } from 'react'
import { CORE_CRITERIA, CRITERION_LABEL, EXTRA_CRITERIA, type School, type Weights } from '../lib/types'
import { fmt1, fmtMinutes, fmtPct, fmtScore, type RankResult } from '../lib/rank'
import { Profile } from './Profile'

function displayHost(url: string): string {
  return url.replace(/^https:\/\//, '').replace(/\/$/, '')
}

export function SchoolCard({
  school,
  rank,
  result,
  weights,
  rawOnly,
  open,
  onToggle,
}: {
  school: School
  rank: number
  result: RankResult
  weights: Weights
  rawOnly: boolean
  open: boolean
  onToggle: () => void
}) {
  const minutes = fmtMinutes(school.driveMinutesTypical)
  const sortShown = rawOnly ? result.raw : result.sort
  const shown = [
    ...CORE_CRITERIA,
    ...EXTRA_CRITERIA.filter((id) => weights[id] > 0),
  ]

  function onHeadClick(e: MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('a, button')) return
    onToggle()
  }

  return (
    <article className="card" data-flip={school.id} data-open={open ? '1' : '0'}>
      <div className="card-head" onClick={onHeadClick}>
        <span className="rank">{rank}</span>
        <span className="head-main">
          <span className="name-row">
            <a className="name" href={school.url} target="_blank" rel="noreferrer">
              {school.name}
            </a>
            <a className="visit" href={school.url} target="_blank" rel="noreferrer">
              Visit site
            </a>
            {school.straddle && <span className="flag">range can hit 20</span>}
          </span>
          <span className="class-row">
            <span className="blunt">{school.bluntClass}</span>
            {minutes ? (
              <span className="drive">
                {minutes} <span className="drive-lab">typical 8am</span>
              </span>
            ) : (
              <span className="drive unk">drive untimed</span>
            )}
          </span>
        </span>
        <Profile school={school} weights={weights} />
        <button
          type="button"
          className="metrics"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`${open ? 'Hide' : 'Show'} scores for ${school.name}`}
        >
          <span>
            <b>{result.raw == null ? 'unknown' : fmt1(result.raw)}</b>
            <i>raw</i>
          </span>
          <span>
            <b>{fmtPct(result.coverage)}</b>
            <i>coverage</i>
          </span>
          <span className="sort">
            <b>{sortShown == null ? 'unknown' : fmt1(sortShown)}</b>
            <i>{rawOnly ? 'raw only' : 'sort'}</i>
          </span>
        </button>
      </div>

      {open && (
        <div className="card-body">
          <p className="where">
            {school.address || 'Address thin in ranked-v1.'} ·{' '}
            <a href={school.url} target="_blank" rel="noreferrer">
              {displayHost(school.url)}
            </a>
          </p>
          {school.flags.length > 0 && (
            <p className="flag-line">{school.flags.join(' · ')}</p>
          )}
          {school.driveRange && (
            <p className="range-line">
              Range {school.driveRange[0]}–{school.driveRange[1]} min. Straddle is a flag, not a fail.
            </p>
          )}
          {school.scoreSource === 'fitted-aggregate' && (
            <p className="fitted">
              Per-criterion scores were fitted to the ranked-v1 aggregate. Treat slider re-ranks as approximate.
            </p>
          )}

          <table className="mix">
            <thead>
              <tr>
                <th>criterion</th>
                <th>score</th>
                <th>weight</th>
                <th>contribution</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((id) => {
                const score = school.scores[id]
                const w = weights[id]
                const inA = w > 0
                const inW = inA && score != null
                return (
                  <tr key={id} className={inW ? undefined : inA ? 'dropped' : 'idle'}>
                    <td>{CRITERION_LABEL[id]}</td>
                    <td>{fmtScore(score)}</td>
                    <td>{inA ? w : `${w} off`}</td>
                    <td>
                      {!inA
                        ? '—'
                        : score == null
                          ? 'unknown · dropped'
                          : result.contributions[id] == null
                            ? '—'
                            : fmt1(result.contributions[id]!)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {school.notes.length > 0 && (
            <ul className="notes">
              {school.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          {school.missingUnverified.length > 0 && (
            <p className="missing">
              <span>Missing / unverified.</span> {school.missingUnverified.join(' · ')}
            </p>
          )}
        </div>
      )}
    </article>
  )
}
