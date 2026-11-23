import {createLinker,reachTable,coverSize,type LinkGrid} from './sky-links';

/** Which sky-light probes see each other (sky-links.ts), off the page's thread: the house arrives once, then each shown
 * state's visible batches; every answer goes back with the job it was asked for, as the table the materials look up
 * (reachTable), followed by what stands over the grid (coverSize), as the texture's last layer. */
type Message=
 |{kind:'init';positions:Float32Array;batch:Uint16Array;grid:LinkGrid;panes:number}
 |{kind:'visible';visible:Uint8Array;job:number};
const scope=self as unknown as {onmessage:(e:MessageEvent<Message>)=>void;postMessage:(message:unknown,transfer?:Transferable[])=>void};
let link:ReturnType<typeof createLinker>|undefined,grid:LinkGrid|undefined;
scope.onmessage=({data})=>{
 if(data.kind==='init'){grid=data.grid;link=createLinker(data.positions,data.batch,data.grid,data.panes);return;}
 if(!link||!grid)return;
 const cover=new Uint8Array(coverSize(grid)),table=reachTable(link(data.visible,cover),grid),reach=new Uint8Array(table.length+cover.length);
 reach.set(table);reach.set(cover,table.length);scope.postMessage({kind:'reach',job:data.job,reach},[reach.buffer]);
};
