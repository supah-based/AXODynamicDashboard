import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {digest} from './axo-durable-store.mjs';
const observationContext=new AsyncLocalStorage();
export async function withSourceObservations(operation){const source={reads:0,oldestAt:null,partial:false};const value=await observationContext.run(source,operation);return {value,source};}
const policies={geckoterminal:{spacing:6000,perMinute:24,concurrency:2},dexscreener:{spacing:500,perMinute:120,concurrency:3},coingecko:{spacing:2200,perMinute:25,concurrency:2},goplus:{spacing:2000,perMinute:20,concurrency:2},defillama:{spacing:350,perMinute:100,concurrency:3},default:{spacing:1000,perMinute:40,concurrency:2}};
export function sourceProvider(host){return host==='api.geckoterminal.com'?'geckoterminal':host==='api.dexscreener.com'?'dexscreener':/(^|\.)coingecko\.com$/.test(host)?'coingecko':host==='api.gopluslabs.io'?'goplus':/(^|\.)(llama\.fi|defillama\.com)$/.test(host)?'defillama':host;}
export function createSourceCache({fetchImpl=fetch,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),policy={},store=null,staleMs=3600000,maxPending=128,maxQueued=24,maxWaitMs=30000}={}){
 const cache=new Map(),pending=new Map(),providers=new Map(),failures=new Map();let durable=store,hits=0,joins=0,reads=0,postgresHits=0,staleHits=0,staleMemoryHits=0,rejected=0;
 function retain(map,key,value,limit=300){map.set(key,value);while(map.size>limit)map.delete(map.keys().next().value);}
 function provider(host){const name=sourceProvider(host);if(!providers.has(name)){if(providers.size>=48){const idle=[...providers].find(([,p])=>p.active===0&&!p.queue.length&&p.cooldownUntil<=now()&&(!p.lastAttemptAt||now()-p.lastAttemptAt>60000));if(idle)providers.delete(idle[0]);else throw Error('Source provider capacity reached');}providers.set(name,{name,...(policies[name]||policies.default),...policy[name],active:0,nextAt:0,calls:[],cooldownUntil:0,queue:[],lastStatus:'not checked',lastAttemptAt:null,lastSuccessAt:null,failures:0});}return providers.get(name);}
 function release(p){const next=p.queue.shift();if(next){clearTimeout(next.timer);next.resolve();}else p.active--;}
 async function acquire(p){
  const deadline=now()+maxWaitMs;
  if(now()<p.cooldownUntil)throw Error('Provider cooldown; retry later');
  if(p.active>=p.concurrency){
   if(p.queue.length>=maxQueued){rejected++;throw Error('Provider queue at capacity; retry later');}
   await new Promise((resolve,reject)=>{const item={resolve,reject};item.timer=setTimeout(()=>{const i=p.queue.indexOf(item);if(i>=0)p.queue.splice(i,1);rejected++;reject(Error('Provider queue wait expired'));},maxWaitMs);p.queue.push(item);});
  }else p.active++;
  try{
   p.calls=p.calls.filter(t=>t>now()-60000);if(now()<p.cooldownUntil)throw Error('Provider cooldown; retry later');
   const slot=Math.max(now(),p.nextAt,p.calls.length>=p.perMinute?p.calls[p.calls.length-p.perMinute]+60000:0);
   if(slot>deadline||now()>deadline){rejected++;throw Error('Provider schedule exceeds bounded wait');}
   p.nextAt=slot+p.spacing;if(slot>now())await sleep(slot-now());
   if(now()>deadline||now()<p.cooldownUntil)throw Error('Provider wait expired or cooldown active');
   p.calls=p.calls.filter(t=>t>now()-60000);if(p.calls.length>=p.perMinute)throw Error('Provider minute budget reached');p.calls.push(now());
  }catch(e){release(p);throw e;}
 }
 async function read(url,{ttl=120000,method='GET',body,headers={},responseType='json',fetcher=fetchImpl}={}){
  const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||url.length>6000)throw Error('Public HTTPS source required');
  ttl=Math.min(7*86400000,Math.max(1,Number(ttl)||120000));
  const requestHeaders=Object.fromEntries([...new Headers(headers).entries()].sort(([a],[b])=>a.localeCompare(b))),bodyHash=createHash('sha256').update(body||'').digest('hex');
  // Header variants must not share responses or inflight requests, including auth and API versions.
  const id=digest({method,url,bodyHash,responseType,headersHash:digest(requestHeaders)}),key=id,old=cache.get(key);
  const safeRequest=method==='GET'&&!body&&Object.keys(requestHeaders).every(k=>['accept','accept-language','user-agent'].includes(k))&&!Array.from(u.searchParams.keys()).some(k=>/key|token|secret|auth|signature|password/i.test(k));
  const memoryFallback=()=>safeRequest&&old&&old.at>0&&old.at<=now()&&now()-old.at<ttl+Math.min(staleMs,86400000)?{...structuredClone(old),delivery:'stale-memory',staleUntil:old.at+ttl+Math.min(staleMs,86400000)}:null;
  if(old&&old.at<=now()&&now()-old.at<ttl){hits++;return {...structuredClone(old),delivery:'cached'};}
  if(pending.has(key)){joins++;return structuredClone(await pending.get(key));}
  const failed=failures.get(key);if(failed&&failed.until>now()){const last=memoryFallback();if(last){staleMemoryHits++;return last;}throw Error('Source retry cooldown; original observation unavailable');}
  if(pending.size>=maxPending){rejected++;const last=memoryFallback();if(last){staleMemoryHits++;return last;}throw Error('Shared source capacity reached; retry later');}
  const task=(async()=>{
   const disk=safeRequest&&durable?await durable.get('source',id,{allowStale:true}).catch(()=>null):null;
   if(disk&&!disk.stale&&disk.fetchedAt>0&&disk.fetchedAt<=now()&&now()-disk.fetchedAt<ttl){postgresHits++;const hit={url,at:disk.fetchedAt,data:disk.data,delivery:'postgres'};retain(cache,key,hit);return hit;}
   let p;
   try{
    p=provider(u.hostname);await acquire(p);
    try{
     p.lastAttemptAt=now();p.lastStatus='loading';reads++;const r=await fetcher(url,{method,body,headers:{accept:'application/json','user-agent':'AxoLocalResearch/1.0',...requestHeaders},redirect:'error',signal:AbortSignal.timeout(20000)});
     if(r.status===429){const raw=r.headers?.get('retry-after'),ms=Number(raw)>0?Number(raw)*1000:Date.parse(raw)-now();p.cooldownUntil=now()+Math.min(3600000,Math.max(60000,Number.isFinite(ms)?ms:0));p.lastStatus='rate limited';}
     if(!r.ok)throw Object.assign(Error('Public source HTTP '+r.status),{status:r.status});
     if(Number(r.headers?.get('content-length'))>2000000)throw Error('Public source size limit');
     let parts=[],size=0;for await(const part of r.body){size+=part.byteLength;if(size>2000000)throw Error('Public source size limit');parts.push(Buffer.from(part));}
     const value={url,at:now(),data:responseType==='text'?Buffer.concat(parts).toString('utf8'):JSON.parse(Buffer.concat(parts).toString('utf8')),delivery:'fresh'};
     retain(cache,key,value);failures.delete(key);p.lastStatus='available';p.failures=0;p.lastSuccessAt=value.at;
     if(safeRequest&&durable)await durable.put('source',id,{data:value.data,provider:sourceProvider(u.hostname),source:responseType,ttl,staleMs:Math.min(staleMs,86400000),fetchedAt:value.at}).catch(()=>{});
     return value;
    }catch(e){const endpointError=e.status>=400&&e.status<500&&e.status!==429;p.failures=endpointError?0:p.failures+1;if(p.lastStatus!=='rate limited'){p.lastStatus='unavailable';if(!endpointError)p.cooldownUntil=Math.max(p.cooldownUntil,now()+Math.min(60000,2000*2**Math.min(5,p.failures-1)));}throw e;}finally{release(p);}
   }catch(e){
    retain(failures,key,{until:now()+Math.min(60000,Math.max(e.status>=400&&e.status<500?30000:5000,(p?.cooldownUntil||now())-now()))});
    const last=memoryFallback();if(last){staleMemoryHits++;return last;}
    if(disk&&disk.staleUntil>now()&&disk.fetchedAt>0&&disk.fetchedAt<=now()&&disk.observedAt<=now()&&now()-disk.fetchedAt<ttl+Math.min(staleMs,86400000)){staleHits++;return {url,at:disk.fetchedAt,data:disk.data,delivery:'stale-postgres',staleUntil:disk.staleUntil};}throw e;
   }
  })();pending.set(key,task);try{return structuredClone(await task);}finally{pending.delete(key);}
 }
 async function get(...args){const scope=observationContext.getStore();if(scope)scope.reads++;try{const r=await read(...args);if(scope){if(r.at>0&&r.at<=now())scope.oldestAt=scope.oldestAt===null?r.at:Math.min(scope.oldestAt,r.at);else scope.partial=true;if(r.delivery?.startsWith('stale-'))scope.partial=true;}return r;}catch(e){if(scope)scope.partial=true;throw e;}}
 return {get,setStore:value=>{durable=value;cache.clear();failures.clear();},status:()=>({cached:cache.size,inFlight:pending.size,capacity:maxPending,maxProviderQueue:maxQueued,maxWaitMs,rejected,hits,coalesced:joins,upstreamReads:reads,postgresHits,stalePostgresHits:staleHits,staleMemoryHits,database:durable?.status()||{state:'disabled',enabled:false},providers:[...providers.values()].map(({queue,calls,...p})=>({...p,waiting:queue.length,callsLastMinute:calls.filter(t=>t>now()-60000).length}))})};
}
export const publicSources=createSourceCache();
