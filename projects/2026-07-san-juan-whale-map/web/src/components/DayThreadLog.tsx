import { useEffect, useState } from 'react'
import {
  formatSightingWhen,
  speciesLabel,
  type SocialDayThread,
  type SocialPost,
} from '../lib/social'

type Props = {
  threads: SocialDayThread[]
  onFocusPost?: (post: SocialPost) => void
}

export function DayThreadLog({ threads, onFocusPost }: Props) {
  const [activeId, setActiveId] = useState(threads[0]?.id ?? '')

  useEffect(() => {
    if (!threads.length) {
      setActiveId('')
      return
    }
    if (!threads.some((t) => t.id === activeId)) setActiveId(threads[0].id)
  }, [threads, activeId])

  if (!threads.length) {
    return <p className="meta-line">No Puget Sound Whales day threads loaded yet.</p>
  }

  const active = threads.find((t) => t.id === activeId) || threads[0]

  return (
    <div className="day-log">
      <div className="day-log-tabs" role="tablist" aria-label="Puget Sound Whales days">
        {threads.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === active.id}
            className={t.id === active.id ? 'on' : ''}
            onClick={() => setActiveId(t.id)}
          >
            {t.dateLabel.replace(/^[A-Za-z]+,?\s*/, '')}
            <em>{t.updateCount}</em>
          </button>
        ))}
      </div>

      <article className="day-log-panel">
        <header className="day-log-head">
          <div>
            <p className="day-log-kicker">{active.displayName}</p>
            <h4>{active.dateLabel}</h4>
          </div>
          <a href={active.url} target="_blank" rel="noreferrer">
            Open thread
          </a>
        </header>
        <p className="day-log-summary">{active.summary}</p>
        <p className="meta-line">
          {active.updateCount} updates · {active.mappedCount} place-tagged
        </p>

        {active.updates.length === 0 ? (
          <p className="meta-line">No timed updates under this day root yet.</p>
        ) : (
          <ol className="day-log-updates">
            {active.updates.map((u) => {
              const when = formatSightingWhen(u.createdAt)
              const mappable = u.lat != null && u.lon != null
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    className={`day-log-update ${mappable ? 'has-pin' : ''}`}
                    onClick={() => {
                      if (mappable) onFocusPost?.(u)
                    }}
                    disabled={!mappable}
                  >
                    <div className="day-log-update-top">
                      <strong>
                        {u.place || 'Unplaced'}
                        {u.species !== 'unknown' ? ` · ${speciesLabel(u.species)}` : ''}
                      </strong>
                      <span>{when.absolute}</span>
                    </div>
                    {u.direction && <span className="day-log-dir">{u.direction}</span>}
                    <span className="day-log-text">{u.text.slice(0, 180)}</span>
                    {mappable ? (
                      <span className="day-log-fly">Show on map</span>
                    ) : (
                      <span className="day-log-fly muted">No place match</span>
                    )}
                  </button>
                  <a className="day-log-open" href={u.url} target="_blank" rel="noreferrer">
                    Bluesky
                  </a>
                </li>
              )
            })}
          </ol>
        )}
      </article>
    </div>
  )
}
