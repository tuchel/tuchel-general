// Packs photo-scanned CC0 surface sets (Poly Haven, ambientCG) for Extreme. Run from the project root:
//   node scripts/build-scanned-materials.mjs
// Sources download once into tmp/scans/. Each set is written in the generated sets' format (build-materials.mjs):
// <name>-<size>-color.webp (sRGB albedo, alpha = roughness) and <name>-<size>-normal.webp (RG = tangent-space normal
// XY, OpenGL convention, B = ambient occlusion, alpha = height). Colour and roughness are scaled so their means match the
// generated set of the same name, which carries the owner's photographed colour; the scan keeps its own variation.
// Tile size in metres is the scan's real-world size.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import sharp from 'sharp';

const OUT = 'public/assets/materials/scanned', CACHE = 'tmp/scans';
fs.mkdirSync(OUT, {recursive: true}); fs.mkdirSync(CACHE, {recursive: true});
const PH = (id) => ({source: 'Poly Haven', id, page: `https://polyhaven.com/a/${id}`, file: (map) => `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/${id}/${id}_${map}_2k.jpg`, maps: {color: 'diff', normal: 'nor_gl', rough: 'rough', ao: 'ao', height: 'disp'}});
const ACG = (id) => ({source: 'ambientCG', id, page: `https://ambientcg.com/view?id=${id}`, zip: `https://ambientcg.com/get?file=${id}_2K-JPG.zip`, maps: {color: 'Color', normal: 'NormalGL', rough: 'Roughness', ao: 'AmbientOcclusion', height: 'Displacement'}});
/** `metres`: the scan's real size; `turn`: quarter turns clockwise (boards that run vertically on the wall). */
const sets = {
  cladding: {...PH('weathered_plank_siding'), metres: 1.57, turn: 1, size: 1024},
  roof: {...PH('grey_roof_tiles_02'), metres: 1.5, size: 1024},
  oak: {...PH('oak_wood_planks'), metres: 1.2, turn: 1, size: 1024},
  stone: {...PH('sandstone_blocks_08'), metres: 3, size: 1024},
  lawn: {...ACG('Grass004'), metres: 1.4, size: 1024},
  deck: {...PH('wood_planks_grey'), metres: 1.5, size: 1024},
  linen: {...PH('rough_linen'), metres: 0.271, size: 1024},
  plaster: {...PH('plastered_wall'), metres: 2, size: 1024},
  bark: {...PH('bark_brown_02'), metres: 1, size: 1024},
};

const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const srgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

function fetchTo(url, file) {
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return;
  execFileSync('curl', ['-sSfL', '-A', 'Mozilla/5.0', '-o', file, url]);
}
/** The five maps of a set as JPEG paths in the cache. */
function sources(name, set) {
  const dir = path.join(CACHE, set.id); fs.mkdirSync(dir, {recursive: true});
  const out = {};
  if (set.zip) {
    const zip = path.join(CACHE, `${set.id}.zip`); fetchTo(set.zip, zip);
    for (const [key, map] of Object.entries(set.maps)) {
      const file = path.join(dir, `${map}.jpg`);
      if (!fs.existsSync(file)) fs.writeFileSync(file, execFileSync('unzip', ['-p', zip, `${set.id}_2K-JPG_${map}.jpg`], {maxBuffer: 1 << 28}));
      out[key] = file;
    }
  } else for (const [key, map] of Object.entries(set.maps)) { const file = path.join(dir, `${map}.jpg`); fetchTo(set.file(map), file); out[key] = file; }
  return out;
}
/** A map at `size` × `size`, `channels` per pixel, turned `turn` quarter turns clockwise. */
async function read(file, size, turn, channels) {
  let image = sharp(file).rotate(turn * 90).resize(size, size, {fit: 'fill', kernel: 'lanczos3'});
  image = channels === 1 ? image.greyscale() : image.removeAlpha();
  const {data} = await image.raw().toBuffer({resolveWithObject: true});
  return data;
}
/** Mean linear colour and roughness of a generated set, at 512 (every set has it; check-house-materials holds its mean
 * near the photographed colour). */
async function generatedMeans(name) {
  const file = `public/assets/materials/${name}-512-color.webp`;
  const {data, info} = await sharp(file).raw().toBuffer({resolveWithObject: true});
  const sum = [0, 0, 0, 0], n = info.width * info.height;
  for (let i = 0; i < n; i++) { for (let c = 0; c < 3; c++) sum[c] += lin(data[i * 4 + c] / 255); sum[3] += data[i * 4 + 3] / 255; }
  return sum.map((s) => s / n);
}

const manifest = {packer: 'scripts/build-scanned-materials.mjs', licence: 'CC0 1.0', sets: {}};
for (const [name, set] of Object.entries(sets)) {
  const t = Date.now(), {size} = set, turn = set.turn ?? 0, n = size * size, files = sources(name, set);
  const [color, normal, rough, ao, height] = await Promise.all([read(files.color, size, turn, 3), read(files.normal, size, turn, 3), read(files.rough, size, turn, 1), read(files.ao, size, turn, 1), read(files.height, size, turn, 1)]);
  const target = await generatedMeans(name), mean = [0, 0, 0, 0];
  for (let i = 0; i < n; i++) { for (let c = 0; c < 3; c++) mean[c] += lin(color[i * 3 + c] / 255); mean[3] += rough[i] / 255; }
  const gain = mean.map((m, c) => target[c] / (m / n));
  const outColor = Buffer.alloc(n * 4), outNormal = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) outColor[i * 4 + c] = Math.round(clamp(srgb(clamp(lin(color[i * 3 + c] / 255) * gain[c]))) * 255);
    outColor[i * 4 + 3] = Math.round(clamp(rough[i] / 255 * gain[3], 0.04, 1) * 255);
    // A quarter turn clockwise carries the old up (+y) to the right (+x) and the old right to down (−y).
    let x = normal[i * 3] / 127.5 - 1, y = normal[i * 3 + 1] / 127.5 - 1;
    for (let k = 0; k < turn; k++) [x, y] = [y, -x];
    outNormal[i * 4] = Math.round(clamp(x * 0.5 + 0.5) * 255); outNormal[i * 4 + 1] = Math.round(clamp(y * 0.5 + 0.5) * 255);
    outNormal[i * 4 + 2] = ao[i]; outNormal[i * 4 + 3] = height[i];
  }
  const base = path.join(OUT, `${name}-${size}`);
  await sharp(outColor, {raw: {width: size, height: size, channels: 4}}).webp({quality: 82, alphaQuality: 80, effort: 5}).toFile(base + '-color.webp');
  await sharp(outNormal, {raw: {width: size, height: size, channels: 4}}).webp({quality: 82, alphaQuality: 70, effort: 5}).toFile(base + '-normal.webp');
  manifest.sets[name] = {metres: [set.metres, set.metres], size, source: set.source, asset: set.id, page: set.page};
  console.log(`${name}: ${set.source} ${set.id}, ${set.metres} m, gain ${gain.map((g) => g.toFixed(2)).join('/')}, ${Date.now() - t} ms`);
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
console.log('Wrote', fs.readdirSync(OUT).length, 'files to', OUT);
