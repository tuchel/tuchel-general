import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** A sunny park: sky, rolling lawn, trees, a pond, a path, and a launch pad. */

export const HORIZON = 0xd6ecfa
const SKY_TOP = 0x4a9ff0

// Seeded random so the park looks the same on every visit.
let seed = 7
const rand = () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}
const range = (a: number, b: number) => a + rand() * (b - a)
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)]

function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function noise(x: number, z: number) {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = zf * zf * (3 - 2 * zf)
  const a = hash(xi, zi)
  const b = hash(xi + 1, zi)
  const c = hash(xi, zi + 1)
  const d = hash(xi + 1, zi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Lawn is flat near the pad and rolls into hills far away. */
export function groundHeight(x: number, z: number) {
  const r = Math.hypot(x, z)
  const hills = noise(x * 0.05, z * 0.05) * 7 + noise(x * 0.13, z * 0.13) * 2
  return smooth(22, 70, r) * hills
}

const POND = { x: -10, z: -5, rx: 3.6, rz: 2.4 }
const PATH_PTS = [
  [-60, 16],
  [-30, 13],
  [-14, 7.5],
  [-5, 6.8],
  [4, 8.5],
  [12, 6],
  [22, -2],
  [40, -8],
  [70, -6],
].map(([x, z]) => new THREE.Vector3(x, 0, z))
const pathCurve = new THREE.CatmullRomCurve3(PATH_PTS)
const pathSamples = pathCurve.getSpacedPoints(300)

function nearPath(x: number, z: number, d: number) {
  for (const p of pathSamples) if (Math.abs(p.x - x) < d && Math.abs(p.z - z) < d && Math.hypot(p.x - x, p.z - z) < d) return true
  return false
}
function inPond(x: number, z: number, pad = 0) {
  return ((x - POND.x) / (POND.rx + pad)) ** 2 + ((z - POND.z) / (POND.rz + pad)) ** 2 < 1
}
/** Keep the flying area clear: the pad, and the ring course that heads away from the camera. */
function inFlyZone(x: number, z: number) {
  return Math.hypot(x, z) < 9.5 || (Math.abs(x) < 6 && z < 0 && z > -16)
}

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra })

function place(geo: THREE.BufferGeometry, x: number, y: number, z: number, s = 1, sy = s) {
  return geo.clone().scale(s, sy, s).translate(x, y, z)
}

function skyMaterial(sunDir: THREE.Vector3) {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(SKY_TOP) },
      horizon: { value: new THREE.Color(HORIZON) },
      sunDir: { value: sunDir.clone() },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 horizon; uniform vec3 sunDir; varying vec3 vDir;
      void main(){ float h = clamp(vDir.y, 0.0, 1.0);
        vec3 c = mix(horizon, top, pow(h, 0.55));
        float s = max(dot(vDir, sunDir), 0.0);
        c += vec3(1.0, 0.93, 0.75) * (pow(s, 12.0) * 0.35 + pow(s, 400.0) * 1.2);
        gl_FragColor = vec4(c, 1.0); }`,
  })
}

/** Reflections for shiny parts: the same sky over a green lawn, with a bright sun. */
export function skyEnvironment(renderer: THREE.WebGLRenderer, sunDir: THREE.Vector3) {
  const env = new THREE.Scene()
  env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), skyMaterial(sunDir)))
  const lawn = new THREE.Mesh(new THREE.CircleGeometry(9.5, 32), new THREE.MeshBasicMaterial({ color: 0x5f9e48 }))
  lawn.rotation.x = -Math.PI / 2
  lawn.position.y = -0.6
  env.add(lawn)
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 4.8) }))
  sun.position.copy(sunDir).multiplyScalar(8)
  env.add(sun)
  const soft = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.4), side: THREE.DoubleSide }))
  soft.position.set(-6, 4, -3)
  soft.lookAt(0, 0, 0)
  env.add(soft)
  const pmrem = new THREE.PMREMGenerator(renderer)
  const tex = pmrem.fromScene(env, 0.03).texture
  pmrem.dispose()
  return tex
}

export function buildWorld(scene: THREE.Scene, sunDir: THREE.Vector3) {
  const world = new THREE.Group()
  scene.add(world)

  // ---------------------------------------------------------- sky
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), skyMaterial(sunDir))
  world.add(sky)

  // ---------------------------------------------------------- clouds
  const clouds = new THREE.Group()
  const puff = new THREE.IcosahedronGeometry(1, 2)
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 1, fog: false })
  for (let i = 0; i < 12; i++) {
    const parts: THREE.BufferGeometry[] = []
    const n = 4 + Math.floor(rand() * 3)
    for (let j = 0; j < n; j++) {
      const s = range(2.2, 4)
      parts.push(place(puff, (j - n / 2) * 2.6 + range(-0.6, 0.6), range(0, 1.2) + (j > 0 && j < n - 1 ? 1 : 0), range(-1, 1), s, s * 0.8))
    }
    const cloud = new THREE.Mesh(mergeGeometries(parts), cloudMat)
    cloud.geometry.computeBoundingSphere()
    const a = (i / 12) * Math.PI * 2 + range(-0.2, 0.2)
    const r = range(85, 120)
    cloud.position.set(Math.cos(a) * r, range(26, 44), Math.sin(a) * r)
    cloud.lookAt(0, cloud.position.y, 0)
    clouds.add(cloud)
  }
  world.add(clouds)

  // ---------------------------------------------------------- ground
  const size = 220
  const seg = 180
  const gGeo = new THREE.PlaneGeometry(size, size, seg, seg)
  gGeo.rotateX(-Math.PI / 2)
  const pos = gGeo.attributes.position as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const cA = new THREE.Color(0x8acb62)
  const cB = new THREE.Color(0x70b957)
  const cHill = new THREE.Color(0x9fd46a)
  const cDry = new THREE.Color(0xb9d971)
  const tmp = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const y = groundHeight(x, z)
    pos.setY(i, y)
    const r = Math.hypot(x, z)
    tmp.copy(cA).lerp(cB, noise(x * 0.18, z * 0.18))
    tmp.lerp(cDry, noise(x * 0.04 + 9, z * 0.04) * 0.35)
    tmp.lerp(cHill, smooth(25, 70, r) * 0.5)
    // Mowed stripes near the pad
    const stripe = Math.floor((x + 1000) / 2.2) % 2 === 0 ? 1.05 : 0.97
    const mix = 1 - smooth(14, 26, r)
    tmp.multiplyScalar(1 + (stripe - 1) * mix)
    colors.set([tmp.r, tmp.g, tmp.b], i * 3)
  }
  gGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  gGeo.computeVertexNormals()
  const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }))
  ground.receiveShadow = true
  world.add(ground)

  // ---------------------------------------------------------- path
  {
    const w = 0.8
    const verts: number[] = []
    const idx: number[] = []
    const pts = pathCurve.getSpacedPoints(240)
    pts.forEach((p, i) => {
      const t = pathCurve.getTangentAt(i / (pts.length - 1))
      const nx = -t.z
      const nz = t.x
      for (const s of [-1, 1]) {
        const x = p.x + nx * w * s
        const z = p.z + nz * w * s
        verts.push(x, groundHeight(x, z) + 0.03, z)
      }
      if (i > 0) {
        const a = i * 2
        idx.push(a - 2, a - 1, a, a - 1, a + 1, a)
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    const path = new THREE.Mesh(g, std(0xf1dca6, { roughness: 1, side: THREE.DoubleSide }))
    path.receiveShadow = true
    world.add(path)
  }

  // ---------------------------------------------------------- launch pad
  {
    const padTex = canvasTexture(512, 512, (c) => {
      const s = 512
      c.fillStyle = '#273246'
      c.beginPath()
      c.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2)
      c.fill()
      c.strokeStyle = '#ff6a2b'
      c.lineWidth = 14
      c.beginPath()
      c.arc(s / 2, s / 2, s / 2 - 30, 0, Math.PI * 2)
      c.stroke()
      c.strokeStyle = 'rgba(255,255,255,0.55)'
      c.setLineDash([14, 18])
      c.lineWidth = 5
      c.beginPath()
      c.arc(s / 2, s / 2, s / 2 - 66, 0, Math.PI * 2)
      c.stroke()
      c.fillStyle = '#ffffff'
      const bar = 46
      c.beginPath()
      c.roundRect(s / 2 - 95, s / 2 - 110, bar, 220, 16)
      c.roundRect(s / 2 + 95 - bar, s / 2 - 110, bar, 220, 16)
      c.roundRect(s / 2 - 95, s / 2 - bar / 2, 190, bar, 12)
      c.fill()
    })
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.62, 0.06, 64), std(0x1b2433, { roughness: 0.6 }))
    base.position.y = 0.03
    base.receiveShadow = true
    const top = new THREE.Mesh(new THREE.CircleGeometry(1.55, 64), new THREE.MeshStandardMaterial({ map: padTex, roughness: 0.75 }))
    top.rotation.x = -Math.PI / 2
    top.position.y = 0.062
    top.receiveShadow = true
    world.add(base, top)
  }

  // ---------------------------------------------------------- pond with lily pads and ducks
  const ducks: THREE.Group[] = []
  {
    const pondY = 0.03
    const rim = new THREE.Mesh(new THREE.CircleGeometry(1, 48), std(0xd8c99a, { roughness: 1 }))
    rim.rotation.x = -Math.PI / 2
    rim.scale.set(POND.rx + 0.45, POND.rz + 0.45, 1)
    rim.position.set(POND.x, pondY, POND.z)
    rim.receiveShadow = true
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshStandardMaterial({ color: 0x4cc3f0, roughness: 0.15, metalness: 0.1, emissive: 0x1b7fb8, emissiveIntensity: 0.25 }),
    )
    water.rotation.x = -Math.PI / 2
    water.scale.set(POND.rx, POND.rz, 1)
    water.position.set(POND.x, pondY + 0.01, POND.z)
    world.add(rim, water)
    const padGeo = new THREE.CircleGeometry(0.28, 20, 0.3, Math.PI * 2 - 0.6)
    padGeo.rotateX(-Math.PI / 2)
    for (let i = 0; i < 7; i++) {
      const a = range(0, Math.PI * 2)
      const r = range(0.3, 0.8)
      const lily = new THREE.Mesh(padGeo, std(0x4fae4a))
      lily.position.set(POND.x + Math.cos(a) * POND.rx * r, pondY + 0.02, POND.z + Math.sin(a) * POND.rz * r)
      lily.rotation.y = range(0, 6)
      lily.scale.setScalar(range(0.7, 1.2))
      world.add(lily)
      if (i < 2) {
        const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), std(0xff9ac1))
        f.position.copy(lily.position).setY(pondY + 0.08)
        world.add(f)
      }
    }
    for (let i = 0; i < 3; i++) {
      const duck = new THREE.Group()
      const y = std(i === 2 ? 0xffffff : 0xffd23f, { roughness: 0.6 })
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), y)
      body.scale.set(1.25, 0.8, 0.9)
      body.castShadow = true
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), y)
      head.position.set(0.2, 0.2, 0)
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 10), std(0xff8a3d))
      beak.rotation.z = -Math.PI / 2
      beak.position.set(0.34, 0.18, 0)
      const eyeMat = std(0x1d2433)
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), eyeMat)
        eye.position.set(0.27, 0.25, s * 0.07)
        duck.add(eye)
      }
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 8), y)
      tail.rotation.z = Math.PI / 2 + 0.5
      tail.position.set(-0.26, 0.07, 0)
      duck.add(body, head, beak, tail)
      duck.scale.setScalar(i === 2 ? 0.7 : 1)
      duck.userData = { phase: i * 2.1, r: 0.35 + i * 0.18 }
      world.add(duck)
      ducks.push(duck)
    }
  }

  // ---------------------------------------------------------- trees
  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true })
  const trunkMat = std(0x8a5a3b, { roughness: 0.9 })
  const blob = new THREE.IcosahedronGeometry(1, 1)
  const roundCanopy = mergeGeometries([
    place(blob, 0, 2.6, 0, 1.25),
    place(blob, 0.75, 2.2, 0.2, 0.85),
    place(blob, -0.7, 2.25, -0.15, 0.9),
    place(blob, 0.1, 3.35, -0.1, 0.8),
  ])
  const pineCanopy = mergeGeometries([
    place(new THREE.ConeGeometry(1.3, 1.6, 8), 0, 1.6, 0),
    place(new THREE.ConeGeometry(1.05, 1.4, 8), 0, 2.45, 0),
    place(new THREE.ConeGeometry(0.75, 1.2, 8), 0, 3.25, 0),
  ])
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 2.2, 8).translate(0, 1.1, 0)
  const shadowGeo = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2)

  interface TreeSpot {
    x: number
    z: number
    s: number
    kind: 'round' | 'pine'
    color: number
  }
  const spots: TreeSpot[] = []
  const roundColors = [0x62b85a, 0x55a852, 0x78c566, 0x4c9c58, 0x6cbb5c]
  const accentColors = [0xf7b0c6, 0xf5c451, 0xf2a34a]
  let tries = 0
  while (spots.length < 95 && tries++ < 4000) {
    const a = rand() * Math.PI * 2
    const r = spots.length < 30 ? range(11, 22) : range(20, 60)
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (inFlyZone(x, z) || inPond(x, z, 1.6) || nearPath(x, z, 2.2)) continue
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 2.8)) continue
    const pine = rand() < 0.3
    const accent = !pine && rand() < 0.12
    spots.push({
      x,
      z,
      s: range(0.8, 1.35) * (r > 30 ? 1.2 : 1),
      kind: pine ? 'pine' : 'round',
      color: pine ? pick([0x2f8f5b, 0x3a9d63, 0x2c8455]) : accent ? pick(accentColors) : pick(roundColors),
    })
  }
  const m4 = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const v = new THREE.Vector3()
  const sc = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)
  const col = new THREE.Color()
  for (const kind of ['round', 'pine'] as const) {
    const list = spots.filter((s) => s.kind === kind)
    const leaves = new THREE.InstancedMesh(kind === 'round' ? roundCanopy : pineCanopy, leafMat, list.length)
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, list.length)
    list.forEach((s, i) => {
      q.setFromAxisAngle(up, rand() * Math.PI * 2)
      v.set(s.x, groundHeight(s.x, s.z) - 0.05, s.z)
      sc.set(s.s, s.s * range(0.9, 1.15), s.s)
      m4.compose(v, q, sc)
      leaves.setMatrixAt(i, m4)
      trunks.setMatrixAt(i, m4)
      leaves.setColorAt(i, col.setHex(s.color).offsetHSL(0, 0, range(-0.03, 0.03)))
    })
    leaves.castShadow = trunks.castShadow = true
    world.add(leaves, trunks)
  }
  // Soft round shadows under each tree
  const shadows = new THREE.InstancedMesh(shadowGeo, new THREE.MeshBasicMaterial({ color: 0x1f5a2a, transparent: true, opacity: 0.18, depthWrite: false }), spots.length)
  spots.forEach((s, i) => {
    m4.compose(v.set(s.x + 0.4, groundHeight(s.x, s.z) + 0.04, s.z + 0.3), q.identity(), sc.set(s.s * 1.5, 1, s.s * 1.5))
    shadows.setMatrixAt(i, m4)
  })
  world.add(shadows)

  // ---------------------------------------------------------- bushes, flowers, grass, rocks
  const bushGeo = mergeGeometries([place(blob, 0, 0.35, 0, 0.5), place(blob, 0.45, 0.28, 0.1, 0.38), place(blob, -0.4, 0.3, -0.1, 0.4)])
  const bushSpots: [number, number][] = []
  tries = 0
  while (bushSpots.length < 45 && tries++ < 3000) {
    const a = rand() * Math.PI * 2
    const r = range(9, 30)
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    if (inFlyZone(x, z) || inPond(x, z, 0.6) || nearPath(x, z, 1.4)) continue
    bushSpots.push([x, z])
  }
  const bushes = new THREE.InstancedMesh(bushGeo, leafMat, bushSpots.length)
  bushSpots.forEach(([x, z], i) => {
    const s = range(0.8, 1.5)
    m4.compose(v.set(x, groundHeight(x, z), z), q.setFromAxisAngle(up, rand() * 6), sc.set(s, s, s))
    bushes.setMatrixAt(i, m4)
    bushes.setColorAt(i, col.setHex(pick([0x4fae45, 0x5dbb4f, 0x3f9c48])))
  })
  bushes.castShadow = true
  world.add(bushes)

  const flowerGeo = new THREE.IcosahedronGeometry(0.075, 0)
  const flowerColors = [0xffffff, 0xffe14d, 0xff7eb6, 0xb28cff, 0xff6b6b, 0xffffff]
  const flowerPts: [number, number, number][] = []
  for (let p = 0; p < 26; p++) {
    const a = rand() * Math.PI * 2
    const r = range(3.2, 26)
    const cx = Math.cos(a) * r
    const cz = Math.sin(a) * r
    if (inPond(cx, cz, 0.8) || nearPath(cx, cz, 1.2) || Math.hypot(cx, cz) < 2.4) continue
    const c = pick(flowerColors)
    const n = 12 + Math.floor(rand() * 16)
    for (let i = 0; i < n; i++) {
      const x = cx + range(-1.3, 1.3)
      const z = cz + range(-1.3, 1.3)
      if (Math.hypot(x, z) < 2) continue
      flowerPts.push([x, z, rand() < 0.8 ? c : pick(flowerColors)])
    }
  }
  const flowers = new THREE.InstancedMesh(flowerGeo, std(0xffffff, { roughness: 0.6 }), flowerPts.length)
  flowerPts.forEach(([x, z, c], i) => {
    m4.compose(v.set(x, groundHeight(x, z) + 0.1, z), q.identity(), sc.setScalar(range(0.8, 1.3)))
    flowers.setMatrixAt(i, m4)
    flowers.setColorAt(i, col.setHex(c))
  })
  world.add(flowers)

  const blade = new THREE.ConeGeometry(0.04, 0.22, 5)
  const tuftGeo = mergeGeometries([
    place(blade, 0, 0.16, 0),
    place(blade, 0.06, 0.13, 0.02, 1, 0.8).rotateZ(-0.25),
    place(blade, -0.06, 0.13, -0.02, 1, 0.85).rotateZ(0.25),
  ])
  const tufts = new THREE.InstancedMesh(tuftGeo, std(0xffffff), 520)
  for (let i = 0; i < 520; i++) {
    let x = 0
    let z = 0
    do {
      const a = rand() * Math.PI * 2
      const r = range(3.5, 30)
      x = Math.cos(a) * r
      z = Math.sin(a) * r
    } while (inPond(x, z, 0.3) || nearPath(x, z, 0.9))
    m4.compose(v.set(x, groundHeight(x, z), z), q.setFromAxisAngle(up, rand() * 6), sc.setScalar(range(0.6, 1.1)))
    tufts.setMatrixAt(i, m4)
    tufts.setColorAt(i, col.setHex(pick([0x5fb04a, 0x6cbf4f, 0x78c957])))
  }
  world.add(tufts)

  const rockGeo = new THREE.IcosahedronGeometry(0.4, 0)
  for (const [x, z, s] of [
    [-7.4, -3.2, 0.9],
    [-12.8, -3.4, 0.6],
    [-8.8, -7.3, 0.75],
    [9.6, 3.2, 1.1],
    [10.4, 2.4, 0.6],
    [-14, 9, 1.2],
  ]) {
    const rock = new THREE.Mesh(rockGeo, std(0xa7b3c2, { flatShading: true }))
    rock.position.set(x, groundHeight(x, z) + 0.12 * s, z)
    rock.scale.set(s, s * 0.6, s)
    rock.rotation.y = rand() * 6
    rock.castShadow = true
    world.add(rock)
  }

  // ---------------------------------------------------------- bench and picnic blanket
  {
    const bench = new THREE.Group()
    const wood = std(0xd98b4e, { roughness: 0.8 })
    const metal = std(0x3d4760, { roughness: 0.5, metalness: 0.3 })
    for (let i = 0; i < 3; i++) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.16), wood)
      plank.position.set(0, 0.45, -0.18 + i * 0.18)
      bench.add(plank)
    }
    for (let i = 0; i < 2; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 0.05), wood)
      b.position.set(0, 0.7 + i * 0.2, 0.3)
      b.rotation.x = -0.15
      bench.add(b)
    }
    for (const sx of [-0.75, 0.75])
      for (const sz of [-0.2, 0.25]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, sz > 0 ? 1.0 : 0.45, 0.06), metal)
        leg.position.set(sx, sz > 0 ? 0.5 : 0.22, sz)
        bench.add(leg)
      }
    bench.traverse((o) => (o.castShadow = true))
    bench.position.set(6.8, 0, 10.2)
    bench.rotation.y = Math.PI + 0.5
    world.add(bench)

    const checker = canvasTexture(256, 256, (c) => {
      for (let i = 0; i < 8; i++)
        for (let j = 0; j < 8; j++) {
          c.fillStyle = (i + j) % 2 ? '#ffffff' : '#ff5d6c'
          c.fillRect(i * 32, j * 32, 32, 32)
        }
    })
    const blanket = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.7), new THREE.MeshStandardMaterial({ map: checker, roughness: 1 }))
    blanket.rotation.x = -Math.PI / 2
    blanket.rotation.z = 0.35
    blanket.position.set(-6.5, 0.035, 9.5)
    blanket.receiveShadow = true
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.26, 0.3, 14), std(0xc98a4b))
    basket.position.set(-6.1, 0.18, 9.3)
    basket.castShadow = true
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 20, Math.PI), std(0xa86f37))
    handle.position.set(-6.1, 0.33, 9.3)
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), std(0x4d8dff, { roughness: 0.5 }))
    ball.position.set(-7.4, 0.22, 10.1)
    ball.castShadow = true
    world.add(blanket, basket, handle, ball)
  }

  // ---------------------------------------------------------- butterflies
  const flies: THREE.Group[] = []
  const wingGeo = new THREE.CircleGeometry(0.09, 10)
  wingGeo.translate(0.07, 0, 0)
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group()
    const m = new THREE.MeshStandardMaterial({ color: pick([0xff9f1c, 0xffe14d, 0x9b6bff, 0x4dc3ff, 0xff7eb6]), side: THREE.DoubleSide, roughness: 0.6 })
    const l = new THREE.Mesh(wingGeo, m)
    const r = new THREE.Mesh(wingGeo, m)
    r.rotation.y = Math.PI
    for (const w of [l, r]) w.rotation.x = -Math.PI / 2
    const wl = new THREE.Group().add(l)
    const wr = new THREE.Group().add(r)
    g.add(wl, wr)
    g.userData = { wl, wr, cx: range(-10, 10), cz: range(3, 12), r: range(1.5, 4), sp: range(0.25, 0.5), ph: range(0, 6), y: range(0.4, 1.4) }
    world.add(g)
    flies.push(g)
  }

  return {
    update(t: number) {
      clouds.rotation.y = t * 0.004
      ducks.forEach((d) => {
        const { phase, r } = d.userData as { phase: number; r: number }
        const a = t * 0.12 + phase
        d.position.set(POND.x + Math.cos(a) * POND.rx * r * 1.4, 0.07 + Math.sin(t * 2 + phase) * 0.015, POND.z + Math.sin(a) * POND.rz * r * 1.4)
        d.rotation.y = -a - Math.PI / 2
      })
      flies.forEach((f) => {
        const u = f.userData as { wl: THREE.Group; wr: THREE.Group; cx: number; cz: number; r: number; sp: number; ph: number; y: number }
        const a = t * u.sp + u.ph
        f.position.set(u.cx + Math.cos(a) * u.r, u.y + Math.sin(t * 1.7 + u.ph) * 0.25, u.cz + Math.sin(a * 1.3) * u.r * 0.6)
        f.rotation.y = -a
        const flap = Math.sin(t * 18 + u.ph) * 0.9
        u.wl.rotation.z = flap
        u.wr.rotation.z = -flap
      })
    },
  }
}
