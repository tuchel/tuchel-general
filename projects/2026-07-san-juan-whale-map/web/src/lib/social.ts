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
  direction: string | null
  threadRootId?: string | null
  dayLabel?: string | null
  role?: 'day_root' | 'update' | 'standalone'
}

export type SocialDayThread = {
  id: string
  dateLabel: string
  createdAt: string
  url: string
  summary: string
  handle: string
  displayName: string
  updateCount: number
  mappedCount: number
  updates: SocialPost[]
}

export type SocialSnapshot = {
  posts: SocialPost[]
  mapped: SocialPost[]
  latest: SocialPost | null
  dayThreads: SocialDayThread[]
  fetchedAt: string
  sourceNote: string
}

const BSKY = 'https://public.api.bsky.app/xrpc'
export const PSW_HANDLE = 'pugetsoundwhales.bsky.social'
const PSW_DAY_THREAD_LIMIT = 6

const HANDLES = [
  PSW_HANDLE,
  'wscrqb.bsky.social',
  'orcanetwork.bsky.social',
  'orcabehaviorinstitute.org',
  'pacificwhalewatchassociation.com',
  'thewhalemuseum.bsky.social',
  'whaleresearch.bsky.social',
  'orcasound.bsky.social',
  'sanjuanorcas.bsky.social',
  'acs-ps.bsky.social',
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
  ['saratoga passage', 48.1, -122.5, 'Saratoga Passage'],
  ['possession sound', 47.95, -122.25, 'Possession Sound'],
  ['port susan', 48.15, -122.4, 'Port Susan'],
  ['camano', 48.2, -122.45, 'Camano Island'],
  ['elliott bay', 47.6, -122.38, 'Elliott Bay'],
  ['elliot bay', 47.6, -122.38, 'Elliott Bay'],
  ['hood canal', 47.7, -122.85, 'Hood Canal'],
  ['apple tree point', 47.94, -122.45, 'Apple Tree Point'],
  ['kingston', 47.81, -122.5, 'Kingston'],
  ['richmond beach', 47.77, -122.39, 'Richmond Beach'],
  ['carkeek', 47.71, -122.38, 'Carkeek Park'],
  ['jefferson head', 47.75, -122.48, 'Jefferson Head'],
  ['point jefferson', 47.75, -122.48, 'Jefferson Head'],
  ['president point', 47.75, -122.44, 'President Point'],
  ['prez pt', 47.75, -122.44, 'President Point'],
  ['eglon', 47.87, -122.5, 'Eglon'],
  ['langley', 48.04, -122.41, 'Langley'],
  ['harbor island', 47.57, -122.35, 'Harbor Island'],
  ['andrews bay', 47.64, -122.4, 'Andrews Bay'],
  ['naval station everett', 48.0, -122.22, 'Naval Station Everett'],
  ['navy base', 48.0, -122.22, 'Naval Station Everett'],
  ['everett', 48.0, -122.2, 'Everett'],
  ['tacoma', 47.27, -122.42, 'Tacoma'],
  ['turn island', 48.53, -122.97, 'Turn Island'],
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

const CRYPTO_NOISE_RE =
  /\$btc|\$xrp|\$eth|\$usdc|\$usdt|#ripple|transferred from|unlocked at|unknown wallet|crypto/i

const DIRECTION_RE =
  /\b(northbound|southbound|eastbound|westbound|inbound|outbound)\b|\b(NB|SB|EB|WB)\b/i

const DAY_ROOT_RE =
  /\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\b/i

const CLOCK_RE = /\b(\d{1,2}):(\d{2})\s*[-–—]/

const SPECIES_HEADER_RE =
  /\b(ORCAS?|SRKWs?|HUMPBACKS?|GRAYS?|BIGG|TRANSIENT|PORPOISE|DOLPHIN)\b/i

const BBOX = { south: 47.0, north: 50.3, west: -125.5, east: -122.0 }

const SPECIES_LABELS: Record<string, string> = {
  srkw: 'Southern Resident orca',
  biggs: 'Bigg’s (transient) orca',
  orca_unspecified: 'Orca',
  humpback: 'Humpback',
  gray: 'Gray whale',
  minke: 'Minke',
  porpoise: 'Porpoise',
  other_baleen: 'Baleen whale',
  other_cetacean: 'Whale',
  unknown: 'Unspecified',
}

type BskyPost = {
  uri: string
  indexedAt?: string
  replyCount?: number
  author: { handle: string; displayName?: string; did?: string }
  record: {
    $type?: string
    text?: string
    createdAt?: string
    reply?: { root?: { uri?: string }; parent?: { uri?: string } }
  }
}

type BskyThreadNode = {
  post?: BskyPost
  replies?: BskyThreadNode[]
  $type?: string
}

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

function detectDirection(text: string): string | null {
  const m = text.match(DIRECTION_RE)
  if (!m) return null
  const raw = m[1] || m[2] || ''
  const map: Record<string, string> = {
    NB: 'northbound',
    SB: 'southbound',
    EB: 'eastbound',
    WB: 'westbound',
  }
  return map[raw] || raw.toLowerCase()
}

function isCryptoNoise(text: string) {
  return CRYPTO_NOISE_RE.test(text)
}

function dayLabelFromText(text: string): string | null {
  const m = text.match(DAY_ROOT_RE)
  return m ? m[0] : null
}

function isDayRoot(record: BskyPost['record']): boolean {
  if (record.reply) return false
  return DAY_ROOT_RE.test(record.text || '')
}

function relevant(text: string, handle: string) {
  if (isCryptoNoise(text)) return false
  if (handle === PSW_HANDLE) {
    if (DAY_ROOT_RE.test(text)) return true
    if (CLOCK_RE.test(text)) return true
    if (SPECIES_HEADER_RE.test(text) && text.length > 40) return true
    if (CETACEAN_RE.test(text) && (SIGHTING_HINT_RE.test(text) || text.length > 80)) return true
    return false
  }
  if (handle === 'wscrqb.bsky.social') return text.trim().length > 0
  return CETACEAN_RE.test(text)
}

function postToRow(
  post: BskyPost,
  opts: {
    fallbackHandle: string
    threadRootId?: string | null
    dayLabel?: string | null
    role?: SocialPost['role']
  },
): SocialPost | null {
  const record = post.record || {}
  if (record.$type && record.$type !== 'app.bsky.feed.post') return null
  const text = record.text || ''
  const h = post.author?.handle || opts.fallbackHandle
  if (!text || !relevant(text, h)) return null
  const geo = geocode(text)
  const uri = post.uri || ''
  const role = opts.role || 'standalone'
  const rootUri =
    opts.threadRootId ||
    record.reply?.root?.uri ||
    (role === 'day_root' ? uri : null)
  return {
    id: uri || `${h}:${record.createdAt}`,
    platform: 'bluesky',
    handle: h,
    displayName: post.author?.displayName || h,
    text: text.replace(/https?:\/\/\S+/g, '').trim().slice(0, 400),
    createdAt: record.createdAt || post.indexedAt || '',
    url: uri ? postUrl(h, uri) : `https://bsky.app/profile/${h}`,
    species: detectSpecies(text),
    place: geo?.place ?? null,
    lat: geo?.lat ?? null,
    lon: geo?.lon ?? null,
    geocodePrecision: geo ? 'place_name' : 'none',
    sightingHint: SIGHTING_HINT_RE.test(text) || CLOCK_RE.test(text),
    direction: detectDirection(text),
    threadRootId: rootUri,
    dayLabel: opts.dayLabel ?? null,
    role,
  }
}

function qualityScore(p: SocialPost): number {
  let score = 0
  if (p.sightingHint) score += 4
  if (p.place) score += 3
  if (p.lat != null) score += 1
  if (p.direction) score += 1
  if (
    p.handle === PSW_HANDLE ||
    p.handle === 'wscrqb.bsky.social' ||
    p.handle === 'orcanetwork.bsky.social'
  ) {
    score += 2
  }
  if (p.role === 'update') score += 1
  return score
}

/** Newest real cetacean report — recent first, then place/sighting quality. */
export function pickLatestSighting(posts: SocialPost[]): SocialPost | null {
  const clean = posts
    .filter(
      (p) =>
        !isCryptoNoise(p.text) &&
        p.species !== 'unknown' &&
        p.role !== 'day_root',
    )
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  if (!clean.length) return null

  const now = Date.now()
  const recent = clean.filter((p) => {
    const t = Date.parse(p.createdAt)
    return Number.isFinite(t) && now - t <= 72 * 3600 * 1000
  })
  const pool = recent.length ? recent : clean.slice(0, 25)
  return pool.reduce((best, p) => {
    if (!best) return p
    const dq = qualityScore(p) - qualityScore(best)
    if (dq > 0) return p
    if (dq < 0) return best
    return (p.createdAt || '') > (best.createdAt || '') ? p : best
  }, null as SocialPost | null)
}

export function speciesLabel(species: string, labels?: Record<string, string>) {
  return labels?.[species] || SPECIES_LABELS[species] || species
}

export function formatSightingWhen(iso: string): { absolute: string; relative: string } {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return { absolute: iso, relative: '' }
  const absolute = t.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
  const mins = Math.round((Date.now() - t.getTime()) / 60000)
  let relative = ''
  if (mins < 1) relative = 'just now'
  else if (mins < 60) relative = `${mins}m ago`
  else if (mins < 60 * 24) relative = `${Math.round(mins / 60)}h ago`
  else relative = `${Math.round(mins / (60 * 24))}d ago`
  return { absolute, relative }
}

async function pullHandle(handle: string, limit = 40): Promise<SocialPost[]> {
  const url = `${BSKY}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(handle)}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${handle} → ${res.status}`)
  const data = (await res.json()) as { feed?: { post: BskyPost }[] }
  const out: SocialPost[] = []
  for (const item of data.feed || []) {
    const post = item.post
    const record = post.record || {}
    const role =
      handle === PSW_HANDLE && isDayRoot(record) ? 'day_root' : 'standalone'
    const day = role === 'day_root' ? dayLabelFromText(record.text || '') : null
    const row = postToRow(post, {
      fallbackHandle: handle,
      dayLabel: day,
      role,
      threadRootId: role === 'day_root' ? post.uri : null,
    })
    if (row) out.push(row)
  }
  return out
}

function walkAuthorPosts(node: BskyThreadNode | undefined, authorHandle: string, out: BskyPost[]) {
  if (!node) return
  if (node.post && node.post.author?.handle === authorHandle) out.push(node.post)
  for (const child of node.replies || []) walkAuthorPosts(child, authorHandle, out)
}

async function pullPswDayThreads(limit = PSW_DAY_THREAD_LIMIT): Promise<{
  threads: SocialDayThread[]
  posts: SocialPost[]
}> {
  const feedRes = await fetch(
    `${BSKY}/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(PSW_HANDLE)}&limit=80`,
  )
  if (!feedRes.ok) throw new Error(`PSW feed → ${feedRes.status}`)
  const feed = (await feedRes.json()) as { feed?: { post: BskyPost }[] }
  const roots: BskyPost[] = []
  for (const item of feed.feed || []) {
    if (isDayRoot(item.post.record || {})) roots.push(item.post)
    if (roots.length >= limit) break
  }

  const threads: SocialDayThread[] = []
  const posts: SocialPost[] = []

  await Promise.all(
    roots.map(async (root) => {
      const uri = root.uri
      if (!uri) return
      try {
        const thrRes = await fetch(
          `${BSKY}/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=110`,
        )
        if (!thrRes.ok) return
        const thr = (await thrRes.json()) as { thread?: BskyThreadNode }
        const authorPosts: BskyPost[] = []
        walkAuthorPosts(thr.thread, PSW_HANDLE, authorPosts)
        const day = dayLabelFromText(root.record?.text || '') || 'Day log'
        const updates: SocialPost[] = []
        for (const post of authorPosts) {
          const isRoot = post.uri === uri
          const row = postToRow(post, {
            fallbackHandle: PSW_HANDLE,
            threadRootId: uri,
            dayLabel: day,
            role: isRoot ? 'day_root' : 'update',
          })
          if (!row) continue
          posts.push(row)
          if (!isRoot) updates.push(row)
        }
        updates.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
        threads.push({
          id: uri,
          dateLabel: day,
          createdAt: root.record?.createdAt || root.indexedAt || '',
          url: postUrl(PSW_HANDLE, uri),
          summary: (root.record?.text || '').replace(/https?:\/\/\S+/g, '').trim().slice(0, 500),
          handle: PSW_HANDLE,
          displayName: root.author?.displayName || 'Puget Sound Whales',
          updateCount: updates.length,
          mappedCount: updates.filter((u) => u.lat != null).length,
          updates,
        })
      } catch {
        /* soft-fail per thread */
      }
    }),
  )

  threads.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
  return { threads, posts }
}

export async function fetchSocialPosts(): Promise<SocialSnapshot> {
  const [chunks, dayPack] = await Promise.all([
    Promise.all(
      HANDLES.map(async (h) => {
        try {
          return await pullHandle(h, h === PSW_HANDLE ? 80 : 40)
        } catch {
          return [] as SocialPost[]
        }
      }),
    ),
    pullPswDayThreads().catch(() => ({ threads: [] as SocialDayThread[], posts: [] as SocialPost[] })),
  ])

  const byId = new Map<string, SocialPost>()
  for (const p of [...chunks.flat(), ...dayPack.posts]) {
    const prev = byId.get(p.id)
    if (!prev || ((p.role === 'day_root' || p.role === 'update') && prev.role === 'standalone')) {
      byId.set(p.id, p)
    }
  }
  const posts = [...byId.values()].sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || ''),
  )
  const mapped = posts.filter(
    (p) =>
      p.lat != null &&
      p.lon != null &&
      p.lat >= BBOX.south &&
      p.lat <= BBOX.north &&
      p.lon >= BBOX.west &&
      p.lon <= BBOX.east,
  )
  const trimmed = posts.slice(0, 280)
  return {
    posts: trimmed,
    mapped,
    latest: pickLatestSighting(trimmed),
    dayThreads: dayPack.threads,
    fetchedAt: new Date().toISOString(),
    sourceNote:
      'Bluesky · Puget Sound Whales day threads · place-name geocode (approx) · X/Reddit unavailable',
  }
}

/** Hours after which a post contributes ~0 weight to the Bluesky time heat. */
export const SOCIAL_HEAT_WINDOW_H = 7 * 24

export function postRecency(createdAt: string, nowMs = Date.now()): number {
  const t = Date.parse(createdAt)
  if (!Number.isFinite(t)) return 0
  const ageH = Math.max(0, (nowMs - t) / 3600000)
  return Math.max(0, Math.min(1, 1 - ageH / SOCIAL_HEAT_WINDOW_H))
}

/** Mapped posts newest-first for the swipe trail. */
export function browseableSocialPosts(posts: SocialPost[]): SocialPost[] {
  return posts
    .filter(
      (p) =>
        p.lat != null &&
        p.lon != null &&
        !isCryptoNoise(p.text) &&
        p.species !== 'unknown' &&
        p.role !== 'day_root',
    )
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

/** Match PSW day-root labels like "Mon, Aug 3" in Pacific local time. */
export function formatPswDayLabel(
  date = new Date(),
  timeZone = 'America/Los_Angeles',
): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).formatToParts(date)
  const wd = parts.find((p) => p.type === 'weekday')?.value || ''
  const mo = parts.find((p) => p.type === 'month')?.value || ''
  const day = parts.find((p) => p.type === 'day')?.value || ''
  return `${wd}, ${mo} ${day}`
}

/** Prefer today's PSW day thread; fall back to newest thread if still within ~30h. */
export function pickTodaysDayThread(
  threads: SocialDayThread[],
  now = new Date(),
): SocialDayThread | null {
  if (!threads.length) return null
  const label = formatPswDayLabel(now).toLowerCase()
  const exact = threads.find((t) => {
    const raw = (t.dateLabel || '').toLowerCase().replace(/\s+/g, ' ')
    return raw.includes(label)
  })
  if (exact) return exact

  const newest = [...threads].sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || ''),
  )[0]
  const t = Date.parse(newest.createdAt)
  if (Number.isFinite(t) && now.getTime() - t <= 30 * 3600 * 1000) return newest
  return null
}

export function mappedThreadUpdates(thread: SocialDayThread | null): SocialPost[] {
  if (!thread) return []
  return thread.updates
    .filter((u) => u.lat != null && u.lon != null && u.species !== 'unknown')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export function socialToGeoJSON(posts: SocialPost[], activeId?: string | null) {
  const now = Date.now()
  return {
    type: 'FeatureCollection' as const,
    features: posts
      .filter((p) => p.lat != null && p.lon != null && p.role !== 'day_root')
      .map((p) => {
        const recency = postRecency(p.createdAt, now)
        return {
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
            direction: p.direction,
            dayLabel: p.dayLabel,
            recency,
            active: activeId && p.id === activeId ? 1 : 0,
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [p.lon as number, p.lat as number],
          },
        }
      }),
  }
}
