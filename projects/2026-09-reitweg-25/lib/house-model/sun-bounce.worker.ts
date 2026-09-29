import {DataUtils} from 'three';
import {createTracer,smoothIntoAtlas,type Grid,type Shaded} from './sun-bounce-core';

/** One share of the bounced-sunlight tracing, off the page's thread (sun-bounce.ts starts several). */
type Message=
 |{kind:'init';positions:Float32Array;batch:Uint16Array;albedo:Float32Array;grid:Grid;rays:number;part:number;parts:number}
 |{kind:'geometry';visible:Uint8Array}
 |{kind:'sun';sun:[number,number,number];job:number}
 |{kind:'smooth';parts:Shaded[];job:number};
const scope=self as unknown as {onmessage:(e:MessageEvent<Message>)=>void;postMessage:(message:unknown,transfer?:Transferable[])=>void};
let tracer:ReturnType<typeof createTracer>|undefined,grid:Grid|undefined;
scope.onmessage=({data})=>{
 if(data.kind==='init'){grid=data.grid;tracer=createTracer(data.positions,data.batch,data.albedo,data.grid,data.rays,data.part,data.parts);return;}
 // One worker joins the shares, smooths them and converts to half floats, so the page only uploads the result.
 if(data.kind==='smooth'){
  const atlas=smoothIntoAtlas(data.parts,grid!),light=Uint16Array.from(atlas.light,DataUtils.toHalfFloat),direction=Uint16Array.from(atlas.direction,DataUtils.toHalfFloat);
  scope.postMessage({kind:'atlas',job:data.job,light,direction},[light.buffer,direction.buffer]);return;
 }
 if(!tracer)return;
 if(data.kind==='geometry'){tracer.setVisible(data.visible);return;}
 const shaded=tracer.shade(data.sun);
 scope.postMessage({kind:'shaded',job:data.job,...shaded},[shaded.light.buffer,shaded.direction.buffer]);
};
