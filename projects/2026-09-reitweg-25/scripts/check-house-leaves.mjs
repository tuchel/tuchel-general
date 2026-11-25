import assert from 'node:assert/strict';
import fs from 'node:fs';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/device-tier.ts','lib/house-model/foliage.ts'],outdir:'tmp/leaves-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.json':'json'}});
const {tiers,tierFor}=await import('../tmp/leaves-check/device-tier.mjs'),{LEAF_DETAIL,leafDetailGlsl,detailLeaves,foliageMaterials}=await import('../tmp/leaves-check/foliage.mjs');
const viewer=fs.readFileSync('lib/house-model/viewer.ts','utf8');

// Extreme on a computer only.
for(const q of ['detailed','balanced','model'])assert.equal(tiers[q].leafDetail,false,`${q} keeps plain leaves`);
assert.equal(tiers.extreme.leafDetail,true);assert.equal(tierFor('extreme',true,true).leafDetail,false,'not on a phone');
assert(/if\(tier\.leafDetail&&foliage\)detailLeaves\(foliage\);/.test(viewer));
// Only the modelled leaves take it, and only once.
const m=foliageMaterials();detailLeaves(m);detailLeaves(m);
const has=x=>(x.userData.shaderFeatures??[]).filter(f=>f.key==='leaf-detail').length;
assert.equal(has(m.close),1);assert.equal(has(m.solid),0);assert.equal(has(m.leaves),0);assert.equal(has(m.bark),0);
// Where on its blade each of a leaf's twelve vertices lies, read from the vertex's number: no attribute is stored.
// Across (-1 to 1), along (0 at the stalk, 1 at the tip); the three corners of each of the four triangles.
const at=[...leafDetailGlsl.vertex.matchAll(/vec2\((-?[\d.]+),(-?[\d.]+)\)/g)].map(a=>[+a[1],+a[2]]);
assert.equal(at.length,12);assert(/gl_VertexID%12/.test(leafDetailGlsl.vertex));
assert.deepEqual(at.slice(0,3),[[0,0],[-1,.42],[0,.5]],'the first triangle: stalk, left corner, the rib');
assert.equal(at.filter(([x])=>x===0).length,8,'eight of twelve corners lie on the rib');assert.equal(at.filter(([,y])=>y===1).length,2,'the tip closes two triangles');
// The rib and veins are paler than the blade, a leaf turns its own two faces to the light, and its upper face has a
// sheen; all of it fades out before a leaf is a few pixels long, so a far crown is as it was.
assert(LEAF_DETAIL.vein>0&&LEAF_DETAIL.vein<.5&&LEAF_DETAIL.face>0&&LEAF_DETAIL.face<=.7&&LEAF_DETAIL.sheen<.78&&LEAF_DETAIL.sheen>=.4);
assert(leafDetailGlsl.near.includes(`1.0-smoothstep(${(LEAF_DETAIL.fades[0]).toFixed(2)},${(LEAF_DETAIL.fades[1]).toFixed(2)},`)&&LEAF_DETAIL.fades[1]<=.5,'gone before a leaf is two pixels long');
assert(/cross\(dFdx\(vViewPosition\),dFdy\(vViewPosition\)\)/.test(leafDetailGlsl.normal)&&/if\(dot\(leafFace,normal\)<0\.0\)leafFace=-leafFace;/.test(leafDetailGlsl.normal),'the face is turned to the side the leaf is lit from');
// A leaf's outline: the blade's two side corners are rounded off and its margin toothed, by coverage, never wider than
// the blade that is drawn. The same arithmetic as the shader's.
const blade=v=>v<.42?v/.42:(1-v)/.58,width=v=>Math.min(blade(v),LEAF_DETAIL.shoulder-LEAF_DETAIL.round*(v-.44)**2)-LEAF_DETAIL.tooth*Math.abs((v*LEAF_DETAIL.teeth)%1-.5)*2;
for(let v=0;v<=1;v+=.01)assert(width(v)<=blade(v)+1e-9,'inside the blade');
assert(width(.44)<.85&&width(.44)>.6,'the corners are rounded off');assert(Math.abs(width(.1)-blade(.1))<=LEAF_DETAIL.tooth,'the base keeps its wedge');
assert(leafDetailGlsl.colour.includes(`min(leafBlade,${LEAF_DETAIL.shoulder.toFixed(2)}-${LEAF_DETAIL.round.toFixed(1)}*(vLeaf.y-0.44)*(vLeaf.y-0.44))-${LEAF_DETAIL.tooth.toFixed(2)}*abs(fract(vLeaf.y*${LEAF_DETAIL.teeth.toFixed(1)})-0.5)*2.0`)&&/diffuseColor\.a\*=mix\(1\.0,/.test(leafDetailGlsl.colour));
assert.equal(m.close.alphaToCoverage,true);assert.equal(m.leaves.alphaToCoverage,true);
// Edges smoothed by coverage keep a graphics card from skipping the leaves hidden behind others, so only trees near
// enough for the detail to show are drawn with it: the rest keep the plain leaves, which look the same from there.
assert.equal(m.solid.alphaToCoverage,false);assert.equal(m.close.userData.detailed,true);
const {LEAF_CLOSE}=await import('../tmp/leaves-check/foliage.mjs'),source=fs.readFileSync('lib/house-model/foliage.ts','utf8');
assert(Math.abs(LEAF_CLOSE-1/LEAF_DETAIL.fades[1])<1e-9,'from where the detail starts to show');
assert(/fine=!!set\.close&&!!\(set\.close\.material as T\.Material\)\.userData\.detailed/.test(source)&&/else if\(fine&&size>=LEAF_CLOSE\)close\.push\(i\);/.test(source)&&/close\.name='tree-leaves-close'/.test(source));
console.log('Passed: in Extreme on a computer, a modelled leaf seen close has a leaf\'s outline, a pale rib and veins, catches the light on its own two faces and has a sheen; far crowns are unchanged.');
