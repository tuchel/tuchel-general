import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/jetbrains-mono'
import './style.css'
import { Drone, MOTORS, PROP_Y, PROP_R, spinColor, type PartKey, type Spin } from './drone'
import { ARM_TOP, ESC_Y, FC_Y } from './hardware'
import { Sim, zeroInputs, type Inputs } from './sim'
import { BUILD_STEPS } from './steps'
import { buildWorld, skyEnvironment, HORIZON } from './world'
import { PILOT, WORKSHOP } from './pilot'

type Mode =
  | 'hero'
  | 'parts'
  | 'lift'
  | 'prop'
  | 'spin'
  | 'move'
  | 'brain'
  | 'power'
  | 'radio'
  | 'ladder'
  | 'kit'
  | 'build'
  | 'test'
  | 'fly'
  | 'rules'

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll(sel)) as T[]
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const touch = matchMedia('(hover: none), (pointer: coarse)').matches

// ================================================================ personal touch
// Copy says {pilot} and {workshop}; fill them in before anything reads the page.
{
  const fill = (s: string) => s.replaceAll('{pilot}', PILOT).replaceAll('{workshop}', WORKSHOP)
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n; n = walk.nextNode()) if (n.nodeValue?.includes('{')) n.nodeValue = fill(n.nodeValue)
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-title], [data-title-touch], [aria-label]')))
    for (const a of ['data-title', 'data-title-touch', 'aria-label']) {
      const v = el.getAttribute(a)
      if (v?.includes('{')) el.setAttribute(a, fill(v))
    }
  document.title = WORKSHOP
}

// Labels drawn onto the 3D parts use the page fonts; give them a moment to load.
await Promise.race([
  Promise.all(['600 21px "JetBrains Mono Variable"', '700 60px "Space Grotesk Variable"'].map((f) => document.fonts.load(f))),
  new Promise((r) => setTimeout(r, 1500)),
])

// ================================================================ scene
const canvas = $<HTMLCanvasElement>('#scene')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.NeutralToneMapping
renderer.toneMappingExposure = 1.05

const scene = new THREE.Scene()
scene.background = new THREE.Color(HORIZON)
scene.fog = new THREE.Fog(HORIZON, 40, 150)

const camera = new THREE.PerspectiveCamera(40, 1, 0.03, 400)
camera.position.set(4, 3, 6)
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.enablePan = false
controls.minDistance = 0.6
controls.maxDistance = 14
controls.maxPolarAngle = Math.PI * 0.49
controls.autoRotateSpeed = 0.55

const SUN_DIR = new THREE.Vector3(0.4, 0.62, 0.68).normalize()
scene.environment = skyEnvironment(renderer, SUN_DIR)
scene.environmentIntensity = 0.75
scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x8cc76a, 0.7))
const sun = new THREE.DirectionalLight(0xfff1d6, 2.6)
sun.castShadow = true
sun.shadow.mapSize.set(2048, 2048)
sun.shadow.camera.left = sun.shadow.camera.bottom = -3.2
sun.shadow.camera.right = sun.shadow.camera.top = 3.2
sun.shadow.camera.near = 1
sun.shadow.camera.far = 30
sun.shadow.bias = -0.0004
sun.shadow.normalBias = 0.015
scene.add(sun, sun.target)

const world = buildWorld(scene, SUN_DIR)
const drone = new Drone()
scene.add(drone.root)
const sim = new Sim()

const tmpV = new THREE.Vector3()
const tmpV2 = new THREE.Vector3()
const tmpQ = new THREE.Quaternion()

// ================================================================ air particles
const N = 900
const pPos = new Float32Array(N * 3)
const pVel = new Float32Array(N * 3)
const pLife = new Float32Array(N)
const pAlpha = new Float32Array(N)
const pGeo = new THREE.BufferGeometry()
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3))
pGeo.setAttribute('alpha', new THREE.BufferAttribute(pAlpha, 1))
const particles = new THREE.Points(
  pGeo,
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { color: { value: new THREE.Color(0xffffff) } },
    vertexShader: `attribute float alpha; varying float vA;
      void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0);
      gl_PointSize = 42.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
      gl_FragColor = vec4(color, vA * (1.0 - d * 2.0)); }`,
  }),
)
particles.frustumCulled = false
scene.add(particles)
let pNext = 0
const emitAcc = [0, 0, 0, 0]

function updateParticles(dt: number, on: boolean) {
  const up = tmpV2.set(0, 1, 0).applyQuaternion(drone.root.quaternion)
  if (on) {
    for (let i = 0; i < 4; i++) {
      const push = sim.u[i] * sim.lift
      emitAcc[i] += push * 170 * dt
      while (emitAcc[i] >= 1) {
        emitAcc[i] -= 1
        const k = pNext
        pNext = (pNext + 1) % N
        const r = 0.12 + Math.random() * 0.46
        const a = Math.random() * Math.PI * 2
        tmpV.set(MOTORS[i].x + r * Math.cos(a), PROP_Y - 0.02, MOTORS[i].z + r * Math.sin(a))
        drone.root.localToWorld(tmpV)
        pPos.set([tmpV.x, tmpV.y, tmpV.z], k * 3)
        const sp = 1.2 + 5 * push
        pVel[k * 3] = -up.x * sp + (Math.random() - 0.5) * 0.3
        pVel[k * 3 + 1] = -up.y * sp
        pVel[k * 3 + 2] = -up.z * sp + (Math.random() - 0.5) * 0.3
        pLife[k] = 1
      }
    }
  }
  const dp = drone.root.position
  for (let k = 0; k < N; k++) {
    if (pLife[k] <= 0) {
      pAlpha[k] = 0
      continue
    }
    pLife[k] -= dt * 1.1
    pPos[k * 3] += pVel[k * 3] * dt
    pPos[k * 3 + 1] += pVel[k * 3 + 1] * dt
    pPos[k * 3 + 2] += pVel[k * 3 + 2] * dt
    if (pPos[k * 3 + 1] < 0.03) {
      // Air hits the ground and spreads out sideways.
      pPos[k * 3 + 1] = 0.03
      const dx = pPos[k * 3] - dp.x
      const dz = pPos[k * 3 + 2] - dp.z
      const d = Math.hypot(dx, dz) || 1
      const sp = Math.abs(pVel[k * 3 + 1]) * 0.7
      pVel[k * 3] += (dx / d) * sp
      pVel[k * 3 + 2] += (dz / d) * sp
      pVel[k * 3 + 1] = 0
    }
    pAlpha[k] = Math.max(0, pLife[k]) * 0.55
  }
  pGeo.attributes.position.needsUpdate = true
  pGeo.attributes.alpha.needsUpdate = true
}

// ================================================================ energy and message pulses
const flowGroup = new THREE.Group()
drone.body.add(flowGroup)
const pulseGeo = new THREE.SphereGeometry(0.012, 12, 8)
interface Route {
  pts: [PartKey, number, number, number][]
  kind: 'energy' | 'msg'
  meshes: THREE.Mesh[]
  tmp: THREE.Vector3[]
}
const routes: Route[] = []
const energyMat = new THREE.MeshBasicMaterial({ color: 0xffc53d, depthTest: false, transparent: true })
const msgMat = new THREE.MeshBasicMaterial({ color: 0xa78bfa, depthTest: false, transparent: true })
const lead = drone.batteryLead
for (const m of MOTORS) {
  const sx = Math.sign(m.x)
  const sz = Math.sign(m.z)
  routes.push({
    kind: 'energy',
    pts: [
      ['battery', lead.x, lead.y, lead.z],
      ['battery', 0.02, 0.2, 0.62],
      ['esc', sx * 0.04, ESC_Y + 0.03, 0.15],
      ['esc', 0, ESC_Y + 0.03, 0],
      ['esc', sx * 0.13, ESC_Y + 0.03, sz * 0.13],
      ['motors', m.x * 0.62, ARM_TOP + 0.02, m.z * 0.62],
      ['motors', m.x, ARM_TOP + 0.08, m.z],
    ],
    meshes: [],
    tmp: [],
  })
}
routes.push({
  kind: 'msg',
  pts: [
    ['receiver', drone.antennaTip.x, drone.antennaTip.y, drone.antennaTip.z],
    ['receiver', drone.rxAt.x, drone.rxAt.y + 0.02, drone.rxAt.z],
    ['fc', 0, FC_Y + 0.03, 0.15],
    ['fc', 0.03, FC_Y + 0.03, 0.03],
    ['esc', 0, ESC_Y + 0.03, 0],
  ],
  meshes: [],
  tmp: [],
})
for (const r of routes) {
  r.tmp = r.pts.map(() => new THREE.Vector3())
  for (let i = 0; i < 7; i++) {
    const m = new THREE.Mesh(pulseGeo, r.kind === 'energy' ? energyMat : msgMat)
    m.renderOrder = 5
    r.meshes.push(m)
    flowGroup.add(m)
  }
}
let showEnergy = false
let showMsg = false
/** Energy can start at the ESC instead of the battery, when the battery is not the point. */
let energyFrom = 0
function updateFlow(t: number) {
  for (const r of routes) {
    const on = r.kind === 'energy' ? showEnergy : showMsg
    r.meshes.forEach((m) => (m.visible = on))
    if (!on) continue
    const start = r.kind === 'energy' ? energyFrom : 0
    r.pts.forEach(([k, x, y, z], i) => r.tmp[i].set(x, y, z).add(drone.parts[k].group.position))
    const pts = r.tmp.slice(start)
    const lens = pts.slice(1).map((p, i) => p.distanceTo(pts[i]))
    const total = lens.reduce((a, b) => a + b, 0)
    r.meshes.forEach((m, j) => {
      let d = (((t * 0.45 + j / r.meshes.length) % 1) + 1) % 1
      d *= total
      let s = 0
      while (s < lens.length - 1 && d > lens[s]) d -= lens[s++]
      m.position.lerpVectors(pts[s], pts[s + 1], lens[s] ? Math.min(1, d / lens[s]) : 0)
    })
  }
}

// ================================================================ radio waves and camera view cone
const waves = Array.from({ length: 3 }, () => {
  const w = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 96), new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, depthWrite: false }))
  w.visible = false
  scene.add(w)
  return w
})

const frustum = (() => {
  const g = new THREE.Group()
  const far = 2.4
  const hw = Math.tan(THREE.MathUtils.degToRad(35)) * far
  const hh = hw * 0.75
  const corners = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([x, y]) => new THREE.Vector3(x, y, -far))
  const lineGeo = new THREE.BufferGeometry().setFromPoints(corners.flatMap((c, i) => [new THREE.Vector3(), c, c, corners[(i + 1) % 4]]))
  g.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 })))
  const cone = new THREE.BufferGeometry().setFromPoints(corners.flatMap((c, i) => [new THREE.Vector3(), c, corners[(i + 1) % 4]]))
  cone.computeVertexNormals()
  g.add(new THREE.Mesh(cone, new THREE.MeshBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })))
  g.visible = false
  drone.eye.add(g)
  return g
})()
const fpvCam = new THREE.PerspectiveCamera(78, 4 / 3, 0.02, 200)
let fpvOn = false

// ================================================================ thrust arrows
const thrustArrows = MOTORS.map((m) => {
  const g = new THREE.Group()
  const mat = new THREE.MeshBasicMaterial({ color: spinColor(m.spin), transparent: true, opacity: 0.9 })
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 12).translate(0, 0.5, 0), mat)
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.12, 16).translate(0, 0.06, 0), mat)
  g.add(shaft, head)
  g.position.set(m.x, PROP_Y + 0.14, m.z)
  g.visible = false
  drone.root.add(g)
  return { g, shaft, head }
})
function updateThrustArrows() {
  thrustArrows.forEach(({ g, shaft, head }, i) => {
    const len = Math.max(0.001, sim.u[i] * sim.lift * 0.9)
    shaft.scale.y = len
    head.position.y = len
    head.visible = len > 0.02
    g.visible = thrustOn
  })
}
let thrustOn = false

// ================================================================ 5×4: the screw spiral
function textSprite(text: string, w = 0.7) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = 'rgba(15,23,42,0.78)'
  g.beginPath()
  g.roundRect(4, 14, 504, 100, 50)
  g.fill()
  g.fillStyle = '#ffffff'
  g.font = '600 54px "Space Grotesk Variable", sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText(text, 256, 66)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }))
  sp.scale.set(w, w / 4, 1)
  sp.renderOrder = 20
  return sp
}
const PITCH = 1.016 // 4 in, at 100 mm per scene unit
const helix = (() => {
  const m = MOTORS[3]
  const g = new THREE.Group()
  g.position.set(m.x, PROP_Y + 0.07, m.z)
  const r = PROP_R * 0.75
  // A clockwise prop screws upward as it turns clockwise (seen from above).
  const at = (u: number) => new THREE.Vector3(r * Math.cos(-u * Math.PI * 2), u * PITCH, r * Math.sin(-u * Math.PI * 2))
  const pts = Array.from({ length: 121 }, (_, i) => at(i / 120))
  const orange = new THREE.MeshBasicMaterial({ color: 0xff6a2b })
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.012, 8), orange))
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff })
  // 5 in across
  const dia = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, PROP_R * 2, 8), white)
  dia.rotation.z = Math.PI / 2
  dia.position.y = -0.1
  g.add(dia)
  for (const s of [-1, 1]) {
    const tick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 8), white)
    tick.position.set(s * PROP_R, -0.1, 0)
    g.add(tick)
  }
  const across = textSprite('5 in across')
  across.position.set(0, -0.24, 0)
  g.add(across)
  // 4 in per turn
  const bx = r
  const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, PITCH, 8), white)
  bracket.position.set(bx + 0.14, PITCH / 2, 0)
  g.add(bracket)
  for (const y of [0, PITCH]) {
    const tick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 8), white)
    tick.rotation.z = Math.PI / 2
    tick.position.set(bx + 0.14, y, 0)
    g.add(tick)
  }
  const perTurn = textSprite('4 in per turn', 0.78)
  perTurn.position.set(bx + 0.14 + 0.48, PITCH / 2, 0)
  g.add(perTurn)
  // a bead that rides the spiral, one turn at a time
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffc53d }))
  g.add(bead)
  g.visible = false
  drone.root.add(g)
  return { g, at, bead }
})()

// ================================================================ ring course
const HOOPS = [new THREE.Vector3(0, 1.5, -3.5), new THREE.Vector3(3, 2.5, -6.5), new THREE.Vector3(-2.5, 1.5, -9)]
const HOOP_COLORS = [0xff6a2b, 0xf5a524, 0x2a9df4]
const hoopMeshes = HOOPS.map((p, i) => {
  const geo = new THREE.TorusGeometry(0.75, 0.07, 14, 72)
  const pos = geo.attributes.position
  const cols = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let k = 0; k < pos.count; k++) {
    const a = Math.atan2(pos.getY(k), pos.getX(k)) + Math.PI
    c.setHex(Math.floor(a / (Math.PI / 8)) % 2 ? 0xffffff : HOOP_COLORS[i])
    cols.set([c.r, c.g, c.b], k * 3)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  const m = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, emissive: HOOP_COLORS[i], emissiveIntensity: 0.3, roughness: 0.5, transparent: true }),
  )
  m.position.copy(p)
  m.castShadow = true
  m.visible = false
  scene.add(m)
  return m
})
let hoopIdx = 0

// ================================================================ input
const inputs: Inputs = zeroInputs()
const padIn: Inputs = zeroInputs()
const keyIn: Inputs = zeroInputs()
const stickIn: Inputs = zeroInputs()
const keys = new Set<string>()
let throttleSlider = 0
let bladePitch = 18

function gatherInputs() {
  const clamp = (v: number) => Math.max(-1, Math.min(1, v))
  keyIn.climb = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0)
  keyIn.yaw = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0)
  keyIn.pitch = (keys.has('arrowup') ? 1 : 0) - (keys.has('arrowdown') ? 1 : 0)
  keyIn.roll = (keys.has('arrowright') ? 1 : 0) - (keys.has('arrowleft') ? 1 : 0)
  for (const k of ['climb', 'pitch', 'roll', 'yaw'] as const) inputs[k] = clamp(padIn[k] + keyIn[k] + stickIn[k])
  inputs.throttle = throttleSlider
}

const flyModes: Mode[] = ['move', 'radio', 'fly']
addEventListener('keydown', (e) => {
  const tag = (e.target as HTMLElement).tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  const k = e.key.toLowerCase()
  if (flyModes.includes(mode) && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
    keys.add(k)
    e.preventDefault()
    return
  }
  if (!toc.hidden) return
  if (k === 'arrowright' || k === 'pagedown') {
    next()
    e.preventDefault()
  } else if (k === 'arrowleft' || k === 'pageup') {
    back()
    e.preventDefault()
  }
})
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()))
addEventListener('blur', () => keys.clear())

// ================================================================ beats
const panel = $('#panel')
const panelBody = $('#panel-body')

// Build steps come from steps.ts, one step per screen.
{
  const host = $('#build-chapter')
  BUILD_STEPS.forEach((s, i) => {
    const b = document.createElement('div')
    b.className = 'beat'
    b.dataset.mode = 'build'
    b.dataset.step = String(i)
    b.dataset.title = `Step ${i + 1} of ${BUILD_STEPS.length}`
    b.innerHTML = `
      <p class="lvl">Step ${i + 1} of ${BUILD_STEPS.length}${s.grownup ? ' <em class="badge">grown-up help</em>' : ''}</p>
      <h2>${s.title}</h2><p>${s.body}</p>
      <p class="check"><b>Check it:</b> ${s.check}</p>`
    host.appendChild(b)
  })
}

interface Beat {
  el: HTMLElement
  chapter: HTMLElement
  id: string
  index: number
  mode: Mode
}
const chapters = $$<HTMLElement>('.chapter', panelBody)
const beats: Beat[] = []
for (const ch of chapters)
  $$<HTMLElement>('.beat', ch).forEach((el, index) => beats.push({ el, chapter: ch, id: ch.dataset.chapter!, index, mode: el.dataset.mode as Mode }))

let cur = -1
let mode: Mode = 'hero'

function goTo(i: number, dir = 1) {
  i = Math.max(0, Math.min(beats.length - 1, i))
  if (i === cur) return
  const prev = beats[cur]
  const b = beats[i]
  cur = i
  if (prev) prev.el.classList.remove('current', 'from-right', 'from-left')
  chapters.forEach((c) => c.classList.toggle('current', c === b.chapter))
  b.el.classList.add('current')
  if (!reduceMotion) {
    void b.el.offsetWidth
    b.el.classList.add(dir >= 0 ? 'from-right' : 'from-left')
  }
  panelBody.scrollTop = 0
  panel.classList.toggle('intro', b.id === 'intro')
  panel.classList.remove('folded')

  const ch = b.chapter
  $('#kicker').textContent = ch.dataset.num ? `${ch.dataset.num} · ${ch.dataset.name}` : ''
  $('#toc-num').textContent = ch.dataset.num ? `${ch.dataset.num}/14` : ''
  $('#toc-current').textContent = ch.dataset.num ? ch.dataset.name! : 'Chapters'
  const siblings = beats.filter((x) => x.id === b.id)
  $('#beat-dots').innerHTML = siblings.length > 1 ? siblings.map((s) => `<i class="${s.index === b.index ? 'on' : s.index < b.index ? 'done' : ''}"></i>`).join('') : ''
  $$('#toc-list a').forEach((a) => a.classList.toggle('on', a.dataset.chapter === b.id))
  $('#progress-fill').style.width = `${(i / (beats.length - 1)) * 100}%`
  ;($('#nav-back') as HTMLButtonElement).disabled = i === 0
  const nextBeat = beats[i + 1]
  $('#nav-next').hidden = !nextBeat
  $('#nav-next-label').textContent = !nextBeat ? '' : b.id === 'intro' ? 'Start' : nextBeat.id !== b.id ? `Next: ${nextBeat.chapter.dataset.name}` : 'Next'
  history.replaceState(null, '', `#${b.id}${b.index ? '/' + (b.index + 1) : ''}`)

  if (b.mode !== mode || !prev) setMode(b.mode)
  enterBeat(b)
}
function next() {
  goTo(cur + 1, 1)
}
function back() {
  goTo(cur - 1, -1)
}
function goChapter(id: string, index = 0) {
  const i = beats.findIndex((b) => b.id === id && b.index === index)
  if (i >= 0) goTo(i, i >= cur ? 1 : -1)
}
$('#nav-next').addEventListener('click', next)
$('#nav-back').addEventListener('click', back)
document.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLElement>('[data-go]')
  if (!a) return
  e.preventDefault()
  goChapter(a.dataset.go!)
})

// swipe the panel sideways to move between steps
{
  let sx = 0
  let sy = 0
  let tracking = false
  panel.addEventListener('pointerdown', (e) => {
    tracking = !(e.target as HTMLElement).closest('input, button, .pad, a, label, summary')
    sx = e.clientX
    sy = e.clientY
  })
  panel.addEventListener('pointerup', (e) => {
    if (!tracking) return
    tracking = false
    const dx = e.clientX - sx
    const dy = e.clientY - sy
    if (Math.abs(dx) > 60 && Math.abs(dy) < 45) {
      if (dx < 0) next()
      else back()
    }
  })
}

// grip: fold the panel away to see more of the 3D world
$('#panel-grip').addEventListener('click', () => panel.classList.toggle('folded'))

// ================================================================ chapter menu
{
  let html = ''
  let part = ''
  for (const ch of chapters) {
    const p = ch.dataset.part === '2' ? 'Part 2 · Build one' : ch.dataset.part === '1' ? 'Part 1 · How it works' : ''
    if (p !== part) {
      part = p
      html += `<h4 class="${ch.dataset.part === '2' ? 'p2' : ''}">${p}</h4>`
    }
    html += `<a href="#${ch.dataset.chapter}" data-chapter="${ch.dataset.chapter}"><b>${ch.dataset.num ?? '★'}</b><span>${ch.dataset.num ? ch.dataset.name : 'Welcome'}</span></a>`
  }
  $('#toc-list').innerHTML = html
}
const toc = $('#toc')
const tocBtn = $('#toc-btn')
function openToc(open: boolean) {
  toc.hidden = !open
  tocBtn.setAttribute('aria-expanded', String(open))
  if (open) ($('#toc-list a.on') ?? $('#toc-list a'))?.focus({ preventScroll: true })
}
tocBtn.addEventListener('click', () => openToc(toc.hidden))
$('#toc-close').addEventListener('click', () => openToc(false))
toc.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-chapter]')
  if (a) {
    e.preventDefault()
    e.stopPropagation()
    goChapter(a.dataset.chapter!)
    openToc(false)
  } else if (e.target === toc) openToc(false)
})
addEventListener('keydown', (e) => e.key === 'Escape' && !toc.hidden && openToc(false))

// ================================================================ modes
interface ModeCfg {
  cam: [number, number, number]
  target?: [number, number, number]
  follow?: boolean
  map?: boolean
  air?: boolean
  auto?: boolean
  enter?: () => void
}

let explodeGoal = 0
let explodeNow = 0
let propsOn = true
let spinVis = 1
let staticPose: THREE.Vector3 | null = null
let bob = false
let focus: PartKey | null = null
let labelsOn = false
let wobble = false

function flying(y = 1.3, bounds = 6) {
  sim.bench = null
  sim.brain = true
  sim.altHold = true
  sim.sameDir = false
  sim.lift = 1
  sim.ceiling = 5
  sim.bounds = bounds
  sim.reset(y)
}

function still(y: number, u = 0) {
  sim.bench = [u, u, u, u]
  sim.reset(0)
  staticPose = new THREE.Vector3(0, y, 0)
}

const MODES: Record<Mode, ModeCfg> = {
  hero: { cam: [3.2, 1.0, 4.4], target: [0, 1.35, 0], air: true, auto: true, enter: () => ((bob = true), flying(1.4)) },
  parts: { cam: [3.0, 1.5, 4.0], target: [0, 1.0, 0], auto: true, enter: () => still(0.9) },
  lift: {
    cam: [4.2, 1.0, 5.2],
    target: [0, 1.2, 0],
    map: true,
    air: true,
    enter: () => {
      flying(0)
      sim.altHold = false
      sim.ceiling = 2.6
      setThrottle(0)
    },
  },
  prop: { cam: [2.4, 0.75, 3.0], target: [0, 0.55, 0], map: true, air: true },
  spin: {
    cam: [0.01, 4.8, 2.8],
    follow: true,
    map: true,
    air: true,
    enter: () => {
      flying(1.3)
      sameDir.checked = false
      applySameDir()
      drone.showSpinArrows(true)
    },
  },
  move: { cam: [3.4, 2.0, 4.8], follow: true, map: true, air: true, enter: () => flying(1.3) },
  brain: {
    cam: [3.4, 1.5, 4.6],
    follow: true,
    map: true,
    air: true,
    enter: () => {
      flying(1.5)
      brainOn.checked = true
      sim.brain = true
    },
  },
  power: {
    cam: [2.4, 1.6, 3.2],
    target: [0, 1.25, 0],
    enter: () => {
      still(0.8, 0.35)
      explodeGoal = 0.5
      drone.explodeOnly = ['battery', 'fc']
    },
  },
  radio: { cam: [0, 2.2, 5.6], follow: true, map: true, air: true, enter: () => flying(1.3) },
  ladder: { cam: [-3.6, 1.2, 4.4], target: [0, 1.35, 0], air: true, auto: true, enter: () => ((bob = true), flying(1.4)) },
  kit: {
    cam: [4.4, 2.4, 5.4],
    target: [0, 1.5, 0],
    auto: true,
    enter: () => {
      still(0.7)
      explodeGoal = 1
      labelsOn = true
    },
  },
  build: { cam: [2.8, 1.4, 3.6], target: [0, 0.4, 0], enter: () => still(0) },
  test: {
    cam: [0.01, 4.4, 3.2],
    target: [0, 0.2, 0],
    map: true,
    enter: () => {
      still(0, 0.3)
      propsOn = false
      spinVis = 0.45
      drone.showSpinArrows(true)
      drone.arrowsTurn = false
      newTest()
    },
  },
  fly: {
    cam: [0, 2.7, 6.6],
    follow: true,
    air: true,
    enter: () => {
      flying(0, 11)
      resetHoops()
    },
  },
  rules: { cam: [3.8, 1.3, -4.4], target: [0, 1.35, 0], air: true, auto: true, enter: () => ((bob = true), flying(1.4)) },
}

let camAnim = 1
const camFrom = new THREE.Vector3()
const tgtFrom = new THREE.Vector3()
const camOffset = new THREE.Vector3()
const fixedTarget = new THREE.Vector3()
const followTarget = new THREE.Vector3()
let camFollow = false

function setMode(m: Mode) {
  mode = m
  explodeGoal = 0
  propsOn = true
  spinVis = 1
  staticPose = null
  bob = false
  labelsOn = false
  wobble = false
  showEnergy = showMsg = false
  energyFrom = 0
  drone.showSpinArrows(false)
  drone.setVisSpin(MOTORS.map((x) => x.spin))
  drone.explodeOnly = null
  drone.arrowsTurn = true
  drone.setHighlight(null)
  drone.setBuildStep(99, false)
  hoopMeshes.forEach((h) => (h.visible = m === 'fly'))
  helix.g.visible = false
  thrustOn = false
  drone.setBladePitch(18)
  sim.lift = 1
  Object.assign(padIn, zeroInputs())
  Object.assign(stickIn, zeroInputs())
  keys.clear()
  MODES[m].enter?.()
}

/** Point the camera at a target from an offset, with an eased move. */
function shoot(cam: [number, number, number], target: THREE.Vector3, follow: boolean, auto: boolean) {
  measure()
  camOffset.set(...cam).multiplyScalar(fit)
  fixedTarget.copy(target)
  camFollow = follow
  camFrom.copy(camera.position)
  tgtFrom.copy(controls.target)
  camAnim = 0
  controls.autoRotate = auto && !reduceMotion
}

const FOCUS_SHOTS: Record<string, { dir: [number, number, number]; dist: number; at?: () => THREE.Vector3 }> = {
  frame: { dir: [1, 0.9, 1.2], dist: 3.4 },
  motors: { dir: [0.9, 0.55, 1.1], dist: 0.95, at: () => new THREE.Vector3(MOTORS[1].x, 0.2, MOTORS[1].z) },
  props: { dir: [1, 1.1, 1.2], dist: 3.6 },
  battery: { dir: [1, 0.7, 1.1], dist: 1.6 },
  esc: { dir: [0.8, 1.2, 1], dist: 1.25, at: () => new THREE.Vector3(0, ESC_Y + 0.02, 0) },
  fc: { dir: [0.7, 1.3, 1], dist: 1.2, at: () => new THREE.Vector3(0, FC_Y + 0.02, 0) },
  receiver: { dir: [0.9, 0.9, 1.3], dist: 1.4, at: () => new THREE.Vector3(0.03, 0.34, 0.4) },
  camera: { dir: [0.9, 0.35, -1.2], dist: 1.25, at: () => new THREE.Vector3(0, 0.24, -0.5) },
}

function enterBeat(b: Beat) {
  const el = b.el
  const cfg = MODES[b.mode]
  focus = (el.dataset.focus as PartKey) ?? null
  drone.setFocus(focus)
  drone.setCutaway(focus === 'motors')
  drone.gizmo.visible = focus === 'fc'
  frustum.visible = focus === 'camera'
  waves.forEach((w) => (w.visible = focus === 'receiver'))
  wobble = focus === 'fc'
  fpvOn = focus === 'camera' || b.mode === 'fly'
  $('#fpv').classList.toggle('on', fpvOn)
  $('#hud').classList.toggle('sticks-on', 'sticks' in el.dataset)
  const hook = el.dataset.hook
  const mapOn = !!cfg.map || focus === 'esc' || focus === 'fc'
  $('#motormap').classList.toggle('on', mapOn && !fpvOn)
  $('#stage-chip').textContent = (touch && el.dataset.titleTouch) || el.dataset.title || ''

  if (b.mode === 'parts') {
    labelsOn = hook === 'explode'
    explodeGoal = hook === 'explode' ? 1 : 0
    setExplodeLabel()
    showEnergy = focus === 'battery' || focus === 'esc'
    energyFrom = focus === 'esc' ? 3 : 0
    showMsg = focus === 'receiver'
    const u = focus === 'props' ? 0.8 : focus === 'motors' ? 0.45 : focus === 'battery' || focus === 'esc' ? 0.3 : 0
    sim.bench = [u, u, u, u]
    spinVis = focus === 'motors' ? 0.5 : 1
    if (!focus) drone.root.quaternion.identity()
  }
  if (b.mode === 'lift') {
    if (hook === 'hover') {
      sim.altHold = true
      sim.holdY = 1.2
      sim.grounded = false
    } else {
      sim.altHold = false
      throttleSlider = Number(throttleEl.value) / 100
    }
  }
  const shot = el.dataset.shot
  if (b.mode === 'prop') {
    helix.g.visible = shot === 'prop-close'
    if (shot) {
      // hold the drone still, one prop turning slowly
      still(0.9, shot === 'prop-slow' ? 0.75 : 0.3)
      spinVis = 0.1
      drone.setBladePitch(18)
      sim.lift = 0.72
    } else {
      staticPose = null
      spinVis = 1
      flying(0)
      sim.altHold = false
      sim.ceiling = 0.9
      throttleSlider = 0.75
      setPitch(bladePitch)
    }
  }
  thrustOn = b.mode === 'lift' || (b.mode === 'prop' && !shot)
  if (b.mode === 'power') setFlow(Number(el.dataset.flow ?? 0))
  if (b.mode === 'build') showStep(Number(el.dataset.step ?? 0))
  if (hook === 'test') newTest()

  const fs = focus ? FOCUS_SHOTS[focus] : null
  if (fs) {
    drone.root.position.copy(staticPose ?? drone.root.position)
    drone.root.quaternion.identity()
    drone.root.updateMatrixWorld(true)
    const at = fs.at ? drone.root.localToWorld(fs.at()) : drone.centerWorld(focus!, new THREE.Vector3())
    const off = new THREE.Vector3(...fs.dir).normalize().multiplyScalar(fs.dist)
    shoot([off.x, off.y, off.z], at, false, true)
  } else if (shot === 'prop-slow') {
    shoot([0.8, 0.28, 1.0], new THREE.Vector3(MOTORS[3].x, 0.9 + PROP_Y, MOTORS[3].z), false, false)
  } else if (shot === 'prop-close') {
    shoot([1.9, 0.45, 2.3], new THREE.Vector3(MOTORS[3].x + 0.25, 0.9 + PROP_Y + 0.42, MOTORS[3].z), false, false)
  } else if (b.mode === 'parts' && hook === 'explode') {
    shoot([3.6, 1.8, 4.6], new THREE.Vector3(0, 1.6, 0), false, true)
  } else {
    shoot(cfg.cam, new THREE.Vector3(...(cfg.target ?? [0, 1.3, 0])), !!cfg.follow, !!cfg.auto)
  }
  if (b.mode === 'fly') paintHoops()
}

// ================================================================ toast and text
let toastTimer = 0
function toast(msg: string) {
  const el = $('#toast')
  el.textContent = msg
  el.classList.add('on')
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => el.classList.remove('on'), 2200)
}
function put(el: HTMLElement, text: string) {
  if (el.textContent !== text) el.textContent = text
}
sim.onCrash = () => {
  if (mode === 'brain')
    put($('#brain-status'), sim.brain ? 'Crash! That gust was too strong.' : 'Crash. With no brain, nothing caught the tip. Turn the brain back on.')
  toast('Crash! Resetting…')
}
// Status lines fade in whenever their words change.
const flash = new MutationObserver((list) => {
  for (const m of list) {
    const el = (m.target.nodeType === 1 ? m.target : m.target.parentElement) as HTMLElement
    const box = el.closest('.status, .chip') as HTMLElement | null
    if (!box || reduceMotion) continue
    box.classList.remove('flash')
    void box.offsetWidth
    box.classList.add('flash')
  }
})
$$('.status, #stage-chip').forEach((el) => flash.observe(el, { childList: true, characterData: true, subtree: true }))

// ================================================================ callout labels for the whole drone
const PART_NAMES: Record<string, string> = {
  frame: 'Frame',
  motors: 'Motors',
  props: 'Propellers',
  battery: 'Battery',
  esc: 'Speed controllers',
  fc: 'Flight controller',
  receiver: 'Receiver',
  camera: 'Camera',
}
const LABEL_KEYS: PartKey[] = ['frame', 'motors', 'props', 'battery', 'esc', 'fc', 'receiver', 'camera']
const labelEls = LABEL_KEYS.map((k) => {
  const b = document.createElement('button')
  b.className = 'label'
  b.textContent = PART_NAMES[k]
  b.addEventListener('click', () => {
    const i = beats.findIndex((x) => x.id === 'parts' && x.el.dataset.focus === k)
    if (i >= 0) goTo(i, -1)
  })
  $('#labels').appendChild(b)
  return b
})
const callouts = $<SVGSVGElement>('#callouts')
const labelTmp = new THREE.Vector3()
function updateLabels() {
  const { left, right, top, bottom } = free
  const pts = LABEL_KEYS.map((k, i) => {
    drone.labelWorld(k, labelTmp).project(camera)
    return { i, x: (labelTmp.x * 0.5 + 0.5) * innerWidth, y: (-labelTmp.y * 0.5 + 0.5) * innerHeight }
  })
  const mid = (left + right) / 2
  const cols = [pts.filter((p) => p.x < mid), pts.filter((p) => p.x >= mid)]
  const gap = innerWidth < 600 ? 30 : 38
  let svg = ''
  cols.forEach((col, side) => {
    col.sort((a, b) => a.y - b.y)
    const ys: number[] = []
    let y = top + 18
    for (const p of col) {
      y = Math.max(y, p.y)
      ys.push(y)
      y += gap
    }
    const over = ys.length ? ys[ys.length - 1] - (bottom - 22) : 0
    if (over > 0) for (let k = 0; k < ys.length; k++) ys[k] -= over
    col.forEach((p, k) => {
      const el = labelEls[p.i]
      const ly = ys[k]
      const lx = side === 0 ? left + 14 : right - 14
      el.style.transform = side === 0 ? `translate(${lx}px, ${ly}px) translate(0, -50%)` : `translate(${lx}px, ${ly}px) translate(-100%, -50%)`
      const w = el.offsetWidth
      const ex = side === 0 ? lx + w : lx - w
      const kx = ex + (side === 0 ? 16 : -16)
      svg += `<path d="M${ex} ${ly} L${kx} ${ly} L${p.x} ${p.y}"/><circle cx="${p.x}" cy="${p.y}" r="3.5"/>`
    })
  })
  callouts.innerHTML = svg
}
const explodeBtn = $('#explode-toggle')
function setExplodeLabel() {
  explodeBtn.textContent = explodeGoal > 0.5 ? 'Put it back together' : 'Take it apart'
}
explodeBtn.addEventListener('click', () => {
  explodeGoal = explodeGoal > 0.5 ? 0 : 1
  labelsOn = explodeGoal > 0.5
  setExplodeLabel()
})

// ================================================================ lift
const throttleEl = $<HTMLInputElement>('#throttle')
function fillRange(el: HTMLInputElement) {
  el.style.setProperty('--fill', `${((Number(el.value) - Number(el.min)) / (Number(el.max) - Number(el.min))) * 100}%`)
}
function setThrottle(v: number) {
  throttleSlider = v / 100
  throttleEl.value = String(v)
  fillRange(throttleEl)
  $('#throttle-out').textContent = `${v}%`
  $('#bar-thrust').style.width = `${v}%`
}
throttleEl.addEventListener('input', () => {
  sim.altHold = false
  setThrottle(Number(throttleEl.value))
})
function liftStatus() {
  const v = Number(throttleEl.value)
  if (v === 0) return 'Motors off. The drone sits.'
  if (v < 50) return sim.grounded ? 'Some thrust, but gravity is stronger. It stays down.' : 'Thrust is weaker than gravity, so it sinks.'
  if (v === 50) return sim.grounded ? 'Exactly balanced. Push a little more to take off.' : 'Thrust equals gravity. A hover!'
  return sim.pos.y >= sim.ceiling - 0.01 ? 'Thrust beats gravity. Slide back to 50% to hover.' : 'Thrust beats gravity. It climbs!'
}

// ================================================================ prop pitch: side view of one blade
const SVGNS = 'http://www.w3.org/2000/svg'
const AF = { cx: 160, cy: 86 }
const streamYs = [26, 44, 62, 110, 128, 146]
const streams = streamYs.map(() => {
  const p = document.createElementNS(SVGNS, 'path')
  p.setAttribute('class', 'af-stream')
  $('#af-streams').appendChild(p)
  return p
})
const downArrows = [236, 262, 288].map(() => {
  const l = document.createElementNS(SVGNS, 'line')
  l.setAttribute('class', 'af-down')
  l.setAttribute('marker-end', 'url(#af-down)')
  $('#af-down-arrows').appendChild(l)
  return l
})
function drawAirfoil(deg: number) {
  const k = deg / 25
  const smooth = (x: number) => {
    const t = THREE.MathUtils.clamp(x, 0, 1)
    return t * t * (3 - 2 * t)
  }
  // Air flows past the blade (left to right, since the blade moves left) and leaves bent down.
  streams.forEach((p, i) => {
    const y0 = streamYs[i]
    const close = Math.max(0, 1 - Math.abs(y0 - AF.cy) / 72)
    const side = y0 < AF.cy ? -1 : 1
    let d = ''
    for (let x = -10; x <= 330; x += 8) {
      const near = Math.exp(-(((x - AF.cx) / 55) ** 2))
      const y = y0 + side * 9 * close * near + deg * 1.9 * (0.35 + 0.65 * close) * smooth((x - 110) / 150)
      d += `${d ? 'L' : 'M'}${x} ${y.toFixed(1)}`
    }
    p.setAttribute('d', d)
    p.style.opacity = String(0.35 + 0.55 * close)
  })
  $('#af-blade-g').setAttribute('transform', `translate(${AF.cx} ${AF.cy}) rotate(${deg})`)
  // tilt angle, measured at the front (left) edge
  const r = 64
  const a = THREE.MathUtils.degToRad(deg)
  $('#af-arc').setAttribute('d', deg > 0 ? `M${AF.cx - r} ${AF.cy} A${r} ${r} 0 0 1 ${(AF.cx - r * Math.cos(a)).toFixed(1)} ${(AF.cy - r * Math.sin(a)).toFixed(1)}` : '')
  const degEl = $('#af-deg')
  degEl.textContent = `${deg}°`
  degEl.setAttribute('x', String(AF.cx - r - 8))
  degEl.setAttribute('y', String(AF.cy - 4 - deg * 0.6))
  // push up, and air thrown down
  const lift = $('#af-lift')
  lift.setAttribute('y2', String(AF.cy - 8 - k * 52))
  lift.style.opacity = deg > 0 ? '1' : '0'
  const lbl = $('#af-lift-label')
  lbl.setAttribute('y', String(AF.cy - 14 - k * 52))
  lbl.style.opacity = deg > 0 ? '1' : '0'
  downArrows.forEach((l, i) => {
    const x = 236 + i * 26
    l.setAttribute('x1', String(x))
    l.setAttribute('y1', String(AF.cy + 12 + deg * 0.9))
    l.setAttribute('x2', String(x + 4 + k * 8))
    l.setAttribute('y2', String(AF.cy + 18 + deg * 0.9 + k * 34))
    l.style.opacity = deg > 1 ? String(0.4 + 0.6 * k) : '0'
  })
  $('#af-air-label').textContent = deg === 0 ? 'air slides straight past' : 'air thrown down'
  $('#af-air-label').style.opacity = '1'
}

const pitchEl = $<HTMLInputElement>('#pitch')
function setPitch(deg: number) {
  bladePitch = deg
  pitchEl.value = String(deg)
  fillRange(pitchEl)
  $('#pitch-out').textContent = `${deg}°`
  drone.setBladePitch(deg)
  sim.lift = deg / 25
  drawAirfoil(deg)
  put(
    $('#prop-status'),
    deg === 0
      ? 'Flat blades push nothing. The motors spin, but the drone stays put.'
      : sim.lift * 1.5 < 1
        ? 'Some air goes down, but not enough to beat gravity.'
        : 'Enough air pushed down. The drone lifts off!',
  )
}
pitchEl.addEventListener('input', () => setPitch(Number(pitchEl.value)))

// ================================================================ spin
const sameDir = $<HTMLInputElement>('#same-dir')
function applySameDir() {
  sim.sameDir = sameDir.checked
  drone.setVisSpin(sameDir.checked ? [1, 1, 1, 1] : MOTORS.map((m) => m.spin))
  put(
    $('#spin-status'),
    sameDir.checked
      ? 'All four twist the same way. Nothing cancels, so the whole drone spins the opposite way. Even the brain cannot fix that.'
      : 'Two twist one way, two the other. They cancel. The drone holds still.',
  )
  if (!sameDir.checked) sim.ry = 0
}
sameDir.addEventListener('change', applySameDir)

// ================================================================ move pad
const MOVE_TEXT: Record<string, string> = {
  'climb:1': 'Up: all four motors speed up. Thrust beats gravity, so it rises.',
  'climb:-1': 'Down: all four slow down. Gravity wins a little, so it sinks.',
  'pitch:1': 'Forward: the back motors speed up. The nose dips, the push leans forward, and off it goes.',
  'pitch:-1': 'Back: the front motors speed up. The nose lifts and it backs away.',
  'roll:-1': 'Left: the right motors speed up. It leans left and slides left.',
  'roll:1': 'Right: the left motors speed up. It leans right and slides right.',
  'yaw:-1': 'Turn left: the orange (clockwise) pair speeds up. Their twist wins and turns the body counter-clockwise.',
  'yaw:1': 'Turn right: the blue (counter-clockwise) pair speeds up. Their twist wins and turns the body clockwise.',
}
$$<HTMLButtonElement>('#move-pad button').forEach((b) => {
  const [k, v] = b.dataset.in!.split(':') as [keyof Inputs, string]
  const on = (e: PointerEvent) => {
    e.preventDefault()
    b.setPointerCapture(e.pointerId)
    padIn[k] = Number(v)
    b.classList.add('on')
    put($('#move-status'), MOVE_TEXT[b.dataset.in!])
  }
  const off = () => {
    padIn[k] = 0
    b.classList.remove('on')
  }
  b.addEventListener('pointerdown', on)
  b.addEventListener('pointerup', off)
  b.addEventListener('pointercancel', off)
  b.addEventListener('contextmenu', (e) => e.preventDefault())
})

// ================================================================ brain
const brainOn = $<HTMLInputElement>('#brain-on')
brainOn.addEventListener('change', () => {
  sim.brain = brainOn.checked
  if (brainOn.checked && (sim.crashed || sim.grounded)) sim.reset(1.5)
  put($('#brain-status'), brainOn.checked ? 'Brain on. Send a gust and watch it catch itself.' : 'Brain off. The motors just run at the same speed. Now send a gust.')
})
let gustAt = -10
$('#gust').addEventListener('click', () => {
  if (sim.crashed) return
  if (sim.grounded) sim.reset(1.5)
  sim.gust()
  gustAt = clock.elapsedTime
  put($('#brain-status'), sim.brain ? 'Caught it! The low side jumped to push it back to level.' : 'No brain. Nothing catches the tip, and it keeps going…')
})
let loopCount = 0

// ================================================================ power flow
const FLOW_PARTS: PartKey[] = ['battery', 'esc', 'motors', 'receiver', 'fc']
function setFlow(i: number) {
  drone.setHighlight(FLOW_PARTS[i])
  showEnergy = i <= 2
  showMsg = i >= 3
}
const coilSvg = $('#coils')
const NS = 'http://www.w3.org/2000/svg'
const coilEls: SVGRectElement[] = []
for (let i = 0; i < 9; i++) {
  const g = document.createElementNS(NS, 'g')
  g.setAttribute('transform', `rotate(${(i / 9) * 360} 100 100)`)
  const r = document.createElementNS(NS, 'rect')
  r.setAttribute('x', '90')
  r.setAttribute('y', '10')
  r.setAttribute('width', '20')
  r.setAttribute('height', '34')
  r.setAttribute('rx', '5')
  r.setAttribute('class', 'coil')
  g.appendChild(r)
  coilSvg.appendChild(g)
  coilEls.push(r)
}
const rotor = document.createElementNS(NS, 'g')
rotor.innerHTML = `<circle cx="100" cy="100" r="46" class="rotor"/>
  <path d="M100 58 a42 42 0 0 1 0 84" class="mag-n"/><path d="M100 58 a42 42 0 0 0 0 84" class="mag-s"/>
  <text x="120" y="105" class="mag-t">N</text><text x="74" y="105" class="mag-t">S</text>
  <circle cx="100" cy="100" r="8" class="shaft"/>`
coilSvg.appendChild(rotor)
function updateCoils(t: number) {
  const phase = t * 3
  const lit = Math.floor(phase) % 9
  coilEls.forEach((c, i) => c.classList.toggle('lit', i === lit))
  rotor.setAttribute('transform', `rotate(${(phase - 0.35) * 40 - 90} 100 100)`)
}

// ================================================================ sticks
$$<HTMLElement>('#stage-sticks .stick').forEach((el) => {
  const knob = el.querySelector('i') as HTMLElement
  const left = el.dataset.stick === 'left'
  let id: number | null = null
  const set = (x: number, y: number) => {
    knob.style.transform = `translate(${x * 34}px, ${y * 34}px)`
    if (left) {
      stickIn.yaw = x
      stickIn.climb = -y
    } else {
      stickIn.roll = x
      stickIn.pitch = -y
    }
  }
  const move = (e: PointerEvent) => {
    const r = el.getBoundingClientRect()
    let x = ((e.clientX - r.left) / r.width) * 2 - 1
    let y = ((e.clientY - r.top) / r.height) * 2 - 1
    const d = Math.hypot(x, y)
    if (d > 1) {
      x /= d
      y /= d
    }
    set(x, y)
  }
  el.addEventListener('pointerdown', (e) => {
    id = e.pointerId
    el.setPointerCapture(id)
    el.classList.add('on')
    move(e)
  })
  el.addEventListener('pointermove', (e) => e.pointerId === id && move(e))
  const up = (e: PointerEvent) => {
    if (e.pointerId !== id) return
    id = null
    el.classList.remove('on')
    set(0, 0)
  }
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
})
$$('[data-reset]').forEach((b) =>
  b.addEventListener('click', () => {
    if (mode === 'fly') resetHoops()
    sim.reset(mode === 'fly' ? 0 : 1.3)
  }),
)

// ================================================================ build
const BUILD_KEYS: PartKey[] = ['frame', 'motors', 'esc', 'fc', 'receiver', 'camera', 'battery', 'props']
function showStep(i: number) {
  drone.setBuildStep(i + 1)
  drone.setHighlight(BUILD_KEYS[i])
}

// ================================================================ motor test game
let wrongMotor = 0
function newTest() {
  let n = wrongMotor
  while (n === wrongMotor) n = Math.floor(Math.random() * 4)
  wrongMotor = n
  drone.setVisSpin(
    MOTORS.map((m, i) => (i === wrongMotor ? (-m.spin as Spin) : m.spin)),
    false,
  )
  put($('#test-status'), 'Which one is backwards?')
  $$('#motor-pick button').forEach((b) => b.classList.remove('good', 'bad'))
}
$$<HTMLButtonElement>('#motor-pick button').forEach((b) =>
  b.addEventListener('click', () => {
    const i = Number(b.dataset.m)
    if (i === wrongMotor) {
      b.classList.add('good')
      drone.setVisSpin(MOTORS.map((m) => m.spin))
      put($('#test-status'), `Found it: the ${MOTORS[i].name.toLowerCase()} motor. Fix it by swapping any two of its three wires, or flip it in the setup app.`)
    } else {
      b.classList.add('bad')
      put($('#test-status'), `Not that one. The ${MOTORS[i].name.toLowerCase()} stripe turns the same way as its arrow.`)
    }
  }),
)
$('#test-again').addEventListener('click', newTest)

// ================================================================ checklist and rings
const checks = $$<HTMLInputElement>('#checklist input')
checks.forEach((c) =>
  c.addEventListener('change', () => {
    const n = checks.filter((x) => x.checked).length
    put($('#check-status'), n === checks.length ? 'All set. Cleared for takeoff!' : `${n} of ${checks.length} checked`)
    $('#check-status').classList.toggle('good', n === checks.length)
  }),
)
function resetHoops() {
  hoopIdx = 0
  paintHoops()
}
function paintHoops() {
  hoopMeshes.forEach((h, i) => {
    const m = h.material as THREE.MeshStandardMaterial
    m.opacity = i < hoopIdx ? 0.15 : i === hoopIdx ? 1 : 0.4
    m.emissiveIntensity = i === hoopIdx ? 0.45 : 0
  })
  if (mode === 'fly') put($('#stage-chip'), `Rings: ${Math.min(hoopIdx, HOOPS.length)} of ${HOOPS.length}`)
  put($('#ring-status'), hoopIdx >= HOOPS.length ? 'All three rings! Nice flying.' : `Next: ring ${hoopIdx + 1} of ${HOOPS.length}.`)
}

// ================================================================ HUD
const mmMotors = $$<SVGGElement>('#motormap .mm-motor')
function updateMotorMap() {
  mmMotors.forEach((g, i) => {
    const u = sim.u[i]
    ;(g.querySelector('.mm-fill') as SVGCircleElement).setAttribute('r', String(4 + u * 16))
    ;(g.querySelector('text') as SVGTextElement).textContent = String(Math.round(u * 100))
  })
}

// ================================================================ layout: keep the drone in the open part of the screen
const free = { left: 0, right: 0, top: 0, bottom: 0 }
/** How far to pull the camera back so shots fit the open part of the screen. */
let fit = 1
function measure() {
  const W = innerWidth
  const H = innerHeight
  const topH = $('.topbar').getBoundingClientRect().bottom
  const sheet = getComputedStyle(panel).getPropertyValue('--layout').trim() === 'sheet'
  const r = panel.getBoundingClientRect()
  free.left = sheet ? 0 : r.right
  free.right = W
  free.top = topH
  free.bottom = sheet ? r.top : H
  const root = document.documentElement.style
  root.setProperty('--free-left', `${free.left}px`)
  root.setProperty('--free-bottom', `${H - free.bottom}px`)
  renderer.setSize(W, H, false)
  camera.aspect = W / H
  camera.fov = W / H < 0.8 ? 50 : 40
  // Shots are framed for a laptop, where the open area is about 0.67 × 0.82 of a
  // unit-distance view. Back the camera off when the open area is smaller than that.
  const t = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  const visH = (t * (free.bottom - free.top)) / H
  const visW = (visH * (free.right - free.left)) / Math.max(1, free.bottom - free.top)
  fit = THREE.MathUtils.clamp(Math.max(0.67 / visH, 0.82 / visW), 1, 2.4)
  // shift the picture so its centre sits in the middle of the open area
  viewGoal.x = W / 2 - (free.left + free.right) / 2
  viewGoal.y = H / 2 - (free.top + free.bottom) / 2
  if (!viewReady) {
    view.copy(viewGoal)
    viewReady = true
  }
  applyView()
}
const view = new THREE.Vector2()
const viewGoal = new THREE.Vector2()
let viewReady = false
function applyView() {
  camera.setViewOffset(innerWidth, innerHeight, view.x, view.y, innerWidth, innerHeight)
  camera.updateProjectionMatrix()
}
new ResizeObserver(measure).observe(panel)
addEventListener('resize', measure)

// ================================================================ loop
const clock = new THREE.Clock()
const SIM_DT = 1 / 120
let simAcc = 0
const wobbleEuler = new THREE.Euler()
function frame() {
  const raw = clock.getDelta()
  const dt = Math.min(raw, 1 / 30)
  const t = clock.elapsedTime
  gatherInputs()

  // Part demos drive the motors directly.
  if (mode === 'parts' && wobble) {
    // p > 0: nose up, so the back motors push harder; r > 0: left side low, so the left motors push harder
    const p = Math.sin(t * 1.3) * 0.22
    const r = Math.sin(t * 0.9 + 1) * 0.22
    sim.bench = MOTORS.map((m) => THREE.MathUtils.clamp(0.5 + Math.sign(m.z) * p * 1.3 - Math.sign(m.x) * r * 1.3, 0, 1))
  }
  if (mode === 'parts' && focus === 'esc') sim.bench = MOTORS.map((_, i) => 0.35 + 0.3 * Math.sin(t * 1.6 + i * 1.7))

  simAcc += Math.min(raw, 0.25)
  while (simAcc >= SIM_DT) {
    sim.step(SIM_DT, inputs)
    simAcc -= SIM_DT
  }

  if (staticPose) {
    drone.root.position.copy(staticPose)
    if (wobble) drone.root.quaternion.setFromEuler(wobbleEuler.set(Math.sin(t * 1.3) * 0.22, 0, Math.sin(t * 0.9 + 1) * 0.22))
    else drone.root.quaternion.identity()
  } else {
    drone.root.position.copy(sim.pos)
    if (bob) drone.root.position.y += Math.sin(t * 1.6) * 0.06
    drone.root.quaternion.copy(sim.quaternion)
  }
  explodeNow += (explodeGoal - explodeNow) * Math.min(1, dt * 3)
  drone.setExplode(explodeNow)
  drone.update(dt, t, sim.u, spinVis, propsOn)
  drone.root.updateMatrixWorld(true)

  // Part demos: lights, coils, glow, radio waves
  const blink = (k: number) => (Math.sin(t * 6 + k) > 0 ? 1 : 0.15)
  drone.frameLeds.forEach((l, k) => ((l.material as THREE.MeshStandardMaterial).emissiveIntensity = focus === 'frame' ? 0.4 + 2.6 * blink(k * 0.5) : 2.4))
  drone.escLeds.forEach((l, k) => ((l.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + 2.4 * blink(k * 1.3 + t)))
  drone.fcLeds.forEach((l, k) => ((l.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + 2.4 * blink(k * 2)))
  const coilsOn = focus === 'motors' || (mode === 'power' && beats[cur]?.el.dataset.flow === '2')
  drone.firePhases(Math.floor(t * 7) % 3, coilsOn ? 2.2 : 0)
  const glow = focus === 'battery' ? 0.12 + 0.12 * Math.sin(t * 4) : 0
  drone.batteryGlow.forEach((m) => (m.emissiveIntensity = glow))
  if (focus === 'receiver') {
    const tip = drone.root.localToWorld(tmpV.copy(drone.antennaTip))
    waves.forEach((w, k) => {
      const p = (t * 0.55 + k / 3) % 1
      w.position.copy(tip)
      w.quaternion.copy(camera.quaternion)
      w.scale.setScalar(1.6 * (1 - p) + 0.04)
      ;(w.material as THREE.MeshBasicMaterial).opacity = Math.min(1, p * 2) * (1 - Math.max(0, p - 0.85) / 0.15)
    })
    ;(drone.rxLed.material as THREE.MeshStandardMaterial).emissiveIntensity = (t * 0.55 * 3) % 1 > 0.85 ? 4 : 0.4
  }

  // Camera
  followTarget.copy(camFollow ? drone.root.position : fixedTarget)
  if (camFollow) followTarget.y = Math.max(0.8, followTarget.y + 0.2)
  if (camAnim < 1) {
    camAnim = Math.min(1, camAnim + dt / 1.3)
    const e = 1 - Math.pow(1 - camAnim, 3)
    controls.target.lerpVectors(tgtFrom, followTarget, e)
    camera.position.lerpVectors(camFrom, tmpV.copy(followTarget).add(camOffset), e)
  } else if (camFollow) {
    const d = tmpV.copy(followTarget).sub(controls.target).multiplyScalar(Math.min(1, dt * 4))
    controls.target.add(d)
    camera.position.add(d)
  }
  if (view.distanceTo(viewGoal) > 0.5) {
    view.lerp(viewGoal, Math.min(1, dt * 6))
    applyView()
  }
  controls.minDistance = focus ? 0.5 : 1.6
  controls.update()
  sun.position.copy(drone.root.position).addScaledVector(SUN_DIR, 14)
  sun.target.position.copy(drone.root.position)

  world.update(t)
  updateParticles(dt, (!!MODES[mode].air || focus === 'props') && !sim.crashed)
  updateFlow(t)
  if (mode === 'power') updateCoils(t)
  const showLabels = labelsOn && explodeNow > 0.35
  $('#labels').classList.toggle('on', showLabels)
  callouts.classList.toggle('on', showLabels)
  if (showLabels) updateLabels()
  updateMotorMap()
  updateThrustArrows()
  if (helix.g.visible) helix.bead.position.copy(helix.at((t / 3) % 1))

  if (mode === 'lift') put($('#lift-status'), liftStatus())
  if (mode === 'prop' && sim.lift * 1.5 >= 1 && !sim.grounded) put($('#prop-status'), 'Enough air pushed down. The drone lifts off!')
  if (mode === 'brain') {
    $('#tilt-out').textContent = `${sim.crashed ? '—' : Math.round(THREE.MathUtils.radToDeg(sim.tilt))}°`
    const bx = THREE.MathUtils.clamp(sim.roll / 0.8, -1, 1) * 28
    const by = THREE.MathUtils.clamp(-sim.pitch / 0.8, -1, 1) * 28
    $('#bubble').style.transform = `translate(${bx}px, ${by}px)`
    if (sim.brain && !sim.crashed) loopCount += 4000 * dt
    $('#loop-count').textContent = Math.floor(loopCount).toLocaleString('en-US')
    if (sim.brain && t - gustAt > 2.5 && t - gustAt < 2.6 && !sim.crashed) put($('#brain-status'), 'Level again. Send another gust, or turn the brain off.')
  }
  if (mode === 'fly' && hoopIdx < HOOPS.length) {
    tmpV.copy(drone.root.position).y += 0.25
    if (tmpV.distanceTo(HOOPS[hoopIdx]) < 0.65) {
      hoopIdx++
      paintHoops()
      toast(hoopIdx >= HOOPS.length ? 'All rings!' : `Ring ${hoopIdx}!`)
    }
  }
  hoopMeshes.forEach((h, i) => i === hoopIdx && h.scale.setScalar(1 + Math.sin(t * 4) * 0.04))

  renderer.setScissorTest(false)
  renderer.setViewport(0, 0, innerWidth, innerHeight)
  renderer.render(scene, camera)

  // Picture-in-picture: what the drone's camera sees
  if (fpvOn) {
    const r = $('#fpv').getBoundingClientRect()
    if (r.width > 0) {
      drone.eye.getWorldPosition(fpvCam.position)
      drone.eye.getWorldQuaternion(tmpQ)
      fpvCam.quaternion.copy(tmpQ)
      fpvCam.aspect = r.width / r.height
      fpvCam.updateProjectionMatrix()
      const fv = frustum.visible
      frustum.visible = false
      particles.visible = false
      renderer.setScissorTest(true)
      const y = innerHeight - r.bottom
      renderer.setViewport(r.left, y, r.width, r.height)
      renderer.setScissor(r.left, y, r.width, r.height)
      renderer.render(scene, fpvCam)
      renderer.setScissorTest(false)
      frustum.visible = fv
      particles.visible = true
    }
  }
  requestAnimationFrame(frame)
}

// ================================================================ start
measure()
{
  const [id, n] = location.hash.slice(1).split('/')
  const i = beats.findIndex((b) => b.id === id && b.index === (Number(n) || 1) - 1)
  goTo(i >= 0 ? i : 0)
  controls.target.copy(fixedTarget)
  camera.position.copy(fixedTarget).add(camOffset)
  camAnim = 1
}
requestAnimationFrame(frame)
