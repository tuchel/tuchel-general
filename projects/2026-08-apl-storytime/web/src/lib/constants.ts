export const ICS_HTTPS =
  'https://tuchel.github.io/tuchel-general/storytime/storytime.ics'
export const WEBCAL = 'webcal://tuchel.github.io/tuchel-general/storytime/storytime.ics'
export const GOOGLE_CAL =
  'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(ICS_HTTPS)
export const STORYTIMES_INDEX = 'https://library.austintexas.gov/events/storytimes'
export const ADA_PHONE = '512-974-7400'
export const SEASON_START = '2026-09-07'
export const SEASON_END = '2026-11-21'
export const CLOSED_DAYS = new Set(['2026-09-06', '2026-09-07', '2026-11-11'])
export const TZ = 'America/Chicago'
export const AUSTIN: [number, number] = [-97.7431, 30.2672]
/** 427 Ridgewood Road, West Lake Hills. OSM building via Nominatim, 2026-08-25. */
export const HOME = { lat: 30.277964, lon: -97.7902325 }
export const HOME_NOMINATIM =
  'https://nominatim.openstreetmap.org/search?q=427+Ridgewood+Road,+West+Lake+Hills,+TX+78746&format=json'
