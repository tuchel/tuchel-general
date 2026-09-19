import {defaults,rate,forecast,james,jamesMilestones,jamesRate,jamesForecast} from './model.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const fmt=(v,d=0)=>Number(v).toLocaleString('en-US',{maximumFractionDigits:d,minimumFractionDigits:d});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dates=s=>new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
let H,scenarios=structuredClone(defaults),active='james',unit='annual',page=0,forecasts={};
const descriptions={bearish:'Slow qualification, persistent downtime, and a limited fleet keep the ramp close to Falcon’s pace.',baseline:'Faster learning and multi-day reuse support a larger fleet, with operating constraints still material.',bullish:'Rapid full reuse, major infrastructure expansion, and sustained demand unlock a much steeper ramp.'};
const controls=[
 {key:'growth',label:'Learning speed',min:.5,max:3,step:.05,suffix:'× F9',low:'0.5× · slower than Falcon',high:'3× · accelerated learning'},
 {key:'delay',label:'Delay before ramp',min:0,max:4,step:.25,suffix:'years',low:'0 · ramp begins now',high:'4 · waits until 2030'},
 {key:'ceiling',label:'Long-run launch ceiling',min:25,max:15000,step:25,suffix:'/ year',low:'25 · constrained network',high:'15,000 · global network'},
 {key:'fleet',label:'Flight-ready fleet by 2036',min:2,max:150,step:1,suffix:'pairs',low:'2 · small test fleet',high:'150 · industrial fleet',advanced:true},
 {key:'turn',label:'Turnaround by 2036',min:1,max:60,step:1,suffix:'days',low:'1 · daily reflight',high:'60 · two-month cycle',advanced:true},
 {key:'uptime',label:'Operating availability',min:30,max:100,step:1,suffix:'%',low:'30% · frequent interruptions',high:'100% · no downtime',advanced:true},
 {key:'start',label:'Initial potential cadence',min:2,max:25,step:1,suffix:'/ year',low:'2 · current test pace',high:'25 · aggressive start',advanced:true}
];
function inputMarkup(c){let p=scenarios[active];return `<div class="input-group"><div class="input-top"><label for="range-${c.key}">${c.label}</label><span class="input-value"><input id="number-${c.key}" aria-label="${c.label}, numeric value" type="number" min="${c.min}" max="${c.max}" step="${c.step}" value="${p[c.key]}"><small>${c.suffix}</small></span></div><input id="range-${c.key}" aria-label="${c.label}" aria-describedby="bounds-${c.key}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${p[c.key]}"><div class="bounds" id="bounds-${c.key}"><span>${c.low}</span><span>${c.high}</span></div></div>`}
function renderControls(){
 const isJames=active==='james';
 $('#reset').hidden=isJames;$('.advanced').hidden=isJames;
 $$('[data-case]').forEach(b=>{b.classList.toggle('active',b.dataset.case===active);b.setAttribute('aria-pressed',b.dataset.case===active)});
 if(isJames){
  $('#case-description').textContent='Your cadence milestones, with acceleration between each year-end target.';
  $('#inputs').innerHTML=`<dl class="james-milestones">${jamesMilestones.map(p=>`<div><dt>${p.label}</dt><dd>${p.cadence}</dd></div>`).join('')}</dl><p class="james-extension"><b>2031–2035 · annual doubling</b><br>Dashed extension beyond your last dated target.</p><p class="fine">Annual totals integrate the ramp. Use Exit rate to see year-end cadence as launches/year.</p>`;
  $('#advanced-inputs').innerHTML='';return;
 }
 $('#case-description').textContent=descriptions[active];$('#inputs').innerHTML=controls.filter(c=>!c.advanced).map(inputMarkup).join('');$('#advanced-inputs').innerHTML=controls.filter(c=>c.advanced).map(inputMarkup).join('');
 controls.forEach(c=>['range','number'].forEach(kind=>{$(`#${kind}-${c.key}`).addEventListener('input',e=>{if(e.target.value==='')return;const v=Number(e.target.value);if(!Number.isFinite(v)||v<c.min||v>c.max)return;scenarios[active][c.key]=v;$(`#${kind==='range'?'number':'range'}-${c.key}`).value=v;renderForecast();});$(`#${kind}-${c.key}`).addEventListener('change',()=>{$(`#${kind}-${c.key}`).value=scenarios[active][c.key]});}));
 $$('[data-case]').forEach(b=>{b.classList.toggle('active',b.dataset.case===active);b.setAttribute('aria-pressed',b.dataset.case===active)});
}
const NS='http://www.w3.org/2000/svg';
function el(tag,attrs={},text){const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e}
function chart(id,{xmin,xmax,ymax,ticks,xticks,log=false,label=''}){
 const host=$(id),W=host.clientWidth||600,HH=host.clientHeight||300;const pad={l:45,r:20,t:22,b:34},w=W-pad.l-pad.r,h=HH-pad.t-pad.b;
 const svg=el('svg',{viewBox:`0 0 ${W} ${HH}`,width:W,height:HH,role:'img','aria-label':host.getAttribute('aria-label')});host.replaceChildren(svg);
 const X=v=>pad.l+(v-xmin)/(xmax-xmin)*w;const Y=v=>pad.t+h-h*(log==='log1p'?Math.log1p(Math.max(0,v))/Math.log1p(ymax):log?(Math.log10(Math.max(.1,v))+1)/(Math.log10(ymax)+1):v/ymax);
 ticks.forEach(v=>{const y=Y(v);svg.append(el('line',{x1:pad.l,x2:W-pad.r,y1:y,y2:y,stroke:'#2a3745','stroke-width':.6}));svg.append(el('text',{x:pad.l-10,y:y+4,'text-anchor':'end',fill:'#9aacbd','font-size':12},v>=1000?`${fmt(v/1000,Number.isInteger(v/1000)?0:2)}k`:fmt(v,v>0&&v<1?1:0)))});
 xticks.forEach(v=>svg.append(el('text',{x:X(v),y:HH-8,'text-anchor':'middle',fill:'#9aacbd','font-size':12},String(v))));
 if(label)svg.append(el('text',{x:pad.l,y:12,fill:'#9aacbd','font-size':12},label));
 return {host,svg,W,HH,X,Y,pad,w,h};
}
function path(c,pts,color,width=2,dash='',opacity=1){const d=pts.map((p,i)=>`${i?'L':'M'}${c.X(p.x).toFixed(2)},${c.Y(p.y).toFixed(2)}`).join(' ');c.svg.append(el('path',{d,fill:'none',stroke:color,'stroke-width':width,'stroke-dasharray':dash,opacity,'stroke-linejoin':'round'}))}
function area(c,low,high,color,opacity=.12){const pts=[...low,...high.toReversed()],d=pts.map((p,i)=>`${i?'L':'M'}${c.X(p.x)},${c.Y(p.y)}`).join(' ')+'Z';c.svg.append(el('path',{d,fill:color,opacity}))}
function tooltip(event,html,host){const tip=$('#tooltip');tip.innerHTML=html;tip.hidden=false;const rect=host.getBoundingClientRect();const cx=event.clientX??rect.left+rect.width/2,cy=event.clientY??rect.top+90;tip.style.left=Math.min(Math.max(8,cx+14),window.innerWidth-tip.offsetWidth-10)+'px';tip.style.top=Math.min(Math.max(8,cy+14),window.innerHeight-tip.offsetHeight-10)+'px'}
function interactions(c,items,html){
 const line=el('line',{y1:c.pad.t,y2:c.HH-c.pad.b,stroke:'#637d93','stroke-dasharray':'3 4',visibility:'hidden'});c.svg.append(line);
 const rect=el('rect',{x:c.pad.l-6,y:c.pad.t,width:c.w+12,height:c.h,fill:'transparent'});c.svg.append(rect);
 let selected=0;const show=(i,e)=>{selected=Math.max(0,Math.min(items.length-1,i));const p=items[selected];line.setAttribute('x1',c.X(p.x));line.setAttribute('x2',c.X(p.x));line.setAttribute('visibility','visible');tooltip(e,html(p),c.host)};
 rect.addEventListener('pointermove',e=>{const r=c.svg.getBoundingClientRect(),x=(e.clientX-r.left)*c.W/r.width;let idx=0;items.forEach((p,i)=>{if(Math.abs(c.X(p.x)-x)<Math.abs(c.X(items[idx].x)-x))idx=i});show(idx,e)});
 c.host.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();show(selected+(e.key==='ArrowRight'?1:-1),{})}if(e.key==='Escape'){$('#tooltip').hidden=true;line.setAttribute('visibility','hidden')}};
 c.host.onpointerleave=()=>{$('#tooltip').hidden=true;line.setAttribute('visibility','hidden')};c.host.onblur=c.host.onpointerleave;
}
function niceMax(v){if(v<=5)return 5;const p=10**Math.floor(Math.log10(v));return Math.ceil(v/p)*p}
function renderForecast(){
 Object.keys(scenarios).forEach(k=>forecasts[k]=forecast(scenarios[k],H));
 forecasts.james=jamesForecast(H);const labels={...scenarios,james};
 const series=Object.values(forecasts),max=niceMax(Math.max(...series.flatMap(s=>s.map(p=>p[unit])))*1.06),log=$('#log-scale').checked;
 let ticks=Array.from({length:5},(_,i)=>i*max/4);if(log){ticks=[];for(let v=.1;v<=max;v*=10)ticks.push(v)}
 const c=chart('#forecast-chart',{xmin:2026,xmax:2035.35,ymax:max,ticks,xticks:window.innerWidth<600?[2026,2028,2030,2032,2035]:[2026,2027,2028,2029,2030,2031,2032,2033,2034,2035],log});
 const envelope=Object.keys(scenarios).map(k=>forecasts[k]);
 const min=series[0].map((p,i)=>({x:p.year,y:Math.min(...envelope.map(s=>s[i][unit]))})),maxs=series[0].map((p,i)=>({x:p.year,y:Math.max(...envelope.map(s=>s[i][unit]))}));area(c,min,maxs,'#829bc4',.09);
 for(const [key,data]of Object.entries(forecasts)){const p=labels[key];if(key==='james'){path(c,data.filter(d=>d.year<=2030).map(d=>({x:d.year,y:d[unit]})),p.color,3);path(c,data.filter(d=>d.year>=2030).map(d=>({x:d.year,y:d[unit]})),p.color,3,'7 5');}else{path(c,data.map(d=>({x:d.year,y:d[unit]})),p.color,key==='baseline'?3:2,key==='bearish'?'5 4':'');}const last=data.at(-1);c.svg.append(el('circle',{cx:c.X(last.year),cy:c.Y(last[unit]),r:4,fill:p.color}));}
 interactions(c,forecasts.baseline.map(d=>({x:d.year,...d})),p=>`<strong>${p.year} · ${unit==='weekly'?'average flights / week':unit==='cumulative'?'cumulative future launches':unit==='exitRate'?'year-end rate · launches / year':'launches / year'}</strong>${Object.entries(forecasts).map(([k,rows])=>`<div class="tip-row" style="color:${labels[k].color}"><span>${labels[k].name}</span><b>${fmt(rows.find(x=>x.year===p.year)[unit],unit==='weekly'?2:1)}</b></div>`).join('')}<small>${p.year===2026?'2026 includes 2 observed flights; cumulative excludes them.':'Model output · editable assumptions'}<br>James exits ${p.year} at ${fmt(jamesRate(p.year+1,H),1)} launches/year (${fmt(365.25/jamesRate(p.year+1,H),2)} days apart).${p.year>2030?' Annual-doubling extension.':''}<br>Shading excludes James; no assigned probability.</small>`);
 $('#chart-subtitle').textContent=unit==='annual'?'Annual launches · full-stack flight attempts':unit==='weekly'?'Average flights / week · annual total ÷ 52.18':unit==='exitRate'?'Year-end cadence · annualized launches / year':'Cumulative launches · September 19, 2026–year end';
 $('#outcomes').innerHTML=Object.entries(forecasts).map(([k,rows])=>`<div class="outcome"><span class="label ${k}">${labels[k].name.toUpperCase()} · 2035</span><strong>${fmt(rows.at(-1).annual)}</strong><small>${fmt(rows.at(-1).weekly,1)} flights / week</small></div>`).join('');
 $('#forecast-table').innerHTML=`<table class="forecast-table"><thead><tr><th>Launches / year</th>${forecasts.baseline.map(d=>`<th>${d.year}${d.year===2026?'*':''}</th>`).join('')}</tr></thead><tbody>${Object.entries(forecasts).map(([k,rows])=>`<tr><td class="${k}">${labels[k].name}</td>${rows.map(d=>`<td>${fmt(d.annual)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
 if(active==='james'){$('#constraint').innerHTML=`2035 exit rate: <b>${fmt(jamesRate(2036,H))} launches/year</b>.<br>${fmt(365.25*24/jamesRate(2036,H),2)} hours between flights. Annual doubling is an extrapolation.`;}else{const p=scenarios[active],end=rate(2035.5,p,H);$('#constraint').innerHTML=`2035 limiting factor: <b>${end.limit.toLowerCase()}</b>.<br>${fmt(p.growth,2)}× Falcon learning · ${fmt(p.uptime)}% operating availability.`;}
 if($('#cadence-chart').querySelector('svg'))renderCadence();
 $('#scenario-cards').innerHTML=Object.entries(scenarios).map(([k,p])=>`<article class="scenario-card" style="--scenario:${p.color}"><h3>${p.name}</h3><p>${descriptions[k]}</p><dl><dt>Learning vs. Falcon</dt><dd>${fmt(p.growth,2)}×</dd><dt>Ramp delay</dt><dd>${fmt(p.delay,2)} yr</dd><dt>Long-run ceiling</dt><dd>${fmt(p.ceiling)} / yr</dd><dt>Fleet by 2036</dt><dd>${p.fleet} pairs</dd><dt>Turnaround by 2036</dt><dd>${p.turn} ${p.turn===1?'day':'days'}</dd><dt>Operating availability</dt><dd>${p.uptime}%</dd><dt>Initial potential rate</dt><dd>${p.start} / yr</dd><dt>2035 annual output</dt><dd>${fmt(forecasts[k].at(-1).annual)}</dd></dl></article>`).join('');
}
function renderCadence(){
 const selected=$$('[data-overlay]:checked').map(input=>input.dataset.overlay);
 const enabled=selected.length>0,aligned=enabled&&$('#overlay-alignment').value==='age',log=enabled&&$('#overlay-log').checked;
 $('#overlay-alignment').disabled=!enabled;$('#overlay-log').disabled=!enabled;
 const labels={...scenarios,james};
 const weeklyRate=(key,t)=>(key==='james'?jamesRate(t,H):rate(t,scenarios[key],H).value)*7/365.25;
 const overlay=Object.fromEntries(selected.map(key=>[key,Array.from({length:225},(_,i)=>{const t=H.cutoff+(2036-H.cutoff)*i/224;return {x:aligned?t-2023:t,y:weeklyRate(key,t),t};})]));
 const ymax=enabled?niceMax(Math.max(6,...Object.values(overlay).flatMap(points=>points.map(p=>p.y)))*1.06):6;
 const ticks=log?[0,1,10,100,1000].filter(t=>t<=ymax):enabled?Array.from({length:5},(_,i)=>i*ymax/4):[0,1,2,3,4,5,6];
 const xmin=aligned?0:2010,xmax=aligned?17:enabled?2036:2027;
 const c=chart('#cadence-chart',{xmin,xmax,ymax,ticks,xticks:aligned?[0,4,8,12,16]:enabled?[2010,2015,2020,2025,2030,2035]:[2010,2014,2018,2022,2026],log:log?'log1p':false,label:'Flights / week'});
 const fX=x=>aligned?x-2010:x;
 path(c,H.weekly.map(w=>({x:fX(w.x),y:w.count})),'#748599',.8,'',.35);
 path(c,H.weekly.map(w=>({x:fX(w.x),y:w.smoothed})),'#62dccb',2,'',enabled?.4:1);
 path(c,H.cadenceFit.points.filter(p=>p.x<=H.cutoff).map(p=>({x:fX(p.x),y:p.y})),'#edf2f7',2,'5 5');
 for(const [key,points]of Object.entries(overlay)){
  if(key==='james'){
   const pivot={t:2031,x:aligned?8:2031,y:weeklyRate(key,2031)};
   path(c,[...points.filter(p=>p.t<2031),pivot],james.color,2.6);
   path(c,[pivot,...points.filter(p=>p.t>2031)],james.color,2.6,'7 5');
  }else path(c,points,labels[key].color,2.4,key==='bearish'?'5 4':'');
 }
 $('#overlay-note').textContent=enabled?`${aligned?'Years since debut year: Falcon 9 = 2010; Starship = 2023.':'Calendar years; Starship projections begin September 2026.'} Same flights/week units. ${log?'Log(1 + rate) scale preserves zero-launch weeks. ':'Linear scale. '}Overlays show modeled operating rates, not annual averages. James is dashed after 2030.`:'Enable any Starship curve to compare it with Falcon. Overlays use the current scenario assumptions.';
 if(!enabled){interactions(c,H.weekly,p=>`<strong>Week of ${dates(p.date)}</strong><div class="tip-row"><span>Actual liftoffs</span><b>${p.count}</b></div><div class="tip-row"><span>13-week average</span><b>${fmt(p.smoothed,2)}</b></div><div class="tip-row"><span>Fitted S-curve</span><b>${fmt(H.cadenceFit.ceiling/(1+Math.exp(-H.cadenceFit.k*(p.x-H.cadenceFit.midpoint))),2)}</b></div><small>Source: GCAT · Monday–Sunday UTC</small>`);return;}
 const inspect=Array.from({length:Math.round((xmax-xmin)*12)+1},(_,i)=>({x:xmin+i/12}));
 interactions(c,inspect,p=>{
  const falconYear=aligned?p.x+2010:p.x,starshipYear=aligned?p.x+2023:p.x;
  const fitted=falconYear<=H.cutoff?H.cadenceFit.ceiling/(1+Math.exp(-H.cadenceFit.k*(falconYear-H.cadenceFit.midpoint))):null;
  return `<strong>${aligned?`${fmt(p.x,1)} years after debut year`:fmt(p.x,2)} · flights/week</strong><div class="tip-row"><span>Falcon fitted</span><b>${fitted===null?'Outside history':fmt(fitted,2)}</b></div>${selected.map(key=>`<div class="tip-row" style="color:${labels[key].color}"><span>${labels[key].name}</span><b>${starshipYear<H.cutoff||starshipYear>2036?'Outside forecast':fmt(weeklyRate(key,starshipYear),2)}</b></div>`).join('')}<small>${aligned?`Falcon year ≈ ${fmt(falconYear,1)} · Starship year ≈ ${fmt(starshipYear,1)}<br>`:''}Falcon: GCAT fit. Starship: scenario model.${starshipYear>2031&&selected.includes('james')?' James uses annual doubling.':''}</small>`;
 });
}
function renderEvidence(){
 renderCadence();
 let c;
 const ymax=niceMax(Math.max(...H.quarterly.map(q=>q.p90))*1.06);
 c=chart('#reuse-chart',{xmin:2017,xmax:2027,ymax,ticks:[0,100,200,300,400].filter(t=>t<=ymax),xticks:[2017,2019,2021,2023,2025,2027],label:'Days between same-booster flights'});
 area(c,H.quarterly.map(q=>({x:q.x,y:q.p10})),H.quarterly.map(q=>({x:q.x,y:q.p90})),'#afa0ff',.12);
 path(c,H.reuseFit.points.filter(p=>p.x<=H.cutoff),'#edf2f7',2,'5 5');
 H.quarterly.forEach(q=>c.svg.append(el('circle',{cx:c.X(q.x),cy:c.Y(q.median),r:q.n>=3?3.7:3,fill:q.n>=3?'#afa0ff':'#101924',stroke:'#afa0ff','stroke-width':1.5})));
 interactions(c,H.quarterly,p=>`<strong>${p.year} · Q${p.quarter}${p.year===2026&&p.quarter===3?' (partial)':''}</strong><div class="tip-row"><span>Median interval</span><b>${fmt(p.median,1)} days</b></div><div class="tip-row"><span>10th–90th percentile</span><b>${fmt(p.p10)}–${fmt(p.p90)} days</b></div><div class="tip-row"><span>Paired flights</span><b>${p.n}</b></div><small>Source: GCAT · calculated launch-to-launch time.${p.n<3?' Excluded from fit: fewer than 3 pairs.':''}${p.year===2026&&p.quarter===3?' Partial quarter excluded from fit.':''}</small>`);
}
function renderLedger(){const year=$('#year-filter').value,paired=$('#reuse-filter').value==='paired',q=$('#search').value.trim().toLowerCase();const rows=H.flights.filter(f=>(year==='all'||String(f.year)===year)&&(!paired||f.turnaroundDays!==null)&&`${f.mission} ${f.booster||''} ${f.date}`.toLowerCase().includes(q)).toReversed();const pages=Math.max(1,Math.ceil(rows.length/12));page=Math.min(page,pages-1);$('#ledger-body').innerHTML=rows.slice(page*12,page*12+12).map(f=>`<tr><td>${esc(dates(f.date))}<br><span class="muted">${f.date.slice(11,19)}</span></td><td>${esc(f.mission)}</td><td>${esc(f.booster||'Unknown')}</td><td>${f.boosterFlight??'—'}</td><td>${f.turnaroundDays?`${fmt(f.turnaroundDays,2)} days`:'—'}</td><td class="muted">${esc(f.pad)}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">No flights match these filters.</td></tr>';$('#ledger-count').textContent=`${fmt(rows.length)} flights`;$('#page-status').textContent=`${page+1} / ${pages}`;$('#prev').disabled=page===0;$('#next').disabled=page>=pages-1;}
function bind(){
 $$('[data-overlay]').forEach(input=>input.addEventListener('change',renderCadence));
 $('#overlay-alignment').addEventListener('change',renderCadence);$('#overlay-log').addEventListener('change',renderCadence);
 $$('[data-case]').forEach(b=>b.onclick=()=>{active=b.dataset.case;renderControls();renderForecast()});
 $$('[data-unit]').forEach(b=>b.onclick=()=>{unit=b.dataset.unit;$$('[data-unit]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',x===b)});renderForecast()});
 $('#log-scale').onchange=renderForecast;$('#reset').onclick=()=>{if(active==='james')return;scenarios[active]=structuredClone(defaults[active]);renderControls();renderForecast()};
 ['#search','#year-filter','#reuse-filter'].forEach(id=>$(id).addEventListener('input',()=>{page=0;renderLedger()}));$('#prev').onclick=()=>{page--;renderLedger()};$('#next').onclick=()=>{page++;renderLedger()};
 $('#export').onclick=()=>{const rows=[['scenario','year','annual_launches','future_launches','cumulative_future_launches','average_weekly_launches','growth_multiplier','delay_years','ceiling_per_year','fleet_by_2036','turnaround_days_by_2036','availability_percent','initial_potential_rate','as_of','year_end_annualized_rate','post_2030_growth_multiplier','basis']];Object.entries(forecasts).forEach(([k,data])=>data.forEach(d=>{const p=k==='james'?james:scenarios[k];rows.push([p.name,d.year,d.annual.toFixed(3),d.future.toFixed(3),d.cumulative.toFixed(3),d.weekly.toFixed(3),p.growth??'',p.delay??'',p.ceiling??'',p.fleet??'',p.turn??'',p.uptime??'',p.start??'',H.asOf,d.exitRate.toFixed(3),p.post2030Growth??'',k==='james'?(d.year>2030?'annual doubling extension':d.year===2026?'bridge from observed YTD rate to 12 per year':'log-linear James milestones'):'capacity-constrained logistic'] )}));const blob=new Blob([rows.map(r=>r.join(',')).join('\n')],{type:'text/csv'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='starship-forecast-2026-2035.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 let timer;new ResizeObserver(()=>{clearTimeout(timer);timer=setTimeout(()=>{renderForecast();renderEvidence()},80)}).observe($('main'));
}
async function init(){try{
 const response=await fetch('data/history.json');if(!response.ok)throw Error('Data unavailable');H=await response.json();
 $('#weekly-stat').textContent=fmt(H.stats.latest13Week,2);$('#reuse-stat').textContent=fmt(H.stats.recentMedian,1);
 $('#cadence-fit-note').textContent=`Logistic fit · k = ${fmt(H.cadenceFit.k,3)} / year · R² = ${fmt(H.cadenceFit.r2,2)} on raw weekly counts. Descriptive, not a capacity estimate.`;
 $('#reuse-fit-note').textContent=`Descending logistic · R² = ${fmt(H.reuseFit.r2,2)} on eligible quarterly medians. Open dots have fewer than 3 pairs; partial Q3 2026 is not fitted.`;
 $('#record-stat').textContent=`${fmt(H.stats.record.turnaroundDays,2)} days`;
 $('#record-copy').innerHTML=`Fastest observed Falcon 9 interval: ${H.stats.record.booster}, ${dates(H.stats.record.previousDate)} → ${dates(H.stats.record.date)}. A demonstrated minimum, not the fleet average.`;
 $('#model-calibration').textContent=`Falcon’s fitted learning rate is ${fmt(H.cadenceFit.k,3)} per year (early-ramp doubling time ≈ ${fmt(Math.log(2)/H.cadenceFit.k,2)} years). Starter defaults use 1.65× that rate for baseline, 1× for bearish, and 2.5× for bullish. These multipliers are analyst assumptions, not SpaceX guidance.`;
 $('#coverage-note').textContent=`Coverage: ${H.stats.flights} Falcon 9 liftoffs, ${H.stats.knownBooster} with certain booster identities, ${H.stats.pairs} consecutive same-booster intervals, and ${H.stats.recentPairs} intervals in 2026. Latest Falcon flight: ${dates(H.stats.latestFlight)}. No per-flight hands-on refurbishment-duration dataset is available in the sources used.`;
 $('#year-filter').innerHTML+=[...H.annual].reverse().map(a=>`<option value="${a.year}">${a.year} (${a.count})</option>`).join('');
 renderControls();renderForecast();renderEvidence();renderLedger();bind();window.__flightpath={history:H,scenarios,forecast,rate};
 }catch(err){$('#forecast-chart').innerHTML='<p class="empty">Flight data could not load. Please refresh the page or download the source data below.</p>';console.error(err)}}
init();
