import {GECKO_NETWORKS,geckoPublic} from './axo-public-json.mjs';
import {chainAddress,normalizeGecko} from './axo-chain-api.mjs';
import {normalizePair} from './axo-project-model.mjs';
import {publicSources} from './axo-source-cache.mjs';

const eq=(a,b,chain)=>typeof a==='string'&&typeof b==='string'&&(chain==='solana'?a===b:a.toLowerCase()===b.toLowerCase());
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const marketFields=['name','symbol','quote','dex','url','price','liquidity','volume5','volume1','volume6','volume24','change1','change24','marketCap','fdv','createdAt','buys','sells','imageUrl','bannerUrl','coingeckoId','quoteAddress','transactions','changes','observationStatus','sourceUrl','tradingUrl','liquidityBasis','marketCapBasis'];

function sourceRecord(id,provider,url,result,error=null){return {id,provider,url,status:error?'unavailable':'available',fetchedAt:result?.at||null,delivery:result?.delivery||null,error:error?String(error.message||error).slice(0,160):null};}
function exactRows(rows,chain,address){return rows.filter(p=>p?.chain===chain&&eq(p.address,address,chain)&&chainAddress(p.pair,chain,true));}
function mergePools(groups){
 const pools=new Map();
 for(const {provider,priority,rows} of groups)for(const row of rows){
  const key=row.chain+':'+(row.chain==='solana'?row.pair:row.pair.toLowerCase()),old=pools.get(key),observation={provider,seenAt:row.seenAt,price:row.price,liquidity:row.liquidity,volume24:row.volume24,change24:row.change24};
  if(!old){pools.set(key,{...row,provider,providerObservations:[observation],evidenceProviders:[provider],_priority:priority});continue}
  old.providerObservations.push(observation);if(!old.evidenceProviders.includes(provider))old.evidenceProviders.push(provider);
  if(priority<old._priority){for(const field of marketFields)if(row[field]!==null&&row[field]!==undefined)old[field]=row[field];old.provider=provider;old.seenAt=row.seenAt??old.seenAt;old._priority=priority}
  else for(const field of marketFields)if((old[field]===null||old[field]===undefined)&&row[field]!==null&&row[field]!==undefined)old[field]=row[field];
 }
 return [...pools.values()].map(({_priority,...p})=>p).sort((a,b)=>(b.liquidity??-1)-(a.liquidity??-1)||(b.volume24??-1)-(a.volume24??-1)).slice(0,24);
}
function comparison(p){
 const rows=(p?.providerObservations||[]).filter(r=>finite(r.price)||finite(r.liquidity)||finite(r.volume24));
 return rows.length>1?{pool:p.pair,providers:rows.map(r=>({provider:r.provider,seenAt:r.seenAt,price:r.price,liquidity:r.liquidity,volume24:r.volume24})),note:'Independent provider observations are shown separately; differences are not silently averaged.'}:null;
}

export function createProjectData({gecko=geckoPublic,dex=publicSources,profiles,security,simulation,getLocal=()=>[],remember=async()=>false,now=Date.now}={}){
 const cache=new Map(),pending=new Map();
 async function snapshot({chain,address,pool=null}={}){
  if(!['solana','base','bsc','ethereum','robinhood','arc'].includes(chain)||!chainAddress(address,chain)||pool&&!chainAddress(pool,chain,true))throw Error('Unsupported chain or invalid exact project identity');
  const normalizedAddress=chain==='solana'?address:address.toLowerCase(),normalizedPool=pool&&(chain==='solana'?pool:pool.toLowerCase()),key=chain+':'+normalizedAddress+':'+(normalizedPool||'');
  const old=cache.get(key);if(old&&now()-old.receivedAt<120000)return old;if(pending.has(key))return pending.get(key);
  const job=(async()=>{
   const sources=[],groups=[],gaps=[];
   const local=exactRows(getLocal(chain,address)||[],chain,address);if(local.length){groups.push({provider:'AXO cached exact observations',priority:3,rows:local});sources.push({id:'local',provider:'AXO cached exact observations',status:'available',fetchedAt:Math.max(...local.map(p=>p.seenAt||0)),returned:local.length})}
   const tasks=[];
   if(GECKO_NETWORKS[chain])tasks.push((async()=>{const url='https://api.geckoterminal.com/api/v2/networks/'+GECKO_NETWORKS[chain]+'/tokens/'+encodeURIComponent(address)+'/pools?include=base_token,quote_token&page=1';try{const r=await gecko.get(url,120000),rows=exactRows(normalizeGecko(r.data,chain,r.at,'exact-token pools'),chain,address);groups.push({provider:'CoinGecko Onchain / GeckoTerminal',priority:1,rows});sources.push({...sourceRecord('coingecko-onchain','CoinGecko Onchain / GeckoTerminal',url,r),returned:rows.length});if(!rows.length)gaps.push('CoinGecko Onchain returned no pool where the requested contract is the base token.')}catch(e){sources.push(sourceRecord('coingecko-onchain','CoinGecko Onchain / GeckoTerminal',url,null,e));gaps.push('CoinGecko Onchain exact-token pools unavailable.')}})());
   tasks.push((async()=>{const url='https://api.dexscreener.com/token-pairs/v1/'+encodeURIComponent(chain)+'/'+encodeURIComponent(address);try{const r=await dex.get(url,{ttl:120000}),rows=exactRows((Array.isArray(r.data)?r.data:[]).map(p=>({...normalizePair(p,r.at),provider:'DEX Screener'})),chain,address);groups.push({provider:'DEX Screener',priority:2,rows});sources.push({...sourceRecord('dexscreener','DEX Screener',url,r),returned:rows.length});if(!rows.length)gaps.push('DEX Screener returned no exact base-token pool.')}catch(e){sources.push(sourceRecord('dexscreener','DEX Screener',url,null,e));gaps.push('DEX Screener exact-token pools unavailable.')}})());
   const profileJob=profiles?.profile?profiles.profile(chain,address).catch(e=>({chain,address,asOf:now(),status:'unavailable',websites:[],socials:[],articles:[],gaps:[String(e.message||e)]})):Promise.resolve({chain,address,asOf:now(),status:'unavailable',websites:[],socials:[],articles:[],gaps:['No exact-token metadata adapter configured.']});
   const securityJob=security?.security?security.security({chain,address}).catch(e=>({status:'unavailable',chain,address,message:String(e.message||e)})):Promise.resolve({status:'unavailable',chain,address,message:'No contract and holder adapter configured.'});
   await Promise.all(tasks);
   const pools=mergePools(groups),selected=pool?pools.find(p=>eq(p.pair,pool,chain))||null:pools[0]||null;
   const [identity,contract,tradeSimulation]=await Promise.all([profileJob,securityJob,selected&&simulation?simulation.simulation({chain,address,pool:selected.pair}):Promise.resolve({status:selected?'not_checked':'unavailable',chain,address,pool:selected?.pair||pool||null,message:selected?'No simulation adapter configured.':'No exact pool available for simulation.'})]);
   if(!selected)gaps.push(pool?'The requested exact pool was not returned by current providers.':'No exact base-token pool was returned by current providers.');
   if(identity?.status!=='available')gaps.push(...(identity?.gaps||['Exact-token project metadata unavailable.']).slice(0,2));
   if(contract?.status!=='available')gaps.push(contract?.message||'Contract and holder checks unavailable.');
   if(tradeSimulation?.status!=='available')gaps.push(tradeSimulation?.message||'Exact-pool trade simulation unavailable.');
   if(selected)await remember(selected).catch(()=>false);
   const links=[...(identity?.websites||[]),...(identity?.socials||[])];
   const data={schemaVersion:2,project:{chain,address:normalizedAddress,pool:selected?.pair||pool||null},receivedAt:now(),identity:{name:identity?.name||selected?.name||null,symbol:identity?.symbol||selected?.symbol||null,coinGeckoId:identity?.coinGeckoId||selected?.coingeckoId||null,description:identity?.description||null,descriptionSource:identity?.descriptionSource||null,logo:identity?.logo||selected?.imageUrl||null,links},pools,market:{status:selected?'available':'unavailable',primary:selected,comparisons:pools.map(comparison).filter(Boolean),coverage:'CoinGecko Onchain / GeckoTerminal and DEX Screener exact-token pools, plus recent AXO observations. Missing providers remain explicit; values are not averaged.'},onchain:{contract,simulation:tradeSimulation,metadata:{status:identity?.status||'unavailable',asOf:identity?.asOf||null,sourceUrl:identity?.sourceUrl||null}},evidence:[...sources,{id:'metadata',provider:'CoinGecko Onchain / GeckoTerminal token info',status:identity?.status||'unavailable',fetchedAt:identity?.asOf||null,url:identity?.sourceUrl||null},{id:'contract',provider:contract?.source||'Contract checks',status:contract?.status||'unavailable',fetchedAt:contract?.receivedAt||null,url:contract?.sourceUrl||null},{id:'simulation',provider:tradeSimulation?.source||'Exact-pool simulation',status:tradeSimulation?.status||'unavailable',fetchedAt:tradeSimulation?.receivedAt||null,url:tradeSimulation?.sourceUrl||null}],gaps:[...new Set(gaps)].slice(0,12),social:{status:'not_connected'},news:{status:Array.isArray(identity?.articles)&&identity.articles.length?'available':'not_connected',items:identity?.articles||[]},community:{status:'not_connected'},positions:{status:'not_connected'},assessment:{status:'incomplete',summary:null,note:'Structured API evidence only. Luna should interpret, compare, challenge and narrate this evidence rather than invent missing measurements.'}};
   cache.set(key,data);while(cache.size>160)cache.delete(cache.keys().next().value);return data;
  })();pending.set(key,job);try{return await job}finally{pending.delete(key)}
 }
 async function primary(p){const d=await snapshot({chain:p.chain,address:p.address,pool:p.pool||p.pair||null});return d.market.primary}
 return {snapshot,primary,status:()=>({cached:cache.size,inFlight:pending.size})};
}
