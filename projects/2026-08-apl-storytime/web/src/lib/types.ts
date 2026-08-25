export type BranchInfo = {
  address: string
  phone: string
  url: string
  aliases?: string[]
  lat?: number
  lon?: number
}

export type StoryEvent = {
  nid: string
  title: string
  program: string
  ages: string
  branch: string
  start: string
  end: string
  url: string
  address: string
  room: string
  source: string
  lat?: number
  lon?: number
}

export type Gap = {
  title: string
  branch: string
  when: string
  note: string
}

export type LonLat = { lat: number; lon: number }

export type FilterId =
  | 'all'
  | 'babies'
  | 'toddler'
  | 'preschool'
  | 'allages'
  | 'pajama'
  | 'language'
  | 'music'
  | 'online'
