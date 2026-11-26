import assert from 'node:assert/strict';
import fs from 'node:fs';
const viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8'),page=fs.readFileSync('components/studio/model/house-model.tsx','utf8');
const lib=fs.readdirSync('lib/house-model').filter(f=>f.endsWith('.ts')).map(f=>fs.readFileSync(`lib/house-model/${f}`,'utf8')).join('\n');
const features=fs.readFileSync('lib/house-model/shader-features.ts','utf8'),lighting=fs.readFileSync('lib/house-model/lighting.ts','utf8'),surfaces=fs.readFileSync('lib/house-model/surface-materials.ts','utf8');
// `?renderer=webgpu` loads three's WebGPU renderer only when asked, and only for the presets it can draw.
// Every preset is drawn there; Extreme leaves off the parts not ported yet, and `&try=` turns named ones on to test them.
const tierCode=fs.readFileSync('lib/house-model/device-tier.ts','utf8');
assert(/export const WEBGPU_PENDING=\[[^\]]*'wetMirror'[^\]]*\] as const;/.test(tierCode)&&!/WEBGPU_PENDING=\[[^\]]*'(lens|temporal|roomProbes|softShadows|steerMotion|lampGlow)'/.test(tierCode)&&/WEBGPU_PENDING\.filter\(k=>!tried\.includes\(k\)\)\.map\(k=>\[k,false\]\)/.test(tierCode));
assert(/const tier=gpu\?forWebGPU\(chosen,new URLSearchParams\(window\.location\.search\)\.get\('try'\)\?\.split\(','\),new URLSearchParams\(window\.location\.search\)\.get\('without'\)\?\.split\(','\)\):chosen/.test(viewer)&&/without\.filter\(k=>typeof \(tier as unknown as Record<string,unknown>\)\[k\]==='boolean'\)\.map\(k=>\[k,false\]\)/.test(tierCode)&&/const wide=!gpu&&tier\.quality==='extreme'/.test(viewer));
assert(/const webgpu=new URLSearchParams\(window\.location\.search\)\.get\('renderer'\)==='webgpu'\?await Promise\.all\(\[import\('three\/webgpu'\),import\('three\/tsl'\),import\('three\/addons\/objects\/SkyMesh\.js'\),/.test(page));
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
assert(/nodes\?:\(slots:NodeSlots\)=>void/.test(features)&&/if\(tsl\)composeNodes\(material,list\);/.test(features));
assert(/drawWithNodes\(gpu\?\.tsl&&\{\.\.\.gpu\.tsl,PhysicalLightingModel:gpu\.PhysicalLightingModel\}\);/.test(viewer));
assert(/\},nodes:slots=>\{[\s\S]*?slots\.colour=\(slots\.colour\?\?materialColor\)\.mul\(albedo\);slots\.roughness=clamp\(aged\?texel\.a\.add\(aged\.rough\):texel\.a,\.05,1\);[\s\S]*?slots\.cavity=relief\.b;/.test(surfaces),'scanned and painted surfaces are drawn as nodes');
// Light is changed in a lighting model of the material's own: three's, with what the features add for each light and
// change in the light from all round. Leaves glow against the light, glass and water turn opaque at a glancing angle.
assert(/class Lighting extends tsl\.PhysicalLightingModel\{[\s\S]*?direct\(light:any,builder:any\)\{[^\n]*?super\.direct\(light,builder\);for\(const add of slots\.direct\)add\(light\);\}[\s\S]*?indirect\(builder:any\)\{for\(const change of slots\.indirect\)change\(builder\.context\);super\.indirect\(builder\);\}/.test(features));
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
assert(/createPostGPU\(\.\.\.a,\{tsl:gpu\.tsl,ao:gpu\.ao,bloom:gpu\.bloom,NodeMaterial:gpu\.NodeMaterial,QuadMesh:gpu\.QuadMesh\}\):createPost\(\.\.\.a\)/.test(viewer));
assert(/weight\.value=1\/\(frames\+1\);/.test(chain)&&/const mapped=agxToneMapping\(shown\.rgb\.mul\(balance\),exposure\);/.test(chain)&&/quadOf\(vec4\(sRGBTransferOETF\(grained\),1\)\)/.test(chain));
assert(/renderer\.toneMapping=T\.NoToneMapping;renderer\.outputColorSpace=T\.LinearSRGBColorSpace;[\s\S]*?renderer\.toneMapping=mapping;renderer\.outputColorSpace=space;/.test(chain));
// The kept moving image (temporal.ts) with the WebGL pass's settings: looked up where the last frame saw the point,
// held to the new frame's neighbouring colours, at full size whatever size the moving frames are drawn at.
assert(/import \{TEMPORAL\} from '\.\/temporal';/.test(chain)&&/share\.value=is\?TEMPORAL\.blend:1;/.test(chain)&&/expected\.mul\(TEMPORAL\.tolerance\)\.add\(\.05\)/.test(chain)&&/hi\.sub\(lo\)\.mul\(TEMPORAL\.slack\)/.test(chain)&&/frames=TEMPORAL\.carry;/.test(chain),'the kept image in motion');
// Wet paving's mirror (wet-reflections.ts): the paving leaves how far it mirrors in the frame's alpha, and the chain
// follows each such pixel's mirrored ray through the frame's depth.
assert(/import \{WET_MIRROR\} from '\.\/wet-reflections';/.test(chain)&&/WET_MIRROR\.steps/.test(chain)&&/WET_MIRROR\.reach/.test(chain)&&/misted\(mirrored\(touched\(frame\)\)\)/.test(chain)&&/slots\.output=[^\n]*aged\.mirror\.mul\(-\.5\)\.add\(1\)/.test(surfaces),'the wet paving mirror')
// The shutter in motion (motion-blur.ts): the moving frame smeared along each point's path since the last frame.
assert(/import \{MOTION_BLUR\} from '\.\/motion-blur';/.test(chain)&&/MOTION_BLUR\.shutter/.test(chain)&&/MOTION_BLUR\.longest/.test(chain)&&/MOTION_BLUR\.taps/.test(chain)&&/kept\.blend\(next,moved,moved&&!refining&&flowing\)/.test(chain)&&/const streaks=options\.mist&&options\.shutter\?/.test(chain)&&/shutter:new URLSearchParams\(location\.search\)\.get\('try'\)\?\.split\(','\)\.includes\('motionBlur'\)/.test(viewer),'the shutter in motion, behind try=motionBlur')
assert(/if\(kept\)\{if\(kept\.resize\(w,h\)\)frames=0;\}/.test(chain)&&/temporal:!!kept,/.test(chain),'kept at full size; moving frames jittered');
// The lens there, so far: the meter eases exposure by the WebGL chain's rule, and the finish carries its grain.
assert(/import \{LENS,meterCorrection[^}]*\} from '\.\/lens';/.test(chain)&&/exposure\.value=exposed\*\(meter\?\.adapt\(exposed\)\?\?1\);/.test(chain)&&/meterCorrection\(logAverage,exposure\)\/scale,Math\.min\(1,dt\/LENS\.meter\.seconds\)/.test(chain)&&/n\.mul\(LENS\.grain\)/.test(chain),'the meter and the grain');
// Its sun shafts: the air marched through the sun's shadow map with the WebGL pass's settings, at half size.
assert(/\{forward:g,reach,steps,room,outdoors,indoors\}=LENS\.air/.test(chain)&&/for\(let i=0;i<steps;i\+\+\)/.test(chain)&&/map\.load\(ivec2\(vec2\(q\.x,q\.y\.oneMinus\(\)\)/.test(chain)&&/if\(!rest\)shafts\?\.reset\(\);shafts\?\.render\(indoor\);/.test(chain),'sun shafts');
// Short shadows where things touch and ground mist with the lamps' glow, with the WebGL passes' settings, worked into
// the frame before bloom and the sun shafts as there.
assert(/import \{CONTACT\} from '\.\/contact-shadows';/.test(chain)&&/import \{MIST,AIR_GLOW\} from '\.\/mist';/.test(chain)&&/for\(let i=0;i<CONTACT\.steps;i\+\+\)/.test(chain)&&/CONTACT\.strength\*T\.MathUtils\.smoothstep\(toLight\.y,\.\.\.CONTACT\.low\)/.test(chain)&&/mist\.value\.set\(colour\.r,colour\.g,colour\.b,amount\/MIST\.reach\)/.test(chain)&&/const lit=\(frame:any\)=>shafted\(bloomed\(misted\(mirrored\(touched\(frame\)\)\)\)\);/.test(chain),'contact shadows and mist');
// Its focus: at eye level the kept image is blurred by distance from what the meter found in the middle of the frame,
// with the WebGL pass's spiral and its rule that a sharp edge does not spill over what is nearer.
assert(/import \{LENS,meterCorrection,focalLength\} from '\.\/lens';/.test(chain)&&/radius<LENS\.maxBlur;i\+\+,radius\+=\.6\/radius/.test(chain)&&/d\.greaterThan\(centre\),min\(s,centreSize\.mul\(2\)\),s\)/.test(chain)&&/f\*f\/\(LENS\.fNumber\*Math\.max\(d-f,1e-3\)\)\/LENS\.sensor\*image\.height/.test(chain)&&/showing=view\?\.eyeLevel&&focus\?focus\.render\(settled\[0\]\):settled\[0\];/.test(chain),'depth of field');
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
assert(/const shade=options\.ao&&gpu\.ao\?gpu\.ao\(texture\(depthOf\),null,camera\):undefined,/.test(chain)&&/shade\.useTemporalFiltering=true;/.test(chain));
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
// Lying snow: the same cover as nodes, laid over the vertices' and instances' tints, with the pool frozen.
const snowCode=fs.readFileSync('lib/house-model/snow.ts','utf8'),skyCode=fs.readFileSync('lib/house-model/sky-visibility.ts','utf8');
assert(/fn snowOn\(p:vec3<f32>,w:f32,up:f32,open:f32,slope:f32,grain:f32,amount:f32\)->vec2<f32>/.test(snowCode)&&/fn snowOpen\([^)]*reach:texture_3d<f32>\)->f32/.test(snowCode));
assert(/slots\.sky=\{low:uniforms\.uSkyMin,grid:uniforms\.uSkyGrid,cell:uniforms\.uSkyCell,linked:uniforms\.uSkyLinked,reach:texture3D\(links\)\};/.test(skyCode)&&/slots\.sky\?s\.liesUnderSky\(\{\.\.\.given,\.\.\.slots\.sky\}\):s\.lies\(given\)/.test(snowCode));
assert(/tinted\?:\(rgb:any\)=>any/.test(features)&&/setupVariants=function\(this:any,builder:any\)\{tsl\.diffuseColor\.rgb\.assign\(tinted\(tsl\.diffuseColor\.rgb\)\);return Object\.getPrototypeOf\(this\)\.setupVariants\.call\(this,builder\);\};/.test(features));
assert(/slots\.tinted=rgb=>\{const shown=before\?before\(rgb\):rgb;/.test(snowCode)&&/if\(kind==='water'\)\{\s*const ice=smoothstep\(\.15,\.7,s\.amount\)/.test(snowCode)&&/metalnessNode:slots\.metalness\?\?null/.test(features));
assert(/\.mul\(slots\.covered\?slots\.covered\.oneMinus\(\):1\)/.test(foliage));
// Rain and snow fall there as squares that face the screen, behind what the scene's depth says is nearer, and are drawn
// in the pass that shows the frame.
const falling=fs.readFileSync('lib/house-model/falling.ts','utf8'),rain=fs.readFileSync('lib/house-model/rainfall.ts','utf8'),flakes=fs.readFileSync('lib/house-model/snowfall.ts','utf8');
assert(/new T\.InstancedBufferGeometry\(\)/.test(falling)&&/perspectiveDepthToViewZ\(depth\.sample\(screenUV\)\.r,cameraNear,cameraFar\)/.test(falling)&&/if\(gpu\)\{gpu\.over\(object,camera\);return;\}/.test(falling));
assert(/const material=gpu\?streaks\(gpu,uniforms,sky\):new T\.ShaderMaterial\(/.test(rain)&&/const material=gpu\?flakes\(gpu,uniforms,sky\):new T\.ShaderMaterial\(/.test(flakes));
assert(/export function shelterNodes\(/.test(snowCode)&&/over:\(object:T\.Object3D,through:T\.Camera\)=>\{stage\.add\(object\);draw\(through\);\}/.test(chain)&&/get depth\(\)\{return depthOf;\}/.test(chain));
assert(/createSnowfall\(bake\?\.cover,lampsOutdoors\(\),falls\)/.test(viewer)&&/createRainfall\(bake\?\.cover,falls\)/.test(viewer));
// The packed roof snow takes its shape there as nodes: moved along the roof's lay, its own normal, gone where thin.
const slabCode=fs.readFileSync('lib/house-model/snow-slab.ts','utf8');
assert(/maskNode:slots\.mask\?\?null/.test(features)&&/slots\.position=\(slots\.position\?\?positionLocal\)\.add\(modelWorldMatrixInverse\.mul\(vec4\(move,0\)\)\.xyz\);slots\.normal=normalize\(varying\(n\)\);/.test(slabCode)&&/slots\.mask=seen\.x\.greaterThanEqual\(\.004\)\.and\(seen\.y\.greaterThanEqual\(0\)\);/.test(slabCode));
// A glass roof takes its dusting there too.
assert(/if\(kind==='glass'\)\{[^}]*const lie=s\.cover\(p\)\.own\.mul\(/.test(snowCode)&&!/Not yet there: the dusting on a glass roof/.test(snowCode));
// Instanced meshes share their shaders: their matrices are vertex attributes, not a buffer named after each mesh.
assert(/if\(gpu\)\(renderer as unknown as \{backend:\{capabilities:\{getUniformBufferLimit:\(\)=>number\}\}\}\)\.backend\.capabilities\.getUniformBufferLimit=\(\)=>0;/.test(viewer));
// Materials whose features hold nothing of their own share what three builds from their nodes.
assert(/\(list\.every\(f=>f\.variant!==undefined\)\?list\.map\(f=>f\.variant\)\.join\('\|'\):material\.uuid\)/.test(features)&&/key:'sky-visibility',variant:''/.test(skyCode)&&/key:'sun-bounce',variant:''/.test(bounce)&&/key:'snow-'\+kind,last:true,variant:\[\.\.\.how\.toArray\(\),\.\.\.most\.value\.toArray\(\)\]\.join\(\)/.test(snowCode));
// With four samples to a pixel the depth that corner shading and the falling snow read is a plain copy of the scene's.
assert(/const level=options\.samples>=4\?new T\.RenderTarget\(/.test(chain)&&/depthNode:texture\(target\.depthTexture!\)\.load\(ivec2\(screenCoordinate\)\)\.r/.test(chain)&&/gpu\.ao\(texture\(depthOf\),null,camera\)/.test(chain)&&/get depth\(\)\{return depthOf;\}/.test(chain));
// Detailed's bloom there: three's, at the WebGL chain's strength, radius and threshold.
assert(/const glow=options\.bloom&&gpu\.bloom\?gpu\.bloom\(current,\.06,\.1,1\):undefined/.test(chain)&&/if\(glow\)glow\.threshold\.value=2\.5\/Math\.max\(exposed,1e-4\);/.test(chain)&&/import\('three\/addons\/tsl\/display\/BloomNode\.js'\)/.test(page));
// The sky's clouds stand where the WebGL sky has them.
assert(/if\(gpu\)u\.cloudSpeed\.value=0;/.test(lighting));
// Extreme's weathering is drawn there too: the same noise in WGSL, the same marks on walls, roofs and paving.
assert(/const WEATHER_WGSL=`fn weatherHash\(c:vec2<f32>\)->f32/.test(surfaces)&&/const aged=weather&&weatherNodes\(slots\.tsl,weather,\{p,n,tu,tv,albedo\}\)/.test(surfaces)&&/const rain=uniform\(0\)\.onRenderUpdate\(\(\)=>wet\.value\)/.test(surfaces));
// ... and its relief: the texture coordinate is walked along the view ray through the height in the normal map's alpha.
assert(/const RELIEF_WGSL=`fn reliefUv\(/.test(surfaces)&&/uv=wgslFn\(RELIEF_WGSL\)\(\{uv,shift:/.test(surfaces));
// Extreme's cumulus: the sky texture and the ground's share of sunlight are marched in WGSL, a band at a time without
// clearing; the sky reads them, and the sun alone is dimmed by their shadow.
const cloudCode=fs.readFileSync('lib/house-model/clouds.ts','utf8');
assert(/const CLOUDS_WGSL=`[\s\S]*?fn cloudSky\([\s\S]*?fn cloudShade\(/.test(cloudCode)&&/renderer\.autoClear=false;/.test(cloudCode)&&/slots\.sunlight=slots\.sunlight\?slots\.sunlight\.mul\(share\):share;/.test(cloudCode));
assert(/if\(slots\.sunlight&&light\.lightNode\?\.light\?\.isDirectionalLight\)light=\{\.\.\.light,lightColor:light\.lightColor\.mul\(slots\.sunlight\)\};/.test(features)&&/const cloud=clouds\.toward\(gpu\.tsl,direction\);colour=colour\.mul\(cloud\.a\)\.add\(cloud\.rgb\);/.test(lighting));
// The pool's mirror image: read as nodes with its rows turned, and clipped at the water line for depth from 0 to 1.
const poolCode=fs.readFileSync('lib/house-model/pool-reflection.ts','utf8');
assert(/image=texture\(target\.texture,vec2\(uv\.x,uv\.y\.oneMinus\(\)\)\)\.rgb;\s*slots\.indirect\.push\(context=>context\.radiance\.assign\(mix\(context\.radiance,image,ready\)\)\);/.test(poolCode)&&/mirror\.coordinateSystem=camera\.coordinateSystem;\s*clip\.multiplyScalar\(\(deep\?1:2\)\/clip\.dot\(q\)\);e\[2\]=clip\.x;e\[6\]=clip\.y;e\[10\]=deep\?clip\.z:clip\.z\+1;/.test(poolCode));
// While the view moves the mirror image is redrawn every `pace` frames there and kept in between, with the view it was drawn for.
assert(/pace:2/.test(poolCode)&&/const held=\(spare:boolean\)=>spare&&uniforms\.uMirrorReady\.value===1&&turn%POOL_MIRROR\.pace!==0;/.test(poolCode)&&/mirror\?\.prepare\(low&&!!gpu\)/.test(viewer)&&/mirror\.render\(low&&!!gpu\)/.test(viewer),'the pool mirror spared in motion');
// The net of light on the pool's floor, as nodes.
assert(/key:'pool-caustics',[\s\S]*?\},variant:'',nodes:slots=>\{[\s\S]*?fn causticNet\(p:vec2<f32>,t:f32\)->f32/.test(surfaces));
// Room reflections and the softened sun shadow, as nodes: the rooms' maps as layers read by octahedral direction, and
// the shadow's own filter in place of the change to three's shader text.
const roomCode=fs.readFileSync('lib/house-model/room-probes.ts','utf8'),softCode=fs.readFileSync('lib/house-model/soft-shadows.ts','utf8');
assert(/new T\.RenderTarget\(size,size,\{type:T\.HalfFloatType,depthBuffer:false,depth:count\}\)/.test(roomCode)&&/maps3\.depth\(float\(i\)\)\.sample\(oct\(\{d:seen\}\)\)\.level\(/.test(roomCode));
assert(/export function softShadowFilter\(tsl:any\)/.test(softCode)&&/builder\.material\.userData\?\.plainShadow/.test(softCode)&&/if\(gpu&&options\.soft\)\(sun\.shadow as unknown as \{filterNode:unknown\}\)\.filterNode=softShadowFilter\(gpu\.tsl\);/.test(lighting));
// Every tap reads the one map node through a function (a node per tap is updated per object, and cost a frame half
// its script time), and the shadow's radius and size are one pair of uniforms for all materials.
assert(/fn softDepthAt\(map:texture_depth_2d,p:vec2<i32>\)->f32/.test(softCode)&&!/map\.load\(/.test(softCode)&&/shared\.get\(shadow\)/.test(softCode),'one map node for the soft shadow');
// Close leaves keep their veins, toothed outline and sheen: where on the blade comes from the vertex's number.
assert(/key:'leaf-detail',[\s\S]*?\},nodes:\(slots:NodeSlots\)=>\{[\s\S]*?\.element\(vertexIndex\.toFloat\(\)\.mod\(12\)\.toInt\(\)\)\)[\s\S]*?slots\.opacity=[\s\S]*?slots\.normal=normalize\(mix\(round,/.test(foliage));
// A photograph there is traced by the WebGPU tracer on the same renderer, lit by the sky read back from it, on a device
// that was asked for the card's own buffer limits.
const captures=fs.readFileSync('lib/house-model/experience.ts','utf8');
assert(/env=options\.gpu\?await lighting\.equirectGPU\(\):lighting\.equirect\(\);/.test(captures)&&/await import\('three-gpu-pathtracer\/webgpu'\)/.test(captures)&&/addEventListener\('uncapturederror',failed\)/.test(captures));
assert(/equirectGPU:async\(width=1024\)=>/.test(lighting)&&/requiredLimits:gpu\.limits/.test(viewer)&&/heavy:tier\.photographic,gpu:!!gpu,/.test(viewer)&&/maxStorageBufferBindingSize:adapter\.limits\.maxStorageBufferBindingSize/.test(page));
// What lies outside the view is made ready with the rest, not at the first turn of the camera.
assert(/object\.traverse\(o=>\{if\(o\.frustumCulled\)\{culled\.push\(o\);o\.frustumCulled=false;\}\}\);\s*const done=renderer\.compileAsync\(object,camera,scene\);renderer\.setRenderTarget\(previous\);for\(const o of culled\)o\.frustumCulled=true;/.test(chain));
// Where the image chain draws the picture, the canvas keeps one sample to a pixel, as with WebGL.
assert(/new gpu\.WebGPURenderer\(\{antialias:!realistic,/.test(viewer));
console.log('Passed: with ?renderer=webgpu the Model and Balanced presets are drawn by three\'s WebGPU renderer, started once its device is ready, with shadows redrawn only on change; Balanced has its sky with stars and moon, sun, textured surfaces, indoor sky light, bounced sunlight, corner shading, lying snow with its packed layer on the roofs, falling snow and rain, averaged still frames and colour finish there.');
