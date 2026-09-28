// Generates the tileable surface textures used by the detailed model.
// Deterministic: the same seeds always produce the same files. Run from the project root:
//   node scripts/build-materials.mjs
// Each set writes <name>-<size>-color.webp (sRGB albedo, alpha = roughness) and
// <name>-<size>-normal.webp (RG = tangent-space normal XY, B = cavity AO, alpha = height).
// Target albedos are read from the owner's reference photographs noted beside each set;
// they are mean surface colours, not photo crops.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT = 'public/assets/materials';
fs.mkdirSync(OUT, {recursive: true});

// ---------- deterministic randomness and tileable noise ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash2 = (x, y, s) => {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const mod = (a, n) => ((a % n) + n) % n;
/** Periodic gradient noise: period px × py lattice cells, range about [-1, 1]. */
function noise(x, y, px, py, seed) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const g = (cx, cy) => {
    const a = hash2(mod(cx, px), mod(cy, py), seed) * Math.PI * 2;
    return [Math.cos(a), Math.sin(a)];
  };
  const d = (cx, cy, dx, dy) => { const [gx, gy] = g(cx, cy); return gx * dx + gy * dy; };
  const u = fade(fx), v = fade(fy);
  const a = d(ix, iy, fx, fy), b = d(ix + 1, iy, fx - 1, fy), c = d(ix, iy + 1, fx, fy - 1), e = d(ix + 1, iy + 1, fx - 1, fy - 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v) * 1.41;
}
/** Tileable fbm over u,v in [0,1): base frequency fx × fy cells. */
function fbm(u, v, fx, fy, octaves, seed, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0;
  for (let o = 0; o < octaves; o++) {
    const m = 1 << o;
    sum += amp * noise(u * fx * m, v * fy * m, fx * m, fy * m, seed + o * 101);
    norm += amp; amp *= gain;
  }
  return sum / norm;
}
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;
const srgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const lin = (hex) => [0, 2, 4].map((i) => { const c = parseInt(hex.slice(1 + i, 3 + i), 16) / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });

// ---------- surface painters: (u, v) in [0,1) -> albedo (linear), roughness, height, cavity ----------
const sets = {
  // Vertical board-and-gap cladding, 150 mm boards over a 1.2 m tile. Reference: IMG_1431.jpg, IMG_1403.jpg.
  cladding: {metres: [1.2, 1.2], bump: 3.2, paint(u, v) {
    const boards = 8, b = Math.floor(u * boards), x = u * boards - b;
    const tone = 0.84 + hash2(b, 1, 7) * 0.3, warm = hash2(b, 2, 7) * 0.12 - 0.05;
    const gap = 0.075, inGap = x > 1 - gap;
    const wobble = fbm(u, v, 2, 3, 3, 11) * 0.35;
    const grainLines = 0.5 + 0.5 * Math.sin((x * 11 + wobble * 3 + fbm(u, v, 4, 1, 2, 12) * 2) * Math.PI * 2);
    const streak = fbm(u * 0.5 + b * 0.37, v, 8, 2, 4, 13);
    let knot = 0;
    for (let k = 0; k < 2; k++) {
      const kv = hash2(b, 10 + k, 5), ku = 0.2 + hash2(b, 20 + k, 5) * 0.55;
      if (hash2(b, 30 + k, 5) < 0.55) { const dx = (x - ku) * 3.2, dy = (mod(v - kv + 0.5, 1) - 0.5) * 18; knot = Math.max(knot, Math.exp(-(dx * dx + dy * dy) * 3.5)); }
    }
    const base = lin('#5f3e29').map((c, i) => c * (1 + (i === 0 ? warm : i === 2 ? -warm : 0)));
    const shade = tone * (0.88 + 0.16 * grainLines + 0.16 * streak) * (1 - 0.28 * knot);
    const crown = Math.pow(Math.max(0, x * (1 - gap - x) * 4 / ((1 - gap) * (1 - gap))), 0.25);
    const nail = [0.12, 0.62].some((nv) => { const dy = mod(v - nv, 1), dx = x - 0.5 * (1 - gap); return dx * dx * 64 + dy * dy * 4096 < 0.4; });
    if (inGap) return {albedo: base.map((c) => c * 0.12), rough: 0.95, height: 0, cavity: 0.35};
    return {albedo: base.map((c) => c * shade * (nail ? 0.55 : 1)), rough: 0.72 + 0.12 * (1 - grainLines) + 0.1 * knot, height: 0.55 + 0.35 * crown + 0.05 * grainLines - 0.08 * knot, cavity: 0.75 + 0.25 * crown};
  }},
  // Fibre-cement slates, 300 × 200 mm exposure, half-bond courses. Reference: IMG_1627.jpg, IMG_1403.jpg.
  roof: {metres: [1.2, 1.2], bump: 4, paint(u, v) {
    const rows = 6, cols = 4, r = Math.floor(v * rows), ly = v * rows - r;
    const shift = (r % 2) * 0.5, s = Math.floor(u * cols + shift), lx = u * cols + shift - s;
    const tone = 0.86 + hash2(mod(s, cols), mod(r, rows), 3) * 0.26;
    const joint = lx < 0.012 || lx > 0.988;
    const speck = fbm(u, v, 24, 24, 3, 31), weather = fbm(u, v, 3, 6, 3, 32);
    const base = lin('#3d3e40');
    const edgeShadow = smooth(0.0, 0.06, ly); // shadow of the course above, which sits on this one
    const albedo = base.map((c, i) => c * tone * (0.92 + 0.1 * speck + 0.08 * weather) * (i === 2 ? 1.04 : 1) * (joint ? 0.4 : 1));
    return {albedo, rough: 0.68 + 0.1 * weather - (joint ? 0 : 0.04 * speck), height: joint ? 0.2 : 0.35 + 0.6 * (1 - ly) * 0.9 + 0.04 * speck, cavity: (joint ? 0.5 : 1) * mix(0.55, 1, edgeShadow)};
  }},
  // Wide oiled oak planks, 220 mm, staggered end joints. Reference: IMG_1462.jpg (family room floor).
  oak: {metres: [1.32, 1.32], bump: 1.6, paint(u, v) {
    const planks = 6, p = Math.floor(u * planks), x = u * planks - p;
    const offset = hash2(p, 4, 17), lv = mod(v - offset, 1), endJoint = lv < 0.004 || lv > 0.996, seam = x < 0.01 || x > 0.99;
    const tone = 0.86 + hash2(p, 5, 17) * 0.26, warm = hash2(p, 6, 17) * 0.1 - 0.04;
    const w = fbm(x * 0.3 + p * 0.19, lv, 2, 2, 3, 41);
    const cathedral = 0.5 + 0.5 * Math.sin(((x - 0.5) * (x - 0.5) * 30 + lv * 3 + w * 4 + p) * Math.PI * 2);
    const fine = 0.5 + 0.5 * Math.sin((x * 40 + fbm(u, v, 6, 2, 2, 42) * 5) * Math.PI);
    const ray = fbm(u, v, 60, 12, 2, 43) > 0.55 ? 0.06 : 0;
    const base = lin('#b88a58').map((c, i) => c * (1 + (i === 0 ? warm : i === 2 ? -warm * 1.5 : 0)));
    const shade = tone * (0.82 + 0.14 * cathedral + 0.08 * fine + ray);
    if (seam || endJoint) return {albedo: base.map((c) => c * 0.35), rough: 0.8, height: 0.2, cavity: 0.55};
    return {albedo: base.map((c) => c * shade), rough: 0.46 + 0.1 * (1 - cathedral), height: 0.6 + 0.08 * fine + 0.05 * cathedral, cavity: 1};
  }},
  // Pale limestone, 600 × 400 mm slabs in running bond with fine joints. Reference: IMG_1431.jpg.
  stone: {metres: [1.2, 1.2], bump: 1.4, paint(u, v) {
    const rows = 3, cols = 2, r = Math.floor(v * rows), ly = v * rows - r, shift = (r % 2) * 0.5;
    const s = Math.floor(u * cols + shift), lx = u * cols + shift - s;
    const jx = Math.min(lx, 1 - lx) * 0.6, jy = Math.min(ly, 1 - ly) * 0.4, j = Math.min(jx, jy);
    const tone = 0.93 + hash2(mod(s, cols), mod(r, rows), 23) * 0.12;
    const cloud = fbm(u, v, 4, 4, 5, 51), speck = fbm(u, v, 64, 64, 2, 52), vein = Math.abs(fbm(u, v, 3, 3, 4, 53));
    const base = lin('#cdc5b7');
    const joint = j < 0.0022, edge = smooth(0.0022, 0.009, j);
    const shade = tone * (0.93 + 0.07 * cloud + 0.05 * speck) * (vein < 0.02 ? 0.93 : 1);
    if (joint) return {albedo: lin('#a89f92'), rough: 0.9, height: 0.1, cavity: 0.6};
    return {albedo: base.map((c) => c * shade), rough: 0.5 + 0.12 * cloud + 0.08 * speck, height: 0.5 + 0.4 * edge + 0.03 * speck, cavity: mix(0.8, 1, edge)};
  }},
  // Mown lawn at 2 mm per pixel; blades are drawn separately below. Reference: IMG_1403.jpg.
  lawn: {metres: [2, 2], bump: 2.2, paint(u, v) {
    const patch = fbm(u, v, 3, 3, 4, 61), fine = fbm(u, v, 40, 40, 2, 62);
    const base = lin('#5e8a33');
    return {albedo: [base[0] * (0.9 + 0.25 * patch), base[1] * (0.92 + 0.14 * patch + 0.06 * fine), base[2] * (0.85 + 0.3 * patch)], rough: 0.95, height: 0.35 + 0.1 * fine, cavity: 0.8};
  }, blades: {count: 90000, length: [7, 18], width: 1.6, colors: ['#4f7a28', '#6b9a3a', '#7ea846', '#3d6420', '#8aa04a']}},
  // Weathered grey pool-deck timber. Reference: pool-flush-surround-reference.jpg.
  deck: {metres: [0.9, 0.9], bump: 1.8, paint(u, v) {
    const w = fbm(u, v, 3, 1, 3, 71), grain = 0.5 + 0.5 * Math.sin((u * 60 + w * 2.5) * Math.PI), check = 0.5 + 0.5 * Math.sin((u * 190 + w * 4) * Math.PI);
    const base = lin('#8e8a82');
    const shade = 0.86 + 0.1 * grain + 0.06 * check + 0.1 * fbm(u, v, 2, 6, 3, 73);
    return {albedo: base.map((c) => c * shade), rough: 0.82 + 0.1 * grain, height: 0.5 + 0.2 * grain + 0.06 * check, cavity: 0.9 + 0.1 * grain};
  }},
  // Plain-weave linen, about 1 mm threads. Reference: IMG_1462.jpg (sofa covers).
  linen: {sizes: [512], metres: [0.08, 0.08], bump: 0.9, paint(u, v) {
    const n = 80, x = u * n, y = v * n, cx = Math.floor(x), cy = Math.floor(y), over = (cx + cy) % 2 === 0;
    const fx = x - cx, fy = y - cy, thread = over ? Math.sin(fy * Math.PI) : Math.sin(fx * Math.PI);
    const slub = fbm(u, v, 8, 8, 3, 81);
    const base = lin('#e3dac8');
    return {albedo: base.map((c) => c * (0.9 + 0.08 * thread + 0.06 * slub)), rough: 0.93, height: 0.4 + 0.4 * thread + 0.1 * slub, cavity: 0.85 + 0.15 * thread};
  }},
  // Lime plaster with a soft trowelled finish. Reference: IMG_1462.jpg (walls).
  plaster: {sizes: [512], metres: [2, 2], bump: 0.7, paint(u, v) {
    const cloud = fbm(u, v, 3, 3, 5, 91), sand = fbm(u, v, 90, 90, 2, 92), trowel = fbm(u, v, 6, 10, 3, 93);
    const base = lin('#ece4d4');
    return {albedo: base.map((c) => c * (0.96 + 0.035 * cloud + 0.015 * sand)), rough: 0.84 + 0.08 * trowel, height: 0.5 + 0.12 * trowel + 0.05 * sand, cavity: 1};
  }},
  // Furrowed bark for trunks and limbs.
  bark: {sizes: [512], metres: [0.6, 0.6], bump: 3.5, paint(u, v) {
    const ridge = Math.abs(fbm(u, v * 0.25, 7, 2, 4, 101)), plate = fbm(u, v, 5, 3, 3, 102);
    const base = lin('#5b5042');
    const furrow = smooth(0.0, 0.18, ridge);
    return {albedo: base.map((c) => c * (0.6 + 0.45 * furrow + 0.12 * plate)), rough: 0.95, height: 0.2 + 0.7 * furrow + 0.1 * plate, cavity: 0.55 + 0.45 * furrow};
  }},
};

async function writeSet(name, set, size) {
  const n = size * size, albedo = new Float32Array(n * 3), rough = new Float32Array(n), height = new Float32Array(n), cavity = new Float32Array(n);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, s = set.paint((x + 0.5) / size, (y + 0.5) / size);
    albedo.set(s.albedo, i * 3); rough[i] = s.rough; height[i] = s.height; cavity[i] = s.cavity;
  }
  if (set.blades) paintBlades(set.blades, size, albedo, height, rough);
  await encode(name, size, albedo, rough, height, cavity, set.bump, set.metres);
}
/** Short tapered blade strokes with wrap-around, painted back to front. */
function paintBlades(b, size, albedo, height, rough) {
  const r = rng(4242), scale = size / 1024, colors = b.colors.map(lin);
  for (let k = 0; k < b.count * scale * scale; k++) {
    const x0 = r() * size, y0 = r() * size, len = (b.length[0] + r() * (b.length[1] - b.length[0])) * scale, a = -Math.PI / 2 + (r() - 0.5) * 1.6;
    const col = colors[Math.floor(r() * colors.length)], lift = 0.5 + r() * 0.5, steps = Math.ceil(len);
    for (let t = 0; t <= steps; t++) {
      const f = t / steps, w = b.width * scale * (1 - f * 0.8), px = x0 + Math.cos(a) * len * f, py = y0 + Math.sin(a) * len * f;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const qx = Math.round(px + ox * w * 0.5), qy = Math.round(py + oy * w * 0.5), i = mod(qy, size) * size + mod(qx, size);
        const h = 0.45 + lift * (0.3 + 0.7 * f);
        if (h < height[i]) continue;
        height[i] = h; rough[i] = 0.9;
        for (let c = 0; c < 3; c++) albedo[i * 3 + c] = col[c] * (0.75 + 0.45 * f);
      }
    }
  }
}
async function encode(name, size, albedo, rough, height, cavity, bump, metres) {
  const n = size * size, color = Buffer.alloc(n * 4), normal = Buffer.alloc(n * 4);
  const at = (x, y) => height[mod(y, size) * size + mod(x, size)];
  // Height is in units of `bump` millimetres per full range; slope uses the tile's physical texel size.
  const texel = [metres[0] / size, metres[1] / size], depth = bump / 1000;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    for (let c = 0; c < 3; c++) color[i * 4 + c] = Math.round(clamp(srgb(albedo[i * 3 + c])) * 255);
    color[i * 4 + 3] = Math.round(clamp(rough[i]) * 255);
    const dx = (at(x + 1, y) - at(x - 1, y)) * depth / (2 * texel[0]), dy = (at(x, y + 1) - at(x, y - 1)) * depth / (2 * texel[1]);
    // Image rows run top to bottom while v runs bottom to top in the shader, hence +dy.
    const l = Math.hypot(dx, dy, 1), nx = -dx / l, ny = dy / l;
    normal[i * 4] = Math.round((nx * 0.5 + 0.5) * 255); normal[i * 4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
    normal[i * 4 + 2] = Math.round(clamp(cavity[i]) * 255); normal[i * 4 + 3] = Math.round(clamp(height[i]) * 255);
  }
  const base = path.join(OUT, `${name}-${size}`);
  await sharp(color, {raw: {width: size, height: size, channels: 4}}).webp({quality: 84, alphaQuality: 90, effort: 5}).toFile(base + '-color.webp');
  await sharp(normal, {raw: {width: size, height: size, channels: 4}}).webp({quality: name === 'lawn' ? 78 : 88, alphaQuality: 70, effort: 5}).toFile(base + '-normal.webp');
}

// ---------- leaf atlas: 2 × 2 cells of twig clusters with alpha ----------
function leafShape(kind, x, y) {
  // x along the leaf from stem (0) to tip (1); y across, in leaf widths. Returns signed inside amount.
  if (kind === 'palm') {
    // Five radiating lobes around a point near the petiole, like the garden's Japanese maple.
    const dx = x - 0.32, dy = y, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy);
    let reach = 0.08;
    for (const [ak, len] of [[0, 0.68], [0.78, 0.6], [-0.78, 0.6], [1.55, 0.42], [-1.55, 0.42]]) reach = Math.max(reach, len * Math.exp(-Math.pow((a - ak) / 0.24, 2)));
    return reach - r;
  }
  if (kind === 'needle') return 0.035 - Math.abs(y) * (1 + x * 0.3) - (x > 1 ? 1 : 0) - (x < 0 ? 1 : 0);
  const serration = kind === 'small' ? 0 : 0.03 * Math.sin(x * 60);
  const halfWidth = 0.5 * Math.pow(Math.sin(Math.PI * clamp(x)), 0.75) * (1 - 0.3 * x) + serration * Math.sin(Math.PI * x);
  return x < 0 || x > 1 ? -1 : halfWidth - Math.abs(y);
}
async function writeLeaves(size) {
  const n = size * size, albedo = new Float32Array(n * 3), alpha = new Float32Array(n), height = new Float32Array(n).fill(0), rough = new Float32Array(n).fill(0.62), cavity = new Float32Array(n).fill(1);
  // Normals follow each leaf's own curvature; stacking depth and silhouettes stay flat so edges do not catch the sky.
  const owner = new Int32Array(n), bulge = new Float32Array(n);
  const cell = size / 2;
  const cells = [
    {kind: 'ovate', ox: 0, oy: 0, count: 26, len: [0.2, 0.3], width: 0.46, greens: ['#5d7a2e', '#6f8f35', '#4e6b28', '#80983c', '#5a7330'], seed: 1},
    {kind: 'palm', ox: 1, oy: 0, count: 24, len: [0.15, 0.21], width: 1, greens: ['#627f2c', '#76903a', '#86973c', '#57702a', '#6a8a30', '#7c8c38', '#5d7a2c', '#8c7a34'], seed: 2},
    {kind: 'needle', ox: 0, oy: 1, count: 260, len: [0.14, 0.22], width: 1, greens: ['#2f4a26', '#3c5a2c', '#476432', '#35502a'], seed: 3},
    {kind: 'small', ox: 1, oy: 1, count: 240, len: [0.07, 0.1], width: 0.62, greens: ['#3f5f26', '#4c6e2c', '#56772f', '#355420', '#61803a'], seed: 4},
  ];
  for (const c of cells) {
    const r = rng(c.seed * 977), greens = c.greens.map(lin);
    const twig = [];
    // A curving twig from the lower edge; leaves attach along it and on side shoots.
    const bend = (r() - 0.5) * 0.6;
    for (let t = 0; t <= 1; t += 0.004) twig.push([0.5 + Math.sin(t * 2.2) * bend * t, 0.96 - t * 0.72]);
    const shoots = c.kind === 'small' ? 7 : c.kind === 'needle' ? 9 : 4;
    const anchors = [...twig.filter((_, i) => i % 12 === 0)], twigs = [twig];
    for (let s = 0; s < shoots; s++) {
      const [ax, ay] = twig[Math.floor((0.25 + r() * 0.7) * (twig.length - 1))], dir = (s % 2 ? 1 : -1) * (0.5 + r() * 0.7) - Math.PI / 2;
      const shoot = [];
      for (let t = 0; t < 0.3; t += 0.004) shoot.push([ax + Math.cos(dir) * t, ay + Math.sin(dir) * t]);
      twigs.push(shoot);
      anchors.push(...shoot.filter((_, i) => i % 10 === 0));
    }
    const drawTwig = (pts, w) => { for (const [px, py] of pts) stamp(px, py, w); };
    const stamp = (px, py, w) => {
      const cx = (c.ox + px) * cell, cy = (c.oy + py) * cell, rad = w * cell;
      for (let y = Math.floor(cy - rad - 1); y <= cy + rad + 1; y++) for (let x = Math.floor(cx - rad - 1); x <= cx + rad + 1; x++) {
        if (x < c.ox * cell || x >= (c.ox + 1) * cell || y < c.oy * cell || y >= (c.oy + 1) * cell) continue;
        const d = rad - Math.hypot(x + 0.5 - cx, y + 0.5 - cy), i = y * size + x;
        if (d <= -0.5 || height[i] > 0.3) continue;
        alpha[i] = Math.max(alpha[i], clamp(d + 0.5)); height[i] = 0.3; rough[i] = 0.9; owner[i] = -1; bulge[i] = 0;
        albedo.set(lin('#4a3b2c'), i * 3);
      }
    };
    for (const t of twigs) drawTwig(t, c.kind === 'needle' ? 0.007 : 0.005);
    for (let k = 0; k < c.count; k++) {
      const [rx, ry] = anchors[Math.floor(r() * anchors.length)];
      const ang = -Math.PI / 2 + (r() - 0.5) * 2.6, len = (c.len[0] + r() * (c.len[1] - c.len[0])), wid = len * c.width;
      // Keep every leaf inside its cell so cards never show a cropped edge.
      const ax = clamp(rx, 0.04 + len, 0.96 - len), ay = clamp(ry, 0.04 + len, 0.96 - len);
      const col = greens[Math.floor(r() * greens.length)], light = 0.8 + r() * 0.45, z = 0.4 + r() * 0.6, ca = Math.cos(ang), sa = Math.sin(ang);
      const reach = len * 1.05;
      const x0 = Math.floor((c.ox + ax - reach) * cell), x1 = Math.ceil((c.ox + ax + reach) * cell), y0 = Math.floor((c.oy + ay - reach) * cell), y1 = Math.ceil((c.oy + ay + reach) * cell);
      for (let y = Math.max(y0, c.oy * cell); y < Math.min(y1, (c.oy + 1) * cell); y++) for (let x = Math.max(x0, c.ox * cell); x < Math.min(x1, (c.ox + 1) * cell); x++) {
        const px = (x + 0.5) / cell - c.ox - ax, py = (y + 0.5) / cell - c.oy - ay;
        const lx = (px * ca + py * sa) / len, ly = (-px * sa + py * ca) / (c.kind === 'palm' ? len : wid);
        const inside = leafShape(c.kind, lx, ly) * (c.kind === 'palm' ? len : wid) * cell;
        if (inside <= -0.6) continue;
        const i = y * size + x, h = z + 0.12 * (1 - Math.abs(ly) * 2);
        if (h < height[i]) continue;
        const cov = clamp(inside + 0.6);
        const vein = c.kind === 'palm' ? 0 : Math.exp(-ly * ly * 900) * 0.18, edge = 1 - clamp(inside / 3);
        alpha[i] = Math.max(alpha[i] * (1 - cov), cov); height[i] = h; rough[i] = 0.55 + 0.1 * edge; owner[i] = c.seed * 10000 + k + 1; bulge[i] = h - z;
        for (let ch = 0; ch < 3; ch++) albedo[i * 3 + ch] = col[ch] * light * (1 + vein) * (1 - 0.18 * edge);
      }
    }
  }
  // Dilate colour into transparent texels so mipmaps do not bleed dark fringes.
  for (let pass = 0; pass < 6; pass++) for (let i = 0; i < n; i++) if (alpha[i] < 0.5) {
    const x = i % size, y = (i / size) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = mod(y + dy, size) * size + mod(x + dx, size); if (alpha[j] >= 0.5 || albedo[j * 3 + 1] > 0) { if (albedo[i * 3 + 1] === 0) albedo.set(albedo.subarray(j * 3, j * 3 + 3), i * 3); } }
  }
  const color = Buffer.alloc(n * 4), normal = Buffer.alloc(n * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, at = (ax, ay) => { const j = clamp(ay, 0, size - 1) * size + clamp(ax, 0, size - 1); return owner[j] === owner[i] ? bulge[j] : bulge[i]; };
    for (let c = 0; c < 3; c++) color[i * 4 + c] = Math.round(clamp(srgb(albedo[i * 3 + c])) * 255);
    color[i * 4 + 3] = Math.round(clamp(alpha[i]) * 255);
    const dx = (at(x + 1, y) - at(x - 1, y)) * 12, dy = (at(x, y + 1) - at(x, y - 1)) * 12, l = Math.hypot(dx, dy, 1);
    normal[i * 4] = Math.round((-dx / l * 0.5 + 0.5) * 255); normal[i * 4 + 1] = Math.round((dy / l * 0.5 + 0.5) * 255);
    normal[i * 4 + 2] = 255; normal[i * 4 + 3] = Math.round(clamp(rough[i]) * 255);
  }
  const base = path.join(OUT, `leaves-${size}`);
  await sharp(color, {raw: {width: size, height: size, channels: 4}}).webp({quality: 86, alphaQuality: 100, effort: 5}).toFile(base + '-color.webp');
  await sharp(normal, {raw: {width: size, height: size, channels: 4}}).webp({quality: 88, alphaQuality: 80, effort: 5}).toFile(base + '-normal.webp');
}

// ---------- tileable water ripples (normal only) ----------
async function writeWater(size) {
  const n = size * size, h = new Float32Array(n), waves = [[3, 1, 0.5], [1, 4, 0.35], [5, -2, 0.25], [-4, 3, 0.2], [7, 5, 0.1], [2, -7, 0.1]];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size; let s = 0.25 * fbm(u, v, 6, 6, 3, 111);
    for (const [a, b, amp] of waves) s += amp * Math.sin((u * a + v * b) * Math.PI * 2 + a * 1.7);
    h[y * size + x] = s;
  }
  const out = Buffer.alloc(n * 4), at = (x, y) => h[mod(y, size) * size + mod(x, size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, dx = (at(x + 1, y) - at(x - 1, y)) * 3, dy = (at(x, y + 1) - at(x, y - 1)) * 3, l = Math.hypot(dx, dy, 1);
    out[i * 4] = Math.round((-dx / l * 0.5 + 0.5) * 255); out[i * 4 + 1] = Math.round((dy / l * 0.5 + 0.5) * 255); out[i * 4 + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); out[i * 4 + 3] = 255;
  }
  await sharp(out, {raw: {width: size, height: size, channels: 4}}).webp({quality: 90, effort: 5}).toFile(path.join(OUT, `water-${size}-normal.webp`));
}

const manifest = {};
for (const size of [1024, 512]) {
  for (const [name, set] of Object.entries(sets)) {
    if (set.sizes && !set.sizes.includes(size)) continue;
    const t = Date.now();
    await writeSet(name, set, size);
    manifest[name] = {metres: set.metres, sizes: set.sizes || [1024, 512]};
    console.log(`${name}-${size}: ${Date.now() - t} ms`);
  }
  await writeLeaves(size);
  await writeWater(size);
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({generator: 'scripts/build-materials.mjs', sets: manifest}, null, 1) + '\n');
console.log('Wrote', fs.readdirSync(OUT).length, 'files to', OUT);
