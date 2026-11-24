import assert from 'node:assert/strict';
import fs from 'node:fs';
const viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8'),page=fs.readFileSync('components/studio/model/house-model.tsx','utf8');
const lib=fs.readdirSync('lib/house-model').filter(f=>f.endsWith('.ts')).map(f=>fs.readFileSync(`lib/house-model/${f}`,'utf8')).join('\n');
const features=fs.readFileSync('lib/house-model/shader-features.ts','utf8'),lighting=fs.readFileSync('lib/house-model/lighting.ts','utf8'),surfaces=fs.readFileSync('lib/house-model/surface-materials.ts','utf8');
// `?renderer=webgpu` loads three's WebGPU renderer only when asked, and only for the presets it can draw: Model whole,
// Balanced without baked sky light, bounced sun and the image passes.
assert(/export const drawnWithWebGPU=\(quality:Quality\)=>quality==='model'\|\|quality==='balanced';/.test(viewer));
assert(/drawnWithWebGPU\(quality\)&&new URLSearchParams\(window\.location\.search\)\.get\('renderer'\)==='webgpu'\?await Promise\.all\(\[import\('three\/webgpu'\),import\('three\/tsl'\),import\('three\/addons\/objects\/SkyMesh\.js'\)\]\)/.test(page));
assert(/const tier=gpu\?\{\.\.\.asked,skyBake:false,sunBounce:0,ao:false,refineFrames:0\}:asked;/.test(viewer)&&/const post=realistic&&!gpu\?createPost\(/.test(viewer));
// It has no device until `init` resolves: sky light and the first frame wait for it, and the canvas says which backend
// it runs on.
assert(/const device=gpu\?\(renderer as unknown as \{init\(\):Promise<unknown>\}\)\.init\(\)\.then\(\(\)=>\{canvas\.dataset\.renderer=/.test(viewer));
assert(/if\(lighting&&device\)void device\.then\(\(\)=>\{if\(disposed\)return;lighting\.update\(camera,performance\.now\(\)\);/.test(viewer));
// A shadow's redraw is kept on the light there, so the viewer's own switch is passed on to the sun's.
assert(/if\(gpu\)Object\.defineProperty\(renderer\.shadowMap,'needsUpdate',\{set:\(on:boolean\)=>\{if\(on&&sunShadow\)sunShadow\.needsUpdate=true;\}/.test(viewer)&&/sunShadow=sun\.shadow;sunShadow\.autoUpdate=false;/.test(viewer));
// The sky is three's node sky with the same values and additions; sky light is filtered by that renderer's own filter.
assert(/const makeSky=\(\)=>\(gpu\?new gpu\.SkyMesh\(\):new Sky\(\)\) as Sky/.test(lighting)&&/gpu\?new gpu\.PMREMGenerator\(renderer as never\):new T\.PMREMGenerator\(renderer\)/.test(lighting));
// A shader feature may carry the same effect as nodes; a material's features are composed in order into its colour,
// roughness, normal and cavity, and no two materials share a program, since nodes hold a material's own textures.
assert(/nodes\?:\(slots:NodeSlots\)=>void/.test(features)&&/if\(tsl\)composeNodes\(material,list\);/.test(features)&&/\+\(tsl\?'\|'\+material\.uuid:''\)/.test(features));
assert(/drawWithNodes\(gpu\?\.tsl\);/.test(viewer));
assert(/\},nodes:slots=>\{[\s\S]*?slots\.colour=\(slots\.colour\?\?materialColor\)\.mul\(albedo\);slots\.roughness=clamp\(texel\.a,\.05,1\);[\s\S]*?slots\.cavity=relief\.b;/.test(surfaces),'scanned and painted surfaces are drawn as nodes');
// Light is changed in a lighting model of the material's own: three's, with what the features add for each light and
// change in the light from all round. Leaves glow against the light, glass and water turn opaque at a glancing angle.
assert(/class Lighting extends tsl\.PhysicalLightingModel\{[\s\S]*?direct\(light:any,builder:any\)\{super\.direct\(light,builder\);for\(const add of slots\.direct\)add\(light\);\}[\s\S]*?indirect\(builder:any\)\{for\(const change of slots\.indirect\)change\(builder\.context\);super\.indirect\(builder\);\}/.test(features));
const foliage=fs.readFileSync('lib/house-model/foliage.ts','utf8');
assert(/slots\.direct\.push\(\(\{lightDirection,lightColor,reflectedLight\}\)=>reflectedLight\.directDiffuse\.addAssign\(/.test(foliage));
assert(/slots\.opacity=mix\(slots\.opacity\?\?materialOpacity,1,normalView\.dot\(positionViewDirection\)\.abs\(\)\.oneMinus\(\)\.pow\(5\)\.mul\(\.88\)\);/.test(surfaces),'glass');
assert(/const t=uniform\(0\)\.onRenderUpdate\(\(\)=>time\.value\)/.test(surfaces)&&/\.oneMinus\(\)\.pow\(4\)\.mul\(\.92\)\);/.test(surfaces),'pool water');
// It draws no line loops.
assert(!/T\.LineLoop/.test(lib),'no line loop in the model');
console.log('Passed: with ?renderer=webgpu the Model and Balanced presets are drawn by three\'s WebGPU renderer, started once its device is ready, with shadows redrawn only on change; Balanced has its sky, sun and textured surfaces there.');
