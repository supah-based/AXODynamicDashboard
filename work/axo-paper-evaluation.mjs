import {createHash} from 'node:crypto';

const CHAINS=['solana','base','bsc','robinhood','arc'],CATEGORIES=['degen','swing','bluechip'],STRATEGIES=['momentum','dip-rebound'];
const MAX_COHORTS=96,MAX_SAMPLES=120,DAY=86400000;
const finiteDate=v=>Number.isFinite(v)&&v>0&&v<=8640000000000000;
const cents=v=>Number.isSafeInteger(v)&&v>=0;
const copySamples=rows=>rows.map(r=>({...r}));
const safeAdd=(a,b)=>Number.isSafeInteger(a)&&Number.isSafeInteger(b)&&Number.isSafeInteger(a+b)?a+b:null;
const sumCents=values=>values.reduce((sum,value)=>safeAdd(sum,value),0);

export function experimentId(config){
 const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,sorted(value[k])])):value;
 return createHash('sha256').update(JSON.stringify(sorted(config))).digest('hex').slice(0,16);
}

function cohortIdentity(value){
 if(!value||typeof value.experimentId!=='string'||!value.experimentId||value.experimentId.length>100||value.experimentId==='legacy-unversioned'||!CHAINS.includes(value.chain)||!CATEGORIES.includes(value.category)||!STRATEGIES.includes(value.strategy))return null;
 const {experimentId,chain,category,strategy}=value;
 return {id:[experimentId,chain,category,strategy].join('|'),experimentId,chain,category,strategy};
}
function positionCohort(p){
 const o=p?.plan?.opportunity;
 if(o?.version!=='paper-opportunity-v1'||o.chain!==p.chain)return null;
 return cohortIdentity({experimentId:p.plan.experimentId,chain:p.chain,category:o.category,strategy:o.strategy});
}
function assetKey(p){
 if(typeof p.address!=='string'||!p.address)return null;
 return p.chain+':'+(p.chain==='solana'?p.address:p.address.toLowerCase());
}
function emptyGroup(id,at){return {id,firstEntryAt:at,lastExitAt:at,closed:0,wins:0,losses:0,flat:0,netCents:0,gainCents:0,lossCents:0,outlayCents:0,returnSum:0,samples:[]};}
function addOutcome(group,sample){
 group.closed++;group.wins+=Number(sample.pnlCents>0);group.losses+=Number(sample.pnlCents<0);group.flat+=Number(sample.pnlCents===0);group.netCents=safeAdd(group.netCents,sample.pnlCents);group.gainCents=safeAdd(group.gainCents,Math.max(0,sample.pnlCents));group.lossCents=safeAdd(group.lossCents,Math.max(0,-sample.pnlCents));group.outlayCents=safeAdd(group.outlayCents,sample.outlayCents);group.returnSum=Number.isFinite(group.returnSum)&&Number.isFinite(group.returnSum+sample.returnPct)?group.returnSum+sample.returnPct:null;group.firstEntryAt=Math.min(group.firstEntryAt,sample.entryAt);group.lastExitAt=Math.max(group.lastExitAt,sample.exitAt);
 group.samples.push({...sample});group.samples=group.samples.slice(-MAX_SAMPLES);
}

// Record only accepted full round trips. The final fill carries cumulative proceeds
// and stress costs, so earlier profit-taking fills cannot become extra winning trades.
export function recordCompletedTrade(state,event){
 const result=event.data?.result,fill=result?.fill;
 if(event.data?.proposal?.action==='sell'&&result?.accepted===false){
  const identity=positionCohort(state.positions[event.data.proposal.assetKey]);
  if(identity&&finiteDate(event.at)){
   const failures=state.stats.cohortFailedExits??={};
   if(failures[identity.id]||Object.keys(failures).length<MAX_COHORTS){const row=failures[identity.id]??={...identity,count:0,lastAt:0};row.count++;row.lastAt=Math.max(row.lastAt,event.at);}
  }
 }
 if(result?.action!=='sell'||result.accepted!==true||!fill||fill.remainingQuantity!==0)return;
 const prior=state.positions[fill.key];if(!prior)return;
 const original=prior.initialOutlayCents??prior.costCents,net=fill.netProceedsCents;
 if(!cents(original)||original<=0||!cents(net)||!finiteDate(prior.at)||!finiteDate(event.at)||event.at<prior.at)return;
 const pnl=net-original,ret=pnl/original*100,stress=cents(fill.extra50BpsCostCents)?fill.extra50BpsCostCents:null;
 const sample={entryAt:prior.at,exitAt:event.at,assetKey:assetKey(prior),pnlCents:pnl,returnPct:ret,outlayCents:original,extra50BpsCostCents:stress,stressedPnlCents:stress!==null&&Number.isSafeInteger(pnl-stress)?pnl-stress:null};
 const id=prior.plan?.experimentId||'legacy-unversioned',groups=state.stats.experiments??={};
 if(!groups[id]&&Object.keys(groups).length>=32)state.stats.ungroupedClosed=(state.stats.ungroupedClosed||0)+1;
 else addOutcome(groups[id]??=emptyGroup(id,prior.at),sample);
 const identity=positionCohort(prior);if(!identity||!sample.assetKey)return;
 const cohorts=state.stats.cohorts??={};
 if(!cohorts[identity.id]&&Object.keys(cohorts).length>=MAX_COHORTS){state.stats.ungroupedCohortClosed=(state.stats.ungroupedCohortClosed||0)+1;return;}
 addOutcome(cohorts[identity.id]??={...emptyGroup(identity.id,prior.at),...identity},sample);
}

function validSamples(rows,now){
 return (rows||[]).filter(s=>finiteDate(s.entryAt)&&finiteDate(s.exitAt)&&s.entryAt<=s.exitAt&&s.exitAt<=now&&Number.isSafeInteger(s.pnlCents)&&cents(s.outlayCents)&&s.outlayCents>0&&Number.isFinite(s.returnPct)&&typeof s.assetKey==='string'&&s.assetKey).sort((a,b)=>a.exitAt-b.exitAt||a.entryAt-b.entryAt);
}

// Predeclared downside-only sizing heuristic. It cannot change a strategy, risk cap,
// or execution mode, and repeated scans cannot manufacture additional observations.
export function cohortPolicy(state,identity,now=Date.now(),valuation){
 const key=cohortIdentity(identity),samples=key?validSamples(state.stats?.cohorts?.[key.id]?.samples,now).slice(-20):[];
 const closed=samples.length,assets=new Set(samples.map(s=>s.assetKey)).size,first=closed?Math.min(...samples.map(s=>s.entryAt)):null,last=closed?Math.max(...samples.map(s=>s.exitAt)):null,days=closed?(last-first)/DAY:0,netCents=sumCents(samples.map(s=>s.pnlCents)),stressKnown=closed>0&&samples.every(s=>cents(s.extra50BpsCostCents)&&Number.isSafeInteger(s.stressedPnlCents)&&s.stressedPnlCents===s.pnlCents-s.extra50BpsCostCents),stressedNetCents=stressKnown?sumCents(samples.map(s=>s.stressedPnlCents)):null;
 let multiplier=.5,status='collecting',reason='Half baseline while collecting at least 12 completed trades, seven observed days and five distinct assets in this cohort.';
 if(closed>=12&&days>=7&&assets>=5){
  if(netCents===null){status='unavailable';reason='Half baseline: cohort totals cannot be represented safely; no profit inference.';}
  else if(netCents<=0){multiplier=.25;status='reduced';reason='Recent completed cohort returns are nonpositive after modeled costs; quarter baseline.';}
  else if(stressedNetCents===null||stressedNetCents<=0){status='cost-sensitive';reason='Half baseline: extra 50bps on every fill is unobserved or removes the recent modeled gain.';}
  else{multiplier=1;status='baseline';reason='Recent completed cohort outcomes pass the predeclared paper checkpoint, including adverse costs; baseline restored, never increased.';}
 }
 const outcomeMultiplier=multiplier,performanceStatus=status,pending=key?pendingPositions(state,key,valuation):null,failure=key?state.stats?.cohortFailedExits?.[key.id]:null,unresolvedFailure=finiteDate(failure?.lastAt)&&failure.lastAt<=now&&(!last||last<=failure.lastAt),pendingExits=key?Object.values(state.positions||{}).filter(p=>positionCohort(p)?.id===key.id&&p.plan?.pendingSignal).length:0;
 if(multiplier===1){
  if(pendingExits){multiplier=.25;status='pending-exit';reason='Quarter baseline: this cohort has an unresolved protective or staged exit; closed gains do not resolve it.';}
  else if(unresolvedFailure||pending?.unpricedOpenPositions||pending?.losingOpenPositions||pending?.pendingMarkedNetCents<0||pending?.openPositions>0&&pending.pendingMarkedNetCents===null){multiplier=.5;status='unresolved-exposure';reason=unresolvedFailure?'Half baseline: a failed exit needs a later completed round trip before baseline can be restored; elapsed time cannot clear it.':'Half baseline: open cohort positions have missing marks or unresolved marked losses; completed gains are not the whole result.';}
 }
 return {version:'paper-cohort-policy-v1',cohortKey:key?.id||null,multiplier,status,reason,outcomeMultiplier,performanceStatus,riskGuard:{pendingExits,unresolvedFailedExit:unresolvedFailure,openPositions:pending?.openPositions||0,unpricedOpenPositions:pending?.unpricedOpenPositions||0,losingOpenPositions:pending?.losingOpenPositions||0},closed,distinctAssets:assets,daysObserved:days,netCents:closed?netCents:null,stressedNetCents,firstEntryAt:first,lastExitAt:last,observationId:experimentId(samples),window:'Most recent 20 completed same-configuration / chain / category / strategy round trips; only outcomes known at decision time.',limits:'Experimental risk reduction, not calibrated profit probability or statistical proof. Correlated assets, open positions and missing execution data can invalidate apparent edge. Live trading is never enabled.'};
}

function pendingPositions(state,identity,valuation){
 const positions=Object.values(state.positions||{}).filter(p=>!identity||positionCohort(p)?.id===identity.id),marks=new Map((valuation?.positions||[]).map(p=>[p.key,p]));
 let unpriced=0,losing=0,markedNetCents=0;
 for(const p of positions){const marked=marks.get(p.key),original=p.initialOutlayCents??p.costCents,proceeds=p.netProceedsCents??0;if(!cents(marked?.marketValueCents)||!cents(original)||!cents(proceeds)){unpriced++;continue;}const value=marked.marketValueCents+proceeds-original;if(!Number.isSafeInteger(value)){unpriced++;continue;}markedNetCents=safeAdd(markedNetCents,value);losing+=Number(value<0);}
 return {openPositions:positions.length,unpricedOpenPositions:unpriced,losingOpenPositions:losing,pendingMarkedNetCents:unpriced?null:markedNetCents,pendingBasis:'Open round trips remain unresolved. Dated market value plus prior net exit proceeds minus original outlay; remaining exit costs are not deducted.'};
}

export function paperEvaluation(state,now=Date.now(),valuation){
 const experiments=Object.values(state.stats.experiments||{}).map(g=>({...g,samples:copySamples(g.samples.slice(-30)),winRatePct:g.closed?g.wins/g.closed*100:null,meanReturnPct:g.closed&&Number.isFinite(g.returnSum)?g.returnSum/g.closed:null,profitFactor:g.lossCents>0&&Number.isSafeInteger(g.gainCents)?g.gainCents/g.lossCents:null,daysObserved:Math.max(0,(g.lastExitAt-g.firstEntryAt)/DAY),status:g.id==='legacy-unversioned'?'unversioned':g.closed<30||g.lastExitAt-g.firstEntryAt<7*DAY?'collecting':'review-required'}));
 const identities=new Map(Object.values(state.stats.cohorts||{}).map(g=>[g.id,cohortIdentity(g)]));
 for(const p of Object.values(state.positions||{})){const i=positionCohort(p);if(i)identities.set(i.id,i);}
 for(const f of Object.values(state.stats.cohortFailedExits||{})){const i=cohortIdentity(f);if(i)identities.set(i.id,i);}
 const cohorts=[...identities.values()].filter(Boolean).map(identity=>{const g=state.stats.cohorts?.[identity.id],policy=cohortPolicy(state,identity,now,valuation),failure=state.stats.cohortFailedExits?.[identity.id];return {...identity,closed:g?.closed||0,netCents:g?g.netCents:0,winRatePct:g?.closed?g.wins/g.closed*100:null,meanReturnPct:g?.closed&&Number.isFinite(g.returnSum)?g.returnSum/g.closed:null,profitFactor:g?.lossCents>0&&Number.isSafeInteger(g.gainCents)?g.gainCents/g.lossCents:null,samples:copySamples(validSamples(g?.samples,now).slice(-30)),policy,...pendingPositions(state,identity,valuation),failedExitAttempts:failure?.lastAt<=now?failure.count:0};});
 return {at:now,mode:'prospective-paper',experiments,cohorts,pending:pendingPositions(state,null,valuation),ungroupedClosed:state.stats.ungroupedClosed||0,ungroupedCohortClosed:state.stats.ungroupedCohortClosed||0,status:experiments.some(g=>g.status==='review-required')?'review-required':'collecting',method:'Completed journal round trips grouped by immutable entry-plan configuration. Cohorts also preserve the entry chain, category and selected strategy. Modeled fees, slippage and dated taxes included; partial proceeds and cumulative adverse-cost stress count once at final exit. Open outcomes remain separate. No-trade periods and losses remain in the journal.',limits:['Thirty closed trades and seven observed days are a review checkpoint, not statistical proof or automatic live-trading permission.','The bounded cohort policy uses at most 20 completed trades with 12-trade / seven-day / five-asset checkpoints. It can reduce or restore baseline sizing only; it cannot raise hard limits or rewrite strategies.','Closed-trade results can hide unresolved losses: inspect open positions, missing marks and failed exits alongside them.','No calibrated profit probability, out-of-sample profitability claim, gas/MEV or user-size execution validation.','Legacy positions without an entry configuration or cohort snapshot remain unversioned or unclassified; missing adverse-cost history stays unknown.']};
}
