import { useEffect, useRef, useState } from 'react'
import maplibregl, { type GeoJSONSource, type Map as MLMap, type MapLayerMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import {
  SPECIES_COLOR,
  hexScore,
  type Hotspot,
  type Launch,
  type Meta,
  type SpeciesKey,
} from '../lib/types'

type Props = {
  month: number | 'all'
  species: Set<SpeciesKey>
  showHabitat: boolean
  showHotspots: boolean
  showLaunches: boolean
  showRecent: boolean
  showScatter: boolean
  hotspots: Hotspot[]
  launches: Launch[]
  meta: Meta | null
  onHexHover: (info: HexHover | null) => void
  onSelectHotspot: (id: string | null) => void
  selectedHotspot: string | null
}

export type HexHover = {
  score: number
  total: number
  bySpecies: Record<string, number>
  lon: number
  lat: number
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

export function WhaleMap({
  month,
  species,
  showHabitat,
  showHotspots,
  showLaunches,
  showRecent,
  showScatter,
  hotspots,
  launches,
  meta,
  onHexHover,
  onSelectHotspot,
  selectedHotspot,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const [ready, setReady] = useState(false)
  const filtersRef = useRef({ month, species })
  filtersRef.current = { month, species }

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
              'raster-saturation': -0.35,
              'raster-brightness-min': 0.05,
              'raster-brightness-max': 0.85,
              'raster-contrast': 0.1,
            },
          },
        ],
      },
      center: [-123.05, 48.55],
      zoom: 9.2,
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

      // Score hexes for default filters
      const scored = scoreHexCollection(hexes, filtersRef.current.month, filtersRef.current.species)

      map.addSource('habitat', { type: 'geojson', data: habitat })
      map.addLayer({
        id: 'habitat-fill',
        type: 'fill',
        source: 'habitat',
        paint: {
          'fill-color': '#2a6f7a',
          'fill-opacity': 0.12,
        },
      })
      map.addLayer({
        id: 'habitat-line',
        type: 'line',
        source: 'habitat',
        paint: {
          'line-color': '#3a8a96',
          'line-width': 1,
          'line-opacity': 0.55,
          'line-dasharray': [2, 2],
        },
      })

      map.addSource('hexes', { type: 'geojson', data: scored as any })
      map.addLayer({
        id: 'hex-fill',
        type: 'fill',
        source: 'hexes',
        paint: {
          'fill-color': [
            'interpolate',
            ['linear'],
            ['get', 'score'],
            0,
            'rgba(10, 40, 55, 0)',
            1,
            'rgba(46, 140, 140, 0.25)',
            5,
            'rgba(56, 180, 160, 0.45)',
            15,
            'rgba(240, 180, 90, 0.55)',
            40,
            'rgba(232, 120, 70, 0.7)',
          ],
          'fill-outline-color': 'rgba(200, 230, 230, 0.15)',
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

      map.on('mousemove', 'hex-fill', (e: MapLayerMouseEvent) => {
        const f = e.features?.[0]
        if (!f?.properties) {
          onHexHover(null)
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
        onHexHover({
          score: Number(p.score) || 0,
          total: Number(p.total) || 0,
          bySpecies,
          lon: Number(p.lon),
          lat: Number(p.lat),
        })
        map.getCanvas().style.cursor = 'crosshair'
      })
      map.on('mouseleave', 'hex-fill', () => {
        onHexHover(null)
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
        src.setData(scoreHexCollection(hexes, month, species) as any)
      })
  }, [month, species, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const hs = map.getSource('hotspots') as GeoJSONSource | undefined
    hs?.setData(hotspotsToGeoJSON(hotspots))
    const ls = map.getSource('launches') as GeoJSONSource | undefined
    ls?.setData(launchesToGeoJSON(launches))
  }, [hotspots, launches, ready])

  // Layer visibility
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const vis = (id: string, on: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
    }
    vis('habitat-fill', showHabitat)
    vis('habitat-line', showHabitat)
    vis('hotspot-rings', showHotspots)
    vis('hotspot-cores', showHotspots)
    vis('launches', showLaunches)
    vis('recent', showRecent)
    vis('recent-halo', showRecent)
    vis('scatter', showScatter)
  }, [showHabitat, showHotspots, showLaunches, showRecent, showScatter, ready])

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

function scoreHexCollection(hexes: Fc, month: number | 'all', species: Set<string>) {
  const features = hexes.features.map((f) => {
    const p = f.properties || {}
    const bySpecies =
      typeof p.bySpecies === 'string' ? JSON.parse(p.bySpecies) : p.bySpecies || {}
    const byMonth = typeof p.byMonth === 'string' ? JSON.parse(p.byMonth) : p.byMonth || {}
    const bySpeciesMonth =
      typeof p.bySpeciesMonth === 'string' ? JSON.parse(p.bySpeciesMonth) : p.bySpeciesMonth || {}
    const score = hexScore(
      {
        total: Number(p.total) || 0,
        bySpecies: bySpecies as Record<string, number>,
        byMonth: byMonth as Record<string, number>,
        bySpeciesMonth: bySpeciesMonth as Record<string, number>,
      },
      month,
      species,
    )
    return {
      ...f,
      properties: { ...p, bySpecies, byMonth, bySpeciesMonth, score },
    }
  })
  return { type: 'FeatureCollection' as const, features }
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
