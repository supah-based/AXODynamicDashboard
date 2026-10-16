import assert from 'node:assert/strict';
import {PAPER_DEFAULTS,newPaperState,validatePaperDecision,paperValuation,createPaperTrader} from './axo-paper.mjs';
import {strategyConfig,positionSignal} from './axo-trade-strategy.mjs';
import {sizePaperOpportunity} from './axo-paper-sizing.mjs';

const initial=Date.parse('2026-10-16T12:00:00Z'),config=strategyConfig(),address=i=>'0x'+i.toString(16).padStart(40,'0');
const quote=(i=1,at=initial)=>({key:'base:'+address(i)+':'+address(i+100),chain:'base',address:address(i),pool:address(i+100),symbol:'TEST'+i,price:1,liquidity:1000000,observedAt:at,evidenceId:'evidence-'+i,provider:'Synthetic',buyTax:7.8,sellTax:0});
const state=newPaperState();state.config={...PAPER_DEFAULTS,...config};
const q=quote(),setup={eligible:true,strategy:'momentum',technical:{atrPct:1},execution:{status:'simulated-route-observed',buyTax:q.buyTax,sellTax:q.sellTax}},rank={eligible:true,category:'swing',score:80};
const sizing=sizePaperOpportunity({state,valuation:paperValuation(state,[q],initial),quote:q,setup,rank,config,now:initial});
assert.ok(sizing.allocationBps>0,'Tax-bearing synthetic entry has room for a net first target');
const proposal={action:'buy',assetKey:q.key,allocationBps:sizing.allocationBps,evidenceIds:[q.evidenceId],reason:'Synthetic plan-integrity fixture',opportunity:{version:'paper-opportunity-v1',chain:q.chain,category:'swing',strategy:'momentum',convictionScore:rank.score,sizing}};
const result=validatePaperDecision(state,proposal,[q],initial);assert.equal(result.accepted,true);
assert.ok(result.fill.fillPrice>q.price,'Effective execution cost still includes tax and slippage');
assert.equal(result.fill.plan.entryPrice,q.price,'New opportunity signal thresholds anchor to observed market price');
assert.equal(result.fill.plan.highWater,q.price);
assert.equal(positionSignal(result.fill,{...q,observedAt:initial+60000},initial+60000).signal,null,'An unchanged market must not trigger an artificial tax-inflated stop');
assert.equal(positionSignal(result.fill,{...q,price:.91,observedAt:initial+60000},initial+60000).signal.kind,'stop','A true observed decline still triggers the stop');
const captured=JSON.stringify(result.fill.plan);proposal.opportunity.sizing.stopPct=40;assert.equal(JSON.stringify(result.fill.plan),captured,'Accepted entry metadata is copied before later caller mutation');
state.positions[q.key]=result.fill;state.cashCents+=result.fill.cashDeltaCents;
const sell={action:'sell',assetKey:q.key,allocationBps:0,evidenceIds:[q.evidenceId],reason:'Synthetic exit with current source taxes'};
const sellQuote={...q,buyTax:0,sellTax:2,observedAt:initial+60000,price:1.1};
const before=validatePaperDecision(state,sell,[sellQuote],initial+60000);
state.config.feeBps=100;state.config.slippageBps=500;state.config.stopPct=30;
const after=validatePaperDecision(state,sell,[sellQuote],initial+60000);
assert.equal(after.fill.cashDeltaCents,before.fill.cashDeltaCents,'Later operator fee/slippage edits cannot change the open entry experiment');
assert.equal(JSON.stringify(result.fill.plan),captured,'Exit validation does not rewrite frozen thresholds');
const lowerCurrentTax=validatePaperDecision(state,sell,[{...sellQuote,sellTax:0}],initial+60000);assert.ok(lowerCurrentTax.fill.cashDeltaCents>after.fill.cashDeltaCents,'Fresh current sell tax still influences the exit estimate');
const legacy=newPaperState();legacy.config={...PAPER_DEFAULTS,...config};const oldBuy=validatePaperDecision(legacy,{...proposal,opportunity:undefined},[q],initial);assert.equal(oldBuy.fill.plan.entryPrice,oldBuy.fill.fillPrice,'Legacy plans retain their original entry threshold semantics');

const small=newPaperState();small.config={...PAPER_DEFAULTS,...config};small.cashCents=10000;
const smallQuote={...q,buyTax:0,sellTax:0},smallSetup={...setup,execution:{buyTax:0,sellTax:0}},smallRank={...rank,score:25};
const smallSize=sizePaperOpportunity({state:small,valuation:paperValuation(small,[smallQuote],initial),quote:smallQuote,setup:smallSetup,rank:smallRank,config,now:initial});
if(smallSize.allocationBps){const b=validatePaperDecision(small,{...proposal,opportunity:undefined,allocationBps:smallSize.allocationBps},[smallQuote],initial);small.positions[q.key]=b.fill;small.cashCents+=b.fill.cashDeltaCents;const s=validatePaperDecision(small,sell,[{...smallQuote,price:1-smallSize.stopPct/100}],initial);assert.ok(-b.fill.cashDeltaCents-s.fill.cashDeltaCents<=10000*smallSize.riskBudgetBps/10000,'Rounded entry and exit cents must fit the actual stop budget');}

let now=initial,available=1,rotating=false;
const pools=()=>Array.from({length:available},(_,n)=>({chain:'base',address:address(n+10),pair:address(n+110),name:'Rotation '+n,symbol:'R'+n,price:10,seenAt:now,createdAt:now-3*86400000,marketCap:2000000,liquidity:1000000,volume1:10000,volume24:1000000,url:'https://example.org/rotation/'+n,provider:'Synthetic'}));
const local=p=>({at:now,identity:{chain:p.chain,address:p.address,pool:p.pair||p.pool},eligible:!(rotating&&p.address===address(10)),strategy:'momentum',riskStatus:'screened',riskExcluded:false,technical:{status:'available',at:now-1000,atrPct:1,volumeAcceleration:rotating&&p.address===address(10)?.5:2,rsi14:55,trend:rotating&&p.address===address(10)?'falling':'rising'},entry:{status:'aligned',currentExtensionPct:2,reason:'Synthetic dated bars'},execution:{status:'simulated-route-observed',buyTax:0,sellTax:0}});
const trader=createPaperTrader({autoStart:false,now:()=>now,getPools:pools,localTradeSetup:local,getTradeSetup:async p=>local(p)});
try{
 await trader.start({...config,maxBuysPerDay:20});
 for(let i=1;i<=5;i++){available=i;await trader.tick();now+=60000;}
 let current=await trader.status();assert.equal(current.valuation.positions.length,5,'Fixture reaches the position ceiling');
 available=6;rotating=true;await trader.tick();current=await trader.status();
 assert.equal(current.valuation.positions.length,4,'A full portfolio can exit a weakening position for a qualified replacement');
 assert.equal(current.fills[0].action,'sell');assert.match(current.decisions[0].proposal.reason,/Rotation/);
 assert.equal(current.fills.filter(f=>f.action==='buy').length,5,'Rotation exits first; no same-cycle replacement or extra funds');
}finally{trader.stop();}

let waiting=false,release;const paused=createPaperTrader({autoStart:false,now:()=>now,getPools:()=>[pools().at(-1)],localTradeSetup:()=>null,getTradeSetup:async()=>{waiting=true;await new Promise(r=>release=r);return local(pools().at(-1));}});
try{await paused.start(config);const job=paused.tick();while(!waiting)await new Promise(r=>setTimeout(r,1));await paused.pause();release();await job;assert.equal((await paused.status()).fills.length,0,'Pause while evidence is pending cannot permit a later fill');}finally{paused.stop();}
console.log('PASS paper plan integrity: market-anchored new signals, immutable entry execution assumptions, live source tax use, legacy semantics, rounded stop risk, capacity-aware exit-first rotation, and pause during research.');
