import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/landscape-context.ts','lib/house-model/site-data.ts'],outdir:'tmp/setting-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {landscapeContext,boundaryHedge}=await import('../tmp/setting-check/landscape-context.mjs');
const {plotOutline}=await import('../tmp/setting-check/site-data.mjs');
const hedge=boundaryHedge(),runs=[[plotOutline[0],plotOutline[1]],[plotOutline[1],plotOutline[2]],[plotOutline[2],plotOutline[3]]];
hedge.updateMatrixWorld(true);const body=hedge.getObjectByName('hedge-body'),ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
for(const [a,b] of runs){const len=Math.hypot(b[0]-a[0],b[1]-a[1]),tx=(b[0]-a[0])/len,tz=(b[1]-a[1])/len;
 for(let t=.05;t<1;t+=.1){const x=a[0]+(b[0]-a[0])*t-tz*.62,z=a[1]+(b[1]-a[1])*t+tx*.62;ray.set(new T.Vector3(x,5,z),down);const hit=ray.intersectObject(body,false)[0];
  assert(hit&&hit.point.y>1.1&&hit.point.y<1.6,'hedge continues on all three garden edges at about 1.35 m');}}
const {group}=landscapeContext();group.updateMatrixWorld(true);assert(group.getObjectByName('mature-roadside-avenue'));assert(group.getObjectByName('layered-park-woodland'));
let ridges=0;group.traverse(o=>{if(o instanceof T.Mesh){assert([...o.matrixWorld.elements].every(Number.isFinite));const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)assert(Number.isFinite(a.getX(i)+a.getY(i)+a.getZ(i)));if(o.userData.scenicBackdrop){ridges++;const radii=[];for(let j=0;j<a.count;j++)radii.push(Math.hypot(a.getX(j),a.getZ(j)));assert(Math.min(...radii)>=999,'the distant land is drawn beyond the property and its setting');assert(a.count>40000,'land with depth and relief');assert(Math.max(...radii)-Math.min(...radii)>1800,'terrain extends across sloping depth, not a vertical card');}}});assert.equal(ridges,1);
for(const root of [group,hedge])root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
console.log('Passed: three continuous garden hedges, finite landscape geometry and the distant land drawn beyond the setting.');
