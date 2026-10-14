import {GECKO_NETWORKS,geckoPublic} from './axo-public-json.mjs';
const networks=GECKO_NETWORKS;
const frames={'15m':{unit:'minute',aggregate:15,limit:288,seconds:900},'1h':{unit:'hour',aggregate:1,limit:120,seconds:3600},'1d':{unit:'day',aggregate:1,limit:90,seconds:86400},'1w':{unit:'day',aggregate:1,limit:180,seconds:604800}};
const equal=(a,b,chain)=>typeof a==='string'&&typeof b==='string'&&(chain==='solana'?a===b:a.toLowerCase()===b.toLowerCase());
const addressOk=(s,chain)=>typeof s==='string'&&(chain==='solana'?/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s):/^0x[a-fA-F0-9]{40}$/.test(s));
export function cleanCandles(rows){const seen=new Map();for(const r of Array.isArray(rows)?rows:[]){if(!Array.isArray(r)||r.length<6||!r.slice(0,6).every(x=>typeof x==='number'&&Number.isFinite(x))||r[0]<=0||r[1]<=0||r[2]<Math.max(r[1],r[4])||r[3]>Math.min(r[1],r[4])||r[3]<=0||r[5]<0)continue;seen.set(r[0],r.slice(0,6))}return [...seen.values()].sort((a,b)=>a[0]-b[0])}
export function weeklyCandles(rows){const buckets=new Map();for(const r of rows){const d=new Date(r[0]*1000),day=(d.getUTCDay()+6)%7;const t=Math.floor(r[0]/86400)*86400-day*86400;let b=buckets.get(t);if(!b){b={t,o:r[1],h:r[2],l:r[3],c:r[4],v:0,count:0};buckets.set(t,b)}b.h=Math.max(b.h,r[2]);b.l=Math.min(b.l,r[3]);b.c=r[4];b.v+=r[5];b.count++}return [...buckets.values()].map(b=>[b.t,b.o,b.h,b.l,b.c,b.v,b.count])}
export function createHistoryApi({fetchImpl=fetch,now=Date.now}={}){
 const cache=new Map(),pending=new Map(),calls=[];
 async function get(url,ttl){if(fetchImpl===fetch)return geckoPublic.get(url,ttl);const old=cache.get(url);if(old&&now()-old.at<ttl)return old;if(pending.has(url))return pending.get(url);while(calls.length&&calls[0]<now()-60000)calls.shift();if(calls.length>=20)throw new Error('Chart provider request limit reached. Retry in a minute.');calls.push(now());const job=(async()=>{const r=await fetchImpl(url,{headers:{accept:'application/json;version=20230302'},signal:AbortSignal.timeout(18000)});if(!r.ok)throw new Error(r.status===429?'Chart provider is rate limited. Retry shortly.':'Chart provider has no accessible data for this exact pool.');const data=await r.json();cache.set(url,{at:now(),data});if(cache.size>120)cache.delete(cache.keys().next().value);return {at:now(),data}})();pending.set(url,job);try{return await job}finally{pending.delete(url)}}
 async function history({chain,address,pool,timeframe='1h'}){
  if(!Object.hasOwn(frames,timeframe)||!addressOk(address,chain)||!(addressOk(pool,chain)||chain==='robinhood'&&/^0x[a-fA-F0-9]{64}$/.test(pool)))throw new Error('Select a valid exact token, pool and timeframe.');
  if(!networks[chain])return {status:'unavailable',reason:'No verified GeckoTerminal network mapping for this chain.',chain,address,pool,timeframe,candles:[]};
  const base='https://api.geckoterminal.com/api/v2/networks/'+networks[chain]+'/pools/'+encodeURIComponent(pool);
  const detail=(await get(base+'?include=base_token,quote_token',300000)).data;
  if(!equal(detail.data?.attributes?.address,pool,chain))throw new Error('Provider pool identity does not match the requested pool.');
  const rel=detail.data?.relationships,ids=[rel?.base_token?.data?.id,rel?.quote_token?.data?.id];
  if(!(detail.included||[]).some(x=>ids.includes(x.id)&&equal(x.attributes?.address,address,chain)))throw new Error('Requested token was not verified in this pool. No substitute was selected.');
  const f=frames[timeframe],params=new URLSearchParams({aggregate:String(f.aggregate),limit:String(f.limit),currency:'usd',token:address,include_empty_intervals:'false'});
  const data=await get(base+'/ohlcv/'+f.unit+'?'+params,120000);let candles=cleanCandles(data.data?.data?.attributes?.ohlcv_list);
  if(timeframe==='1w')candles=weeklyCandles(candles);
  return {status:candles.length?'available':'unavailable',reason:candles.length?null:'No trading candles are available for this exact pool and token.',chain,network:networks[chain],address,pool,timeframe,currency:'USD',bucketSeconds:f.seconds,candles,receivedAt:data.at,requestedAt:now(),range: candles.length?[candles[0][0],candles.at(-1)[0]]:null,source:'GeckoTerminal',url:'https://www.geckoterminal.com/'+networks[chain]+'/pools/'+encodeURIComponent(pool),notes:timeframe==='1w'?'UTC Monday weeks aggregated from real daily OHLCV. Weeks may be partial; missing days are not filled.':'UTC buckets. Empty intervals are omitted; newest candle may be incomplete. History is limited by the pool/provider.'};
 }
 async function handle(req,res,url){if(url.pathname!=='/api/ohlcv')return false;let data,status=200;try{if(req.method!=='GET'){status=405;throw new Error('GET required.')}data=await history(Object.fromEntries(url.searchParams))}catch(e){status=status===405?405:502;data={status:'unavailable',reason:e.message,candles:[]}}res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));return true}
 return {history,handle};
}
