import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as T from './textures'

/**
 * Detailed drone hardware, modelled from a typical 5-inch freestyle build.
 * One scene unit is about 100 mm. Front is −z, up is +y, the ground is y = 0.
 */

export type Spin = 1 | -1

export const ARM = 0.8
export const ARM_BOT = 0.055
export const ARM_TOP = 0.11
export const ESC_Y = 0.14
export const FC_Y = 0.228
export const TOP_Y = 0.31
export const BAT_Y = TOP_Y + 0.026
export const PROP_Y = ARM_TOP + 0.165
export const PROP_R = 0.62
export const PAD = 0.1525 // half of the 30.5 mm stack pattern

export const MOTORS: { key: string; name: string; x: number; z: number; spin: Spin }[] = [
  { key: 'fl', name: 'Front-left', x: -ARM, z: -ARM, spin: 1 },
  { key: 'fr', name: 'Front-right', x: ARM, z: -ARM, spin: -1 },
  { key: 'bl', name: 'Back-left', x: -ARM, z: ARM, spin: -1 },
  { key: 'br', name: 'Back-right', x: ARM, z: ARM, spin: 1 },
]

export const CW_COLOR = 0xff6a2b
export const CCW_COLOR = 0x2a9df4
export const spinColor = (s: Spin) => (s === 1 ? CW_COLOR : CCW_COLOR)

// ---------------------------------------------------------------- helpers
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
export function mtx(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz))
}

/** Collects many small pieces and merges them into one mesh per material. */
class Kit {
  readonly group = new THREE.Group()
  private buckets = new Map<THREE.Material, THREE.BufferGeometry[]>()
  add(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k)
    if (!g.attributes.normal) g.computeVertexNormals()
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
    if (m) g.applyMatrix4(m)
    const list = this.buckets.get(mat) ?? []
    list.push(g)
    this.buckets.set(mat, list)
    return this
  }
  done() {
    for (const [mat, list] of this.buckets) {
      const mesh = new THREE.Mesh(mergeGeometries(list), mat)
      mesh.castShadow = true
      mesh.receiveShadow = true
      this.group.add(mesh)
    }
    this.buckets.clear()
    return this.group
  }
}

function solo(geo: THREE.BufferGeometry, mat: THREE.Material, m?: THREE.Matrix4) {
  const mesh = new THREE.Mesh(geo, mat)
  if (m) m.decompose(mesh.position, mesh.quaternion, mesh.scale)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

const lathe = (pts: [number, number][], seg = 48) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg)
const rbox = (w: number, h: number, d: number, r = 0.006, s = 2) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4))
const cyl = (r: number, h: number, seg = 24, r2 = r) => new THREE.CylinderGeometry(r, r2, h, seg)

function wire(points: THREE.Vector3[], r: number, seg = 40) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), seg, r, 8, false)
}

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  return s
}
function circle(cx: number, cy: number, r: number) {
  const p = new THREE.Path()
  p.absarc(cx, cy, r, 0, Math.PI * 2, true)
  return p
}
function slot(x0: number, x1: number, y: number, r: number) {
  const p = new THREE.Path()
  p.moveTo(x0, y - r)
  p.absarc(x0, y, r, -Math.PI / 2, -Math.PI * 1.5, true)
  p.lineTo(x1, y + r)
  p.absarc(x1, y, r, Math.PI / 2, -Math.PI / 2, true)
  p.closePath()
  return p
}
/** Flat plate from a 2D shape, lying in the XZ plane, from y = 0 up to y = depth. */
function plate(shape: THREE.Shape, depth: number, bevel = 0.004) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 28,
  })
  g.translate(0, 0, bevel)
  g.rotateX(-Math.PI / 2)
  return g
}
/** Ring sector (a slice of a tube wall), standing from y = 0 to y = h. */
function sector(r0: number, r1: number, a0: number, a1: number, h: number) {
  const s = new THREE.Shape()
  s.absarc(0, 0, r1, a0, a1, false)
  s.lineTo(Math.cos(a1) * r0, Math.sin(a1) * r0)
  s.absarc(0, 0, r0, a1, a0, true)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 12 })
  g.rotateX(-Math.PI / 2)
  return g
}

// ---------------------------------------------------------------- materials
const phys = (p: THREE.MeshPhysicalMaterialParameters) => new THREE.MeshPhysicalMaterial(p)
const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p)
export const M = {
  carbon: (rep = 6) => phys({ map: T.carbon(rep), roughness: 0.36, metalness: 0.2, clearcoat: 0.9, clearcoatRoughness: 0.16 }),
  anodized: (c: number) => phys({ color: c, metalness: 0.9, roughness: 0.28, clearcoat: 0.5, clearcoatRoughness: 0.25 }),
  steel: () => std({ color: 0xd6dbe2, metalness: 1, roughness: 0.2 }),
  gunmetal: () => std({ color: 0x3a404c, metalness: 0.85, roughness: 0.34 }),
  lamination: () => std({ color: 0x8d949f, metalness: 0.9, roughness: 0.42 }),
  copper: () => std({ color: 0xc8793c, metalness: 1, roughness: 0.3, emissive: 0xff7a1a, emissiveIntensity: 0 }),
  gold: () => std({ color: 0xd9ae55, metalness: 1, roughness: 0.28 }),
  solder: () => std({ color: 0xc9ccd2, metalness: 1, roughness: 0.25 }),
  chip: () => std({ color: 0x15171c, roughness: 0.45, metalness: 0.25 }),
  ceramic: () => std({ color: 0xb89a6a, roughness: 0.6 }),
  rubber: (c = 0x23262d) => std({ color: c, roughness: 0.92 }),
  plastic: (c: number, rough = 0.42) => phys({ color: c, roughness: rough, clearcoat: 0.35, clearcoatRoughness: 0.4 }),
  silicone: (c: number) => std({ color: c, roughness: 0.5 }),
  mask: (c: number) => std({ color: c, roughness: 0.45, metalness: 0.1 }),
  board: (kind: T.BoardKind) => std({ map: T.pcb(kind), roughness: 0.4, metalness: 0.15 }),
  led: (c: number) => std({ color: c, emissive: c, emissiveIntensity: 2.4, roughness: 0.3 }),
  glass: () =>
    phys({
      color: 0x0a1426,
      metalness: 0.2,
      roughness: 0.03,
      clearcoat: 1,
      clearcoatRoughness: 0,
      iridescence: 1,
      iridescenceIOR: 1.8,
      iridescenceThicknessRange: [250, 650],
    }),
}

// ---------------------------------------------------------------- frame
export function buildFrame() {
  const kit = new Kit()
  const carbon = M.carbon(5)
  const plateCarbon = M.carbon(4)
  const alu = M.anodized(0x7c5cff)
  const steel = M.steel()
  const socket = M.chip()
  const tpu = M.rubber(0x2c3038)

  // Arms: one piece each, flaring into a round motor pad with a 16×16 mm bolt pattern.
  const L = Math.hypot(ARM, ARM)
  const arm = new THREE.Shape()
  arm.moveTo(0.06, -0.1)
  arm.lineTo(0.72, -0.066)
  arm.quadraticCurveTo(L - 0.2, -0.066, L - 0.1, -0.13)
  arm.absarc(L, 0, 0.165, -2.25, 2.25, false)
  arm.quadraticCurveTo(L - 0.2, 0.066, 0.72, 0.066)
  arm.lineTo(0.06, 0.1)
  arm.closePath()
  arm.holes.push(circle(L, 0, 0.034))
  for (const [dx, dy] of [
    [0.08, 0.08],
    [-0.08, 0.08],
    [0.08, -0.08],
    [-0.08, -0.08],
  ])
    arm.holes.push(circle(L + dx, dy, 0.016))
  arm.holes.push(slot(0.36, 0.64, 0, 0.026))
  const armGeo = plate(arm, ARM_TOP - ARM_BOT, 0.005)
  for (const m of MOTORS) kit.add(armGeo, carbon, mtx(0, ARM_BOT, 0, 0, Math.atan2(-m.z, m.x), 0))

  // Bottom and top plates
  const bottom = roundedRect(0.46, 0.92, 0.07)
  for (const [x, z] of [
    [PAD, PAD],
    [-PAD, PAD],
    [PAD, -PAD],
    [-PAD, -PAD],
  ])
    bottom.holes.push(circle(x, z, 0.017))
  kit.add(plate(bottom, 0.022, 0.003), plateCarbon, mtx(0, ARM_BOT - 0.022))

  const top = roundedRect(0.4, 0.86, 0.08)
  top.holes.push(slot(-0.1, 0.1, -0.16, 0.022))
  top.holes.push(slot(-0.1, 0.1, 0.2, 0.022))
  top.holes.push(slot(-0.06, 0.06, 0.02, 0.03))
  kit.add(plate(top, 0.02, 0.003), plateCarbon, mtx(0, TOP_Y))

  // Hex standoffs and socket-head screws
  const standH = TOP_Y - ARM_TOP
  for (const [x, z] of [
    [0.16, 0.36],
    [-0.16, 0.36],
    [0.16, -0.24],
    [-0.16, -0.24],
  ]) {
    kit.add(cyl(0.026, standH, 6), alu, mtx(x, ARM_TOP + standH / 2, z, 0, Math.PI / 6))
    kit.add(cyl(0.02, 0.012, 20), steel, mtx(x, TOP_Y + 0.026, z))
    kit.add(cyl(0.008, 0.004, 6), socket, mtx(x, TOP_Y + 0.031, z))
  }

  // Camera side plates with a pivot bolt
  const side = new THREE.Shape()
  side.moveTo(0.28, ARM_TOP)
  side.lineTo(0.5, ARM_TOP)
  side.quadraticCurveTo(0.58, ARM_TOP, 0.58, 0.19)
  side.quadraticCurveTo(0.58, TOP_Y - 0.01, 0.48, TOP_Y - 0.01)
  side.lineTo(0.28, TOP_Y - 0.01)
  side.closePath()
  side.holes.push(circle(0.43, 0.215, 0.012))
  side.holes.push(slot(0.33, 0.37, 0.16, 0.018))
  const sideGeo = new THREE.ExtrudeGeometry(side, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 16 })
  sideGeo.rotateY(Math.PI / 2)
  for (const s of [-1, 1]) kit.add(sideGeo, plateCarbon, mtx(s > 0 ? 0.105 : -0.123, 0, 0))

  // Soft TPU feet under each motor pad
  for (const m of MOTORS) kit.add(rbox(0.1, 0.05, 0.1, 0.02, 3), tpu, mtx(m.x * 0.92, 0.028, m.z * 0.92, 0, Math.PI / 4))

  const group = kit.done()

  // LEDs under the arms: green at the front, red at the back.
  const leds: THREE.Mesh[] = []
  for (const m of MOTORS) {
    const front = m.z < 0
    const led = solo(rbox(0.09, 0.012, 0.03, 0.005), M.led(front ? 0x3dff7a : 0xff3355), mtx(m.x * 0.7, ARM_BOT - 0.004, m.z * 0.7, 0, Math.atan2(-m.z, m.x)))
    led.castShadow = false
    group.add(led)
    leds.push(led)
  }
  return { group, leds }
}

// ---------------------------------------------------------------- motor
/** A 2207-size brushless motor. Origin is the centre of the mount surface. */
export function buildMotor(spin: Spin) {
  const kit = new Kit()
  const base = M.gunmetal()
  const lam = M.lamination()
  const steel = M.steel()
  kit.add(lathe([[0.018, 0], [0.126, 0], [0.134, 0.006], [0.134, 0.028], [0.124, 0.036], [0.07, 0.036], [0.066, 0.042], [0.018, 0.042]]), base)
  // stator core
  kit.add(lathe([[0.03, 0.042], [0.062, 0.042], [0.062, 0.118], [0.03, 0.118]]), lam)
  kit.add(cyl(0.016, 0.21, 16), steel, mtx(0, 0.135))
  const group = kit.done()

  // 12 copper windings on three phases
  const phases = [M.copper(), M.copper(), M.copper()]
  const coilGeo = rbox(0.034, 0.064, 0.05, 0.012, 3)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    const c = solo(coilGeo, phases[i % 3], mtx(Math.cos(a) * 0.084, 0.08, Math.sin(a) * 0.084, 0, Math.PI / 2 - a))
    group.add(c)
  }

  // The bell spins: bottom ring, six pillars with windows, cap, magnets inside.
  const bell = new THREE.Group()
  const bellKit = new Kit()
  const ano = M.anodized(spinColor(spin))
  const mag = M.gunmetal()
  const white = M.plastic(0xffffff, 0.3)
  bellKit.add(lathe([[0.126, 0.04], [0.143, 0.04], [0.143, 0.064], [0.126, 0.064], [0.126, 0.04]]), ano)
  for (let i = 0; i < 6; i++) {
    const a0 = (i / 6) * Math.PI * 2 - 0.25
    bellKit.add(sector(0.126, 0.143, a0, a0 + 0.5, 0.07), ano, mtx(0, 0.064))
  }
  bellKit.add(lathe([[0.02, 0.134], [0.143, 0.134], [0.143, 0.146], [0.134, 0.158], [0.07, 0.162], [0.036, 0.168], [0.02, 0.168]]), ano)
  bellKit.add(new THREE.TorusGeometry(0.1, 0.004, 8, 48), mag, mtx(0, 0.161, 0, Math.PI / 2))
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    bellKit.add(rbox(0.026, 0.062, 0.008, 0.003), mag, mtx(Math.cos(a) * 0.121, 0.1, Math.sin(a) * 0.121, 0, Math.PI / 2 - a))
  }
  // white marker on one pillar, so you can see which way it turns
  bellKit.add(rbox(0.03, 0.05, 0.008, 0.003), white, mtx(0.146, 0.1, 0, 0, Math.PI / 2))
  bell.add(bellKit.done())
  group.add(bell)
  return { group, bell, phases, bellMat: ano }
}

// ---------------------------------------------------------------- propeller
/** One twisted, swept blade of a 5-inch tri-blade prop, for a clockwise prop. */
function bladeGeometry() {
  const S = 26
  const N = 16
  const r0 = 0.045
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= S; i++) {
    const s = i / S
    const r = r0 + s * (PROP_R - r0)
    let chord = 0.055 + 0.07 * Math.sin(Math.PI * (0.12 + s * 0.8))
    if (s > 0.85) chord *= Math.sqrt(Math.max(0.02, 1 - ((s - 0.85) / 0.15) ** 2))
    const twist = THREE.MathUtils.degToRad(32 - 22 * s)
    const thick = 0.014 * (1 - s) + 0.003
    const sweep = -0.05 * s * s
    for (let j = 0; j < N; j++) {
      const a = (j / N) * Math.PI * 2
      const u = 0.5 * Math.cos(a)
      let v = (thick / 2) * Math.sin(a) * (1 + 0.35 * Math.cos(a))
      v += 0.035 * chord * (1 - 4 * u * u)
      const z = u * chord + sweep
      const y = v
      // leading edge (+z) raised by the twist
      pos.push(r, y * Math.cos(twist) + z * Math.sin(twist), -y * Math.sin(twist) + z * Math.cos(twist))
    }
  }
  for (let i = 0; i < S; i++)
    for (let j = 0; j < N; j++) {
      const a = i * N + j
      const b = i * N + ((j + 1) % N)
      const c = (i + 1) * N + j
      const d = (i + 1) * N + ((j + 1) % N)
      idx.push(a, c, b, b, c, d)
    }
  // tip cap
  const tip = pos.length / 3
  const last = S * N
  let cx = 0
  let cy = 0
  let cz = 0
  for (let j = 0; j < N; j++) {
    cx += pos[(last + j) * 3]
    cy += pos[(last + j) * 3 + 1]
    cz += pos[(last + j) * 3 + 2]
  }
  pos.push(cx / N + 0.004, cy / N, cz / N)
  for (let j = 0; j < N; j++) idx.push(last + j, tip, last + ((j + 1) % N))
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}
const BLADE_CW = bladeGeometry()
const BLADE_CCW = (() => {
  const g = BLADE_CW.clone()
  g.scale(1, 1, -1)
  const ix = g.index!.array as Uint16Array | Uint32Array
  for (let i = 0; i < ix.length; i += 3) {
    const t = ix[i + 1]
    ix[i + 1] = ix[i + 2]
    ix[i + 2] = t
  }
  g.computeVertexNormals()
  return g
})()

/** Prop on its nut. Blades hang off pivots so their tilt can change. Origin at the hub bottom. */
export function buildProp(spin: Spin) {
  const group = new THREE.Group()
  const mat = phys({ color: spinColor(spin), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  group.add(solo(lathe([[0.017, 0], [0.058, 0], [0.062, 0.01], [0.062, 0.046], [0.054, 0.056], [0.03, 0.06], [0.017, 0.06]]), mat))
  const pivots: THREE.Group[] = []
  for (let k = 0; k < 3; k++) {
    const holder = new THREE.Group()
    holder.rotation.y = (k / 3) * Math.PI * 2
    holder.position.y = 0.03
    const pivot = new THREE.Group()
    pivot.add(solo(spin === 1 ? BLADE_CW : BLADE_CCW, mat))
    holder.add(pivot)
    group.add(holder)
    pivots.push(pivot)
  }
  const kit = new Kit()
  kit.add(cyl(0.034, 0.03, 6), M.steel(), mtx(0, 0.075, 0, 0, Math.PI / 6))
  kit.add(new THREE.TorusGeometry(0.024, 0.008, 8, 24), M.plastic(0x1d4ed8), mtx(0, 0.093, 0, Math.PI / 2))
  group.add(kit.done())
  return { group, pivots, mat }
}

// ---------------------------------------------------------------- 4-in-1 ESC
export function buildESC() {
  const kit = new Kit()
  const mask = M.mask(0x12306b)
  const chip = M.chip()
  const gold = M.gold()
  const solder = M.solder()
  const ceramic = M.ceramic()
  const steel = M.steel()
  const grommet = M.rubber(0x6d4bd8)
  const y0 = ESC_Y
  const top = y0 + 0.016
  kit.add(rbox(0.36, 0.016, 0.36, 0.006), mask, mtx(0, y0 + 0.008))
  // MOSFETs: two per motor, with their legs
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      for (const k of [0, 1]) {
        const x = sx * 0.1
        const z = sz * (0.035 + k * 0.058)
        kit.add(rbox(0.046, 0.012, 0.04, 0.003), chip, mtx(x, top + 0.006, z))
        for (let l = 0; l < 3; l++) kit.add(new THREE.BoxGeometry(0.006, 0.003, 0.012), gold, mtx(x - sx * 0.028, top + 0.0015, z - 0.012 + l * 0.012))
      }
  // one small controller chip per motor
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.add(rbox(0.03, 0.007, 0.03, 0.002), chip, mtx(sx * 0.035, top + 0.0035, sz * 0.1))
  // tiny ceramic capacitors
  let seed = 3
  const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  for (let i = 0; i < 26; i++) kit.add(new THREE.BoxGeometry(0.012, 0.007, 0.007), ceramic, mtx(-0.14 + r() * 0.28, top + 0.0035, -0.14 + r() * 0.28, 0, r() > 0.5 ? Math.PI / 2 : 0))
  // solder blobs on the motor pads
  for (const m of MOTORS) {
    const sx = Math.sign(m.x)
    const sz = Math.sign(m.z)
    for (let i = -1; i <= 1; i++) {
      const g = new THREE.SphereGeometry(0.011, 12, 8)
      kit.add(g, solder, mtx(sx * 0.131 + i * 0.0148, top + 0.002, sz * 0.131 - i * 0.0148 * sx * sz, 0, 0, 0, 1, 0.45, 1))
    }
  }
  // battery pads and the thick power leads to the XT60 socket
  for (const [x, c] of [
    [0.04, 0xd92d2d],
    [-0.04, 0x1d1f24],
  ] as const) {
    kit.add(new THREE.SphereGeometry(0.02, 14, 10), solder, mtx(x, top + 0.004, 0.145, 0, 0, 0, 1, 0.45, 1))
    kit.add(
      wire([V(x, top + 0.01, 0.14), V(x, top + 0.03, 0.22), V(x * 0.9, 0.2, 0.36), V(x * 0.6, 0.17, 0.5), V(x * 0.5, 0.17, 0.58)], 0.016),
      M.silicone(c),
    )
  }
  // electrolytic capacitor on the power leads
  kit.add(cyl(0.042, 0.15, 32), M.plastic(0x1b1d26, 0.35), mtx(0, 0.2, 0.3, 0, 0, Math.PI / 2))
  kit.add(cyl(0.0425, 0.03, 32), M.plastic(0x6b7280, 0.35), mtx(0.035, 0.2, 0.3, 0, 0, Math.PI / 2))
  kit.add(cyl(0.036, 0.004, 32), steel, mtx(-0.076, 0.2, 0.3, 0, 0, Math.PI / 2))
  // XT60 socket (yellow)
  kit.add(rbox(0.1, 0.07, 0.09, 0.012, 3), M.plastic(0xffc524, 0.5), mtx(0, 0.17, 0.62))
  for (const x of [-0.022, 0.022]) {
    kit.add(cyl(0.013, 0.004, 20), gold, mtx(x, 0.17, 0.666, Math.PI / 2))
    kit.add(cyl(0.007, 0.005, 16), chip, mtx(x, 0.17, 0.668, Math.PI / 2))
  }
  // stack posts and rubber grommets
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      kit.add(cyl(0.013, FC_Y + 0.05 - ARM_BOT, 16), steel, mtx(sx * PAD, (FC_Y + 0.05 + ARM_BOT) / 2, sz * PAD))
      kit.add(new THREE.TorusGeometry(0.022, 0.009, 10, 24), grommet, mtx(sx * PAD, top + 0.006, sz * PAD, Math.PI / 2))
      kit.add(new THREE.TorusGeometry(0.022, 0.009, 10, 24), grommet, mtx(sx * PAD, y0 - 0.006, sz * PAD, Math.PI / 2))
    }
  kit.add(new THREE.PlaneGeometry(0.356, 0.356), M.board('esc'), mtx(0, top + 0.0006, 0, -Math.PI / 2))
  const group = kit.done()
  // tiny status LEDs, one per motor
  const leds: THREE.Mesh[] = []
  for (const m of MOTORS) {
    const led = solo(new THREE.BoxGeometry(0.01, 0.005, 0.006), M.led(0x3dff7a), mtx(Math.sign(m.x) * 0.06, top + 0.003, Math.sign(m.z) * 0.06))
    group.add(led)
    leds.push(led)
  }
  return { group, leds }
}

// ---------------------------------------------------------------- flight controller
export function buildFC() {
  const kit = new Kit()
  const mask = M.mask(0x16181f)
  const chip = M.chip()
  const pin = M.solder()
  const steel = M.steel()
  const whitePlastic = M.plastic(0xf2efe6, 0.55)
  const nut = M.anodized(0x7c5cff)
  const grommet = M.rubber(0x6d4bd8)
  const y0 = FC_Y
  const top = y0 + 0.016
  kit.add(rbox(0.36, 0.016, 0.36, 0.006), mask, mtx(0, y0 + 0.008))
  // main processor with pins on all four sides
  kit.add(rbox(0.1, 0.014, 0.1, 0.003), chip, mtx(0.03, top + 0.007, 0.03))
  for (let i = 0; i < 12; i++) {
    const o = -0.042 + i * (0.084 / 11)
    kit.add(new THREE.BoxGeometry(0.003, 0.003, 0.012), pin, mtx(0.03 + o, top + 0.0015, 0.03 + 0.056))
    kit.add(new THREE.BoxGeometry(0.003, 0.003, 0.012), pin, mtx(0.03 + o, top + 0.0015, 0.03 - 0.056))
    kit.add(new THREE.BoxGeometry(0.012, 0.003, 0.003), pin, mtx(0.03 + 0.056, top + 0.0015, 0.03 + o))
    kit.add(new THREE.BoxGeometry(0.012, 0.003, 0.003), pin, mtx(0.03 - 0.056, top + 0.0015, 0.03 + o))
  }
  kit.add(new THREE.CircleGeometry(0.006, 16), M.plastic(0x3a3f4a), mtx(0.0, top + 0.0145, 0.0, -Math.PI / 2))
  // gyro (the motion sensor)
  kit.add(rbox(0.036, 0.01, 0.036, 0.003), chip, mtx(-0.08, top + 0.005, -0.07))
  // barometer, boot button, USB-C port
  kit.add(rbox(0.03, 0.012, 0.03, 0.004), steel, mtx(0.1, top + 0.006, -0.1))
  kit.add(cyl(0.004, 0.002, 12), chip, mtx(0.1, top + 0.0125, -0.1))
  kit.add(rbox(0.022, 0.01, 0.016, 0.003), whitePlastic, mtx(-0.05, top + 0.005, 0.12))
  kit.add(rbox(0.03, 0.024, 0.062, 0.01, 3), steel, mtx(0.172, top + 0.012, -0.02))
  kit.add(rbox(0.004, 0.012, 0.044, 0.002), chip, mtx(0.188, top + 0.012, -0.02))
  // white JST sockets on the edges
  for (const [x, z, ry] of [
    [0, 0.155, 0],
    [-0.155, 0.02, Math.PI / 2],
    [-0.12, -0.155, 0],
  ] as const) {
    kit.add(rbox(0.075, 0.03, 0.026, 0.003), whitePlastic, mtx(x, top + 0.015, z, 0, ry))
    kit.add(new THREE.BoxGeometry(0.06, 0.004, 0.012), chip, mtx(x, top + 0.0305, z, 0, ry))
  }
  // ceramic capacitors
  let seed = 9
  const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  for (let i = 0; i < 22; i++) kit.add(new THREE.BoxGeometry(0.01, 0.006, 0.006), M.ceramic(), mtx(-0.13 + r() * 0.26, top + 0.003, -0.02 + r() * 0.12, 0, r() > 0.5 ? Math.PI / 2 : 0))
  // grommets under, anodized nuts on top of the stack posts
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      kit.add(new THREE.TorusGeometry(0.022, 0.009, 10, 24), grommet, mtx(sx * PAD, y0 - 0.006, sz * PAD, Math.PI / 2))
      kit.add(cyl(0.026, 0.016, 6), nut, mtx(sx * PAD, top + 0.008, sz * PAD, 0, Math.PI / 6))
    }
  kit.add(new THREE.PlaneGeometry(0.356, 0.356), M.board('fc'), mtx(0, top + 0.0006, 0, -Math.PI / 2))
  const group = kit.done()
  const leds = [
    solo(new THREE.BoxGeometry(0.012, 0.005, 0.008), M.led(0x3d8bff), mtx(0.13, top + 0.003, 0.1)),
    solo(new THREE.BoxGeometry(0.012, 0.005, 0.008), M.led(0xff3355), mtx(0.13, top + 0.003, 0.12)),
  ]
  leds.forEach((l) => group.add(l))

  // XYZ arrows that show what the gyro feels (hidden until needed)
  const gizmo = new THREE.Group()
  gizmo.position.set(-0.08, top + 0.012, -0.07)
  for (const [dir, c] of [
    [V(1, 0, 0), 0xff4d4d],
    [V(0, 1, 0), 0x3ddc84],
    [V(0, 0, -1), 0x3d8bff],
  ] as const) {
    const a = new THREE.Group()
    const m = new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true })
    const shaft = new THREE.Mesh(cyl(0.006, 0.26, 10), m)
    shaft.position.y = 0.13
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 16), m)
    head.position.y = 0.28
    a.add(shaft, head)
    a.quaternion.setFromUnitVectors(V(0, 1, 0), dir)
    a.renderOrder = 10
    shaft.renderOrder = head.renderOrder = 10
    gizmo.add(a)
  }
  gizmo.visible = false
  group.add(gizmo)
  return { group, leds, gizmo, cpu: V(0.03, top + 0.014, 0.03) }
}

// ---------------------------------------------------------------- receiver
export function buildReceiver() {
  const kit = new Kit()
  const at = V(0.06, 0.27, 0.28)
  kit.add(rbox(0.1, 0.012, 0.1, 0.004), M.mask(0x0f5a36), mtx(at.x, at.y, at.z))
  kit.add(new THREE.PlaneGeometry(0.096, 0.096), M.board('rx'), mtx(at.x, at.y + 0.0066, at.z, -Math.PI / 2))
  kit.add(rbox(0.036, 0.008, 0.036, 0.002), M.chip(), mtx(at.x - 0.015, at.y + 0.01, at.z + 0.01))
  // antenna mount and dipole whips, up and back
  const mountY = TOP_Y + 0.045
  kit.add(rbox(0.13, 0.05, 0.07, 0.014, 3), M.plastic(0xff6a2b, 0.7), mtx(0, mountY, 0.44))
  const blackTube = M.plastic(0x1a1c22, 0.6)
  const tipMat = M.plastic(0xffffff, 0.4)
  for (const s of [-1, 1]) {
    const dir = V(s * 0.45, 0.85, 0.5).normalize()
    const base = V(s * 0.035, mountY + 0.02, 0.45)
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir)
    const len = 0.34
    const mid = base.clone().addScaledVector(dir, len / 2)
    const m1 = new THREE.Matrix4().compose(mid, q, V(1, 1, 1))
    kit.add(cyl(0.011, len, 14), blackTube, m1)
    const tip = base.clone().addScaledVector(dir, len + 0.03)
    kit.add(new THREE.CapsuleGeometry(0.014, 0.05, 4, 12), tipMat, new THREE.Matrix4().compose(tip, q, V(1, 1, 1)))
  }
  // coax lead from the receiver to the mount, and four wires to the flight controller
  kit.add(wire([V(0.03, at.y + 0.01, at.z + 0.05), V(0.05, 0.26, 0.36), V(0.02, mountY - 0.02, 0.43)], 0.006), blackTube)
  const cols = [0xe23b3b, 0x1b1d22, 0xffd23f, 0xffffff]
  cols.forEach((c, i) => {
    const x = -0.03 + i * 0.012
    kit.add(wire([V(x, at.y + 0.005, at.z - 0.05), V(x, FC_Y + 0.03, 0.21), V(x * 0.8, FC_Y + 0.045, 0.165)], 0.0035, 24), M.silicone(c))
  })
  const group = kit.done()
  // heat-shrink wrap you can see through
  const shrink = solo(rbox(0.114, 0.03, 0.114, 0.012, 3), phys({ color: 0xbfe3ff, transparent: true, opacity: 0.35, roughness: 0.12, clearcoat: 1, depthWrite: false }), mtx(at.x, at.y, at.z))
  shrink.castShadow = false
  group.add(shrink)
  const led = solo(new THREE.BoxGeometry(0.012, 0.006, 0.01), M.led(0x3dff7a), mtx(at.x + 0.03, at.y + 0.009, at.z - 0.025))
  group.add(led)
  const antennaTip = V(0, mountY + 0.3, 0.62)
  return { group, led, at: at.clone(), antennaTip }
}

// ---------------------------------------------------------------- FPV camera
export function buildCamera() {
  const group = new THREE.Group()
  const pivot = new THREE.Group()
  pivot.position.set(0, 0.215, -0.43)
  pivot.rotation.x = 0.38
  group.add(pivot)
  const kit = new Kit()
  const body = M.gunmetal()
  const black = M.chip()
  kit.add(rbox(0.19, 0.19, 0.15, 0.028, 4), body)
  kit.add(rbox(0.2, 0.2, 0.02, 0.02, 3), black, mtx(0, 0, -0.078))
  // lens barrel with thread rings
  const barrel = lathe(
    [
      [0.072, 0],
      [0.072, 0.012],
      [0.063, 0.016],
      [0.063, 0.028],
      [0.067, 0.032],
      [0.063, 0.036],
      [0.063, 0.046],
      [0.067, 0.05],
      [0.063, 0.054],
      [0.059, 0.07],
      [0.059, 0.088],
      [0.052, 0.098],
      [0.034, 0.1],
    ],
    40,
  )
  barrel.rotateX(-Math.PI / 2)
  kit.add(barrel, black, mtx(0, 0, -0.086))
  kit.add(new THREE.TorusGeometry(0.056, 0.004, 8, 40), M.anodized(0xff6a2b), mtx(0, 0, -0.176))
  // side bolts into the frame plates
  for (const s of [-1, 1]) {
    kit.add(cyl(0.016, 0.01, 20), M.steel(), mtx(s * 0.132, 0, 0, 0, 0, Math.PI / 2))
    kit.add(cyl(0.006, 0.012, 6), black, mtx(s * 0.136, 0, 0, 0, 0, Math.PI / 2))
  }
  // rear board and plug
  kit.add(rbox(0.16, 0.16, 0.012, 0.01), M.mask(0x12306b), mtx(0, 0, 0.081))
  kit.add(rbox(0.06, 0.025, 0.02, 0.004), M.plastic(0xf2efe6, 0.55), mtx(0, -0.04, 0.095))
  pivot.add(kit.done())
  const glass = solo(new THREE.SphereGeometry(0.05, 40, 20, 0, Math.PI * 2, 0, 0.8), M.glass())
  glass.rotation.x = -Math.PI / 2
  glass.position.z = -0.172
  glass.scale.set(1, 0.55, 1)
  pivot.add(glass)
  // camera cable to the flight controller
  const cable = new Kit()
  ;[0xffd23f, 0xe23b3b, 0x1b1d22].forEach((c, i) => {
    const x = -0.012 + i * 0.012
    cable.add(wire([V(x, 0.18, -0.34), V(x, 0.2, -0.26), V(x - 0.1, FC_Y + 0.035, -0.19), V(-0.12, FC_Y + 0.03, -0.155)], 0.0035, 24), M.silicone(c))
  })
  group.add(cable.done())
  // where the picture is taken from
  const eye = new THREE.Object3D()
  eye.position.z = -0.19
  pivot.add(eye)
  return { group, eye, pivot }
}

// ---------------------------------------------------------------- battery
export function buildBattery() {
  const kit = new Kit()
  const w = 0.3
  const h = 0.25
  const len = 0.66
  const zc = 0.03
  const yc = BAT_Y + 0.006 + h / 2
  const top = yc + h / 2
  kit.add(new THREE.BoxGeometry(0.3, 0.006, 0.6), std({ map: T.grip(), roughness: 0.95 }), mtx(0, BAT_Y + 0.003, zc))
  const wrap = phys({ color: 0x1d2a52, roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2, emissive: 0xffb03a, emissiveIntensity: 0 })
  kit.add(rbox(w, h, len, 0.04, 4), wrap, mtx(0, yc, zc))
  const label = phys({ map: T.batteryWrap(), roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2, emissive: 0xffb03a, emissiveIntensity: 0 })
  const lt = new THREE.PlaneGeometry(0.6, 0.26)
  kit.add(lt, label, mtx(0, top + 0.0008, zc, -Math.PI / 2, 0, 0).multiply(mtx(0, 0, 0, 0, 0, Math.PI / 2)))
  const ls = new THREE.PlaneGeometry(0.58, 0.19)
  kit.add(ls, label, mtx(w / 2 + 0.0008, yc, zc, 0, Math.PI / 2))
  kit.add(ls, label, mtx(-w / 2 - 0.0008, yc, zc, 0, -Math.PI / 2))
  // foam end pad where the leads come out
  kit.add(rbox(w - 0.01, h - 0.02, 0.02, 0.008), M.rubber(0x2a2d34), mtx(0, yc, zc + len / 2 + 0.006))
  // main leads to the XT60 plug
  for (const [x, c] of [
    [0.05, 0xd92d2d],
    [-0.05, 0x1d1f24],
  ] as const)
    kit.add(wire([V(x, yc + 0.05, zc + len / 2), V(x * 1.2, yc + 0.07, 0.48), V(x, 0.3, 0.8), V(x * 0.5, 0.17, 0.79)], 0.016), M.silicone(c))
  kit.add(rbox(0.1, 0.07, 0.09, 0.012, 3), M.plastic(0xffc524, 0.5), mtx(0, 0.17, 0.72))
  kit.add(rbox(0.06, 0.05, 0.02, 0.008), M.chip(), mtx(0, 0.17, 0.768))
  // balance lead to its white plug, tucked on top
  const bal = [0x1b1d22, 0xd92d2d, 0xd92d2d, 0xd92d2d, 0xd92d2d]
  bal.forEach((c, i) => {
    const x = 0.06 + i * 0.008
    kit.add(wire([V(x, top - 0.03, zc + len / 2), V(x, top + 0.04, zc + len / 2 + 0.03), V(x, top + 0.02, 0.28), V(x, top + 0.008, 0.2)], 0.0035, 24), M.silicone(c))
  })
  kit.add(rbox(0.05, 0.016, 0.03, 0.003), M.plastic(0xf2efe6, 0.55), mtx(0.076, top + 0.009, 0.185))
  // strap over the top and under the top plate, with a metal buckle
  const strapMat = std({ map: T.strap(), roughness: 0.8 })
  const sw = 0.07
  const sz = -0.02
  kit.add(new THREE.BoxGeometry(w + 0.016, 0.008, sw), strapMat, mtx(0, top + 0.004, sz))
  for (const s of [-1, 1]) kit.add(new THREE.BoxGeometry(0.008, top - TOP_Y + 0.01, sw), strapMat, mtx(s * (w / 2 + 0.004), (top + TOP_Y) / 2, sz))
  kit.add(new THREE.BoxGeometry(w + 0.016, 0.008, sw), strapMat, mtx(0, TOP_Y - 0.004, sz))
  kit.add(rbox(0.09, 0.016, 0.086, 0.005), M.steel(), mtx(-0.06, top + 0.01, sz))
  kit.add(rbox(0.05, 0.02, 0.08, 0.006), M.plastic(0x1b1d22, 0.6), mtx(-0.06, top + 0.021, sz))
  return { group: kit.done(), glow: [wrap, label], leadStart: V(0, yc + 0.05, zc + len / 2) }
}

// ---------------------------------------------------------------- wiring
/** Motor leads (copper, sleeved along the arm) and the ESC-to-FC harness. */
export function buildWiring() {
  const kit = new Kit()
  const copper = std({ color: 0xc8793c, metalness: 1, roughness: 0.3 })
  const sleeve = M.plastic(0x16181d, 0.75)
  for (const m of MOTORS) {
    const len = Math.hypot(m.x, m.z)
    const dx = m.x / len
    const dz = m.z / len
    const nx = -dz
    const nz = dx
    const y = ARM_TOP + 0.012
    for (let k = -1; k <= 1; k++) {
      const off = k * 0.013
      const pad = V(Math.sign(m.x) * 0.131 + k * 0.0148, ESC_Y + 0.02, Math.sign(m.z) * 0.131 - k * 0.0148 * Math.sign(m.x) * Math.sign(m.z))
      kit.add(
        wire(
          [
            V(m.x - dx * 0.13 + nx * off, ARM_TOP + 0.03, m.z - dz * 0.13 + nz * off),
            V(m.x - dx * 0.2 + nx * off, y, m.z - dz * 0.2 + nz * off),
            V(dx * 0.45 + nx * off, y, dz * 0.45 + nz * off),
            V(dx * 0.26 + nx * off, ESC_Y + 0.03, dz * 0.26 + nz * off),
            pad,
          ],
          0.0055,
          48,
        ),
        copper,
      )
    }
    // black sleeve over the middle of the run
    kit.add(wire([V(m.x - dx * 0.24, y + 0.001, m.z - dz * 0.24), V(dx * 0.5, y + 0.001, dz * 0.5)], 0.02, 12), sleeve)
    // zip tie
    kit.add(new THREE.TorusGeometry(0.07, 0.006, 6, 24), sleeve, mtx(dx * 0.62, ARM_BOT + 0.028, dz * 0.62, 0, Math.atan2(-dz, dx) + Math.PI / 2, 0, 1, 0.5, 1))
  }
  // 8-wire harness from the ESC up to the flight controller
  const cols = [0x1b1d22, 0xe23b3b, 0xffd23f, 0x2f9e44, 0x3d8bff, 0x8b5cf6, 0xf2efe6, 0x9ca3af]
  cols.forEach((c, i) => {
    const z = -0.06 + i * 0.011
    kit.add(wire([V(-0.17, ESC_Y + 0.018, z), V(-0.215, ESC_Y + 0.05, z), V(-0.2, FC_Y + 0.05, z * 0.9), V(-0.155, FC_Y + 0.03, 0.02 + (z + 0.02) * 0.6)], 0.0032, 24), M.silicone(c))
  })
  return { group: kit.done() }
}
