import * as THREE from 'three'
import { MOTORS } from './drone'

/**
 * A toy quadcopter model. It is tuned to look right, not to match a real
 * aircraft, but it keeps the real cause-and-effect: every motion comes from
 * the four motor powers, and the mixer below is the one real drones use.
 *
 * Angles: pitch > 0 is nose down, roll > 0 is right side down,
 * yaw > 0 is a turn to the left (counter-clockwise seen from above).
 */
export interface Inputs {
  /** Manual power 0..1, used when altHold is off. */
  throttle: number
  /** -1..1: go down / up, used when altHold is on. */
  climb: number
  /** -1..1: back / forward. */
  pitch: number
  /** -1..1: left / right. */
  roll: number
  /** -1..1: turn left / right. */
  yaw: number
}

export const zeroInputs = (): Inputs => ({ throttle: 0, climb: 0, pitch: 0, roll: 0, yaw: 0 })

const G = 6
const MAX_TILT = 0.38
const HOVER_U = 0.5

export class Sim {
  pos = new THREE.Vector3()
  vel = new THREE.Vector3()
  pitch = 0
  roll = 0
  yaw = 0
  rp = 0
  rr = 0
  ry = 0
  u = [0, 0, 0, 0]
  brain = true
  altHold = true
  sameDir = false
  /** 0..1: how well the blades bite the air (blade tilt). */
  lift = 1
  ceiling = 5
  holdY = 1.3
  crashed = false
  crashTimer = 0
  grounded = true
  /** Called when the drone hits the ground too hard. */
  onCrash: (() => void) | null = null
  home = new THREE.Vector3(0, 0, 0)
  bounds = 6
  /** Motor-power override for bench tests: when set, motors run at these values and nothing moves. */
  bench: number[] | null = null
  private q = new THREE.Quaternion()
  private e = new THREE.Euler(0, 0, 0, 'YXZ')

  reset(y = 0) {
    this.pos.copy(this.home).setY(y)
    this.vel.set(0, 0, 0)
    this.pitch = this.roll = this.yaw = 0
    this.rp = this.rr = this.ry = 0
    this.crashed = false
    this.grounded = y <= 0
    this.holdY = Math.max(y, 1.3)
  }

  get quaternion() {
    this.e.set(-this.pitch, this.yaw, -this.roll, 'YXZ')
    return this.q.setFromEuler(this.e)
  }

  get tilt() {
    return Math.acos(THREE.MathUtils.clamp(Math.cos(this.pitch) * Math.cos(this.roll), -1, 1))
  }

  gust() {
    const s = () => (Math.random() < 0.5 ? -1 : 1)
    this.rp += s() * (2.6 + Math.random() * 1.4)
    this.rr += s() * (2.6 + Math.random() * 1.4)
    this.vel.x += s() * 0.8
    this.vel.z += s() * 0.8
    this.grounded = false
  }

  step(dt: number, inp: Inputs) {
    if (this.bench) {
      this.u = this.bench.slice()
      return
    }
    if (this.crashed) {
      this.u = [0, 0, 0, 0]
      this.crashTimer -= dt
      if (this.crashTimer <= 0) this.reset(1.3)
      return
    }

    // 1. Brain: decide how much each motor should push.
    let mp = 0
    let mr = 0
    let my = 0
    if (this.brain) {
      const tp = inp.pitch * MAX_TILT
      const tr = inp.roll * MAX_TILT
      mp = 0.4 * (tp - this.pitch) - 0.08 * this.rp
      mr = 0.4 * (tr - this.roll) - 0.08 * this.rr
      if (!this.sameDir) my = 1.0 * (-inp.yaw * 2 - this.ry)
    }
    let c: number
    if (!this.brain) c = HOVER_U
    else if (this.altHold) {
      if (Math.abs(inp.climb) > 0.05) this.holdY = this.pos.y
      const vzT = Math.abs(inp.climb) > 0.05 ? inp.climb * 1.8 : THREE.MathUtils.clamp(1.6 * (this.holdY - this.pos.y), -1.5, 1.5)
      const cosT = Math.max(Math.cos(this.pitch) * Math.cos(this.roll), 0.5)
      c = HOVER_U / cosT / Math.max(this.lift, 0.05) + 0.25 * (vzT - this.vel.y)
    } else c = inp.throttle

    // 2. Mixer: back motors push the nose down, left motors push the right side down,
    //    and the clockwise pair twists the body counter-clockwise.
    for (let i = 0; i < 4; i++) {
      const m = MOTORS[i]
      const v = c + mp * Math.sign(m.z) + mr * -Math.sign(m.x) + my * m.spin
      this.u[i] = THREE.MathUtils.clamp(v, 0, 1)
    }

    // 3. Physics: forces and twists from the motor powers.
    const F = this.u.map((u) => u * this.lift * (G / 2))
    let tp = 0
    let tr = 0
    let ty = 0
    for (let i = 0; i < 4; i++) {
      const m = MOTORS[i]
      tp += Math.sign(m.z) * F[i]
      tr += -Math.sign(m.x) * F[i]
      ty += (this.sameDir ? 1 : m.spin) * F[i]
    }
    const total = F[0] + F[1] + F[2] + F[3]

    if (!this.grounded) {
      this.rp += tp * 6.5 * dt
      this.rr += tr * 6.5 * dt
      this.rp *= 1 - 0.4 * dt
      this.rr *= 1 - 0.4 * dt
      this.pitch += this.rp * dt
      this.roll += this.rr * dt
    }
    this.ry += ty * 1.3 * dt
    this.ry *= 1 - 2 * dt
    if (this.grounded) this.ry *= 1 - Math.min(1, 12 * dt)
    this.yaw += this.ry * dt

    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quaternion)
    const acc = up.multiplyScalar(total).add(new THREE.Vector3(0, -G, 0)).addScaledVector(this.vel, -0.9)
    if (this.grounded && total <= G) {
      this.vel.set(0, 0, 0)
    } else {
      this.grounded = false
      this.vel.addScaledVector(acc, dt)
      this.pos.addScaledVector(this.vel, dt)
    }

    if (this.pos.y <= 0 && !this.grounded) {
      const hard = this.vel.length() > 3.2 || this.tilt > 0.9
      this.pos.y = 0
      this.vel.set(0, 0, 0)
      if (hard) {
        this.crashed = true
        this.crashTimer = 2
        this.roll = this.roll > 0 ? 1.4 : -1.4
        this.pitch = 0
        this.pos.y = 0.3
        this.onCrash?.()
      } else {
        this.grounded = true
        this.pitch = this.roll = this.rp = this.rr = 0
      }
    }
    if (this.pos.y > this.ceiling) {
      this.pos.y = this.ceiling
      this.vel.y = Math.min(this.vel.y, 0)
    }
    for (const k of ['x', 'z'] as const) {
      const lim = this.bounds
      const d = this.pos[k] - this.home[k]
      if (Math.abs(d) > lim) {
        this.pos[k] = this.home[k] + Math.sign(d) * lim
        this.vel[k] = 0
      }
    }
  }

  get thrustRatio() {
    return (this.u.reduce((a, b) => a + b, 0) * this.lift) / (4 * HOVER_U)
  }
}
