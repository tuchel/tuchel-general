import * as T from 'three';
import {planPoint as p} from './site-data';
/** Photo-led finishes; construction dimensions are indicative. Never changes partitions. */
export function architecturalDetails(ground:T.Group,ceilings:T.Group){
 const group=new T.Group();group.name='photo-led-interior-details';ground.add(group);
 // Stone skirting matching the polished floor tiles (owner photos).
 const skirting=new T.MeshStandardMaterial({color:'#b1ab9f',roughness:.4});skirting.userData.photo='stone';
 const linen=new T.MeshStandardMaterial({color:'#ded8c9',roughness:1,side:T.DoubleSide});linen.userData.photo='linen';
 const dark=new T.MeshStandardMaterial({color:'#252824',roughness:.42,metalness:.5});
 const stone=new T.MeshStandardMaterial({color:'#c3bdaa',roughness:.78});stone.userData.photo='stone';
 const box=(g:T.Object3D,x:number,y:number,z:number,w:number,h:number,d:number,mat:T.Material)=>{const mesh=new T.Mesh(new T.BoxGeometry(w,h,d),mat);mesh.position.set(x,y+h/2,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh;};
 // Pleated curtains occupy the existing living-room window reveals (IMG_1462); the opened east façade has none.
 const curtains=new T.Group();curtains.name='living-room-linen-curtains';curtains.userData.replacedBy='east';group.add(curtains);
 for(const z of [5.02,7.67]){
  const geometry=new T.PlaneGeometry(.46,2.56,32,14);const pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);pos.setZ(i,.055*Math.sin(x*65)+.016*Math.cos(y*3+x*4));}geometry.computeVertexNormals();
  const c=new T.Mesh(geometry,linen);c.rotation.y=-Math.PI/2;c.position.set(5.57,1.48,z);c.castShadow=true;curtains.add(c);
 }
 box(curtains,5.6,2.78,6.35,.025,.025,3.2,dark);
 // And to the floor either side of both south windows, on black rods, clear of the glass (owner photograph of the fire).
 for(const [lo,hi] of [[-4.4,-1.8],[1.83,4.26]]){
  for(const x of [lo-.27,hi+.27]){
   const geometry=new T.PlaneGeometry(.46,2.44,32,14);const pos=geometry.attributes.position;
   for(let i=0;i<pos.count;i++){const u=pos.getX(i),y=pos.getY(i);pos.setZ(i,.055*Math.sin(u*65)+.016*Math.cos(y*3+u*4));}geometry.computeVertexNormals();
   const c=new T.Mesh(geometry,linen);c.position.set(x,1.4,9.185);c.castShadow=true;curtains.add(c);
  }
  box(curtains,(lo+hi)/2,2.63,9.2,hi-lo+1.2,.025,.025,dark);
 }
 // Floor-length linen curtains hang either side of the bedroom's garden door, clear of the glass (owner photograph from the
 // bed).
 const bedroom=new T.Group();bedroom.name='bedroom-linen-curtains';group.add(bedroom);
 for(const z of [-7.96,-4.76]){
  const geometry=new T.PlaneGeometry(.46,2.56,32,14);const pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i);pos.setZ(i,.055*Math.sin(x*65)+.016*Math.cos(y*3+x*4));}geometry.computeVertexNormals();
  const c=new T.Mesh(geometry,linen);c.rotation.y=-Math.PI/2;c.position.set(5.57,1.48,z);c.castShadow=true;bedroom.add(c);
 }
 box(bedroom,5.6,2.78,-6.36,.025,.025,3.6,dark);
 // A dark slate hearth, cut irregular, before the fireplace's stone surround; a modest stack of logs beside it; a brass
 // sunburst mirror over it (owner photograph of the fire).
 const [fx,fz]=p(1010,877);
 {const outline=[[-.98,0],[.96,0],[.94,-.42],[.6,-.5],[.1,-.47],[-.3,-.55],[-.75,-.68],[-.95,-.6]].map(([x,z])=>new T.Vector2(x,-z));
  const geometry=new T.ExtrudeGeometry(new T.Shape(outline),{depth:.03,bevelEnabled:false});geometry.rotateX(-Math.PI/2);
  const slate=new T.MeshStandardMaterial({color:'#55585a',roughness:.55});const hearth=new T.Mesh(geometry,slate);hearth.position.set(fx,.16,fz-.4);hearth.name='living-hearth';hearth.receiveShadow=true;group.add(hearth);}
 {const sun=new T.Group();sun.name='living-sunburst-mirror';sun.position.set(fx,2.05,fz-.42);group.add(sun);const brass=new T.MeshStandardMaterial({color:'#b08d4a',roughness:.35,metalness:.8});
  const glass=new T.Mesh(new T.SphereGeometry(.1,24,12,0,Math.PI*2,0,Math.PI/2),new T.MeshStandardMaterial({color:'#cfd3d2',roughness:.05,metalness:.9}));glass.rotation.x=-Math.PI/2;glass.scale.y=.35;sun.add(glass);
  sun.add(new T.Mesh(new T.TorusGeometry(.12,.012,8,32),brass));
  for(let i=0;i<36;i++){const a=i/36*Math.PI*2,len=i%2?.2:.27,ray=new T.Mesh(new T.CylinderGeometry(.004,.006,len,5),brass);ray.position.set(Math.cos(a)*(.13+len/2),Math.sin(a)*(.13+len/2),0);ray.rotation.z=a-Math.PI/2;sun.add(ray);}}
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
 // In the kitchen: the same black cylinders in a row over the island and another between it and the range; two brass
 // pendants with bare bulbs over the breakfast table; linen curtains tied back either side of its window (owner
 // photographs of the kitchen).
 for(const [x,z] of [[-3.93,-6.4],[-3.93,-5.33],[-3.93,-4.26],[-2.55,-7.1],[-2.55,-5.9],[-2.55,-4.7]]){
  const fixture=new T.Mesh(new T.CylinderGeometry(.07,.07,.15,16),dark);fixture.position.set(x,2.715,z);fixture.name='kitchen-downlight';ceilings.add(fixture);
  const disc=new T.Mesh(new T.CircleGeometry(.058,16),emit);disc.rotation.x=Math.PI/2;disc.position.set(x,2.639,z);ceilings.add(disc);lamps.push(disc);
 }
 const brass=new T.MeshStandardMaterial({color:'#a8874a',roughness:.35,metalness:.8});
 for(const x of [-4.27,-3.47]){const pendant=new T.Group();pendant.name='kitchen-pendant';pendant.position.set(x,0,-8.07);ceilings.add(pendant);
  const stem=new T.Mesh(new T.CylinderGeometry(.006,.006,.95,6),brass);stem.position.y=2.315;pendant.add(stem);
  const shade=new T.Mesh(new T.CylinderGeometry(.12,.12,.008,24),brass);shade.position.y=1.83;pendant.add(shade);
  const bulb=new T.Mesh(new T.SphereGeometry(.055,16,10),emit);bulb.position.y=1.77;pendant.add(bulb);lamps.push(bulb);}
 for(const x of [-4.42,-2.78]){
  const geometry=new T.PlaneGeometry(.4,1.6,24,10);const pos=geometry.attributes.position;
  for(let i=0;i<pos.count;i++){const u=pos.getX(i),y=pos.getY(i);pos.setZ(i,.045*Math.sin(u*65)*(.5+.5*Math.abs(y+.3))+.012*Math.cos(y*3+u*4));}geometry.computeVertexNormals();
  const c=new T.Mesh(geometry,linen);c.position.set(x,1.65,-9.185);c.castShadow=true;c.name='kitchen-window-curtain';group.add(c);
 }
 box(group,-3.6,2.45,-9.2,2.3,.02,.02,dark);
 // Low trim follows wall segments, keeping every doorway open.
 const walls:T.Mesh[]=[];ground.traverse(o=>{if(o instanceof T.Mesh&&o.userData.height>2&&o.material instanceof T.MeshStandardMaterial&&o.material.userData.timber==='#e9e4d9')walls.push(o);});
 for(const wall of walls){const trim=box(group,wall.position.x,.14,wall.position.z,wall.scale.x,.075,.2,skirting);trim.rotation.copy(wall.rotation);}
 // Fine sewn edges catch light around photographed upholstered seat cushions.
 const cushions:T.Mesh[]=[];ground.traverse(o=>{if(o instanceof T.Mesh&&o.material instanceof T.MeshStandardMaterial&&o.material.userData.photo==='linen'&&o.scale.x>.35&&o.scale.z>.3&&o.scale.y>.07&&o.scale.y<.18)cushions.push(o);});
 const piping=new T.MeshStandardMaterial({color:'#cbc7b8',roughness:.97});
 for(const cushion of cushions){const corners=[[-.43,.38,-.43],[.43,.38,-.43],[.48,.38,-.37],[.48,.38,.37],[.43,.38,.43],[-.43,.38,.43],[-.48,.38,.37],[-.48,.38,-.37]].map(v=>new T.Vector3(...v));const edge=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(corners,true,'centripetal'),40,.004,5,true),piping);edge.name='upholstery-piping';cushion.add(edge);}
 return {ceilings,lamps,emit};
}
