import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import '@fontsource-variable/inter'
import '@fontsource-variable/space-grotesk'
import '@fontsource-variable/jetbrains-mono'
import './style.css'
import { Drone, MOTORS, type PartKey, type Spin } from './drone'
import { Sim, zeroInputs, type Inputs } from './sim'
import { BUILD_STEPS } from './steps'
import { buildWorld, HORIZON } from './world'

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

const $ = <T extends Element = HTMLElement>(sel: string) => document.querySelector(sel) as T
const $$ = <T extends Element = HTMLElement>(sel: string) => Array.from(document.querySelectorAll(sel)) as T[]
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

// ---------------------------------------------------------------- scene
const canvas = $<HTMLCanvasElement>('#scene')
const stage = $('#stage')
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

const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 400)
camera.position.set(4, 3, 6)
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
controls.enablePan = false
controls.minDistance = 2
controls.maxDistance = 14
controls.maxPolarAngle = Math.PI * 0.49
controls.autoRotateSpeed = 0.7
// On touch screens, vertical swipes scroll the page and sideways swipes turn the view.
const touch = matchMedia('(hover: none), (pointer: coarse)').matches
if (touch) canvas.style.touchAction = 'pan-y'

scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x8cc76a, 1.25))
const SUN_DIR = new THREE.Vector3(0.4, 0.55, 0.73).normalize()
const sun = new THREE.DirectionalLight(0xfff1d6, 2.6)
sun.castShadow = true
sun.shadow.mapSize.set(1024, 1024)
sun.shadow.camera.left = sun.shadow.camera.bottom = -5
sun.shadow.camera.right = sun.shadow.camera.top = 5
sun.shadow.camera.near = 1
sun.shadow.camera.far = 30
sun.shadow.bias = -0.0005
sun.shadow.normalBias = 0.02
scene.add(sun, sun.target)
const fill = new THREE.DirectionalLight(0xbfdcff, 0.6)
fill.position.set(-5, 3, -4)
scene.add(fill)

const world = buildWorld(scene, SUN_DIR)

// ---------------------------------------------------------------- drone + sim
const drone = new Drone()
scene.add(drone.root)
const sim = new Sim()

// ---------------------------------------------------------------- air particles
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
      gl_PointSize = 46.0 / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 color; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
      gl_FragColor = vec4(color, vA * (1.0 - d * 2.0)); }`,
  }),
)
particles.frustumCulled = false
scene.add(particles)
let pNext = 0
const emitAcc = [0, 0, 0, 0]
const tmpV = new THREE.Vector3()
const tmpV2 = new THREE.Vector3()

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
        const r = 0.12 + Math.random() * 0.4
        const a = Math.random() * Math.PI * 2
        tmpV.set(MOTORS[i].x + r * Math.cos(a), 0.3, MOTORS[i].z + r * Math.sin(a))
        drone.root.localToWorld(tmpV)
        pPos[k * 3] = tmpV.x
        pPos[k * 3 + 1] = tmpV.y
        pPos[k * 3 + 2] = tmpV.z
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

// ---------------------------------------------------------------- power-flow pulses
const flowGroup = new THREE.Group()
drone.body.add(flowGroup)
const energyMat = new THREE.MeshBasicMaterial({ color: 0xffd23f })
const msgMat = new THREE.MeshBasicMaterial({ color: 0xc08cff })
const pulseGeo = new THREE.SphereGeometry(0.035, 10, 8)
interface Route {
  pts: [PartKey, number, number, number][]
  mat: THREE.Material
  meshes: THREE.Mesh[]
}
const routes: Route[] = []
for (const m of MOTORS) {
  routes.push({
    pts: [
      ['battery', 0, 0.36, -0.25],
      ['esc', 0, 0.2, 0],
      ['esc', m.x * 0.2, 0.2, m.z * 0.2],
      ['motors', m.x, 0.26, m.z],
    ],
    mat: energyMat,
    meshes: [],
  })
}
routes.push({
  pts: [
    ['receiver', 0, 0.2, 0.28],
    ['fc', 0, 0.32, 0.1],
    ['fc', 0.02, 0.32, 0.04],
    ['esc', 0, 0.2, 0],
  ],
  mat: msgMat,
  meshes: [],
})
for (const r of routes) {
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(pulseGeo, r.mat)
    r.meshes.push(m)
    flowGroup.add(m)
  }
}
const routeTmp = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]
function updateFlow(t: number) {
  for (const r of routes) {
    r.pts.forEach(([k, x, y, z], i) => routeTmp[i].set(x, y, z).add(drone.parts[k].group.position))
    const lens = [1, 2, 3].map((i) => routeTmp[i].distanceTo(routeTmp[i - 1]))
    const total = lens[0] + lens[1] + lens[2]
    r.meshes.forEach((m, j) => {
      let d = (((t * 0.55 + j / r.meshes.length) % 1) + 1) % 1
      d *= total
      let s = 0
      while (s < 2 && d > lens[s]) d -= lens[s++]
      m.position.lerpVectors(routeTmp[s], routeTmp[s + 1], lens[s] ? d / lens[s] : 0)
    })
  }
}
flowGroup.visible = false

// ---------------------------------------------------------------- hoops
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

// ---------------------------------------------------------------- input
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
  if (!flyModes.includes(mode)) return
  const k = e.key.toLowerCase()
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
    keys.add(k)
    e.preventDefault()
  }
})
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()))
addEventListener('blur', () => keys.clear())

// ---------------------------------------------------------------- modes
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
  hero: { cam: [3.2, 1.3, 4.4], target: [0, 1.4, 0], air: true, auto: true, enter: () => ((bob = true), flying(1.4)) },
  parts: {
    cam: [4.2, 2.2, 5.0],
    target: [0, 1.3, 0],
    enter: () => {
      still(0.6)
      explodeGoal = 1
      setExplodeLabel()
    },
  },
  lift: {
    cam: [4.4, 1.0, 5.4],
    target: [0, 1.45, 0],
    map: true,
    air: true,
    enter: () => {
      flying(0)
      sim.altHold = false
      sim.ceiling = 2.6
      setThrottle(0)
    },
  },
  prop: {
    cam: [2.8, 1.1, 3.4],
    target: [0, 0.9, 0],
    map: true,
    air: true,
    enter: () => {
      flying(0)
      sim.altHold = false
      sim.ceiling = 1.8
      throttleSlider = 0.75
      setPitch(bladePitch)
    },
  },
  spin: {
    cam: [0.01, 4.6, 2.6],
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
  move: { cam: [3.4, 2.2, 4.8], follow: true, map: true, air: true, enter: () => flying(1.3) },
  brain: {
    cam: [3.4, 1.6, 4.6],
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
    cam: [2.6, 1.8, 3.2],
    target: [0, 1.2, 0],
    enter: () => {
      still(0.8, 0.35)
      explodeGoal = 0.5
      drone.explodeOnly = ['battery', 'fc']
      flowGroup.visible = true
      setFlow(0)
    },
  },
  radio: { cam: [0, 2.2, 5.4], follow: true, map: true, air: true, enter: () => flying(1.3) },
  ladder: { cam: [-3.4, 1.4, 4.2], target: [0, 1.4, 0], air: true, auto: true, enter: () => ((bob = true), flying(1.4)) },
  kit: {
    cam: [4.4, 2.4, 5.2],
    target: [0, 1.3, 0],
    auto: true,
    enter: () => {
      still(0.6)
      explodeGoal = 1
    },
  },
  build: {
    cam: [3.0, 1.5, 3.8],
    target: [0, 0.4, 0],
    enter: () => {
      still(0)
      showStep(buildIdx)
    },
  },
  test: {
    cam: [0.01, 4.6, 3.3],
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
    map: true,
    air: true,
    enter: () => {
      flying(0, 11)
      resetHoops()
    },
  },
  rules: { cam: [3.8, 1.6, -4.2], target: [0, 1.4, 0], air: true, auto: true, enter: () => ((bob = true), flying(1.4)) },
}

let mode: Mode = 'hero'
let camAnim = 1
const camFrom = new THREE.Vector3()
const tgtFrom = new THREE.Vector3()
const camOffset = new THREE.Vector3()
const fixedTarget = new THREE.Vector3()
const followTarget = new THREE.Vector3()

function setMode(m: Mode, instant = false) {
  mode = m
  const cfg = MODES[m]
  // defaults
  explodeGoal = 0
  propsOn = true
  spinVis = 1
  staticPose = null
  bob = false
  flowGroup.visible = false
  drone.showSpinArrows(false)
  drone.setVisSpin(MOTORS.map((x) => x.spin))
  drone.explodeOnly = null
  drone.arrowsTurn = true
  drone.setHighlight(null)
  drone.setBuildStep(m === 'build' ? buildIdx + 1 : 99, false)
  hoopMeshes.forEach((h) => (h.visible = m === 'fly'))
  Object.assign(padIn, zeroInputs())
  Object.assign(stickIn, zeroInputs())
  keys.clear()
  cfg.enter?.()

  camOffset.set(...cfg.cam)
  fixedTarget.set(...(cfg.target ?? [0, 1.3, 0]))
  camFrom.copy(camera.position)
  tgtFrom.copy(controls.target)
  camAnim = instant ? 1 : 0
  if (instant) {
    controls.target.copy(fixedTarget)
    camera.position.copy(fixedTarget).add(camOffset)
  }
  controls.autoRotate = !!cfg.auto && !reduceMotion
  $('#motormap').classList.toggle('on', !!cfg.map)
  $('#labels').classList.toggle('on', m === 'parts' || m === 'kit')
  const section = $(`.chapter[data-mode="${m}"]`)
  $('#stage-chip').textContent = (touch && section?.dataset.titleTouch) || section?.dataset.title || ''
  stage.classList.toggle('sticks-on', m === 'radio' || m === 'fly')
  $('#toc-current').textContent = m === 'hero' ? 'Chapters' : chapterName(m)
  const num = section?.querySelector('.kicker')?.textContent?.match(/^\d+/)?.[0]
  $('#toc-num').textContent = num ? `${num}/${sections.length - 1}` : ''
  $$('#toc-list a').forEach((a) => a.classList.toggle('on', a.dataset.mode === m))
  if (m === 'fly') paintHoops()
  const idx = order.indexOf(m)
  $$('[data-part-link]').forEach((a) =>
    a.classList.toggle('active', a.dataset.partLink === (idx >= order.indexOf('ladder') ? '2' : idx >= order.indexOf('parts') ? '1' : '')),
  )
  $$('.chapter').forEach((s) => s.classList.toggle('active', s.dataset.mode === m))
}

// ---------------------------------------------------------------- chapter tracking
const sections = $$<HTMLElement>('.chapter')
const order = sections.map((s) => s.dataset.mode as Mode)
function pickChapter() {
  // Stacked layout (phones, tablets upright): the 3D view sits on top, so read from below it.
  const stacked = getComputedStyle($('.layout')).display === 'block'
  const stageBottom = stacked ? stage.getBoundingClientRect().bottom : 0
  const line = stacked ? stageBottom + (innerHeight - stageBottom) * 0.3 : innerHeight * 0.5
  let best: Mode = order[0]
  for (const s of sections) {
    const r = s.getBoundingClientRect()
    if (r.top <= line) best = s.dataset.mode as Mode
  }
  if (best !== mode) setMode(best)
  const h = document.documentElement.scrollHeight - innerHeight
  $('#progress-fill').style.width = `${h > 0 ? (scrollY / h) * 100 : 0}%`
}
let scrollQueued = false
addEventListener(
  'scroll',
  () => {
    if (scrollQueued) return
    scrollQueued = true
    requestAnimationFrame(() => {
      scrollQueued = false
      pickChapter()
    })
  },
  { passive: true },
)

// ---------------------------------------------------------------- motion
/** Only write text that changed, so the fade-in below plays once per change. */
function put(el: HTMLElement, text: string) {
  if (el.textContent !== text) el.textContent = text
}
// Status lines and info panels fade in whenever their words change.
const flash = new MutationObserver((list) => {
  for (const m of list) {
    const el = (m.target.nodeType === 1 ? m.target : m.target.parentElement) as HTMLElement
    const box = el.closest('.status, .info-box, #step-body, .chip') as HTMLElement | null
    if (!box || reduceMotion) continue
    box.classList.remove('flash')
    void box.offsetWidth
    box.classList.add('flash')
  }
})
$$('.status, .info-box, #step-body, #stage-chip').forEach((el) => flash.observe(el, { childList: true, characterData: true, subtree: true }))
// Cards reveal their contents, one line after another, the first time they scroll into view.
$$('.chapter .card').forEach((card) => Array.from(card.children).forEach((c, i) => (c as HTMLElement).style.setProperty('--i', String(Math.min(i, 10)))))
const reveal = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      e.target.classList.add('seen')
      reveal.unobserve(e.target)
    }
  },
  { threshold: 0.12 },
)
$$('.chapter, .part-banner').forEach((el) => reveal.observe(el))

// ---------------------------------------------------------------- chapter menu
function chapterName(m: Mode) {
  const kicker = $(`[data-mode="${m}"] .kicker`)?.textContent ?? ''
  return kicker.replace(/^\d+\s*·\s*/, '')
}
{
  const list = $('#toc-list')
  let html = ''
  let part = ''
  for (const sec of sections) {
    const m = sec.dataset.mode as Mode
    const idx = order.indexOf(m)
    const p = idx >= order.indexOf('ladder') ? 'Part 2 · Build one' : idx >= order.indexOf('parts') ? 'Part 1 · How it works' : ''
    if (p !== part) {
      part = p
      html += `<h4 class="${idx >= order.indexOf('ladder') ? 'p2' : ''}">${p}</h4>`
    }
    const num = sec.querySelector('.kicker')?.textContent?.match(/^\d+/)?.[0] ?? '★'
    const title = sec.querySelector('h1, h2')?.firstChild?.textContent?.trim() ?? ''
    html += `<a href="#${sec.id}" data-mode="${m}"><b>${num}</b><span>${title}</span></a>`
  }
  list.innerHTML = html
}
const toc = $('#toc')
const tocBtn = $('#toc-btn')
function openToc(open: boolean) {
  toc.hidden = !open
  document.body.classList.toggle('toc-open', open)
  tocBtn.setAttribute('aria-expanded', String(open))
  if (open) ($('#toc-list a.on') ?? $('#toc-list a'))?.focus({ preventScroll: true })
}
tocBtn.addEventListener('click', () => openToc(toc.hidden))
$('#toc-close').addEventListener('click', () => openToc(false))
toc.addEventListener('click', (e) => {
  if (e.target === toc || (e.target as HTMLElement).closest('a')) openToc(false)
})
addEventListener('keydown', (e) => e.key === 'Escape' && !toc.hidden && openToc(false))

// ---------------------------------------------------------------- toast
let toastTimer = 0
function toast(msg: string) {
  const el = $('#toast')
  el.textContent = msg
  el.classList.add('on')
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => el.classList.remove('on'), 2200)
}
sim.onCrash = () => {
  if (mode === 'brain') {
    $('#brain-status').textContent = sim.brain
      ? 'Crash! That gust was too strong.'
      : 'Crash. With no brain, nothing caught the tip. Turn the brain back on.'
  }
  toast('Crash! Resetting…')
}

// ---------------------------------------------------------------- 1. parts
const PART_INFO: Record<string, { name: string; text: string }> = {
  frame: {
    name: 'Frame',
    text: 'The skeleton. Four arms hold the motors far apart. Most frames are carbon fiber: stiff and very light. The green lights mark the front, red the back.',
  },
  motors: {
    name: 'Motors',
    text: 'Four electric motors, each spinning its propeller thousands of times a minute. The colored ring shows the spin direction: orange is clockwise, blue is counter-clockwise.',
  },
  props: {
    name: 'Propellers',
    text: 'Their blades are tilted, so spinning them throws air down. Faster spin, bigger push.',
  },
  battery: {
    name: 'Battery',
    text: 'The fuel tank. A LiPo (lithium polymer) battery packs a lot of energy into a small, light box.',
  },
  esc: {
    name: 'Speed controllers (ESC)',
    text: 'Electronic speed controllers: four of them, one per motor, usually on one board. They feed each motor exactly as much power as the brain asks for.',
  },
  fc: {
    name: 'Flight controller',
    text: 'The brain: a small computer with a motion sensor that feels every tilt. It decides how fast each motor should spin. Its white arrow points to the front.',
  },
  receiver: {
    name: 'Radio receiver',
    text: 'The ears. It listens for radio messages from your controller and passes them to the brain. The antennas point away from the propellers.',
  },
  camera: {
    name: 'Camera',
    text: 'The eye (optional). An FPV (first-person view) camera sends live video to goggles, so you see what the drone sees.',
  },
}
const LABEL_KEYS: PartKey[] = ['frame', 'motors', 'props', 'battery', 'esc', 'fc', 'receiver', 'camera']
const labelEls = LABEL_KEYS.map((k) => {
  const b = document.createElement('button')
  b.className = 'label'
  b.textContent = PART_INFO[k].name.replace(' (ESC)', '')
  b.addEventListener('click', () => selectPart(k))
  $('#labels').appendChild(b)
  return b
})
function selectPart(k: PartKey) {
  drone.setHighlight(k)
  const info = PART_INFO[k]
  $('#part-info').innerHTML = `<h3>${info.name}</h3><p>${info.text}</p>`
  $$('#part-buttons button').forEach((b) => b.classList.toggle('on', b.dataset.part === k))
  labelEls.forEach((el, i) => el.classList.toggle('on', LABEL_KEYS[i] === k))
}
$$('#part-buttons button').forEach((b) => b.addEventListener('click', () => selectPart(b.dataset.part as PartKey)))
function setExplodeLabel() {
  $('#explode-toggle').textContent = explodeGoal > 0.5 ? 'Put it back together' : 'Take it apart'
}
$('#explode-toggle').addEventListener('click', () => {
  explodeGoal = explodeGoal > 0.5 ? 0 : 1
  setExplodeLabel()
})

// click-to-select on the 3D model
const ray = new THREE.Raycaster()
let downAt: [number, number] | null = null
canvas.addEventListener('pointerdown', (e) => (downAt = [e.clientX, e.clientY]))
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return
  if (mode !== 'parts' && mode !== 'kit') return
  const r = canvas.getBoundingClientRect()
  ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
  const hit = ray.intersectObject(drone.body, true).find((h) => h.object.userData.part)
  if (!hit) return
  const k = hit.object.userData.part === 'wires' ? 'esc' : (hit.object.userData.part as PartKey)
  selectPart(k)
})

// ---------------------------------------------------------------- 2. lift
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
throttleEl.addEventListener('input', () => setThrottle(Number(throttleEl.value)))
function liftStatus() {
  const v = Number(throttleEl.value)
  if (v === 0) return 'Motors off. Gravity wins. The drone sits on the ground.'
  if (v < 50) return sim.grounded ? 'Some thrust, but gravity is still stronger. It stays down.' : 'Thrust is weaker than gravity, so it sinks.'
  if (v === 50) return sim.grounded ? 'Thrust equals gravity: exactly balanced. Push a little more to take off.' : 'Thrust equals gravity. It hangs in the air: a hover!'
  return sim.pos.y >= sim.ceiling - 0.01 ? 'Thrust beats gravity. It would keep climbing. Slide back to 50% to hover.' : 'Thrust beats gravity. It climbs!'
}

// ---------------------------------------------------------------- 3. prop pitch
const pitchEl = $<HTMLInputElement>('#pitch')
function setPitch(deg: number) {
  bladePitch = deg
  pitchEl.value = String(deg)
  fillRange(pitchEl)
  $('#pitch-out').textContent = `${deg}°`
  drone.setBladePitch(deg)
  sim.lift = deg / 25
  $('#blade-section').setAttribute('transform', `rotate(${deg})`)
  const air = $('#air-arrows')
  air.style.opacity = String(Math.min(1, deg / 12))
  air.setAttribute('transform', `translate(0 72) scale(1 ${0.25 + (deg / 25) * 0.75}) translate(0 -72)`)
  $('#air-label').textContent = deg === 0 ? 'no air pushed' : 'air pushed down'
  $('#prop-status').textContent =
    deg === 0
      ? 'Flat blades slice through the air and push nothing. The motors spin, but the drone stays put.'
      : sim.lift * 1.5 < 1
        ? 'Some air goes down, but not enough push to beat gravity. Tilt the blades more.'
        : 'Enough air pushed down. The drone lifts off!'
}
pitchEl.addEventListener('input', () => setPitch(Number(pitchEl.value)))

// ---------------------------------------------------------------- 4. spin
const sameDir = $<HTMLInputElement>('#same-dir')
function applySameDir() {
  sim.sameDir = sameDir.checked
  drone.setVisSpin(sameDir.checked ? [1, 1, 1, 1] : MOTORS.map((m) => m.spin))
  $('#spin-status').textContent = sameDir.checked
    ? 'All four twist the same way, and nothing cancels. The whole drone spins the opposite way from its props. Even the brain cannot fix that.'
    : 'Two twist one way, two twist the other. They cancel, and the drone holds still.'
  if (!sameDir.checked) sim.ry = 0
}
sameDir.addEventListener('change', applySameDir)

// ---------------------------------------------------------------- 5. move pad
const MOVE_TEXT: Record<string, string> = {
  'climb:1': 'Up: all four motors speed up together. Thrust beats gravity, so it rises.',
  'climb:-1': 'Down: all four slow down together. Gravity wins a little, so it sinks.',
  'pitch:1': 'Forward: the two back motors speed up. The nose dips, the push leans forward, and it moves forward.',
  'pitch:-1': 'Back: the two front motors speed up. The nose lifts, the push leans back, and it moves backward.',
  'roll:-1': 'Left: the two right motors speed up. The drone leans left and slides left.',
  'roll:1': 'Right: the two left motors speed up. The drone leans right and slides right.',
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
    $('#move-status').textContent = MOVE_TEXT[b.dataset.in!]
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

// ---------------------------------------------------------------- 6. brain
const brainOn = $<HTMLInputElement>('#brain-on')
brainOn.addEventListener('change', () => {
  sim.brain = brainOn.checked
  if (brainOn.checked && sim.crashed) sim.reset(1.5)
  if (brainOn.checked && sim.grounded) sim.reset(1.5)
  $('#brain-status').textContent = brainOn.checked
    ? 'Brain on. Send a gust and watch it catch itself.'
    : 'Brain off. The motors just run at the same speed. Now send a gust.'
})
let gustAt = -10
$('#gust').addEventListener('click', () => {
  if (sim.crashed) return
  if (sim.grounded) sim.reset(1.5)
  sim.gust()
  gustAt = clock.elapsedTime
  $('#brain-status').textContent = sim.brain
    ? 'Caught it! Watch the motor map: the low side jumped to push it back to level.'
    : 'No brain. Nothing catches the tip, and it keeps going…'
})
let loopCount = 0

// ---------------------------------------------------------------- 7. power flow
let flowIdx = 0
const flowItems = $$('#flow-steps li')
function setFlow(i: number) {
  flowIdx = Math.max(0, Math.min(flowItems.length - 1, i))
  flowItems.forEach((li, j) => li.classList.toggle('on', j === flowIdx))
  drone.setHighlight(flowItems[flowIdx].dataset.part as PartKey)
  ;($('#flow-prev') as HTMLButtonElement).disabled = flowIdx === 0
  $('#flow-next').textContent = flowIdx === flowItems.length - 1 ? 'Start over' : 'Next'
}
$('#flow-prev').addEventListener('click', () => setFlow(flowIdx - 1))
$('#flow-next').addEventListener('click', () => setFlow(flowIdx === flowItems.length - 1 ? 0 : flowIdx + 1))
flowItems.forEach((li, j) => li.addEventListener('click', () => setFlow(j)))

// Inside-a-motor demo: 9 coils around a spinning magnet.
const coilSvg = $('#coils')
const NS = 'http://www.w3.org/2000/svg'
const coilEls: SVGRectElement[] = []
for (let i = 0; i < 9; i++) {
  const a = (i / 9) * 360
  const g = document.createElementNS(NS, 'g')
  g.setAttribute('transform', `rotate(${a} 100 100)`)
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
  const angle = (phase - 0.35) * 40 - 90
  rotor.setAttribute('transform', `rotate(${angle} 100 100)`)
}

// ---------------------------------------------------------------- sticks
function bindSticks(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.stick').forEach((el) => {
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
}
bindSticks($('#stage-sticks'))
$$('[data-reset]').forEach((b) =>
  b.addEventListener('click', () => {
    if (mode === 'fly') resetHoops()
    sim.reset(mode === 'fly' ? 0 : 1.3)
  }),
)

// ---------------------------------------------------------------- build stepper
let buildIdx = 0
const dots = $('#step-dots')
BUILD_STEPS.forEach((_, i) => {
  const b = document.createElement('button')
  b.textContent = String(i + 1)
  b.setAttribute('aria-label', `Step ${i + 1}`)
  b.addEventListener('click', () => showStep(i))
  dots.appendChild(b)
})
function showStep(i: number) {
  buildIdx = Math.max(0, Math.min(BUILD_STEPS.length - 1, i))
  const s = BUILD_STEPS[buildIdx]
  $('#step-body').innerHTML = `
    <p class="step-num">Step ${buildIdx + 1} of ${BUILD_STEPS.length}${s.grownup ? ' <em class="badge">grown-up help</em>' : ''}</p>
    <h3>${s.title}</h3><p>${s.body}</p>
    <p class="check"><b>Check it:</b> ${s.check}</p>`
  Array.from(dots.children).forEach((d, j) => d.classList.toggle('on', j <= buildIdx))
  ;($('#step-prev') as HTMLButtonElement).disabled = buildIdx === 0
  $('#step-next').textContent = buildIdx === BUILD_STEPS.length - 1 ? 'Start over' : 'Next step'
  if (mode === 'build') {
    drone.setBuildStep(buildIdx + 1)
    const key = (['frame', 'motors', 'esc', 'fc', 'receiver', 'camera', 'battery', 'props'] as PartKey[])[buildIdx]
    drone.setHighlight(key)
  }
}
$('#step-prev').addEventListener('click', () => showStep(buildIdx - 1))
$('#step-next').addEventListener('click', () => {
  if (buildIdx === BUILD_STEPS.length - 1) {
    drone.setBuildStep(0)
    showStep(0)
  } else showStep(buildIdx + 1)
})
showStep(0)

// ---------------------------------------------------------------- motor test game
let wrongMotor = 0
function newTest() {
  let next = wrongMotor
  while (next === wrongMotor) next = Math.floor(Math.random() * 4)
  wrongMotor = next
  drone.setVisSpin(MOTORS.map((m, i) => (i === wrongMotor ? (-m.spin as Spin) : m.spin)), false)
  $('#test-status').textContent = 'Which one is backwards?'
  $$('#motor-pick button').forEach((b) => b.classList.remove('good', 'bad'))
}
$$<HTMLButtonElement>('#motor-pick button').forEach((b) =>
  b.addEventListener('click', () => {
    const i = Number(b.dataset.m)
    if (i === wrongMotor) {
      b.classList.add('good')
      drone.setVisSpin(MOTORS.map((m) => m.spin))
      $('#test-status').textContent = `Found it: the ${MOTORS[i].name.toLowerCase()} motor. To fix a backwards motor, swap any two of its three wires, or flip its direction in the setup app. Fixed! All four now match their arrows.`
    } else {
      b.classList.add('bad')
      $('#test-status').textContent = `Not that one. The ${MOTORS[i].name.toLowerCase()} stripe turns the same way as its arrow.`
    }
  }),
)
$('#test-again').addEventListener('click', newTest)

// ---------------------------------------------------------------- checklist + hoops
const checks = $$<HTMLInputElement>('#checklist input')
checks.forEach((c) =>
  c.addEventListener('change', () => {
    const n = checks.filter((x) => x.checked).length
    $('#check-status').textContent = n === checks.length ? 'All set. Cleared for takeoff!' : `${n} of ${checks.length} checked`
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
  if (mode === 'fly') $('#stage-chip').textContent = `Rings: ${Math.min(hoopIdx, HOOPS.length)} of ${HOOPS.length}`
  $('#ring-status').textContent = hoopIdx >= HOOPS.length ? 'All three rings! Nice flying. Press Start over to go again.' : `Next: ring ${hoopIdx + 1} of ${HOOPS.length}.`
}

// ---------------------------------------------------------------- HUD
const mmMotors = $$<SVGGElement>('#motormap .mm-motor')
function updateMotorMap() {
  mmMotors.forEach((g, i) => {
    const u = sim.u[i]
    const fill = g.querySelector('.mm-fill') as SVGCircleElement
    fill.setAttribute('r', String(4 + u * 16))
    ;(g.querySelector('text') as SVGTextElement).textContent = String(Math.round(u * 100))
  })
}

const labelTmp = new THREE.Vector3()
function updateLabels() {
  const r = canvas.getBoundingClientRect()
  LABEL_KEYS.forEach((k, i) => {
    drone.labelWorld(k, labelTmp).project(camera)
    const el = labelEls[i]
    const x = (labelTmp.x * 0.5 + 0.5) * r.width
    const y = (-labelTmp.y * 0.5 + 0.5) * r.height
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
    el.style.visibility = labelTmp.z < 1 ? 'visible' : 'hidden'
  })
}

// ---------------------------------------------------------------- resize + loop
function resize() {
  const w = stage.clientWidth
  const h = stage.clientHeight
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.fov = w / h < 0.9 ? 52 : 42
  camera.updateProjectionMatrix()
}
new ResizeObserver(resize).observe(stage)
resize()

const clock = new THREE.Clock()
const SIM_DT = 1 / 120
let simAcc = 0
function frame() {
  const raw = clock.getDelta()
  const dt = Math.min(raw, 1 / 30)
  const t = clock.elapsedTime
  gatherInputs()
  // Fixed physics steps keep the flight the same speed on slow and fast screens.
  simAcc += Math.min(raw, 0.25)
  while (simAcc >= SIM_DT) {
    sim.step(SIM_DT, inputs)
    simAcc -= SIM_DT
  }

  // Drone transform
  if (staticPose) {
    drone.root.position.copy(staticPose)
    drone.root.quaternion.identity()
  } else {
    drone.root.position.copy(sim.pos)
    if (bob) drone.root.position.y += Math.sin(t * 1.6) * 0.06
    drone.root.quaternion.copy(sim.quaternion)
  }
  explodeNow += (explodeGoal - explodeNow) * Math.min(1, dt * 3)
  drone.setExplode(explodeNow)
  drone.update(dt, t, sim.u, spinVis, propsOn)
  drone.root.updateMatrixWorld(true)

  // Camera
  const cfg = MODES[mode]
  followTarget.copy(cfg.follow ? drone.root.position : fixedTarget)
  if (cfg.follow) followTarget.y = Math.max(0.8, followTarget.y + 0.2)
  if (camAnim < 1) {
    camAnim = Math.min(1, camAnim + dt / 1.1)
    const e = 1 - Math.pow(1 - camAnim, 3)
    controls.target.lerpVectors(tgtFrom, followTarget, e)
    camera.position.lerpVectors(camFrom, tmpV.copy(followTarget).add(camOffset), e)
  } else if (cfg.follow) {
    const d = tmpV.copy(followTarget).sub(controls.target).multiplyScalar(Math.min(1, dt * 4))
    controls.target.add(d)
    camera.position.add(d)
  }
  controls.update()
  sun.position.copy(drone.root.position).addScaledVector(SUN_DIR, 14)
  sun.target.position.copy(drone.root.position)

  world.update(t)
  updateParticles(dt, !!cfg.air && !sim.crashed)
  if (flowGroup.visible) updateFlow(t)
  if (mode === 'power') updateCoils(t)
  if (mode === 'parts' || mode === 'kit') updateLabels()
  if (cfg.map) updateMotorMap()

  if (mode === 'lift') put($('#lift-status'), liftStatus())
  if (mode === 'prop' && sim.lift * 1.5 >= 1 && !sim.grounded) put($('#prop-status'), 'Enough air pushed down. The drone lifts off!')
  if (mode === 'brain') {
    const tiltDeg = Math.round(THREE.MathUtils.radToDeg(sim.tilt))
    $('#tilt-out').textContent = `${sim.crashed ? '—' : tiltDeg}°`
    const bx = THREE.MathUtils.clamp(sim.roll / 0.8, -1, 1) * 28
    const by = THREE.MathUtils.clamp(-sim.pitch / 0.8, -1, 1) * 28
    $('#bubble').style.transform = `translate(${bx}px, ${by}px)`
    if (sim.brain && !sim.crashed) loopCount += 4000 * dt
    $('#loop-count').textContent = Math.floor(loopCount).toLocaleString('en-US')
    if (sim.brain && t - gustAt > 2.5 && t - gustAt < 2.6 && !sim.crashed) put($('#brain-status'), 'Level again. Send another gust, or try turning the brain off.')
  }
  if (mode === 'fly' && hoopIdx < HOOPS.length) {
    tmpV.copy(drone.root.position).y += 0.25
    if (tmpV.distanceTo(HOOPS[hoopIdx]) < 0.65) {
      hoopIdx++
      paintHoops()
      toast(hoopIdx >= HOOPS.length ? 'All rings!' : `Ring ${hoopIdx}!`)
    }
  }
  hoopMeshes.forEach((h, i) => {
    if (i === hoopIdx) h.scale.setScalar(1 + Math.sin(t * 4) * 0.04)
  })

  renderer.render(scene, camera)
  requestAnimationFrame(frame)
}

setMode('hero', true)
pickChapter()
requestAnimationFrame(frame)
