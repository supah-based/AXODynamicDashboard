import {randomUUID} from 'node:crypto';
import Stream from './axo-stream-schema.cjs';
const mapping={solana:'sol',base:'base',bsc:'bsc'},number=v=>(typeof v==='number'||typeof v==='string'&&v.trim())&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const count=v=>{const n=number(v);return Number.isSafeInteger(n)?n:null;},rate=v=>{const n=number(v);return n!==null&&n<=1?n:null;};
export function normalizeGmgn(raw,identity,receivedAt){
 const p=raw?.data,chain=mapping[identity.chain],same=typeof p?.address==='string'&&(identity.chain==='solana'?p.address===identity.address:p.address.toLowerCase()===identity.address.toLowerCase());
 if(![0,'0'].includes(raw?.code)||!p||!same||p.chain&&p.chain!==chain)throw Error('GMGN exact-token schema mismatch');
 return {status:'available',source:'GMGN Agent API',sourceUrl:'https://docs.gmgn.ai/index/gmgn-agent-api',chain:identity.chain,address:identity.address,scope:'token-level provider report; not exact-pool execution evidence',receivedAt,observedAt:null,holderCount:count(p.holder_count),top10Rate:rate(p.stat?.top_10_holder_rate),walletLabels:{smart:count(p.wallet_tags_stat?.smart_wallets),sniper:count(p.wallet_tags_stat?.sniper_wallets),bundler:count(p.wallet_tags_stat?.bundler_wallets)},priceUsd:number(p.price?.price),liquidityUsd:number(p.liquidity),activity:Object.fromEntries(['5m','1h','24h'].map(w=>[w,{volumeUsd:number(p.price?.['volume_'+w]),buyVolumeUsd:number(p.price?.['buy_volume_'+w]),sellVolumeUsd:number(p.price?.['sell_volume_'+w]),buys:count(p.price?.['buys_'+w]),sells:count(p.price?.['sells_'+w])}])),reportedRatios:{devTeam:rate(p.stat?.dev_team_hold_rate),creator:rate(p.stat?.creator_hold_rate),insiderVolume:rate(p.stat?.top_rat_trader_percentage),bundlerVolume:rate(p.stat?.top_bundler_trader_percentage),botHolders:rate(p.stat?.bot_degen_rate)},limits:'Retrieval time only; source observation time is not established. Provider wallet labels are not independently verified identities. No safety, holder-growth or trading permission is inferred.'};
}
export function createGmgnData({apiKey=()=>null,fetchImpl=fetch,now=Date.now}={}){
 const cache=new Map(),pending=new Map(),calls=[];let cooldownUntil=0,lastState='not_checked';
 const gap=(p,status)=>({status,source:'GMGN Agent API',chain:p.chain,address:p.address,observedAt:null,receivedAt:null});
 const fresh=value=>value?.status==='available'&&Number.isFinite(value.receivedAt)&&value.receivedAt>0&&value.receivedAt<=now()&&now()-value.receivedAt<120000&&!value.refreshStatus;
 const retained=value=>value?.status==='available'&&Number.isFinite(value.receivedAt)&&value.receivedAt>0&&value.receivedAt<=now()&&now()-value.receivedAt<=900000;
 function put(key,value,nextAt){cache.set(key,{value,nextAt});while(cache.size>100)cache.delete(cache.keys().next().value);return structuredClone(value);}
 function failure(p,key,status){lastState=status;const old=cache.get(key)?.value,value=retained(old)?{...old,stale:true,refreshStatus:status,refreshCheckedAt:now()}:gap(p,status);return put(key,value,Math.max(now()+30000,cooldownUntil));}
 async function jsonBody(r,max=2000000){let bytes=0,parts=[];for await(const part of r.body){bytes+=part.byteLength;if(bytes>max)throw Error('Response too large');parts.push(Buffer.from(part));}return JSON.parse(Buffer.concat(parts).toString('utf8'));}
 function cooldown(r,raw=null){const header=r?.headers?.get('retry-after'),seconds=header==null?NaN:Number(header),retry=Number.isFinite(seconds)?seconds*1000:Date.parse(header)-now(),reset=Number(r?.headers?.get('X-RateLimit-Reset')||raw?.reset_at)*1000,base=[429,'429'].includes(raw?.code)?300000:60000;cooldownUntil=now()+Math.min(3600000,Math.max(base,Number.isFinite(retry)?retry:0,Number.isFinite(reset)?reset-now():0));}
 async function info(input){
  const p=Stream.exact(input),key=p.chain+':'+p.address;if(!mapping[p.chain])return gap(p,'unsupported');const credential=apiKey();if(!credential)return gap(p,'not_configured');
  const old=cache.get(key);if(old&&old.nextAt>now()&&(old.value.status!=='available'||retained(old.value)))return structuredClone({...old.value,...(old.value.status==='available'&&!fresh(old.value)?{stale:true}:{})});
  if(old?.value.status==='available'&&!retained(old.value))cache.delete(key);
  if(pending.has(key))return structuredClone(await pending.get(key));
  while(calls.length&&calls[0]<=now()-60000)calls.shift();if(now()<cooldownUntil||calls.length>=6||pending.size>=1)return failure(p,key,'waiting');calls.push(now());
  const task=Promise.resolve().then(async()=>{try{
   const url=new URL('https://openapi.gmgn.ai/v1/token/info');url.search=new URLSearchParams({chain:mapping[p.chain],address:p.address,timestamp:String(Math.floor(now()/1000)),client_id:randomUUID()});
   const r=await fetchImpl(url.href,{method:'GET',redirect:'error',headers:{'X-APIKEY':credential,accept:'application/json'},signal:AbortSignal.timeout(12000)});
   if(!r.ok){let error=null;try{error=await jsonBody(r,16000);}catch{}cooldown(r,error);return failure(p,key,r.status===401||r.status===403?'access_required':r.status===402?'payment_required':r.status===429?'rate_limited':'unavailable');}
   const raw=await jsonBody(r);if([429,'429'].includes(raw.code)){cooldown(r,raw);return failure(p,key,'rate_limited');}
   const value={...normalizeGmgn(raw,p,now()),stale:false};lastState='available';return put(key,value,now()+120000);
  }catch{return failure(p,key,'schema_or_transport_gap');}finally{pending.delete(key);}});
  pending.set(key,task);return structuredClone(await task);
 }
 return {info,status:()=>({configured:Boolean(apiKey()),status:apiKey()?lastState:'not_configured',active:pending.size,cached:cache.size,cooldownUntil,capability:'Read-only token info; preserved dated reports on failed refresh, no wallet key, signatures, trades or account calls',supportedChains:Object.keys(mapping)})};
}
