import * as T from 'three';
import {planPoint} from './site-data';

/** The two cars in the garage, built to published length, width, height, wheelbase, track and tyre
 * sizes (Porsche 911 Carrera, 992.2; Tesla Model Y, 2025). Bodies are smooth lofts through measured-looking
 * side profiles, not manufacturer surfaces. Local axes: x forward, y up, z to the car's left. */
type Axle={x:number;track:number;radius:number;tyre:number;rim:number};
export type CarSpec={
 name:string;length:number;width:number;height:number;wheelbase:number;axles:[Axle,Axle];
 top:[number,number][];bottom:[number,number][];belt:[number,number][];halfWidth:[number,number][];fender:[number,number][];
 cabin:[number,number];roof:[number,number];bPillar:number;roofHalf:number;glassRoof:boolean;
 paint:{color:string;metalness:number;roughness:number};wheel:'spokes'|'aero';details:(car:T.Group,m:CarMaterials,spec:CarSpec)=>void;
};
type CarMaterials={paint:T.Material;glass:T.Material;under:T.Material;tyre:T.Material;rim:T.Material;lamp:T.Material;tail:T.Material;dark:T.Material};

// Profiles run from the front (+x) to the rear (−x); heights are above the ground.
export const porsche911:CarSpec={
 name:'Porsche 911 Carrera',length:4.542,width:1.852,height:1.298,wheelbase:2.45,
 axles:[{x:1.281,track:1.589,radius:.3353,tyre:.235,rim:.2413},{x:-1.169,track:1.557,radius:.3573,tyre:.295,rim:.254}],
 top:[[2.271,.5],[2.2,.6],[2,.655],[1.6,.7],[1.2,.745],[.95,.79],[.85,.815],[.55,1.05],[.2,1.25],[-.15,1.298],[-.55,1.27],[-.95,1.17],[-1.35,1.05],[-1.75,.95],[-2.1,.87],[-2.25,.84],[-2.271,.78]],
 bottom:[[2.271,.26],[2.1,.17],[1.8,.13],[-1.8,.13],[-2.1,.25],[-2.271,.38]],
 belt:[[.85,.84],[.3,.9],[-.5,.94],[-1.1,.97],[-1.35,1]],
 halfWidth:[[2.271,.66],[2.15,.8],[1.9,.88],[1.3,.912],[.6,.895],[-.2,.886],[-.8,.905],[-1.17,.926],[-1.7,.914],[-2.1,.86],[-2.271,.77]],
 fender:[[2.2,.02],[1.9,.07],[1.4,.07],[1,.04],[.85,0],[-1.35,0],[-1.5,.04],[-1.9,.03],[-2.271,0]],
 cabin:[-1.35,.85],roof:[-.6,.2],bPillar:-.35,roofHalf:.55,glassRoof:false,
 paint:{color:'#5b6062',metalness:.55,roughness:.32},wheel:'spokes',
 details:(car,m,s)=>{
  // Round headlamps on the front wings, full-width tail light, engine-lid grille, mirrors and front intakes.
  for(const side of [-1,1]){const lamp=new T.Mesh(new T.SphereGeometry(1,20,12),m.lamp);lamp.scale.set(.19,.085,.12);lamp.position.set(1.93,.735,side*.62);lamp.rotation.z=-.22;car.add(lamp);}
  add(car,new T.BoxGeometry(.035,.045,1.62),m.tail,-2.245,.86,0);
  add(car,new T.BoxGeometry(.32,.012,.72),m.dark,-1.95,.905,0).rotation.z=-.18;
  for(const side of [-1,1])add(car,new T.BoxGeometry(.13,.075,.15),m.paint,.72,.93,side*(s.width/2+.04));
  for(const z of [-.55,0,.55])add(car,new T.BoxGeometry(.03,.1,z===0?.5:.34),m.dark,2.2,.29,z);
 },
};
export const teslaModelY:CarSpec={
 name:'Tesla Model Y',length:4.79,width:1.92,height:1.624,wheelbase:2.89,
 axles:[{x:1.515,track:1.636,radius:.356,tyre:.255,rim:.2413},{x:-1.375,track:1.636,radius:.356,tyre:.255,rim:.2413}],
 top:[[2.395,.62],[2.3,.76],[2.1,.86],[1.7,.93],[1.3,.97],[1.12,1],[.8,1.2],[.35,1.5],[0,1.6],[-.4,1.624],[-.9,1.6],[-1.3,1.53],[-1.65,1.36],[-1.95,1.2],[-2.2,1.12],[-2.36,1.08],[-2.395,.98]],
 bottom:[[2.395,.4],[2.25,.26],[1.95,.19],[-1.95,.19],[-2.25,.31],[-2.395,.46]],
 belt:[[1.12,1.02],[.3,1.06],[-.8,1.1],[-1.6,1.15]],
 halfWidth:[[2.395,.72],[2.25,.88],[2,.94],[1.5,.955],[.5,.96],[-.5,.96],[-1.375,.958],[-2,.93],[-2.3,.86],[-2.395,.79]],
 fender:[[2.2,.01],[1.8,.02],[1.12,0],[-1.6,0],[-1.9,.015],[-2.395,0]],
 cabin:[-1.6,1.12],roof:[-1.3,.3],bPillar:-.15,roofHalf:.63,glassRoof:true,
 paint:{color:'#e8e7e2',metalness:0,roughness:.28},wheel:'aero',
 details:(car,m,s)=>{
  // Slim front light bar and lamps, full-width rear light bar, mirrors.
  add(car,new T.BoxGeometry(.03,.02,1.3),m.lamp,2.33,.845,0);
  for(const side of [-1,1])add(car,new T.BoxGeometry(.1,.05,.32),m.dark,2.27,.79,side*.62);
  add(car,new T.BoxGeometry(.035,.04,1.72),m.tail,-2.37,1.06,0);
  for(const side of [-1,1])add(car,new T.BoxGeometry(.14,.085,.16),m.paint,.98,1.07,side*(s.width/2+.05));
 },
};

function add(car:T.Group,geo:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number){const o=new T.Mesh(geo,mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;car.add(o);return o;}
/** Smooth y(x) through control points (Catmull–Rom), sampled densely. */
function profile(points:[number,number][]){
 const curve=new T.CatmullRomCurve3(points.map(([x,y])=>new T.Vector3(x,y,0)),false,'centripetal'),samples=curve.getPoints(400).sort((a,b)=>a.x-b.x);
 return (x:number)=>{if(x<=samples[0].x)return samples[0].y;for(let i=1;i<samples.length;i++)if(samples[i].x>=x){const a=samples[i-1],b=samples[i],t=(x-a.x)/Math.max(1e-6,b.x-a.x);return a.y+(b.y-a.y)*t;}return samples[samples.length-1].y;};
}

/** Lofted body: one ring of nine points per half-section, mirrored, at 90 stations along the car. */
export function carBody(s:CarSpec,m:CarMaterials){
 const top=profile(s.top),floor=profile(s.bottom),belt=profile(s.belt),half=profile(s.halfWidth),fender=profile(s.fender);
 const stations=90,ring=16,pos:number[]=[],paint:number[]=[],glass:number[]=[],under:number[]=[];
 const xs=Array.from({length:stations},(_,i)=>s.length/2-i*s.length/(stations-1));
 const cabinAt=(x:number)=>x>s.cabin[0]&&x<s.cabin[1];
 for(const x of xs){
  const yt=top(x),w=half(x);
  // Wheel openings: the underside rises in an arc over each tyre.
  let yb=floor(x);for(const a of s.axles){const r=a.radius+.045,d=x-a.x;if(Math.abs(d)<r)yb=Math.max(yb,a.radius+Math.sqrt(r*r-d*d));}
  yb=Math.min(yb,yt-.05);
  const cabin=cabinAt(x),by=cabin?Math.min(belt(x),yt-.12):yt+fender(x),bump=fender(x);
  const side:[number,number][]=[[0,yb],[w*.86,yb],[w*.985,yb+(by-yb)*.28],[w,yb+(by-yb)*.62],[w*.97,by]];
  if(cabin){const wr=Math.min(s.roofHalf,w*.8);side.push([w*.9,by+.02],[(w*.9+wr)/2,by+(yt-by)*.55],[wr,yt-.035],[0,yt]);}
  else side.push([w*.86,yt+bump*.85],[w*.55,yt+bump*.2],[w*.25,yt],[0,yt]);
  // Ring order: bottom centre, right side up to the roof centre, left side back down.
  for(const [z,y] of [...side,...side.slice(1,-1).reverse().map(([z,y])=>[-z,y] as [number,number])])pos.push(x,y,z);
 }
 const at=(i:number,k:number)=>i*ring+(k%ring);
 for(let i=0;i<stations-1;i++){
  const mid=(xs[i]+xs[i+1])/2,both=cabinAt(xs[i])&&cabinAt(xs[i+1]);
  for(let k=0;k<ring;k++){
   const a=at(i,k),b=at(i,k+1),c=at(i+1,k+1),d=at(i+1,k);
   // Band k joins ring points k and k+1; the right side is bands 0–7, the left side mirrors them.
   const band=k<8?k:15-k;let list=paint;
   if(band===0)list=under;
   else if(both&&band>=5){
    const windscreen=mid>s.roof[1],rear=mid<s.roof[0],pillar=Math.abs(mid-s.bPillar)<.05;
    if(band===7)list=windscreen||rear||s.glassRoof?glass:paint;
    else if(band===6)list=windscreen?paint:pillar?paint:glass;
    else list=pillar?paint:glass;
   }
   list.push(a,b,d,b,c,d);
  }
 }
 // End caps close the nose and tail.
 const caps:number[]=[];for(const i of [0,stations-1]){const center=pos.length/3;let cy=0;for(let k=0;k<ring;k++)cy+=pos[at(i,k)*3+1]/ring;pos.push(xs[i],cy,0);for(let k=0;k<ring;k++){if(i===0)caps.push(center,at(i,k+1),at(i,k));else caps.push(center,at(i,k),at(i,k+1));}}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));
 const index=[...paint,...caps,...glass,...under];geo.setIndex(index);
 geo.addGroup(0,paint.length+caps.length,0);geo.addGroup(paint.length+caps.length,glass.length,1);geo.addGroup(paint.length+caps.length+glass.length,under.length,2);
 geo.computeVertexNormals();
 const body=new T.Mesh(geo,[m.paint,m.glass,m.under]);body.name='car-body';body.castShadow=true;body.receiveShadow=true;return body;
}

/** Tyre (lathed, rounded shoulders), rim barrel, and either five twin spokes or an aero cover. */
function wheel(a:Axle,m:CarMaterials,style:CarSpec['wheel']){
 const g=new T.Group(),R=a.radius,W=a.tyre,r=a.rim;
 const lathe=new T.LatheGeometry([[r,-W/2],[R-.035,-W/2],[R-.008,-W/2+.02],[R,-W/2+.05],[R,W/2-.05],[R-.008,W/2-.02],[R-.035,W/2],[r,W/2]].map(([x,y])=>new T.Vector2(x,y)),40);
 const tyre=new T.Mesh(lathe,m.tyre);g.add(tyre);
 const barrel=new T.Mesh(new T.CylinderGeometry(r,r,W*.92,32,1,true),m.tyre);g.add(barrel);
 const face=new T.Group();face.position.y=W/2-.03;g.add(face);
 face.add(new T.Mesh(new T.CylinderGeometry(r*.98,r*.98,.012,32),style==='aero'?m.rim:m.dark));
 if(style==='spokes'){for(let i=0;i<5;i++)for(const off of [-.12,.12]){const spoke=new T.Mesh(new T.BoxGeometry(.032,.028,r*.9),m.rim);const angle=i*Math.PI*2/5+off;spoke.position.set(Math.sin(angle)*r*.47,.015,Math.cos(angle)*r*.47);spoke.rotation.y=angle;face.add(spoke);}const lip=new T.Mesh(new T.TorusGeometry(r*.97,.012,6,40),m.rim);lip.rotation.x=Math.PI/2;lip.position.y=.015;face.add(lip);}
 else for(let i=0;i<5;i++){const blade=new T.Mesh(new T.BoxGeometry(.05,.016,r*.75),m.dark);const angle=i*Math.PI*2/5;blade.position.set(Math.sin(angle)*r*.5,.012,Math.cos(angle)*r*.5);blade.rotation.y=angle+.35;face.add(blade);}
 face.add(new T.Mesh(new T.CylinderGeometry(r*.18,r*.18,.03,20),m.rim));
 g.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});
 return g;
}

export function buildCar(s:CarSpec,m:CarMaterials){
 const car=new T.Group();car.name=s.name;car.userData.spec={length:s.length,width:s.width,height:s.height,wheelbase:s.wheelbase};
 car.add(carBody(s,m));
 for(const a of s.axles)for(const side of [-1,1]){const w=wheel(a,m,s.wheel);w.rotation.x=side*Math.PI/2;w.position.set(a.x,a.radius,side*a.track/2);w.name='car-wheel';car.add(w);}
 s.details(car,m,s);
 return car;
}

export function garageCars(){
 const group=new T.Group();group.name='garage-cars';
 const physical=(color:string,metalness:number,roughness:number,clearcoat=0)=>new T.MeshPhysicalMaterial({color,metalness,roughness,clearcoat,clearcoatRoughness:.06});
 const tyre=physical('#1d1e1e',0,.88);tyre.side=T.DoubleSide;
 const shared={glass:physical('#1c2327',.2,.06,1),under:physical('#151616',0,.9),tyre,rim:physical('#b9bdbf',.85,.28),lamp:physical('#e4e8e8',.1,.08,1),tail:physical('#7c1a1a',.1,.18,1),dark:physical('#2b2e30',.4,.45)};
 // Bays follow the two garage doors; both cars stand nose-in, as before.
 for(const [spec,px,pz] of [[teslaModelY,257,603],[porsche911,247,711]] as [CarSpec,number,number][]){
  const car=buildCar(spec,{...shared,paint:physical(spec.paint.color,spec.paint.metalness,spec.paint.roughness,1)});
  const p=planPoint(px,pz);car.position.set(p[0],.16,p[1]);car.rotation.y=-.1;group.add(car);
 }
 return group;
}
