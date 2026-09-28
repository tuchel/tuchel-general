import assert from 'node:assert/strict';
import * as T from 'three';
import {build} from 'esbuild';
await build({entryPoints:['lib/house-model/sun-position.ts'],outfile:'tmp/sun-check.mjs',bundle:true,platform:'node',format:'esm'});
const {solarPosition,studyInstant,sunDirection}=await import('../tmp/sun-check.mjs');
// Fixtures independently evaluated with NOAA's published calculator main.js,
// using the address coordinates, UTC times and its apparent altitude correction.
for(const [iso,az,el] of [
 ['2026-06-21T11:00:00Z',170.8120817745317,65.36083643197202],
 ['2026-12-21T11:00:00Z',176.8800378082446,18.69062493578818],
 ['2026-03-20T07:00:00Z',108.6889894614029,16.061231106388846],
 ['2026-09-23T15:00:00Z',245.15750543492672,20.553030047172953],
 ['2026-12-21T23:00:00Z',352.7358591259851,-65.4347805468229]
]){const actual=solarPosition(new Date(iso));assert(Math.abs(actual.azimuth-az)<.001);assert(Math.abs(actual.apparentElevation-el)<.001);}
assert.equal(studyInstant(172,780).date.toISOString(),'2026-06-21T11:00:00.000Z');
assert.equal(studyInstant(355,780).date.toISOString(),'2026-12-21T12:00:00.000Z');
assert.equal(studyInstant(88,150).date.toISOString(),'2026-03-29T01:30:00.000Z');assert.equal(studyInstant(88,150).minutes,210);
assert.equal(studyInstant(298,150).date.toISOString(),'2026-10-25T00:30:00.000Z');assert(studyInstant(298,150).notice);
assert(Math.abs(sunDirection(97.5,0)[0]-1)<1e-10,'east roof bearing maps to +X');assert(sunDirection(0,0)[0]<0&&sunDirection(0,0)[2]<0,'true north matches plan compass');
console.log('Passed: five NOAA fixtures across seasons/day/night, CET/CEST including both transitions, and model north/east registration.');

await build({entryPoints:['lib/house-model/sun-lighting.ts'],outfile:'tmp/sun-lighting-check.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
const {sunLighting}=await import('../tmp/sun-lighting-check.mjs');
const root=new T.Group(),scene=new T.Scene(),sun=new T.DirectionalLight(),hemi=new T.HemisphereLight();scene.fog=new T.Fog('#dce4e2',150,340);const fog=scene.fog.color.clone();
const lighting=sunLighting(root,scene,sun,hemi,{shadowMap:{needsUpdate:false},toneMappingExposure:1});
lighting.apply({enabled:true,day:172,minutes:780});const direction=sun.position.clone().sub(sun.target.position).normalize(),reading=solarPosition(studyInstant(172,780).date);
assert(direction.distanceTo(new T.Vector3(...sunDirection(reading.azimuth,reading.apparentElevation)))<1e-10);assert(sun.intensity>3);
lighting.apply({enabled:true,day:355,minutes:0});assert.equal(sun.intensity,0);assert(scene.fog.color.r<.02);
lighting.apply({enabled:false,day:355,minutes:0});assert(scene.fog.color.equals(fog));assert.equal(scene.getObjectByName('calculated-sun-sky').visible,false);lighting.dispose();
console.log('Passed: renderer sun vector follows calculated angles, night has no direct sunlight, studio sky/fog restore.');

// Independent NOAA calculator event fixtures: local minutes, including both
// German clock-change days. NOAA solar noon and maximum altitude differ only
// by seconds at this latitude, so compare within one minute.
const {sunDayEvents}=await import('../tmp/sun-check.mjs');
for(const [day,rise,peak,set] of [[1,484.109,738.151,992.835],[79,378.060,742.421,1107.369],[88,419.690,799.721,1180.366],[172,315.850,796.541,1277.447],[265,421.335,787.761,1152.957],[298,408.547,718.927,1028.488],[355,481.190,732.645,984.590]]){
 const e=sunDayEvents(day);
 assert(Math.abs(e.sunrise.minutes-rise)<1,`sunrise day ${day}`);
 assert(Math.abs(e.peak.minutes-peak)<1,`peak day ${day}`);
 assert(Math.abs(e.sunset.minutes-set)<1,`sunset day ${day}`);
 assert(Math.abs(e.daylightMinutes-(set-rise))<1,`daylight day ${day}`);
}
for(let day=1;day<=365;day++){
 const e=sunDayEvents(day);assert(e.sunrise.minutes<e.peak.minutes&&e.peak.minutes<e.sunset.minutes);
 assert(Math.abs(solarPosition(e.sunrise.date).elevation+.833)<.005);
 assert(Math.abs(solarPosition(e.sunset.date).elevation+.833)<.005);
 assert(e.daylightMinutes>500&&e.daylightMinutes<970);
}
console.log('Passed: sunrise/peak/sunset NOAA fixtures, clock-change day lengths, and all 365 daily event orderings/horizon crossings.');
