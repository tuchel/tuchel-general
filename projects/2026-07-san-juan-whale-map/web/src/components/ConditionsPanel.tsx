import type { HydroSnapshot, TideSnapshot, WindSnapshot } from '../lib/live'

type Props = {
  tides: TideSnapshot | null
  wind: WindSnapshot | null
  hydro: HydroSnapshot | null
  tideError?: string | null
  windError?: string | null
  hydroError?: string | null
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
  tideError,
  windError,
  hydroError,
}: Props) {
  return (
    <div className="control-card conditions">
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
    </div>
  )
}
