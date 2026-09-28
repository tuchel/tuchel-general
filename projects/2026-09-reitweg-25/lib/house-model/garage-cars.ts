import * as T from 'three';
import {planPoint} from './site-data';

/** Stylized Model Y proportions; illustrative cars, not a vehicle fit survey. */
export function garageCars(material:(pale:string,natural?:string)=>T.MeshStandardMaterial){
 const group=new T.Group();group.name='two-model-y-garage-cars';
 const tire=material('#666961','#202421'),glass=material('#87948f','#253b40'),rim=material('#babdb5','#a0a7a8'),lamp=material('#eeeade','#ecf3ee'),tail=material('#ba9990','#ae322b');
 const boxGeo=new T.BoxGeometry(1,1,1);
 for(const [px,pz,color] of [[257,603,'#eeeae3'],[247,711,'#515958']] as [number,number,string][]){
  const car=new T.Group();car.name='Tesla Model Y '+(pz===603?'white':'graphite');const p=planPoint(px,pz);car.position.set(p[0],.19,p[1]);car.rotation.y=Math.PI/2-.1;group.add(car);
  const paint=material('#d0cec2',color);
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,m:T.Material)=>{const o=new T.Mesh(boxGeo,m);o.position.set(x,y,z);o.scale.set(w,h,d);o.castShadow=true;o.receiveShadow=true;car.add(o);return o;};
  // Each section specifies longitudinal position, half-width, lower and upper height.
  const loft=(sections:number[][],mat:T.Material)=>{const points:number[]=[],indices:number[]=[];for(const [z,w,low,high] of sections)points.push(-w,low,z,w,low,z,w,high,z,-w,high,z);for(let i=0;i<sections.length-1;i++)for(let k=0;k<4;k++){const a=i*4+k,b=i*4+(k+1)%4,c=b+4,d=a+4;indices.push(a,b,d,b,c,d);}indices.push(0,3,1,1,3,2);const n=(sections.length-1)*4;indices.push(n,n+1,n+3,n+1,n+2,n+3);const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(points,3));geo.setIndex(indices);geo.computeVertexNormals();const o=new T.Mesh(geo,mat);o.castShadow=true;o.receiveShadow=true;car.add(o);};
  loft([[-2.35,.69,.48,.84],[-2.13,.91,.31,1.03],[-1.4,.96,.29,1.07],[.98,.96,.29,.95],[1.86,.87,.36,.82],[2.35,.7,.48,.73]],paint);
  loft([[-1.91,.74,.94,1.02],[-.81,.77,1.03,1.59],[.31,.74,.95,1.64],[1.28,.76,.91,1.02]],glass);
  // Slim body-colour pillars, flush handles, panoramic roof, and horizontal light signatures.
  box(0,1.642,-.08,1.42,.024,1.04,glass);
  for(const side of [-1,1]){box(side*.779,1.28,-.4,.036,.53,.055,paint);for(const z of [-.89,.57])box(side*.968,1.005,z,.02,.025,.2,rim);box(side*1.02,1.08,.87,.15,.09,.21,paint);}
  box(0,.77,2.29,1.28,.027,.04,lamp);box(0,.84,-2.29,1.27,.035,.04,tail);box(0,.53,2.34,.39,.13,.025,rim);
  for(const x of [-.89,.89])for(const z of [-1.4,1.4]){const wheel=new T.Mesh(new T.CylinderGeometry(.36,.36,.22,24),tire);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.36,z);wheel.castShadow=true;car.add(wheel);const hub=new T.Mesh(new T.CylinderGeometry(.245,.245,.228,16),rim);hub.rotation.z=Math.PI/2;hub.position.copy(wheel.position);car.add(hub);}
 }
 return group;
}
