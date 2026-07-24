import { useEffect, useMemo, useState } from 'react'
import { classIndex, quantileBreaks, sequentialColor } from '../lib/color'
import type { MetricKey, Metro } from '../lib/types'

interface Props {
  metros: Metro[]
  metric: MetricKey
  selected: string | null
  onSelect: (cbsa: string) => void
}

type Feature = {
  type: 'Feature'
  properties: { cbsa: string; name: string; [k: string]: string | number }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

type FeatureCollection = { type: 'FeatureCollection'; features: Feature[] }

function project([lon, lat]: number[]): [number, number] {
  const x = ((lon + 125) / 58) * 960
  const y = ((50 - lat) / 26) * 520
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

let geoCache: FeatureCollection | null = null

export function MetroMap({ metros, metric, selected, onSelect }: Props) {
  const [geo, setGeo] = useState<FeatureCollection | null>(geoCache)
  const [hover, setHover] = useState<string | null>(null)

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

  const breaks = useMemo(
    () => quantileBreaks(metros.map((m) => m[metric]), 5),
    [metros, metric],
  )

  const colors = [0, 0.25, 0.5, 0.75, 1].map(sequentialColor)

  const tipId = hover ?? selected
  const tipMetro = tipId ? byCbsa.get(tipId) : null

  return (
    <div className="map-shell svg-map">
      <svg
        viewBox="0 0 960 560"
        role="img"
        aria-label="US metropolitan areas choropleth"
        className="map-canvas-svg"
      >
        <rect width="960" height="560" fill="rgba(255,255,255,0.35)" />
        {geo?.features.map((f) => {
          const cbsa = String(f.properties.cbsa).padStart(5, '0')
          const metro = byCbsa.get(cbsa)
          if (!metro) return null
          const idx = classIndex(metro[metric], breaks)
          const active = cbsa === selected || cbsa === hover
          return (
            <path
              key={cbsa}
              d={featurePath(f)}
              fill={colors[idx]}
              stroke={active ? '#8a4b12' : '#1a1f24'}
              strokeOpacity={active ? 1 : 0.2}
              strokeWidth={active ? 1.6 : 0.35}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHover(cbsa)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect(cbsa)}
            >
              <title>
                {metro.name}: {metric.replaceAll('_', ' ')} $
                {metro[metric].toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </title>
            </path>
          )
        })}
      </svg>
      <div className="map-legend">
        <span className="legend-title">Relative {metric.replaceAll('_', ' ')}</span>
        <div className="legend-ramp">
          {colors.map((c) => (
            <span key={c} style={{ background: c }} />
          ))}
        </div>
        <div className="legend-ends">
          <span>Lower</span>
          <span>Higher</span>
        </div>
      </div>
      {tipMetro && (
        <div className="map-tip mono">
          <strong>{tipMetro.name}</strong>
          <span>
            Tax ${tipMetro.tax_per_capita.toLocaleString('en-US', { maximumFractionDigits: 0 })} ·
            Spend ${tipMetro.spend_per_capita.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}
    </div>
  )
}
