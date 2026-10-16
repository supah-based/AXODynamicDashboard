import assert from 'node:assert/strict';
import {createPaperTrader,paperKey,paperQuotes,newPaperState,validatePaperDecision,PAPER_DEFAULTS} from './axo-paper.mjs';
import {strategyConfig} from './axo-trade-strategy.mjs';
import {PAPER_CHAINS,PAPER_CATEGORIES} from './axo-paper-opportunities.mjs';

let now=Date.UTC(2026,9,16,12);const day=86400000,alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const address=(n,chain)=>chain==='solana'?'A'.repeat(31)+alphabet[n]:'0x'+n.toString(16).padStart(40,'0');
function project(n,chain='base',category='degen'){
 const p={chain,address:address(n,chain),pair:address(n+20,chain),symbol:'TEST'+n,name:'Synthetic paper fixture',price:10,marketCap:1000000,liquidity:2000000,volume1:50000,volume24:1000000,createdAt:now-3*day,seenAt:now,provider:'Synthetic fixture',url:'https://example.org/fixture'};
 if(category==='swing')Object.assign(p,{tokenCreatedAt:now-30*day,tokenAgeSource:'Synthetic genesis fixture'});
 if(category==='bluechip')Object.assign(p,{marketCap:2e9,credibleListing:{chain,address:p.address,coinId:'test-'+n,rank:10,marketCap:2e9,at:now}});
 return p;
}
const refresh=p=>({...p,seenAt:now,credibleListing:p.credibleListing?{...p.credibleListing,at:now}:undefined});
const setup=(p,{eligible=true,extension=1,atr=.2,coverage='available'}={})=>({version:'paper-strategy-v5',at:now,identity:{chain:p.chain,address:p.address,pool:p.pool||p.pair},eligible,strategy:'momentum',riskStatus:'screened',riskExcluded:false,technical:{status:'available',at:now-3600000,atrPct:atr,rsi14:55,volumeAcceleration:2,trend:'rising'},entry:{status:'aligned',currentExtensionPct:extension,reason:'Synthetic fixture entry condition'},execution:{status:coverage==='available'?'simulated-route-observed':'unknown',coverage,buyTax:0,sellTax:0},gaps:eligible?[]:['Synthetic execution coverage gap']});
const create=(getPools,local)=>createPaperTrader({now:()=>now,autoStart:false,getPools,getTradeSetup:async()=>null,localTradeSetup:local,model:async()=>{throw Error('Paper strategy must not invoke model or wallet');}});

let pools=[project(1,'base','bluechip')];
const trader=create(()=>pools,p=>setup(p,{extension:p.address===address(3,p.chain)?2:1}));
try{
 await trader.start({engine:'strategies',maxChainExposurePct:10,stopPct:1,feeBps:0,slippageBps:25,maxEntryRiskBps:100});
 await trader.tick();let status=await trader.status();assert.equal(status.valuation.positions.length,1);
 const first=status.valuation.positions[0];assert.equal(first.chain,'base');assert.equal(first.notionalCents,100000,'First fixture fills the 10% target-chain cap');
 assert.equal(first.plan.opportunity.category,'bluechip');assert.equal(first.plan.opportunity.sizing.allocationBps,1000);assert.equal(first.plan.opportunity.sizing.policyMultiplier,.5);assert.ok(first.plan.opportunity.marketAt<=first.at);
 now+=60000;pools=[...pools.map(p=>({...refresh(p),price:first.fillPrice})),project(2,'base','bluechip'),project(3,'bsc','bluechip')];
 await trader.tick();status=await trader.status();assert.equal(status.valuation.positions.length,2);
 assert.deepEqual(status.valuation.positions.map(p=>p.chain).sort(),['base','bsc'],'Higher-scored full-capacity chain cannot block a feasible other-chain entry');
 assert.ok(!status.valuation.positions.some(p=>p.chain==='base'&&p.address===address(2,'base')));
 const frozen=JSON.stringify(status.valuation.positions.find(p=>p.key===first.key).plan);
 await trader.start({engine:'strategies',stopPct:20,maxEntryRiskBps:20});
 assert.equal(JSON.stringify((await trader.status()).valuation.positions.find(p=>p.key===first.key).plan),frozen,'Reconfiguration does not rewrite entry-time stop, horizon or conviction snapshot');
 assert.equal(status.realFunds,false);assert.equal(status.walletConnected,false);assert.equal(status.mode,'paper-only');
}finally{trader.stop();}

// Deterministic duplicate guard covers aliases to a held token even without the universe selector.
const p=project(4),alternative={...p,pair:address(30,'base')},state=newPaperState();state.config={...PAPER_DEFAULTS,...strategyConfig()};
const q=paperQuotes([alternative],now,state.config)[0];state.positions.old={chain:p.chain,address:p.address,quantity:1,key:'old',costCents:100};
const duplicate=validatePaperDecision(state,{action:'buy',assetKey:q.key,allocationBps:100,evidenceIds:[q.evidenceId],reason:'Synthetic duplicate probe'},[q],now);
assert.equal(duplicate.accepted,false);assert.match(duplicate.reason,/same token/);

let timedPool=project(5),timed=create(()=>[timedPool],p=>setup(p));
try{
 await timed.start({engine:'strategies'});await timed.tick();const entered=(await timed.status()).valuation.positions[0];assert.equal(entered.plan.opportunity.sizing.maxHoldingHours,24);
 now+=25*3600000;timedPool=refresh(timedPool);await timed.tick();const ended=await timed.status();assert.equal(ended.valuation.positions.length,0);assert.equal(ended.fills[0].action,'sell');
 assert.match(ended.decisions[0].proposal.reason,/holding horizon/,'Time limit exits use the current observation even without a take-profit hit');
 assert.equal(ended.evaluation.cohorts[0].closed,1);assert.ok(ended.evaluation.cohorts[0].netCents<0,'Unchanged-price round trip retains modeled cost loss');
}finally{timed.stop();}

const rows=PAPER_CHAINS.flatMap(chain=>PAPER_CATEGORIES.map((c,i)=>project(i+1,chain,c))),missingAge={...project(8),createdAt:null},dated={...project(9,'base','swing'),seenAt:now-300001};
const coverage=create(()=>[...rows,missingAge,dated],p=>['base','bsc'].includes(p.chain)?setup(p):setup(p,{eligible:false,coverage:'unsupported'}));
try{
 await coverage.start({engine:'strategies'});const status=await coverage.status(),o=status.opportunities;
 assert.equal(o.coverage.length,15);assert.equal(o.rows.length,15);assert.ok(o.coverage.every(c=>c.observed>=1));
 assert.ok(o.rows.filter(p=>['solana','robinhood','arc'].includes(p.identity.chain)).every(p=>p.status==='blocked'&&p.allocationBps===0));
 assert.ok(o.rows.filter(p=>['base','bsc'].includes(p.identity.chain)).every(p=>p.status==='ready'));
 assert.equal(o.unclassified.find(c=>c.chain==='base').observed,1);assert.ok(o.gaps.some(x=>x.includes('current five-minute')));
 assert.equal(o.coverage.find(c=>c.chain==='base'&&c.category==='swing').waiting,1,'Dated market rows remain represented in coverage waiting counts');
 assert.equal(o.executionCoverage.filter(c=>c.status==='unsupported').length,3);
 assert.ok(o.rows.every(p=>p.scoreKind==='evidence-strength-not-probability'));
 assert.equal(status.totals.fills,0,'Inspecting opportunities does not execute paper entries');
}finally{coverage.stop();}
console.log('PASS integrated paper opportunities: feasible second-chain selection, immutable entry plan, duplicate-pool protection, timed exits after costs, fifteen-cell coverage and explicit unsupported-chain blockers. No wallet, provider, live ledger or model used.');
