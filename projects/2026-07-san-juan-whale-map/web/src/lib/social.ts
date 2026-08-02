/** Bluesky Salish Sea whale posts — public AppView, no API key. */

export type SocialPost = {
  id: string
  platform: 'bluesky'
  handle: string
  displayName: string
  text: string
  createdAt: string
  url: string
  species: string
  place: string | null
  lat: number | null
  lon: number | null
  geocodePrecision: 'place_name' | 'none'
  sightingHint: boolean
}

export type SocialSnapshot = {
  posts: SocialPost[]
  mapped: SocialPost[]
  fetchedAt: string
  sourceNote: string
}

const BSKY = 'https://public.api.bsky.app/xrpc'

const HANDLES = [
  'pugetsoundwhales.bsky.social',
  'wscrqb.bsky.social',
  'orcanetwork.bsky.social',
  'orcabehaviorinstitute.org',
  'pacificwhalewatchassociation.com',
  'thewhalemuseum.bsky.social',
  'whaleresearch.bsky.social',
  'orcasound.bsky.social',
  'sanjuanorcas.bsky.social',
  'acs-ps.bsky.social',
  'whale-alert.io',
  'ourwildpugetsound.com',
  'orcavision.org',
]

const PLACES: [string, number, number, string][] = [
  ['lime kiln', 48.5158, -123.1526, 'Lime Kiln'],
  ['cattle pass', 48.4505, -122.9635, 'Cattle Pass'],
  ['hein bank', 48.366, -123.04, 'Hein Bank'],
  ['salmon bank', 48.43, -122.99, 'Salmon Bank'],
  ['false bay', 48.48, -123.07, 'False Bay'],
  ['mitchell bay', 48.575, -123.17, 'Mitchell Bay'],
  ['president channel', 48.65, -123.05, 'President Channel'],
  ['san juan channel', 48.55, -123.0, 'San Juan Channel'],
  ['haro strait', 48.55, -123.22, 'Haro Strait'],
  ['rosario strait', 48.55, -122.75, 'Rosario Strait'],
  ['active pass', 48.87, -123.3, 'Active Pass'],
  ['boundary pass', 48.73, -123.15, 'Boundary Pass'],
  ['friday harbor', 48.537, -123.016, 'Friday Harbor'],
  ['roche harbor', 48.61, -123.16, 'Roche Harbor'],
  ['eagle cove', 48.46, -123.03, 'Eagle Cove'],
  ['american camp', 48.464, -123.0, 'American Camp'],
  ['point robinson', 47.388, -122.374, 'Point Robinson'],
  ['commencement bay', 47.28, -122.42, 'Commencement Bay'],
  ['admiralty inlet', 48.1, -122.7, 'Admiralty Inlet'],
  ['hat island', 48.02, -122.3, 'Hat Island'],
  ['whidbey', 48.2, -122.6, 'Whidbey Island'],
  ['orcas island', 48.65, -122.95, 'Orcas Island'],
  ['orca island', 48.65, -122.95, 'Orcas Island'],
  ['lopez island', 48.48, -122.89, 'Lopez Island'],
  ['stuart island', 48.68, -123.2, 'Stuart Island'],
  ['turn point', 48.69, -123.24, 'Turn Point'],
  ['victoria', 48.42, -123.37, 'Victoria'],
  ['juan de fuca', 48.3, -123.6, 'Strait of Juan de Fuca'],
  ['puget sound', 47.7, -122.4, 'Puget Sound'],
  ['salish sea', 48.5, -123.1, 'Salish Sea'],
  ['san juan', 48.54, -123.1, 'San Juan Island'],
  ['anacortes', 48.51, -122.61, 'Anacortes'],
  ['port townsend', 48.12, -122.76, 'Port Townsend'],
  ['campbell river', 50.02, -125.25, 'Campbell River'],
  ['qualicum', 49.35, -124.45, 'Qualicum'],
]

const CETACEAN_RE =
  /\b(orca|orcas|killer\s*whale|srkw|bigg'?s|transient|resident|humpback|gray\s*whale|grey\s*whale|minke|porpoise|cetacean|whale|whales|j\s*pod|k\s*pod|l\s*pod)\b/i

const SIGHTING_HINT_RE =
  /\b(reported|sighting|spotted|seen|northbound|southbound|eastbound|westbound|foraging|milling|breaching|spyhop|vocaliz|calls?\b|blow|fluke)\b/i

const BBOX = { south: 47.0, north: 50.3, west: -125.5, east: -122.0 }

function detectSpecies(text: string): string {
  const t = text.toLowerCase()
  if (/\b(srkw|southern\s*resident|j\s*pod|k\s*pod|l\s*pod)\b/.test(t)) return 'srkw'
  if (/\b(bigg|transient|t[- ]?\d)\b/.test(t)) return 'biggs'
  if (t.includes('humpback') || t.includes('humpy')) return 'humpback'
  if (/\bgr[ae]y\s*whale/.test(t) || /\bgrays?\b/.test(t)) return 'gray'
  if (t.includes('minke')) return 'minke'
  if (t.includes('porpoise')) return 'porpoise'
  if (/\b(orca|killer\s*whale)\b/.test(t)) return 'orca_unspecified'
  if (/\bwhales?\b/.test(t)) return 'other_cetacean'
  return 'unknown'
}

function geocode(text: string): { lat: number; lon: number; place: string } | null {
  const low = text.toLowerCase()
  for (const [needle, lat, lon, place] of PLACES) {
    if (low.includes(needle)) return { lat, lon, place }
  }
  return null
}

function postUrl(handle: string, uri: string) {
  const rkey = uri.split('/').pop() || ''
  return `https://bsky.app/profile/${handle}/post/${rkey}`
}

function relevant(text: string, handle: string) {
  if (handle === 'pugetsoundwhales.bsky.social' || handle === 'wscrqb.bsky.social') {
    return text.trim().length > 0
  }
  return CETACEAN_RE.test(text)
}

async function pullHandle(handle: string, limit = 40): Promise<SocialPost[]> {
  const url = `${BSKY}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${handle} → ${res.status}`)
  const data = (await res.json()) as {
    feed?: {
      post: {
        uri: string
        indexedAt?: string
        author: { handle: string; displayName?: string }
        record: { $type?: string; text?: string; createdAt?: string }
      }
    }[]
  }
  const out: SocialPost[] = []
  for (const item of data.feed || []) {
    const post = item.post
    const record = post.record || {}
    if (record.$type && record.$type !== 'app.bsky.feed.post') continue
    const text = record.text || ''
    if (!text || !relevant(text, handle)) continue
    const h = post.author?.handle || handle
    const geo = geocode(text)
    out.push({
      id: post.uri || `${h}:${record.createdAt}`,
      platform: 'bluesky',
      handle: h,
      displayName: post.author?.displayName || h,
      text: text.replace(/https?:\/\/\S+/g, '').trim().slice(0, 400),
      createdAt: record.createdAt || post.indexedAt || '',
      url: post.uri ? postUrl(h, post.uri) : `https://bsky.app/profile/${h}`,
      species: detectSpecies(text),
      place: geo?.place ?? null,
      lat: geo?.lat ?? null,
      lon: geo?.lon ?? null,
      geocodePrecision: geo ? 'place_name' : 'none',
      sightingHint: SIGHTING_HINT_RE.test(text),
    })
  }
  return out
}

export async function fetchSocialPosts(): Promise<SocialSnapshot> {
  const chunks = await Promise.all(
    HANDLES.map(async (h) => {
      try {
        return await pullHandle(h)
      } catch {
        return [] as SocialPost[]
      }
    }),
  )
  const byId = new Map<string, SocialPost>()
  for (const p of chunks.flat()) byId.set(p.id, p)
  const posts = [...byId.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  const mapped = posts.filter(
    (p) =>
      p.lat != null &&
      p.lon != null &&
      p.lat >= BBOX.south &&
      p.lat <= BBOX.north &&
      p.lon >= BBOX.west &&
      p.lon <= BBOX.east,
  )
  return {
    posts: posts.slice(0, 200),
    mapped,
    fetchedAt: new Date().toISOString(),
    sourceNote:
      'Bluesky public feeds · place-name geocode (approx) · X/Reddit unavailable without credentials',
  }
}

export function socialToGeoJSON(posts: SocialPost[]) {
  return {
    type: 'FeatureCollection' as const,
    features: posts
      .filter((p) => p.lat != null && p.lon != null)
      .map((p) => ({
        type: 'Feature' as const,
        properties: {
          id: p.id,
          handle: p.handle,
          displayName: p.displayName,
          text: p.text,
          createdAt: p.createdAt,
          url: p.url,
          species: p.species,
          place: p.place,
          sightingHint: p.sightingHint,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [p.lon as number, p.lat as number],
        },
      })),
  }
}
