/** A spring morning in the Bavarian countryside, synthesised in the browser: soft gusting air with leaves rustling,
 * bees passing low over the meadow, and birdsong near and far in a light open-air reverb. Each song follows its
 * species' usual shape and pitch: the blackbird's fluted warble, the chaffinch's falling trill and flourish, the great
 * tit's "tea-cher", the robin's thin cascade, a distant cuckoo, and scattered calls. Nothing is a recording. */
export type Note={at:number;dur:number;f0:number;f1:number;gain:number;pan:number;far:number;vibrato?:number};
type Rand=()=>number;
export const seeded=(seed:number):Rand=>()=>{seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const between=(r:Rand,a:number,b:number)=>a+(b-a)*r();
const pick=<T,>(r:Rand,list:readonly T[])=>list[Math.floor(r()*list.length)];
type Perch={pan:number;far:number};
type Song=(at:number,r:Rand,p:Perch)=>Note[];
/** Each species sings from one or two perches (`far` 0 close by … 1 far off), at its own pace (`gap` between phrase
 * starts, in seconds). */
const species=(perches:Perch[],first:[number,number],gap:[number,number],song:Song)=>({first:(r:Rand)=>between(r,...first),gap:(r:Rand)=>between(r,...gap),perches,song});
const seq=(at:number,parts:[number,number,number,number,number?][],gain:number,p:Perch)=>{let t=at;return parts.map(([gapBefore,dur,f0,f1,vibrato])=>{t+=gapBefore;const n={at:t,dur,f0,f1,gain,pan:p.pan,far:p.far,vibrato};t+=dur;return n;});};
export const SPECIES={
 blackbird:species([{pan:-.55,far:.25},{pan:.7,far:.55}],[.5,3],[4,9],(at,r,p)=>{
  const notes:[number,number,number,number,number?][]=[];const n=4+Math.floor(r()*4);
  for(let i=0;i<n;i++){const f=between(r,1600,2700);notes.push([i?between(r,.03,.1):0,between(r,.1,.26),f,f*between(r,.82,1.22),between(r,4,9)]);}
  for(let i=0,k=2+Math.floor(r()*3);i<k;i++){const f=between(r,3600,5600);notes.push([.025,between(r,.03,.05),f,f*between(r,.85,1.15)]);}
  return seq(at,notes,.16,p);}),
 chaffinch:species([{pan:.35,far:.4},{pan:-.8,far:.6}],[2,6],[8,14],(at,r,p)=>{
  const notes:[number,number,number,number,number?][]=[];let f=between(r,4600,5200);
  for(let i=0,k=4+Math.floor(r()*3);i<k;i++){notes.push([i?.03:0,.045,f,f*.82]);f*=.98;}
  f=between(r,3600,3900);for(let i=0,k=3+Math.floor(r()*2);i<k;i++)notes.push([.035,.06,f,f*.8]);
  f=between(r,2900,3100);for(let i=0,k=2+Math.floor(r()*2);i<k;i++)notes.push([.04,.07,f,f*.85]);
  notes.push([.05,.09,3200,5600],[.01,.12,5200,2800]);
  return seq(at,notes,.13,p);}),
 greatTit:species([{pan:-.2,far:.3}],[4,10],[10,20],(at,r,p)=>{
  const notes:[number,number,number,number,number?][]=[],hi=between(r,4400,4900),lo=between(r,3200,3500);
  for(let i=0,k=3+Math.floor(r()*4);i<k;i++)notes.push([i?.13:0,.09,hi,hi*.96],[.04,.1,lo,lo*.94]);
  return seq(at,notes,.12,p);}),
 robin:species([{pan:.6,far:.35}],[3,9],[9,18],(at,r,p)=>{
  const notes:[number,number,number,number,number?][]=[];
  for(let i=0,k=8+Math.floor(r()*7);i<k;i++){const f=between(r,2600,7000);notes.push([i?between(r,.02,.08):0,between(r,.04,.14),f,Math.min(7900,f*between(r,.8,1.25))]);}
  return seq(at,notes,.07,p);}),
 cuckoo:species([{pan:-.4,far:.9},{pan:.5,far:.85}],[8,20],[25,60],(at,r,p)=>{
  const notes:[number,number,number,number,number?][]=[];
  for(let i=0,k=3+Math.floor(r()*4);i<k;i++)notes.push([i?.4:0,.17,700,690,5],[.15,.26,580,540,5]);
  return seq(at,notes,.07,p);}),
 chirp:species([{pan:-.9,far:.8},{pan:-.3,far:.7},{pan:.4,far:.75},{pan:.9,far:.85}],[0,1],[.9,2.4],(at,r,p)=>{
  const f=between(r,3500,6500);return seq(at,[[0,between(r,.03,.06),f,f*.8]],.035,p);}),
};
export type Species=keyof typeof SPECIES;
export const songOf=(s:Species,at:number,r:Rand)=>SPECIES[s].song(at,r,pick(r,SPECIES[s].perches));
/** The wind: air and leaves only, filtered clear of any low rumble; gusts move each gain within its range. */
export const WIND={air:{highpass:160,lowpass:900,gain:[.012,.045]},leaves:{highpass:1800,lowpass:7500,gain:[.005,.03]}} as const;

/** Builds the soundscape on `ctx`. `start` fades it in and keeps scheduling ahead while the context runs (pass
 * `until` to plan a fixed span instead, for an offline render); `stop` fades it out. */
export function springMorning(ctx:BaseAudioContext,seed=Date.now()){
 const r=seeded(seed),out=ctx.createGain();out.gain.value=0;
 const limit=ctx.createDynamicsCompressor();limit.threshold.value=-20;limit.ratio.value=3;out.connect(limit).connect(ctx.destination);
 // Open air: a soft, short decay, more of it for distant voices.
 const verb=ctx.createConvolver(),wet=ctx.createGain();wet.gain.value=.4;verb.buffer=(()=>{const n=Math.round(ctx.sampleRate*1.6),b=ctx.createBuffer(2,n,ctx.sampleRate);for(let c=0;c<2;c++){const d=b.getChannelData(c);let s=0;for(let i=0;i<n;i++){s=s*.6+(r()*2-1)*.4;d[i]=s*Math.exp(-i/ctx.sampleRate/.38);}}return b;})();
 verb.connect(wet).connect(out);
 const pink=(seconds:number)=>{const n=Math.round(ctx.sampleRate*seconds),b=ctx.createBuffer(2,n,ctx.sampleRate);for(let c=0;c<2;c++){const d=b.getChannelData(c);let b0=0,b1=0,b2=0;for(let i=0;i<n;i++){const w=r()*2-1;b0=.99765*b0+w*.099046;b1=.963*b1+w*.2965164;b2=.57*b2+w*1.0526913;d[i]=(b0+b1+b2+w*.1848)*.11;}}return b;};
 const loop=(buffer:AudioBuffer)=>{const s=ctx.createBufferSource();s.buffer=buffer;s.loop=true;return s;};
 const band=(lo:number,hi:number)=>{const a=ctx.createBiquadFilter(),b=ctx.createBiquadFilter();a.type='highpass';a.frequency.value=lo;b.type='lowpass';b.frequency.value=hi;a.connect(b);return [a,b] as const;};
 const air=loop(pink(9)),leaves=loop(pink(7)),airGain=ctx.createGain(),leafGain=ctx.createGain();airGain.gain.value=WIND.air.gain[0];leafGain.gain.value=WIND.leaves.gain[0];
 {const [a,b]=band(WIND.air.highpass,WIND.air.lowpass);air.connect(a);b.connect(airGain).connect(out);}
 {const [a,b]=band(WIND.leaves.highpass,WIND.leaves.lowpass);leaves.connect(a);b.connect(leafGain).connect(out);}
 // Leaves flutter a little faster than the gusts.
 const flutter=ctx.createOscillator(),flutterDepth=ctx.createGain();flutter.frequency.value=6.5;flutterDepth.gain.value=.004;flutter.connect(flutterDepth).connect(leafGain.gain);
 const voice=(p:Perch)=>{const pan=ctx.createStereoPanner(),tone=ctx.createBiquadFilter(),level=ctx.createGain(),send=ctx.createGain();pan.pan.value=p.pan;tone.type='lowpass';tone.frequency.value=12000-p.far*8500;level.gain.value=1-p.far*.6;send.gain.value=.15+p.far*.7;tone.connect(level).connect(pan).connect(out);pan.connect(send).connect(verb);return {input:tone,nodes:[pan,tone,level,send]};};
 const sing=(notes:Note[])=>{if(!notes.length)return;const v=voice(notes[0]);let last:OscillatorNode|undefined;
  for(const n of notes){const o=ctx.createOscillator(),env=ctx.createGain(),a=Math.min(.012,n.dur*.25),rel=Math.min(.03,n.dur*.4);
   o.frequency.setValueAtTime(n.f0,n.at);o.frequency.linearRampToValueAtTime(n.f1,n.at+n.dur);
   if(n.vibrato){const lfo=ctx.createOscillator(),depth=ctx.createGain();lfo.frequency.value=n.vibrato;depth.gain.value=n.f0*.012;lfo.connect(depth).connect(o.frequency);lfo.start(n.at);lfo.stop(n.at+n.dur);}
   env.gain.setValueAtTime(0,n.at);env.gain.linearRampToValueAtTime(n.gain,n.at+a);env.gain.setValueAtTime(n.gain,n.at+n.dur-rel);env.gain.linearRampToValueAtTime(0,n.at+n.dur);
   o.connect(env).connect(v.input);o.start(n.at);o.stop(n.at+n.dur+.01);last=o;}
  last!.onended=()=>setTimeout(()=>v.nodes.forEach(x=>x.disconnect()),2000);};
 // A bee passes low over the meadow: two slightly detuned saws, softened, wobbling in pitch and level as it crosses.
 const bee=(at:number)=>{const dur=between(r,3,7),f=between(r,180,250),gain=between(r,.008,.015),tone=ctx.createBiquadFilter(),env=ctx.createGain(),pan=ctx.createStereoPanner(),wobble=ctx.createOscillator(),wobbleDepth=ctx.createGain();
  tone.type='bandpass';tone.frequency.value=600;tone.Q.value=.8;wobble.frequency.value=between(r,2,4);wobbleDepth.gain.value=6;wobble.connect(wobbleDepth);
  const from=between(r,-1,1);pan.pan.setValueAtTime(from,at);pan.pan.linearRampToValueAtTime(Math.max(-1,Math.min(1,from+between(r,-1.2,1.2))),at+dur);
  env.gain.setValueAtTime(0,at);env.gain.linearRampToValueAtTime(gain,at+1);env.gain.setValueAtTime(gain,at+dur-1.5);env.gain.linearRampToValueAtTime(0,at+dur);
  const oscs=[1,1.012].map(k=>{const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=f*k;wobbleDepth.connect(o.frequency);o.connect(tone);o.start(at);o.stop(at+dur);return o;});
  tone.connect(env).connect(pan).connect(out);wobble.start(at);wobble.stop(at+dur);oscs[0].onended=()=>[tone,env,pan,wobbleDepth].forEach(x=>x.disconnect());};
 const next:Record<Species|'bee'|'gust',number>={...Object.fromEntries((Object.keys(SPECIES) as Species[]).map(s=>[s,0])) as Record<Species,number>,bee:0,gust:0};
 const plan=(until:number)=>{
  for(const s of Object.keys(SPECIES) as Species[])while(next[s]<until){sing(songOf(s,next[s],r));next[s]+=SPECIES[s].gap(r);}
  while(next.bee<until){bee(next.bee);next.bee+=between(r,7,16);}
  // Gusts: the air rises and settles every few seconds; the leaves answer more strongly.
  while(next.gust<until){const s=r()<.2?1:between(r,.15,.6);airGain.gain.setTargetAtTime(WIND.air.gain[0]+(WIND.air.gain[1]-WIND.air.gain[0])*s,next.gust,1.4);leafGain.gain.setTargetAtTime(WIND.leaves.gain[0]+(WIND.leaves.gain[1]-WIND.leaves.gain[0])*s**1.5,next.gust,.9);next.gust+=between(r,2,5);}
 };
 let timer:ReturnType<typeof setInterval>|undefined;
 return {
  start:(until?:number)=>{const t0=ctx.currentTime;for(const s of Object.keys(SPECIES) as Species[])next[s]=t0+SPECIES[s].first(r);next.bee=t0+between(r,2,6);next.gust=t0;
   out.gain.setTargetAtTime(.9,t0,.8);air.start(t0);leaves.start(t0);flutter.start(t0);
   if(until!==undefined)plan(until);else{plan(t0+2);timer=setInterval(()=>plan(ctx.currentTime+2),500);}},
  stop:()=>{if(timer)clearInterval(timer);out.gain.setTargetAtTime(0,ctx.currentTime,.3);},
 };
}
