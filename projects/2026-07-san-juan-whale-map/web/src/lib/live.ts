/** Client-side live pulls (tides, wind, hydrophones). No API keys. */

export type TideEvent = {
  time: string
  heightFt: number
  type: 'H' | 'L'
}

export type TideSnapshot = {
  station: string
  stationName: string
  events: TideEvent[]
  next: TideEvent | null
  stage: 'rising' | 'falling' | 'unknown'
  stageNote: string
  fetchedAt: string
  sourceUrl: string
}

export type WindHour = {
  time: string
  windKn: number
  gustKn: number
  dirDeg: number
}

export type WindSnapshot = {
  lat: number
  lon: number
  hours: WindHour[]
  now: WindHour | null
  next6MaxGust: number
  gate: 'go' | 'caution' | 'no-go'
  gateNote: string
  waveM: number | null
  fetchedAt: string
}

export type HydroFeed = {
  id: string
  name: string
  slug: string
  lat: number
  lon: number
  listenUrl: string
  lastDetectionAt: string | null
  detectionCount24h: number
  pulse: 'quiet' | 'recent' | 'hot'
}

export type HydroSnapshot = {
  feeds: HydroFeed[]
  fetchedAt: string
  regionalNote: string
}

const SJ_HYDRO_SLUGS = new Set(['orcasound-lab', 'north-sjc'])

export async function fetchTides(): Promise<TideSnapshot> {
  const url =
    'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?' +
    new URLSearchParams({
      station: '9449880',
      product: 'predictions',
      datum: 'MLLW',
      date: 'today',
      range: '48',
      time_zone: 'lst_ldt',
      units: 'english',
      interval: 'hilo',
      format: 'json',
      application: 'tuchel-whale-map',
    }).toString()

  const res = await fetch(url)
  if (!res.ok) throw new Error(`tides ${res.status}`)
  const data = (await res.json()) as {
    predictions?: { t: string; v: string; type: string }[]
  }
  const events: TideEvent[] = (data.predictions || []).map((p) => ({
    time: p.t,
    heightFt: Number(p.v),
    type: p.type === 'H' ? 'H' : 'L',
  }))

  const now = Date.now()
  const next = events.find((e) => parseLocalTide(e.time) > now) || null
  const prev =
    [...events].reverse().find((e) => parseLocalTide(e.time) <= now) || null

  let stage: TideSnapshot['stage'] = 'unknown'
  if (prev && next) {
    stage = next.type === 'H' ? 'rising' : 'falling'
  } else if (next) {
    stage = next.type === 'H' ? 'rising' : 'falling'
  }

  const stageNote =
    stage === 'rising'
      ? 'Flooding toward high — folk pattern: west-side travel often northbound on flood (unverified; note what you see).'
      : stage === 'falling'
        ? 'Ebbing toward low — folk pattern: west-side travel often southbound on ebb (unverified; note what you see).'
        : 'Tide stage unclear from the prediction table.'

  return {
    station: '9449880',
    stationName: 'Friday Harbor, WA',
    events,
    next,
    stage,
    stageNote,
    fetchedAt: new Date().toISOString(),
    sourceUrl: 'https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=9449880',
  }
}

function parseLocalTide(t: string): number {
  // "2026-07-31 04:02" America/Los_Angeles wall time — Date parses as local in browser
  return new Date(t.replace(' ', 'T')).getTime()
}

export async function fetchWind(): Promise<WindSnapshot> {
  const lat = 48.52
  const lon = -123.18
  const windUrl =
    'https://api.open-meteo.com/v1/forecast?' +
    new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      hourly: 'wind_speed_10m,wind_gusts_10m,wind_direction_10m',
      wind_speed_unit: 'kn',
      timezone: 'America/Los_Angeles',
      forecast_days: '2',
    }).toString()

  const marineUrl =
    'https://marine-api.open-meteo.com/v1/marine?' +
    new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      hourly: 'wave_height,wind_wave_height',
      timezone: 'America/Los_Angeles',
      forecast_days: '2',
      cell_selection: 'sea',
    }).toString()

  const [windRes, marineRes] = await Promise.all([fetch(windUrl), fetch(marineUrl)])
  if (!windRes.ok) throw new Error(`wind ${windRes.status}`)
  const wind = (await windRes.json()) as {
    hourly: {
      time: string[]
      wind_speed_10m: number[]
      wind_gusts_10m: number[]
      wind_direction_10m: number[]
    }
  }
  let waveM: number | null = null
  if (marineRes.ok) {
    const marine = (await marineRes.json()) as {
      hourly?: { wave_height?: (number | null)[]; time?: string[] }
    }
    const idx = nearestHourIndex(marine.hourly?.time || [])
    const wh = marine.hourly?.wave_height?.[idx]
    if (typeof wh === 'number') waveM = wh
  }

  const hours: WindHour[] = wind.hourly.time.map((time, i) => ({
    time,
    windKn: wind.hourly.wind_speed_10m[i] ?? 0,
    gustKn: wind.hourly.wind_gusts_10m[i] ?? 0,
    dirDeg: wind.hourly.wind_direction_10m[i] ?? 0,
  }))
  const idx = nearestHourIndex(wind.hourly.time)
  const now = hours[idx] || null
  const next6 = hours.slice(idx, idx + 6)
  const next6MaxGust = Math.max(0, ...next6.map((h) => h.gustKn))

  let gate: WindSnapshot['gate'] = 'go'
  let gateNote = 'Small-boat friendly wind for open Haro — still watch ferry wash and tide rips.'
  const gust = now?.gustKn ?? 0
  const sustained = now?.windKn ?? 0
  if (sustained >= 20 || gust >= 25 || next6MaxGust >= 25) {
    gate = 'no-go'
    gateNote =
      'Haro kicks up fast above ~20 kt sustained / 25 kt gusts. Favor a lee shore or postpone — whales wait.'
  } else if (sustained >= 12 || gust >= 18 || next6MaxGust >= 18) {
    gate = 'caution'
    gateNote =
      'Breezy for a rental. Shorten the west-side loop; keep fuel reserve and a bailout toward Snug / Roche.'
  }

  return {
    lat,
    lon,
    hours,
    now,
    next6MaxGust,
    gate,
    gateNote,
    waveM,
    fetchedAt: new Date().toISOString(),
  }
}

function nearestHourIndex(times: string[]): number {
  if (!times.length) return 0
  const now = Date.now()
  let best = 0
  let bestDiff = Infinity
  times.forEach((t, i) => {
    const d = Math.abs(new Date(t).getTime() - now)
    if (d < bestDiff) {
      bestDiff = d
      best = i
    }
  })
  return best
}

async function fetchJsonApi(paths: string[]) {
  let lastErr: Error | null = null
  for (const url of paths) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/vnd.api+json' } })
      if (!res.ok) {
        lastErr = new Error(`${url} → ${res.status}`)
        continue
      }
      return res.json()
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw lastErr || new Error('OrcaSound API unavailable')
}

export async function fetchHydrophones(): Promise<HydroSnapshot> {
  // live.orcasound.net/api occasionally 500s; beta is the same JSON:API surface.
  const feedsJson = (await fetchJsonApi([
    'https://live.orcasound.net/api/json/feeds',
    'https://beta.orcasound.net/api/json/feeds',
  ])) as {
    data: {
      id: string
      attributes: {
        name: string
        slug: string
        visible: boolean
        location_point?: { coordinates: [number, number] }
      }
    }[]
  }

  let detJson: {
    data: {
      attributes: { timestamp: string; category: string }
      relationships: { feed: { data: { id: string } } }
    }[]
  } = { data: [] }
  try {
    detJson = (await fetchJsonApi([
      'https://live.orcasound.net/api/json/detections?include=feed&page[size]=40',
      'https://beta.orcasound.net/api/json/detections?include=feed&page[size]=40',
    ])) as typeof detJson
  } catch {
    detJson = { data: [] }
  }

  const now = Date.now()
  const day = 24 * 3600 * 1000
  const byFeed: Record<string, string[]> = {}
  for (const d of detJson.data || []) {
    if (d.attributes.category && d.attributes.category !== 'whale') continue
    const fid = d.relationships?.feed?.data?.id
    if (!fid) continue
    ;(byFeed[fid] ||= []).push(d.attributes.timestamp)
  }

  const feeds: HydroFeed[] = feedsJson.data
    .filter((f) => f.attributes.visible && SJ_HYDRO_SLUGS.has(f.attributes.slug))
    .map((f) => {
      const coords = f.attributes.location_point?.coordinates
      const times = (byFeed[f.id] || [])
        .map((t) => new Date(t).getTime())
        .filter((t) => now - t < day)
        .sort((a, b) => b - a)
      const last = times[0] ? new Date(times[0]).toISOString() : null
      const ageH = last ? (now - new Date(last).getTime()) / 3600000 : Infinity
      const pulse: HydroFeed['pulse'] =
        ageH <= 2 ? 'hot' : ageH <= 12 ? 'recent' : 'quiet'
      return {
        id: f.id,
        name: f.attributes.name,
        slug: f.attributes.slug,
        lat: coords?.[1] ?? 0,
        lon: coords?.[0] ?? 0,
        listenUrl: `https://live.orcasound.net/listen/${f.attributes.slug}`,
        lastDetectionAt: last,
        detectionCount24h: times.length,
        pulse,
      }
    })

  // Also surface regional OrcaHello activity (often Port Townsend / Bush Point)
  let regionalNote = 'No recent machine detections on San Juan hydrophones in the last pull.'
  const hot = feeds.filter((f) => f.pulse !== 'quiet')
  if (hot.length) {
    regionalNote = hot
      .map(
        (f) =>
          `${f.name}: ${f.detectionCount24h} whale-category detection(s) in 24h` +
          (f.lastDetectionAt
            ? ` · last ${new Date(f.lastDetectionAt).toLocaleString()}`
            : ''),
      )
      .join(' · ')
  } else {
    const regional = Object.entries(byFeed).length
    if (regional) {
      regionalNote = `San Juan nodes quiet; ${Object.values(byFeed).flat().length} whale-category detections elsewhere in the Salish feed (often Port Townsend / Bush Point).`
    }
  }

  return { feeds, fetchedAt: new Date().toISOString(), regionalNote }
}

export function downloadHotspotsGpx(hotspots: { name: string; lat: number; lon: number; tip?: string }[], launches: { name: string; lat: number; lon: number; note?: string }[]) {
  const now = new Date().toISOString()
  const wps = [
    ...hotspots.map(
      (h, i) => `  <wpt lat="${h.lat}" lon="${h.lon}">
    <name>${escapeXml(h.name)}</name>
    <desc>${escapeXml(h.tip || 'Whale corridor — do not chase; Be Whale Wise 200 yd')}</desc>
    <type>corridor</type>
    <cmt>san-juan-whale-odds-${i}</cmt>
  </wpt>`,
    ),
    ...launches.map(
      (l, i) => `  <wpt lat="${l.lat}" lon="${l.lon}">
    <name>${escapeXml(l.name)}</name>
    <desc>${escapeXml(l.note || 'Launch')}</desc>
    <type>launch</type>
    <cmt>launch-${i}</cmt>
  </wpt>`,
    ),
  ].join('\n')

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="San Juan Whale Odds" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>San Juan Whale Odds — corridors &amp; launches</name>
    <time>${now}</time>
    <desc>Named whale corridors and launch points. Stay ≥200 yards from killer whales. Do not pursue.</desc>
  </metadata>
${wps}
</gpx>
`
  const blob = new Blob([gpx], { type: 'application/gpx+xml' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'san-juan-whale-odds.gpx'
  a.click()
  URL.revokeObjectURL(a.href)
}

function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
