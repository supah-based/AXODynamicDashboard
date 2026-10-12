import {publicSources} from './axo-source-cache.mjs';
// Shared public GeckoTerminal transport: discovery and candle reads share a budget.
// Robinhood verified against the live /networks?page=3 directory and exact pool endpoint on 2026-10-11.
export const GECKO_NETWORKS=Object.freeze({solana:'solana',base:'base',bsc:'bsc',ethereum:'eth',robinhood:'robinhood'});
export function createPublicJson({fetchImpl=fetch,now=Date.now}={}){
 const cache=new Map(),pending=new Map(),calls=[];let active=0,cooldown=0,nextDispatch=0;const queue=[];
 async function get(url,ttl=300000){
  const u=new URL(url);if(u.origin!=='https://api.geckoterminal.com'||!u.pathname.startsWith('/api/v2/'))throw new Error('Source is not allowlisted');
  const old=cache.get(url);if(old&&now()-old.at<ttl)return old;if(pending.has(url))return pending.get(url);
  const job=(async()=>{if(active>=2)await new Promise(r=>queue.push(r));active++;
   try{if(now()<cooldown)throw new Error('Public source cooldown; retry later');if(fetchImpl===fetch){const slot=Math.max(now(),nextDispatch);nextDispatch=slot+6000;if(slot>now())await new Promise(resolve=>setTimeout(resolve,slot-now()))}while(calls.length&&calls[0]<=now()-60000)calls.shift();if(now()<cooldown||calls.length>=24)throw new Error('Public source cooldown; retry later');calls.push(now());
    const r=await fetchImpl(url,{redirect:'error',headers:{accept:'application/json;version=20230302'},signal:AbortSignal.timeout(16000)});
    if(r.status===429)cooldown=now()+Math.min(300000,Math.max(60000,(Number(r.headers.get('retry-after'))||60)*1000));
    if(!r.ok)throw new Error('Public source HTTP '+r.status);if(Number(r.headers.get('content-length'))>2000000)throw new Error('Source size limit');
    let bytes=0,parts=[];for await(const part of r.body){bytes+=part.length;if(bytes>2000000)throw new Error('Source size limit');parts.push(part)}
    const value={at:now(),data:JSON.parse(Buffer.concat(parts).toString('utf8')),url};cache.set(url,value);while(cache.size>160)cache.delete(cache.keys().next().value);return value;
   }finally{active--;queue.shift()?.()}
  })();pending.set(url,job);try{return await job}finally{pending.delete(url)}
 }
 return {get};
}
export const geckoPublic={get:(url,ttl=300000)=>{const u=new URL(url);if(u.origin!=='https://api.geckoterminal.com'||!u.pathname.startsWith('/api/v2/'))return Promise.reject(new Error('Source is not allowlisted'));return publicSources.get(url,{ttl,headers:{accept:'application/json;version=20230302'}})}};

