import type { HydroSnapshot, TideSnapshot, WindSnapshot } from '../lib/live'
import type { SocialPost, SocialSnapshot } from '../lib/social'
import { DayThreadLog } from './DayThreadLog'

type Props = {
  tides: TideSnapshot | null
  wind: WindSnapshot | null
  hydro: HydroSnapshot | null
  social: SocialSnapshot | null
  tideError?: string | null
  windError?: string | null
  hydroError?: string | null
  socialError?: string | null
  onFocusSocial?: (post: SocialPost) => void
}

function fmtTide(t: string) {
  try {
    return new Date(t.replace(' ', 'T')).toLocaleString(undefined, {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return t
  }
}

export function ConditionsPanel({
  tides,
  wind,
  hydro,
  social,
  tideError,
  windError,
  hydroError,
  socialError,
  onFocusSocial,
}: Props) {
  const socialPreview = (social?.posts || [])
    .filter((p) => p.role !== 'day_root')
    .slice(0, 8)
  const dayThreads = social?.dayThreads || []
  return (
    <div className="conditions">
      <h2>Live conditions</h2>

      <section>
        <h3>Tide · Friday Harbor</h3>
        {tideError && <p className="err">{tideError}</p>}
        {tides ? (
          <>
            <p className={`stage ${tides.stage}`}>
              <strong>{tides.stage === 'rising' ? 'Flood / rising' : tides.stage === 'falling' ? 'Ebb / falling' : 'Stage unknown'}</strong>
              {tides.next && (
                <span>
                  Next {tides.next.type === 'H' ? 'high' : 'low'} {fmtTide(tides.next.time)} ·{' '}
                  {tides.next.heightFt.toFixed(1)} ft MLLW
                </span>
              )}
            </p>
            <p className="meta-line">{tides.stageNote}</p>
            <ul className="tide-list">
              {tides.events.slice(0, 6).map((e) => (
                <li key={e.time + e.type}>
                  <span>{e.type === 'H' ? 'High' : 'Low'}</span>
                  <span>{fmtTide(e.time)}</span>
                  <span>{e.heightFt.toFixed(1)} ft</span>
                </li>
              ))}
            </ul>
            <a href={tides.sourceUrl} target="_blank" rel="noreferrer">
              NOAA CO-OPS station 9449880
            </a>
          </>
        ) : (
          !tideError && <p className="meta-line">Loading tides…</p>
        )}
      </section>

      <section>
        <h3>Wind / sea · mid-Haro</h3>
        {windError && <p className="err">{windError}</p>}
        {wind?.now ? (
          <>
            <p className={`gate gate-${wind.gate}`}>
              <strong>
                {wind.gate === 'go' ? 'Go' : wind.gate === 'caution' ? 'Caution' : 'No-go'}
              </strong>
              <span>
                {wind.now.windKn.toFixed(0)} kt sustained · gusts {wind.now.gustKn.toFixed(0)} kt ·
                next-6h max gust {wind.next6MaxGust.toFixed(0)} kt
                {wind.waveM != null ? ` · waves ~${(wind.waveM * 3.281).toFixed(1)} ft` : ''}
              </span>
            </p>
            <p className="meta-line">{wind.gateNote}</p>
            <p className="bound-note">
              Gate bounds: caution ≥12 kt / 18 kt gust · no-go ≥20 kt / 25 kt gust (Open-Meteo
              10 m wind at 48.52°N, 123.18°W).
            </p>
          </>
        ) : (
          !windError && <p className="meta-line">Loading wind…</p>
        )}
      </section>

      <section>
        <h3>Hydrophones · OrcaSound</h3>
        {hydroError && <p className="err">{hydroError}</p>}
        {hydro ? (
          <>
            <ul className="hydro-list">
              {hydro.feeds.map((f) => (
                <li key={f.id} className={`pulse-${f.pulse}`}>
                  <div>
                    <strong>{f.name}</strong>
                    <span>
                      {f.pulse === 'hot'
                        ? 'Calls in last ~2h'
                        : f.pulse === 'recent'
                          ? 'Activity in last ~12h'
                          : 'Quiet (no recent whale-category detections)'}
                    </span>
                  </div>
                  <a href={f.listenUrl} target="_blank" rel="noreferrer">
                    Listen
                  </a>
                </li>
              ))}
            </ul>
            <p className="meta-line">{hydro.regionalNote}</p>
          </>
        ) : (
          !hydroError && <p className="meta-line">Loading hydrophones…</p>
        )}
      </section>

      <section>
        <h3>Puget Sound Whales · day log</h3>
        {socialError && <p className="err">{socialError}</p>}
        {social ? (
          <>
            <p className="meta-line">
              Daily threads from{' '}
              <a
                href="https://bsky.app/profile/pugetsoundwhales.bsky.social"
                target="_blank"
                rel="noreferrer"
              >
                @pugetsoundwhales
              </a>
              — timed updates under each day root. Tap a place-tagged update to fly the map.
            </p>
            <DayThreadLog threads={dayThreads} onFocusPost={onFocusSocial} />
          </>
        ) : (
          !socialError && <p className="meta-line">Loading day threads…</p>
        )}
      </section>

      <section>
        <h3>Social · Bluesky</h3>
        {social ? (
          <>
            <p className="meta-line">
              {social.mapped.length} place-tagged pins · {social.posts.length} recent posts ·{' '}
              {dayThreads.length} day threads · {social.sourceNote}
            </p>
            <ul className="social-list">
              {socialPreview.map((p) => (
                <li key={p.id}>
                  <div>
                    <strong>{p.displayName || p.handle}</strong>
                    <span>
                      {p.dayLabel ? `${p.dayLabel} · ` : ''}
                      {p.place ? `${p.place} · ` : ''}
                      {p.species !== 'unknown' ? p.species.replace('_', ' ') : 'cetacean?'}
                      {p.createdAt
                        ? ` · ${new Date(p.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}`
                        : ''}
                    </span>
                    <span className="social-text">{p.text.slice(0, 160)}</span>
                  </div>
                  <a href={p.url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </li>
              ))}
            </ul>
            <p className="meta-line">
              Coords are place-name matches (approx), not GPS. Public replies on day threads are
              omitted — author updates only.
            </p>
          </>
        ) : (
          !socialError && <p className="meta-line">Loading social feeds…</p>
        )}
      </section>
    </div>
  )
}
