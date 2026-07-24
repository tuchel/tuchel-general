import { useEffect, useMemo, useState } from 'react'
import {
  CHOROPLETH_CLASS_COLORS,
  CHOROPLETH_CLASS_LABELS,
  classColor,
  classIndex,
  classRanges,
  quantileBreaks,
} from '../lib/color'
import {
  formatMetric,
  metricLabel,
  metricValue,
  money,
  pct,
  type MetricKey,
  type Metro,
} from '../lib/types'

interface Props {
  metros: Metro[]
  metric: MetricKey
  selected: string | null
  onSelect: (cbsa: string) => void
  includeState?: boolean
}

type Feature = {
  type: 'Feature'
  properties: { cbsa: string; name: string; is_metro?: boolean; [k: string]: string | number | boolean | undefined }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

type FeatureCollection = { type: 'FeatureCollection'; features: Feature[] }

function project([lon, lat]: number[]): [number, number] {
  const x = ((lon + 125) / 58) * 1100
  const y = ((50 - lat) / 26) * 580
  return [x, y]
}

function ringPath(ring: number[][]): string {
  return (
    ring
      .map((c, i) => {
        const [x, y] = project(c as [number, number])
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ') + 'Z'
  )
}

function featurePath(f: Feature): string {
  if (f.geometry.type === 'Polygon') {
    return (f.geometry.coordinates as number[][][]).map(ringPath).join(' ')
  }
  return (f.geometry.coordinates as number[][][][])
    .map((poly) => poly.map(ringPath).join(' '))
    .join(' ')
}

function formatBreak(v: number, metric: MetricKey): string {
  if (metric === 'tax_as_share_of_personal_income') return pct(v)
  if (Math.abs(v) >= 1000) return money(v)
  return money(v, 0)
}

let geoCache: FeatureCollection | null = null

export function MetroMap({ metros, metric, selected, onSelect, includeState = false }: Props) {
  const [geo, setGeo] = useState<FeatureCollection | null>(geoCache)
  const [hover, setHover] = useState<string | null>(null)
  const opts = { includeState }

  useEffect(() => {
    if (geoCache) {
      setGeo(geoCache)
      return
    }
    let cancelled = false
    fetch(`${import.meta.env.BASE_URL}data/cbsa_metros.geojson`)
      .then((r) => r.json())
      .then((j: FeatureCollection) => {
        geoCache = j
        if (!cancelled) setGeo(j)
      })
      .catch(() => {
        if (!cancelled) setGeo({ type: 'FeatureCollection', features: [] })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const byCbsa = useMemo(() => {
    const m = new Map<string, Metro>()
    metros.forEach((x) => m.set(x.cbsa, x))
    return m
  }, [metros])

  const values = useMemo(() => {
    return metros
      .map((m) => metricValue(m, metric, opts))
      .filter((v): v is number => v != null)
  }, [metros, metric, includeState])

  const breaks = useMemo(() => quantileBreaks(values, 5), [values])
  const ranges = useMemo(() => classRanges(values, breaks), [values, breaks])

  const tipId = hover ?? selected
  const tipMetro = tipId ? byCbsa.get(tipId) : null

  return (
    <div className="map-shell svg-map">
      <svg
        viewBox="0 0 1100 620"
        role="img"
        aria-label="US core-based statistical areas choropleth"
        className="map-canvas-svg"
      >
        <rect width="1100" height="620" fill="rgba(255,255,255,0.45)" />
        {geo?.features.map((f) => {
          const cbsa = String(f.properties.cbsa).padStart(5, '0')
          const metro = byCbsa.get(cbsa)
          if (!metro) return null
          const raw = metricValue(metro, metric, opts)
          if (raw == null) return null
          const idx = classIndex(raw, breaks)
          const active = cbsa === selected || cbsa === hover
          return (
            <path
              key={cbsa}
              d={featurePath(f)}
              fill={classColor(idx)}
              stroke={active ? '#1a1f24' : '#f7f4ee'}
              strokeOpacity={active ? 1 : 0.85}
              strokeWidth={active ? 1.8 : 0.45}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover(cbsa)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect(cbsa)}
            >
              <title>
                {metro.name}: {formatMetric(metro, metric, opts)}
              </title>
            </path>
          )
        })}
      </svg>

      <div className="map-legend" aria-label="Choropleth legend">
        <div className="legend-head">
          <span className="legend-title">{metricLabel(metric, includeState)}</span>
          <span className="legend-note">Quintiles · low → high</span>
        </div>
        <ol className="legend-classes">
          {CHOROPLETH_CLASS_COLORS.map((color, i) => {
            const range = ranges[i]
            return (
              <li key={color}>
                <span className="legend-swatch" style={{ background: color }} aria-hidden />
                <span className="legend-class-label">{CHOROPLETH_CLASS_LABELS[i]}</span>
                <span className="legend-range mono">
                  {range
                    ? `${formatBreak(range.lo, metric)} – ${formatBreak(range.hi, metric)}`
                    : '—'}
                </span>
              </li>
            )
          })}
        </ol>
      </div>

      {tipMetro && (
        <div className="map-tip mono">
          <strong>{tipMetro.name}</strong>
          <span>{formatMetric(tipMetro, metric, opts)}</span>
        </div>
      )}
    </div>
  )
}
