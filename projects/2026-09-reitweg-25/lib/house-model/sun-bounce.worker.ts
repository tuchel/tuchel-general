import {DataUtils} from 'three';
import {addTail,createTracer,smooth,toAtlas,type Field,type Grid,type Shaded} from './sun-bounce-core';

/** One share of the bounced-sunlight tracing, off the page's thread (sun-bounce.ts starts several). The first worker
 * gathers every share of a bounce over `peers` (message ports to the others), smooths it, and with further bounces to
 * go sends the smoothed field back out for the next; the sum of all of them, with the rest extrapolated from the last two
 * (addTail), goes to the page as one atlas. */
type Message=
 |{kind:'init';positions:Float32Array;batch:Uint16Array;albedo:Float32Array;grid:Grid;rays:number;part:number;parts:number;bounces:number;peers:MessagePort[]}
 |{kind:'geometry';visible:Uint8Array}
 |{kind:'sun';sun:[number,number,number];job:number};
type Share=Shaded&{kind:'shaded';job:number;bounce:number};
type Next={kind:'bounce';job:number;bounce:number;field:Field};
const scope=self as unknown as {onmessage:(e:MessageEvent<Message>)=>void;postMessage:(message:unknown,transfer?:Transferable[])=>void};
let tracer:ReturnType<typeof createTracer>|undefined,grid:Grid|undefined,parts=1,bounces=1,peers:MessagePort[]=[];
// The first worker's gathering: the job and bounce under way, its shares so far, the bounces summed and the one before.
let job=-1,bounce=0,shares:Shaded[]=[],total:Field|undefined,previous:Field|undefined;
const transfer=(s:Shaded)=>[s.light.buffer,s.direction.buffer,...(s.tint?[s.tint.buffer]:[])];
/** A share of a bounce, to the first worker (itself, or over the port it was given). */
let report=(share:Share)=>gather(share);
const gather=(share:Share)=>{
 if(share.job<job)return;
 if(share.job>job){job=share.job;bounce=1;shares=[];total=previous=undefined;}
 if(share.bounce!==bounce)return;
 shares.push(share);if(shares.length<parts)return;
 const field=smooth(shares,grid!);shares=[];
 if(total){for(let i=0;i<field.light.length;i++){total.light[i]+=field.light[i];total.direction[i]+=field.direction[i];}}else total={light:field.light.slice(),direction:field.direction.slice(),tint:field.tint};
 // The open flag (light's fourth value) is the same in every bounce; the sum keeps the first's.
 if(bounce>1)for(let i=3;i<total.light.length;i+=4)total.light[i]/=2;
 if(bounce<bounces){
  bounce++;const next:Next={kind:'bounce',job,bounce,field:{light:field.light,direction:field.direction}};
  for(const port of peers)port.postMessage(next);
  previous=field;report({kind:'shaded',job,bounce,...tracer!.bounce(field)});return;
 }
 if(previous)addTail(total,field,previous);
 // One worker converts to half floats, so the page only uploads the result.
 // The surfaces' colour rides below the light, in the same texture (sun-bounce.ts).
 const atlas=toAtlas(total,grid!),half=(a:Float32Array)=>Uint16Array.from(a,DataUtils.toHalfFloat);
 const light=new Uint16Array(atlas.light.length*2);light.set(half(atlas.light));light.set(half(atlas.tint),atlas.light.length);
 const direction=half(atlas.direction);
 scope.postMessage({kind:'atlas',job,light,direction},[light.buffer,direction.buffer]);
};
scope.onmessage=({data})=>{
 if(data.kind==='init'){
  grid=data.grid;parts=data.parts;bounces=data.bounces;peers=data.peers;
  tracer=createTracer(data.positions,data.batch,data.albedo,data.grid,data.rays,data.part,data.parts);
  // Another worker reports to the first over its port, and takes further bounces from it.
  if(data.part>0){const first=data.peers[0];report=share=>first.postMessage(share,transfer(share));
   first.onmessage=({data:next}:MessageEvent<Next>)=>{if(next.kind==='bounce'&&tracer)report({kind:'shaded',job:next.job,bounce:next.bounce,...tracer.bounce(next.field)});};}
  else for(const port of peers)port.onmessage=({data:share}:MessageEvent<Share>)=>gather(share);
  return;
 }
 if(!tracer)return;
 if(data.kind==='geometry'){tracer.setVisible(data.visible);return;}
 report({kind:'shaded',job:data.job,bounce:1,...tracer.shade(data.sun)});
};
