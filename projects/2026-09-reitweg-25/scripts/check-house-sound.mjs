import assert from 'node:assert/strict';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/garden-sound.ts'],outdir:'tmp/sound-check',outExtension:{'.js':'.mjs'},bundle:true,platform:'node',format:'esm'});
const {SPECIES,WIND,songOf,seeded}=await import('../tmp/sound-check/garden-sound.mjs');

// Ten minutes of the morning, as the scheduler plans it: each species sings at its own pace, in its own range.
const rand=seeded(7),minutes=10,phrases=Object.fromEntries(Object.keys(SPECIES).map(s=>[s,[]]));
for(const s of Object.keys(SPECIES)){let t=SPECIES[s].first(rand);while(t<minutes*60){phrases[s].push(songOf(s,t,rand));t+=SPECIES[s].gap(rand);}}
const perMinute=s=>phrases[s].length/minutes;
for(const [s,lo,hi] of [['blackbird',5,14],['chaffinch',3,9],['greatTit',2,7],['robin',2,8],['cuckoo',.5,3],['chirp',30,120]])
 assert(perMinute(s)>=lo&&perMinute(s)<=hi,`${s} sings ${perMinute(s).toFixed(1)} times a minute (${lo}–${hi})`);
// Birdsong stays in birds' register: 0.5–8 kHz, the cuckoo the only voice below 1.5 kHz; notes are short and never overlap within a phrase.
for(const [s,list] of Object.entries(phrases))for(const notes of list){
 let end=0;for(const n of notes){const lo=Math.min(n.f0,n.f1),hi=Math.max(n.f0,n.f1);
  assert(lo>=(s==='cuckoo'?480:1400)&&hi<=8000,`${s} note ${lo.toFixed(0)}–${hi.toFixed(0)} Hz`);
  assert(n.dur>.015&&n.dur<.5,`${s} note lasts ${n.dur.toFixed(3)} s`);assert(n.at>=end-1e-9,`${s} notes follow one another`);end=n.at+n.dur;}}
// The cuckoo calls from far off; the blackbird and great tit sing close by.
assert(phrases.cuckoo.every(p=>p.every(n=>n.far>=.7)),'the cuckoo is distant');
assert(phrases.blackbird.some(p=>p[0].far<.4),'a blackbird sings nearby');
// The wind is air and leaves, not a rumble: nothing below 150 Hz, the leaf rustle above 1.5 kHz, and both quiet.
assert(WIND.air.highpass>=150&&WIND.leaves.highpass>=1500,'no low rumble in the wind');
assert(WIND.air.gain[1]<=.06&&WIND.leaves.gain[1]<=.05,'the wind stays under the birds');
console.log(`Passed: a spring morning per minute — blackbird ${perMinute('blackbird').toFixed(1)}, chaffinch ${perMinute('chaffinch').toFixed(1)}, great tit ${perMinute('greatTit').toFixed(1)}, robin ${perMinute('robin').toFixed(1)}, distant cuckoo ${perMinute('cuckoo').toFixed(1)}; birdsong 0.5–8 kHz; wind with no energy below 150 Hz.`);
