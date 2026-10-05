import * as T from 'three';
import {MeshBVH} from 'three-mesh-bvh';
import {planPoint} from './site-data';
import type {CarModels} from './car-models';

/** The two cars in the garage, a Porsche 911 Carrera GTS (992.2) and a Tesla Model Y Performance (2025), built to
 * published length, width, height, wheelbase and tyre sizes. Bodies are lofts through side and plan profiles traced
 * from manufacturer photographs, not manufacturer surfaces. Local axes: x forward, y up, z to the car's left. */
type Axle={x:number;track:number;radius:number;tyre:number;rim:number};
type Curve=[number,number][];
type WheelStyle={pairs:number;spread:(t:number)=>number;sweep:number;spoke:number;color:string;metalness:number;roughness:number;hub:'nut'|'cap'};
export type CarSpec={
 name:string;length:number;width:number;height:number;wheelbase:number;axles:[Axle,Axle];archGap:number;
 // Side profiles give heights and plan profiles give half-widths, both as functions of x from nose to tail.
 // top: centreline; bottom: underside; half: widest body side; shoulder: where the body side turns into the
 // glasshouse or bonnet; rail: the roof edge, A-pillar or wing crest above it.
 top:Curve;bottom:Curve;half:Curve;shoulder:Curve;shoulderHalf:Curve;rail:Curve;railHalf:Curve;railBand:number;
 windscreen:[number,number];backlight:[number,number];glassRoof:boolean;
 // Side windows: bottom and top edges as fractions of the way from shoulder to rail; pillars as [x, width].
 dlo:{front:number;rear:number;bottom:Curve;top:Curve;pillars:[number,number][]};
 paint:{color:string;metalness:number;roughness:number};wheel:WheelStyle;caliper:string;
 details:(d:Detailer)=>void;
};
type Materials={paint:T.Material;glass:T.Material;under:T.Material;trim:T.Material;tyre:T.Material;rim:T.Material;disc:T.Material;caliper:T.Material;lamp:T.Material;tail:T.Material;dark:T.Material;metal:T.Material};
type Probe=(u:number,v:number)=>[T.Vector3,T.Vector3];
type Hit={point:T.Vector3;normal:T.Vector3};
type Detailer=ReturnType<typeof detailer>;
const v3=(x:number,y:number,z:number)=>new T.Vector3(x,y,z);

export const porsche911:CarSpec={
 name:'Porsche 911 Carrera GTS',length:4.553,width:1.852,height:1.298,wheelbase:2.45,archGap:.045,
 // 245/35 ZR20 front and 315/30 ZR21 rear.
 axles:[{x:1.2755,track:1.589,radius:.3398,tyre:.245,rim:.254},{x:-1.1745,track:1.527,radius:.3612,tyre:.315,rim:.2667}],
 top:[[2.2765,.42],[2.265,.5],[2.235,.56],[2.19,.6],[2.05,.628],[1.85,.665],[1.6,.71],[1.3,.765],[1,.825],[.74,.878],[.6,.96],[.4,1.1],[.193,1.256],[0,1.29],[-.14,1.298],[-.37,1.292],[-.6,1.268],[-.83,1.22],[-1.06,1.148],[-1.305,1.065],[-1.564,.981],[-1.823,.897],[-2.03,.849],[-2.186,.801],[-2.24,.78],[-2.265,.742],[-2.2765,.68]],
 bottom:[[2.2765,.3],[2.26,.22],[2.22,.16],[2.1,.13],[1.8,.12],[-1.6,.12],[-1.9,.14],[-2.1,.18],[-2.22,.22],[-2.265,.28],[-2.2765,.36]],
 half:[[2.2765,.34],[2.265,.5],[2.24,.62],[2.2,.72],[2.13,.8],[2.02,.86],[1.8,.9],[1.5,.917],[1.28,.92],[1,.912],[.6,.895],[.1,.89],[-.35,.896],[-.7,.915],[-1,.926],[-1.3,.926],[-1.6,.914],[-1.85,.89],[-2.02,.85],[-2.14,.79],[-2.22,.7],[-2.26,.58],[-2.2765,.42]],
 shoulder:[[2.2765,.38],[2.24,.44],[2.18,.48],[2.113,.52],[2.05,.56],[1.988,.6],[1.9,.645],[1.8,.68],[1.6,.72],[1.4,.745],[1.1,.78],[.8,.84],[.64,.89],[.3,.905],[0,.915],[-.4,.93],[-.7,.945],[-1,.95],[-1.3,.94],[-1.6,.905],[-1.85,.855],[-2.05,.815],[-2.186,.77],[-2.24,.72],[-2.265,.66],[-2.2765,.56]],
 shoulderHalf:[[2.2765,.3],[2.265,.45],[2.24,.55],[2.18,.66],[2.113,.73],[2,.79],[1.8,.83],[1.5,.845],[1.2,.845],[.9,.835],[.64,.8],[.3,.79],[0,.79],[-.4,.79],[-.7,.79],[-1,.78],[-1.3,.765],[-1.6,.735],[-1.85,.7],[-2.05,.65],[-2.186,.6],[-2.24,.54],[-2.2765,.38]],
 rail:[[2.2765,.4],[2.24,.466],[2.18,.51],[2.113,.562],[2.05,.61],[1.988,.658],[1.94,.7],[1.888,.742],[1.82,.78],[1.738,.806],[1.6,.83],[1.488,.837],[1.24,.856],[1,.866],[.78,.88],[.64,.9],[.5,.99],[.35,1.09],[.193,1.2],[0,1.24],[-.14,1.25],[-.37,1.245],[-.6,1.222],[-.83,1.175],[-1.06,1.105],[-1.305,1.025],[-1.564,.945],[-1.823,.868],[-2.03,.825],[-2.186,.78],[-2.24,.73],[-2.265,.7],[-2.2765,.6]],
 railHalf:[[2.2765,.28],[2.265,.42],[2.24,.5],[2.18,.6],[2.113,.66],[1.988,.7],[1.8,.71],[1.5,.71],[1.2,.7],[.9,.67],[.64,.63],[.4,.55],[.193,.46],[0,.5],[-.37,.51],[-.6,.5],[-.83,.48],[-1.06,.47],[-1.305,.48],[-1.564,.5],[-1.823,.53],[-2.03,.55],[-2.186,.54],[-2.24,.49],[-2.2765,.36]],
 railBand:.035,windscreen:[.2,.74],backlight:[-1.47,-.62],glassRoof:false,
 dlo:{front:.62,rear:-1.105,bottom:[[.62,.05],[-.8,.05],[-.95,.12],[-1.05,.28],[-1.105,.49]],top:[[.62,.93],[-.3,.93],[-.6,.87],[-.83,.82],[-1,.68],[-1.105,.49]],pillars:[[-.48,.06]]},
 // Racing green metallic; satin black ten-spoke wheels and yellow ceramic-brake calipers, as photographed.
 paint:{color:'#1d3a2a',metalness:.55,roughness:.3},caliper:'#e2bf1e',
 wheel:{pairs:5,spread:()=>.24,sweep:0,spoke:.021,color:'#161718',metalness:.25,roughness:.5,hub:'nut'},
 details:d=>{
  const {m}=d;
  // Round headlamps on the front wings, each with four light modules.
  for(const k of [-1,1]){const h=d.cast(v3(3,.73,k*.71),v3(-1,-.1,0));if(h)d.headlamp(h,.118);}
  // Front apron: side intakes with vertical fins, indicator strips above them, a central intake and the lip.
  for(const k of [-1,1]){
   d.skin(m.dark,d.face(1,k*.37,k*.76,.24,.46),12,4);
   for(let i=0;i<6;i++){const z=k*(.41+i*.062);d.skin(m.trim,d.face(1,z,z+k*.014,.25,.45),2,4,.008);}
   d.skin(m.dark,d.path([[.78,k*.6],[1.6,k*.52],[2.12,k*.42],[2.19,k*.36]],.006),24,2,.003);
  }
  d.skin(m.dark,d.path([[2.19,-.36],[2.21,0],[2.19,.36]],.006),16,2,.003);
  d.skin(m.dark,d.face(1,-.3,.3,.25,.37),12,3);
  d.skin(m.dark,d.around(1,.13,.2,-1.15,1.15,.9),40);
  // Tail: black band under a slim full-width light strip, engine-lid louvres, diffuser, twin tailpipes, reflectors.
  d.skin(m.dark,d.around(-1,.74,.79,-1.25,1.25,.9),56);
  d.skin(m.tail,d.around(-1,.79,.81,-1.25,1.25,.9),56);
  d.skin(m.dark,d.top(-1.53,-1.84,-.45,.45),8,12);
  for(let i=0;i<14;i++){const z=-.4+i*.8/13;d.skin(m.trim,d.top(-1.54,-1.83,z,z+.012),6,2,.008);}
  d.skin(m.tail,d.top(-1.52,-1.535,-.12,.12),2,4,.008);
  d.skin(m.dark,d.around(-1,.15,.38,-.95,.95,.9),30,4);
  for(const k of [-1,1]){d.tailpipe(-2.23,.3,k*.13,.045);d.skin(m.tail,d.around(-1,.43,.455,k*.66,k*.92,.9),8);}
  // Mirrors on the doors, flush door handles.
  d.mirror(.47,.92,.08,.11,.22);
  for(const k of [-1,1])d.skin(m.dark,d.side(-.24,-.42,.72,.735,k),6,2);
 },
};

export const teslaModelY:CarSpec={
 name:'Tesla Model Y Performance',length:4.796,width:1.921,height:1.611,wheelbase:2.89,archGap:.045,
 // 255/35 R21 front and 275/35 R21 rear.
 axles:[{x:1.515,track:1.636,radius:.356,tyre:.255,rim:.2667},{x:-1.375,track:1.622,radius:.363,tyre:.275,rim:.2667}],
 top:[[2.398,.6],[2.39,.66],[2.375,.7],[2.35,.725],[2.28,.784],[2.2,.806],[2.13,.834],[2.055,.888],[1.98,.912],[1.9,.936],[1.76,.976],[1.6,1.006],[1.47,1.03],[1.3,1.061],[1.15,1.095],[1.05,1.11],[.95,1.185],[.78,1.289],[.6,1.383],[.43,1.462],[.25,1.529],[.08,1.574],[-.1,1.599],[-.35,1.611],[-.6,1.6],[-.85,1.571],[-1.08,1.529],[-1.31,1.474],[-1.585,1.404],[-1.87,1.325],[-2.02,1.28],[-2.16,1.228],[-2.24,1.222],[-2.3,1.24],[-2.325,1.2],[-2.345,1.1],[-2.365,.95],[-2.385,.8],[-2.398,.66]],
 bottom:[[2.398,.44],[2.39,.36],[2.37,.29],[2.34,.24],[2.25,.2],[2.1,.18],[1.9,.155],[-1.9,.155],[-2.15,.24],[-2.3,.29],[-2.37,.38],[-2.398,.5]],
 half:[[2.398,.3],[2.395,.42],[2.385,.53],[2.36,.63],[2.3,.73],[2.2,.83],[2.1,.89],[2,.925],[1.85,.945],[1.6,.955],[1.5,.958],[.6,.9605],[-.6,.9605],[-1.4,.9605],[-1.6,.958],[-1.85,.95],[-2,.93],[-2.1,.9],[-2.2,.85],[-2.3,.77],[-2.36,.68],[-2.385,.6],[-2.395,.5],[-2.398,.38]],
 shoulder:[[2.398,.56],[2.37,.64],[2.33,.68],[2.28,.72],[2.13,.77],[1.98,.835],[1.76,.895],[1.47,.955],[1.2,1.01],[1.05,1.04],[.8,1.07],[.4,1.085],[0,1.1],[-.6,1.12],[-1.1,1.15],[-1.5,1.17],[-1.9,1.165],[-2.15,1.15],[-2.28,1.12],[-2.33,1.06],[-2.355,.97],[-2.38,.8],[-2.398,.6]],
 shoulderHalf:[[2.398,.26],[2.395,.38],[2.385,.48],[2.36,.57],[2.3,.66],[2.2,.74],[2.1,.79],[1.9,.84],[1.4,.865],[.9,.875],[0,.875],[-.9,.87],[-1.4,.85],[-1.8,.81],[-2,.78],[-2.1,.75],[-2.2,.71],[-2.3,.65],[-2.36,.58],[-2.385,.5],[-2.398,.32]],
 rail:[[2.398,.57],[2.37,.65],[2.33,.69],[2.28,.73],[2.13,.78],[1.98,.845],[1.76,.905],[1.47,.965],[1.2,1.02],[1.05,1.05],[.8,1.19],[.5,1.345],[.22,1.49],[0,1.535],[-.35,1.565],[-.6,1.555],[-.85,1.527],[-1.08,1.487],[-1.31,1.435],[-1.585,1.37],[-1.87,1.295],[-2.02,1.252],[-2.16,1.2],[-2.24,1.19],[-2.28,1.17],[-2.33,1.1],[-2.355,1],[-2.38,.82],[-2.398,.62]],
 railHalf:[[2.398,.24],[2.395,.36],[2.385,.46],[2.36,.55],[2.3,.64],[2.2,.72],[2.1,.77],[1.8,.82],[1.4,.855],[1.1,.862],[1.05,.86],[.8,.8],[.5,.74],[.22,.69],[0,.68],[-.6,.675],[-1.2,.66],[-1.6,.64],[-1.95,.62],[-2.1,.6],[-2.2,.58],[-2.3,.54],[-2.36,.48],[-2.385,.4],[-2.398,.3]],
 railBand:.04,windscreen:[.22,1.05],backlight:[-2.28,-1.3],glassRoof:true,
 dlo:{front:.98,rear:-1.98,bottom:[[.98,.04],[-1.2,.04],[-1.6,.28],[-1.8,.65],[-1.98,.9]],top:[[.98,.93],[-1.5,.93],[-1.8,.93],[-1.98,.9]],pillars:[[-.26,.13],[-1.08,.05]]},
 // Solid black; dark grey 21-inch wheels and red calipers, as photographed.
 paint:{color:'#0b0c0d',metalness:.1,roughness:.22},caliper:'#b3191b',
 wheel:{pairs:5,spread:t=>.02+.21*t*t,sweep:.42,spoke:.042,color:'#4a4e53',metalness:.6,roughness:.35,hub:'cap'},
 details:d=>{
  const {m}=d;
  // Light bar across the nose under the bonnet edge; slim headlamps low in the bumper corners; lower intake.
  d.skin(m.lamp,d.around(1,.762,.776,-1.02,1.02),56);
  for(const k of [-1,1])d.skin(m.dark,d.around(1,.55,.6,k*.66,k*1.02),10);
  d.skin(m.dark,d.face(1,-.58,.58,.25,.37),16,3);
  d.skin(m.dark,d.around(1,.16,.24,-1.1,1.1),40);
  // Full-width tail light under the spoiler, wrapping onto the rear wings; diffuser; reflectors.
  d.skin(m.tail,d.around(-1,1.03,1.07,-1.3,1.3),60);
  d.skin(m.dark,d.around(-1,.2,.42,-.85,.85),30,4);
  for(const k of [-1,1])d.skin(m.tail,d.around(-1,.46,.48,k*.7,k*.95),8);
  // Mirrors at the front of the door glass, flush door handles.
  d.mirror(.86,1.1,.03,.13,.24);
  for(const k of [-1,1])for(const x of [.12,-.86])d.skin(m.dark,d.side(x,x-.2,1.005,1.02,k),6,2);
 },
};

function add(car:T.Group,geo:T.BufferGeometry,mat:T.Material){const o=new T.Mesh(geo,mat);o.castShadow=true;o.receiveShadow=true;car.add(o);return o;}
/** Smooth y(x) through control points (centripetal Catmull–Rom), sampled densely. */
function profile(points:Curve){
 const curve=new T.CatmullRomCurve3(points.map(([x,y])=>v3(x,y,0)),false,'centripetal'),samples=curve.getPoints(600).sort((a,b)=>a.x-b.x);
 return (x:number)=>{if(x<=samples[0].x)return samples[0].y;for(let i=1;i<samples.length;i++)if(samples[i].x>=x){const a=samples[i-1],b=samples[i],t=(x-a.x)/Math.max(1e-6,b.x-a.x);return a.y+(b.y-a.y)*t;}return samples[samples.length-1].y;};
}
const HALF=19,RING=HALF*2-2,CROWN=[.85,.7,.5,.3,.12];

/** Lofted body. Each station is a half-section of 19 points, mirrored: underside, wheel well, lower side, the
 * body side's bulge, shoulder, side glass, roof rail and a crowned roof or bonnet. Stations crowd the ends of the
 * car and fall exactly on the wheel openings, pillars and glass edges. */
export function carBody(s:CarSpec,m:Materials){
 const top=profile(s.top),floor=profile(s.bottom),half=profile(s.half),shoulder=profile(s.shoulder),shoulderHalf=profile(s.shoulderHalf),rail=profile(s.rail),railHalf=profile(s.railHalf);
 const dloBottom=profile(s.dlo.bottom),dloTop=profile(s.dlo.top),end=s.length/2;
 // Stations crowd the ends; the nearest station moves onto each glass edge and pillar (an extra station a few
 // millimetres away would show in reflections), and each wheel opening gets a pair for its sharp vertical edge.
 let xs=Array.from({length:170},(_,i)=>{const u=i/169;return end-s.length*(.7*u+.3*(1-Math.cos(Math.PI*u))/2);});
 for(const key of [s.dlo.front,s.dlo.rear,...s.dlo.pillars.flatMap(([x,w])=>[x-w/2,x+w/2]),...s.windscreen,...s.backlight]){let best=1;for(let i=1;i<xs.length-1;i++)if(Math.abs(xs[i]-key)<Math.abs(xs[best]-key))best=i;xs[best]=key;}
 const edges=s.axles.flatMap(a=>{const r=a.radius+s.archGap;return [a.x-r,a.x+r];});
 xs=xs.filter(x=>edges.every(e=>Math.abs(x-e)>.012));
 xs.push(...edges.flatMap(e=>[e-.002,e+.002]),...[.004,.009,.014].flatMap(k=>[end-k,-end+k]));
 xs.sort((a,b)=>b-a);
 const pos:number[]=[];
 for(const x of xs){
  const yt=top(x),yb=Math.min(floor(x),yt-.1),w=half(x);
  const ys=Math.min(shoulder(x),yt+.2),ws=Math.min(shoulderHalf(x),w-.012),yr=Math.max(rail(x),ys+.004),wr=Math.min(railHalf(x),ws-.004);
  // Wheel openings: the lower side rises in an arc over each tyre, over a well whose inner wall clears the tyre.
  let ya=yb,wIn=w*.75;
  for(const a of s.axles){const r=a.radius+s.archGap,d=x-a.x;wIn=Math.min(wIn,a.track/2-a.tyre/2-.035);if(Math.abs(d)<r)ya=Math.max(ya,a.radius+Math.sqrt(r*r-d*d));}
  ya=Math.min(ya,ys-.03);
  // The side rows keep their heights except where an arch pushes them up, so the arch edges stay crisp lines.
  const y4=Math.max(ya,yb+.06),lower=[[w*.965,y4]] as [number,number][];
  [.3,.62,.9].forEach((t,i)=>lower.push([w*(1-.035*((t-.6)/.6)**2),Math.min(ys-.004*(3-i),Math.max(yb+.06+(ys-yb-.06)*t,ya+.012*(i+1)))]));
  // Glasshouse side from shoulder to rail, bowed outward (tumblehome).
  const cx=wr-ws,cy=yr-ys,cl=Math.hypot(cx,cy)||1e-6,nx=cy/cl,ny=-cx/cl;
  const glassAt=(t:number):[number,number]=>[ws+cx*t+nx*cl*.08*t*(1-t),ys+cy*t+ny*cl*.08*t*(1-t)];
  let s1=T.MathUtils.clamp(dloBottom(x),0,1),s2=T.MathUtils.clamp(dloTop(x),0,1);if(s2<s1+.001)s2=Math.min(1,s1+.001);if(s2>=1)s1=Math.min(s1,.998);
  const px=Math.max(.02,wr-s.railBand),py=yr+s.railBand*.5,crown=yt-py,power=crown<0?4:2.2;
  const side:[number,number][]=[[0,yb],[wIn,yb],[wIn,ya],[w*.93,ya],...lower,[ws,ys],glassAt(s1),glassAt(s2),[wr,yr],[px,py]];
  for(const u of CROWN)side.push([px*u,py+crown*(1-u**power)]);
  side.push([0,yt]);
  // Ring order: bottom centre, the left side up to the roof centre, the right side back down.
  for(const [z,y] of [...side,...side.slice(1,-1).reverse().map(([z,y])=>[-z,y] as [number,number])])pos.push(x,y,z);
 }
 const at=(i:number,k:number)=>i*RING+(k%RING);
 const lists={paint:[] as number[],glass:[] as number[],under:[] as number[],trim:[] as number[]};
 const inDlo=(x:number)=>x<s.dlo.front&&x>s.dlo.rear,pillar=(x:number)=>s.dlo.pillars.some(([c,w])=>Math.abs(x-c)<w/2);
 const glazed=(x:number)=>(x<s.windscreen[1]&&x>s.windscreen[0])||(x<s.backlight[1]&&x>s.backlight[0])||(s.glassRoof&&x<s.windscreen[1]&&x>s.backlight[0]);
 for(let i=0;i<xs.length-1;i++){
  const mid=(xs[i]+xs[i+1])/2;
  for(let k=0;k<RING;k++){
   const a=at(i,k),b=at(i,k+1),c=at(i+1,k+1),d=at(i+1,k);
   // Band k joins ring points k and k+1; the left side is bands 0–17, the right side mirrors them.
   const band=k<HALF-1?k:RING-1-k;let list=lists.paint;
   if(band<3)list=lists.under;
   else if(band>=8&&band<=10&&inDlo(mid))list=band===9&&!pillar(mid)?lists.glass:lists.trim;
   else if(band>=12&&glazed(mid))list=lists.glass;
   list.push(a,b,d,b,c,d);
  }
 }
 // Normals from the loft's own tangents (around the section and along the car), so uneven station spacing
 // does not ripple the reflections the way face-averaged normals do.
 const normals:number[]=[],P=(i:number,k:number)=>v3(pos[at(i,k)*3],pos[at(i,k)*3+1],pos[at(i,k)*3+2]);
 for(let i=0;i<xs.length;i++)for(let k=0;k<RING;k++){
  const around=P(i,k+1).sub(P(i,(k+RING-1)%RING)),along=P(Math.max(0,i-1),k).sub(P(Math.min(xs.length-1,i+1),k));
  const n=along.cross(around).normalize();normals.push(n.x,n.y,n.z);
 }
 // End caps close the nose and tail.
 for(const i of [0,xs.length-1]){
  const base=pos.length/3;let cy=0;for(let k=0;k<RING;k++){pos.push(pos[at(i,k)*3],pos[at(i,k)*3+1],pos[at(i,k)*3+2]);cy+=pos[at(i,k)*3+1]/RING;}
  const center=pos.length/3;pos.push(xs[i],cy,0);
  for(let k=0;k<RING;k++){const a=base+k,b=base+(k+1)%RING;if(i===0)lists.paint.push(center,b,a);else lists.paint.push(center,a,b);}
 }
 for(const i of [0,xs.length-1])for(let k=0;k<=RING;k++)normals.push(i===0?1:-1,0,0);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
 const order=[lists.paint,lists.glass,lists.under,lists.trim];geo.setIndex(order.flat());
 let start=0;order.forEach((list,i)=>{geo.addGroup(start,list.length,i);start+=list.length;});
 const body=new T.Mesh(geo,[m.paint,m.glass,m.under,m.trim]);body.name='car-body';body.castShadow=true;body.receiveShadow=true;return body;
}

/** Lamps, intakes, grilles and handles laid on the body: grids of rays cast at the paint, lifted a few millimetres. */
function detailer(car:T.Group,body:T.Mesh,m:Materials,s:CarSpec){
 const bvh=new MeshBVH(body.geometry.clone()),ray=new T.Ray(),end=s.length/2;
 const cast=(o:T.Vector3,d:T.Vector3):Hit|undefined=>{ray.set(o,d.clone().normalize());const h=bvh.raycastFirst(ray,T.DoubleSide);if(!h?.face)return;const normal=h.face.normal.clone();if(normal.dot(ray.direction)>0)normal.negate();return {point:h.point.clone(),normal};};
 const skin=(mat:T.Material,probe:Probe,nu:number,nv=2,lift=.004)=>{
  const pos:number[]=[],index:number[]=[],map:number[]=[],normals:T.Vector3[]=[];
  for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const [o,d]=probe(i/(nu-1),nv>1?j/(nv-1):0),h=cast(o,d);if(!h){map.push(-1);continue;}map.push(normals.length);normals.push(h.normal);pos.push(...h.point.addScaledVector(h.normal,lift).toArray());}
  const p=(n:number)=>v3(pos[n*3],pos[n*3+1],pos[n*3+2]);
  const tri=(a:number,b:number,c:number)=>{const n=p(b).sub(p(a)).cross(p(c).sub(p(a)));if(n.dot(normals[a])<0)index.push(a,c,b);else index.push(a,b,c);};
  for(let j=0;j<nv-1;j++)for(let i=0;i<nu-1;i++){const a=map[j*nu+i],b=map[j*nu+i+1],c=map[(j+1)*nu+i+1],d=map[(j+1)*nu+i];if(a<0||b<0||c<0||d<0)continue;tri(a,b,c);tri(a,c,d);}
  if(!index.length)return;
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setIndex(index);geo.computeVertexNormals();
  const o=add(car,geo,mat);o.castShadow=false;return o;
 };
 return {m,s,cast,skin,
  /** Horizontal rays converging on a point inside the car, sweeping around the nose (1) or tail (−1). */
  around:(sign:1|-1,h0:number,h1:number,a0:number,a1:number,depth=1):Probe=>(u,v)=>{const a=a0+(a1-a0)*u,h=h0+(h1-h0)*v,cx=sign*(end-depth);return [v3(cx+sign*Math.cos(a)*4,h,Math.sin(a)*4),v3(-sign*Math.cos(a),0,-Math.sin(a))];},
  /** Rays along the car's length onto its nose (1) or tail (−1). */
  face:(sign:1|-1,z0:number,z1:number,h0:number,h1:number):Probe=>(u,v)=>[v3(sign*(end+1),h0+(h1-h0)*v,z0+(z1-z0)*u),v3(-sign,0,0)],
  /** Rays straight down. */
  top:(x0:number,x1:number,z0:number,z1:number):Probe=>(u,v)=>[v3(x0+(x1-x0)*u,4,z0+(z1-z0)*v),v3(0,-1,0)],
  /** Rays straight down along a line through plan points [x, z], as a strip of the given width. */
  path:(points:[number,number][],width:number):Probe=>{
   const lengths=[0];for(let i=1;i<points.length;i++)lengths.push(lengths[i-1]+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
   return (u,v)=>{const at=u*lengths[lengths.length-1];let i=1;while(i<points.length-1&&lengths[i]<at)i++;
    const [ax,az]=points[i-1],[bx,bz]=points[i],t=(at-lengths[i-1])/Math.max(1e-6,lengths[i]-lengths[i-1]),dx=bx-ax,dz=bz-az,l=Math.hypot(dx,dz)||1,o=(v-.5)*width;
    return [v3(ax+dx*t-dz/l*o,4,az+dz*t+dx/l*o),v3(0,-1,0)];};
  },
  /** Rays across the car onto its left (1) or right (−1) side. */
  side:(x0:number,x1:number,h0:number,h1:number,sign:number):Probe=>(u,v)=>[v3(x0+(x1-x0)*u,h0+(h1-h0)*v,sign*3),v3(0,0,-sign)],
  headlamp:(h:Hit,radius:number)=>{
   const g=new T.Group();g.position.copy(h.point);g.quaternion.setFromUnitVectors(v3(0,1,0),h.normal);car.add(g);
   add(g,new T.CylinderGeometry(radius,radius,.05,40),m.metal).position.y=-.012;
   add(g,new T.CylinderGeometry(radius*.93,radius*.93,.05,40),m.trim).position.y=-.009;
   for(const [a,b] of [[-1,-1],[-1,1],[1,-1],[1,1]])add(g,new T.BoxGeometry(radius*.52,.05,radius*.52),m.lamp).position.set(a*radius*.34,-.012,b*radius*.34);
  },
  tailpipe:(x:number,y:number,z:number,radius:number)=>{
   const pipe=add(car,new T.CylinderGeometry(radius,radius,.12,24,1,true),m.metal);pipe.rotation.z=Math.PI/2;pipe.position.set(x,y,z);
   const bore=add(car,new T.CircleGeometry(radius*.85,24),m.dark);bore.rotation.y=-Math.PI/2;bore.position.set(x-.045,y,z);
  },
  /** Door mirrors: a rounded housing on a short arm from the body side at (x, y). */
  mirror:(x:number,y:number,reach:number,tall:number,wide:number)=>{
   for(const k of [-1,1]){
    const h=cast(v3(x,y,k*3),v3(0,0,-k));if(!h)continue;
    const housing=add(car,new T.SphereGeometry(1,24,16),m.paint);housing.scale.set(tall*.7,tall/2,wide/2);housing.position.set(x-.04,y+tall*.35,h.point.z+k*(reach+wide*.4));
    const face=add(car,new T.SphereGeometry(1,24,16),m.trim);face.scale.set(.01,tall*.42,wide*.45);face.position.set(x-.04-tall*.66,y+tall*.35,housing.position.z);
    const arm=add(car,new T.BoxGeometry(.06,.03,reach+.04),m.trim);arm.position.set(x,y+.02,h.point.z+k*(reach/2));
   }
  },
 };
}

/** Wheel face with spoke pairs: a disc with the openings between spokes cut out, then extruded. */
function wheelFace(r:number,w:WheelStyle){
 const R=r*.965,hub=r*.2,outer=R-.012,shape=new T.Shape();shape.absarc(0,0,R,0,Math.PI*2,false);
 const t=(rad:number)=>(rad-hub)/(outer-hub),polar=(rad:number,a:number)=>new T.Vector2(Math.cos(a)*rad,Math.sin(a)*rad);
 const spokes:((rad:number)=>number)[]=[];
 for(let i=0;i<w.pairs;i++)for(const k of [-1,1])spokes.push(rad=>i*Math.PI*2/w.pairs+k*w.spread(t(rad))+w.sweep*t(rad));
 for(let j=0;j<spokes.length;j++){
  const a=spokes[j],b=j+1<spokes.length?spokes[j+1]:(rad:number)=>spokes[0](rad)+Math.PI*2;
  const edge:[number,number,number][]=[];
  for(let q=0;q<=14;q++){const rad=hub+.02+(outer-hub-.02)*q/14,halfAngle=w.spoke/2/rad,lo=a(rad)+halfAngle,hi=b(rad)-halfAngle;if((hi-lo)*rad>.006)edge.push([rad,lo,hi]);}
  if(edge.length<2)continue;
  const arc=(rad:number,from:number,to:number)=>Array.from({length:7},(_,i)=>polar(rad,from+(to-from)*i/6));
  const last=edge[edge.length-1],first=edge[0];
  shape.holes.push(new T.Path([...edge.map(([rad,lo])=>polar(rad,lo)),...arc(last[0],last[1],last[2]).slice(1,-1),...edge.slice().reverse().map(([rad,,hi])=>polar(rad,hi)),...arc(first[0],first[2],first[1]).slice(1,-1)]));
 }
 return new T.ExtrudeGeometry(shape,{depth:.022,bevelEnabled:false,curveSegments:48});
}

/** Tyre with rounded shoulders, dark barrel, brake disc and caliper, and the spoked face. Axis along z, face at +z. */
function wheel(a:Axle,m:Materials,style:WheelStyle){
 const g=new T.Group(),R=a.radius,W=a.tyre,r=a.rim,zAxis=(geo:T.BufferGeometry)=>geo.rotateX(Math.PI/2);
 add(g,zAxis(new T.LatheGeometry([[r,-W/2+.012],[R-.02,-W/2],[R-.005,-W/2+.028],[R,-W/2+.06],[R,W/2-.06],[R-.005,W/2-.028],[R-.02,W/2],[r,W/2-.012]].map(([x,y])=>new T.Vector2(x,y)),56)),m.tyre);
 add(g,zAxis(new T.CylinderGeometry(r,r,W*.9,40,1,true)),m.under);
 add(g,zAxis(new T.CylinderGeometry(r*.8,r*.8,.028,40)),m.disc).position.z=W/2-.125;
 const caliper=add(g,new T.BoxGeometry(.075,.17,.075),m.caliper);const angle=Math.PI*.8;caliper.position.set(Math.cos(angle)*r*.72,Math.sin(angle)*r*.72,W/2-.118);caliper.rotation.z=angle;
 const face=add(g,wheelFace(r,style),m.rim);face.position.z=W/2-.075;
 const lip=add(g,new T.TorusGeometry(r*.975,.009,8,56),m.rim);lip.position.z=W/2-.05;
 const centre=add(g,zAxis(new T.CylinderGeometry(r*.16,r*.18,.035,style.hub==='nut'?6:32)),style.hub==='nut'?m.metal:m.rim);centre.position.z=W/2-.045;
 return g;
}

export function carMaterials(spec:CarSpec):Materials{
 const physical=(color:string,metalness:number,roughness:number,clearcoat=0)=>new T.MeshPhysicalMaterial({color,metalness,roughness,clearcoat,clearcoatRoughness:.05});
 const skin=(mat:T.MeshPhysicalMaterial)=>{mat.polygonOffset=true;mat.polygonOffsetFactor=-2;mat.polygonOffsetUnits=-2;return mat;};
 const tyre=physical('#1b1c1c',0,.9);tyre.side=T.DoubleSide;
 return {
  paint:physical(spec.paint.color,spec.paint.metalness,spec.paint.roughness,1),glass:physical('#20272d',0,.03,1),under:physical('#121313',0,.92),trim:skin(physical('#060607',.2,.3,1)),
  tyre,rim:physical(spec.wheel.color,spec.wheel.metalness,spec.wheel.roughness),disc:physical('#6d6f70',.8,.5),caliper:physical(spec.caliper,.2,.35,1),
  lamp:skin(physical('#e9eced',.1,.06,1)),tail:skin(Object.assign(physical('#8e1212',.1,.15,1),{emissive:new T.Color('#5a0707')})),dark:skin(physical('#101112',.2,.5)),metal:physical('#b8bbbd',.95,.2),
 };
}

export function buildCar(s:CarSpec,m=carMaterials(s)){
 const car=new T.Group();car.name=s.name;car.userData.spec={length:s.length,width:s.width,height:s.height,wheelbase:s.wheelbase};
 const body=carBody(s,m);car.add(body);
 for(const a of s.axles)for(const side of [-1,1]){const w=wheel(a,m,s.wheel);if(side<0)w.rotation.y=Math.PI;w.position.set(a.x,a.radius,side*a.track/2);w.name='car-wheel';car.add(w);}
 s.details(detailer(car,body,m,s));
 car.traverse(o=>{if(o instanceof T.Mesh&&o.name!=='car-body'&&o.castShadow)o.receiveShadow=true;});
 return car;
}

/** `models`: modelled cars (car-models.ts) that stand in a bay in place of its traced car. */
export function garageCars(models:CarModels={}){
 const group=new T.Group();group.name='garage-cars';
 // Bays follow the two garage doors; both cars stand nose-in. The south bay has the more room beside it (1.80 m from
 // its centre line to the wall, against 1.11 m), so the wider Model Y parks there.
 for(const [spec,px,pz,model] of [[teslaModelY,247,711,models.modelY],[porsche911,257,603,models.porsche]] as [CarSpec,number,number,T.Object3D|undefined][]){
  const car=model??buildCar(spec),p=planPoint(px,pz);car.position.set(p[0],.16,p[1]);car.rotation.y=-.1;group.add(car);
 }
 return group;
}
