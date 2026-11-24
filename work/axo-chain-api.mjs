import AxoStablecoins from './axo-stablecoins.cjs';
import {momentumEvidence} from './axo-market-framework.mjs';
import fs from 'node:fs/promises';
import AxoChainOverview from './axo-chain-overview.cjs';
import {publicSources} from './axo-source-cache.mjs';
import {GECKO_NETWORKS,geckoPublic} from './axo-public-json.mjs';
import {normalizePair} from './axo-project-model.mjs';
import {mediaUrl} from './axo-media.mjs';
export const CHAIN_NAMES={solana:'Solana',base:'Base',bsc:'BNB Chain',robinhood:'Robinhood',arc:'Arc'};
const DAY=86400000,REFRESH=300000,RETAIN=900000,eq=(a,b,c)=>typeof a==='string'&&typeof b==='string'&&(c==='solana'?a===b:a.toLowerCase()===b.toLowerCase());
export const chainAddress=(a,c,pool=false)=>typeof a==='string'&&(c==='solana'?/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a):new RegExp('^0x(?:[a-fA-F0-9]{40}'+(pool?'|[a-fA-F0-9]{64}':'')+')$').test(a));
const currentAt=(at,now,limit=REFRESH)=>Number.isFinite(at)&&at>0&&at<=now&&now-at<=limit;
const exactOn=(p,chain)=>p?.chain===chain&&chainAddress(p.address,chain)&&chainAddress(p.pair,chain,true);
const providerPoolKey=p=>p.chain+':'+(p.chain==='solana'?p.pair:p.pair.toLowerCase());
export const isLaunchCurveDex=dex=>/^(pump-?fun|moonshot|moonit|four-?meme|flap)$/i.test(dex||'');

export function normalizeGecko(d,chain,at=Date.now(),sample='top'){
 if(!GECKO_NETWORKS[chain])return [];const included=new Map((d.included||[]).map(x=>[x.id,x]));
 return (Array.isArray(d.data)?d.data:[]).flatMap(row=>{
  const a=row.attributes||{},b=included.get(row.relationships?.base_token?.data?.id),q=included.get(row.relationships?.quote_token?.data?.id),token=b?.attributes,quote=q?.attributes;
  if(row.type!=='pool'||!chainAddress(a.address,chain,true)||!eq(row.id,GECKO_NETWORKS[chain]+'_'+a.address,chain)||!chainAddress(token?.address,chain)||!eq(b.id,GECKO_NETWORKS[chain]+'_'+token.address,chain)||!chainAddress(quote?.address,chain)||!eq(q.id,GECKO_NETWORKS[chain]+'_'+quote.address,chain))return [];
  const created=Date.parse(a.pool_created_at),dex=row.relationships?.dex?.data?.id;
  const p=normalizePair({chainId:chain,pairAddress:a.address,baseToken:token,quoteToken:quote,dexId:dex,priceUsd:a.base_token_price_usd,liquidity:{usd:a.reserve_in_usd},volume:a.volume_usd,priceChange:a.price_change_percentage,txns:a.transactions,marketCap:a.market_cap_usd,fdv:a.fdv_usd,pairCreatedAt:Number.isFinite(created)&&created<=at?created:null,url:'https://www.geckoterminal.com/'+GECKO_NETWORKS[chain]+'/pools/'+a.address},at);
  const participants=Object.fromEntries(Object.entries(p.transactions).map(([window,tx])=>{
   const raw=a.transactions?.[window];
   const count=(value,max)=>Number.isSafeInteger(value)&&value>=0&&Number.isSafeInteger(max)&&value<=max?value:null;
   const buyers=count(raw?.buyers,tx.buys),sellers=count(raw?.sellers,tx.sells);
   const total=tx.buys!==null&&tx.sells!==null?tx.buys+tx.sells:null;
   const unique=count(raw?.unique_traders,total);
   return [window,{buyers,sellers,unique:unique!==null&&unique>=Math.max(buyers??0,sellers??0)?unique:null}];
  }));
  return [{...p,participants,coingeckoId:token.coingecko_coin_id||null,imageUrl:mediaUrl(token.image_url),provider:'GeckoTerminal',sourceSample:sample,observationStatus:'available',quoteAddress:quote.address,curve:isLaunchCurveDex(dex),boosts:null}];
 });
}
export function deepestProjects(rows){const m=new Map();for(const p of rows){const key=p.chain+':'+(p.chain==='solana'?p.address:p.address.toLowerCase()),old=m.get(key);if(!old||(p.liquidity??-1)>(old.liquidity??-1))m.set(key,p)}return [...m.values()]}
export function chainScreens(pools,{now=Date.now(),minLiquidity=1000}={}){
 const rows=deepestProjects(pools).filter(p=>AxoStablecoins.isSuggestedProject(p)&&!p.curve&&p.observationStatus!=='stale'&&p.seenAt<=now&&now-p.seenAt<=15*60000&&p.liquidity>=minLiquidity),rankable=rows.filter(p=>p.liquidity>=Math.max(50000,minLiquidity)&&p.volume24>=10000);
 return {leaders:rankable.filter(p=>p.change24!==null&&p.change24>0).sort((a,b)=>b.change24-a.change24),activity:rankable.sort((a,b)=>b.volume24-a.volume24),new:rows.filter(p=>p.createdAt&&p.createdAt<=now&&now-p.createdAt<=7*DAY).sort((a,b)=>b.createdAt-a.createdAt),established:rows.filter(p=>p.createdAt&&now-p.createdAt>=30*DAY&&p.liquidity>=Math.max(100000,minLiquidity)&&p.volume24>=10000).sort((a,b)=>b.liquidity-a.liquidity)};
}
export function createChainApi({getState,getEcosystem,gecko=geckoPublic,dex=publicSources,getSeeds=()=>[],getCandidateSeeds=null,getNativeSeeds=null,getPreviewSeeds=null,refreshHead=null,cachePath=null,now=Date.now}={}){
 const snapshots=new Map(),jobs=new Map(),attempts=new Map(),rounds=new Map(),chainIds=Object.keys(CHAIN_NAMES);
 let loaded=null,writes=Promise.resolve(),nextChain=0;
 async function load(){if(loaded)return loaded;loaded=(async()=>{if(!cachePath)return;try{const saved=JSON.parse(await fs.readFile(cachePath,'utf8'));for(const [chain,d]of Object.entries(saved.snapshots||{})){if(!Object.hasOwn(CHAIN_NAMES,chain)||d.chain!==chain||!Number.isFinite(d.asOf)||d.asOf>now()||now()-d.asOf>7*86400000)continue;const pools=(d.pools||[]).filter(p=>p.chain===chain&&chainAddress(p.address,chain)&&chainAddress(p.pair,chain,true)&&p.seenAt>0&&p.seenAt<=now()).slice(0,240);snapshots.set(chain,{...d,pools})}}catch{}})();return loaded}
 async function save(){if(!cachePath)return;writes=writes.catch(()=>{}).then(async()=>{await fs.writeFile(cachePath+'.tmp',JSON.stringify({version:1,snapshots:Object.fromEntries(snapshots)}));await fs.rename(cachePath+'.tmp',cachePath)});await writes.catch(()=>{})}
 async function initial(chain){
  if(!Object.hasOwn(CHAIN_NAMES,chain))throw Error('Unsupported chain');
  await load();
  const data=local(chain);
  if(!data.pools.length)return snapshot(chain);
  const refreshing=jobs.has(chain)||now()-(attempts.get(chain)??-Infinity)>=REFRESH;
  if(refreshing)void snapshot(chain).catch(()=>{});
  return {...data,refreshing,delivery:'cached public observations'};
 }
 async function refreshNext(){
  const chain=chainIds[nextChain];
  nextChain=(nextChain+1)%chainIds.length;
  return snapshot(chain);
 }
 async function prime(){
  await load();
  for(let i=0;i<chainIds.length;i++)try{await refreshNext();}catch{}
 }

 function local(chain){const state=getState(),d=snapshots.get(chain)||{chain,name:CHAIN_NAMES[chain],asOf:null,pools:[],sources:[],status:'loading',sample:'Awaiting public sample'};
  const feed=id=>{const f=state.feeds?.[id];return {...f,status:f?.receivedAt&&now()-f.receivedAt>15*60000?'stale':f?.status||'unavailable'}};
  const news=state.feeds?.news?.data,items=(news?.items||[]).filter(a=>a.chains?.includes(chain)&&!a.promotional&&a.publishedAt&&a.publishedAt<=now()).slice(0,40);
  const pads=(state.feeds?.dex?.data?.launchpads||[]).filter(p=>p.chains?.includes(({bsc:'BSC',robinhood:'Robinhood Chain'})[chain]||CHAIN_NAMES[chain])).map(p=>({name:p.name,slug:p.slug,association:'DefiLlama listed chain membership',url:'https://defillama.com/protocol/'+encodeURIComponent(p.slug),volume:null,note:'Chain-attributable launchpad volume and constituent feed unavailable.'}));
  const expired=d.asOf&&now()-d.asOf>15*60000;
  return {...d,status:expired?'stale':d.status,pools:d.pools.map(p=>({...p,observationStatus:expired||now()-p.seenAt>15*60000?'stale':p.observationStatus})),dex:feed('dex-'+chain),capital:feed('capital-'+chain),tvl:feed('tvl-'+chain),momentum:momentumEvidence(d.pools.filter(p=>AxoStablecoins.isSuggestedProject(p)),feed('dex-'+chain),now()),launchpads:pads,news:{items,sources:news?.sources||[],method:'Exact chain headline/category rule or primary publisher association. Inferred relevance, not article-body verification.'}};
 }
 async function readPoolSource(id,provider,url,read,pick){
  try{
   const result=await read(url);
   if(!currentAt(result.at,now(),RETAIN)){
    return {source:{id,provider,url,status:'stale',fetchedAt:result.at,returned:0},rows:[]};
   }
   const stale=String(result.delivery).startsWith('stale-')||!currentAt(result.at,now());
   const rows=pick(result).map(p=>({...p,observationStatus:stale?'stale':'available'}));
   const status=stale?'stale':rows.length?'available':'unavailable';
   return {source:{id,provider,url,status,fetchedAt:result.at,returned:rows.length},rows};
  }catch(error){
   return {source:{id,provider,url,status:'unavailable',error:error.message},rows:[]};
  }
 }
 async function collect(chain,previous,round){
  const seeds=[];
  if(chain==='robinhood'&&getEcosystem){
   const ecosystem=await Promise.resolve().then(getEcosystem).catch(()=>null);
   seeds.push(ecosystem?.market,...(ecosystem?.community?.projects||[]).filter(p=>p.proof).map(p=>p.market||p));
  }
  // One top and one new page per chain. The same transport also serves exact charts.
  const routes=round%2?[['new','new_pools'],['top','pools']]:[['top','pools'],['new','new_pools']];
  const primary=await Promise.all(routes.map(([kind,route])=>{
   const url='https://api.geckoterminal.com/api/v2/networks/'+GECKO_NETWORKS[chain]+'/'+route+'?include=base_token,quote_token&page=1';
   return readPoolSource('gecko-'+kind,'GeckoTerminal',url,u=>gecko.get(u,REFRESH),r=>normalizeGecko(r.data,chain,r.at,kind+' page 1'));
  }));
  seeds.push(...getSeeds(chain));
  const results=[...primary],primaryRows=primary.flatMap(r=>r.rows);
  const currentTokens=new Set(primaryRows.filter(p=>p.observationStatus==='available'&&p.liquidity>0&&AxoStablecoins.isSuggestedProject(p)).map(p=>chain==='solana'?p.address:p.address.toLowerCase()));
  const needsNewPools=currentTokens.size<12||primary.some(r=>r.source.id==='gecko-new'&&r.source.status!=='available');
  const previewRead=getPreviewSeeds&&needsNewPools?Promise.resolve().then(()=>getPreviewSeeds(chain)).catch(()=>null):null;
  if(getNativeSeeds&&['arc','robinhood'].includes(chain)&&currentTokens.size<12){
   const native=await getNativeSeeds(chain,primaryRows).catch(()=>null);
   if(native){
    seeds.push(...native.projects);
    for(const [index,source] of native.sources.filter(s=>['available','unavailable','stale'].includes(s.status)).slice(0,5).entries()){
     const status=source.status==='available'&&!currentAt(source.fetchedAt,now())?'stale':source.status;
     results.push({source:{...source,status,id:'launchpad-'+index},rows:[]});
    }
   }
  }
  if(primary.some(r=>r.source.status!=='available')||currentTokens.size<12){
   const eligible=p=>p?.chain===chain&&chainAddress(p.address,chain)&&currentAt(p.seenAt,now(),DAY)&&AxoStablecoins.isSuggestedProject(p);
   const candidates=[...seeds,...primaryRows,...(previous?.pools||[])].filter(eligible);
   if(!candidates.length&&getCandidateSeeds){
    const listed=await Promise.resolve().then(()=>getCandidateSeeds(chain)).catch(()=>[]);
    seeds.push(...listed);
    candidates.push(...listed.filter(eligible));
   }
   const norm=value=>chain==='solana'?value:value.toLowerCase();
   const original=new Set(candidates.map(p=>norm(p.address)));
   const addresses=[...original];
   const rotated=addresses.length?Array.from({length:Math.min(20,addresses.length)},(_,i)=>addresses[(round*11+i)%addresses.length]):[];
   const preview=await previewRead;
   if(preview?.source)results.push({source:preview.source,rows:[]});
   const previewSeeds=(preview?.seeds||[]).filter(p=>exactOn(p,chain)&&eligible(p));
   const previewPairs=new Set(previewSeeds.map(p=>norm(p.address)+':'+norm(p.pair)));
   const batch=[...new Set([...previewSeeds.map(p=>norm(p.address)),...rotated])].slice(0,20);
   const exact=(r,contracts)=>(Array.isArray(r.data)?r.data:r.data?.pairs||[]).flatMap(raw=>{
    if(raw.chainId!==chain||!chainAddress(raw.baseToken?.address,chain)||!chainAddress(raw.pairAddress,chain,true))return [];
    const address=norm(raw.baseToken.address),discovered=previewPairs.has(address+':'+norm(raw.pairAddress));
    if(contracts.length&&(!contracts.includes(address)||!original.has(address)&&!discovered))return [];
    return [{...normalizePair(raw,r.at),provider:'DEX Screener',curve:isLaunchCurveDex(raw.dexId),
     sourceSample:discovered?'Exact pool · Alchemy discovery':contracts.length?'Exact-contract fallback':'Chain-matched public search fallback'}];
   });
   const searches={bsc:'PancakeSwap',arc:'Arc',robinhood:'Robinhood'};
   const secondary=[];
   if(batch.length){
    const url='https://api.dexscreener.com/tokens/v1/'+chain+'/'+batch.join(',');
    secondary.push(readPoolSource('dex-exact','DEX Screener',url,u=>dex.get(u,{ttl:120000}),r=>exact(r,batch)));
   }
   if(searches[chain]&&currentTokens.size+rotated.length<6){
    const url='https://api.dexscreener.com/latest/dex/search?q='+encodeURIComponent(searches[chain]);
    secondary.push(readPoolSource('dex-search','DEX Screener',url,u=>dex.get(u,{ttl:120000}),r=>exact(r,[])));
   }
   results.push(...await Promise.all(secondary));
  }
  const sources=results.map(r=>r.source);
  const pools=results.flatMap(r=>r.rows).concat(seeds.filter(p=>exactOn(p,chain)&&currentAt(p.seenAt,now(),RETAIN)));
  // Keep each provider snapshot whole. Age is based on its observation, even on fallback.
  const byPool=new Map();
  const launchEvidence=new Map();
  for(const pool of [...(previous?.pools||[]),...pools]){
   if(!exactOn(pool,chain)||!currentAt(pool.seenAt,now(),RETAIN))continue;
   const key=providerPoolKey(pool),before=byPool.get(key);
   if(pool.originEvidence?.chain===chain&&eq(pool.originEvidence.address,pool.address,chain))launchEvidence.set(key,pool);
   const fresh=pool.observationStatus!=='stale'&&currentAt(pool.seenAt,now());
   const beforeFresh=before&&before.observationStatus!=='stale'&&currentAt(before.seenAt,now());
   if(!before||(fresh&&!beforeFresh)||(fresh===Boolean(beforeFresh)&&pool.seenAt>before.seenAt))byPool.set(key,pool);
  }
  const retained=[...byPool].map(([key,p])=>{
   const launch=launchEvidence.get(key);
   if(!launch||!eq(launch.address,p.address,chain))return p;
   return {...p,originEvidence:launch.originEvidence,platform:launch.platform,platformName:launch.platformName,
    ...(launch.curve===true?{curve:true}:{}),...(launch.factory?{factory:launch.factory}:{})};
  }).sort((a,b)=>b.seenAt-a.seenAt).slice(0,240);
  const hasCurrent=retained.some(p=>p.observationStatus!=='stale'&&currentAt(p.seenAt,now()));
  const status=primary.every(r=>r.source.status==='available')?'available':hasCurrent?'partial':retained.length?'stale':'unavailable';
  return {version:1,chain,name:CHAIN_NAMES[chain],asOf:now(),status,pools:retained,sources,
   sample:'GeckoTerminal top and new pools, plus exact provider matches and cached launchpad markets where available. Sampled coverage; original source dates are preserved.',
   collection:{round:round+1,primaryPagesPerChain:2,retentionMinutes:15,maxPools:240}};
 }
 async function snapshot(chain){
  if(!Object.hasOwn(CHAIN_NAMES,chain))throw Error('Unsupported chain');
  await load();
  if(jobs.has(chain))return jobs.get(chain);
  if(now()-(attempts.get(chain)??-Infinity)<REFRESH)return local(chain);
  attempts.set(chain,now());
  if(refreshHead)void Promise.resolve().then(()=>refreshHead(chain)).catch(()=>{});
  const round=rounds.get(chain)||0;rounds.set(chain,round+1);
  const job=collect(chain,snapshots.get(chain),round).then(data=>{snapshots.set(chain,data);return local(chain);});
  jobs.set(chain,job);
  try{const result=await job;await save();return result;}finally{jobs.delete(chain);}
 }
 function exact({chain,address,pool}){return local(chain).pools.find(p=>eq(p.address,address,chain)&&(!pool||eq(p.pair,pool,chain)))||null}
 function context(chain,filters={}){const d=local(chain),pools=d.pools.filter(p=>!filters.lens||filters.lens==='all'||filters.lens==='bluechip'||filters.lens==='trenches'&&p.createdAt&&now()-p.createdAt<=604800000||filters.lens==='swing'&&p.createdAt&&now()-p.createdAt>2592000000&&p.liquidity>=1000000),s=chainScreens(pools,{now:now(),minLiquidity:Math.max(1000,Math.min(1000000,Number(filters.liquidity)||1000))});return {chain,overview:AxoChainOverview.build(d,now(),p=>!AxoStablecoins.isSuggestedProject(p)),asOf:d.asOf,status:d.status,sample:d.sample,criteria:'Positive 24h base-token price change; pool liquidity >= $50k and 24h volume >= $10k; deepest pool per token; known curve venues excluded. No endorsement.',counts:{pools:d.pools.length,projects:deepestProjects(d.pools).length,new:s.new.length,established:s.established.length},leaders:s.leaders.slice(0,4).map(({transactions,websites,socials,imageUrl,...p})=>p),new:s.new.slice(0,4).map(({transactions,websites,socials,imageUrl,...p})=>p),established:s.established.slice(0,3).map(({transactions,websites,socials,imageUrl,...p})=>p),activeFilters:filters,activity:s.activity.slice(0,3).map(({transactions,websites,socials,imageUrl,...p})=>p),dex:d.dex,capital:d.capital,tvl:d.tvl,momentum:d.momentum,launchpads:d.launchpads,news:d.news.items.slice(0,5),sources:d.sources}}
 async function handle(req,res,u){if(u.pathname!=='/api/chain')return false;let status=200,d;try{if(req.method!=='GET')throw new Error('GET required');d=await (u.searchParams.get('initial')==='1'?initial(u.searchParams.get('chain')):snapshot(u.searchParams.get('chain')))}catch(e){status=400;d={error:e.message}}res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(d));return true}
 async function readyContext(chain,filters){await snapshot(chain);return context(chain,filters)}
 return {snapshot,local,exact,context,readyContext,initial,prime,refreshNext,load,handle};
}
