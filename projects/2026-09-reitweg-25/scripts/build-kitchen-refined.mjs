import {writeFileSync,readFileSync} from 'node:fs';
import sharp from 'sharp';
// Adapt the proven source-coordinate builder without changing its historical assets.
let code=readFileSync(new URL('./build-kitchen-volume.mjs',import.meta.url),'utf8');
code=code.replace("const layouts=[", "const previousLayouts=[");
const start=code.indexOf('const label=');
const custom=`const layouts=[{slug:'kitchen-garden-breakfast-v4',title:'The garden kitchen',zones:['A · garden dining, table runs north–south','B · breakfast stools at the new L return','C · wider cooking aisle, island seating and storage'],change:'Keep the cooker east; add a low north return with a second oven.',objects:[
 counter(566,432,54,70),range(566,518,54,99),counter(566,632,54,32),
 box(566,333,54,99,158,'#bba685','pantry'),counter(426,333,140,49),box(490,333,45,49,57,'#687268','second oven'),
 island(375,467,82,190),seat(381,683,29,29),seat(423,683,29,29),
 dining(156,328,70,220),...[340,417,494].flatMap(y=>[seat(117,y),seat(240,y)]),seat(178,288),seat(178,561),
 seat(440,287,30,30),seat(505,287,30,30)
 ]}];\n`;
code=code.slice(0,start)+custom+code.slice(start);
code=code.replace("new URL('../public/assets/',import.meta.url)", "new URL('../public/assets/',import.meta.url)");
code=code.replace("'kitchen-abc-layouts.json'", "'kitchen-refined-layout-v4.json'");
code=code.replace("label(70,970,'Openings, supports and furniture fit need verification.',15)","label(70,970,'Aisle target 1.3–1.4 m; stools, oven and clearances need a survey.',15)");
code=code.replace("'Green = confirmed envelope · Rust dashes = proposed opening'","'Green = confirmed outline · Rust dashes = proposed openings'");
// Add a clear aisle annotation, distinguishing a target from measured geometry.
code=code.replace("s+=label(63,421,'A',24)","s+=`<path d=\"M457 600H566M457 591V609M566 591V609\" stroke=\"#a34b31\" stroke-width=\"2\"/>${label(468,585,'Wider aisle',12)}${label(429,274,'Breakfast stools',13)}${label(392,746,'Island stools',14)}${label(435,410,'L return + oven',13)}`;s+=label(63,421,'A',24)");
// Evaluate as a sibling module so imports and output paths remain stable.
const generated=new URL('./.kitchen-refined-generated.mjs',import.meta.url);writeFileSync(generated,code);await import(generated.href+'?'+Date.now());
const {unlinkSync}=await import('node:fs');unlinkSync(generated);
