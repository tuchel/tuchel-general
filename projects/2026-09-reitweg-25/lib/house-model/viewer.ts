import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {sunDirection,initialSunStudy,type SunStudy} from './sun-position';
import {terrainWithPoolOpening} from './pool';
import {basementStairWell} from './site-openings';
import {landscapeContext} from './landscape-context';
import {buildHouseModel} from './build-model';
import {batchStatic} from './static-batch';
import {createLighting,type LightReading} from './lighting';
import {createPost} from './post';
import {createCameraRig,type Framing} from './camera-rig';
import {createCaptures} from './experience';
import {places,type Place,type CaptureState} from './experience-data';
import {foliageMaterials,finishFoliage} from './foliage';
import {loadSurfaceTextures,finishSurfaces} from './surface-materials';
import {bakeSkyVisibility} from './sky-visibility';
import {eyeLevelGrass} from './grass';
import {tiers,type Quality} from './device-tier';
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
const halton=(i:number,b:number)=>{let f=1,r=0;while(i>0){f/=b;r+=f*(i%b);i=Math.floor(i/b);}return r;};
const SITE_CENTER=new T.Vector3(-5,0,8),SITE_RADIUS=70;

export function createHouseViewer(host:HTMLDivElement,options:ViewerOptions){
 const tier=tiers[options.quality],realistic=tier.quality!=='model';
 const renderer=new T.WebGLRenderer({antialias:!realistic,alpha:false,stencil:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,tier.pixelRatio));
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFShadowMap;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 renderer.toneMapping=realistic?T.AgXToneMapping:T.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;renderer.outputColorSpace=T.SRGBColorSpace;
 const canvas=renderer.domElement;
 canvas.setAttribute('aria-label','Interactive 3D model of Reitweg 25. Drag to orbit, pinch or scroll to zoom. Arrow keys rotate, plus and minus zoom, Home resets.');
 canvas.setAttribute('role','img');canvas.tabIndex=0;host.appendChild(canvas);
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
 const stageGeometry=terrainWithPoolOpening([basementStairWell()]);
 if(realistic){const p=stageGeometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,-5*T.MathUtils.smoothstep(p.getX(i),55,140));stageGeometry.computeVertexNormals();}
 const stageMaterial=new T.MeshStandardMaterial({color:realistic?'#a0b18d':'#edece5',roughness:1});if(realistic)stageMaterial.userData.photo='lawn';
 const stage=new T.Mesh(stageGeometry,stageMaterial);stage.position.y=realistic?-.035:-.53;stage.receiveShadow=true;stage.name='surrounding-ground';scene.add(stage);

 // Light.
 let invalidate=()=>{};
 const lighting=realistic?createLighting(renderer,scene,model.root,{shadowSize:tier.shadowSize}):undefined;
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
 const textures=realistic?loadSurfaceTextures(tier.textureSize,renderer,()=>{renderer.shadowMap.needsUpdate=true;invalidate();}):undefined;
 if(textures){
  options.onMaterials?.('loading');
  finishSurfaces(model.root,textures,waterTime);finishSurfaces(stage,textures,waterTime);
  finishFoliage(model.root,textures.get('leaves'),textures.get('bark'));
  void textures.ready.then(()=>{options.onMaterials?.('ready');invalidate();});
 }

 // One draw per material and visibility pattern.
 const batches=batchStatic({root:model.root,states:model.stateCount,apply:model.applyState,rendered:model.rendered,externalRoots:[model.trees,...(setting?[setting.vegetation]:[])]});
 const pickables:T.Object3D[]=[...batches.meshes.filter(b=>b.userData.region)];
 model.root.traverse(o=>{if(o instanceof T.InstancedMesh&&o.userData.region)pickables.push(o);});
 let level:Level='exterior',renovations=renovationState(),place:Place|undefined;
 const bake=realistic&&tier.skyBake?bakeSkyVisibility(renderer,batches.meshes.filter(b=>[b.material].flat().every(m=>!m.transparent&&m.userData.photo!=='lawn')),[model.root,stage]):undefined;
 const applyState=()=>{
  model.setLevel(level);model.setRenovations(renovations);batches.sync(model.stateOf(level,renovations));
  stage.visible=level!=='basement';renderer.shadowMap.needsUpdate=true;
  bake?.request();invalidate();
 };
 applyState();
 const grass=realistic&&tier.grass?eyeLevelGrass(scene,[...batches.meshes,stage]):undefined;

 const post=realistic?createPost(renderer,scene,camera,{samples:tier.samples,ao:tier.ao,bloom:tier.bloom}):undefined;
 const captures=lighting?createCaptures({
  scene,camera:camera as T.PerspectiveCamera,renderer,root:scene,lighting,heavy:tier.photographic,
  invalidate:()=>invalidate(),onState:s=>options.onCapture?.(s),
  eyeLevel:()=>rig.eyeLevel,
  beginOrbit:()=>{if(rig.eyeLevel)return false;film={position:camera.position.clone(),target:controls.target.clone()};controls.enabled=false;return true;},
  orbit:angle=>{if(!film)return;camera.position.copy(film.position).sub(film.target).applyAxisAngle(new T.Vector3(0,1,0),angle).add(film.target);camera.lookAt(film.target);changed();if(angle>=.9){film=undefined;controls.enabled=true;}},
 }):undefined;
 let film:{position:T.Vector3;target:T.Vector3}|undefined;

 // Frame scheduling: moving frames are fast; still frames refine, then rendering stops.
 let lastChange=performance.now(),needsFrame=true,visible=true,disposed=false,frame=0,ready=false,previous=performance.now(),heading=NaN;
 const changed=()=>{lastChange=performance.now();post?.reset();needsFrame=true;};
 invalidate=changed;
 const size=()=>{
  const {width,height}=host.getBoundingClientRect();if(!width||!height)return;
  // A running path trace keeps its own resolution; only the canvas's CSS size follows.
  if(captures?.tracing){canvas.style.width=width+'px';canvas.style.height=height+'px';return;}
  renderer.setSize(width,height);post?.setSize(width,height,renderer.getPixelRatio());rig.resize(width,height);changed();
 };
 const observer=new ResizeObserver(size);observer.observe(host);
 const visibility=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)changed();});visibility.observe(host);
 controls.addEventListener('start',()=>{captures?.stop();rig.cancel();changed();});
 controls.addEventListener('change',()=>{rig.project();changed();});

 const fitShadowToView=()=>{
  if(!lighting)return;
  if(rig.eyeLevel){const f=new T.Vector3();camera.getWorldDirection(f);f.y=0;f.normalize();lighting.fitShadow(camera.position.clone().addScaledVector(f,18).setY(0),34);}
  else lighting.fitShadow(SITE_CENTER,SITE_RADIUS);
 };
 const fadeIn=()=>{if(!reduced)canvas.animate([{opacity:0},{opacity:1}],{duration:420,easing:'ease-out'});};
 const framing=(key:Viewpoint):Framing=>{
  const v=viewpoints[key],narrow=host.getBoundingClientRect().width<768;
  const position=new T.Vector3(...(key==='courtyard'&&narrow&&!realistic?[9,43,61] as const:v.position)),target=new T.Vector3(...(key==='courtyard'&&narrow&&!realistic?[-10,1,8] as const:v.target));
  if(level==='basement')target.y=-2;
  return {target,direction:position.sub(target),span:v.span,exterior:level==='exterior'};
 };
 const leaveEyeLevel=()=>{if(!place)return;place=undefined;lighting?.setInterior(false);grass?.hide();fitShadowToView();};
 const view=(key:Viewpoint|Place,instant=false)=>{
  captures?.stop();
  if(key in places){
   const p=places[key as Place];place=key as Place;
   rig.enterEyeLevel(new T.Vector3(...p.position),new T.Vector3(...p.target));
   lighting?.setInterior(p.interior);fitShadowToView();grass?.showAround(camera.position);fadeIn();
   canvas.setAttribute('aria-label','Eye-level view. Drag or use arrow keys to look around. Pinch or scroll to zoom. Escape returns to the overview.');
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
  const k=.0042/camera.zoom;rig.lookBy((e.clientX-last[0])*k,(e.clientY-last[1])*k);changed();
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
 const lost=(e:Event)=>{e.preventDefault();options.onError();};
 canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);
 canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('keydown',key);

 const north=new T.Vector3(...sunDirection(0,0)).normalize(),a=new T.Vector3(),b=new T.Vector3(),buffer=new T.Vector2();
 const reportHeading=()=>{
  if(!options.onHeading)return;
  const origin=rig.eyeLevel?camera.position.clone().add(camera.getWorldDirection(a).multiplyScalar(5)):controls.target;
  a.copy(origin).project(camera);b.copy(origin).add(north).project(camera);
  const deg=Math.atan2(b.x-a.x,b.y-a.y)*180/Math.PI;
  if(!(Math.abs(deg-heading)<.5)){heading=deg;options.onHeading(deg);}
 };
 const render=(now:number)=>{
  if(disposed)return;frame=requestAnimationFrame(render);
  if(!visible||document.hidden){previous=now;return;}
  const delta=Math.min((now-previous)/1000,.05);previous=now;
  if(captures?.tick(now))return;
  if(captures?.breezing)waterTime.value=captures.waterSeconds;
  // A finished or cancelled film hands the camera back.
  if(film&&!captures?.recording){film=undefined;controls.enabled=!rig.eyeLevel;}
  let moving=rig.update(now);
  if(controls.enabled&&controls.update(delta))moving=true;
  if(moving)changed();
  if(lighting?.update(camera,now)){post?.reset();needsFrame=true;}
  if(bake?.update())changed();
  const motion=!!(captures?.breezing||captures?.recording||film);
  const still=!motion&&!moving&&now-lastChange>110,refine=!!post&&still&&post.accumulated<tier.refineFrames;
  if(!needsFrame&&!refine&&!motion)return;
  renderer.toneMappingExposure=lighting?lighting.exposure:.9;
  if(post){
   const jitter=still&&post.accumulated>0;
   if(jitter){const i=post.accumulated,size=renderer.getDrawingBufferSize(buffer);camera.setViewOffset(size.x,size.y,halton(i,2)-.5,halton(i,3)-.5,size.x,size.y);}
   if(motion&&captures?.breezing&&tier.quality==='detailed')renderer.shadowMap.needsUpdate=true;
   post.render(still,renderer.toneMappingExposure);
   if(jitter)camera.clearViewOffset();
  }else renderer.render(scene,camera);
  needsFrame=false;
  reportHeading();
  if(!ready){
   ready=true;canvas.dataset.modelReady='true';options.onReady();
   // Compile the dusk variant (lamps on) in the background so the first sunset has no stall.
   if(lighting){lighting.lamps.visible=true;void renderer.compileAsync(scene,camera).finally(()=>{if(lighting.reading)lighting.lamps.visible=lighting.reading.dusk>.02;});}
  }
 };
 size();view('courtyard',true);frame=requestAnimationFrame(render);

 const saveImage=async()=>{
  captures?.stop();
  const cssSize=renderer.getSize(new T.Vector2()),ratio=renderer.getPixelRatio();
  // Four thousand pixels on computers; about twice the screen on phones, within their memory.
  const longest=Math.max(cssSize.x,cssSize.y),scale=Math.min(3840,tier.quality==='detailed'?3840:2560)/longest;
  const w=Math.round(cssSize.x*scale),h=Math.round(cssSize.y*scale);
  try{
   renderer.setPixelRatio(1);renderer.setSize(w,h,false);post?.setSize(w,h,1);
   if(post){for(let i=0;i<Math.max(8,tier.refineFrames);i++){if(i)camera.setViewOffset(w,h,halton(i,2)-.5,halton(i,3)-.5,w,h);post.render(true,renderer.toneMappingExposure);camera.clearViewOffset();}}
   else renderer.render(scene,camera);
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));
   if(blob){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='reitweg-25-'+(realistic?'detailed':'model')+'.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
  }finally{renderer.setPixelRatio(ratio);renderer.setSize(cssSize.x,cssSize.y,false);post?.setSize(cssSize.x,cssSize.y,ratio);changed();}
 };

 return {
  view,focus,saveImage,
  zoom:(factor:number)=>{captures?.stop();rig.zoomBy(factor);changed();},
  setLevel:(l:Level)=>{captures?.stop();leaveEyeLevel();const floorChanged=l!==level;level=l;applyState();if(floorChanged)controls.target.y=l==='basement'?-2:l==='upper'?3.1:1;rig.project();changed();},
  setRenovations:(state:RenovationState)=>{captures?.stop();renovations={...state};applyState();},
  setSun:(study:SunStudy):LightReading|undefined=>{if(!lighting)return;const r=lighting.apply(study);fitShadowToView();changed();return r;},
  get lightReading(){return lighting?.reading;},
  captures,
  get eyeLevel(){return rig.eyeLevel;},
  snapshot:rig.snapshot,
  restore:(s:Parameters<typeof rig.restore>[0])=>{rig.restore(s);changed();},
  dispose:()=>{
   disposed=true;cancelAnimationFrame(frame);captures?.dispose();observer.disconnect();visibility.disconnect();controls.dispose();
   canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('keydown',key);
   bake?.dispose();grass?.dispose();post?.dispose();lighting?.dispose();textures?.dispose();environment?.dispose();
   const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>();
   scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}if(o instanceof T.Mesh&&o.customDepthMaterial)materials.add(o.customDepthMaterial);});
   geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
   renderer.dispose();renderer.forceContextLoss();canvas.remove();
  },
 };
}
export type HouseViewer=ReturnType<typeof createHouseViewer>;
