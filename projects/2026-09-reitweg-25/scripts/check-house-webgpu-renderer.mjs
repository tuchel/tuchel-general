import assert from 'node:assert/strict';
import fs from 'node:fs';
const viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8'),page=fs.readFileSync('components/studio/model/house-model.tsx','utf8');
const lib=fs.readdirSync('lib/house-model').filter(f=>f.endsWith('.ts')).map(f=>fs.readFileSync(`lib/house-model/${f}`,'utf8')).join('\n');
// `?renderer=webgpu` loads three's WebGPU renderer only when asked, and only for a preset every shader of which it can build.
assert(/export const drawnWithWebGPU=\(quality:Quality\)=>quality==='model';/.test(viewer),'so far the Model preset');
assert(/drawnWithWebGPU\(quality\)&&new URLSearchParams\(window\.location\.search\)\.get\('renderer'\)==='webgpu'\?await import\('three\/webgpu'\)/.test(page));
assert(/const gpu=drawnWithWebGPU\(tier\.quality\)\?options\.webgpu:undefined;/.test(viewer));
// It has no device until `init` resolves: the environment is filtered and the first frame drawn after that, and the
// canvas says which backend it runs on.
assert(/\.init\(\)\.then\(\(\)=>\{[\s\S]*?canvas\.dataset\.renderer=[\s\S]*?new gpu\.PMREMGenerator[\s\S]*?begin\(\);/.test(viewer));
// A shadow's redraw is kept on the light there, so the viewer's own switch is passed on to it.
assert(/sun\.shadow\.autoUpdate=false;\s*Object\.defineProperty\(renderer\.shadowMap,'needsUpdate',\{set:\(on:boolean\)=>\{if\(on\)sun\.shadow\.needsUpdate=true;\}/.test(viewer));
// It draws no line loops.
assert(!/T\.LineLoop/.test(lib),'no line loop in the model');
console.log('Passed: with ?renderer=webgpu the Model preset is drawn by three\'s WebGPU renderer, started once its device is ready, with shadows redrawn only on change.');
