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

export function readCbsaFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('metro')
}

export function writeCbsaToUrl(cbsa: string | null) {
  const url = new URL(window.location.href)
  if (cbsa) url.searchParams.set('metro', cbsa)
  else url.searchParams.delete('metro')
  window.history.replaceState({}, '', url)
}
