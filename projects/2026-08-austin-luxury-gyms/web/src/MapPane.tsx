import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { driveMin } from './lib/score'
import type { Gym } from './lib/types'

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

export type PinHover = { id: string; x: number; y: number }
export type EdgePad = { top: number; right: number; bottom: number; left: number }
export type LonLat = { lat: number; lon: number }

type Props = {
  gyms: Gym[]
  selectedId: string | null
  compareIds: string[]
  home: LonLat
  peak: boolean
  edgePad: EdgePad
  onSelect: (id: string | null) => void
  onHover: (h: PinHover | null) => void
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function coarsePointer(): boolean {
  return window.matchMedia('(pointer: coarse)').matches
}

function pinClass(g: Gym, selected: boolean, compared: boolean, peak: boolean): string {
  const d = driveMin(g, peak)
  const band = d < 10 ? 'near' : d < 16 ? 'mid' : d < 22 ? 'far' : 'out'
  const shape =
    g.tier === 'countryClub' ? ' diamond' : g.tier === 'membersClub' || g.tier === 'privateTraining' ? ' square' : ''
  return `pin band-${band}${shape}${selected ? ' pin-sel' : ''}${compared ? ' pin-cmp' : ''}`
}

export function MapPane({
  gyms,
  selectedId,
  compareIds,
  home,
  peak,
  edgePad,
  onSelect,
  onHover,
}: Props) {
  const root = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markers = useRef<maplibregl.Marker[]>([])
  const userMarker = useRef<maplibregl.Marker | null>(null)
  const hoverFn = useRef(onHover)
  hoverFn.current = onHover
  const selectFn = useRef(onSelect)
  selectFn.current = onSelect

  useEffect(() => {
    if (!root.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: root.current,
      style: POSITRON,
      center: [home.lon, home.lat],
      zoom: 11.2,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
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
    }
  }, [home.lat, home.lon])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const m of markers.current) m.remove()
    markers.current = []
    const hit = coarsePointer() ? 44 : 26
    for (const g of gyms) {
      const selected = selectedId === g.id
      const compared = compareIds.includes(g.id)
      const el = document.createElement('button')
      el.type = 'button'
      el.className = pinClass(g, selected, compared, peak)
      el.style.width = `${hit}px`
      el.style.height = `${hit}px`
      el.innerHTML = `<span class="pin-dot">${g.short.slice(0, 2)}</span>`
      el.setAttribute('aria-label', g.name)
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        hoverFn.current(null)
        selectFn.current(g.id)
      })
      el.addEventListener('pointerenter', (ev) => {
        if (ev.pointerType === 'touch') return
        const r = (ev.currentTarget as HTMLElement).getBoundingClientRect()
        hoverFn.current({ id: g.id, x: r.left + r.width / 2, y: r.top })
      })
      el.addEventListener('pointerleave', () => hoverFn.current(null))
      markers.current.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([g.lon, g.lat]).addTo(map))
    }
  }, [gyms, selectedId, compareIds, peak])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    userMarker.current?.remove()
    const el = document.createElement('div')
    el.className = 'user-dot'
    el.setAttribute('aria-label', 'Home, 427 Ridgewood Road')
    userMarker.current = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([home.lon, home.lat]).addTo(map)
  }, [home.lat, home.lon])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const fit = () => {
      const bounds = new maplibregl.LngLatBounds()
      bounds.extend([home.lon, home.lat])
      const focus = selectedId ? gyms.filter((g) => g.id === selectedId) : gyms
      for (const g of focus.length ? focus : gyms) bounds.extend([g.lon, g.lat])
      if (focus.length === 1) bounds.extend([home.lon, home.lat])
      map.fitBounds(bounds, {
        padding: edgePad,
        maxZoom: selectedId ? 13.2 : 11.8,
        duration: reducedMotion() ? 0 : 650,
      })
    }
    if (map.loaded()) fit()
    else map.once('load', fit)
  }, [gyms, selectedId, home, edgePad])

  return <div ref={root} className="map-root" />
}
