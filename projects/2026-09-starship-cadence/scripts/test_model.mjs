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
