import {digest,safePayload,identity} from './axo-durable-store.mjs';
const TTL={market:30*60000,chain:30*60000,'strategy-review':6*3600000,'project-identity':3600000,creator:3600000};
export function researchKey(kind,args,project=null,model='gpt-6-luna'){
 if(!Object.hasOwn(TTL,kind)||!args||args.history?.length||typeof args.instructions!=='string'||typeof args.question!=='string'||!args.context||!args.schema)throw Error('Non-reusable research');
 const p=project?identity(project):null;
 return digest({version:1,model,kind,project:p,instructionsHash:digest(args.instructions),questionHash:digest(args.question),schemaHash:digest(args.schema),evidenceHash:digest(args.context)});
}
function matchesSchema(value,schema){
 if(schema?.type==='string')return typeof value==='string'&&(!schema.maxLength||value.length<=schema.maxLength)&&(!schema.enum||schema.enum.includes(value));
 if(schema?.type==='array')return Array.isArray(value)&&(!schema.maxItems||value.length<=schema.maxItems)&&value.every(v=>matchesSchema(v,schema.items));
 if(schema?.type==='object')return value&&typeof value==='object'&&!Array.isArray(value)&&(!schema.required||schema.required.every(k=>Object.hasOwn(value,k)))&&(schema.additionalProperties!==false||Object.keys(value).every(k=>Object.hasOwn(schema.properties||{},k)))&&Object.entries(value).every(([k,v])=>!schema.properties?.[k]||matchesSchema(v,schema.properties[k]));
 return true;
}
export async function reusableResearch({kind,args,project=null,model,store,run,now=Date.now}){
 const key=researchKey(kind,args,project),evidenceHash=digest(args.context),promptHash=digest({instructions:args.instructions,question:args.question,schema:args.schema});
 if(store){const row=await store.get('ai',key);if(row&&!row.stale&&row.data?.model==='gpt-6-luna'&&row.data?.value&&row.observedAt<=now())return {...row.data,cacheHit:true,originalObservedAt:row.observedAt}}
 const result=await run(args);
 if(store&&result?.model==='gpt-6-luna'&&result.value&&typeof result.value==='object'&&matchesSchema(result.value,args.schema)&&(!['market','chain','strategy-review'].includes(kind)||typeof result.value.headline==='string'&&typeof result.value.summary==='string'&&typeof result.value.nextAction==='string'&&(!['market','chain'].includes(kind)||result.value.sources?.length>0))){
  try{const data=safePayload({model:result.model,value:result.value});await store.put('ai',key,{data,provider:'codex-local',model:result.model,operation:kind,evidenceHash,promptHash,project,fetchedAt:now(),observedAt:Math.min(now(),Number(args.context?.asOf)||now()),ttl:TTL[kind]})}catch{}
 }
 return result;
}
export const REUSABLE_RESEARCH_KINDS=Object.freeze(Object.keys(TTL));
