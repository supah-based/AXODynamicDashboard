import {AXO} from './axo-identity.mjs';
import {AXO_URLS,normalizeEcosystem} from './axo-ecosystem-api.mjs';
import {basedRequest} from './axo-based-market.mjs';
import {axoGeckoHolders,reconcileAxoHeader,selectedCatalogFallback} from './axo-header-sources.mjs';
import {publicSources} from './axo-source-cache.mjs';
export const HEADER_TTL=900000,HEADER_KEY=`robinhood:${AXO.address}:${AXO.pool}`;
const eq=(a,b)=>typeof a==='string'&&a.toLowerCase()===b.toLowerCase();
const validDate=(t,now)=>Number.isFinite(t)&&t>0&&t<=now;
// Explicit public projection: no wallet, balance, claim, credit or authorization data can enter this cache.
export function projectHeader(d,now=Date.now()){
 if(!d?.identity?.officialMatch||d.identity.chain!=='robinhood'||!eq(d.identity.address,AXO.address)||!eq(d.identity.pool,AXO.pool))throw Error('Public header identity mismatch');
 const fields={},p=d.market,source=id=>d.sources?.find(s=>s.id===id),field=(value,observedAt,fetchedAt,provider,url)=>({value,observedAt,fetchedAt,provider,url});
 const marketExact=p&&p.chain==='robinhood'&&eq(p.address,AXO.address)&&eq(p.pair,AXO.pool),priceAt=p?.priceObservedAt||p?.seenAt,windowAt=p?.windowObservedAt||p?.seenAt;
 if(marketExact&&Number.isFinite(p.price)&&p.price>0&&validDate(priceAt,now)){
  // Price and movement stay together as one market bundle. Mismatched windows are withheld, never mixed with an older bundle.
  const coherent=validDate(windowAt,now)&&Math.abs(windowAt-priceAt)<=300000;
  fields.market=field({price:p.price,change24:coherent&&Number.isFinite(p.change24)?p.change24:null,priceObservedAt:priceAt,windowObservedAt:coherent?windowAt:null},priceAt,p.fetchedAt||source('dex')?.fetchedAt||priceAt,p.provider,p.sourceUrl||p.url);
 }
 const h=d.holders,r=h?.lastReported,holderAt=h?.observedAt,latest=Number.isFinite(h?.current)&&validDate(holderAt,now)?{count:h.current,observedAt:holderAt,checkedAt:source('holders')?.fetchedAt||holderAt,source:h.source||'Exact token holder source',url:h.sourceUrl||AXO_URLS.holders}:r;
 if(Number.isSafeInteger(latest?.count)&&latest.count>=0&&validDate(latest.observedAt,now))fields.holders=field({count:latest.count},latest.observedAt,latest.checkedAt,latest.source,latest.url);
 const catalog=source('catalog');if(catalog?.status==='available'&&validDate(catalog.observedAt,now)&&Array.isArray(d.rewards?.selected))fields.rewards=field({selected:d.rewards.selected.map(a=>({address:a.address,symbol:a.symbol,weightBps:a.weightBps})),cycle:d.rewards.cycle?{mode:d.rewards.cycle.mode,progress:d.rewards.cycle.progress,nextAt:d.rewards.cycle.nextAt}:null},catalog.observedAt,catalog.fetchedAt,catalog.provider,catalog.url);
 return fields;
}
export function createPublicHeaderCache({load,now=Date.now,ttl=HEADER_TTL}={}){
 let fields={},job=null,nextRefreshAt=0,lastAttemptAt=null,lastCompletedAt=null,failures=0,lastError=null;
 const view=()=>({version:1,key:HEADER_KEY,identity:{chain:'robinhood',chainId:4663,address:AXO.address,pool:AXO.pool,officialMatch:true},ttlMs:ttl,lastAttemptAt,lastCompletedAt,nextRefreshAt,refreshing:!!job,lastError,fields:Object.fromEntries(['market','holders','rewards'].map(k=>{const f=fields[k];return [k,f?{...structuredClone(f),freshness:now()-f.observedAt<=ttl&&now()-f.fetchedAt<=ttl?'current':'stale',ageMs:now()-f.observedAt}:{value:null,observedAt:null,fetchedAt:null,freshness:'unknown'}]}))});
 function refresh(){if(job)return job;lastAttemptAt=now();job=(async()=>{try{const incoming=projectHeader(await load(),now());let complete=true;for(const k of ['market','holders','rewards']){const f=incoming[k];if(f&&validDate(f.fetchedAt,now())&&(!fields[k]||f.observedAt>=fields[k].observedAt)){fields[k]=f}else complete=false}lastCompletedAt=now();failures=complete?0:failures+1;lastError=complete?null:'Some public sources unavailable; prior dated fields retained';nextRefreshAt=now()+(complete?ttl:Math.min(ttl,60000*2**Math.min(failures-1,4)))}catch{failures++;lastError='Public source refresh unavailable; prior dated fields retained';nextRefreshAt=now()+Math.min(ttl,60000*2**Math.min(failures-1,4))}finally{job=null}})();return job}
 async function snapshot(){if(now()>=nextRefreshAt){const pending=refresh();if(!Object.keys(fields).length)await pending}return view()}
 async function handle(req,res,url){if(url.pathname!=='/api/axo-header')return false;if(req.method!=='GET'||url.search){res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:'Only fixed public header reads are supported'}));return true}res.writeHead(200,{'content-type':'application/json','cache-control':'public, max-age=0, must-revalidate','x-content-type-options':'nosniff'});res.end(JSON.stringify(await snapshot()));return true}
 return {snapshot,handle,settled:()=>job||Promise.resolve(),peek:view};
}
export function createHeaderLoader({source=publicSources,publicRewards,now=Date.now}={}){return async()=>{
 const input={sources:[]},keys=['config','basedPair','basedInsights','dex','holders','catalog','status','overview'];let index=0;
 async function worker(){while(index<keys.length){const key=keys[index++],url=AXO_URLS[key];try{const r=await source.get(url,{ttl:HEADER_TTL,...(key.startsWith('based')?basedRequest(key,now()):{})}),observedAt=Date.parse(r.data?.observedAt||r.data?.generatedAt);input[key]={data:r.data,at:r.at};input.sources.push({id:key,url,provider:new URL(url).hostname,fetchedAt:r.at,observedAt:Number.isFinite(observedAt)?observedAt:null,status:r.data?.status==='STALE'?'stale':'available'})}catch{input.sources.push({id:key,url,status:'unavailable',error:'Public source unavailable'})}}}
 await Promise.all([worker(),worker(),worker()]);
 if(publicRewards&&['catalog','overview','status'].some(k=>!input[k])){const captured=await publicRewards().catch(()=>null);for(const k of ['catalog','overview','status'])if(!input[k]&&captured?.data?.[k]){const r=captured.data[k],observedAt=Date.parse(r.data?.observedAt||r.data?.generatedAt);input[k]=r;input.sources=input.sources.filter(s=>s.id!==k);input.sources.push({id:k,url:AXO_URLS[k],provider:'Official public reward page',fetchedAt:r.at,observedAt:Number.isFinite(observedAt)?observedAt:null,status:r.data?.status==='STALE'?'stale':'available'})}}
 selectedCatalogFallback(input,now());const d=normalizeEcosystem(input,now());try{const url='https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/'+AXO.address+'/info',r=await source.get(url,{ttl:HEADER_TTL});reconcileAxoHeader(d,axoGeckoHolders(r.data,r.at,now()),now())}catch{}return d;
}}
