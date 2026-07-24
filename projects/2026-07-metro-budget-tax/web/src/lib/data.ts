import { useEffect, useMemo, useState } from 'react'
import type { Dataset, Metro } from './types'

export function useMetroData() {
  const [data, setData] = useState<Dataset | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}data/metros_web.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load metros (${r.status})`)
        return r.json()
      })
      .then((json: Dataset) => {
        if (!cancelled) setData(json)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const byCbsa = useMemo(() => {
    const map = new Map<string, Metro>()
    data?.metros.forEach((m) => map.set(m.cbsa, m))
    return map
  }, [data])

  return { data, byCbsa, error, loading: !data && !error }
}

export interface UrlState {
  metro: string | null
  compare: string[]
  metric: string | null
  micros: boolean
}

export function readUrlState(): UrlState {
  const params = new URLSearchParams(window.location.search)
  const compare = (params.get('compare') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return {
    metro: params.get('metro'),
    compare,
    metric: params.get('metric'),
    micros: params.get('micros') === '1',
  }
}

export function writeUrlState(state: {
  metro: string | null
  compare: string[]
  metric: string
  micros: boolean
}) {
  const url = new URL(window.location.href)
  if (state.metro) url.searchParams.set('metro', state.metro)
  else url.searchParams.delete('metro')
  if (state.compare.length) url.searchParams.set('compare', state.compare.join(','))
  else url.searchParams.delete('compare')
  url.searchParams.set('metric', state.metric)
  if (state.micros) url.searchParams.set('micros', '1')
  else url.searchParams.delete('micros')
  window.history.replaceState({}, '', url)
}
