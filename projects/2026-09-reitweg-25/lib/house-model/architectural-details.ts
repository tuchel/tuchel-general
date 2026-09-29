import * as T from 'three';
import {planPoint as p} from './site-data';
/** Photo-led finishes; construction dimensions are indicative. Never changes partitions. */
export function architecturalDetails(ground:T.Group,ceilings:T.Group){
 const group=new T.Group();group.name='photo-led-interior-details';ground.add(group);
 const plaster=new T.MeshStandardMaterial({color:'#e8e4db',roughness:.92});
 const linen=new T.MeshStandardMaterial({color:'#ded8c9',roughness:1,side:T.DoubleSide});linen.userData.photo='linen';
 const dark=new T.MeshStandardMaterial({color:'#252824',roughness:.42,metalness:.5});
 const stone=new T.MeshStandardMaterial({color:'#c3bdaa',roughness:.78});stone.userData.photo='stone';
 const box=(g:T.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.position.set(x,y+h/2,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;};
 // Pleated curtains occupy the existing living-room window reveals (IMG_1462).
 const curtains=new T.Group();curtains.name='living-room-linen-curtains';group.add(curtains);
 for(const z of [5.02,7.67]){
  const geometry=new T.PlaneGeometry(.46,2.56,32,14);const pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);pos.setZ(i,.055*Math.sin(x*65)+.016*Math.cos(y*3+x*4));}geometry.computeVertexNormals();
  const c=new T.Mesh(geometry,linen);c.rotation.y=-Math.PI/2;c.position.set(5.57,1.48,z);c.castShadow=true;curtains.add(c);
 }
 box(curtains,5.6,2.78,6.35,.025,.025,3.2,dark);
 // Stone hearth, reveal and a modest stack of logs beside the retained fireplace.
 const [fx,fz]=p(1010,877);box(group,fx,.135,fz-.35,1.8,.07,1.15,stone);
 for(const x of [-.69,.69])box(group,fx+x,.21,fz-.48,.23,1.02,.15,stone);
 box(group,fx,1.18,fz-.48,1.6,.18,.18,stone);
 const bark=new T.MeshStandardMaterial({color:'#66533c',roughness:1});
 for(let i=0;i<8;i++){const log=new T.Mesh(new T.CylinderGeometry(.065,.074,.4,9),bark);log.rotation.z=Math.PI/2;log.position.set(fx+.99+(i%2)*.12,.23+Math.floor(i/2)*.115,fz-.3);group.add(log);}
 // The photographed small black cylinders, with warm, recessed luminous apertures.
 const lamps:T.Mesh[]=[];const emit=new T.MeshStandardMaterial({color:'#ffdb9b',emissive:'#ffc77d',emissiveIntensity:0});emit.userData.lamp=true;
 for(const [x,z] of [[-2.2,5.0],[2.3,5.0],[-2.2,8.3],[2.3,8.3]]){
  const fixture=new T.Mesh(new T.CylinderGeometry(.07,.07,.15,16),dark);fixture.position.set(x,2.77,z);ceilings.add(fixture);
  const disc=new T.Mesh(new T.CircleGeometry(.058,16),emit);disc.rotation.x=Math.PI/2;disc.position.set(x,2.691,z);ceilings.add(disc);lamps.push(disc);
 }
 // Low trim follows wall segments, keeping every doorway open.
 const walls:T.Mesh[]=[];ground.traverse(o=>{if(o instanceof T.Mesh&&o.userData.height>2&&o.material instanceof T.MeshStandardMaterial&&o.material.userData.timber==='#e9e4d9')walls.push(o);});
 for(const wall of walls){const trim=box(group,wall.position.x,.14,wall.position.z,wall.scale.x,.075,.2,plaster);trim.rotation.copy(wall.rotation);}
 // Fine sewn edges catch light around photographed upholstered seat cushions.
 const cushions:T.Mesh[]=[];ground.traverse(o=>{if(o instanceof T.Mesh&&o.material instanceof T.MeshStandardMaterial&&o.material.userData.photo==='linen'&&o.scale.x>.35&&o.scale.z>.3&&o.scale.y>.07&&o.scale.y<.18)cushions.push(o);});
 const piping=new T.MeshStandardMaterial({color:'#cbc7b8',roughness:.97});
 for(const cushion of cushions){const corners=[[-.43,.38,-.43],[.43,.38,-.43],[.48,.38,-.37],[.48,.38,.37],[.43,.38,.43],[-.43,.38,.43],[-.48,.38,.37],[-.48,.38,-.37]].map(v=>new T.Vector3(...v));const edge=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(corners,true,'centripetal'),40,.004,5,true),piping);edge.name='upholstery-piping';cushion.add(edge);}
 return {ceilings,lamps,emit};
}
