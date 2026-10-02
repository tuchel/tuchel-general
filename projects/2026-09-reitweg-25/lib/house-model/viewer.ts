import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {DisplayP3ColorSpace,DisplayP3ColorSpaceImpl} from 'three/addons/math/ColorSpaces.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {sunDirection,initialSunStudy,type SunStudy} from './sun-position';
import {terrainWithPoolOpening} from './pool';
import {groundOpenings} from './site-openings';
import {landscapeContext} from './landscape-context';
import {buildHouseModel} from './build-model';
import {batchStatic} from './static-batch';
import {createLighting,roomExposure,indoorOf,type LightReading} from './lighting';
import {createPost} from './post';
import {createCameraRig,type Framing} from './camera-rig';
import {createCaptures} from './experience';
import {createLiveTrace,traceBlend,LIVE_TRACE} from './live-trace';
import {addAlbedoOutput} from './albedo-pass';
import {createPoolReflection} from './pool-reflection';
import {hasShaderFeature,materialsOf} from './shader-features';
import {createClouds} from './clouds';
import {places,type Place,type CaptureState} from './experience-data';
import {foliageMaterials,finishFoliage,drawTrees} from './foliage';
import {loadSurfaceTextures,finishSurfaces} from './surface-materials';
import {bakeSkyVisibility} from './sky-visibility';
import {bakeSunBounce} from './sun-bounce';
import {eyeLevelGrass} from './grass';
import {createWalker,type WalkInput} from './walk';
import {tierFor,type Quality} from './device-tier';
import {createPerfReadout} from './perf-readout';
import {renovationState,type RenovationState} from './renovation-data';
import {viewpoints,type Level,type Region,type Viewpoint} from './site-data';

export type ViewerOptions={
 quality:Quality;
 onSelect:(region:Region)=>void;onReady:()=>void;onError:()=>void;
 onCapture?:(state:CaptureState)=>void;
 /** The viewer asks to leave an eye-level view (Escape) or reset (Home). */
 onRequest?:(request:'exit'|'reset')=>void;
 onHeading?:(degrees:number)=>void;
 onMaterials?:(status:'loading'|'ready')=>void;
};
/** A dragged sun re-traces bounced light and the traced scene once it has been still this long (ms). */
const SUN_SETTLE=150;
const halton=(i:number,b:number)=>{let f=1,r=0;while(i>0){f/=b;r+=f*(i%b);i=Math.floor(i/b);}return r;};
const SITE_CENTER=new T.Vector3(-5,0,8),SITE_RADIUS=70;

export function createHouseViewer(host:HTMLDivElement,options:ViewerOptions){
 const tier=tierFor(options.quality),realistic=tier.quality!=='model';
 const renderer=new T.WebGLRenderer({antialias:!realistic,alpha:false,stencil:false,powerPreference:'high-performance'});
 // Floor views cut roofs at the wall height with per-material clipping.
 renderer.localClippingEnabled=true;
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,tier.pixelRatio));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 renderer.toneMapping=realistic?T.AgXToneMapping:T.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
 // Extreme on a wide-gamut screen draws in Display P3: colours the photographic grade saturates past sRGB stay saturated
 // instead of clipping (post.ts).
 const wide=tier.quality==='extreme'&&window.matchMedia('(color-gamut: p3)').matches;
 if(wide)T.ColorManagement.define({[DisplayP3ColorSpace]:DisplayP3ColorSpaceImpl});
 renderer.outputColorSpace=wide?DisplayP3ColorSpace:T.SRGBColorSpace;
 const canvas=renderer.domElement;
 canvas.setAttribute('aria-label','Interactive 3D model of Reitweg 25. Drag to orbit, pinch or scroll to zoom. Arrow keys rotate, plus and minus zoom, Home resets.');
 canvas.setAttribute('role','img');canvas.tabIndex=0;host.appendChild(canvas);
 // `?debug=perf`: what each pass costs the graphics card, what a frame costs the processor, how a trace progresses.
 const perf=new URLSearchParams(location.search).get('debug')==='perf'?createPerfReadout(renderer,host,{quality:tier.quality,motionScale:tier.motionScale}):undefined;
 const timed=<R,>(label:string,work:()=>R):R=>perf?perf.time(label,work):work();
 const baked=(label:string,work:()=>boolean|undefined)=>perf?perf.baked(label,work):work();
 const scene=new T.Scene();scene.background=realistic?null:new T.Color('#edece5');
 const camera=realistic?new T.PerspectiveCamera(36,1,.1,3000):new T.OrthographicCamera(-35,35,25,-25,.1,450);
 camera.position.set(34,32,47);
 const controls=new OrbitControls(camera,canvas);
 Object.assign(controls,{enableDamping:true,dampingFactor:.085,minDistance:4,maxDistance:320,minZoom:.45,maxZoom:5,maxPolarAngle:Math.PI/2-.05,minPolarAngle:.025,panSpeed:.8,rotateSpeed:.6,zoomToCursor:true,screenSpacePanning:true,zoomSpeed:.85});
 controls.touches.ONE=T.TOUCH.ROTATE;controls.touches.TWO=T.TOUCH.DOLLY_PAN;controls.target.set(-8,1,9);
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const rig=createCameraRig(camera,controls,reduced);

 // Scene: house, setting and ground.
 const foliage=realistic?foliageMaterials(tier.trees):undefined;
 const setting=realistic?landscapeContext({foliage,density:tier.farWoodland}):undefined;
 const model=buildHouseModel(realistic,setting?.group,foliage);scene.add(model.root);
 const stageGeometry=terrainWithPoolOpening(groundOpenings());
 if(realistic){const p=stageGeometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,-5*T.MathUtils.smoothstep(p.getX(i),55,140));stageGeometry.computeVertexNormals();}
 const stageMaterial=new T.MeshStandardMaterial({color:realistic?'#a0b18d':'#edece5',roughness:1});if(realistic)stageMaterial.userData.photo='lawn';
 const stage=new T.Mesh(stageGeometry,stageMaterial);stage.position.y=realistic?-.035:-.53;stage.receiveShadow=true;stage.name='surrounding-ground';scene.add(stage);

 // Light.
 let invalidate=()=>{};
 // Extreme: ray-marched cumulus and their shadows (clouds.ts).
 const clouds=realistic&&tier.clouds?createClouds(renderer):undefined;
 const lighting=realistic?createLighting(renderer,scene,model.root,{shadowSize:tier.shadowSize,clouds}):undefined;
 let sun:T.DirectionalLight,environment:T.WebGLRenderTarget|undefined;
 if(lighting){sun=lighting.sun;lighting.apply(initialSunStudy);lighting.fitShadow(SITE_CENTER,SITE_RADIUS);}
 else{
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment();environment=pmrem.fromScene(room,.05);room.dispose();pmrem.dispose();
  scene.environment=environment.texture;scene.environmentIntensity=.3;scene.add(new T.HemisphereLight('#fffdf1','#b7bba7',1.5));
  sun=new T.DirectionalLight('#fff4de',2.4);sun.position.set(-25,55,25);sun.castShadow=true;sun.shadow.mapSize.set(tier.shadowSize,tier.shadowSize);
  Object.assign(sun.shadow.camera,{left:-60,right:65,top:65,bottom:-60,near:1,far:180});sun.shadow.bias=-.00015;sun.shadow.normalBias=.06;sun.shadow.radius=3;scene.add(sun);
 }

 // Materials: generated texture sets load after the first frame; the model is usable before.
 const waterTime={value:0};
 // Leaf cutouts shape shadows, so the static shadow map refreshes as each texture arrives.
 const textures=realistic?loadSurfaceTextures(tier.textureSize,renderer,()=>{renderer.shadowMap.needsUpdate=true;invalidate();},tier.scanned):undefined;
 if(textures){
  options.onMaterials?.('loading');
  finishSurfaces(model.root,textures,waterTime);finishSurfaces(stage,textures,waterTime);
  finishFoliage(model.root,textures.get('leaves'),textures.get('bark'));
  void textures.ready.then(()=>{options.onMaterials?.('ready');invalidate();});
 }

 // One draw per material and visibility pattern.
 const batches=batchStatic({root:model.root,states:model.stateCount,apply:model.applyState,rendered:model.rendered,externalRoots:[model.trees,...model.toggled,...(setting?[setting.vegetation]:[])]});
 const pickables:T.Object3D[]=[...batches.meshes.filter(b=>b.userData.region)];
 model.root.traverse(o=>{if(o instanceof T.InstancedMesh&&o.userData.region)pickables.push(o);});
 let level:Level='exterior',renovations=renovationState(),place:Place|undefined;
 const bake=realistic&&tier.skyBake?bakeSkyVisibility(renderer,batches.meshes.filter(b=>[b.material].flat().every(m=>!m.transparent&&m.userData.photo!=='lawn')),[model.root,stage],tier.sunBounce?.55:.7):undefined;
 // Sunlight bounced indoors: the house itself, without trees and planting.
 const bounce=realistic&&tier.sunBounce?bakeSunBounce(batches.meshes.filter(b=>b.parent===model.root&&[b.material].flat().every(m=>!m.transparent&&!m.alphaTest&&m.userData.photo!=='lawn')),[model.root,stage],sun,tier.sunBounce,tier.bounces):undefined;
 let live:ReturnType<typeof createLiveTrace>|undefined=undefined;
 const applyState=()=>{
  model.setLevel(level);model.setRenovations(renovations);batches.sync(model.stateOf(level,renovations));
  stage.visible=level!=='basement';renderer.shadowMap.needsUpdate=true;
  bake?.request();bounce?.request();live?.invalidate();invalidate();
 };
 applyState();
 const grass=realistic&&tier.grass?eyeLevelGrass(scene,[...batches.meshes,stage]):undefined;
 clouds?.shade([scene]);
 // Walking at eye level: W A S D (Shift to run) on computers, the joysticks on phones.
 const walker=createWalker(rig.lens,()=>[...batches.meshes,stage]),walkInput:WalkInput={forward:0,strafe:0,run:false},lookRate={x:0,y:0};
 const walkAnchor=new T.Vector3(),skyAnchor=new T.Vector3();let joystick=false,room=1,roomTarget=1;

 const post=realistic?createPost(renderer,scene,camera,{samples:tier.samples,ao:tier.ao,bloom:tier.bloom,lens:tier.lens&&lighting?{sun:lighting.sun}:undefined}):undefined;
 // Extreme: the pool mirrors the scene (pool-reflection.ts).
 const mirror=tier.poolMirror&&camera instanceof T.PerspectiveCamera?createPoolReflection(renderer,scene,camera,batches.meshes.filter(b=>materialsOf(b).some(m=>hasShaderFeature(m,'pool-water')))):undefined;
 if(post)perf?.watch(post.passes);
 // Extreme: path tracing takes over the view while the camera rests.
 live=tier.liveTrace&&lighting&&post&&camera instanceof T.PerspectiveCamera?createLiveTrace({renderer,scene,camera,lighting}):undefined;
 // Its surface colours sharpen the traced image (albedo-pass.ts); added before the shaders are compiled ahead.
 if(live)addAlbedoOutput(scene);
 const captures=lighting?createCaptures({
  scene,camera:camera as T.PerspectiveCamera,renderer,root:scene,lighting,heavy:tier.photographic,
  invalidate:()=>invalidate(),onState:s=>options.onCapture?.(s),
  eyeLevel:()=>rig.eyeLevel,
  beginOrbit:()=>{if(rig.eyeLevel)return false;film={position:camera.position.clone(),target:controls.target.clone()};controls.enabled=false;return true;},
  orbit:angle=>{if(!film)return;camera.position.copy(film.position).sub(film.target).applyAxisAngle(new T.Vector3(0,1,0),angle).add(film.target);camera.lookAt(film.target);changed();if(angle>=.9){film=undefined;controls.enabled=true;}},
 }):undefined;
 let film:{position:T.Vector3;target:T.Vector3}|undefined;

 // Frame scheduling: moving frames are fast; still frames refine, then rendering stops.
 let lastChange=performance.now(),needsFrame=true,visible=true,disposed=false,frame=0,ready=false,previous=performance.now(),heading=NaN,resting=false;
 // A panel or dialog over the view: path tracing waits until it closes, so the interface keeps the graphics card.
 let interfaceOpen=false,presented=0;
 // Another app in front: tracing and the background bakes wait, so the rest of the computer keeps the processor and
 // graphics card. Returning carries on where they left off.
 let elsewhere=false;const away=()=>{elsewhere=true;},back=()=>{elsewhere=false;};
 window.addEventListener('blur',away);window.addEventListener('focus',back);
 // Moving frames draw at the tier's motion scale; the first still frame is back at full resolution.
 let drawnLow=false,sunSettle:ReturnType<typeof setTimeout>|undefined;const scaleFor=(moving:boolean)=>moving?tier.motionScale:1;
 const sizePost=(moving:boolean)=>{const {width,height}=host.getBoundingClientRect();if(!width||!height)return;drawnLow=moving;post?.setSize(width,height,renderer.getPixelRatio()*scaleFor(moving));};
 const changed=()=>{lastChange=performance.now();post?.reset();live?.reset();needsFrame=true;resting=false;};
 invalidate=changed;
 const size=()=>{
  const {width,height}=host.getBoundingClientRect();if(!width||!height)return;
  // A running path trace keeps its own resolution; only the canvas's CSS size follows.
  if(captures?.tracing){canvas.style.width=width+'px';canvas.style.height=height+'px';return;}
  renderer.setSize(width,height);post?.setSize(width,height,renderer.getPixelRatio()*scaleFor(drawnLow));mirror?.setSize(width*renderer.getPixelRatio(),height*renderer.getPixelRatio());rig.resize(width,height);changed();
 };
 const observer=new ResizeObserver(size);observer.observe(host);
 const visibility=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)changed();});visibility.observe(host);
 controls.addEventListener('start',()=>{captures?.stop();rig.cancel();changed();});
 controls.addEventListener('change',()=>{rig.project();changed();});

 const fitShadowToView=()=>{
  if(!lighting)return;
  if(rig.eyeLevel){const f=new T.Vector3();rig.lens.getWorldDirection(f);f.y=0;f.normalize();lighting.fitShadow(rig.lens.position.clone().addScaledVector(f,18).setY(0),34);}
  else lighting.fitShadow(SITE_CENTER,SITE_RADIUS);
 };
 const fadeIn=()=>{if(!reduced)canvas.animate([{opacity:0},{opacity:1}],{duration:420,easing:'ease-out'});};
 const framing=(key:Viewpoint):Framing=>{
  const v=viewpoints[key],narrow=host.getBoundingClientRect().width<768;
  const position=new T.Vector3(...(key==='courtyard'&&narrow&&!realistic?[9,43,61] as const:v.position)),target=new T.Vector3(...(key==='courtyard'&&narrow&&!realistic?[-10,1,8] as const:v.target));
  if(level==='basement')target.y=-2;
  return {target,direction:position.sub(target),span:v.span,exterior:level==='exterior',reach:'reach' in v?v.reach:undefined};
 };
 const leaveEyeLevel=()=>{if(!place)return;place=undefined;pressed.clear();Object.assign(walkInput,{forward:0,strafe:0,run:false});lookRate.x=lookRate.y=0;room=roomTarget=1;lighting?.setRoom(1);if(grass){grass.hide();live?.invalidate();}fitShadowToView();};
 const view=(key:Viewpoint|Place,instant=false)=>{
  captures?.stop();
  if(key in places){
   const p=places[key as Place];place=key as Place;
   rig.enterEyeLevel(new T.Vector3(...p.position),new T.Vector3(...p.target));walker.reset();walkAnchor.copy(rig.lens.position);
   room=roomTarget=roomExposure(walker.openness());skyAnchor.copy(rig.lens.position);lighting?.setRoom(room);fitShadowToView();if(grass){grass.showAround(rig.lens.position);live?.invalidate();}fadeIn();
   canvas.setAttribute('aria-label','Eye-level view. W, A, S and D walk; Shift runs. Drag or use arrow keys to look around. Pinch or scroll to zoom. Escape returns to the overview.');
  }else{
   const wasEye=!!place;leaveEyeLevel();
   rig.frame(framing(key as Viewpoint),instant||wasEye);if(wasEye)fadeIn();
   canvas.setAttribute('aria-label','Interactive 3D model of Reitweg 25. Drag to orbit, pinch or scroll to zoom. Arrow keys rotate, plus and minus zoom, Home resets.');
  }
  changed();
 };
 const focus=(x:number,z:number,y:number,span:number)=>{captures?.stop();leaveEyeLevel();rig.frame({target:new T.Vector3(x,y,z),direction:new T.Vector3(-8,12,10),span,exterior:false});changed();};

 // Eye-level look-around and pinch; overview input is OrbitControls'.
 const pointers=new Map<number,[number,number]>();let pinch=0,press:[number,number]=[0,0];
 const down=(e:PointerEvent)=>{press=[e.clientX,e.clientY];if(film)captures?.stop();if(!rig.eyeLevel)return;captures?.stop();pointers.set(e.pointerId,[e.clientX,e.clientY]);canvas.setPointerCapture(e.pointerId);if(pointers.size===2){const [a,b]=[...pointers.values()];pinch=Math.hypot(a[0]-b[0],a[1]-b[1]);}};
 const move=(e:PointerEvent)=>{
  if(!rig.eyeLevel||!pointers.has(e.pointerId))return;
  const last=pointers.get(e.pointerId)!;pointers.set(e.pointerId,[e.clientX,e.clientY]);
  if(pointers.size===2){const [a,b]=[...pointers.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pinch>0)rig.zoomBy(d/pinch);pinch=d;changed();return;}
  const k=.0042/rig.lens.zoom;rig.lookBy((e.clientX-last[0])*k,(e.clientY-last[1])*k);changed();
 };
 const up=(e:PointerEvent)=>{
  pointers.delete(e.pointerId);pinch=0;
  if(rig.eyeLevel||Math.hypot(e.clientX-press[0],e.clientY-press[1])>5)return;
  const rect=canvas.getBoundingClientRect(),ray=new T.Raycaster();
  ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),camera);
  const hit=ray.intersectObjects(pickables,false).find(h=>{for(let o:T.Object3D|null=h.object;o;o=o.parent)if(!o.visible)return false;return true;});
  if(hit)options.onSelect(hit.object.userData.region as Region);
 };
 const wheel=(e:WheelEvent)=>{if(!rig.eyeLevel)return;e.preventDefault();rig.zoomBy(e.deltaY<0?1.08:1/1.08);changed();};
 const key=(e:KeyboardEvent)=>{
  if(e.key==='Escape'&&rig.eyeLevel){options.onRequest?.('exit');return;}
  if(e.key==='Home'){e.preventDefault();options.onRequest?.('reset');return;}
  const arrows:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
  if(arrows[e.key]){e.preventDefault();captures?.stop();const [x,y]=arrows[e.key];if(rig.eyeLevel)rig.lookBy(x*.1,y*.08);else rig.orbitBy(x*.14,y*.1);changed();return;}
  if(['+','=','-'].includes(e.key)){e.preventDefault();rig.zoomBy(e.key==='-'?.85:1.18);changed();}
 };
 const pressed=new Set<string>(),walkKeys:Record<string,[number,number]>={w:[1,0],s:[-1,0],a:[0,-1],d:[0,1]};
 const syncWalk=()=>{if(joystick)return;let f=0,r=0;for(const k of pressed){f+=walkKeys[k][0];r+=walkKeys[k][1];}walkInput.forward=Math.sign(f);walkInput.strafe=Math.sign(r);};
 const typing=(e:KeyboardEvent)=>{const t=e.target as HTMLElement|null;return !!t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable);};
 const walkDown=(e:KeyboardEvent)=>{if(!rig.eyeLevel||e.metaKey||e.ctrlKey||e.altKey||typing(e))return;const k=e.key.toLowerCase();walkInput.run=e.shiftKey;if(!(k in walkKeys))return;e.preventDefault();captures?.stop();pressed.add(k);syncWalk();changed();};
 const walkUp=(e:KeyboardEvent)=>{walkInput.run=e.shiftKey;if(pressed.delete(e.key.toLowerCase()))syncWalk();};
 const walkBlur=()=>{pressed.clear();syncWalk();};
 window.addEventListener('keydown',walkDown);window.addEventListener('keyup',walkUp);window.addEventListener('blur',walkBlur);
 const lost=(e:Event)=>{e.preventDefault();options.onError();};
 canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);
 canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('keydown',key);

 const north=new T.Vector3(...sunDirection(0,0)).normalize(),a=new T.Vector3(),b=new T.Vector3(),buffer=new T.Vector2();
 const reportHeading=()=>{
  if(!options.onHeading)return;
  const view=rig.camera,origin=rig.eyeLevel?view.position.clone().add(view.getWorldDirection(a).multiplyScalar(5)):controls.target;
  a.copy(origin).project(view);b.copy(origin).add(north).project(view);
  const deg=Math.atan2(b.x-a.x,b.y-a.y)*180/Math.PI;
  if(!(Math.abs(deg-heading)<.5)){heading=deg;options.onHeading(deg);}
 };
 const render=(now:number)=>{
  if(disposed)return;frame=requestAnimationFrame(render);
  if(!perf){draw(now);return;}
  perf.begin();try{draw(now);}finally{perf.end(drawnLow);}
 };
 const draw=(now:number)=>{
  if(!visible||document.hidden){previous=now;return;}
  const delta=Math.min((now-previous)/1000,.05);previous=now;
  // Photographs and recordings leave the canvas as files and video, in sRGB; the live view uses the wide gamut.
  const space=wide&&!captures?.active&&!captures?.recording?DisplayP3ColorSpace:T.SRGBColorSpace;if(renderer.outputColorSpace!==space){renderer.outputColorSpace=space;needsFrame=true;}
  if(captures?.tick(now))return;
  if(captures?.breezing){waterTime.value=captures.waterSeconds;lighting?.drift(captures.waterSeconds);}
  // A finished or cancelled film hands the camera back.
  if(film&&!captures?.recording){film=undefined;controls.enabled=!rig.eyeLevel;}
  let moving=rig.update(now);
  if(rig.eyeLevel){
   if(lookRate.x||lookRate.y){rig.lookBy(lookRate.x*delta*1.9,lookRate.y*delta*1.3);moving=true;}
   if(walker.step(delta,walkInput)){moving=true;
    // Keep shadows and near grass centred on the walker, refreshed every few metres.
    if(rig.lens.position.distanceTo(walkAnchor)>4){walkAnchor.copy(rig.lens.position);fitShadowToView();if(grass){grass.showAround(rig.lens.position);live?.invalidate();}}
    if(rig.lens.position.distanceTo(skyAnchor)>.5){skyAnchor.copy(rig.lens.position);roomTarget=roomExposure(walker.openness());}}
   // Exposure eases to the new surroundings over about a second, as eyes adjust walking in or out.
   if(Math.abs(roomTarget-room)>.005){room+=(roomTarget-room)*Math.min(1,delta*3);lighting?.setRoom(room);moving=true;}
  }
  if(controls.enabled&&controls.update(delta))moving=true;
  if(moving)changed();
  if(lighting&&baked('sky',()=>lighting.update(camera,now))){post?.reset();needsFrame=true;}
  if(!elsewhere){if(bake&&baked('sky bake',()=>bake.update()))changed();if(bounce&&baked('bounce bake',()=>bounce.update()))changed();}
  const motion=!!(captures?.breezing||captures?.recording||film);
  const still=!motion&&!moving&&now-lastChange>110,refine=!!post&&still&&post.accumulated<tier.refineFrames;
  // A settled view hands over to path tracing; the floor-plan section of the upper floor cuts roofs with clipping
  // planes, which the tracer cannot, so it stays live.
  if(captures?.active)live?.release();
  if(live&&post&&still&&!refine&&!needsFrame&&level!=='upper'&&!captures?.active&&!interfaceOpen&&!elsewhere&&now-lastChange>LIVE_TRACE.rest&&live.wanted){
   if(!resting){resting=true;perf?.rest(now);}
   const traced=live.step();
   perf?.trace(now,traced,{ready:live.ready,finished:!live.wanted});
   // Drawn a few times a second, and once more when tracing finishes.
   // A denoised image is shown whole, without the grain filter.
   if(traced&&(now-presented>=LIVE_TRACE.present||!live.wanted)){presented=now;const {amount,radius}=traceBlend(traced.denoised?LIVE_TRACE.filter.until:traced.samples);timed('trace blend',()=>post.present(traced.texture,amount,radius,lighting!.exposure,indoorOf(room),traced.demodulated));}
   // What the view shows, for tests: 'preparing', the traced sample count, or 'live'; and the samples behind the denoised
   // image on show.
   const shown=traced?String(Math.floor(traced.samples)):'preparing';if(canvas.dataset.trace!==shown)canvas.dataset.trace=shown;
   const clean=String(traced?.denoised??0);if(canvas.dataset.denoised!==clean)canvas.dataset.denoised=clean;
   return;
  }
  if(!needsFrame&&!refine&&!motion)return;
  if(live&&canvas.dataset.trace!=='live')canvas.dataset.trace='live';
  renderer.toneMappingExposure=lighting?lighting.exposure:.9;
  if(post){
   // A film or recording keeps full resolution throughout.
   const low=tier.motionScale<1&&!still&&!captures?.recording&&!film;if(low!==drawnLow)sizePost(low);
   const jitter=still&&post.accumulated>0;
   if(jitter){const i=post.accumulated,size=renderer.getDrawingBufferSize(buffer);camera.setViewOffset(size.x,size.y,halton(i,2)-.5,halton(i,3)-.5,size.x,size.y);}
   if(motion&&captures?.breezing&&tier.photographic)renderer.shadowMap.needsUpdate=true;
   cullTrees(low);
   if(mirror)timed('mirror',()=>mirror.render());post.render(still,renderer.toneMappingExposure,indoorOf(room),{eyeLevel:rig.eyeLevel});
   if(jitter)camera.clearViewOffset();
  }else timed('scene',()=>renderer.render(scene,rig.camera));
  needsFrame=false;
  reportHeading();
  const programs=String(renderer.info.programs?.length??0);if(canvas.dataset.programs!==programs)canvas.dataset.programs=programs;
  if(!ready){
   ready=true;canvas.dataset.modelReady='true';options.onReady();
   setTimeout(()=>void precompile(),1500);
  }
 };
 // Only trees the view or the pool's mirror can see are drawn; trees too far for single leaves to show are drawn as
 // their leaf-card crowns (drawTrees).
 const cullTrees=(low:boolean)=>{
  if(!(rig.camera instanceof T.PerspectiveCamera))return;
  const height=renderer.getDrawingBufferSize(buffer).y*scaleFor(low),pixel=2*Math.tan(T.MathUtils.degToRad(rig.camera.fov/2))/Math.max(1,height)/rig.camera.zoom;
  const reflected=mirror?.prepare();drawTrees(scene,reflected?[rig.camera,reflected]:[rig.camera],pixel,rig.camera);
 };
 // Shaders for the upper floor's section cut, every renovation, eye-level grass and dusk lamps compile in the
 // background after the first frame, so the first visit to each has no stall. Everything is shown for the moment the
 // materials are gathered, then put back exactly as it was.
 const precompile=async()=>{
  if(!lighting)return;
  for(const [floor,lamps] of [['upper',false],['upper',true],['exterior',true]] as const){
   if(disposed)return;
   const shown=new Map<T.Object3D,boolean>();scene.traverse(o=>shown.set(o,o.visible));
   model.setLevel(floor);scene.traverse(o=>{o.visible=true;});lighting.lamps.visible=lamps;
   const done=renderer.compileAsync(scene,camera);
   model.setLevel(level);for(const [o,v] of shown)o.visible=v;
   await done.catch(()=>{});
  }
 };
 size();view('courtyard',true);frame=requestAnimationFrame(render);

 const saveImage=async()=>{
  captures?.stop();
  const cssSize=renderer.getSize(new T.Vector2()),ratio=renderer.getPixelRatio();
  // Four thousand pixels on computers; about twice the screen on phones, within their memory.
  const longest=Math.max(cssSize.x,cssSize.y),scale=Math.min(3840,tier.photographic?3840:2560)/longest;
  const w=Math.round(cssSize.x*scale),h=Math.round(cssSize.y*scale);
  try{
   renderer.outputColorSpace=T.SRGBColorSpace;renderer.setPixelRatio(1);renderer.setSize(w,h,false);post?.setSize(w,h,1);
   cullTrees(false);
   if(post){for(let i=0;i<Math.max(8,tier.refineFrames);i++){if(i)camera.setViewOffset(w,h,halton(i,2)-.5,halton(i,3)-.5,w,h);mirror?.render();post.render(true,lighting?lighting.exposure:.9,indoorOf(room),{eyeLevel:rig.eyeLevel});camera.clearViewOffset();}}
   else renderer.render(scene,rig.camera);
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));
   if(blob){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='reitweg-25-'+(realistic?'detailed':'model')+'.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  }finally{renderer.setPixelRatio(ratio);renderer.setSize(cssSize.x,cssSize.y,false);post?.setSize(cssSize.x,cssSize.y,ratio);changed();}
 };

 return {
  view,focus,saveImage,
  zoom:(factor:number)=>{captures?.stop();rig.zoomBy(factor);changed();},
  setLevel:(l:Level)=>{captures?.stop();leaveEyeLevel();const floorChanged=l!==level;level=l;applyState();if(floorChanged)controls.target.y=l==='basement'?-2:l==='upper'?3.1:1;rig.project();changed();},
  setRenovations:(state:RenovationState)=>{captures?.stop();renovations={...state};applyState();},
  setSun:(study:SunStudy):LightReading|undefined=>{if(!lighting)return;const r=lighting.apply(study);fitShadowToView();clearTimeout(sunSettle);sunSettle=setTimeout(()=>{bounce?.request();live?.relight();changed();},SUN_SETTLE);changed();return r;},
  get lightReading(){return lighting?.reading;},
  /** A panel or dialog is open over the view (path tracing waits for it to close). */
  setInterface:(open:boolean)=>{interfaceOpen=open;},
  captures,
  get eyeLevel(){return rig.eyeLevel;},
  /** Joystick input: move (forward, strafe) and look rates, each −1…1; zero releases. */
  joystick:(move:{x:number;y:number},look:{x:number;y:number})=>{if(!rig.eyeLevel)return;joystick=!!(move.x||move.y);if(joystick){walkInput.forward=-move.y;walkInput.strafe=move.x;walkInput.run=Math.hypot(move.x,move.y)>.92;}else syncWalk();lookRate.x=look.x;lookRate.y=look.y;changed();},
  snapshot:rig.snapshot,
  restore:(s:Parameters<typeof rig.restore>[0])=>{rig.restore(s);changed();},
  dispose:()=>{
   disposed=true;cancelAnimationFrame(frame);perf?.dispose();window.removeEventListener('keydown',walkDown);window.removeEventListener('keyup',walkUp);window.removeEventListener('blur',walkBlur);window.removeEventListener('blur',away);window.removeEventListener('focus',back);clearTimeout(sunSettle);captures?.dispose();live?.dispose();mirror?.dispose();observer.disconnect();visibility.disconnect();controls.dispose();
   canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('keydown',key);
   bake?.dispose();bounce?.dispose();clouds?.dispose();grass?.dispose();post?.dispose();lighting?.dispose();textures?.dispose();environment?.dispose();
   const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
   scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}if(o instanceof T.Mesh&&o.customDepthMaterial)materials.add(o.customDepthMaterial);});
   geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
   renderer.dispose();renderer.forceContextLoss();canvas.remove();
  },
 };
}
export type HouseViewer=ReturnType<typeof createHouseViewer>;
