import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type Map as MLMap, type MapLayerMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { HydroFeed } from '../lib/live'
import {
  SPECIES_COLOR,
  hexRawCount,
  hexScore,
  type Hotspot,
  type Launch,
  type Meta,
  type SpeciesKey,
  type ViewMode,
} from '../lib/types'

export type HeatScale = {
  positiveCells: number
  maxScore: number
  maxRaw: number
  effortBias: boolean
}

type Props = {
  month: number | 'all'
  species: Set<SpeciesKey>
  showHabitat: boolean
  showHotspots: boolean
  showLaunches: boolean
  showRecent: boolean
  showScatter: boolean
  showHydros: boolean
  effortBias: boolean
  viewMode: ViewMode
  windGate: 'go' | 'caution' | 'no-go' | null
  hydroFeeds: HydroFeed[]
  hotspots: Hotspot[]
  launches: Launch[]
  meta: Meta | null
  onHexHover: (info: HexHover | null) => void
  onSelectHotspot: (id: string | null) => void
  onHeatScale: (scale: HeatScale | null) => void
  selectedHotspot: string | null
  layoutKey?: string
}

export type HexHover = {
  score: number
  raw: number
  rank: number
  total: number
  bySpecies: Record<string, number>
  lon: number
  lat: number
}

/**
 * Sequential ramp on percentile rank (0–100).
 * Colors are opaque; transparency comes only from fill-opacity so the layer
 * stays readable as an overlay (rgba-in-color × opacity was painting invisible).
 */
const HEAT_COLOR: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['get', 'rank'],
  0,
  '#08202a',
  8,
  '#0a4a52',
  25,
  '#148878',
  45,
  '#c49628',
  65,
  '#e07630',
  82,
  '#e65230',
  100,
  '#ffc46e',
]

/** Rank → opacity. Clear enough to see corridors; low enough to read the chart. */
const HEAT_FILL_OPACITY: maplibregl.ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['get', 'rank'],
  0,
  0,
  8,
  0.28,
  30,
  0.4,
  55,
  0.52,
  80,
  0.62,
  100,
  0.7,
]

function heatFillOpacity(mul: number): maplibregl.ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['get', 'rank'],
    0,
    0,
    8,
    0.28 * mul,
    30,
    0.4 * mul,
    55,
    0.52 * mul,
    80,
    0.62 * mul,
    100,
    0.7 * mul,
  ]
}

function hotspotsToGeoJSON(hotspots: Hotspot[]) {
  return {
    type: 'FeatureCollection' as const,
    features: hotspots.map((h) => ({
      type: 'Feature' as const,
      properties: { id: h.id, name: h.name, kind: h.kind, radiusKm: h.radiusKm },
      geometry: { type: 'Point' as const, coordinates: [h.lon, h.lat] },
    })),
  }
}

function launchesToGeoJSON(launches: Launch[]) {
  return {
    type: 'FeatureCollection' as const,
    features: launches.map((l) => ({
      type: 'Feature' as const,
      properties: { id: l.id, name: l.name },
      geometry: { type: 'Point' as const, coordinates: [l.lon, l.lat] },
    })),
  }
}

function hydrosToGeoJSON(feeds: HydroFeed[]) {
  return {
    type: 'FeatureCollection' as const,
    features: feeds.map((f) => ({
      type: 'Feature' as const,
      properties: {
        id: f.id,
        name: f.name,
        pulse: f.pulse,
        listenUrl: f.listenUrl,
        count: f.detectionCount24h,
      },
      geometry: { type: 'Point' as const, coordinates: [f.lon, f.lat] },
    })),
  }
}

export function WhaleMap({
  month,
  species,
  showHabitat,
  showHotspots,
  showLaunches,
  showRecent,
  showScatter,
  showHydros,
  effortBias,
  viewMode,
  windGate,
  hydroFeeds,
  hotspots,
  launches,
  meta,
  onHexHover,
  onSelectHotspot,
  onHeatScale,
  selectedHotspot,
  layoutKey = 'default',
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const [ready, setReady] = useState(false)
  const filtersRef = useRef({ month, species, effortBias })
  filtersRef.current = { month, species, effortBias }

  useEffect(() => {
    if (!container.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
            paint: {
              'raster-saturation': -0.4,
              'raster-brightness-min': 0.04,
              'raster-brightness-max': 0.68,
              'raster-contrast': 0.16,
            },
          },
        ],
      },
      center: [-123.05, 48.55],
      zoom: 9.7,
      maxBounds: [
        [-124.2, 47.8],
        [-121.8, 49.3],
      ],
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'imperial' }), 'bottom-right')

    map.on('load', async () => {
      const [hexes, habitat, recent, scatter] = await Promise.all([
        fetch('./data/hexes.json').then((r) => r.json()),
        fetch('./data/habitat.json').then((r) => r.json()),
        fetch('./data/recent.json').then((r) => r.json()),
        fetch('./data/scatter.json').then((r) => r.json()),
      ])

      const scored = scoreHexCollection(
        hexes,
        filtersRef.current.month,
        filtersRef.current.species,
        filtersRef.current.effortBias,
      )

      map.addSource('habitat', { type: 'geojson', data: habitat })
      map.addLayer({
        id: 'habitat-fill',
        type: 'fill',
        source: 'habitat',
        paint: {
          'fill-color': '#2a6f7a',
          'fill-opacity': 0.06,
        },
      })
      map.addLayer({
        id: 'habitat-line',
        type: 'line',
        source: 'habitat',
        paint: {
          'line-color': '#3a8a96',
          'line-width': 1,
          'line-opacity': 0.4,
          'line-dasharray': [2, 2],
        },
      })

      onHeatScale(scored.scale)
      map.addSource('hexes', { type: 'geojson', data: scored.collection as any })
      map.addSource('heat-points', { type: 'geojson', data: scored.centroids as any })
      // Soft under-glow blends fine cells into corridors (hex fill is the readable layer)
      map.addLayer({
        id: 'heat-glow',
        type: 'heatmap',
        source: 'heat-points',
        filter: ['>', ['get', 'rank'], 0],
        paint: {
          'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'rank'],
            0,
            0,
            20,
            0.3,
            50,
            0.65,
            100,
            1,
          ],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.7, 10, 0.95, 12, 1.15],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 22, 10, 34, 12, 48],
          'heatmap-opacity': 0.45,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(0,0,0,0)',
            0.12,
            'rgba(10, 70, 82, 0)',
            0.25,
            'rgba(16, 110, 112, 0.35)',
            0.45,
            'rgba(40, 150, 120, 0.45)',
            0.65,
            'rgba(210, 140, 40, 0.55)',
            0.85,
            'rgba(230, 90, 45, 0.65)',
            1,
            'rgba(255, 190, 110, 0.75)',
          ],
        },
      })
      map.addLayer({
        id: 'hex-fill',
        type: 'fill',
        source: 'hexes',
        filter: ['>', ['get', 'rank'], 0],
        paint: {
          'fill-color': HEAT_COLOR,
          'fill-opacity': HEAT_FILL_OPACITY,
          'fill-antialias': true,
        },
      })
      map.addLayer({
        id: 'hex-line',
        type: 'line',
        source: 'hexes',
        filter: ['>', ['get', 'rank'], 20],
        paint: {
          'line-color': [
            'interpolate',
            ['linear'],
            ['get', 'rank'],
            20,
            'rgba(255, 255, 255, 0.08)',
            60,
            'rgba(255, 245, 220, 0.22)',
            100,
            'rgba(255, 248, 230, 0.4)',
          ],
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.2, 11, 0.45, 13, 0.7],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.35, 11, 0.75, 13, 0.95],
        },
      })
      map.addLayer({
        id: 'hex-hover',
        type: 'line',
        source: 'hexes',
        filter: ['==', ['get', 'q'], -999999],
        paint: {
          'line-color': 'rgba(255, 244, 210, 0.95)',
          'line-width': 1.6,
          'line-opacity': 1,
        },
      })

      map.addSource('scatter', { type: 'geojson', data: scatter })
      map.addLayer({
        id: 'scatter',
        type: 'circle',
        source: 'scatter',
        paint: {
          'circle-radius': 2.2,
          'circle-color': [
            'match',
            ['get', 'species'],
            'srkw',
            SPECIES_COLOR.srkw,
            'biggs',
            SPECIES_COLOR.biggs,
            'orca_unspecified',
            SPECIES_COLOR.orca_unspecified,
            'humpback',
            SPECIES_COLOR.humpback,
            'gray',
            SPECIES_COLOR.gray,
            'minke',
            SPECIES_COLOR.minke,
            'porpoise',
            SPECIES_COLOR.porpoise,
            '#9aa',
          ],
          'circle-opacity': 0.35,
          'circle-stroke-width': 0,
        },
      })

      map.addSource('recent', { type: 'geojson', data: recent })
      map.addLayer({
        id: 'recent-halo',
        type: 'circle',
        source: 'recent',
        paint: {
          'circle-radius': 14,
          'circle-color': '#f0c060',
          'circle-opacity': 0.15,
        },
      })
      map.addLayer({
        id: 'recent',
        type: 'circle',
        source: 'recent',
        paint: {
          'circle-radius': 7,
          'circle-color': '#0d1f2a',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': [
            'match',
            ['get', 'species'],
            'srkw',
            SPECIES_COLOR.srkw,
            'biggs',
            SPECIES_COLOR.biggs,
            'humpback',
            SPECIES_COLOR.humpback,
            'minke',
            SPECIES_COLOR.minke,
            SPECIES_COLOR.orca_unspecified,
          ],
        },
      })

      map.addSource('hotspots', { type: 'geojson', data: hotspotsToGeoJSON(hotspots) })
      map.addLayer({
        id: 'hotspot-rings',
        type: 'circle',
        source: 'hotspots',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 18, 11, 40],
          'circle-color': 'transparent',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#e8d5a8',
          'circle-stroke-opacity': 0.7,
        },
      })
      map.addLayer({
        id: 'hotspot-cores',
        type: 'circle',
        source: 'hotspots',
        paint: {
          'circle-radius': 5,
          'circle-color': '#e8d5a8',
          'circle-stroke-width': 1,
          'circle-stroke-color': '#0d1f2a',
        },
      })

      map.addSource('launches', { type: 'geojson', data: launchesToGeoJSON(launches) })
      map.addLayer({
        id: 'launches',
        type: 'circle',
        source: 'launches',
        paint: {
          'circle-radius': 5,
          'circle-color': '#dff2ff',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#1a4a6a',
        },
      })

      map.addSource('hydros', { type: 'geojson', data: hydrosToGeoJSON([]) })
      map.addLayer({
        id: 'hydro-pulse',
        type: 'circle',
        source: 'hydros',
        paint: {
          'circle-radius': [
            'match',
            ['get', 'pulse'],
            'hot',
            18,
            'recent',
            14,
            10,
          ],
          'circle-color': [
            'match',
            ['get', 'pulse'],
            'hot',
            '#3ecfba',
            'recent',
            '#7ec8e3',
            '#4a6670',
          ],
          'circle-opacity': 0.25,
        },
      })
      map.addLayer({
        id: 'hydro-cores',
        type: 'circle',
        source: 'hydros',
        paint: {
          'circle-radius': 6,
          'circle-color': '#0d1f2a',
          'circle-stroke-width': 2.5,
          'circle-stroke-color': [
            'match',
            ['get', 'pulse'],
            'hot',
            '#3ecfba',
            'recent',
            '#7ec8e3',
            '#8aa',
          ],
        },
      })

      map.on('mousemove', 'hex-fill', (e: MapLayerMouseEvent) => {
        const f = e.features?.[0]
        if (!f?.properties) {
          onHexHover(null)
          if (map.getLayer('hex-hover')) {
            map.setFilter('hex-hover', ['==', ['get', 'q'], -999999])
          }
          return
        }
        const p = f.properties
        let bySpecies: Record<string, number> = {}
        try {
          bySpecies =
            typeof p.bySpecies === 'string' ? JSON.parse(p.bySpecies) : (p.bySpecies as Record<string, number>)
        } catch {
          bySpecies = {}
        }
        if (map.getLayer('hex-hover') && p.q != null && p.r != null) {
          map.setFilter('hex-hover', [
            'all',
            ['==', ['get', 'q'], Number(p.q)],
            ['==', ['get', 'r'], Number(p.r)],
          ])
        }
        onHexHover({
          score: Number(p.score) || 0,
          raw: Number(p.raw) || 0,
          rank: Number(p.rank) || 0,
          total: Number(p.total) || 0,
          bySpecies,
          lon: Number(p.lon),
          lat: Number(p.lat),
        })
        map.getCanvas().style.cursor = 'crosshair'
      })
      map.on('mouseleave', 'hex-fill', () => {
        onHexHover(null)
        if (map.getLayer('hex-hover')) {
          map.setFilter('hex-hover', ['==', ['get', 'q'], -999999])
        }
        map.getCanvas().style.cursor = ''
      })

      map.on('click', 'hotspot-cores', (e) => {
        const id = e.features?.[0]?.properties?.id
        if (id) onSelectHotspot(String(id))
      })
      map.on('click', 'hotspot-rings', (e) => {
        const id = e.features?.[0]?.properties?.id
        if (id) onSelectHotspot(String(id))
      })
      const openHydro = (e: MapLayerMouseEvent) => {
        const url = e.features?.[0]?.properties?.listenUrl
        if (url) window.open(String(url), '_blank', 'noopener,noreferrer')
      }
      map.on('click', 'hydro-cores', openHydro)
      map.on('click', 'hydro-pulse', openHydro)
      for (const layer of ['hydro-cores', 'hydro-pulse'] as const) {
        map.on('mouseenter', layer, () => {
          map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', layer, () => {
          map.getCanvas().style.cursor = ''
        })
      }

      // Recent tooltip
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        className: 'whale-popup',
      })
      map.on('mouseenter', 'recent', (e) => {
        map.getCanvas().style.cursor = 'pointer'
        const f = e.features?.[0]
        if (!f || !e.lngLat) return
        const p = f.properties || {}
        const label = meta?.speciesLabels?.[p.species as string] || p.label || p.species
        popup
          .setLngLat(e.lngLat)
          .setHTML(
            `<strong>${escapeHtml(String(label))}</strong><br/>${escapeHtml(String(p.date || ''))}` +
              (p.remarks ? `<br/><span class="muted">${escapeHtml(String(p.remarks).slice(0, 160))}</span>` : '') +
              `<br/><span class="muted">${escapeHtml(String(p.source || ''))}</span>`,
          )
          .addTo(map)
      })
      map.on('mouseleave', 'recent', () => {
        map.getCanvas().style.cursor = ''
        popup.remove()
      })

      setReady(true)
    })

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, [])

  // Rescore hexes when filters change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const src = map.getSource('hexes') as GeoJSONSource | undefined
    if (!src) return
    fetch('./data/hexes.json')
      .then((r) => r.json())
      .then((hexes) => {
        const scored = scoreHexCollection(hexes, month, species, effortBias)
        src.setData(scored.collection as any)
        const pts = map.getSource('heat-points') as GeoJSONSource | undefined
        pts?.setData(scored.centroids as any)
        onHeatScale(scored.scale)
      })
  }, [month, species, effortBias, ready, onHeatScale])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const hs = map.getSource('hotspots') as GeoJSONSource | undefined
    hs?.setData(hotspotsToGeoJSON(hotspots))
    const ls = map.getSource('launches') as GeoJSONSource | undefined
    ls?.setData(launchesToGeoJSON(launches))
    const hy = map.getSource('hydros') as GeoJSONSource | undefined
    hy?.setData(hydrosToGeoJSON(hydroFeeds))
  }, [hotspots, launches, hydroFeeds, ready])

  // Layer visibility + view-mode emphasis
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const vis = (id: string, on: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
    }
    const climOn = viewMode !== 'nowcast'
    const nowOn = viewMode !== 'climatology'
    vis('habitat-fill', showHabitat)
    vis('habitat-line', showHabitat)
    vis('hotspot-rings', showHotspots && climOn)
    vis('hotspot-cores', showHotspots && climOn)
    vis('launches', showLaunches)
    vis('recent', showRecent && nowOn)
    vis('recent-halo', showRecent && nowOn)
    vis('scatter', showScatter && climOn)
    vis('heat-glow', climOn)
    vis('hex-fill', climOn)
    vis('hex-line', climOn)
    vis('hex-hover', climOn)
    vis('hydro-pulse', showHydros && nowOn)
    vis('hydro-cores', showHydros && nowOn)

    if (map.getLayer('hex-fill')) {
      const mul = viewMode === 'climatology' ? 1 : viewMode === 'balanced' ? 0.9 : 0.28
      map.setPaintProperty('hex-fill', 'fill-opacity', heatFillOpacity(mul))
    }
    if (map.getLayer('heat-glow')) {
      const glow =
        viewMode === 'climatology' ? 0.5 : viewMode === 'balanced' ? 0.45 : 0.14
      map.setPaintProperty('heat-glow', 'heatmap-opacity', glow)
    }
    if (map.getLayer('recent')) {
      map.setPaintProperty('recent', 'circle-radius', viewMode === 'nowcast' ? 9 : 7)
    }
  }, [
    showHabitat,
    showHotspots,
    showLaunches,
    showRecent,
    showScatter,
    showHydros,
    viewMode,
    ready,
  ])

  // Wind gate washes the map when conditions are rough
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !map.getLayer('osm')) return
    const sat = windGate === 'no-go' ? -0.65 : windGate === 'caution' ? -0.5 : -0.4
    const brightMax = windGate === 'no-go' ? 0.5 : windGate === 'caution' ? 0.58 : 0.68
    map.setPaintProperty('osm', 'raster-saturation', sat)
    map.setPaintProperty('osm', 'raster-brightness-max', brightMax)
  }, [windGate, ready])

  // Highlight selected hotspot
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready || !map.getLayer('hotspot-cores')) return
    map.setPaintProperty('hotspot-cores', 'circle-radius', [
      'case',
      ['==', ['get', 'id'], selectedHotspot || ''],
      8,
      5,
    ])
    map.setPaintProperty('hotspot-rings', 'circle-stroke-color', [
      'case',
      ['==', ['get', 'id'], selectedHotspot || ''],
      '#fff3c4',
      '#e8d5a8',
    ])
  }, [selectedHotspot, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const id = window.setTimeout(() => map.resize(), 80)
    return () => window.clearTimeout(id)
  }, [layoutKey, ready])

  return <div className="map-root" ref={container} role="img" aria-label="Map of whale sighting odds around San Juan Island" />
}

type Fc = {
  type: 'FeatureCollection'
  features: {
    type: 'Feature'
    properties: Record<string, unknown> | null
    geometry: { type: string; coordinates: unknown }
  }[]
}

function scoreHexCollection(
  hexes: Fc,
  month: number | 'all',
  species: Set<string>,
  effortBias: boolean,
) {
  const parsed = hexes.features.map((f) => {
    const p = f.properties || {}
    const bySpecies =
      typeof p.bySpecies === 'string' ? JSON.parse(p.bySpecies) : p.bySpecies || {}
    const byMonth = typeof p.byMonth === 'string' ? JSON.parse(p.byMonth) : p.byMonth || {}
    const bySpeciesMonth =
      typeof p.bySpeciesMonth === 'string' ? JSON.parse(p.bySpeciesMonth) : p.bySpeciesMonth || {}
    return {
      f,
      p,
      bySpecies: bySpecies as Record<string, number>,
      byMonth: byMonth as Record<string, number>,
      bySpeciesMonth: bySpeciesMonth as Record<string, number>,
      total: Number(p.total) || 0,
    }
  })
  const totals = parsed.map((x) => x.total).filter((t) => t > 0).sort((a, b) => a - b)
  const medianEffort = totals.length ? totals[Math.floor(totals.length / 2)] : 20

  const scored = parsed.map(({ f, p, bySpecies, byMonth, bySpeciesMonth, total }) => {
    const props = { total, bySpecies, byMonth, bySpeciesMonth }
    const raw = hexRawCount(props, month, species)
    const score = hexScore(props, month, species, { effortBias, medianEffort })
    return { f, p, bySpecies, byMonth, bySpeciesMonth, score, raw }
  })

  // Percentile rank among positive cells so the ramp always uses full contrast
  const positive = scored
    .map((s, i) => ({ i, score: s.score }))
    .filter((s) => s.score > 0)
    .sort((a, b) => a.score - b.score)
  const ranks = new Map<number, number>()
  const n = positive.length
  positive.forEach((s, order) => {
    ranks.set(s.i, n <= 1 ? 100 : (order / (n - 1)) * 100)
  })

  const features = scored.map((s, i) => {
    const rank = ranks.get(i) ?? 0
    const lon = Number(s.p.lon)
    const lat = Number(s.p.lat)
    return {
      ...s.f,
      properties: {
        ...s.p,
        bySpecies: s.bySpecies,
        byMonth: s.byMonth,
        bySpeciesMonth: s.bySpeciesMonth,
        score: s.score,
        raw: s.raw,
        rank,
        lon,
        lat,
      },
    }
  })

  const centroids = {
    type: 'FeatureCollection' as const,
    features: features
      .filter((f) => f.properties.rank > 0 && Number.isFinite(f.properties.lon) && Number.isFinite(f.properties.lat))
      .map((f) => ({
        type: 'Feature' as const,
        properties: {
          rank: f.properties.rank,
          score: f.properties.score,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [f.properties.lon, f.properties.lat],
        },
      })),
  }

  const maxScore = positive.length ? positive[positive.length - 1].score : 0
  const maxRaw = scored.reduce((m, s) => Math.max(m, s.raw), 0)
  return {
    collection: { type: 'FeatureCollection' as const, features },
    centroids,
    scale: {
      positiveCells: n,
      maxScore,
      maxRaw,
      effortBias,
    } satisfies HeatScale,
  }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
