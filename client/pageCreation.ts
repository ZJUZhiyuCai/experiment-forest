import type {ForestApi} from '../shared/model';
import type {PageView} from '../shared/page';
type Input=Parameters<ForestApi['createPage']>[0];
interface Attempt {input:Input; job?:Promise<PageView>}
const attempts=new Map<string,Attempt>();
let guarded=false;
const beforeUnload=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
function syncGuard(){
  if(typeof window==='undefined')return;
  if(attempts.size&&!guarded){window.addEventListener('beforeunload',beforeUnload);guarded=true;}
  if(!attempts.size&&guarded){window.removeEventListener('beforeunload',beforeUnload);guarded=false;}
}
export function clearPageCreation(session:string,requestId:string):void {
  if(attempts.get(session)?.input.requestId===requestId)attempts.delete(session);
  syncGuard();
}
/** Freeze one uncertain creation across panel unmounts and project changes. Concurrent clicks share a call. */
export function beginPageCreation(api:ForestApi,session:string,projectId:string|null):{input:Input;result:Promise<PageView>} {
  let entry=attempts.get(session);
  if(!entry){entry={input:{requestId:crypto.randomUUID(),...(projectId?{projectId}:{})}};attempts.set(session,entry);syncGuard();}
  const current=entry;
  if(!current.job)current.job=Promise.resolve().then(()=>api.createPage(structuredClone(current.input))).then(view=>{
    clearPageCreation(session,current.input.requestId);return view;
  }).finally(()=>{current.job=undefined;});
  return {input:structuredClone(current.input),result:current.job};
}
