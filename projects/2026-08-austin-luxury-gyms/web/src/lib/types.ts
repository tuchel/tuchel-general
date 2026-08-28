export type Flag = boolean | 'extra' | 'claimed'

export type Tier = 'equinox' | 'lifetime' | 'localLuxury' | 'privateTraining' | 'membersClub' | 'countryClub'

export type AmenityKey =
  | 'strengthFloor'
  | 'classes'
  | 'pilates'
  | 'cycling'
  | 'yoga'
  | 'spa'
  | 'steam'
  | 'sauna'
  | 'coldPlunge'
  | 'pool'
  | 'kids'
  | 'pickleball'
  | 'basketball'
  | 'tennis'
  | 'cafe'
  | 'cowork'
  | 'laundry'
  | 'parkingOnSite'
  | 'travelNetwork'

export type Gym = {
  id: string
  name: string
  short: string
  mark: string
  tier: Tier
  address: string
  lat: number
  lon: number
  phone: string | null
  website: string
  driveMin: number
  driveMi: number
  price: {
    monthlyFrom: number | null
    initiationFrom: number | null
    kind: 'quoted' | 'realtorEstimate' | 'unpublished'
    note: string
    source: string
    url: string
  }
  hours: { weekday: string; weekend: string; weekendEvening: boolean }
  sqft: number | null
  amenities: Record<AmenityKey, Flag>
  parking: string
  reviews: {
    sources: { name: string; score: number | null; n: number; url: string }[]
    for: string[]
    against: string[]
  }
  caveats: string[]
  fitNote: string
}

export type Catalog = {
  home: { name: string; city: string; lat: number; lon: number; source: string }
  asOf: string
  bar: string
  driveNote: string
  gyms: Gym[]
}

export type MustId =
  | 'pool'
  | 'contrast'
  | 'kids'
  | 'weekendEvening'
  | 'travel'
  | 'quotedPrice'
  | 'noTimedGarage'

export type SortId = 'fit' | 'drive' | 'price' | 'reviews'

export type Weights = {
  commute: number
  price: number
  recovery: number
  family: number
  hours: number
}

export const DEFAULT_WEIGHTS: Weights = {
  commute: 0.35,
  price: 0.2,
  recovery: 0.2,
  family: 0.1,
  hours: 0.15,
}

export const MUSTS: { id: MustId; label: string; hint: string }[] = [
  { id: 'pool', label: 'Pool in dues', hint: 'Lap or club pool included — not an add-on' },
  { id: 'contrast', label: 'Contrast', hint: 'Sauna, steam, or cold plunge' },
  { id: 'kids', label: 'Kids', hint: 'Kids Academy / club kids program' },
  { id: 'weekendEvening', label: 'Sat after 8pm', hint: 'Open past 8pm on Saturday' },
  { id: 'travel', label: 'Travel clubs', hint: 'National or global club network' },
  { id: 'quotedPrice', label: 'Public dues', hint: 'Club posted a monthly number' },
  { id: 'noTimedGarage', label: 'No timed garage', hint: 'Drops Equinox SoCo’s 2.5-hour ticket trap' },
]

export const TIERS: { id: Tier; label: string }[] = [
  { id: 'equinox', label: 'Equinox' },
  { id: 'lifetime', label: 'Life Time' },
  { id: 'localLuxury', label: 'Local luxury' },
  { id: 'privateTraining', label: 'Private training' },
  { id: 'membersClub', label: 'Members’ club' },
  { id: 'countryClub', label: 'Country club' },
]

export const AMENITY_ROWS: { key: AmenityKey; label: string }[] = [
  { key: 'pool', label: 'Pool' },
  { key: 'coldPlunge', label: 'Cold plunge' },
  { key: 'sauna', label: 'Sauna' },
  { key: 'steam', label: 'Steam' },
  { key: 'spa', label: 'Spa' },
  { key: 'classes', label: 'Classes' },
  { key: 'pilates', label: 'Pilates' },
  { key: 'kids', label: 'Kids' },
  { key: 'pickleball', label: 'Pickleball' },
  { key: 'tennis', label: 'Tennis' },
  { key: 'cafe', label: 'Café' },
  { key: 'travelNetwork', label: 'Travel network' },
]
