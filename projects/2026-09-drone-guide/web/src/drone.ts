import * as THREE from 'three'

export type PartKey =
  | 'frame'
  | 'motors'
  | 'esc'
  | 'wires'
  | 'fc'
  | 'receiver'
  | 'camera'
  | 'battery'
  | 'props'

/** Spin direction seen from above: +1 clockwise, -1 counter-clockwise. */
export type Spin = 1 | -1

export const ARM = 0.8

export const MOTORS: { key: string; name: string; x: number; z: number; spin: Spin }[] = [
  { key: 'fl', name: 'Front-left', x: -ARM, z: -ARM, spin: 1 },
  { key: 'fr', name: 'Front-right', x: ARM, z: -ARM, spin: -1 },
  { key: 'bl', name: 'Back-left', x: -ARM, z: ARM, spin: -1 },
  { key: 'br', name: 'Back-right', x: ARM, z: ARM, spin: 1 },
]

export const CW_COLOR = 0xff8a3d
export const CCW_COLOR = 0x3ad6ff
export const spinColor = (s: Spin) => (s === 1 ? CW_COLOR : CCW_COLOR)

const PROP_R = 0.55
const MOTOR_TOP = 0.31
const PROP_Y = MOTOR_TOP + 0.03

interface Part {
  group: THREE.Group
  explode: THREE.Vector3
  /** Corner parts also slide outward when exploded. */
  spread: number
  step: number
  labelAt: THREE.Vector3
  meshes: THREE.Mesh[]
}

function mat(color: number, rough = 0.6, metal = 0.1, extra: THREE.MeshStandardMaterialParameters = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra })
}

function mesh(geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m)
  o.position.set(x, y, z)
  o.castShadow = true
  o.receiveShadow = true
  return o
}

function tube(points: THREE.Vector3[], r: number, color: number) {
  const curve = new THREE.CatmullRomCurve3(points)
  return mesh(new THREE.TubeGeometry(curve, 24, r, 6, false), mat(color, 0.5))
}

function bladeGeometry() {
  const s = new THREE.Shape()
  s.moveTo(0.04, -0.03)
  s.bezierCurveTo(0.2, -0.07, 0.42, -0.06, PROP_R, -0.015)
  s.bezierCurveTo(PROP_R + 0.015, 0.0, PROP_R + 0.01, 0.02, PROP_R - 0.02, 0.03)
  s.bezierCurveTo(0.4, 0.05, 0.2, 0.05, 0.04, 0.03)
  s.lineTo(0.04, -0.03)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: false, curveSegments: 16 })
  g.translate(0, 0, -0.006)
  g.rotateX(-Math.PI / 2)
  return g
}

export class Drone {
  root = new THREE.Group()
  body = new THREE.Group()
  parts = {} as Record<PartKey, Part>
  bells: THREE.Group[] = []
  spinners: THREE.Group[] = []
  bladePivots: { pivot: THREE.Group; spin: Spin }[] = []
  blurs: THREE.Mesh[] = []
  bladeMats: THREE.MeshStandardMaterial[] = []
  spinArrows: THREE.Group[] = []
  propAngles = [0, 0, 0, 0]
  bellAngles = [0, 0, 0, 0]
  /** Visual spin direction per motor; normally MOTORS[i].spin. */
  visSpin: Spin[] = MOTORS.map((m) => m.spin)

  private explodeT = 0
  /** When set, only these parts move apart. */
  explodeOnly: PartKey[] | null = null
  arrowsTurn = true
  private highlight: PartKey | null = null
  private buildStep = 99
  private buildAnim: number[] = []

  constructor() {
    this.root.add(this.body)
    this.build()
  }

  private addPart(key: PartKey, step: number, explode: [number, number, number], labelAt: [number, number, number]) {
    const group = new THREE.Group()
    group.userData.part = key
    this.body.add(group)
    this.parts[key] = { group, explode: new THREE.Vector3(...explode), spread: 0, step, labelAt: new THREE.Vector3(...labelAt), meshes: [] }
    return group
  }

  private build() {
    // Frame: the skeleton
    const frame = this.addPart('frame', 1, [0, 0, 0], [0.62, 0.14, 0.62])
    const carbon = () => mat(0x262b36, 0.45, 0.2)
    frame.add(mesh(new THREE.BoxGeometry(0.46, 0.04, 0.7), carbon(), 0, 0.13, 0))
    for (const m of MOTORS) {
      const len = Math.hypot(m.x, m.z)
      const arm = mesh(new THREE.BoxGeometry(0.13, 0.045, len + 0.06), carbon(), m.x / 2, 0.125, m.z / 2)
      arm.rotation.y = Math.atan2(m.x, m.z)
      frame.add(arm)
      const pad = mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 12), mat(0x3a4152, 0.9), m.x * 0.82, 0.05, m.z * 0.82)
      frame.add(pad)
      const front = m.z < 0
      const led = mesh(
        new THREE.SphereGeometry(0.035, 12, 8),
        mat(front ? 0x5dff8a : 0xff4d5e, 0.3, 0, { emissive: front ? 0x5dff8a : 0xff4d5e, emissiveIntensity: 1.6 }),
        m.x * 0.72,
        0.095,
        m.z * 0.72,
      )
      led.castShadow = false
      frame.add(led)
    }

    // Motors
    const motors = this.addPart('motors', 2, [0, 0.55, 0], [ARM + 0.25, 0.36, -ARM - 0.25])
    MOTORS.forEach((m, i) => {
      const g = new THREE.Group()
      g.position.set(m.x, 0.15, m.z)
      g.add(mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.05, 20), mat(0x1c1f27, 0.5, 0.4), 0, 0.025, 0))
      const bell = new THREE.Group()
      bell.position.y = 0.05
      bell.add(mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.1, 24), mat(0xb9c2cf, 0.25, 0.85), 0, 0.05, 0))
      const ring = mesh(new THREE.TorusGeometry(0.117, 0.012, 8, 32), mat(spinColor(m.spin), 0.4, 0.2, { emissive: spinColor(m.spin), emissiveIntensity: 0.35 }), 0, 0.075, 0)
      ring.rotation.x = Math.PI / 2
      bell.add(ring)
      bell.add(mesh(new THREE.BoxGeometry(0.03, 0.07, 0.02), mat(0xffffff, 0.4), 0, 0.045, 0.115))
      bell.add(mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.06, 8), mat(0xdfe5ec, 0.2, 0.9), 0, 0.13, 0))
      g.add(bell)
      this.bells[i] = bell
      motors.add(g)
    })

    // ESC board (speed controllers) with standoffs
    const esc = this.addPart('esc', 3, [0, 0.38, 0], [-0.32, 0.2, -0.12])
    esc.add(mesh(new THREE.BoxGeometry(0.4, 0.022, 0.4), mat(0x2463d6, 0.55, 0.1), 0, 0.19, 0))
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      esc.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8), mat(0xc9a55a, 0.35, 0.7), x * 0.16, 0.23, z * 0.16))
      esc.add(mesh(new THREE.BoxGeometry(0.07, 0.02, 0.07), mat(0x111418, 0.6), x * 0.09, 0.205, z * 0.09))
    }

    // Motor wires
    const wires = this.addPart('wires', 4, [0, 0.38, 0], [0.4, 0.2, 0.4])
    for (const m of MOTORS) {
      for (const [k, c] of [[-1, 0x1b1b1b], [0, 0xe03b3b], [1, 0x2c5dd8]] as const) {
        const nx = -m.z / Math.hypot(m.x, m.z)
        const nz = m.x / Math.hypot(m.x, m.z)
        const off = k * 0.018
        wires.add(
          tube(
            [
              new THREE.Vector3(m.x * 0.2 + nx * off, 0.2, m.z * 0.2 + nz * off),
              new THREE.Vector3(m.x * 0.45 + nx * off, 0.16, m.z * 0.45 + nz * off),
              new THREE.Vector3(m.x * 0.82 + nx * off, 0.16, m.z * 0.82 + nz * off),
            ],
            0.009,
            c,
          ),
        )
      }
    }

    // Flight controller (the brain)
    const fc = this.addPart('fc', 4, [0, 0.8, 0], [0.34, 0.3, 0.18])
    fc.add(mesh(new THREE.BoxGeometry(0.36, 0.02, 0.36), mat(0x1e8f4e, 0.55, 0.1), 0, 0.3, 0))
    fc.add(mesh(new THREE.BoxGeometry(0.1, 0.02, 0.1), mat(0x0d0f12, 0.4, 0.3), 0.02, 0.318, 0.04))
    fc.add(mesh(new THREE.BoxGeometry(0.05, 0.018, 0.05), mat(0x2b2f36, 0.4, 0.3), -0.09, 0.316, 0.08))
    const arrow = new THREE.Shape()
    arrow.moveTo(0, -0.1)
    arrow.lineTo(0.035, -0.04)
    arrow.lineTo(0.012, -0.04)
    arrow.lineTo(0.012, 0.03)
    arrow.lineTo(-0.012, 0.03)
    arrow.lineTo(-0.012, -0.04)
    arrow.lineTo(-0.035, -0.04)
    const arrowGeo = new THREE.ShapeGeometry(arrow)
    arrowGeo.rotateX(Math.PI / 2)
    const arrowMesh = mesh(arrowGeo, mat(0xffffff, 0.5, 0, { side: THREE.DoubleSide }), -0.1, 0.312, -0.03)
    fc.add(arrowMesh)

    // Receiver + antenna
    const rx = this.addPart('receiver', 5, [0, 0.45, 0.95], [0, 0.3, 0.3])
    rx.add(mesh(new THREE.BoxGeometry(0.12, 0.03, 0.1), mat(0x7a3fd1, 0.5), 0, 0.17, 0.28))
    for (const s of [-1, 1]) {
      const ant = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.38, 6), mat(0x16181d, 0.6), s * 0.1, 0.32, 0.46)
      ant.rotation.set(-0.9, 0, s * 0.5)
      rx.add(ant)
      const tip = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.06, 8), mat(0xffffff, 0.5), s * 0.175, 0.43, 0.58)
      tip.rotation.copy(ant.rotation)
      rx.add(tip)
    }

    // Camera
    const cam = this.addPart('camera', 6, [0, 0.35, -1.0], [0, 0.42, -0.34])
    const camG = new THREE.Group()
    camG.position.set(0, 0.24, -0.34)
    camG.rotation.x = 0.3
    camG.add(mesh(new THREE.BoxGeometry(0.15, 0.14, 0.13), mat(0x14161b, 0.5)))
    const lens = mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.07, 20), mat(0x0a0b0e, 0.2, 0.5), 0, 0, -0.09)
    lens.rotation.x = Math.PI / 2
    camG.add(lens)
    const glass = mesh(new THREE.CircleGeometry(0.035, 20), mat(0x3a7bff, 0.05, 0.6, { emissive: 0x1b3d99, emissiveIntensity: 0.5 }), 0, 0, -0.126)
    glass.rotation.y = Math.PI
    camG.add(glass)
    cam.add(camG)

    // Battery with strap and lead
    const bat = this.addPart('battery', 7, [0, 1.1, 0], [0, 0.55, 0.1])
    bat.add(mesh(new THREE.BoxGeometry(0.3, 0.14, 0.56), mat(0x2f3440, 0.55), 0, 0.41, 0.03))
    bat.add(mesh(new THREE.BoxGeometry(0.302, 0.06, 0.3), mat(0xffc93d, 0.5), 0, 0.42, 0.08))
    bat.add(mesh(new THREE.BoxGeometry(0.34, 0.012, 0.06), mat(0xe8442f, 0.8), 0, 0.486, 0.03))
    for (const s of [-1, 1]) bat.add(mesh(new THREE.BoxGeometry(0.012, 0.2, 0.06), mat(0xe8442f, 0.8), s * 0.17, 0.39, 0.03))
    bat.add(tube([new THREE.Vector3(0.05, 0.4, -0.25), new THREE.Vector3(0.1, 0.36, -0.33), new THREE.Vector3(0.14, 0.25, -0.2), new THREE.Vector3(0.12, 0.2, -0.12)], 0.012, 0xd83a3a))
    bat.add(tube([new THREE.Vector3(-0.05, 0.4, -0.25), new THREE.Vector3(-0.1, 0.36, -0.33), new THREE.Vector3(-0.14, 0.25, -0.2), new THREE.Vector3(-0.12, 0.2, -0.12)], 0.012, 0x1b1b1b))

    // Propellers
    const props = this.addPart('props', 8, [0, 1.45, 0], [-ARM - 0.45, 0.42, -ARM - 0.45])
    const bladeGeo = bladeGeometry()
    MOTORS.forEach((m, i) => {
      const spinner = new THREE.Group()
      spinner.position.set(m.x, PROP_Y, m.z)
      const bm = mat(spinColor(m.spin), 0.45, 0.05, { transparent: true, opacity: 0.95 })
      this.bladeMats[i] = bm
      spinner.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 16), mat(spinColor(m.spin), 0.4)))
      for (const a of [0, Math.PI]) {
        const holder = new THREE.Group()
        holder.rotation.y = a
        const pivot = new THREE.Group()
        pivot.add(mesh(bladeGeo, bm))
        holder.add(pivot)
        spinner.add(holder)
        this.bladePivots.push({ pivot, spin: m.spin })
      }
      props.add(spinner)
      this.spinners[i] = spinner

      const blur = new THREE.Mesh(
        new THREE.RingGeometry(0.06, PROP_R, 48),
        new THREE.MeshBasicMaterial({ color: spinColor(m.spin), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
      )
      blur.rotation.x = -Math.PI / 2
      blur.position.set(m.x, PROP_Y + 0.005, m.z)
      props.add(blur)
      this.blurs[i] = blur

      // Curved arrow that shows spin direction
      const arrowG = new THREE.Group()
      arrowG.position.set(m.x, PROP_Y + 0.08, m.z)
      const am = new THREE.MeshBasicMaterial({ color: spinColor(m.spin), transparent: true, opacity: 0.9 })
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.66, 0.02, 8, 48, Math.PI * 1.2), am)
      arc.rotation.x = -Math.PI / 2
      arrowG.add(arc)
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 12), am)
      // Arc runs counter-clockwise (seen from above) from angle 0 to 1.2π:
      // point(θ) = (R cos θ, 0, −R sin θ). The head sits at whichever end the spin leads to.
      const endA = Math.PI * 1.2
      const up = new THREE.Vector3(0, 1, 0)
      if (m.spin === -1) {
        head.position.set(0.66 * Math.cos(endA), 0, -0.66 * Math.sin(endA))
        head.quaternion.setFromUnitVectors(up, new THREE.Vector3(-Math.sin(endA), 0, -Math.cos(endA)))
      } else {
        head.position.set(0.66, 0, 0)
        head.quaternion.setFromUnitVectors(up, new THREE.Vector3(0, 0, 1))
      }
      arrowG.add(head)
      arrowG.visible = false
      this.root.add(arrowG)
      this.spinArrows[i] = arrowG
    })

    this.parts.motors.spread = 0.25
    this.parts.props.spread = 0.45
    for (const key of Object.keys(this.parts) as PartKey[]) {
      for (const c of this.parts[key].group.children) c.userData.base = c.position.clone()
      this.parts[key].group.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
          o.userData.part = key
          o.userData.baseEmissive = o.material.emissive.clone()
          o.userData.baseEmissiveI = o.material.emissiveIntensity
          this.parts[key].meshes.push(o)
        }
      })
    }
    this.setBladePitch(18)
  }

  setBladePitch(deg: number) {
    const r = THREE.MathUtils.degToRad(deg)
    for (const { pivot, spin } of this.bladePivots) pivot.rotation.x = spin === 1 ? -r : r
  }

  setExplode(t: number) {
    this.explodeT = t
  }

  setHighlight(k: PartKey | null) {
    this.highlight = k
  }

  /** Show parts up to this assembly step; newly added parts drop into place. */
  setBuildStep(step: number, animate = true) {
    for (const key of Object.keys(this.parts) as PartKey[]) {
      const s = this.parts[key].step
      this.buildAnim[s] = animate && s <= step && s > this.buildStep ? 0 : 1
    }
    this.buildStep = step
  }

  /** Visual spin of motors and props; arrows follow unless told otherwise. */
  setVisSpin(spins: Spin[], arrows = true) {
    this.visSpin = spins.slice()
    ;(arrows ? spins : MOTORS.map((m) => m.spin)).forEach((s, i) => {
      const a = this.spinArrows[i]
      a.scale.z = s === MOTORS[i].spin ? 1 : -1
      a.traverse((o) => {
        if (o instanceof THREE.Mesh) (o.material as THREE.MeshBasicMaterial).color.setHex(spinColor(s))
      })
    })
  }

  showSpinArrows(on: boolean) {
    this.spinArrows.forEach((a) => (a.visible = on))
  }

  setPropsVisible(on: boolean) {
    this.parts.props.group.visible = on && this.parts.props.step <= this.buildStep
  }

  /** u: motor power 0..1 per motor. spinVis multiplies the visual spin rate. */
  update(dt: number, t: number, u: number[], spinVis = 1, propsOn = true) {
    for (const key of Object.keys(this.parts) as PartKey[]) {
      const p = this.parts[key]
      const e = !this.explodeOnly || this.explodeOnly.includes(key) ? this.explodeT : 0
      const shown = p.step <= this.buildStep
      p.group.visible = shown && (key !== 'props' || propsOn)
      let a = this.buildAnim[p.step]
      if (a !== undefined && a < 1) {
        a = Math.min(1, a + dt * 1.6)
        this.buildAnim[p.step] = a
      } else a = 1
      const drop = (1 - easeOutBack(a)) * 1.6
      p.group.position.set(p.explode.x * e, p.explode.y * e + drop, p.explode.z * e)
      if (p.spread) {
        for (const c of p.group.children) {
          const b = c.userData.base as THREE.Vector3
          c.position.set(b.x + Math.sign(b.x) * p.spread * e, b.y, b.z + Math.sign(b.z) * p.spread * e)
        }
      }
      const hl = this.highlight === key
      const pulse = 0.55 + 0.45 * Math.sin(t * 6)
      for (const m of p.meshes) {
        const mm = m.material as THREE.MeshStandardMaterial
        if (hl) {
          mm.emissive.setHex(0xffe08a)
          mm.emissiveIntensity = 0.35 + 0.35 * pulse
        } else {
          mm.emissive.copy(m.userData.baseEmissive)
          mm.emissiveIntensity = m.userData.baseEmissiveI
        }
      }
    }
    for (let i = 0; i < 4; i++) {
      const s = this.visSpin[i]
      const w = u[i] * 34 * spinVis
      this.propAngles[i] -= s * Math.min(w, 26) * dt
      this.spinners[i].rotation.y = this.propAngles[i]
      this.bellAngles[i] -= s * Math.min(w, 26) * dt
      this.bells[i].rotation.y = this.bellAngles[i]
      const blur = THREE.MathUtils.clamp((u[i] * spinVis - 0.15) / 0.5, 0, 1)
      ;(this.blurs[i].material as THREE.MeshBasicMaterial).opacity = blur * 0.28
      this.bladeMats[i].opacity = 1 - blur * 0.75
      const arrow = this.spinArrows[i]
      if (arrow.visible && this.arrowsTurn) arrow.rotation.y -= (arrow.scale.z === 1 ? MOTORS[i].spin : -MOTORS[i].spin) * dt * 1.2
    }
  }

  /** World position of a part's label anchor. */
  labelWorld(key: PartKey, out: THREE.Vector3) {
    const p = this.parts[key]
    out.copy(p.labelAt).add(p.group.position)
    return this.body.localToWorld(out)
  }

  propWorld(i: number, out: THREE.Vector3) {
    out.set(MOTORS[i].x, PROP_Y, MOTORS[i].z)
    return this.root.localToWorld(out)
  }
}

function easeOutBack(x: number) {
  const c1 = 1.4
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}
