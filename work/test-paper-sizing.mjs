import assert from 'node:assert/strict';
import {sizePaperOpportunity,CATEGORY_POLICY} from './axo-paper-sizing.mjs';
import {newPaperState,PAPER_DEFAULTS} from './axo-paper.mjs';
import {strategyConfig} from './axo-trade-strategy.mjs';

const now=Date.UTC(2026,9,16,12);
function input(overrides={}){
 const config={...PAPER_DEFAULTS,...strategyConfig({stopPct:4,maxEntryRiskBps:100,slippageBps:25})},state=newPaperState();state.config=config;
 return {state,config,now,valuation:{complete:true,equityCents:1000000,positions:[]},quote:{chain:'base',liquidity:1000000,price:1},setup:{eligible:true,strategy:'momentum',technical:{atrPct:1},execution:{status:'simulated-route-observed',buyTax:0,sellTax:0}},rank:{eligible:true,category:'bluechip',score:80},...overrides};
}
const base=input(),size=sizePaperOpportunity(base);
assert.ok(size.allocationBps>0&&size.allocationBps<=base.state.config.maxPositionBps);
assert.ok(size.plannedLossBps<=size.riskBudgetBps,'Integer allocation respects modeled stop-loss budget');
assert.equal(size.policyMultiplier,.5,'Unproven cohorts begin at half baseline');
const lower=sizePaperOpportunity({...base,rank:{...base.rank,score:20}}),higher=sizePaperOpportunity({...base,rank:{...base.rank,score:100}});
assert.ok(lower.allocationBps<size.allocationBps&&size.allocationBps<higher.allocationBps,'Greater evidence strength increases size within hard limits');
const volatile=sizePaperOpportunity({...base,setup:{...base.setup,technical:{atrPct:8}}});
assert.equal(volatile.stopPct,16);assert.ok(volatile.allocationBps<size.allocationBps,'Wider volatility-derived stop reduces notional');
assert.equal(sizePaperOpportunity({...base,setup:{...base.setup,technical:{atrPct:13}}}).allocationBps,0,'Excessively wide stops block entries');
const degen=sizePaperOpportunity({...base,rank:{...base.rank,category:'degen'}}),swing=sizePaperOpportunity({...base,rank:{...base.rank,category:'swing'}});
assert.ok(degen.allocationBps<swing.allocationBps&&swing.allocationBps<size.allocationBps,'Speculative categories receive less risk than blue chips at equal evidence');
assert.deepEqual([degen.maxHoldingHours,swing.maxHoldingHours,size.maxHoldingHours],[24,120,336]);

for(const execution of [{buyTax:10,sellTax:10},{buyTax:100,sellTax:0},{buyTax:null,sellTax:0}])assert.equal(sizePaperOpportunity({...base,setup:{...base.setup,execution:{status:'simulated-route-observed',...execution}}}).allocationBps,0,'Missing or excessive taxes cannot become a modeled profitable target');
const costFailure=input();costFailure.config.feeBps=100;costFailure.config.slippageBps=500;costFailure.config.tranches=[{targetPct:1,sellPct:25}];
assert.equal(sizePaperOpportunity(costFailure).allocationBps,0,'A target below round-trip assumptions blocks entry');
assert.equal(sizePaperOpportunity({...base,rank:{...base.rank,score:NaN}}).allocationBps,0);
assert.equal(sizePaperOpportunity({...base,valuation:{...base.valuation,complete:false,equityCents:null}}).allocationBps,0);
for(const price of [undefined,null,NaN,Infinity,0,-1])assert.equal(sizePaperOpportunity({...base,quote:{...base.quote,price}}).allocationBps,0,'Missing or invalid execution price blocks sizing');

const pool=input({quote:{chain:'base',liquidity:1000,price:1}}),poolSize=sizePaperOpportunity(pool);
assert.ok(poolSize.notionalCents<=pool.quote.liquidity*100*pool.state.config.maxParticipationBps/10000);
assert.ok(poolSize.limits.includes('pool participation'));
const position=input();position.state.config.maxPositionBps=10;const positionSize=sizePaperOpportunity(position);
assert.equal(positionSize.allocationBps,10);assert.ok(positionSize.limits.includes('position ceiling'));
const cash=input();cash.state.cashCents=200100;const cashSize=sizePaperOpportunity(cash);
assert.equal(cashSize.allocationBps,0,'Required cash reserve plus rounded fee blocks a sub-dollar allocation');
cash.state.cashCents=201001;const small=sizePaperOpportunity(cash);assert.ok(small.allocationBps>0);
assert.ok(small.notionalCents+Math.ceil(small.notionalCents*cash.config.feeBps/10000)<=cash.state.cashCents-Math.ceil(cash.valuation.equityCents*cash.config.cashReserveBps/10000));

function withPosition(chain,category,marketValueCents){const x=input(),p={key:'fixture',chain,marketValueCents,plan:{opportunity:{category}}};x.state.positions={fixture:p};x.valuation.positions=[p];x.state.cashCents=1000000-marketValueCents;return x;}
const gross=withPosition('bsc','swing',400000);assert.equal(sizePaperOpportunity(gross).allocationBps,0,'Full gross exposure blocks a different-chain candidate');
const chain=withPosition('base','swing',250000);assert.equal(sizePaperOpportunity(chain).allocationBps,0,'Full target-chain exposure blocks same-chain entry');
assert.ok(sizePaperOpportunity({...chain,quote:{...chain.quote,chain:'bsc'}}).allocationBps>0,'Other-chain capacity remains usable');
const category=withPosition('bsc','bluechip',CATEGORY_POLICY.bluechip.maxCategoryExposurePct*10000);assert.equal(sizePaperOpportunity(category).allocationBps,0,'Full category exposure blocks another chain in that category');
const legacy=withPosition('bsc',undefined,150000);delete legacy.state.positions.fixture.plan.opportunity;
assert.equal(sizePaperOpportunity({...legacy,rank:{...legacy.rank,category:'degen'}}).allocationBps,0,'Unknown legacy category exposure is reserved against every new category budget');
assert.ok(sizePaperOpportunity({...legacy,rank:{...legacy.rank,category:'swing'}}).allocationBps>0,'Unclassified legacy exposure consumes capacity without inventing its category');
const near=withPosition('base','swing',249000),nearSize=sizePaperOpportunity(near),fee=Math.ceil(nearSize.notionalCents*near.config.feeBps/10000);
assert.ok(nearSize.allocationBps>0);assert.ok((249000+nearSize.notionalCents)/(1000000-fee)*100<=25,'Integer sizing stays below remaining chain capacity after rounded fees');
const full=input();full.state.positions=Object.fromEntries(Array.from({length:5},(_,i)=>[i,{chain:'base'}]));assert.equal(sizePaperOpportunity(full).allocationBps,0,'Position-count ceiling remains authoritative');
const before=JSON.stringify(base);sizePaperOpportunity(base);assert.equal(JSON.stringify(base),before,'Sizing does not mutate portfolio or strategy configuration');
console.log('PASS evidence-weighted paper sizing: monotonic conviction, volatility stops, cost rejection, category horizons, cash/position/pool/gross/chain/category caps and integer fee boundaries. Synthetic fixtures only.');
