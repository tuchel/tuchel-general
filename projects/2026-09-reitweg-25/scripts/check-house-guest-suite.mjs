import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
// The guest wing's upper floor as photographed: its roof frame stands under the west slope, not under the ridge.
await build({entryPoints:['lib/house-model/build-model.ts','lib/house-model/renovation-data.ts','lib/house-model/site-data.ts'],outdir:'tmp/guest-suite-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'error'});
const {buildHouseModel}=await import('../tmp/guest-suite-check/build-model.mjs');
const {renovationState}=await import('../tmp/guest-suite-check/renovation-data.mjs');
const {GUEST_FRAME}=await import('../tmp/guest-suite-check/site-data.mjs');
const model=buildHouseModel(true),root=model.root;model.setLevel('exterior');model.setRenovations(renovationState());root.updateMatrixWorld(true);
const roof=root.getObjectByName('guest-roof');assert(roof,'guest roof exists');
const parts=name=>{const list=[];roof.traverse(o=>{if(o.name===name)list.push({at:roof.worldToLocal(o.getWorldPosition(new T.Vector3())),size:o.scale});});return list;};
const posts=parts('guest-post'),ties=parts('guest-tie-beam'),purlin=parts('guest-purlin'),struts=parts('guest-strut');
assert.equal(posts.length,GUEST_FRAME.posts.length,'a post at each mark on the upper plan');
for(const {at,size} of posts){
 assert(Math.abs(at.x+GUEST_FRAME.offset)<.01,`post stands ${GUEST_FRAME.offset} m west of the ridge (${at.x.toFixed(2)} m)`);
 assert(Math.abs(at.y-size.y/2-3.1)<.01&&size.y>2.1&&size.y<2.5,`post rises from the upper floor to the purlin (${size.y.toFixed(2)} m)`);
}
assert.equal(purlin.length,1,'one purlin');assert(Math.abs(purlin[0].at.x+GUEST_FRAME.offset)<.01&&purlin[0].size.z>17,'the purlin runs the length of the wing over the posts');
assert.equal(ties.length,posts.length+1,'a tie beam at each post and one on the bedroom wall');
for(const {at,size} of ties){assert(Math.abs(at.x+size.x/2-GUEST_FRAME.east)<.01,'tie beam reaches the east wall');assert(at.y-size.y/2-3.1>2.1,`tie beam clears a head (${(at.y-size.y/2-3.1).toFixed(2)} m)`);}
assert.equal(struts.length,posts.length,'a raking strut at each post');
// Nothing of the frame stands or runs under the ridge: the only timber crossing it is the tie beams, overhead.
for(const {at,size} of [...posts,...purlin])assert(at.x+size.x/2<-.5,'posts and purlin keep west of the ridge');
for(const {at} of struts)assert(at.x<-1.5,'struts run down to the west');
console.log(`Passed: the guest wing's roof frame stands ${GUEST_FRAME.offset} m west of the ridge on ${posts.length} posts, with ${ties.length} tie beams to the east wall clear of a head and ${struts.length} raking struts; nothing stands under the ridge.`);
