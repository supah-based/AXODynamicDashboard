/* Public on-screen references resolve against server-owned records, never client metrics. */
import AxoScore from './axo-score.cjs';
import AxoRiskPolicy from './axo-risk-policy.cjs';
const chains=['solana','base','bsc','ethereum','robinhood','arc'];
const eq=(a,b,c)=>typeof a==='string'&&typeof b==='string'&&(c==='solana'?a===b:a.toLowerCase()===b.toLowerCase());
const address=(a,c,pool=false)=>typeof a==='string'&&(c==='solana'?/^[1-9A-HJ-NP-Za-km-z]{32,44}$/:(pool?/^0x(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/:/^0x[a-fA-F0-9]{40}$/)).test(a);
const fields=['chain','address','pair','name','symbol','price','marketCap','liquidity','volume1','volume24','change1','change24','createdAt','tokenCreatedAt','seenAt','provider','observationStatus','sourceSample','url'];
export function publicProject(p){return Object.fromEntries(fields.flatMap(k=>{const v=p?.[k];return typeof v==='string'?[[k,v.slice(0,300)]]:typeof v==='number'&&Number.isFinite(v)?[[k,v]]:v===null?[[k,null]]:[]}))}
export function dashboardReferences(input,stream,now=Date.now()){
 if(input?.version!==1||!Number.isFinite(input.capturedAt)||input.capturedAt>now+1000||now-input.capturedAt>120000)return null;
 const scope=stream?.project?[stream.project.chain]:stream?.chain?[stream.chain]:stream?.type==='discovery'?stream.discovery?.chains:stream?.filters?.chains;
 const within=c=>chains.includes(c)&&(!scope?.length||scope.includes(c));
 const projects=(Array.isArray(input.projects)?input.projects:[]).slice(0,12).filter(p=>p&&within(p.chain)&&address(p.address,p.chain)&&address(p.pool,p.chain,true)).filter(p=>stream?.type!=='project'||eq(p.address,stream.project?.address,p.chain)&&eq(p.pool,stream.project?.pool,p.chain)).map(({chain,address,pool})=>({chain,address,pool}));
 return {capturedAt:input.capturedAt,loading:input.loading===true,cards:[...new Set((Array.isArray(input.cards)?input.cards:[]).filter(x=>typeof x==='string'&&/^[a-zA-Z0-9:_-]{1,160}$/.test(x)))].slice(0,24),projects:[...new Map(projects.map(p=>[JSON.stringify(p),p])).values()],researchKeys:[...new Set((Array.isArray(input.researchKeys)?input.researchKeys:[]).filter(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)))].slice(0,3)};
}
export async function appendDashboardContext(context,input,stream,{getDisplayedProject,getResearch,getProjectEvidence,now=Date.now}={}){
 const refs=dashboardReferences(input,stream,now());if(!refs)return;
 context.dashboardView={capturedAt:refs.capturedAt,cards:refs.cards,loading:refs.loading,projectCount:refs.projects.length,coverage:'Browser-reported rendered public card references; server-resolved evidence below. Not a screenshot or private account access.'};
 const observations=await Promise.all(refs.projects.slice(0,8).map(async p=>{try{const d=await getDisplayedProject?.(p);if(!d||d.chain!==p.chain||!eq(d.address,p.address,p.chain)||!eq(d.pair,p.pool,p.chain))return {identity:p,status:'unavailable'};const e=getProjectEvidence?.(p)?.contract,exact=e?.chain===p.chain&&eq(e.address,p.address,p.chain)&&e.source==='GoPlus',contract=exact?e:null,risk=AxoRiskPolicy.evaluate(d,contract,now()),holders=Number.isSafeInteger(d.holders)&&d.holders>=0?{count:d.holders,at:typeof (d.holdersAt||d.holdersObservedAt)==='string'?Date.parse(d.holdersAt||d.holdersObservedAt):d.holdersAt||d.holdersObservedAt}:contract?.status==='available'?{count:contract.holderCount,at:contract.receivedAt}:{},score=AxoScore.evaluate(d,{risk:{...risk,checks:contract?.checks||[],verification:contract?.verification},holders,trend:contract?.holderTrend||{}},now());return {identity:p,status:d.observationStatus||'dated observation',data:publicProject(d),axoScore:{...score,basis:'Recomputed from current server-cached exact public evidence; missing screening and narrative evidence earn no points.'}}}catch{return {identity:p,status:'unavailable'}}}));
 if(observations.length)context.feeds.push({id:'displayed-projects',source:'Exact public pool records for projects rendered in the active dashboard',status:'bounded sample; inspect per-project observation dates',data:observations,limitations:'Up to eight of the first twelve displayed references. Does not establish holdings, screen eligibility, contract safety or complete coverage.'});
 for(const [i,key]of refs.researchKeys.entries()){const d=getResearch?.(key);if(!d)continue;const wanted=stream?.project?[stream.project.chain]:stream?.chain?[stream.chain]:stream?.type==='discovery'?stream.discovery?.chains:stream?.filters?.chains;const actual=d.scope?.chains||[];if(wanted?.length&&(!actual.length||actual.some(c=>!wanted.includes(c))))continue;if(stream?.type==='project'&&(!d.scope?.project||!eq(d.scope.project.address,stream.project.address,stream.project.chain)||!eq(d.scope.project.pool,stream.project.pool,stream.project.chain)))continue;context.feeds.push({id:'displayed-research-'+i,source:'Server-held evidence for a rendered research card',status:'previously fetched; inspect source dates',receivedAt:d.completedAt,data:d})}
}
// Keep selected evidence ahead of broad background feeds, with an actual final bound.
export function boundAnswerContext(context,max=24000){
 const priority=f=>f.id==='research-card'?0:f.id.startsWith('displayed-')?1:['chain-research','chain-findings','project','axo-ecosystem','launchpad-projects'].includes(f.id)?2:3;
 context.feeds.sort((a,b)=>priority(a)-priority(b));
 const clip=(v,depth=0)=>typeof v==='string'?v.slice(0,1600):Array.isArray(v)?v.slice(0,8).map(x=>clip(x,depth+1)):v&&typeof v==='object'?depth>9?null:Object.fromEntries(Object.entries(v).slice(0,36).map(([k,x])=>[k,clip(x,depth+1)])):v;
 context.feeds=context.feeds.map(f=>({...f,data:clip(f.data)}));
 for(const f of context.feeds){while(JSON.stringify(f).length>7000){let biggest=null;const scan=v=>{if(Array.isArray(v)){if(v.length&&(!biggest||JSON.stringify(v).length>JSON.stringify(biggest).length))biggest=v;for(const x of v)scan(x)}else if(v&&typeof v==='object')for(const x of Object.values(v))scan(x)};scan(f.data);if(!biggest)break;biggest.pop();f.truncated=true}}
 while(JSON.stringify(context).length>max&&context.feeds.length)context.feeds.pop();return context;
}
