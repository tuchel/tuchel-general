import {readFileSync,writeFileSync} from 'node:fs';

// Coordinates are pixels in the 216 dpi PDF p19 crop (x60,y70,w750,h880).
// Shared source geometry; never rescale an individual wing for a layout.
const assets=new URL('../public/assets/',import.meta.url);
const source=readFileSync(new URL('kitchen-source-inset.png',assets)).toString('base64');
const extent='M334 716H104V126H626V275';
const floor='M104 126H626V275H310V332H334V716H104Z';
const pin=(x,y,t,color='#247553')=>`<circle cx="${x}" cy="${y}" r="18" fill="${color}"/><text x="${x}" y="${y+7}" text-anchor="middle" font-size="21" fill="white">${t}</text>`;
const chair=(x,y,w=28,h=25)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7" fill="#e9dcc8" stroke="#9b8469" stroke-width="2"/>`;
const table=(x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="#ccb08e" stroke="#886f53" stroke-width="2"/>`;
function shell(body,title){return `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="900" viewBox="0 0 750 900"><title>${title}</title><rect width="750" height="900" fill="#faf9f5"/><g font-family="Arial,sans-serif">${body}</g></svg>`;}
const edge=`<path d="${extent}" fill="none" stroke="#247553" stroke-width="5"/>`;
const common=`<path d="${floor}" fill="#e1e9dc"/><path d="M377 317H620V664H639V809H377Z" fill="#ece7de"/><g fill="#727872"><path d="M310 275H434V317H377V463H334V332H310Z"/><path d="M516 275H639V664H620V317H516Z"/><path d="M334 667H377V758H418V809H334Z"/><path d="M478 799H603V809H478Z"/></g><g fill="none" stroke="#777f76" stroke-width="2"><path d="M434 284H516M434 293H516M341 463V667M350 463V667"/><path d="M377 758H418M478 758H603"/></g>${edge}<path d="M104 716H334" stroke="#247553" stroke-width="5"/><g fill="#b6c3ac">${[175,249,324,400,476,551].map(x=>`<rect x="${x}" y="122" width="6" height="8"/>`).join('')}</g><rect x="566" y="518" width="54" height="99" fill="#eeeae3" stroke="#7b766b" stroke-width="2"/>${[537,565,593].map(y=>`<circle cx="583" cy="${y}" r="8" fill="none" stroke="#7b766b"/><circle cx="605" cy="${y}" r="8" fill="none" stroke="#7b766b"/>`).join('')}<rect x="566" y="350" width="54" height="153" fill="#a9b29c"/><rect x="566" y="632" width="54" height="32" fill="#a9b29c"/><rect x="440" y="469" width="68" height="198" rx="2" fill="#c5b18e" stroke="#8c7a5d" stroke-width="2"/><rect x="474" y="590" width="27" height="27" fill="#ecebe3" stroke="#8c7a5d"/>`;
const heading=`<text x="104" y="88" font-size="20" fill="#247553">NORTH RETURN · B</text><text x="104" y="848" font-size="17" fill="#647065">Source proportions · furniture fit remains to be checked</text>`;
const original=`<defs><clipPath id="source-crop"><rect width="645" height="880"/></clipPath></defs><image href="data:image/png;base64,${source}" width="750" height="880" clip-path="url(#source-crop)"/><path d="${floor}" fill="#247553" fill-opacity=".14"/>${edge}${pin(245,523,'A')}${pin(410,193,'B')}${pin(484,702,'C','#61716a')}${pin(689,565,'D','#a65737')}<path d="M670 565H603" stroke="#a65737" stroke-width="2"/>`;
writeFileSync(new URL('kitchen-confirmed-footprint.svg',assets),shell(original,'Confirmed A+B footprint traced on the original exposé inset'));
// Option 1: table and independent chairs in A; open passage along its east edge.
const dining1=table(169,340,70,220)+[350,430,510].map(y=>chair(128,y)+chair(252,y)).join('')+chair(191,302)+chair(191,574);
const lounge1=chair(394,171,53,56)+chair(544,171,53,56)+`<circle cx="496" cy="200" r="23" fill="#d7c9b3" stroke="#9b8469" stroke-width="2"/>`;
writeFileSync(new URL('kitchen-west-table.svg',assets),shell(common+dining1+lounge1+heading+pin(285,635,'A')+pin(532,713,'C','#61716a')+`<text x="398" y="389" font-size="18" fill="#647065">Prep / storage</text>`,'Layout 1: freestanding dining table in west wing; sitting area in north return'));
// Option 2: west-side banquette + shorter table; north is a quiet reading edge.
const dining2=`<rect x="116" y="309" width="38" height="270" rx="6" fill="#a8b294" stroke="#6a7c5d" stroke-width="2"/>`+table(169,353,70,178)+[362,426,490].map(y=>chair(251,y)).join('');
const lounge2=`<rect x="361" y="149" width="203" height="38" rx="7" fill="#a8b294" stroke="#6a7c5d" stroke-width="2"/><rect x="446" y="213" width="74" height="31" rx="9" fill="#d7c9b3" stroke="#9b8469"/>`;
writeFileSync(new URL('kitchen-west-banquette.svg',assets),shell(common+dining2+lounge2+heading+pin(285,635,'A')+pin(532,713,'C','#61716a')+`<text x="398" y="389" font-size="18" fill="#647065">Prep / storage</text>`,'Layout 2: garden banquette in west wing; reading bench in north return'));
