import * as THREE from 'three'
import * as H from './hardware'
import { MOTORS, PROP_Y, PROP_R, spinColor, type Spin } from './hardware'

export { MOTORS, ARM, CW_COLOR, CCW_COLOR, spinColor, PROP_Y, PROP_R } from './hardware'
export type { Spin } from './hardware'

export type PartKey = 'frame' | 'motors' | 'esc' | 'wires' | 'fc' | 'receiver' | 'camera' | 'battery' | 'props'

interface Part {
  group: THREE.Group
  explode: THREE.Vector3
  /** Corner parts also slide outward when exploded. */
  spread: number
  step: number
  labelAt: THREE.Vector3
  center: THREE.Vector3
  radius: number
  meshes: THREE.Mesh[]
}

type Mat = THREE.MeshStandardMaterial & { userData: Record<string, unknown> }

export class Drone {
  root = new THREE.Group()
  body = new THREE.Group()
  parts = {} as Record<PartKey, Part>
  bells: THREE.Group[] = []
  spinners: THREE.Group[] = []
  bladePivots: { pivot: THREE.Group; spin: Spin }[] = []
  blurs: THREE.Mesh[] = []
  propMats: THREE.MeshPhysicalMaterial[] = []
  spinArrows: THREE.Group[] = []
  phases: THREE.MeshStandardMaterial[][] = []
  bellMats: THREE.MeshPhysicalMaterial[] = []
  frameLeds: THREE.Mesh[] = []
  escLeds: THREE.Mesh[] = []
  fcLeds: THREE.Mesh[] = []
  rxLed!: THREE.Mesh
  gizmo!: THREE.Group
  eye!: THREE.Object3D
  batteryGlow: THREE.MeshPhysicalMaterial[] = []
  rxAt = new THREE.Vector3()
  antennaTip = new THREE.Vector3()
  batteryLead = new THREE.Vector3()
  propAngles = [0, 0, 0, 0]
  bellAngles = [0, 0, 0, 0]
  /** Visual spin direction per motor; normally MOTORS[i].spin. */
  visSpin: Spin[] = MOTORS.map((m) => m.spin)
  /** When set, only these parts move apart. */
  explodeOnly: PartKey[] | null = null
  arrowsTurn = true

  private explodeT = 0
  private highlight: PartKey | null = null
  private focus: PartKey | null = null
  private cutaway = false
  private buildStep = 99
  private buildAnim: number[] = []

  constructor() {
    this.root.add(this.body)
    this.build()
  }

  private addPart(key: PartKey, step: number, explode: [number, number, number], labelAt: [number, number, number], spread = 0) {
    const group = new THREE.Group()
    group.userData.part = key
    this.body.add(group)
    this.parts[key] = {
      group,
      explode: new THREE.Vector3(...explode),
      spread,
      step,
      labelAt: new THREE.Vector3(...labelAt),
      center: new THREE.Vector3(),
      radius: 0.3,
      meshes: [],
    }
    return group
  }

  private build() {
    const frame = H.buildFrame()
    this.addPart('frame', 1, [0, 0, 0], [0.62, 0.1, 0.62]).add(frame.group)
    this.frameLeds = frame.leds

    const motors = this.addPart('motors', 2, [0, 0.6, 0], [H.ARM + 0.2, 0.3, -H.ARM - 0.2], 0.3)
    MOTORS.forEach((m, i) => {
      const mo = H.buildMotor(m.spin)
      mo.group.position.set(m.x, H.ARM_TOP, m.z)
      motors.add(mo.group)
      this.bells[i] = mo.bell
      this.phases[i] = mo.phases
      this.bellMats[i] = mo.bellMat
      mo.phases.forEach((p) => (p.userData.noHl = true))
    })

    const esc = H.buildESC()
    this.addPart('esc', 3, [0, 0.5, 0], [-0.3, 0.16, -0.12]).add(esc.group)
    this.escLeds = esc.leds

    this.addPart('wires', 4, [0, 0.5, 0], [0.45, 0.15, 0.45]).add(H.buildWiring().group)

    const fc = H.buildFC()
    this.addPart('fc', 4, [0, 0.95, 0], [0.26, 0.25, 0.16]).add(fc.group)
    this.fcLeds = fc.leds
    this.gizmo = fc.gizmo

    const rx = H.buildReceiver()
    this.addPart('receiver', 5, [0, 0.55, 0.9], [rx.at.x, rx.at.y + 0.05, rx.at.z]).add(rx.group)
    this.rxLed = rx.led
    this.rxAt.copy(rx.at)
    this.antennaTip.copy(rx.antennaTip)

    const cam = H.buildCamera()
    this.addPart('camera', 6, [0, 0.3, -1.0], [0, 0.36, -0.45]).add(cam.group)
    this.eye = cam.eye

    const bat = H.buildBattery()
    this.addPart('battery', 7, [0, 1.5, 0], [0, 0.62, 0.1]).add(bat.group)
    this.batteryGlow = bat.glow
    this.batteryLead.copy(bat.leadStart)

    const props = this.addPart('props', 8, [0, 2.0, 0], [-H.ARM - 0.5, 0.36, -H.ARM - 0.5], 0.5)
    const blurTex = (() => {
      const c = document.createElement('canvas')
      c.width = c.height = 256
      const g = c.getContext('2d')!
      const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128)
      gr.addColorStop(0, 'rgba(255,255,255,0)')
      gr.addColorStop(0.22, 'rgba(255,255,255,0.5)')
      gr.addColorStop(0.9, 'rgba(255,255,255,0.3)')
      gr.addColorStop(0.97, 'rgba(255,255,255,0.75)')
      gr.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = gr
      g.fillRect(0, 0, 256, 256)
      const t = new THREE.CanvasTexture(c)
      t.colorSpace = THREE.SRGBColorSpace
      return t
    })()
    MOTORS.forEach((m, i) => {
      const p = H.buildProp(m.spin)
      p.group.position.set(m.x, PROP_Y, m.z)
      props.add(p.group)
      this.spinners[i] = p.group
      this.propMats[i] = p.mat
      p.pivots.forEach((pivot) => this.bladePivots.push({ pivot, spin: m.spin }))

      const blur = new THREE.Mesh(
        new THREE.CircleGeometry(PROP_R, 64),
        new THREE.MeshBasicMaterial({ color: spinColor(m.spin), map: blurTex, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
      )
      blur.rotation.x = -Math.PI / 2
      blur.position.set(m.x, PROP_Y + 0.035, m.z)
      blur.userData.noGhost = true
      props.add(blur)
      this.blurs[i] = blur

      // Curved arrow that shows spin direction
      const arrowG = new THREE.Group()
      arrowG.position.set(m.x, PROP_Y + 0.12, m.z)
      const am = new THREE.MeshBasicMaterial({ color: spinColor(m.spin), transparent: true, opacity: 0.95 })
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.022, 8, 64, Math.PI * 1.2), am)
      arc.rotation.x = -Math.PI / 2
      arrowG.add(arc)
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.17, 16), am)
      // Arc runs counter-clockwise (seen from above) from angle 0 to 1.2π:
      // point(θ) = (R cos θ, 0, −R sin θ). The head sits at whichever end the spin leads to.
      const endA = Math.PI * 1.2
      const up = new THREE.Vector3(0, 1, 0)
      if (m.spin === -1) {
        head.position.set(0.72 * Math.cos(endA), 0, -0.72 * Math.sin(endA))
        head.quaternion.setFromUnitVectors(up, new THREE.Vector3(-Math.sin(endA), 0, -Math.cos(endA)))
      } else {
        head.position.set(0.72, 0, 0)
        head.quaternion.setFromUnitVectors(up, new THREE.Vector3(0, 0, 1))
      }
      arrowG.add(head)
      arrowG.visible = false
      this.root.add(arrowG)
      this.spinArrows[i] = arrowG
    })

    // Remember materials, rest positions, and each part's centre.
    const box = new THREE.Box3()
    const sphere = new THREE.Sphere()
    for (const key of Object.keys(this.parts) as PartKey[]) {
      const part = this.parts[key]
      for (const c of part.group.children) c.userData.base = c.position.clone()
      part.group.traverse((o) => {
        if (!(o instanceof THREE.Mesh) || o.userData.noGhost) return
        o.userData.part = key
        const mat = o.material as Mat
        if (!mat.userData.base) {
          mat.userData.base = {
            emissive: mat.emissive ? mat.emissive.clone() : null,
            emissiveIntensity: mat.emissiveIntensity,
            transparent: mat.transparent,
            opacity: mat.opacity,
            depthWrite: mat.depthWrite,
          }
        }
        part.meshes.push(o)
      })
      box.setFromObject(part.group)
      box.getBoundingSphere(sphere)
      part.center.copy(sphere.center)
      part.radius = sphere.radius
    }
    this.setBladePitch(18)
  }

  /** Blade tilt in degrees; the blades are modelled at 18°. */
  setBladePitch(deg: number) {
    const r = THREE.MathUtils.degToRad(deg - 18)
    for (const { pivot, spin } of this.bladePivots) pivot.rotation.x = spin === 1 ? -r : r
  }

  setExplode(t: number) {
    this.explodeT = t
  }

  setHighlight(k: PartKey | null) {
    this.highlight = k
  }

  /** Show one part clearly and fade the rest to glass. */
  setFocus(k: PartKey | null) {
    if (this.focus === k) return
    this.focus = k
    const keep: PartKey[] = k === 'esc' ? ['esc', 'wires'] : k ? [k] : []
    for (const key of Object.keys(this.parts) as PartKey[]) {
      const ghost = k !== null && !keep.includes(key)
      for (const m of this.parts[key].meshes) {
        this.ghost(m.material as Mat, ghost ? 0.08 : null)
        m.castShadow = !ghost
      }
    }
    this.applyCutaway()
  }

  /** Make the motor bells see-through so the copper coils show. */
  setCutaway(on: boolean) {
    this.cutaway = on
    this.applyCutaway()
  }

  private applyCutaway() {
    for (const m of this.bellMats) this.ghost(m as unknown as Mat, this.cutaway ? 0.22 : this.focus && this.focus !== 'motors' ? 0.08 : null)
  }

  private ghost(mat: Mat, opacity: number | null) {
    const base = mat.userData.base as { transparent: boolean; opacity: number; depthWrite: boolean } | undefined
    if (!base) return
    const t = opacity !== null ? true : base.transparent
    if (mat.transparent !== t) mat.needsUpdate = true
    mat.transparent = t
    mat.opacity = opacity !== null ? Math.min(base.opacity, opacity) : base.opacity
    mat.depthWrite = opacity !== null ? false : base.depthWrite
  }

  /** Show parts up to this assembly step; newly added parts drop into place. */
  setBuildStep(step: number, animate = true) {
    for (const key of Object.keys(this.parts) as PartKey[]) {
      const s = this.parts[key].step
      this.buildAnim[s] = animate && s <= step && s > this.buildStep ? 0 : 1
    }
    this.buildStep = step
  }

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

  /** u: motor power 0..1 per motor. spinVis multiplies the visual spin rate. */
  update(dt: number, t: number, u: number[], spinVis = 1, propsOn = true) {
    const pulse = 0.55 + 0.45 * Math.sin(t * 5)
    for (const key of Object.keys(this.parts) as PartKey[]) {
      const p = this.parts[key]
      const e = !this.explodeOnly || this.explodeOnly.includes(key) ? this.explodeT : 0
      const shown = p.step <= this.buildStep
      p.group.visible = shown && (key !== 'props' || propsOn)
      let a = this.buildAnim[p.step]
      if (a !== undefined && a < 1) {
        a = Math.min(1, a + dt * 0.8)
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
      for (const m of p.meshes) {
        const mm = m.material as Mat
        if (mm.userData.noHl || !mm.emissive) continue
        const base = mm.userData.base as { emissive: THREE.Color; emissiveIntensity: number }
        if (hl) {
          mm.emissive.setHex(0xffd58a)
          mm.emissiveIntensity = 0.12 + 0.18 * pulse
          mm.userData.lit = true
        } else if (mm.userData.lit) {
          mm.emissive.copy(base.emissive)
          mm.emissiveIntensity = base.emissiveIntensity
          mm.userData.lit = false
        }
      }
    }
    const faded = this.focus !== null && this.focus !== 'props'
    for (let i = 0; i < 4; i++) {
      const s = this.visSpin[i]
      const w = u[i] * 34 * spinVis
      this.propAngles[i] -= s * Math.min(w, 26) * dt
      this.spinners[i].rotation.y = this.propAngles[i]
      this.bellAngles[i] -= s * Math.min(w, 26) * dt
      this.bells[i].rotation.y = this.bellAngles[i]
      const blur = THREE.MathUtils.clamp((u[i] * spinVis - 0.15) / 0.5, 0, 1)
      ;(this.blurs[i].material as THREE.MeshBasicMaterial).opacity = blur * (faded ? 0.04 : 0.34)
      if (!faded) this.propMats[i].opacity = 0.9 - blur * 0.72
      const arrow = this.spinArrows[i]
      if (arrow.visible && this.arrowsTurn) arrow.rotation.y -= (arrow.scale.z === 1 ? MOTORS[i].spin : -MOTORS[i].spin) * dt * 1.2
    }
  }

  /** Light one of the three coil phases in every motor, as the ESC does. */
  firePhases(phase: number, intensity: number) {
    for (const ph of this.phases)
      ph.forEach((m, k) => {
        m.emissiveIntensity = k === phase ? intensity : 0
      })
  }

  /** World position of a part's label anchor. */
  labelWorld(key: PartKey, out: THREE.Vector3) {
    const p = this.parts[key]
    out.copy(p.labelAt).add(p.group.position)
    return this.body.localToWorld(out)
  }

  /** World centre of a part, at rest. */
  centerWorld(key: PartKey, out: THREE.Vector3) {
    out.copy(this.parts[key].center)
    return this.root.localToWorld(out)
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
