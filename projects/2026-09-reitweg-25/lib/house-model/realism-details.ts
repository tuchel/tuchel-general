import * as T from 'three';

/** Gutters, downpipes and clips on the eaves. The slate texture carries the roof covering.
 * Only the outdoor stretch of each eave gets a gutter, with a downpipe at either end of it;
 * `outdoors(side,z)` says whether a point on the eave lies outside every building. */
export function roofTrim(parent:T.Group,half:number,length:number,eave:number,outdoors:(side:number,z:number)=>boolean=()=>true){
 const metal=new T.MeshStandardMaterial({color:'#454b4b',metalness:.65,roughness:.43});
 for(const side of [-1,1]){
  // Longest outdoor run along this eave, sampled every 10 cm.
  let best:[number,number]|undefined,start:number|undefined;
  for(let z=-length/2;z<=length/2+1e-6;z+=.1){const open=outdoors(side,z);if(open&&start===undefined)start=z;if((!open||z+.1>length/2+1e-6)&&start!==undefined){const end=open?z:z-.1;if(!best||end-start>best[1]-best[0])best=[start,end];start=undefined;}}
  if(!best||best[1]-best[0]<.6)continue;
  const [from,to]=best,gutter=new T.Mesh(new T.CylinderGeometry(.09,.09,to-from,12,1,true,0,Math.PI),metal);
  gutter.rotation.x=Math.PI/2;gutter.position.set(side*(half+.025),eave-.09,(from+to)/2);gutter.castShadow=true;parent.add(gutter);
  // Downpipes and their clips, aligned to the same eave coordinates.
  for(const z of [from+.24,to-.24]){
   const pipe=new T.Mesh(new T.CylinderGeometry(.042,.042,eave-.2,12),metal);pipe.name='downpipe';pipe.position.set(side*(half-.1),(eave-.2)/2+.12,z);pipe.castShadow=true;parent.add(pipe);
   for(const y of [.55,1.7,2.5]){const clip=new T.Mesh(new T.TorusGeometry(.05,.012,5,12),metal);clip.rotation.x=Math.PI/2;clip.position.set(side*(half-.1),y,z);parent.add(clip);}
  }
 }
}
