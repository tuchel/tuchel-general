import * as THREE from 'three'

/** Procedural textures, drawn on canvases so the page ships no image files. */

function tex(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void, srgb = true) {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  draw(cv.getContext('2d')!)
  const t = new THREE.CanvasTexture(cv)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// Seeded random so boards look the same every visit.
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

/** 2×2 twill carbon weave. */
export function carbon(repeat = 6) {
  const t = tex(256, 256, (c) => {
    const n = 8
    const s = 256 / n
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const horiz = (i + j) % 4 < 2
        const x = i * s
        const y = j * s
        const g = horiz ? c.createLinearGradient(x, y, x, y + s) : c.createLinearGradient(x, y, x + s, y)
        g.addColorStop(0, '#15171b')
        g.addColorStop(0.5, '#3b3f47')
        g.addColorStop(1, '#15171b')
        c.fillStyle = g
        c.fillRect(x, y, s, s)
        c.strokeStyle = 'rgba(255,255,255,0.05)'
        c.lineWidth = 1
        for (let k = 3; k < s; k += 4) {
          c.beginPath()
          if (horiz) {
            c.moveTo(x, y + k)
            c.lineTo(x + s, y + k)
          } else {
            c.moveTo(x + k, y)
            c.lineTo(x + k, y + s)
          }
          c.stroke()
        }
      }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  return t
}

export type BoardKind = 'fc' | 'esc' | 'rx'

/** A circuit board top: solder mask, copper traces, pads, vias and white silkscreen. */
export function pcb(kind: BoardKind) {
  const mask = kind === 'fc' ? '#16181f' : kind === 'esc' ? '#12306b' : '#0f5a36'
  const trace = kind === 'fc' ? '#262a35' : kind === 'esc' ? '#1d4591' : '#177a4a'
  const r = rng(kind === 'fc' ? 11 : kind === 'esc' ? 29 : 5)
  return tex(512, 512, (c) => {
    c.fillStyle = mask
    c.fillRect(0, 0, 512, 512)
    // traces: short orthogonal and 45° runs
    c.strokeStyle = trace
    c.lineCap = 'round'
    c.lineJoin = 'round'
    for (let k = 0; k < 70; k++) {
      c.lineWidth = 2 + Math.floor(r() * 3) * 2
      let x = 40 + r() * 432
      let y = 40 + r() * 432
      c.beginPath()
      c.moveTo(x, y)
      for (let s = 0; s < 4; s++) {
        const d = 20 + r() * 70
        const dir = Math.floor(r() * 8)
        const a = (dir * Math.PI) / 4
        x = Math.min(480, Math.max(32, x + Math.cos(a) * d))
        y = Math.min(480, Math.max(32, y + Math.sin(a) * d))
        c.lineTo(x, y)
      }
      c.stroke()
    }
    // vias
    for (let k = 0; k < 90; k++) {
      const x = 30 + r() * 452
      const y = 30 + r() * 452
      c.fillStyle = '#c9a24a'
      c.beginPath()
      c.arc(x, y, 3.2, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#0b0c0f'
      c.beginPath()
      c.arc(x, y, 1.4, 0, Math.PI * 2)
      c.fill()
    }
    // mounting holes on a 30.5 mm pattern (36 mm board)
    const off = 39
    for (const [x, y] of [
      [off, off],
      [512 - off, off],
      [off, 512 - off],
      [512 - off, 512 - off],
    ]) {
      c.fillStyle = '#d6ad55'
      c.beginPath()
      c.arc(x, y, 24, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#0b0c0f'
      c.beginPath()
      c.arc(x, y, 14, 0, Math.PI * 2)
      c.fill()
    }
    c.fillStyle = '#f4f4f0'
    c.strokeStyle = '#f4f4f0'
    c.font = 'bold 30px "JetBrains Mono Variable", monospace'
    c.textAlign = 'center'
    if (kind === 'fc') {
      // "front" arrow
      c.lineWidth = 6
      c.beginPath()
      c.moveTo(256, 70)
      c.lineTo(226, 110)
      c.moveTo(256, 70)
      c.lineTo(286, 110)
      c.moveTo(256, 70)
      c.lineTo(256, 150)
      c.stroke()
      c.font = 'bold 22px "JetBrains Mono Variable", monospace'
      c.fillText('FRONT', 256, 180)
      c.font = 'bold 28px "JetBrains Mono Variable", monospace'
      c.fillText('F7 FLIGHT CTRL', 256, 470)
      // pad rows
      c.fillStyle = '#d6ad55'
      for (let i = 0; i < 6; i++) c.fillRect(120 + i * 48, 430, 26, 14)
    } else if (kind === 'esc') {
      c.fillText('4-IN-1 ESC', 256, 250)
      c.font = 'bold 26px "JetBrains Mono Variable", monospace'
      c.fillText('M4', 90, 150)
      c.fillText('M2', 422, 150)
      c.fillText('M3', 90, 380)
      c.fillText('M1', 422, 380)
      c.fillText('+   −', 256, 495)
      // motor pads (3 per corner)
      c.fillStyle = '#d6ad55'
      for (const [cx, cy] of [
        [70, 70],
        [442, 70],
        [70, 442],
        [442, 442],
      ])
        for (let i = -1; i <= 1; i++) c.fillRect(cx - 12 + i * 21, cy - 12 - i * 21 * Math.sign(256 - cx) * Math.sign(256 - cy), 24, 24)
      c.fillRect(186, 440, 60, 40)
      c.fillRect(266, 440, 60, 40)
    } else {
      c.font = 'bold 60px "JetBrains Mono Variable", monospace'
      c.fillText('RX', 256, 290)
    }
    // component outlines
    c.lineWidth = 2
    c.strokeStyle = 'rgba(244,244,240,0.6)'
    for (let k = 0; k < 10; k++) {
      const w = 20 + r() * 40
      const h = 14 + r() * 30
      c.strokeRect(60 + r() * 380, 200 + r() * 180, w, h)
    }
  })
}

/** LiPo shrink-wrap graphic. */
export function batteryWrap() {
  return tex(1024, 512, (c) => {
    const g = c.createLinearGradient(0, 0, 1024, 512)
    g.addColorStop(0, '#1d2a52')
    g.addColorStop(1, '#3a1f5c')
    c.fillStyle = g
    c.fillRect(0, 0, 1024, 512)
    // diagonal racing stripes
    c.fillStyle = 'rgba(255,106,43,0.95)'
    c.beginPath()
    c.moveTo(620, 0)
    c.lineTo(700, 0)
    c.lineTo(520, 512)
    c.lineTo(440, 512)
    c.fill()
    c.fillStyle = 'rgba(255,197,61,0.95)'
    c.beginPath()
    c.moveTo(720, 0)
    c.lineTo(750, 0)
    c.lineTo(570, 512)
    c.lineTo(540, 512)
    c.fill()
    c.fillStyle = '#ffffff'
    c.font = 'bold 120px "Space Grotesk Variable", sans-serif'
    c.fillText('LiPo', 60, 220)
    c.font = '500 54px "JetBrains Mono Variable", monospace'
    c.fillStyle = 'rgba(255,255,255,0.85)'
    c.fillText('4S · 14.8V', 64, 310)
    // warning triangle
    c.strokeStyle = '#ffc53d'
    c.lineWidth = 10
    c.beginPath()
    c.moveTo(900, 330)
    c.lineTo(960, 440)
    c.lineTo(840, 440)
    c.closePath()
    c.stroke()
    c.fillStyle = '#ffc53d'
    c.fillRect(895, 365, 10, 45)
    c.fillRect(895, 420, 10, 10)
  })
}

/** Woven nylon strap. */
export function strap() {
  const t = tex(64, 64, (c) => {
    c.fillStyle = '#17181c'
    c.fillRect(0, 0, 64, 64)
    c.strokeStyle = '#2a2c33'
    c.lineWidth = 2
    for (let i = 0; i < 64; i += 4) {
      c.beginPath()
      c.moveTo(i, 0)
      c.lineTo(i, 64)
      c.stroke()
    }
    c.fillStyle = '#ff6a2b'
    c.fillRect(0, 28, 64, 8)
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Soft radial smear for a spinning propeller disc. */
export function propBlur() {
  return tex(256, 256, (c) => {
    const g = c.createRadialGradient(128, 128, 12, 128, 128, 128)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.2, 'rgba(255,255,255,0.55)')
    g.addColorStop(0.85, 'rgba(255,255,255,0.35)')
    g.addColorStop(0.97, 'rgba(255,255,255,0.8)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = g
    c.fillRect(0, 0, 256, 256)
  })
}

/** Grippy rubber battery pad. */
export function grip() {
  const t = tex(64, 64, (c) => {
    c.fillStyle = '#1f2228'
    c.fillRect(0, 0, 64, 64)
    c.fillStyle = '#2d3139'
    for (let i = 0; i < 64; i += 8) for (let j = 0; j < 64; j += 8) c.fillRect(i + 2, j + 2, 4, 4)
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(6, 10)
  return t
}
