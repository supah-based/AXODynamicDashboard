import Desk from './axo-trading-desk-model.cjs';
import Stream from './axo-stream-schema.cjs';
import Market from './axo-market-intel.cjs';
import Risk from './axo-risk-policy.cjs';
import Assets from './axo-stablecoins.cjs';
import {CHAIN_NAMES,isLaunchCurveDex} from './axo-chain-api.mjs';
import {mediaUrl} from './axo-media.mjs';

const SAMPLE_PER_CHAIN=36;
const finite=value=>Number.isFinite(value)?value:null;
const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
const text=(value,length)=>typeof value==='string'?value.slice(0,length):null;
const validQuote=(p,at)=>p.observationStatus!=='stale'&&Desk.fresh(p.seenAt,at)&&p.price>0;
const sameToken=(p,d)=>p.chain===d?.chain&&Risk.eq(p.address,d.address,p.chain);
const samePool=(p,d)=>sameToken(p,d)&&Risk.eq(p.pair,d.pool||d.pair,p.chain);
const windows=['m5','h1','h6','h24'];

function projectRow(p){
 const id=Stream.exact({chain:p.chain,address:p.address,pool:p.pair||p.pool},true);
 const {chain,address,pool}=id;
 const provider=text(p.provider,60);
 const url=provider==='GeckoTerminal'
  ?'https://www.geckoterminal.com/'+chain+'/pools/'+pool
  :'https://dexscreener.com/'+chain+'/'+pool;
 return {
  id:chain+':'+pool,chain,address,pair:pool,name:text(p.name,100)||'Unknown token',symbol:text(p.symbol,40)||'',
  imageUrl:mediaUrl(p.imageUrl),provider,url,dex:text(p.dex,45),quote:text(p.quote,24),
  seenAt:finite(p.seenAt),createdAt:finite(p.createdAt),observationStatus:p.observationStatus==='stale'?'stale':'available',
  price:finite(p.price),liquidity:finite(p.liquidity),marketCap:finite(p.marketCap),fdv:finite(p.fdv),
  volume5:finite(p.volume5),volume1:finite(p.volume1),volume6:finite(p.volume6),volume24:finite(p.volume24),
  change1:finite(p.changes?.h1??p.change1),change24:finite(p.changes?.h24??p.change24),
  changes:Object.fromEntries(windows.map(window=>[window,finite(p.changes?.[window]??(window==='h1'?p.change1:window==='h24'?p.change24:null))])),
  transactions:Object.fromEntries(windows.map(window=>[window,{buys:count(p.transactions?.[window]?.buys),sells:count(p.transactions?.[window]?.sells)}]))
 };
}

function evidenceRow(raw,project,{getRisk,getSimulation,getProgression},at){
 const check=getRisk(project);
 const simulation=getSimulation(project);
 let risk=Risk.evaluate(project,check,at);
 const currentSimulation=samePool(project,simulation)&&Desk.fresh(simulation.receivedAt,at);
 if(currentSimulation&&simulation.isHoneypot===true){
  risk={...risk,excluded:true,status:'excluded',label:'Sell restriction reported',observedAt:simulation.receivedAt,source:simulation.source};
 }
 const brief=Market.brief({...raw,...project,progression:getProgression(raw)},{risk,now:at});
 const marketFresh=brief.quality.status==='current';
 const holderAt=sameToken(project,check)&&check.source==='GoPlus'&&check.status==='available'&&Desk.fresh(check.receivedAt,at)?check.receivedAt:null;
 const top=holderAt?check.concentration:null;
 const concentration=top&&Number.isFinite(top.share)&&top.share>=0&&top.share<=1&&count(top.addresses)>0
  ?{share:top.share,addresses:top.addresses}:null;
 const ageKnown=Desk.fresh(project.createdAt,at,3650*86400000);
 const pace=marketFresh&&ageKnown&&project.seenAt-project.createdAt>=3600000?brief.metrics.pace5toPrior55:null;
 const progress=brief.progression;
 const origin=raw.originEvidence;
 const knownOrigin=sameToken(project,origin)&&origin.kind==='launchpad'&&Desk.fresh(origin.observedAt,at,3650*86400000);
 return {
  project,quality:brief.quality.status,
  risk:{status:risk.status,excluded:risk.excluded,fresh:risk.fresh,label:risk.label,observedAt:risk.observedAt,source:risk.source,
   reasons:risk.reasons.slice(0,5).map(r=>r.label)},
  execution:currentSimulation
   ?{status:simulation.isHoneypot===true?'restriction':simulation.simulationSuccess===true&&simulation.isHoneypot===false?'simulated':'inconclusive',at:simulation.receivedAt,source:simulation.source}
   :null,
  activity:{
   pace:finite(pace),trades5:marketFresh?count(brief.metrics.transactions5):null,
   unique5:marketFresh?count(raw.participants?.m5?.unique):null,
   unique1:marketFresh?count(raw.participants?.h1?.unique):null,
   buyers5:marketFresh?count(raw.participants?.m5?.buyers):null,
   sellers5:marketFresh?count(raw.participants?.m5?.sellers):null,
   liquidityChange:finite(progress?.liquidityPct),baselineAt:progress?.from??null,
   sustained:progress?.sustained===true
  },
  holders:holderAt?{count:count(check.holderCount),concentration,at:holderAt}:null,
  origin:knownOrigin?text(origin.name,60):null,
  cautions:brief.cautions.slice(0,4)
 };
}

function representative(rows,at){
 const tokens=new Map();
 for(const raw of rows){
  if(!raw||!Desk.CHAIN_IDS.includes(raw.chain)||raw.curve||isLaunchCurveDex(raw.dex)||!Assets.isSuggestedProject(raw)||!Desk.fresh(raw.seenAt,at,900000))continue;
  if(!(raw.liquidity>0))continue;
  let project;
  try{project=projectRow(raw);}catch{continue;}
  const key=Desk.tokenKey(project),old=tokens.get(key);
  const usable=validQuote(project,at)&&Market.quality(raw,at).status==='current';
  if(!old||(usable&&!old.usable)||(usable===old.usable&&(
   project.liquidity>old.project.liquidity||project.liquidity===old.project.liquidity&&project.seenAt>old.project.seenAt
  ))){
   tokens.set(key,{raw,project,usable});
  }
 }
 return [...tokens.values()];
}

function clippedSample(rows,at){
 const rankedModes=['momentum','new','rebound','active'];
 const groups=rankedModes.map(mode=>Desk.order(rows.filter(row=>Desk.qualifies(row,mode,at)),mode));
 groups.push([...rows].sort((a,b)=>b.project.seenAt-a.project.seenAt));
 const included=new Map();
 while(included.size<SAMPLE_PER_CHAIN&&groups.some(g=>g.length)){
  for(const group of groups){
   const row=group.shift();
   if(row&&included.size<SAMPLE_PER_CHAIN)included.set(Desk.poolKey(row.project),row);
  }
 }
 return [...included.values()];
}

function coverage(chain,rows,getChain,getHead,at){
 const d=getChain(chain)||{};
 const current=rows.filter(r=>r.quality==='current'&&Desk.fresh(r.project.seenAt,at));
 const sources=(d.sources||[]).slice(0,8).map(s=>({
  id:text(s.id,35),provider:text(s.provider,70),at:finite(s.fetchedAt),returned:count(s.returned),
  status:s.status==='available'&&!Desk.fresh(s.fetchedAt,at)?'stale':s.status
 }));
 const time=finite(d.dex?.receivedAt);
 const volumeFresh=['live','available'].includes(d.dex?.status)&&Desk.fresh(time,at,900000);
 const head=getHead(chain);
 return {
  chain,name:CHAIN_NAMES[chain],current:current.length,
  withActivity:current.filter(r=>r.activity.trades5!==null).length,
  withUnique:current.filter(r=>r.activity.unique5!==null).length,
  screened:current.filter(r=>r.risk.status==='screened').length,
  observedAt:current.length?Math.max(...current.map(r=>r.project.seenAt)):null,
  state:!current.length?'no-current-sample':d.status==='available'&&sources.every(s=>s.status==='available')?'current':'partial',
  volume:volumeFresh?{usd:finite(d.dex.data?.volume),change24:finite(d.dex.data?.change),at:time,source:text(d.dex.source,60)}:null,
  head:head?.status==='available'&&Desk.fresh(head.observedAt,at,600000)?head:null,
  sources
 };
}

export function createTradingDesk({
 getPools,getChain=()=>null,getRisk=()=>null,getSimulation=()=>null,getProgression=()=>null,
 getMarkets=()=>null,getChanges=()=>[],getHead=()=>null,getContract=null,now=Date.now
}){
 let cached;
 function snapshot(){
  const at=now();
  if(cached&&Desk.fresh(cached.asOf,at,15000))return cached;
  const rows=representative(getPools(),at).map(({raw,project})=>evidenceRow(raw,project,{getRisk,getSimulation,getProgression},at));
  const networkRows=Desk.CHAIN_IDS.map(chain=>rows.filter(row=>row.project.chain===chain));
  const market=getMarkets(),btc=market?.data?.find(p=>p.id==='bitcoin'||p.symbol==='btc');
  const btcAt=Date.parse(btc?.sourceTime);
  const cutoff=900000;
  const todaysChanges=getChanges().filter(e=>e?.kind==='project'&&Desk.CHAIN_IDS.includes(e.chain)&&Desk.fresh(e.toAt,at,86400000))
   .slice(0,30).flatMap(e=>{
    try{
     const identity=Stream.exact({chain:e.chain,address:e.address,pool:e.pool},true);
     return [{...identity,metric:text(e.metric,20),symbol:text(e.symbol,40),change:finite(e.change),toAt:e.toAt}];
    }catch{return [];}
   });
  cached={
   asOf:at,rows:networkRows.flatMap(group=>clippedSample(group,at)),
   chains:Desk.CHAIN_IDS.map((chain,i)=>coverage(chain,networkRows[i],getChain,getHead,at)),
   bitcoin:Desk.fresh(market?.receivedAt,at,cutoff)&&Desk.fresh(btcAt,at,cutoff)&&['live','available'].includes(market.status)
    ?{price:finite(btc.price),change24:finite(btc.change),at:btcAt,source:text(market.source,60)}:null,
   changes:todaysChanges,
   limits:{rowsPerChain:SAMPLE_PER_CHAIN,marketMaxAge:Desk.MARKET_MAX_AGE}
  };
  return cached;
 }
 async function handle(req,res,url){
  const contract=url.pathname==='/api/trading-desk/contract';
  if(!contract&&url.pathname!=='/api/trading-desk')return false;
  let status=200,value;
  if(req.method!=='GET'){status=405;value={error:'GET required'};}
  else if(!contract)value=snapshot();
  else{
   let identity;
   try{identity=Stream.exact(Object.fromEntries(url.searchParams),true);}catch{}
   if(!identity){status=400;value={error:'Exact chain, token and pool required.'};}
   else if(!snapshot().rows.some(row=>Desk.poolKey(row.project)===Desk.poolKey(identity))){
    status=404;value={error:'This pool is outside the current Desk sample.'};
   }else{
    const evidence=await Promise.resolve().then(()=>getContract?.(identity)).catch(()=>null);
    value={identity,evidence:evidence||{status:'unavailable'}};
   }
  }
  res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff',...(status===405?{Allow:'GET'}:{})});
  res.end(JSON.stringify(value));
  return true;
 }
 return {snapshot,handle};
}
