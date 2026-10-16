import assert from 'node:assert/strict';
import {cohortPolicy,recordCompletedTrade,paperEvaluation} from './axo-paper-evaluation.mjs';

const DAY=86400000,now=Date.parse('2026-10-16T12:00:00Z');
const identity={experimentId:'fixture-config',chain:'base',category:'swing',strategy:'momentum'};
const makeState=()=>({stats:{},positions:{}});
function position(i,{experimentId=identity.experimentId,chain='base',category='swing',strategy='momentum',entryAt=now-12*DAY+i*DAY/2,address='0x'+String(i%6+1).repeat(40),pool='pool-'+i}={}){
 const key=chain+':'+address+':'+pool;
 return {key,chain,address,pool,at:entryAt,quantity:10,costCents:10000,initialOutlayCents:10000,netProceedsCents:0,plan:{experimentId,opportunity:{version:'paper-opportunity-v1',chain,category,strategy,convictionScore:70,sizing:{riskBudgetBps:25,allocationBps:300,policyMultiplier:.5,stopPct:8}}}};
}
function close(state,p,{pnl=1000,stress=100,at=p.at+DAY,remaining=0,accepted=true}={}){
 state.positions[p.key]=p;
 const event={at,data:{proposal:{action:'sell',assetKey:p.key},result:{accepted,action:accepted?'sell':'skip',fill:accepted?{key:p.key,remainingQuantity:remaining,netProceedsCents:p.initialOutlayCents+pnl,...(stress===undefined?{}:{extra50BpsCostCents:stress})}:undefined}}};
 recordCompletedTrade(state,event);if(accepted&&remaining===0)delete state.positions[p.key];return event;
}
function collection({pnl=1000,stress=100,count=16,overrides={}}={}){const s=makeState();for(let i=0;i<count;i++)close(s,position(i,overrides),{pnl,stress});return s;}

const partial=makeState(),p=position(1);close(partial,p,{pnl:-4000,stress:70,remaining:5});assert.equal(partial.stats.cohorts,undefined,'Partial profit-taking is not a completed trial');
p.costCents=5000;p.netProceedsCents=6000;
close(partial,p,{pnl:2000,stress:140});
let view=paperEvaluation(partial,now),group=view.cohorts[0];
assert.equal(group.closed,1);assert.equal(group.netCents,2000);assert.equal(group.samples[0].stressedPnlCents,1860,'Cumulative stress is counted once at full closure');assert.equal(group.samples[0].outlayCents,10000);
assert.equal(group.policy.multiplier,.5,'One profitable round trip cannot increase risk to baseline');

const winning=collection(),baseline=cohortPolicy(winning,identity,now);
assert.equal(baseline.closed,16);assert.equal(baseline.distinctAssets,6);assert.equal(baseline.status,'baseline');assert.equal(baseline.multiplier,1);assert.ok(baseline.daysObserved>=7);
assert.deepEqual(cohortPolicy(winning,identity,now+100*DAY),baseline,'Elapsed time and repeated scans cannot create evidence or promote sizing');
const saved=JSON.stringify(winning);view=paperEvaluation(winning,now);view.cohorts[0].samples[0].pnlCents=-999999;view.experiments[0].samples[0].pnlCents=-999999;assert.equal(JSON.stringify(winning),saved,'Evaluation consumers cannot mutate journal-derived samples');
assert.equal(cohortPolicy(JSON.parse(saved),identity,now).observationId,baseline.observationId,'Replay preserves the same policy observation identity');

const losing=collection({pnl:-100});assert.equal(cohortPolicy(losing,identity,now).multiplier,.25);
const fragile=collection({pnl:50,stress:100});assert.equal(cohortPolicy(fragile,identity,now).status,'cost-sensitive');assert.equal(cohortPolicy(fragile,identity,now).multiplier,.5);
const unknownStress=collection({stress:null});assert.equal(cohortPolicy(unknownStress,identity,now).stressedNetCents,null);assert.equal(cohortPolicy(unknownStress,identity,now).multiplier,.5,'Missing historical costs are not treated as zero');
assert.equal(cohortPolicy(collection({count:11}),identity,now).status,'collecting');
assert.equal(cohortPolicy(collection({overrides:{address:'0x'+'a'.repeat(40)}}),identity,now).distinctAssets,1,'Multiple pools cannot masquerade as independent assets');
assert.equal(cohortPolicy(collection({overrides:{address:'0x'+'a'.repeat(40)}}),identity,now).multiplier,.5);
assert.equal(cohortPolicy(collection({overrides:{entryAt:now-DAY}}),identity,now).status,'collecting','A same-day burst cannot satisfy the observation span');

for(const other of [{chain:'bsc'},{category:'degen'},{strategy:'dip-rebound'},{experimentId:'changed-config'}])assert.equal(cohortPolicy(winning,{...identity,...other},now).closed,0,'Outcome evidence never crosses cohort boundaries');
const future=JSON.parse(saved);close(future,position(50,{entryAt:now+DAY}),{pnl:-9000,at:now+2*DAY});assert.equal(Object.values(future.stats.cohorts)[0].closed,17);assert.deepEqual(cohortPolicy(future,identity,now),baseline,'Future outcomes cannot influence the current decision');
for(const override of [{at:0},{at:NaN},{at:now-20*DAY},{remaining:undefined},{accepted:false}]){const s=makeState(),bad=position(0);const event=close(s,bad,override);if(Object.hasOwn(override,'remaining')){const s2=makeState();s2.positions[bad.key]=bad;event.data.result.fill.remainingQuantity=undefined;recordCompletedTrade(s2,event);assert.equal(s2.stats.cohorts,undefined);}else assert.equal(s.stats.cohorts,undefined,'Invalid dates or rejected exits cannot become performance outcomes');}

const capped=collection({count:40});const last20=cohortPolicy(capped,identity,now+30*DAY);assert.equal(last20.closed,20,'Policy remains a bounded recent window');assert.ok(last20.multiplier<=1&&last20.multiplier>=.25);
const many=makeState();for(let i=0;i<100;i++)close(many,position(i,{experimentId:'config-'+i,entryAt:now-DAY}),{at:now});assert.equal(Object.keys(many.stats.cohorts).length,96);assert.equal(many.stats.ungroupedCohortClosed,4,'Additional journal history is acknowledged outside the retained cohort limit');

const mixed=JSON.parse(saved),open=position(100,{entryAt:now-DAY}),unpriced=position(101,{entryAt:now-DAY}),profitablePartial=position(102,{entryAt:now-DAY});
profitablePartial.netProceedsCents=9000;profitablePartial.costCents=2000;
mixed.positions[open.key]=open;mixed.positions[unpriced.key]=unpriced;mixed.positions[profitablePartial.key]=profitablePartial;
close(mixed,open,{accepted:false,at:now});
view=paperEvaluation(mixed,now,{positions:[{key:open.key,marketValueCents:1000},{key:unpriced.key,marketValueCents:null},{key:profitablePartial.key,marketValueCents:1500}]});
group=view.cohorts[0];assert.equal(group.openPositions,3);assert.equal(group.unpricedOpenPositions,1);assert.equal(group.losingOpenPositions,1,'Open round-trip loss includes already realized partial proceeds');assert.equal(group.pendingMarkedNetCents,null);assert.equal(group.failedExitAttempts,1);assert.equal(group.closed,16,'Failed exits and open losses cannot disappear into closed winning statistics');
assert.equal(view.pending.openPositions,3);assert.equal(paperEvaluation(mixed,now).pending.unpricedOpenPositions,3,'Absent mark evidence is explicitly unknown');
assert.equal(group.policy.performanceStatus,'baseline','Unresolved exposure does not rewrite completed performance');assert.equal(group.policy.outcomeMultiplier,1);assert.equal(group.policy.multiplier,.5,'An unpriced open loss cannot hide behind completed winners');
const openOnly=JSON.parse(saved),openP=position(110,{entryAt:now-DAY});openOnly.positions[openP.key]=openP;
const marked=value=>({positions:[{key:openP.key,marketValueCents:value}]});
assert.equal(cohortPolicy(openOnly,identity,now).multiplier,.5,'No current mark means no baseline restoration');
assert.equal(cohortPolicy(openOnly,identity,now,marked(9000)).multiplier,.5,'A marked open loss caps the otherwise passing cohort');
assert.equal(cohortPolicy(openOnly,identity,now,marked(11000)).multiplier,1,'A fresh nonlosing mark with no unresolved exit preserves the baseline');
openP.plan.pendingSignal={kind:'stop',sellBps:10000};assert.equal(cohortPolicy(openOnly,identity,now,marked(11000)).multiplier,.25,'A pending exit has priority even over a positive current mark');
delete openP.plan.pendingSignal;
close(openOnly,openP,{accepted:false,at:now});
const failurePolicy=cohortPolicy(openOnly,identity,now,marked(11000));assert.equal(failurePolicy.multiplier,.5);assert.equal(failurePolicy.riskGuard.unresolvedFailedExit,true);
assert.equal(cohortPolicy(openOnly,identity,now+100*DAY,marked(11000)).multiplier,.5,'A failed exit cannot expire into baseline restoration without a later completed outcome');
close(openOnly,openP,{pnl:1000,at:now+DAY});assert.equal(cohortPolicy(openOnly,identity,now+DAY).multiplier,1,'A later completed outcome resolves the failed-exit evidence guard');
const overflow=JSON.parse(saved);for(const s of Object.values(overflow.stats.cohorts)[0].samples){s.pnlCents=Number.MAX_SAFE_INTEGER-100;s.extra50BpsCostCents=0;s.stressedPnlCents=s.pnlCents;}
assert.equal(cohortPolicy(overflow,identity,now).netCents,null);assert.equal(cohortPolicy(overflow,identity,now).multiplier,.5,'Unsafe aggregate precision cannot imply positive evidence');
const overflowingAggregate=makeState();for(let i=0;i<3;i++)close(overflowingAggregate,position(i),{pnl:Number.MAX_SAFE_INTEGER-10000,stress:0});const overflowView=paperEvaluation(overflowingAggregate,now);assert.equal(overflowView.experiments[0].netCents,null);assert.equal(overflowView.cohorts[0].netCents,null,'Overflow remains unknown rather than becoming zero or an inaccurate amount');

const unclassified=makeState(),old=position(0);delete old.plan.opportunity;close(unclassified,old);assert.equal(paperEvaluation(unclassified,now).experiments[0].closed,1);assert.equal(paperEvaluation(unclassified,now).cohorts.length,0,'Old positions are not retroactively assigned current categories');
const mismatched=makeState(),wrong=position(0);wrong.plan.opportunity.chain='bsc';close(mismatched,wrong);assert.equal(paperEvaluation(mismatched,now).cohorts.length,0);
console.log('PASS prospective paper cohorts: complete round-trip stress, immutable entry cohort, finite chronological evidence, no future learning, bounded downside/recovery heuristic, no scan/time promotion, replay identity, capped retention, and unresolved loss/exit visibility.');
