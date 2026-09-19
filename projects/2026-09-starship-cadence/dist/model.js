// Pure, deterministic model. Years are decimal calendar years; rates are launches/year.
export const defaults = {
  bearish:{name:'Bearish',color:'#e5ab71',growth:1,delay:1.5,ceiling:120,fleet:8,turn:25,uptime:65,start:6},
  baseline:{name:'Baseline',color:'#62dccb',growth:1.65,delay:.75,ceiling:1500,fleet:30,turn:5,uptime:80,start:6},
  bullish:{name:'Bullish',color:'#afa0ff',growth:2.5,delay:.25,ceiling:10000,fleet:100,turn:1,uptime:90,start:6}
};
export function rate(t,p,h){
  const elapsed=Math.max(0,t-h.cutoff-p.delay);
  const end=Math.max(.01,2036-h.cutoff-p.delay);
  const progress=Math.min(1,elapsed/end);
  const k=h.cadenceFit.k*p.growth;
  const potential=p.ceiling/(1+(p.ceiling/p.start-1)*Math.exp(-k*elapsed));
  // Net flight-ready equivalents include replacement production; geometric transition ends Jan 1, 2036.
  const fleet=2*Math.pow(p.fleet/2,progress);
  const turn=h.stats.recentMedian*Math.pow(p.turn/h.stats.recentMedian,progress);
  const vehicleCapacity=365.25*fleet/turn;
  const ceiling=Math.min(potential,vehicleCapacity,p.ceiling);
  return {value:p.uptime/100*ceiling,potential,vehicleCapacity,fleet,turn,limit:vehicleCapacity<potential?'Vehicle availability':'Cadence ramp'};
}
export function forecast(p,h){
 const result=[];let cumulative=0;
 for(let year=2026;year<=2035;year++){
   const from=Math.max(year,h.cutoff),to=year+1,n=104,dt=(to-from)/n;
   let future=0;for(let i=0;i<n;i++)future+=rate(from+(i+.5)*dt,p,h).value*dt;
   const observed=year===2026?h.starship.filter(f=>f.date.startsWith('2026')).length:0;
   cumulative+=future;
   result.push({year,exitRate:rate(year+1,p,h).value,annual:future+observed,future,cumulative,weekly:(future+observed)/(365.25/7),...Object.fromEntries(Object.entries(rate(year+.5,p,h)).filter(([k])=>k!=='value'))});
 }
 return result;
}

export const james = {name:'James',color:'#72b8ff',post2030Growth:2};
// Boundary years: 2028 means the end of 2027/start of 2028.
export const jamesMilestones = [
 {t:2027,annualRate:12,label:'Going into 2027',cadence:'1 flight / month'},
 {t:2028,annualRate:365.25/14,label:'End of 2027',cadence:'1 flight / 14 days'},
 {t:2029,annualRate:365.25/7,label:'End of 2028',cadence:'1 flight / 7 days'},
 {t:2030,annualRate:365.25/3.5,label:'End of 2029',cadence:'1 flight / 3.5 days'},
 {t:2031,annualRate:365.25/1.5,label:'End of 2030',cadence:'1 flight / 1.5 days'}
];
export function jamesRate(t,h){
 const observed=h.starship.filter(f=>f.date.startsWith('2026')).length;
 const anchors=[{t:h.cutoff,annualRate:observed/(h.cutoff-2026)},...jamesMilestones];
 if(t>=2031)return jamesMilestones.at(-1).annualRate*james.post2030Growth**(t-2031);
 if(t<=h.cutoff)return anchors[0].annualRate;
 const i=anchors.findIndex(p=>p.t>=t),a=anchors[i-1],b=anchors[i];
 return a.annualRate*(b.annualRate/a.annualRate)**((t-a.t)/(b.t-a.t));
}
export function jamesForecast(h){
 let cumulative=0;
 return Array.from({length:10},(_,i)=>{
  const year=2026+i,from=Math.max(year,h.cutoff),r0=jamesRate(from,h),r1=jamesRate(year+1,h);
  // Exact integral of the log-linear rate within each calendar year.
  const future=(year+1-from)*(r1-r0)/Math.log(r1/r0);
  const observed=year===2026?h.starship.filter(f=>f.date.startsWith('2026')).length:0;
  cumulative+=future;
  return {year,annual:future+observed,future,cumulative,weekly:(future+observed)/(365.25/7),exitRate:r1};
 });
}
