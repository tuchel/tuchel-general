import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { AUSTIN } from './lib/constants'
import type { BranchInfo, LonLat, StoryEvent } from './lib/types'

const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/positron'
const STYLE_DARK = 'https://tiles.openfreemap.org/styles/dark'
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

type Props = {
  branches: Record<string, BranchInfo>
  dayEvents: StoryEvent[]
  selectedBranch: string | null
  home: LonLat
  active: boolean
  padBottom: number
  shortName: (name: string) => string
  onSelectBranch: (name: string | null) => void
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const darkScheme = () => window.matchMedia('(prefers-color-scheme: dark)').matches

export function MapPane({
  branches,
  dayEvents,
  selectedBranch,
  home,
  active,
  padBottom,
  shortName,
  onSelectBranch,
}: Props) {
  const root = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markers = useRef<maplibregl.Marker[]>([])
  const labels = useRef<{ el: HTMLElement; at: [number, number] }[]>([])
  const selectFn = useRef(onSelectBranch)
  selectFn.current = onSelectBranch

  useEffect(() => {
    if (!root.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: root.current,
      style: darkScheme() ? STYLE_DARK : STYLE_LIGHT,
      center: AUSTIN,
      zoom: 10.4,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
    })
    map.touchZoomRotate.disableRotation()
    if (window.matchMedia('(pointer: fine)').matches) {
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    }
    let fellBack = false
    map.on('error', () => {
      if (fellBack) return
      fellBack = true
      map.setStyle(OSM_RASTER)
    })
    map.on('click', (e) => {
      const t = e.originalEvent.target as HTMLElement | null
      if (t?.closest('.pin')) return
      selectFn.current(null)
    })
    map.on('load', () => {
      root.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
    })
    map.on('moveend', () => declutter(map, labels.current))
    const ro = new ResizeObserver(() => map.resize())
    ro.observe(root.current)
    mapRef.current = map

    const el = document.createElement('div')
    el.className = 'home-pin'
    el.innerHTML = '<span></span><em>Home</em>'
    new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([home.lon, home.lat]).addTo(map)

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [home])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const m of markers.current) m.remove()
    markers.current = []
    labels.current = []

    const byBranch = new Map<string, number>()
    for (const ev of dayEvents) {
      if (ev.branch === 'Online') continue
      byBranch.set(ev.branch, (byBranch.get(ev.branch) ?? 0) + 1)
    }

    const order = Object.entries(branches).sort(
      ([a], [b]) =>
        Number(b === selectedBranch) - Number(a === selectedBranch) ||
        (byBranch.get(b) ?? 0) - (byBranch.get(a) ?? 0),
    )
    for (const [name, info] of order) {
      if (info.lat == null || info.lon == null) continue
      const n = byBranch.get(name) ?? 0
      const sel = selectedBranch === name
      const el = document.createElement('button')
      el.type = 'button'
      el.className = `pin${n ? ' live' : ''}${sel ? ' sel' : ''}`
      el.setAttribute('aria-label', `${name}, ${n ? `${n} program${n === 1 ? '' : 's'}` : 'no programs'}`)
      el.setAttribute('aria-pressed', String(sel))
      const dot = document.createElement('span')
      dot.className = 'pin-dot'
      if (n) dot.textContent = String(n)
      el.appendChild(dot)
      if (n || sel) {
        const label = document.createElement('em')
        label.className = 'pin-label'
        label.textContent = shortName(name)
        el.appendChild(label)
        labels.current.push({ el: label, at: [info.lon, info.lat] })
      }
      el.addEventListener('click', (ev) => {
        ev.stopPropagation()
        selectFn.current(sel ? null : name)
      })
      const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([info.lon, info.lat])
        .addTo(map)
      if (n) marker.getElement().style.zIndex = sel ? '3' : '2'
      markers.current.push(marker)
    }
    declutter(map, labels.current)
  }, [branches, dayEvents, selectedBranch, shortName])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !active) return
    const fit = () => {
      map.resize()
      const pad = { top: 56, right: 72, bottom: padBottom + 36, left: 72 }
      const target = selectedBranch ? branches[selectedBranch] : null
      if (target?.lat != null && target.lon != null) {
        map.easeTo({
          center: [target.lon, target.lat],
          zoom: Math.max(map.getZoom(), 11.5),
          padding: pad,
          duration: reducedMotion() ? 0 : 500,
        })
        return
      }
      const bounds = new maplibregl.LngLatBounds([home.lon, home.lat], [home.lon, home.lat])
      const live = new Set(dayEvents.map((e) => e.branch))
      for (const [name, info] of Object.entries(branches)) {
        if (info.lat == null || info.lon == null || !live.has(name)) continue
        bounds.extend([info.lon, info.lat])
      }
      map.fitBounds(bounds, { padding: pad, maxZoom: 12.2, duration: reducedMotion() ? 0 : 500 })
    }
    fit()
  }, [branches, dayEvents, selectedBranch, home, active, padBottom])

  return <div ref={root} className="map-root" />
}

/** Hide labels that would collide with a higher-priority label (earlier in the list). */
function declutter(map: maplibregl.Map, items: { el: HTMLElement; at: [number, number] }[]) {
  const placed: { l: number; r: number; t: number; b: number }[] = []
  for (const { el, at } of items) {
    const p = map.project(at)
    const w = el.textContent!.length * 7 + 8
    const box = { l: p.x - w / 2, r: p.x + w / 2, t: p.y + 14, b: p.y + 32 }
    const hit = placed.some((q) => box.l < q.r && box.r > q.l && box.t < q.b && box.b > q.t)
    el.classList.toggle('hide', hit)
    if (!hit) placed.push(box)
  }
}
