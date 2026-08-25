import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { AUSTIN } from './lib/constants'
import { pinSize } from './lib/filters'
import { formatTime } from './lib/when'
import type { BranchInfo, LonLat, StoryEvent } from './lib/types'

const POSITRON = 'https://tiles.openfreemap.org/styles/positron'
const OSM_RASTER: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap',
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
}

export type PinHover = {
  branch: string
  count: number
  next: string | null
  gap: boolean
  x: number
  y: number
}

export type EdgePad = { top: number; right: number; bottom: number; left: number }

type Props = {
  branches: Record<string, BranchInfo>
  dayEvents: StoryEvent[]
  selectedBranch: string | null
  selectedEvent: StoryEvent | null
  user: LonLat | null
  gapBranches: Set<string>
  edgePad: EdgePad
  onSelectBranch: (name: string | null) => void
  onHover: (h: PinHover | null) => void
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function coarsePointer(): boolean {
  return window.matchMedia('(pointer: coarse)').matches
}

export function MapPane({
  branches,
  dayEvents,
  selectedBranch,
  selectedEvent,
  user,
  gapBranches,
  edgePad,
  onSelectBranch,
  onHover,
}: Props) {
  const root = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markers = useRef<maplibregl.Marker[]>([])
  const userMarker = useRef<maplibregl.Marker | null>(null)
  const ready = useRef(false)
  const hoverFn = useRef(onHover)
  hoverFn.current = onHover
  const selectFn = useRef(onSelectBranch)
  selectFn.current = onSelectBranch

  useEffect(() => {
    if (!root.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: root.current,
      style: POSITRON,
      center: AUSTIN,
      zoom: 10.4,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => {
      ready.current = true
      map.resize()
      map.addSource('user-acc', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'user-acc',
        type: 'circle',
        source: 'user-acc',
        paint: {
          'circle-radius': 18,
          'circle-color': '#2a6f97',
          'circle-opacity': 0.12,
          'circle-stroke-width': 0,
        },
      })
    })
    let fellBack = false
    map.on('error', () => {
      if (fellBack) return
      fellBack = true
      map.setStyle(OSM_RASTER)
    })
    map.on('click', (e) => {
      const t = e.originalEvent.target as HTMLElement | null
      if (t?.closest('.pin')) return
      hoverFn.current(null)
      selectFn.current(null)
    })
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(root.current)
    mapRef.current = map
    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      ready.current = false
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const m of markers.current) m.remove()
    markers.current = []
    const hit = coarsePointer() ? 44 : 24

    const byBranch = new Map<string, StoryEvent[]>()
    for (const ev of dayEvents) {
      if (ev.branch === 'Online') continue
      const list = byBranch.get(ev.branch) ?? []
      list.push(ev)
      byBranch.set(ev.branch, list)
    }

    for (const [name, info] of Object.entries(branches)) {
      if (info.lat == null || info.lon == null) continue
      const todays = byBranch.get(name) ?? []
      const n = todays.length
      const gap = n === 0 && gapBranches.has(name)
      const selected =
        selectedBranch === name || (selectedEvent != null && selectedEvent.branch === name)
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `pin${n ? ' pin-live' : ''}${selected ? ' pin-sel' : ''}${gap && !n ? ' pin-gap' : ''}`
      const size = n ? pinSize(n) : 10
      el.style.width = `${Math.max(hit, size)}px`
      el.style.height = `${Math.max(hit, size)}px`
      el.innerHTML = `<span class="pin-dot" style="width:${size}px;height:${size}px">${n > 1 ? n : ''}</span>`
      el.setAttribute('aria-label', `${name}${n ? `, ${n} programs` : ''}`)
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        hoverFn.current(null)
        selectFn.current(name)
      })
      el.addEventListener('pointerenter', (ev) => {
        if (ev.pointerType === 'touch') return
        const r = (ev.currentTarget as HTMLElement).getBoundingClientRect()
        hoverFn.current({
          branch: name,
          count: n,
          next: todays[0] ? formatTime(todays[0].start) : null,
          gap,
          x: r.left + r.width / 2,
          y: r.top,
        })
      })
      el.addEventListener('pointerleave', () => hoverFn.current(null))
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([info.lon, info.lat])
        .addTo(map)
      markers.current.push(marker)
    }
  }, [branches, dayEvents, selectedBranch, selectedEvent, gapBranches])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const fit = () => {
      const bounds = new maplibregl.LngLatBounds()
      let bounded = false
      const live = new Set(dayEvents.map((e) => e.branch))
      for (const [name, info] of Object.entries(branches)) {
        if (info.lat == null || info.lon == null) continue
        if (!live.has(name)) continue
        bounds.extend([info.lon, info.lat])
        bounded = true
      }
      if (user) {
        bounds.extend([user.lon, user.lat])
        bounded = true
      }
      if (bounded && !bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: edgePad,
          maxZoom: 12.2,
          duration: reducedMotion() ? 0 : 650,
        })
      }
    }
    if (map.loaded()) fit()
    else map.once('load', fit)
  }, [branches, dayEvents, user, edgePad])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    userMarker.current?.remove()
    userMarker.current = null
    if (!user) return
    const el = document.createElement('div')
    el.className = 'user-dot'
    el.setAttribute('aria-label', 'Home')
    userMarker.current = new maplibregl.Marker({ element: el, anchor: 'center' })
      .setLngLat([user.lon, user.lat])
      .addTo(map)
    const src = map.getSource('user-acc')
    if (src && 'setData' in src) {
      src.setData({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [user.lon, user.lat] },
          },
        ],
      })
    }
  }, [user])

  return <div ref={root} className="map-root" />
}
