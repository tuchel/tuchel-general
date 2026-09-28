import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {solarRoofs,solarPanels,solarModule} from './solar-layout';
import {planPoint as p} from './site-data';
export function buildSolar(roofParent:T.Group,batteries:T.Group){
 const group=new T.Group();group.name='renovation-solar-roofs';roofParent.add(group);group.visible=false;
 const frame=new T.MeshStandardMaterial({color:'#293335',roughness:.65}),cell=new T.MeshStandardMaterial({color:'#192c35',roughness:.36,metalness:.25}),seam=new T.LineBasicMaterial({color:'#64777b',transparent:true,opacity:.36});
 const panelGeo=new T.BoxGeometry(solarModule.width,.045,solarModule.length),faceGeo=new T.BoxGeometry(solarModule.width-.035,.008,solarModule.length-.035);
 for(const roof of solarRoofs){const g=new T.Group();g.position.set(roof.center[0],0,roof.center[1]);g.rotation.y=roof.rotation;g.name='solar-'+roof.id;group.add(g);const angle=Math.atan2(roof.ridge-roof.eave,roof.width/2);
  for(const panel of solarPanels.filter(v=>v.roof===roof.id)){const tile=new T.Group();tile.name=`solar-module-${roof.id}-${panel.side}-${panel.u}-${panel.z}`;tile.position.set(panel.side*panel.u*Math.cos(angle),roof.ridge-panel.u*Math.sin(angle)+.19,panel.z);tile.rotation.z=-panel.side*angle;g.add(tile);const base=new T.Mesh(panelGeo,frame);base.castShadow=true;base.receiveShadow=true;tile.add(base);const surface=new T.Mesh(faceGeo,cell);surface.position.y=.028;tile.add(surface);const pts:T.Vector3[]=[];for(let i=1;i<6;i++){const z=-solarModule.length/2+i*solarModule.length/6;pts.push(new T.Vector3(-solarModule.width/2+.02,.033,z),new T.Vector3(solarModule.width/2-.02,.033,z));}const grid=new T.LineSegments(new T.BufferGeometry().setFromPoints(pts),seam);tile.add(grid);}
 }
 const white=new T.MeshStandardMaterial({color:'#eeeee7',roughness:.4}),edge=new T.MeshStandardMaterial({color:'#394342',roughness:.5}),green=new T.MeshStandardMaterial({color:'#7b9e78',emissive:'#7b9e78',emissiveIntensity:.15});
 const caseGeo=new RoundedBoxGeometry(.61,1.1,.193,3,.035);
 // Two 13.5kWh capacity placeholders inside the garage, not a certified Tesla installation.
 // Final location, separation, phases and equipment configuration need an installer design.
 for(let i=0;i<2;i++){const g=new T.Group();g.name='solar-battery-'+i;const [x,z]=p(174+i*30,557+i*3.2);g.position.set(x,.94,z);g.rotation.y=-.105;batteries.add(g);const backing=new T.Mesh(new T.BoxGeometry(.62,1.11,.1),edge);g.add(backing);const front=new T.Mesh(caseGeo,white);front.position.z=.075;front.castShadow=true;g.add(front);const indicator=new T.Mesh(new T.BoxGeometry(.13,.008,.006),green);indicator.position.set(0,.47,.175);g.add(indicator);}
 return group;
}
