import Registry from './axo-launchpad-registry.cjs';
import {publicSources} from './axo-source-cache.mjs';
import {chainAddress} from './axo-chain-api.mjs';
import {normalizePair,publicUrl,numberOrNull} from './axo-project-model.mjs';
import {mediaUrl} from './axo-media.mjs';
const DAY=86400000;
const eq=(a,b,c)=>typeof a==='string'&&typeof b==='string'&&(c==='solana'?a===b:a.toLowerCase()===b.toLowerCase());
const n=v=>{const x=numberOrNull(v);return x!==null&&x>=0?x:null};
const count=v=>Number.isSafeInteger(n(v))?n(v):null;
const seconds=(v,at)=>n(v)>0&&n(v)*1000<=at?n(v)*1000:null;
const stamp=(v,at)=>n(v)>0&&n(v)<=at?n(v):null;
const pad=id=>Registry.find(p=>p.id===id);
const supports=(p,c)=>p.chain===c||p.chains?.includes(c);
const origin=(p,platform,chain,at,url)=>({kind:'launchpad',chain,address:p.address,name:platform.name,source:'Exact-token public launch feed · documented factory',observedAt:at,url});
function base(row,platform,chain,at,url,address,pair){
 if(!chainAddress(address,chain)||pair!==null&&!chainAddress(pair,chain,true)||!supports(platform,chain)||!Number.isFinite(at))return null;
 const p=normalizePair({chainId:chain,pairAddress:pair||address,baseToken:{address,name:row.name,symbol:row.symbol||row.ticker},quoteToken:{symbol:row.quote?.symbol||row.quoteSymbol},dexId:null,url},at);
 return {...p,pair,platform:platform.id,platformName:platform.name,tokenKey:chain+':'+(chain==='solana'?address:address.toLowerCase()),provider:platform.name+' public feed',originEvidence:origin({address},platform,chain,at,url),originAt:at,originPool:pair,launchAt:null,launchTimeBasis:'Launch time unavailable',provenance:'Exact-token platform record; factory checked against published deployment',curve:false,migrated:false,graduated:false,graduatedAt:null,graduation:null,reserve:null,phase:'Launch stage unverified',holders:null,holdersAt:null,holderSource:null,holderGrowth:null,holderHistory:[],metadataAt:at,top10:null,developer:null,buyers:null,sellers:null,tx1:null,tx6:null,volumePace:null,volumeBaseline:null,transactionPace:null,observationStatus:'available',sourceUrl:url,sourceFetchedAt:at,marketTimestampBasis:'Public response retrieval; market observation block not supplied',nativeActivity:null};
}
export function normalizePons(row,at,url){
 const platform=pad('pons');if(!row||!platform.factories.some(f=>eq(f,row.factory,'robinhood'))||!['v1','v2'].includes(row.protocol)||!['curve','graduating','graduated','rescued','deployed'].includes(row.stage))return null;
 if(row.protocol==='v2'&&!eq(row.factory,platform.factories[0],'robinhood')||row.protocol==='v1'&&eq(row.factory,platform.factories[0],'robinhood'))return null;
 const curve=['curve','graduating'].includes(row.stage),pair=curve?row.curve:row.poolId||row.pool||null;
 const p=base(row,platform,'robinhood',at,url,row.address,pair);if(!p||curve&&!chainAddress(row.curve,'robinhood'))return null;
 p.factory=row.factory;p.launchAt=seconds(row.createdAt,at);p.launchTimeBasis='Indexer-reported factory launch timestamp';p.createdAt=curve?p.launchAt:null;
 p.curve=curve;p.graduated=row.protocol==='v2'&&row.stage==='graduated';p.graduatedAt=p.graduated?seconds(row.graduatedAt,at):null;
 p.graduation=curve&&n(row.progress)!==null&&n(row.progress)<=1?n(row.progress)*100:null;
 p.phase=row.protocol==='v1'?'Direct V3 launch · legacy':({curve:'Launch curve',graduating:'Graduation in progress',graduated:'Graduated · platform reported',rescued:'Rescued · inspect state',deployed:'Deployed · awaiting curve'})[row.stage];
 p.price=n(row.priceUsd);p.marketCap=n(row.marketCapUsd);p.reserve=curve?n(row.raisedUsd):null;p.graduationStage=row.stage;
 p.nativeActivity={volume:n(row.volumeUsd),unit:'USD',window:'Unspecified period · platform reported',trades:count(row.tradeCount)};
 p.creatorTaxBps=n(row.creatorTaxBps);p.quoteAddress=row.quote?.address;p.imageUrl=mediaUrl(row.artwork);p.lastTradeAt=seconds(row.lastTradeAt,at);return p;
}
export function normalizePar(row,chain,at,url){
 const platform=pad('par'),deployment=platform.deployments[chain];if(!row||row.launchpad!=='par'||!deployment?.factories.some(f=>eq(f,row.factory,chain)))return null;
 const p=base(row,platform,chain,at,url,row.token,row.poolId);if(!p||!chainAddress(row.poolId,chain,true))return null;
 p.factory=row.factory;p.launchAt=seconds(row.createdAt,at);p.launchTimeBasis='Indexer-reported factory launch timestamp';p.phase='Direct V4 launch · no graduation stage';p.imageUrl=mediaUrl(row.logoUrl||row.logo);p.lastTradeAt=seconds(row.lastTradeAt,at);p.creatorTaxBps=n(row.creatorTaxBps);
 p.nativeActivity={volume:n(row.totalVolumeQuote),unit:'Raw '+String(row.quoteSymbol||'quote').slice(0,12)+' units',window:'Lifetime · single primary market; not USD or 24h',trades:count(row.tradeCount)};
 return p;
}
export function normalizeRaydium(row,at,url){
 if(!row||!chainAddress(row.configId,'solana')||!chainAddress(row.platformInfo?.pubKey,'solana')||row.mintB?.chainId!==101)return null;
 const p=base(row,pad('raydium-launchlab'),'solana',at,url,row.mint,row.poolId);if(!p||!p.pair)return null;
 p.launchAt=stamp(row.createAt,at);p.launchTimeBasis='Indexer-reported factory launch timestamp';p.createdAt=p.launchAt;p.curve=true;p.phase='LaunchLab launch pool · migration unverified';p.graduation=n(row.finishingRate)!==null&&n(row.finishingRate)<=100?n(row.finishingRate):null;
 p.subPlatform=String(row.platformInfo.name||'LaunchLab').slice(0,80);p.imageUrl=mediaUrl(row.imgUrl);p.nativeActivity={volume:n(row.volumeU),unit:'USD',window:'Unspecified period · LaunchLab reported',trades:null};
 // Completion percentage alone does not establish the migrated DEX pool or its liquidity.
 return p;
}
export function normalizeArgus(row,at,url){
 const platform=pad('argus');if(!row||row.Log?.Signature?.Name!=='TokenCreated'||!eq(row.LogHeader?.Address,platform.factories[0],'arc'))return null;
 const args=Object.fromEntries((row.Arguments||[]).map(a=>[a.Name,a.Value?.address??a.Value?.string??a.Value?.hex]));
 const p=base({name:args.name,symbol:args.symbol},platform,'arc',at,url,args.token,args.poolId);if(!p||!chainAddress(args.poolId,'arc',true))return null;
 p.factory=platform.factories[0];p.launchAt=stamp(Date.parse(row.Block?.Time),at);p.launchTimeBasis='Indexed factory event block timestamp';p.phase='Argus launch pool · graduation unverified';p.imageUrl=mediaUrl(args.imageURI);return p;
}
export function hydrateLaunchMarket(project,pairs,at){
 if(project.curve||!project.pair||!Array.isArray(pairs))return project;
 const raw=pairs.find(r=>r.chainId===project.chain&&eq(r.baseToken?.address,project.address,project.chain)&&eq(r.pairAddress,project.pair,project.chain));
 if(!raw||!chainAddress(raw.pairAddress,project.chain,true))return project;
 const m=normalizePair(raw,at),tx=raw.txns||{},age=m.createdAt&&at-m.createdAt,tx1=count(tx.h1?.buys)!==null&&count(tx.h1?.sells)!==null?count(tx.h1.buys)+count(tx.h1.sells):null,tx6=count(tx.h6?.buys)!==null&&count(tx.h6?.sells)!==null?count(tx.h6.buys)+count(tx.h6.sells):null;
 const baseline=age>=21600000&&m.volume1!==null&&m.volume6!==null&&m.volume6>=m.volume1?(m.volume6-m.volume1)/5:null;
 return {...project,...m,platform:project.platform,platformName:project.platformName,tokenKey:project.tokenKey,originEvidence:project.originEvidence,originPool:project.originPool,imageUrl:m.imageUrl||project.imageUrl,bannerUrl:m.bannerUrl,provider:'DEX Screener · exact launch pool',sourceUrl:project.sourceUrl,marketSourceUrl:'https://api.dexscreener.com/tokens/v1/'+project.chain+'/'+project.address,marketFetchedAt:at,marketTimestampBasis:'DEX Screener response retrieval',tx1,tx6,volumeBaseline:baseline,volumePace:baseline>=1000&&m.volume1>=5000?m.volume1/baseline:null,transactionPace:age>=21600000&&tx1!==null&&tx6>tx1?tx1/((tx6-tx1)/5):null};
}
const ARGUS_QUERY=`query { EVM(network: arc) { Events(limit: {count: 30}, orderBy: {descending: Block_Time}, where: {TransactionStatus: {Success: true}, LogHeader: {Address: {is: "0xb021be536808f551b31789422fd28a6c9c6e97da"}, Removed: false}, Log: {Signature: {Name: {is: "TokenCreated"}}}}) { Block {Number Time} LogHeader {Address Index} Log {Signature {Name}} Arguments {Name Value {... on EVM_ABI_Address_Value_Arg {address} ... on EVM_ABI_String_Value_Arg {string} ... on EVM_ABI_Bytes_Value_Arg {hex}}} } } }`;
export function createDirectLaunchpadFeeds({sources=publicSources,now=Date.now,bitqueryToken=null}={}){
 async function collect(chain,{pools=[]}={}){
  const rows=new Map(),feeds=[],totals=[],disputed=new Set();
  const add=p=>{if(!p||disputed.has(p.tokenKey))return;const old=rows.get(p.tokenKey);if(old&&old.platform!==p.platform){rows.delete(p.tokenKey);disputed.add(p.tokenKey);feeds.push({platform:p.platform,provider:p.platformName,label:'Conflicting exact-token launch origins',status:'unavailable',fetchedAt:p.seenAt,error:'Conflicting source records excluded pending verification'});return}rows.set(p.tokenKey,old?{...old,...p,providerTrending:old.providerTrending||p.providerTrending}:p)};
  async function read(platform,url,label,parse,options={}){try{const r=await sources.get(url,{ttl:300000,...options});const result=await parse(r.data,r.at,url);feeds.push({platform,url,provider:pad(platform).name,label,status:'available',fetchedAt:r.at,returned:Array.isArray(result)?result.length:0});if(Array.isArray(result))result.forEach(add);return r}catch{feeds.push({platform,url,provider:pad(platform).name,label,status:'unavailable',fetchedAt:null,error:'Public feed unavailable; no current observations inferred'});return null}}
  if(chain==='robinhood'){
   for(const [query,label]of [['sort=newest&stage=all','Newest factory launches'],['sort=progress&protocol=v2&stage=curve','Curve progress'],['sort=active&stage=graduated','Graduated / direct-launch projects']])await read('pons','https://ponsfamily.com/api/launches?'+query+'&limit=20',label,(d,at,url)=>{if(!Array.isArray(d.items))throw Error('Invalid feed');return d.items.slice(0,20).map(r=>normalizePons(r,at,url)).filter(Boolean)});
   await read('pons','https://ponsfamily.com/api/launches/trending','Provider trending · separate from Axo screens',(d,at,url)=>{if(!Array.isArray(d.items))throw Error('Invalid feed');return d.items.slice(0,20).map(r=>{const p=normalizePons(r.launch,at,url);return p?{...p,providerTrending:true,imageUrl:mediaUrl(r.image)||p.imageUrl}:null}).filter(Boolean)});
   const win=await read('launch-win','https://launchwin.app/idx/api/info','Documented indexer identity',(d)=>{if(Number(d.chainId)!==4663||!eq(d.factory,pad('launch-win').factories[0],chain))throw Error('Identity mismatch');return []});
   if(win)await read('launch-win','https://launchwin.app/idx/api/summary','New and active launches',(d,at,url)=>{if(!Array.isArray(d.latest))throw Error('Invalid feed');return [...d.latest,...(d.topVolume||[])].slice(0,40).map(r=>{const p=base(r,pad('launch-win'),chain,at,url,r.address,chainAddress(r.pool,chain,true)?r.pool:null);if(!p)return null;p.launchAt=seconds(r.createdAt,at);p.launchTimeBasis='Indexer-reported factory launch timestamp';p.phase=r.vested===true?'Creator fees vested · not curve graduation':'Direct launch';p.marketCap=n(r.marketCapUsd);p.price=n(r.priceUsd);p.liquidity=n(r.liquidityUsd);p.volume24=n(r.volume24Usd);return p}).filter(Boolean)});
  }
  const deployment=pad('par').deployments[chain];if(deployment){
   const health=await read('par',deployment.host+'/health','Indexer chain and factory identity',(d)=>{if(d.ok!==true||d.chain?.id!==deployment.id||!deployment.factories.every(f=>[d.contracts?.factory,d.contracts?.multiFactory].some(a=>eq(f,a,chain))))throw Error('Indexer identity mismatch');return []});
   if(health){for(const [sort,label]of [['createdAt','Newest factory launches'],['recentVolume','Provider recent activity · quote units']])await read('par',deployment.host+'/launches?orderBy='+sort+'&orderDirection=desc&limit=30',label,(d,at,url)=>{if(!Array.isArray(d))throw Error('Invalid feed');return d.slice(0,30).map(r=>{const p=normalizePar(r,chain,at,url);return p?{...p,providerTrending:sort==='recentVolume'}:null}).filter(Boolean)});
    const stat=await read('par',deployment.host+'/stats','Platform totals · unit and period preserved',(d,at)=>{const sourceAt=seconds(d.at,at);if(!sourceAt)throw Error('Missing totals time');totals.push({platform:'par',chain,sourceAt,fetchedAt:at,launches:count(d.launches),launches24h:count(d.launches24h),trades24h:count(d.trades24h),lifetimeReferenceVolume:n(d.volumeEth),referenceUnit:health.data.chain.reference?.symbol||'Reference',url:deployment.host+'/stats',status:now()-sourceAt>900000?'stale':'available'});return []});
   }
  }
  if(chain==='solana')for(const [sort,label]of [['new','New LaunchLab launches'],['hotToken','Provider activity leaders']])await read('raydium-launchlab','https://launch-mint-v1.raydium.io/get/list?sort='+sort+'&size=20&includeNsfw=false',label,(d,at,url)=>{if(d.success!==true||!Array.isArray(d.data?.rows))throw Error('Invalid feed');return d.data.rows.slice(0,20).map(r=>{const p=normalizeRaydium(r,at,url);return p?{...p,providerTrending:sort==='hotToken'}:null}).filter(Boolean)});
  if(chain==='arc'){if(bitqueryToken)await read('argus','https://streaming.bitquery.io/graphql','Exact portal launch events',(d,at,url)=>{if(d.errors?.length||!Array.isArray(d.data?.EVM?.Events))throw Error('Invalid feed');return d.data.EVM.Events.map(r=>normalizeArgus(r,at,url)).filter(Boolean)},{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+bitqueryToken},body:JSON.stringify({query:ARGUS_QUERY})});else feeds.push({platform:'argus',url:pad('argus').source,provider:'Bitquery',label:'Exact portal launches',status:'credentials required',fetchedAt:null,error:'Server Bitquery access token is not configured'});}
  for(const id of ['based-bid','openlaunch','safehood'])if(supports(pad(id),chain))feeds.push({platform:id,url:pad(id).source,provider:pad(id).name,label:pad(id).feed,status:'not connected',fetchedAt:null});
  // Reuse cached exact-pool data, then hydrate one bounded batch. Never choose another pool silently.
  for(const [key,p]of rows){const m=pools.filter(q=>q.chain===chain&&eq(q.address,p.address,chain)&&eq(q.pair,p.pair,chain)&&q.seenAt<=now()&&now()-q.seenAt<900000).sort((a,b)=>b.seenAt-a.seenAt)[0];if(m&&!p.curve)rows.set(key,{...p,...Object.fromEntries(['price','liquidity','volume24','volume6','volume1','volume5','change24','change1','changes','transactions','buys','sells','createdAt','imageUrl','bannerUrl','dex','url','seenAt'].filter(k=>m[k]!==undefined&&m[k]!==null).map(k=>[k,m[k]])),marketSourceUrl:m.url,marketTimestampBasis:'Cached exact-pool observation'});}
  const candidates=[...rows.values()].filter(p=>!p.curve&&p.pair&&!p.marketSourceUrl),groups=new Map(),batch=[];
  for(const p of candidates){if(!groups.has(p.platform))groups.set(p.platform,[]);groups.get(p.platform).push(p)}
  for(const group of groups.values())group.sort((a,b)=>Number(!!b.providerTrending)-Number(!!a.providerTrending)||(b.launchAt||0)-(a.launchAt||0));
  while(batch.length<24&&[...groups.values()].some(g=>g.length))for(const group of groups.values()){if(group.length&&batch.length<24)batch.push(group.shift())}
  if(batch.length)try{const url='https://api.dexscreener.com/tokens/v1/'+chain+'/'+batch.map(p=>p.address).join(','),r=await sources.get(url,{ttl:300000});if(!Array.isArray(r.data))throw Error('Invalid feed');for(const p of batch)rows.set(p.tokenKey,hydrateLaunchMarket(p,r.data,r.at));feeds.push({provider:'DEX Screener',url,label:'At most 24 exact launch-token markets',status:'available',fetchedAt:r.at,matched:batch.filter(p=>rows.get(p.tokenKey).marketFetchedAt).length})}catch{feeds.push({provider:'DEX Screener',label:'Exact market hydration',status:'unavailable',fetchedAt:null,error:'Launch identity retained; missing USD market metrics stay unknown'})}
  return {projects:[...rows.values()],sources:feeds,totals};
 }
 return {collect};
}
