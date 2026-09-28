import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/landscape-context.ts','lib/house-model/site-data.ts'],outdir:'tmp/setting-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external'});
const {landscapeContext,boundaryHedge}=await import('../tmp/setting-check/landscape-context.mjs');
const {plotOutline}=await import('../tmp/setting-check/site-data.mjs');
const hedge=boundaryHedge(),matrix=new T.Matrix4(),point=new T.Vector3(),runs=[[plotOutline[0],plotOutline[1]],[plotOutline[1],plotOutline[2]],[plotOutline[2],plotOutline[3]]];
const points=[];for(let i=0;i<hedge.count;i++){hedge.getMatrixAt(i,matrix);point.setFromMatrixPosition(matrix);points.push(point.clone());}
for(const [a,b] of runs){for(let t=.05;t<1;t+=.1){const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;assert(points.some(p=>Math.hypot(p.x-x,p.z-z)<1),'hedge continues on all three garden edges');}}
const {group}=landscapeContext();group.updateMatrixWorld(true);assert(group.getObjectByName('mature-roadside-avenue'));assert(group.getObjectByName('layered-park-woodland'));
let ridges=0;group.traverse(o=>{if(o instanceof T.Mesh){assert([...o.matrixWorld.elements].every(Number.isFinite));const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)assert(Number.isFinite(a.getX(i)+a.getY(i)+a.getZ(i)));if(o.userData.scenicBackdrop){ridges++;const box=new T.Box3().setFromObject(o);assert(box.min.x>70,'ridge geometry stays beyond property');assert(a.count>5000,'mountain slopes have genuine depth and relief');const radii=[];for(let j=0;j<a.count;j++)radii.push(Math.hypot(a.getX(j),a.getZ(j)));assert(Math.max(...radii)-Math.min(...radii)>70,'terrain extends across sloping depth, not a vertical card');assert(a.getY(0)<0&&a.getY(a.count-1)<0,'terrain edges end below grade');}}});assert.equal(ridges,3);
for(const root of [group,hedge])root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});
console.log('Passed: three continuous garden hedges, finite landscape geometry and distant ridges outside the lot with no exposed end walls.');
