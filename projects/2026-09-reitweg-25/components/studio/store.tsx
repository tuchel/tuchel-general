"use client";
import {createContext,useContext,useState,useEffect,useCallback} from 'react';
import {toast} from 'sonner';
export type Entry={id:string;project:string;kind:string;content:Record<string,any>;version:number;created_at:string;updated_at:string};
type Store={canEdit:boolean;entries:Entry[];loading:boolean;error:string;refresh:()=>Promise<void>;save:(project:string,kind:string,content:Record<string,any>,existing?:Entry)=>Promise<Entry|null>;remove:(id:string)=>Promise<boolean>;upload:(file:File,project:string,role?:string)=>Promise<Entry|null>};
const Context=createContext<Store>(null!);
export function StudioStore({children,canEdit=false}:{children:React.ReactNode;canEdit?:boolean}){
 const [entries,setEntries]=useState<Entry[]>([]),[loading,setLoading]=useState(canEdit),[error,setError]=useState('');
 const refresh=useCallback(async()=>{if(!canEdit){setEntries([]);setLoading(false);return}try{const r=await fetch('/api/entries');const d:any=await r.json();if(!r.ok)throw Error(d.error);setEntries(d.entries);setError('')}catch(e){setError(e instanceof Error?e.message:'Your studio is unavailable.')}finally{setLoading(false)}},[canEdit]);
 useEffect(()=>{void refresh()},[refresh]);
 async function save(project:string,kind:string,content:Record<string,any>,existing?:Entry){if(!canEdit)return null;try{const r=await fetch('/api/entries',{method:existing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({project,kind,content,...(existing?{id:existing.id,version:existing.version}:{})})});const d:any=await r.json();if(!r.ok)throw Error(d.error);const entry={...existing,...d.entry};setEntries(old=>[entry,...old.filter(x=>x.id!==entry.id)]);toast.success('Saved to your studio');return entry}catch(e){toast.error(e instanceof Error?e.message:'Could not save. Your text has been kept.');return null}}
 async function remove(id:string){if(!canEdit)return false;try{const r=await fetch('/api/entries',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});if(!r.ok)throw Error('Could not remove this entry.');setEntries(old=>old.filter(x=>x.id!==id));toast.success('Entry removed');return true}catch(e){toast.error(String(e));return false}}
 async function upload(file:File,project:string,role='reference'){if(!canEdit)return null;try{if(file.size>20*1024*1024)throw Error('Choose a file under 20 MB.');const form=new FormData();form.set('file',file);form.set('project',project);form.set('role',role);const r=await fetch('/api/uploads',{method:'POST',body:form});const d:any=await r.json();if(!r.ok)throw Error(d.error);setEntries(old=>[d.entry,...old]);toast.success('Added to your source library');return d.entry}catch(e){toast.error(e instanceof Error?e.message:'Upload failed.');return null}}
 return <Context.Provider value={{canEdit,entries,loading,error,refresh,save,remove,upload}}>{children}</Context.Provider>
}
export const useStudio=()=>useContext(Context);
export function download(name:string,text:string,type='text/markdown'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
