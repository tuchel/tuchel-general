import * as T from 'three';
import {COVER} from './sky-links';
import {SNOW,SNOW_GLSL,snowUniforms,snowFeature} from './snow';
import {addShaderFeature,after} from './shader-features';

/** The packed layer on the roofs: `depth` metres at full snow on a roof up to `full` degrees steep, thinning in a line
 * to nothing at `none` (the roof shape coefficient of the snow load code, EN 1991-1-3: 0.8 to 30°, 0 at 60°), so about
 * 15 cm on the main roof's 38° and 17 cm on the link's 34°. Its edges round off over `round` metres; at eaves and verges
 * a lip hangs `lip` metres out and sags by `sag`, its face `face` of the layer high, clear of the fascia under it; around
 * roof windows, the chimney and the flue it is melted back by `margin` and slopes down into the hollow over `hollow`. `fine` and `coarse`: the size of its triangles at an edge and in the open. `roofs`: the meshes that carry it; those `panelled` go without
 * while the solar `panels` stand on them, which keep the snow's shading alone. */
export const SLAB={depth:.2,full:30,none:60,round:.1,hollow:.24,lip:.12,sag:.01,face:.7,margin:.08,fine:.085,coarse:1.2,roofs:/-roof-slope|^catslide-zinc$|^bin-room-roof$/,warm:/^chimney$|^north-gable-flue$/,panels:'renovation-solar-roofs',panelled:/^(main|guest)-roof/};

type Edge={a:number[];b:number[];out:number[];kind:'edge'|'hole'|'ridge'};
const segment=(p:number[],e:Edge)=>{const dx=e.b[0]-e.a[0],dy=e.b[1]-e.a[1],t=Math.min(1,Math.max(0,((p[0]-e.a[0])*dx+(p[1]-e.a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-e.a[0]-dx*t,p[1]-e.a[1]-dy*t);};

/** The layer for one roof mesh, in that mesh's own space: its upward face, cut finer toward its edges, each corner
 * carrying what the shader shapes the snow from. `slab`: x metres in from the nearest edge where the snow ends (less
 * than 0 inside a melted margin), y 1 where that edge is an eave or a verge, which takes the lip, z metres from the
 * ridge. `slabOut`: the way out across that edge. `warm`: boxes in the world that melt it back. Undefined for a mesh
 * without such a face. */
export function slabGeometry(mesh:T.Mesh,warm:T.Box3[]){
 mesh.updateWorldMatrix(true,false);
 const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,at=source.attributes.position,world=mesh.matrixWorld;
 // The triangles of its largest upward plane.
 const corners:T.Vector3[]=[],normals:T.Vector3[]=[],areas=new Map<string,{area:number;n:T.Vector3}>();
 for(let i=0;i<at.count;i+=3){
  const [a,b,c]=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(at,i+k).applyMatrix4(world)),n=b.clone().sub(a).cross(c.clone().sub(a)),area=n.length()/2;
  if(area<1e-7||n.normalize().y<.45)continue;
  corners.push(a,b,c);normals.push(n);const key=n.toArray().map(v=>v.toFixed(2)).join(),sum=areas.get(key)??{area:0,n};sum.area+=area;areas.set(key,sum);
 }
 if(source!==mesh.geometry)source.dispose();
 const plane=[...areas.values()].sort((x,y)=>y.area-x.area)[0];if(!plane||plane.area<.5)return;
 const n=plane.n,u=new T.Vector3(0,1,0).cross(n).normalize(),v=n.clone().cross(u),origin=new T.Vector3();
 // Its corners in the plane (u along the eave, v up the slope), welded to the millimetre.
 const points:number[][]=[],ids=new Map<string,number>(),tris:number[][]=[];
 const id=(p:T.Vector3)=>{const q=[p.dot(u),p.dot(v)],key=Math.round(q[0]*1000)+','+Math.round(q[1]*1000);let i=ids.get(key);if(i===undefined){i=points.length;points.push(q);ids.set(key,i);}return i;};
 let level=0,count=0;
 for(let i=0;i<normals.length;i++)if(normals[i].dot(n)>.999){const t=[0,1,2].map(k=>id(corners[i*3+k]));if(t[0]!==t[1]&&t[1]!==t[2]&&t[0]!==t[2]){tris.push(t);level+=corners[i*3].dot(n);count++;}}
 origin.copy(n).multiplyScalar(level/count);
 // Its edges: the sides only one triangle has. Loops that run against the face's turn are openings; the level edge at
 // the top is the ridge, where the layer does not end but meets the other slope's.
 const N=1<<21,key=(a:number,b:number)=>a<b?a*N+b:b*N+a,sides=new Map<number,number[]>();
 const join=(t:number)=>{const [a,b,c]=tris[t];for(const k of [key(a,b),key(b,c),key(c,a)]){const list=sides.get(k);if(list)list.push(t);else sides.set(k,[t]);}};
 const part=(t:number)=>{const [a,b,c]=tris[t];for(const k of [key(a,b),key(b,c),key(c,a)]){const list=sides.get(k)!;list.splice(list.indexOf(t),1);}};
 tris.forEach((_,t)=>join(t));
 const next=new Map<number,number>();for(const [a,b,c] of tris)for(const [i,j] of [[a,b],[b,c],[c,a]])if(sides.get(key(i,j))!.length===1)next.set(i,j);
 const top=Math.max(...points.map(p=>p[1])),edges:Edge[]=[],seen=new Set<number>();
 for(const start of next.keys()){
  if(seen.has(start))continue;const loop=[start];seen.add(start);
  for(let i=next.get(start);i!==undefined&&i!==start&&!seen.has(i);i=next.get(i)){loop.push(i);seen.add(i);}
  let area=0;loop.forEach((i,k)=>{const a=points[i],b=points[loop[(k+1)%loop.length]];area+=a[0]*b[1]-b[0]*a[1];});
  loop.forEach((i,k)=>{const a=points[i],b=points[loop[(k+1)%loop.length]],length=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
   edges.push({a,b,out:[(b[1]-a[1])/length,-(b[0]-a[0])/length],kind:area<0?'hole':a[1]>top-.02&&b[1]>top-.02?'ridge':'edge'});});
 }
 // What the shader needs at a point, and how fine the triangles are there.
 const flat=(p:number[])=>origin.clone().addScaledVector(u,p[0]).addScaledVector(v,p[1]),reach=new T.Vector3();
 const measure=(p:number[])=>{
  let inward=Infinity,lip=1,ridge=Infinity,out=[0,0];
  for(const e of edges){const d=segment(p,e);if(e.kind==='ridge'){ridge=Math.min(ridge,d);continue;}const m=e.kind==='hole'?d-SLAB.margin:d;if(m<inward){inward=m;lip=e.kind==='hole'?0:1;out=e.out;}}
  if(warm.length){const w=flat(p);for(const box of warm){
   const d=Math.hypot(Math.max(box.min.x-w.x,0,w.x-box.max.x),Math.max(box.min.z-w.z,0,w.z-box.max.z)),inside=w.x>box.min.x&&w.x<box.max.x&&w.z>box.min.z&&w.z<box.max.z;
   if(w.y<box.max.y+.5&&(inside?-1:d)-SLAB.margin<inward){inward=(inside?-1:d)-SLAB.margin;lip=0;box.getCenter(reach).sub(w).setY(0).normalize();out=[reach.dot(u),reach.dot(v)];}}}
  return {inward,lip,ridge,out};
 };
 const size=(p:number[])=>{const m=measure(p),d=Math.min(Math.abs(m.inward),m.ridge*.6);return d<.12?SLAB.fine:d<.35?SLAB.fine*2:d<.9?SLAB.fine*5:SLAB.coarse;};
 // Cut every side longer than the size asked for where it lies, in both triangles that share it. A triangle is cut
 // across its longest side only, and its neighbor there first if that side is not the neighbor's longest, so that none
 // grows thin (longest-edge bisection).
 const longest=(t:number)=>{const tri=tris[t];let side=0,far=0;for(let k=0;k<3;k++){const a=points[tri[k]],b=points[tri[(k+1)%3]],d=Math.hypot(b[0]-a[0],b[1]-a[1]);if(d>far){far=d;side=k;}}return {i:tri[side],j:tri[(side+1)%3],far};};
 const queue=tris.map((_,t)=>t);
 const cut=(t:number)=>{
  while(tris[t].length){
   const {i,j,far}=longest(t),across=sides.get(key(i,j))!.find(s=>s!==t);
   if(across!==undefined&&longest(across).far>far*(1+1e-9)){cut(across);continue;}
   const m=points.length;points.push([(points[i][0]+points[j][0])/2,(points[i][1]+points[j][1])/2]);
   for(const s of [...sides.get(key(i,j))!]){
    const [a,b,c]=tris[s],k=a!==i&&a!==j?0:b!==i&&b!==j?1:2,[p,q,r]=[[a,b,c],[b,c,a],[c,a,b]][k];
    part(s);tris[s]=[];for(const made of [[p,q,m],[p,m,r]]){tris.push(made);join(tris.length-1);queue.push(tris.length-1);}
   }
  }
 };
 while(queue.length){
  const t=queue.pop()!;if(!tris[t].length)continue;
  const {i,j,far}=longest(t);if(far>size([(points[i][0]+points[j][0])/2,(points[i][1]+points[j][1])/2]))cut(t);
 }
 const live=tris.filter(t=>t.length),back=world.clone().invert(),turn=new T.Matrix3().setFromMatrix4(back);
 const position=new Float32Array(points.length*3),normal=new Float32Array(points.length*3),slab=new Float32Array(points.length*4),slabOut=new Float32Array(points.length*3),local=n.clone().applyMatrix3(turn).normalize();
 points.forEach((p,i)=>{
  const m=measure(p);flat(p).applyMatrix4(back).toArray(position,i*3);local.toArray(normal,i*3);
  slab.set([m.inward,m.lip,Math.min(m.ridge,100),0],i*4);reach.copy(u).multiplyScalar(m.out[0]).addScaledVector(v,m.out[1]).applyMatrix3(turn).toArray(slabOut,i*3);
 });
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(position,3));geometry.setAttribute('normal',new T.BufferAttribute(normal,3));
 geometry.setAttribute('slab',new T.BufferAttribute(slab,4));geometry.setAttribute('slabOut',new T.BufferAttribute(slabOut,3));geometry.setIndex(live.flat());
 geometry.computeBoundingSphere();geometry.boundingSphere!.radius+=.5;geometry.computeBoundingBox();geometry.boundingBox!.expandByScalar(.5);
 return geometry;
}

// The layer's shape at a corner, in the world: how far it is moved, its normal there, and its height over the roof with how
// far in from its edge it is.
// It lies where the shading below it does (snow.ts, snowOn: the same patches, slope and roofs overhead), so it grows as
// the snow settles and sinks and breaks up as it melts.
const SHAPE=(sky:boolean)=>`
attribute vec4 slab;attribute vec3 slabOut;
${sky?'uniform highp sampler3D uSkyReach;uniform vec3 uSkyMin;uniform vec3 uSkyGrid;uniform float uSkyCell;uniform float uSkyLinked;':''}
float slabLumps(vec2 p){return snowNoise(p*0.45+3.0)*0.65+snowNoise(p*1.3+11.0)*0.35;}
vec3 slabShape(out vec3 n,out vec2 seen){float tall;
 vec3 p=(modelMatrix*vec4(position,1.0)).xyz;mat3 turn=mat3(modelMatrix);
 vec3 lay=normalize(turn*normal),out2=turn*slabOut;
 float open=1.0-snowCover(p).y;
 ${sky?`{vec2 g=(p.xz-uSkyMin.xz)/${COVER.cell.toFixed(2)};
  if(p.y<uSkyMin.y+uSkyGrid.y*uSkyCell&&all(greaterThan(g,vec2(0.0)))&&all(lessThan(g,uSkyGrid.xz*uSkyCell/${COVER.cell.toFixed(2)}))){
   g-=0.5;vec2 g0=floor(g),f=g-g0;float h[4];
   for(int k=0;k<4;k++){ivec2 c=ivec2(max(g0+vec2(float(k&1),float(k>>1)),0.0));vec4 t=texelFetch(uSkyReach,ivec3(c.x,c.y>>1,int(uSkyGrid.y)+1),0);h[k]=(c.y&1)==0?t.r:t.g;}
   open*=uSkyLinked*smoothstep(-0.7,-0.4,p.y-uSkyMin.y-mix(mix(h[0],h[1],f.x),mix(h[2],h[3],f.x),f.y)*uSkyGrid.y*uSkyCell);}}`:''}
 float broad=snowNoise(p.xz*0.31+p.y*0.17),mid=snowNoise(p.zx*0.83+p.y*0.4+41.0);
 float lies=smoothstep(0.02,0.4,uSnow*1.25-0.25+(broad*0.45+mid*0.33-0.39)*mix(1.1,0.3,uSnow)-(1.0-lay.y)*${SNOW.slope.toFixed(1)}-(1.0-open)*1.3)*smoothstep(0.0,0.12,uSnow);
 float most=${SLAB.depth.toFixed(3)}*clamp((${SLAB.none.toFixed(1)}-degrees(acos(clamp(lay.y,0.0,1.0))))/${(SLAB.none-SLAB.full).toFixed(1)},0.0,1.0)*mix(0.45,1.0,uSnow);
 float lumps=slabLumps(p.xz),deep=most*lies*(0.78+0.44*lumps);
 // Rounded off toward its edge, with a lip out over an eave or a verge; at the ridge it rises straight up, to meet the
 // other slope's in a soft cap.
 float round2=mix(${SLAB.hollow.toFixed(3)},${SLAB.round.toFixed(3)},slab.y),w=clamp(slab.x/round2,0.0,1.0),rim=mix(slab.y*${SLAB.face.toFixed(2)},1.0,sqrt(max(0.0,1.0-(1.0-w)*(1.0-w)))),cap=1.0-smoothstep(0.0,0.32,slab.z),hang=slab.y*(1.0-w)*(1.0-w)*lies;
 tall=deep*rim;seen=vec2(tall,slab.x+slab.y);
 vec3 move=mix(lay,vec3(0.0,1.08,0.0),cap)*tall+out2*hang*${SLAB.lip.toFixed(3)};move.y-=hang*${SLAB.sag.toFixed(3)};
 vec2 lean=vec2(slabLumps(p.xz+vec2(0.25,0.0)),slabLumps(p.xz+vec2(0.0,0.25)))-lumps;
 n=normalize(mix(lay+out2*min(deep*(1.0-w)/(round2*max(rim,0.12)),3.0)-vec3(lean.x,0.0,lean.y)*most*1.76,vec3(0.0,1.0,0.0),cap*0.55));
 // Back into the mesh's own space, which may be stretched (the garage's roofs are boxes drawn out).
 n=n*turn;return inverse(turn)*move;}
`;
// Gone where it is thinner than 4 mm, and inside a melted margin, whose line the triangles do not follow.
const VANISH='if(vSlab.x<0.004||vSlab.y<0.0)discard;';

/** The roofs' packed snow: a mesh under each roof mesh that carries it, shown and hidden with that roof, with one
 * material between them all, the snow's own (snow.ts) shaped by SHAPE. The meshes are made empty, so that the sky light
 * and whatever else reads the scene's materials find this one; their geometry is cut the first time snow lies (`build`).
 * They cast and take shadows, and stay out of the static batches, the walker's obstacles and the photographs' scene.
 * `sky`: the sky light's uniforms for the height standing over a point, where there is one, asked for when the shaders
 * are compiled. */
export function snowSlabs(root:T.Object3D,sky:()=>Record<string,T.IUniform>|undefined){
 const material=new T.MeshStandardMaterial({color:new T.Color(...SNOW.albedo).multiplyScalar(.94),roughness:.9});material.name='snow-slab';
 const compile=(shader:T.WebGLProgramParametersWithUniforms,lit:boolean)=>{
  const reach=sky();Object.assign(shader.uniforms,snowUniforms,reach);
  shader.vertexShader='uniform float uSnow;'+SNOW_GLSL+SHAPE(!!reach)+'varying vec2 vSlab;vec3 slabMove;\n'+after(lit?after(shader.vertexShader.replace('uniform float uSnow;',''),'beginnormal_vertex','{vec3 slabN;slabMove=slabShape(slabN,vSlab);objectNormal=slabN;}'):shader.vertexShader,'begin_vertex',lit?'transformed+=slabMove;':'{vec3 slabN;transformed+=slabShape(slabN,vSlab);}');
  shader.fragmentShader='varying vec2 vSlab;\n'+after(shader.fragmentShader,'clipping_planes_fragment',VANISH);
 };
 const base=snowFeature('surface');
 addShaderFeature(material,{key:'snow-slab',last:true,compile:shader=>{base.compile(shader);compile(shader,true);}});
 // The sun's shadow of it is drawn with the same shape.
 const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});depth.onBeforeCompile=shader=>compile(shader,false);depth.customProgramCacheKey=()=>'snow-slab-depth';
 const meshes:{mesh:T.Mesh;roof:T.Mesh}[]=[],warm:T.Object3D[]=[],empty=new T.BufferGeometry(),panels=root.getObjectByName(SLAB.panels);
 root.traverse(o=>{
  if(SLAB.warm.test(o.name))warm.push(o);
  if(!(o instanceof T.Mesh)||!SLAB.roofs.test(o.name))return;
  const mesh=new T.Mesh(empty,material);mesh.name='snow-slab';mesh.customDepthMaterial=depth;mesh.castShadow=mesh.receiveShadow=true;mesh.visible=false;
  Object.assign(mesh.userData,{dynamic:true,skipPhotographic:true,passable:true,skipSnow:true});meshes.push({mesh,roof:o});
 });
 for(const {mesh,roof} of meshes)roof.add(mesh);
 let built=false;
 return {
  material,meshes:meshes.map(m=>m.mesh),
  /** Shown while any snow lies; the first time, the layers are cut. Call it again when the renovations change. */
  show:(on:boolean)=>{
   if(on&&!built){built=true;root.updateMatrixWorld(true);const boxes=warm.map(o=>new T.Box3().setFromObject(o));
    for(const {mesh,roof} of meshes){const geometry=slabGeometry(roof,boxes);if(geometry)mesh.geometry=geometry;}}
   for(const {mesh,roof} of meshes)mesh.visible=on&&mesh.geometry!==empty&&!(panels?.visible&&SLAB.panelled.test(roof.name));
  },
  dispose:()=>{for(const {mesh} of meshes){if(mesh.geometry!==empty)mesh.geometry.dispose();mesh.removeFromParent();}material.dispose();depth.dispose();},
 };
}
