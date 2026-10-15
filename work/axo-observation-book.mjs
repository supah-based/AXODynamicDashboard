import fs from 'node:fs/promises';
import path from 'node:path';
import Stream from './axo-stream-schema.cjs';
import Risk from './axo-risk-policy.cjs';
import {digest} from './axo-durable-store.mjs';

const TTL=86400000,cacheKey=digest('public-observation-book-v1');
const valid=(v)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e18;
const recent=(at,now,ttl=300000)=>Number.isFinite(at)&&at>0&&at<=now&&now-at<=ttl;
const pct=(a,b)=>valid(a)&&valid(b)&&b>0?(a/b-1)*100:null;
function scope(p){try{const i=Stream.exact({chain:p.chain,address:p.address,pool:p.pair||p.pool},true);if(typeof p.provider!=='string'||!p.provider.trim()||p.provider.length>100||p.provider.startsWith('AXO cached'))return null;return {...i,provider:p.provider};}catch{return null;}}
function point(p,d,now){
 if(!recent(p.seenAt,now)||p.observationStatus==='stale')return null;
 const tx=p.transactions?.m5,count=k=>Number.isSafeInteger(tx?.[k])&&tx[k]>=0?tx[k]:null;
 const exact=d?.source==='GoPlus'&&d.status==='available'&&d.chain===p.chain&&Risk.eq(d.address,p.address,p.chain)&&recent(d.receivedAt,now);
 return {at:p.seenAt,price:valid(p.price)?p.price:null,liquidity:valid(p.liquidity)?p.liquidity:null,v5:valid(p.volume5)?p.volume5:null,v1:valid(p.volume1)?p.volume1:null,buys:count('buys'),sells:count('sells'),holders:exact&&Number.isSafeInteger(d.holderCount)&&d.holderCount>=0?d.holderCount:null,holdersAt:exact?d.receivedAt:null};
}
const active=p=>p.v1>=5000&&p.v5>=0&&p.v1>p.v5&&p.v5/((p.v1-p.v5)/11)>=2&&p.buys!==null&&p.sells!==null&&p.buys+p.sells>=10;
export function createObservationBook({file=null,store=null,now=Date.now}={}){
 const series=new Map();let loading=null,loaded=false,storage='memory',timer=null,write=Promise.resolve(),dirty=false;
 const key=i=>JSON.stringify(i);
 function trim(){for(const [k,r]of series){r.points=r.points.filter(p=>recent(p.at,now(),TTL)).slice(-16);if(!r.points.length)series.delete(k);}const sorted=[...series].sort((a,b)=>b[1].points.at(-1).at-a[1].points.at(-1).at),chains=[...new Set(sorted.map(([,r])=>r.identity.chain))],groups=chains.map(c=>sorted.filter(([,r])=>r.identity.chain===c));series.clear();while(series.size<80&&groups.some(g=>g.length))for(const g of groups)if(g.length&&series.size<80){const [k,r]=g.shift();series.set(k,r);}}
 function restore(d){if(d?.version!==1||!Array.isArray(d.series))return;for(const r of d.series.slice(0,80)){const i=scope({...r.identity,pair:r.identity?.pool});if(!i||!Array.isArray(r.points))continue;const pts=r.points.slice(-16).filter(p=>recent(p.at,now(),TTL)&&['price','liquidity','v5','v1','holders'].every(k=>p[k]===null||valid(p[k]))&&['buys','sells'].every(k=>p[k]===null||Number.isSafeInteger(p[k])&&p[k]>=0)&&(!p.holdersAt||recent(p.holdersAt,now(),TTL))).map(p=>Object.fromEntries(['at','price','liquidity','v5','v1','buys','sells','holders','holdersAt'].map(k=>[k,p[k]??null]))).sort((a,b)=>a.at-b.at),unique=[];for(const p of pts)if(!unique.length||p.at-unique.at(-1).at>=60000)unique.push(p);if(!unique.length)continue;const old=series.get(key(i));if(!old||old.points.at(-1).at<unique.at(-1).at)series.set(key(i),{identity:i,points:unique});}trim();}
 async function ready(){if(loaded)return;if(loading)return loading;loading=(async()=>{if(file)try{if((await fs.stat(file)).size>1000000)throw Error();restore(JSON.parse(await fs.readFile(file,'utf8')));storage='local';}catch(e){if(e.code!=='ENOENT')storage='history_unavailable';}if(store?.enabled)try{const d=await store.get('source',cacheKey);if(d){restore(d.data);storage='database';}}catch{}loaded=true;})();return loading;}
 function save(){clearTimeout(timer);timer=null;if(!dirty)return write;dirty=false;trim();let rows=[...series.values()],data={version:1,series:rows};while(Buffer.byteLength(JSON.stringify(data))>220000&&rows.length){rows=rows.slice(0,-1);data={version:1,series:rows};}const text=JSON.stringify(data),at=now();write=write.catch(()=>{}).then(async()=>{if(file)try{await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file+'.tmp',text,{mode:0o600});await fs.rename(file+'.tmp',file);storage='local';}catch{storage='history_unavailable';}if(store?.enabled)try{if(await store.put('source',cacheKey,{data,provider:'Axo comparable public observations',source:'exact pool and provider history',fetchedAt:at,ttl:TTL}))storage='database';}catch{}});return write;}
 function observe(p,d=null){const i=scope(p),sample=i&&point(p,d,now());if(!sample)return view(p);const k=key(i),old=series.get(k);if(!old||sample.at-old.points.at(-1).at>=60000){if(!old)series.set(k,{identity:i,points:[sample]});else old.points.push(sample);trim();dirty=true;if(!timer){timer=setTimeout(save,250);timer.unref?.();}}return view(p,d);}
 function view(p,d=null){
  const i=scope(p),current=i&&point(p,d,now());if(!current)return {status:'unavailable',reason:'Fresh exact-pool observation with original provider required',sustained:false};
  const row=series.get(key(i)),points=(row?.points||[]).filter(x=>x.at<=current.at&&current.at-x.at<=900000),last=points.at(-1),latest=last?.at===current.at?{...last,...(current.holdersAt?{holders:current.holders,holdersAt:current.holdersAt}:{})}:current;
  const before=points.filter(x=>current.at-x.at>=120000).sort((a,b)=>Math.abs(current.at-a.at-300000)-Math.abs(current.at-b.at-300000))[0],tail=[...points.filter(x=>x.at<latest.at),latest].slice(-3),sustained=tail.length===3&&tail[2].at-tail[0].at>=120000&&tail.every((x,j)=>active(x)&&(!j||x.at-tail[j-1].at>=60000));
  const holderBefore=points.filter(x=>latest.holdersAt&&x.holdersAt&&x.holdersAt<latest.holdersAt&&latest.holdersAt-x.holdersAt>=120000&&latest.holdersAt-x.holdersAt<=900000&&x.holders!==null).sort((a,b)=>a.holdersAt-b.holdersAt)[0];
  return {version:1,status:before?'available':'collecting',identity:i,observedAt:current.at,from:before?.at||null,samples:points.length+(last?.at===current.at?0:1),windowMinutes:before?(current.at-before.at)/60000:null,pricePct:before?pct(current.price,before.price):null,liquidityPct:before?pct(current.liquidity,before.liquidity):null,rollingVolume1Pct:before?pct(current.v1,before.v1):null,holderDelta:holderBefore&&latest.holders!==null?latest.holders-holderBefore.holders:null,holderFrom:holderBefore?.holdersAt||null,holderTo:latest.holdersAt||null,sustained,confirmation:sustained?'Activity pace observed on three spaced snapshots':'Repeated activity not confirmed',basis:'Same exact pool and named provider, original retrieval dates; USD liquidity changes are not net flows, rolling-volume windows overlap, and holder counts measure addresses. No return forecast.'};
 }
 return {ready,observe,view,flush:save,status:()=>({loaded,storage,series:series.size,snapshots:[...series.values()].reduce((n,r)=>n+r.points.length,0),limit:80,policy:'Public comparable reports only; no user holdings, screenshot estimates or source mixing'})};
}
