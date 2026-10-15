import Stream from './axo-stream-schema.cjs';
import Risk from './axo-risk-policy.cjs';
import {responseJson} from './axo-http-json.mjs';

// This uses only the existing public exact-project API. It is not private DB access.
export function createKnowledgeBridge({origin=null,fetchImpl=fetch,now=Date.now}={}){
 if(origin!==null&&origin!=='https://streams.axo.vision')throw Error('Exact approved public project origin required');
 const cache=new Map(),pending=new Map(),calls=[];let reads=0,hits=0,limited=0,last={state:origin?'not_checked':'not_configured',checkedAt:null};
 function retain(key,value){cache.set(key,value);while(cache.size>60)cache.delete(cache.keys().next().value);}
 function clean(raw,identity){
  if(raw?.schemaVersion!==2||raw.project?.chain!==identity.chain||!Risk.eq(raw.project.address,identity.address,identity.chain))throw Error('Shared project schema or identity mismatch');
  const p=raw.market?.primary;if(!p||p.chain!==identity.chain||!Risk.eq(p.address,identity.address,identity.chain)||!Risk.eq(p.pair,identity.pool,identity.chain))throw Error('Exact shared pool unavailable');
  if(!Number.isFinite(p.seenAt)||p.seenAt<=0||p.seenAt>now()||now()-p.seenAt>300000||p.observationStatus==='stale')throw Error('Shared observation stale or future-dated');
  const out={chain:p.chain,address:p.address,pair:p.pair,seenAt:p.seenAt,sharedSource:origin};
  for(const k of ['name','symbol','provider','id'])if(typeof p[k]==='string')out[k]=p[k].slice(0,120);
  for(const k of ['price','liquidity','marketCap','volume5','volume1','volume6','volume24','buys','sells','createdAt'])out[k]=Number.isFinite(p[k])&&p[k]>=0?p[k]:null;
  for(const k of ['change1','change24'])out[k]=Number.isFinite(p[k])?p[k]:null;
  for(const k of ['url','imageUrl'])try{const u=new URL(p[k]);if(u.protocol==='https:'&&!u.username&&!u.password)out[k]=u.href;}catch{}
  out.transactions=Object.fromEntries(['m5','h1','h6','h24'].map(w=>[w,Object.fromEntries(['buys','sells'].map(k=>[k,Number.isSafeInteger(p.transactions?.[w]?.[k])&&p.transactions[w][k]>=0?p.transactions[w][k]:null]))]));
  out.providerObservations=(Array.isArray(p.providerObservations)?p.providerObservations:[]).slice(0,4).filter(o=>typeof o.provider==='string'&&Number.isFinite(o.seenAt)&&o.seenAt>0&&o.seenAt<=now()&&now()-o.seenAt<=300000&&Number.isFinite(o.price)&&o.price>0).map(o=>({provider:o.provider.slice(0,100),seenAt:o.seenAt,price:o.price}));
  if(!(out.price>0)||!(out.liquidity>0)||!out.url)throw Error('Shared market data incomplete');
  return out;
 }
 async function read(input){
  if(!origin)return null;const identity=Stream.exact(input,true),key=JSON.stringify(identity),hit=cache.get(key);
  if(hit&&now()>=hit.at&&now()-hit.at<(hit.project?120000:30000)){hits++;return hit.project&&now()-hit.project.seenAt<=300000?structuredClone(hit.project):null;}
  if(pending.has(key))return pending.get(key);
  while(calls.length&&now()-calls[0]>=60000)calls.shift();
  if(pending.size>=2||calls.length>=6){limited++;return null;}
  reads++;calls.push(now());
  const task=Promise.resolve().then(async()=>{try{
   const url=origin+'/api/project?'+new URLSearchParams(identity),r=await fetchImpl(url,{headers:{accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(12000)});
   if(!r.ok){last={state:r.status===402?'payment_required':r.status===401||r.status===403?'access_required':'unavailable',checkedAt:now()};retain(key,{at:now(),project:null});return null;}
   if(Number(r.headers?.get('content-length'))>2000000)throw Error('Shared project response too large');
   const project=clean(await responseJson(r,'Public project service'),identity);retain(key,{at:now(),project});last={state:'verified_public_read',checkedAt:now()};return structuredClone(project);
  }catch{last={state:'unverified',checkedAt:now()};retain(key,{at:now(),project:null});return null;}finally{pending.delete(key);}});pending.set(key,task);return task;
 }
 return {read,status:()=>({configured:Boolean(origin),...last,reads,cacheHits:hits,active:pending.size,limited,limit:'2 concurrent / 6 new public reads per minute',scope:'Public project observations only; no private workspace, account memory or database credentials',authenticatedDatabaseAccess:false})};
}
