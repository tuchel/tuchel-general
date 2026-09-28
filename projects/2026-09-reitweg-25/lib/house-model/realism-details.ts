import * as T from 'three';

/** Gutters, downpipes and clips on the eaves. The slate texture carries the roof covering. */
export function roofTrim(parent:T.Group,half:number,length:number,eave:number){
 const metal=new T.MeshStandardMaterial({color:'#454b4b',metalness:.65,roughness:.43});
 for(const side of [-1,1]){
  const gutter=new T.Mesh(new T.CylinderGeometry(.09,.09,length,12,1,true,0,Math.PI),metal);
  gutter.rotation.x=Math.PI/2;gutter.position.set(side*(half+.025),eave-.09,0);gutter.castShadow=true;parent.add(gutter);
 }
 // Downpipes and their clips, aligned to the same eave coordinates.
 for(const side of [-1,1])for(const z of [-length/2+.24,length/2-.24]){
  const pipe=new T.Mesh(new T.CylinderGeometry(.042,.042,eave-.2,12),metal);pipe.position.set(side*(half-.1),(eave-.2)/2+.12,z);pipe.castShadow=true;parent.add(pipe);
  for(const y of [.55,1.7,2.5]){const clip=new T.Mesh(new T.TorusGeometry(.05,.012,5,12),metal);clip.rotation.x=Math.PI/2;clip.position.set(side*(half-.1),y,z);parent.add(clip);}
 }
}
