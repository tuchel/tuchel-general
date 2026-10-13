/** Ends touches the browser never ended. iOS Safari can drop a touch's pointerup and pointercancel when a notification,
 * the app switcher or a system gesture takes over mid-touch; the touch then stays held, in OrbitControls and in the
 * eye-level look, and the next one-finger drag reads as a two-finger pinch: the view zooms and will not turn. A new
 * primary touch means no other finger is down, so any still held are ended, as cancelled; so is every touch when the
 * page loses focus or is hidden. Install it before the canvas's other pointer listeners, so they hear the ending first.
 * Returns the uninstaller. */
export function endStaleTouches(canvas:HTMLElement){
 const held=new Set<number>(),doc=canvas.ownerDocument,view=doc.defaultView;
 const end=(keep?:number)=>{for(const id of [...held])if(id!==keep){held.delete(id);canvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:id,pointerType:'touch'}));}};
 // OrbitControls releases capture of the touch it ends, which the browser no longer knows and would refuse.
 const release=canvas.releasePointerCapture;
 canvas.releasePointerCapture=id=>{if(canvas.hasPointerCapture(id))release.call(canvas,id);};
 const down=(e:PointerEvent)=>{if(e.pointerType!=='touch')return;if(e.isPrimary)end(e.pointerId);held.add(e.pointerId);};
 const up=(e:PointerEvent)=>{held.delete(e.pointerId);};
 const away=()=>end(),hidden=()=>{if(doc.visibilityState==='hidden')end();};
 canvas.addEventListener('pointerdown',down);doc.addEventListener('pointerup',up);doc.addEventListener('pointercancel',up);
 view?.addEventListener('blur',away);doc.addEventListener('visibilitychange',hidden);
 return ()=>{
  canvas.removeEventListener('pointerdown',down);doc.removeEventListener('pointerup',up);doc.removeEventListener('pointercancel',up);
  view?.removeEventListener('blur',away);doc.removeEventListener('visibilitychange',hidden);canvas.releasePointerCapture=release;
 };
}
