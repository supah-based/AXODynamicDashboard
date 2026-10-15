/* Read existing PUBLIC caches only; no provider calls, account data or preferences. */
import Visual from './axo-visual-model.cjs';
import Stablecoins from './axo-stablecoins.cjs';
import Risk from './axo-risk-policy.cjs';
const chains=['solana','base','bsc','ethereum','robinhood','arc'];
const fields=['id','chain','address','pair','name','symbol','price','marketCap','fdv','liquidity','volume1','volume6','volume24','change1','change24','createdAt','tokenCreatedAt','seenAt','provider','observationStatus','url','imageUrl','holders','holdersObservedAt','holdersSource'];
function publicRow(p,d){const out=Object.fromEntries(fields.flatMap(k=>{const v=p[k];return typeof v==='string'?[[k,v.slice(0,300)]]:typeof v==='number'&&Number.isFinite(v)?[[k,v]]:v===null?[[k,null]]:[]}));out.id=out.id||Visual.identity(p);out.changes=Object.fromEntries(['h1','h24'].map(k=>[k,Number.isFinite(p.changes?.[k])?p.changes[k]:null]));if(Array.isArray(p.holderHistory))out.holderHistory=p.holderHistory.slice(-32).filter(r=>(!r.chain||r.chain===p.chain)&&(!r.address||Risk.eq(r.address,p.address,p.chain))).map(r=>({chain:p.chain,address:p.address,at:r.at,count:r.count,source:typeof r.source==='string'?r.source.slice(0,80):null}));if(d?.chain===p.chain&&Risk.eq(d.address,p.address,p.chain)&&d.source==='GoPlus')out.sharedSecurity={status:d.status,chain:d.chain,address:d.address,receivedAt:d.receivedAt,source:d.source,holderCount:d.holderCount,checks:(d.checks||[]).slice(0,20).map(c=>({key:c.key,label:c.label,value:['0','1'].includes(c.value)?c.value:null}))};return out;}
export function publicRibbon({pools=[],risk=()=>null,now=Date.now()}={}){
 const stats={observations:0,invalid:0,assets:0,stale:0,liquidity:0,screening:0,volume:0,eligible:0,duplicates:0},latestPools=new Map(),unique=new Map();
 for(const p of pools.slice(0,2000)){
  stats.observations++;const id=Visual.identity(p),ttl=p?.provider==='GeckoTerminal'?900000:180000;
  if(!id||!chains.includes(p.chain)){stats.invalid++;continue;}
  if(!Stablecoins.isSuggestedProject(p)){stats.assets++;continue;}
  if(!Number.isFinite(p.seenAt)||p.seenAt<=0||p.seenAt>now||now-p.seenAt>ttl||p.observationStatus==='stale'){stats.stale++;continue;}
  const old=latestPools.get(id);if(old)stats.duplicates++;
  if(!old||p.seenAt>old.seenAt||p.seenAt===old.seenAt&&p.liquidity>old.liquidity)latestPools.set(id,p);
 }
 for(const [id,p] of latestPools){
  if(!Number.isFinite(p.liquidity)||p.liquidity<50000){stats.liquidity++;continue;}
  const d=risk(p);if(Risk.evaluate(p,d,now).status!=='screened'){stats.screening++;continue;}
  if(!(Number.isFinite(p.volume1)&&p.volume1>=1000)&&!(Number.isFinite(p.volume24)&&p.volume24>=10000)){stats.volume++;continue;}
  stats.eligible++;unique.set(id,{p,d});
 }
 const tokens=new Map();for(const row of unique.values()){const p=row.p,key=p.chain+':'+(p.chain==='solana'?p.address:p.address.toLowerCase());if(!tokens.has(key))tokens.set(key,[]);tokens.get(key).push(row);}
 const select=entries=>entries.map(rows=>{const latest=Math.max(...rows.map(r=>r.p.seenAt));return rows.filter(r=>latest-r.p.seenAt<=60000).sort((a,b)=>b.p.liquidity-a.p.liquidity||b.p.seenAt-a.p.seenAt||Visual.identity(a.p).localeCompare(Visual.identity(b.p)))[0];});
 const modes=Object.fromEntries([['h1','volume1',1000,'1h'],['h24','volume24',10000,'24h']].map(([key,field,min,label])=>{
  const eligible=select([...tokens.values()].map(rows=>rows.filter(({p})=>Number.isFinite(p[field])&&p[field]>=min)).filter(rows=>rows.length)),projects=eligible.sort((a,b)=>b.p[field]-a.p[field]||Visual.identity(a.p).localeCompare(Visual.identity(b.p))).slice(0,10).map(({p,d})=>publicRow(p,d));
  return [key,{window:label,status:projects.length?'available':!stats.observations?'collecting':stats.stale===stats.observations?'awaiting_fresh_data':'no_eligible_projects',eligible:eligible.length,asOf:projects.length?Math.max(...projects.map(p=>p.seenAt)):null,criteria:'Selected from the shared public ecosystem sample; at least $50k pool liquidity and $'+min.toLocaleString('en-US')+' rolling '+label+' pool volume; ranked by observed '+label+' pool volume. Current core contract checks must be reported without flags. Canonical stable/native/wrapped-native assets and stale observations excluded. Missing risk evidence remains unknown and is withheld; screened does not mean safe.',projects}];
 }));
 return {version:2,scope:'public-ecosystem',...modes.h24,modes,diagnostics:stats};
}
