import * as T from 'three';
import {planPoint} from './site-data';

/** Guest stair from the ground plan: a wall-side flight rising north from the Entrée, three winders in the
 * north-west corner and a flight east along the north wall; the same geometry serves both cutaways. */
export function guestStair(timber:T.Material,steel:T.Material,upper=false){
 const g=new T.Group();g.name=upper?'guest-upper-turning-stair':'guest-ground-turning-stair';
 const [x,z]=planPoint(112+(upper?52:0),808);g.position.set(x,0,z);g.rotation.y=-.093;
 const geo=new T.BoxGeometry(1,1,1);
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material)=>{const o=new T.Mesh(geo,mat);o.position.set(x,y+h/2,z);o.scale.set(w,h,d);o.castShadow=true;o.receiveShadow=true;g.add(o);return o;};
 const rail=(a:number[],b:number[],width=.03)=>{const u=new T.Vector3(...a),v=new T.Vector3(...b);const o=box(0,0,0,width,u.distanceTo(v),width,steel);o.position.copy(u.clone().add(v).multiplyScalar(.5));o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),v.sub(u).normalize());};
 // Local frame: x east, z south. The flight starts at the plan's start circle (z 884), clear of the entrance door.
 const base=.16,top=3.1,risers=16,rise=(top-base)/risers,step=(i:number)=>base+(i+1)*rise;
 const west=-.28,east=.72,northFlightSouth=.44,north=-.55,start=2.1,end=2.3;
 // West flight: six treads rising north.
 const westDepth=(start-northFlightSouth)/6;
 for(let i=0;i<6;i++){const zc=start-(i+.5)*westDepth;box((west+east)/2,step(i)-.055,zc,east-west,.055,westDepth+.03,timber);box(east-.02,step(i),zc,.025,.92,.025,steel);}
 // Three winders fanning around the newel at the inner corner.
 const newel=new T.Vector2(east,northFlightSouth),corner=[new T.Vector2(west,northFlightSouth),new T.Vector2(west,north),new T.Vector2(east,north)];
 const rayHit=(angle:number)=>{const d=new T.Vector2(Math.cos(angle),Math.sin(angle));const tx=d.x<0?(west-newel.x)/d.x:Infinity,tz=d.y<0?(north-newel.y)/d.y:Infinity;return newel.clone().addScaledVector(d,Math.min(tx,tz));};
 for(let i=0;i<3;i++){
  const a0=Math.PI+i*Math.PI/6,a1=a0+Math.PI/6,p0=rayHit(a0),p1=rayHit(a1);
  const outline=[newel,p0,...corner.filter(c=>{const a=Math.atan2(c.y-newel.y,c.x-newel.x)+(c.y-newel.y<0?Math.PI*2:0);return a>a0+1e-6&&a<a1-1e-6;}),p1];
  const shape=new T.Shape(outline.map(v=>new T.Vector2(v.x,-v.y)));const tread=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.055,bevelEnabled:false}),timber);
  tread.geometry.rotateX(-Math.PI/2);tread.position.y=step(6+i)-.055;tread.castShadow=true;tread.receiveShadow=true;g.add(tread);
 }
 box(east,base,northFlightSouth,.07,step(8)+.96-base,.07,steel);
 // North flight: six treads rising east along the north wall; the sixteenth riser reaches the upper floor.
 const northDepth=(end-east)/6;
 for(let i=0;i<6;i++){const xc=east+(i+.5)*northDepth;box(xc,step(9+i)-.055,(north+northFlightSouth)/2,northDepth+.03,.055,northFlightSouth-north,timber);box(xc,step(9+i),northFlightSouth-.02,.025,.92,.025,steel);}
 // Handrail on the open side, from the first tread to the newel and on to the top.
 rail([east-.02,step(0)+.96,start],[east-.02,step(5)+.96,northFlightSouth]);
 rail([east,step(8)+.96,northFlightSouth-.02],[end,top+.96,northFlightSouth-.02]);
 // Stringers along the open edges.
 rail([east-.02,base,start],[east-.02,step(5)-.07,northFlightSouth],.075);
 rail([east,step(8)-.07,northFlightSouth-.02],[end,top-.07,northFlightSouth-.02],.075);
 return g;
}
