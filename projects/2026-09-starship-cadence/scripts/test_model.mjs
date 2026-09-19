import assert from 'node:assert/strict';
import fs from 'node:fs';
import {defaults,rate,forecast} from '../dist/model.js';
const h=JSON.parse(fs.readFileSync(new URL('../dist/data/history.json',import.meta.url)));
assert.equal(h.flights.length,688);
assert(!h.flights.some(f=>f.id==='2016-E01'),'Amos-6 did not lift off');
assert(h.flights.some(f=>f.id==='2020-A04'),'In-flight abort is a flight');
assert(h.flights.some(f=>f.id==='2015-F02'),'CRS-7 failure is a flight');
assert.equal(h.annual.find(a=>a.year===2020).count,26);
assert.equal(h.annual.find(a=>a.year===2025).count,165);
assert.equal(h.starship.length,13);
assert.equal(h.flights.filter(f=>f.turnaroundDays!==null).length,602);
assert.equal(h.flights.find(f=>f.id==='2017-017').turnaroundDays,356.0719);
for(const f of h.flights.filter(f=>f.turnaroundDays!==null)){
 const prev=h.flights.find(p=>p.date===f.previousDate&&p.booster===f.booster);
 assert(prev);assert.equal(prev.boosterFlight+1,f.boosterFlight);
 assert(Math.abs((Date.parse(f.date)-Date.parse(prev.date))/86400000-f.turnaroundDays)<.000051);
}
assert(h.weekly.every(w=>new Date(w.date).getUTCDay()===1));
assert.equal(h.weekly.at(-1).date,'2026-09-07');
for(const p of Object.values(defaults)){
 const f=forecast(p,h);assert.equal(f.length,10);assert(Math.abs(f[0].annual-f[0].future-2)<1e-12);
 let cumulative=0;
 f.forEach((d,i)=>{cumulative+=d.future;assert(Math.abs(cumulative-d.cumulative)<1e-8);assert(d.annual>=0);assert(Number.isFinite(d.annual));assert(Math.abs(d.weekly*365.25/7-d.annual)<1e-8);if(i)assert(d.annual>=f[i-1].annual)});
 // Independent fine midpoint integral checks annual totals, including partial 2026.
 for(const d of f){const start=Math.max(d.year,h.cutoff),step=(d.year+1-start)/10000;let integral=0;for(let i=0;i<10000;i++)integral+=rate(start+(i+.5)*step,p,h).value*step;assert(Math.abs(integral-d.future)<Math.max(.02,d.future*.0001));}
 const lower=forecast({...p,uptime:p.uptime/2},h);assert(Math.abs(lower.at(-1).annual-f.at(-1).annual/2)<1e-6);
 const stopped=forecast({...p,uptime:0},h);assert.equal(stopped[0].annual,2);assert.equal(stopped.at(-1).cumulative,0);
}
for(let i=0;i<10;i++){assert(forecast(defaults.bearish,h)[i].annual<forecast(defaults.baseline,h)[i].annual);assert(forecast(defaults.baseline,h)[i].annual<forecast(defaults.bullish,h)[i].annual)}
console.log('PASS: launch scope, 602 interval pairs, complete weeks, integration, units, availability, observed/future boundary, scenario ordering.');
const {jamesMilestones,jamesRate,jamesForecast}=await import('../dist/model.js');
for(const p of jamesMilestones)assert(Math.abs(jamesRate(p.t,h)-p.annualRate)<1e-9,'Every James milestone must match exactly');
assert.equal(jamesRate(2036,h),365.25/1.5*32);
const jf=jamesForecast(h);
assert(jf.find(d=>d.year===2027).annual>12&&jf.find(d=>d.year===2027).annual<365.25/14);
assert(Math.abs(jf.find(d=>d.year===2027).annual-(365.25/14-12)/Math.log((365.25/14)/12))<1e-9);
for(let i=0;i<jf.length;i++){
 const d=jf[i];assert.equal(d.exitRate,jamesRate(d.year+1,h));
 const from=Math.max(d.year,h.cutoff),step=(d.year+1-from)/10000;let integral=0;
 for(let j=0;j<10000;j++)integral+=jamesRate(from+(j+.5)*step,h)*step;
 assert(Math.abs(integral-d.future)<.001);
 if(i)assert(Math.abs(d.cumulative-jf[i-1].cumulative-d.future)<1e-8);
}
assert(Math.abs(jamesRate(2029,h)*7/365.25-1)<1e-12,'End-2028 overlay is exactly one flight/week');
assert(Math.abs(jamesRate(2030,h)*7/365.25-2)<1e-12,'End-2029 overlay is exactly two flights/week');
console.log('PASS: James milestones, year-end conversion, annual doubling, exact integration, cumulative counts and overlay units.');
console.log('James annual launches:',jf.map(d=>[d.year,Math.round(d.annual)]));
