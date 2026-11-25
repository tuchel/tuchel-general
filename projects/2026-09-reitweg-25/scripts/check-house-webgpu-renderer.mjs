import assert from 'node:assert/strict';
import fs from 'node:fs';
const viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8'),page=fs.readFileSync('components/studio/model/house-model.tsx','utf8');
const lib=fs.readdirSync('lib/house-model').filter(f=>f.endsWith('.ts')).map(f=>fs.readFileSync(`lib/house-model/${f}`,'utf8')).join('\n');
const features=fs.readFileSync('lib/house-model/shader-features.ts','utf8'),lighting=fs.readFileSync('lib/house-model/lighting.ts','utf8'),surfaces=fs.readFileSync('lib/house-model/surface-materials.ts','utf8');
// `?renderer=webgpu` loads three's WebGPU renderer only when asked, and only for the presets it can draw.
assert(/export const drawnWithWebGPU=\(quality:Quality\)=>quality==='model'\|\|quality==='balanced';/.test(viewer));
assert(/drawnWithWebGPU\(quality\)&&new URLSearchParams\(window\.location\.search\)\.get\('renderer'\)==='webgpu'\?await Promise\.all\(\[import\('three\/webgpu'\),import\('three\/tsl'\),import\('three\/addons\/objects\/SkyMesh\.js'\),/.test(page));
// It has no device until `init` resolves: sky light and the first frame wait for it, and the canvas says which backend
// it runs on.
assert(/const device=gpu\?\(renderer as unknown as \{init\(\):Promise<unknown>\}\)\.init\(\)\.then\(\(\)=>\{canvas\.dataset\.renderer=/.test(viewer));
assert(/if\(lighting&&device\)void device\.then\(\(\)=>\{if\(disposed\)return;bake\?\.prepare\(\);lighting\.update\(camera,performance\.now\(\)\);/.test(viewer));
// A shadow's redraw is kept on the light there, so the viewer's own switch is passed on to the sun's.
assert(/if\(gpu\)Object\.defineProperty\(renderer\.shadowMap,'needsUpdate',\{set:\(on:boolean\)=>\{if\(on&&sunShadow\)sunShadow\.needsUpdate=true;\}/.test(viewer)&&/sunShadow=sun\.shadow;sunShadow\.autoUpdate=false;/.test(viewer));
// The sky is three's node sky with the same values and additions; sky light is filtered by that renderer's own filter.
assert(/const makeSky=\(\)=>\(gpu\?new gpu\.SkyMesh\(\):new Sky\(\)\) as Sky/.test(lighting)&&/gpu\?new gpu\.PMREMGenerator\(renderer as never\):new T\.PMREMGenerator\(renderer\)/.test(lighting));
// A shader feature may carry the same effect as nodes; a material's features are composed in order into its colour,
// roughness, normal and cavity, and no two materials share a program, since nodes hold a material's own textures.
assert(/nodes\?:\(slots:NodeSlots\)=>void/.test(features)&&/if\(tsl\)composeNodes\(material,list\);/.test(features)&&/\+\(tsl\?'\|'\+material\.uuid:''\)/.test(features));
assert(/drawWithNodes\(gpu\?\.tsl&&\{\.\.\.gpu\.tsl,PhysicalLightingModel:gpu\.PhysicalLightingModel\}\);/.test(viewer));
assert(/\},nodes:slots=>\{[\s\S]*?slots\.colour=\(slots\.colour\?\?materialColor\)\.mul\(albedo\);slots\.roughness=clamp\(texel\.a,\.05,1\);[\s\S]*?slots\.cavity=relief\.b;/.test(surfaces),'scanned and painted surfaces are drawn as nodes');
// Light is changed in a lighting model of the material's own: three's, with what the features add for each light and
// change in the light from all round. Leaves glow against the light, glass and water turn opaque at a glancing angle.
assert(/class Lighting extends tsl\.PhysicalLightingModel\{[\s\S]*?direct\(light:any,builder:any\)\{super\.direct\(light,builder\);for\(const add of slots\.direct\)add\(light\);\}[\s\S]*?indirect\(builder:any\)\{for\(const change of slots\.indirect\)change\(builder\.context\);super\.indirect\(builder\);\}/.test(features));
const foliage=fs.readFileSync('lib/house-model/foliage.ts','utf8');
assert(/slots\.direct\.push\(\(\{lightDirection,lightColor,reflectedLight\}\)=>reflectedLight\.directDiffuse\.addAssign\(/.test(foliage));
assert(/slots\.opacity=mix\(slots\.opacity\?\?materialOpacity,1,normalView\.dot\(positionViewDirection\)\.abs\(\)\.oneMinus\(\)\.pow\(5\)\.mul\(\.88\)\);/.test(surfaces),'glass');
assert(/const t=uniform\(0\)\.onRenderUpdate\(\(\)=>time\.value\)/.test(surfaces)&&/\.oneMinus\(\)\.pow\(4\)\.mul\(\.92\)\);/.test(surfaces),'pool water');
// The indoor sky light is baked and read there too: the same gathering as nodes, with a probe's row and its place in
// the depth map turned over for that renderer; the same blend of eight probes in its shading language; and the light
// from all round scaled before three uses it. Its 3D textures are made before a material reads them.
const sky=fs.readFileSync('lib/house-model/sky-visibility.ts','utf8');
assert(/const skyAtWgsl=`fn skyAt\(p:vec3<f32>,n:vec3<f32>,low:vec3<f32>,grid:vec3<f32>,cell:f32,linked:f32,volume:texture_3d<f32>,volumeSampler:sampler,reach:texture_3d<f32>\)->vec4<f32>\{/.test(sky));
assert(/material\.vertexNode=vec4\(cell\.x,cell\.y\.negate\(\),0,1\);/.test(sky)&&/float\(\.5\)\.sub\(l\.y\.div\(l\.w\)\.mul\(\.5\)\),l\.z\.div\(l\.w\),1\)/.test(sky));
assert(/slots\.indirect\.push\(context=>\{[\s\S]*?context\.irradiance\.mulAssign\(visible\);context\.radiance\.mulAssign\(mix\(1,visible,\.85\)\);/.test(sky));
assert(/if\(gpu\)links\.needsUpdate=true;/.test(sky)&&/for\(const v of volumes\)r\.initRenderTarget\(v\);/.test(sky)&&/bake\?\.prepare\(\);lighting\.update\(/.test(viewer));
// The image chain there (post-gpu.ts): the scene into a floating-point target, still frames averaged, and the WebGL
// chain's finish, which tone-maps and encodes itself, so the renderer is asked for neither while it is drawn.
const chain=fs.readFileSync('lib/house-model/post-gpu.ts','utf8');
assert(/createPostGPU\(\.\.\.a,\{tsl:gpu\.tsl,ao:gpu\.ao,NodeMaterial:gpu\.NodeMaterial,QuadMesh:gpu\.QuadMesh\}\):createPost\(\.\.\.a\)/.test(viewer));
assert(/weight\.value=1\/\(frames\+1\);/.test(chain)&&/const mapped=agxToneMapping\(shown\.rgb\.mul\(balance\),exposure\);/.test(chain)&&/quadOf\(vec4\(sRGBTransferOETF\(graded\),1\)\)/.test(chain));
assert(/renderer\.toneMapping=T\.NoToneMapping;renderer\.outputColorSpace=T\.LinearSRGBColorSpace;[\s\S]*?renderer\.toneMapping=mapping;renderer\.outputColorSpace=space;/.test(chain));
// It draws no line loops.
assert(!/T\.LineLoop/.test(lib),'no line loop in the model');
// Bounced sunlight is read from the same two atlases and added to the light from all round; the sky light bounced
// indoors takes its colour from the surfaces round the point, as in the WebGL renderer.
const bounce=fs.readFileSync('lib/house-model/sun-bounce.ts','utf8');
assert(/\},nodes:slots=>\{[\s\S]*?slots\.indirect\.push\(context=>\{[\s\S]*?context\.iblIrradiance\.addAssign\(/.test(bounce)&&/slots\.tint=fallback=>/.test(bounce));
assert(/slots\.tint\?slots\.tint\(warm\):warm/.test(sky));
// Corner shading is three's node pass over the scene's depth, at the WebGL chain's settings: on still frames only, its
// grain turned from frame to frame so that the average of still frames smooths it, blended in by the finish's amount.
assert(/import\('three\/addons\/tsl\/display\/GTAONode\.js'\)/.test(page)&&!/ao:false/.test(viewer));
assert(/const shade=options\.ao&&gpu\.ao\?gpu\.ao\(texture\(target\.depthTexture!\),null,camera\):undefined,/.test(chain)&&/shade\.useTemporalFiltering=true;/.test(chain));
assert(/radius\.value=\.7;[^\n]*distanceExponent\.value=1\.6;[^\n]*thickness\.value=1\.4;[^\n]*samples\.value=12;/.test(chain)&&/occlusion\.value=g\.occlusion;/.test(chain));
assert(/\(refining&&shaded\?shaded:blend\)\.render\(renderer\);/.test(chain));
// The night sky's stars and moon are drawn with the sky there too, from the same hash and the same disc.
assert(/if\(!env\)\{[\s\S]*?const cell=direction\.mul\(230\)[\s\S]*?sparkle\.greaterThan\(\.996\)[\s\S]*?uniform\(moon\.value\)[\s\S]*?\.greaterThan\(\.999\)/.test(lighting));
// three refreshes an object's values each frame only when its material holds a node. A plain-coloured material whose
// light is changed holds none of its own, so it is given its colour as one: otherwise it never learns a bake finished.
assert(/colorNode:slots\.colour\?\?\(lit\?tsl\.materialColor:null\)/.test(features));
// Trees by season and in the wind: a card's shed leaves and its twigs are its colour's alpha, which three also cuts its
// shadow by, and the sway moves the vertex, shadow and all.
const air=fs.readFileSync('lib/house-model/atmosphere.ts','utf8');
assert(/position\?:any/.test(features)&&/positionNode:slots\.position\?\?null/.test(features));
assert(/leafFall=\{key:'leaf-fall',[\s\S]*?\},nodes:\(slots:NodeSlots\)=>\{[\s\S]*?slots\.colour=select\(bare,/.test(foliage));
assert(/\},nodes:\(slots:NodeSlots\)=>\{[\s\S]*?slots\.position=\(slots\.position\?\?positionLocal\)\.add\(/.test(air));
// The far scenery: the mountain backdrop keeps its place as the camera climbs, and the distant woods take their own,
// longer haze in place of the scene's fog.
const alps=fs.readFileSync('lib/house-model/alpine-terrain.ts','utf8'),woods=fs.readFileSync('lib/house-model/forests.ts','utf8');
assert(/output\?:\(colour:any\)=>any/.test(features)&&/outputNode:slots\.output\?slots\.output\(tsl\.output\):null/.test(features));
assert(/nodes:slots=>\{[\s\S]*?slots\.position=[^\n]*attribute\('panoramaLift','float'\)/.test(alps));
assert(/nodes:slots=>\{[\s\S]*?material\.fog=false;[\s\S]*?slots\.output=colour=>/.test(woods));
// The WebGPU renderer calls onBeforeRender inside its shadow pass too: every tree still casts there.
assert(/let casting=false;[\s\S]{0,120}mesh\.onBeforeRender=\(\)=>\{mesh\.count=casting\?total:mesh\.userData\.drawn as number;\};[\s\S]{0,160}mesh\.onAfterShadow=\(\)=>\{casting=false;\};/.test(foliage));
// A cutout's shadow is cut by its colour node's alpha once, not by the texture's alpha as well.
assert(/r\._getShadowNodes=m=>\{const map=m\.map;if\(!m\.colorNode\|\|!map\)return nodes\(m\);m\.map=null;try\{return nodes\(m\);\}finally\{m\.map=map;\}\};/.test(viewer));
console.log('Passed: with ?renderer=webgpu the Model and Balanced presets are drawn by three\'s WebGPU renderer, started once its device is ready, with shadows redrawn only on change; Balanced has its sky with stars and moon, sun, textured surfaces, indoor sky light, bounced sunlight, corner shading, averaged still frames and colour finish there.');
