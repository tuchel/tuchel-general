import { useDeferredValue, useMemo, useState } from 'react'
import type { Metro } from '../lib/types'

interface Props {
  metros: Metro[]
  selected: string | null
  onSelect: (cbsa: string) => void
}

export function MetroSearch({ metros, selected, onSelect }: Props) {
  const [q, setQ] = useState('')
  const deferred = useDeferredValue(q.trim().toLowerCase())

  const results = useMemo(() => {
    if (!deferred) return metros.slice(0, 8)
    return metros
      .filter((m) => m.name.toLowerCase().includes(deferred) || m.cbsa.includes(deferred))
      .slice(0, 12)
  }, [metros, deferred])

  return (
    <div className="search">
      <label className="search-label" htmlFor="metro-search">
        Find a metro
      </label>
      <input
        id="metro-search"
        type="search"
        placeholder="Type a city or metro name…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />
      <ul className="search-results" role="listbox">
        {results.map((m) => (
          <li key={m.cbsa}>
            <button
              type="button"
              className={m.cbsa === selected ? 'is-selected' : undefined}
              onClick={() => onSelect(m.cbsa)}
            >
              <span>{m.name}</span>
              <span className="mono muted">{m.population.toLocaleString()} people</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
