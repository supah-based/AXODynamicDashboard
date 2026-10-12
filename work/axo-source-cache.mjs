import {createHash} from 'node:crypto';
import {digest} from './axo-durable-store.mjs';
const policies={geckoterminal:{spacing:6000,perMinute:24,concurrency:2},dexscreener:{spacing:500,perMinute:120,concurrency:3},coingecko:{spacing:2200,perMinute:25,concurrency:2},defillama:{spacing:350,perMinute:100,concurrency:3},default:{spacing:1000,perMinute:40,concurrency:2}};
export function sourceProvider(host){return host.includes('geckoterminal')?'geckoterminal':host.includes('dexscreener')?'dexscreener':host.includes('coingecko')?'coingecko':/llama\.fi$|defillama\.com$/.test(host)?'defillama':host}
export function createSourceCache({fetchImpl=fetch,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),policy={},store=null,staleMs=3600000}={}){const cache=new Map(),pending=new Map(),providers=new Map();let durable=store,hits=0,joins=0,reads=0,postgresHits=0,staleHits=0;
 function provider(host){const name=sourceProvider(host);if(!providers.has(name))providers.set(name,{name,...(policies[name]||policies.default),...policy[name],active:0,nextAt:0,calls:[],cooldownUntil:0,queue:[],lastStatus:'not checked',lastAttemptAt:null,lastSuccessAt:null});return providers.get(name)}
 async function acquire(p){if(p.active>=p.concurrency)await new Promise(r=>p.queue.push(r));else p.active++;try{p.calls=p.calls.filter(t=>t>now()-60000);if(now()<p.cooldownUntil)throw new Error('Provider cooldown; retry later');const slot=Math.max(now(),p.nextAt,p.calls.length>=p.perMinute?p.calls[p.calls.length-p.perMinute]+60000:0);p.nextAt=slot+p.spacing;if(slot>now())await sleep(slot-now());if(now()<p.cooldownUntil)throw new Error('Provider cooldown; retry later');p.calls=p.calls.filter(t=>t>now()-60000);if(p.calls.length>=p.perMinute)throw new Error('Provider minute budget reached');p.calls.push(now())}catch(e){release(p);throw e}}
 function release(p){const next=p.queue.shift();if(next)next();else p.active--}
 async function get(url,{ttl=120000,method='GET',body,headers={},responseType='json',fetcher=fetchImpl}={}){
  const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw new Error('Public HTTPS source required');
  const key=responseType+':'+method+':'+url+':'+createHash('sha256').update(body||'').digest('hex'),id=digest({method,url,bodyHash:createHash('sha256').update(body||'').digest('hex'),responseType});
  const old=cache.get(key);if(old&&old.at<=now()&&now()-old.at<ttl){hits++;return {...old,delivery:'cached'}}
  if(pending.has(key)){joins++;return pending.get(key)}
  const safeRequest=method==='GET'&&!body&&!Object.keys(headers).some(k=>/authorization|cookie|api.key|token/i.test(k))&&!Array.from(u.searchParams.keys()).some(k=>/key|token|secret|auth|signature|password/i.test(k));
  const task=(async()=>{
   const disk=safeRequest&&durable?await durable.get('source',id,{allowStale:true}):null;
   if(disk&&!disk.stale&&disk.fetchedAt<=now()&&now()-disk.fetchedAt<ttl){postgresHits++;const hit={url,at:disk.fetchedAt,data:disk.data,delivery:'postgres'};cache.set(key,hit);return hit}
   const p=provider(u.hostname);
   try{await acquire(p);try{p.lastAttemptAt=now();reads++;const r=await fetcher(url,{method,body,headers:{accept:'application/json','user-agent':'AxoLocalResearch/1.0',...headers},redirect:'error',signal:AbortSignal.timeout(20000)});if(r.status===429){const raw=r.headers?.get('retry-after'),ms=Number(raw)>0?Number(raw)*1000:Date.parse(raw)-now();p.cooldownUntil=now()+Math.min(3600000,Math.max(60000,Number.isFinite(ms)?ms:0))}if(!r.ok){p.lastStatus=r.status===429?'rate limited':'unavailable';throw new Error('Public source HTTP '+r.status)}if(Number(r.headers?.get('content-length'))>2000000)throw new Error('Public source size limit');let parts=[],size=0;for await(const part of r.body){size+=part.byteLength;if(size>2000000)throw new Error('Public source size limit');parts.push(Buffer.from(part))}const value={url,at:now(),data:responseType==='text'?Buffer.concat(parts).toString('utf8'):JSON.parse(Buffer.concat(parts).toString('utf8')),delivery:'fresh'};cache.set(key,value);while(cache.size>300)cache.delete(cache.keys().next().value);p.lastStatus='available';p.lastSuccessAt=value.at;
    if(safeRequest&&durable)await durable.put('source',id,{data:value.data,provider:sourceProvider(u.hostname),source:responseType,ttl:Math.min(ttl,7*86400000),staleMs:Math.min(staleMs,86400000),fetchedAt:value.at}).catch(()=>{});
    return value}catch(e){if(p.lastStatus!=='rate limited')p.lastStatus='unavailable';throw e}finally{release(p)}}catch(e){if(disk&&disk.stale&&disk.staleUntil>now()&&disk.fetchedAt<=now()&&disk.observedAt<=now()){staleHits++;return {url,at:disk.fetchedAt,data:disk.data,delivery:'stale-postgres',staleUntil:disk.staleUntil}}throw e}
  })();pending.set(key,task);try{return await task}finally{pending.delete(key)}
 }

 return {get,setStore:value=>{durable=value;cache.clear()},status:()=>({cached:cache.size,inFlight:pending.size,hits,coalesced:joins,upstreamReads:reads,postgresHits,stalePostgresHits:staleHits,database:durable?.status()||{state:'disabled',enabled:false},providers:[...providers.values()].map(({queue,calls,...p})=>({...p,waiting:queue.length,callsLastMinute:calls.filter(t=>t>now()-60000).length}))})};
}
export const publicSources=createSourceCache();
