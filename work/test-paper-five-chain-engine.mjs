import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createPaperTrader,PAPER_DEFAULTS} from './axo-paper.mjs';
import {strategyConfig} from './axo-trade-strategy.mjs';
import {assessPaperExecution,PAPER_ROUTE_KIND} from './axo-paper-execution-policy.mjs';
import {BLUECHIP_CEILING_POLICY} from './axo-paper-policy-migrations.mjs';

const initial=Date.UTC(2026,9,16,12),DAY=86400000;
const address=(chain,n)=>chain==='solana'?'A'.repeat(31)+'BCDEFGHJKLMNPQRSTUVWXYZ'[n]:'0x'+n.toString(16).padStart(40,'0');
const token=(chain,at,price=10)=>({chain,address:address(chain,1),pair:chain==='arc'?'0x'+'2'.padStart(64,'0'):address(chain,2),symbol:'FIX',name:'Synthetic engine fixture',price,marketCap:2000000000,liquidity:2000000,volume1:50000,volume24:1000000,createdAt:at-30*DAY,seenAt:at,provider:'Synthetic fixture',url:'https://example.org/paper-fixture',credibleListing:{chain,address:address(chain,1),coinId:'fixture-'+chain,rank:10,marketCap:2000000000,at}});
function rawUnits(value){const [m,e='0']=String(value).split('e'),p=m.split('.'),n=BigInt(p.join('')),power=6+Number(e)-(p[1]?.length||0);return (power>=0?n*10n**BigInt(power):n/10n**BigInt(-power)).toString();}
function route(p,{now,side='buy',notionalUsd=50,quantity}={}){
 const counter=address(p.chain,3),times={receivedAt:now,expiresAt:now+60000};
 const leg=(name,fromAmountRaw,toAmountRaw,fromValueCents,toMinValueCents)=>({chain:p.chain,fromToken:name==='buy'?counter:p.address,toToken:name==='buy'?p.address:counter,fromDecimals:6,toDecimals:6,fromAmountRaw,toAmountRaw,toAmountMinRaw:toAmountRaw,fromValueCents,toMinValueCents,externalCostCents:0,costsComplete:true,...times});
 let buy,sell;
 if(side==='buy'){
  const from=Math.round(notionalUsd*100),to=Math.floor(from*.99),back=Math.floor(to*.99),tokens=rawUnits(to/100/p.price);
  buy=leg('buy',rawUnits(from/100),tokens,from,to);sell=leg('sell',tokens,rawUnits(back/100),to,back);
 }else{
  const input=rawUnits(quantity),from=Math.floor(Number(input)/1e6*p.price*100),to=Math.floor(from*.99),back=Math.floor(to*.99);
  sell=leg('sell',input,rawUnits(to/100),from,to);buy=leg('buy',sell.toAmountMinRaw,rawUnits(back/100/p.price),to,back);
 }
 return {kind:PAPER_ROUTE_KIND,status:'route-observed',chain:p.chain,address:p.address,poolContext:p.pool||p.pair,side,source:'LI.FI',counterToken:counter,taxesKnown:false,poolBinding:'not-established',...times,buy,sell};
}
function localSetup(p,now,{quoteBacked=true}={}){
 const execution=quoteBacked?assessPaperExecution(p,route(p,{now}),{now}).execution:{status:'simulated-route-observed',source:'Synthetic pool test',buyTax:0,sellTax:0,coverage:'available'};
 return {at:now,identity:{chain:p.chain,address:p.address,pool:p.pool||p.pair},eligible:true,strategy:'momentum',riskStatus:'screened',riskExcluded:false,technical:{status:'available',at:now-3600000,atrPct:1,rsi14:55,volumeAcceleration:2,trend:'rising'},entry:{status:'aligned',currentExtensionPct:1,reason:'Synthetic closed-bar entry'},execution,gaps:[]};
}

for(const chain of ['solana','robinhood','arc','base','bsc']){
 let now=initial,price=10;const quoted=['solana','robinhood','arc'].includes(chain),calls=[];
 const trader=createPaperTrader({autoStart:false,now:()=>now,getPools:()=>[token(chain,now,price)],localTradeSetup:p=>localSetup(p,now,{quoteBacked:quoted}),getPaperExecution:async(p,options)=>{calls.push({...options});return route(p,{now,...options});},model:async()=>{throw Error('No model or wallet calls in paper fixture');}});
 try{
  await trader.start({engine:'strategies'});await trader.tick();let status=await trader.status();
  assert.equal(status.valuation.positions.length,1,chain+' obtains a supported synthetic paper entry');const held=status.valuation.positions[0];
  if(chain==='arc')assert.equal(held.pool.length,66,'Arc V4 exact pool IDs preserve all 32 bytes through entry');
  assert.equal(status.realFunds,false);assert.equal(status.walletConnected,false);
  assert.equal(held.plan.opportunity.executionKind,quoted?PAPER_ROUTE_KIND:'provider-pool-simulation');
  if(quoted){
   assert.equal(calls.length,1);assert.equal(calls[0].side,'buy');assert.equal(calls[0].notionalUsd*100,held.notionalCents,'Entry recheck uses actual sized notional rather than the preliminary $50 sample');assert.ok(calls[0].notionalUsd<=100&&calls[0].notionalUsd>0);assert.notEqual(calls[0].notionalUsd,50);
   assert.equal(held.observation.executionCosts.taxesKnown,false);assert.equal(held.observation.executionCosts.buyTax,null);assert.equal(held.observation.executionCosts.buyHaircutPct,2);assert.equal(held.observation.executionEvidence.poolBinding,'not-established');
  }else{assert.equal(calls.length,0,'Provider-simulation chains retain their distinct path');assert.equal(held.observation.buyTax,0);}
  now+=60000;price=8;await trader.tick();status=await trader.status();
  assert.equal(status.valuation.positions.length,0,chain+' evaluates and records the stop exit');assert.equal(status.fills[0].action,'sell');assert.ok(status.valuation.realizedCents<0);assert.equal(status.evaluation.cohorts[0].closed,1);
  if(quoted){assert.equal(calls.length,2);assert.equal(calls[1].side,'sell');assert.equal(calls[1].quantity,held.quantity,'Exit recheck covers actual held quantity');assert.equal(calls[1].notionalUsd,undefined);assert.equal(status.decisions[0].input.execution.kind,PAPER_ROUTE_KIND);assert.equal(status.decisions[0].input.execution.buyTax,null);}
 }finally{trader.stop();}
}

const badRoutes=[
 ()=>null,
 e=>({...e,receivedAt:initial+1}),
 e=>({...e,poolContext:address('arc',4)}),
 e=>({...e,buy:{...e.buy,costsComplete:false}}),
 e=>({...e,buy:{...e.buy,fromValueCents:e.buy.fromValueCents-100}})
];
for(const bad of badRoutes){let calls=0;const trader=createPaperTrader({autoStart:false,now:()=>initial,getPools:()=>[token('arc',initial)],localTradeSetup:p=>localSetup(p,initial),getPaperExecution:async(p,o)=>{calls++;return bad(route(p,{now:initial,...o}));}});try{await trader.start({engine:'strategies'});await trader.tick();const s=await trader.status();assert.equal(calls,1);assert.equal(s.fills.length,0,'Missing/future/mismatched/incomplete/undersized route cannot create a paper entry');assert.match(s.lastStatus,/route recheck/i);}finally{trader.stop();}}

for(const change of ['pause','reconfigure']){
 let entered=false,release;const trader=createPaperTrader({autoStart:false,now:()=>initial,getPools:()=>[token('robinhood',initial)],localTradeSetup:p=>localSetup(p,initial),getPaperExecution:async(p,o)=>{entered=true;await new Promise(r=>release=r);return route(p,{now:initial,...o});}});
 try{await trader.start({engine:'strategies'});const job=trader.tick();for(let i=0;i<1000&&!entered;i++)await new Promise(r=>setTimeout(r,1));assert.equal(entered,true,'Actual-size route request is pending');if(change==='pause')await trader.pause();else await trader.start({engine:'strategies',maxEntryRiskBps:10});release();await job;assert.equal((await trader.status()).fills.length,0,change+' invalidates the pending route and old allocation');}finally{release?.();trader.stop();}
}

// A successful route is not permission to use an entry assessment captured before
// an asynchronous provider request. Re-read the current screening at fill time.
for(const stateAfterQuote of ['excluded','unavailable']){
 let unsafe=false,calls=0;
 const trader=createPaperTrader({autoStart:false,now:()=>initial,getPools:()=>[token('arc',initial)],localTradeSetup:p=>{const setup=localSetup(p,initial);return unsafe?{...setup,eligible:false,riskExcluded:stateAfterQuote==='excluded',riskStatus:stateAfterQuote}:setup;},getPaperExecution:async(p,o)=>{calls++;unsafe=true;return route(p,{now:initial,...o});}});
 try{await trader.start({engine:'strategies'});await trader.tick();const s=await trader.status();assert.equal(calls,1);assert.equal(s.fills.length,0,'Current '+stateAfterQuote+' risk rejects an entry even when its actual-sized route succeeds');assert.equal(s.valuation.positions.length,0);}finally{trader.stop();}
}

for(const change of ['price','liquidity','provider','missing']){
 let changed=false;
 const pools=()=>changed&&change==='missing'?[]:[{...token('arc',initial,changed&&change==='price'?20:10),...(changed&&change==='liquidity'?{liquidity:1500000}:{}),...(changed&&change==='provider'?{provider:'Replacement provider'}:{})}];
 const trader=createPaperTrader({autoStart:false,now:()=>initial,getPools:pools,localTradeSetup:p=>localSetup(p,initial),getPaperExecution:async(p,o)=>{changed=true;return route(p,{now:initial,...o});}});
 try{await trader.start({engine:'strategies'});await trader.tick();const s=await trader.status();assert.equal(s.fills.length,0,change+' change during a route probe cannot fill against the previous market');assert.match(s.decisions[0].result.reason,/market changed/i);}finally{trader.stop();}
}
{
 let now=initial;
 const trader=createPaperTrader({autoStart:false,now:()=>now,getPools:()=>[token('arc',now)],localTradeSetup:p=>localSetup(p,now),getPaperExecution:async(p,o)=>{const evidence=route(p,{now,...o});now++;return evidence;}});
 try{await trader.start({engine:'strategies'});await trader.tick();const s=await trader.status();assert.equal(s.fills.length,1,'A same-price/liquidity timestamp refresh is accepted');assert.equal(s.fills[0].observation.observedAt,initial+1,'Fill and its evidence reference use the current observation');}finally{trader.stop();}
}
{
 let now=initial,arcVisible=false,basePrice=10,calls=0;
 const trader=createPaperTrader({autoStart:false,now:()=>now,getPools:()=>[token('base',now,basePrice),...(arcVisible?[token('arc',now)]:[])],localTradeSetup:p=>localSetup(p,now,{quoteBacked:p.chain==='arc'}),getPaperExecution:async(p,o)=>{calls++;basePrice=20;return route(p,{now,...o});}});
 try{await trader.start({engine:'strategies'});await trader.tick();assert.equal((await trader.status()).fills.length,1);arcVisible=true;now+=60000;await trader.tick();const s=await trader.status();assert.equal(calls,1);assert.equal(s.fills.length,1,'Other-position repricing must invalidate the old equity-sized entry quote');assert.match(s.decisions[0].result.reason,/route recheck/i);}finally{trader.stop();}
}
{
 let now=initial,price=10,changeExit=true;
 const trader=createPaperTrader({autoStart:false,now:()=>now,getPools:()=>[token('arc',now,price)],localTradeSetup:p=>localSetup(p,now),getPaperExecution:async(p,o)=>{const proof=route(p,{now,...o});if(o.side==='sell'&&changeExit){price=7;changeExit=false;}return proof;}});
 try{await trader.start({engine:'strategies'});await trader.tick();const quantity=(await trader.status()).valuation.positions[0].quantity;now+=60000;price=8;await trader.tick();let s=await trader.status();assert.equal(s.fills.length,1,'Changed exit market cannot sell at the obsolete higher price');assert.equal(s.valuation.positions[0].quantity,quantity);assert.equal(s.valuation.positions[0].plan.pendingSignal.kind,'stop','A changed market retains the pending stop');now+=60000;await trader.tick();s=await trader.status();assert.equal(s.valuation.positions.length,0);assert.equal(s.fills[0].observation.price,7,'Retry uses the new market price');}finally{trader.stop();}
}

{
 const trader=createPaperTrader({autoStart:false,now:()=>initial,getPools:()=>[token('arc',initial,1)],localTradeSetup:p=>localSetup(p,initial),getPaperExecution:async(p,o)=>{const proof=route(p,{now:initial,...o}),units=(BigInt(proof.buy.toAmountMinRaw)/1000000n).toString();proof.buy.toDecimals=0;proof.buy.toAmountRaw=units;proof.buy.toAmountMinRaw=units;proof.sell.fromDecimals=0;proof.sell.fromAmountRaw=units;return proof;}});
 try{await trader.start({engine:'strategies'});await trader.tick();const s=await trader.status();assert.equal(s.fills.length,0,'A zero-decimal token cannot create fractional modeled tokens');assert.match(s.decisions[0].result.reason,/precision/i);}finally{trader.stop();}
}
{
 let now=initial,price=10;
 const trader=createPaperTrader({autoStart:false,now:()=>now,getPools:()=>[token('arc',now,price)],localTradeSetup:p=>localSetup(p,now),getPaperExecution:async(p,o)=>{const proof=route(p,{now,...o});if(o.side==='sell'){const units=Math.floor(o.quantity),value=Math.floor(units*p.price*100),minimum=Math.floor(value*.99);proof.sell={...proof.sell,fromDecimals:0,fromAmountRaw:String(units),fromValueCents:value,toMinValueCents:minimum,toAmountRaw:rawUnits(minimum/100),toAmountMinRaw:rawUnits(minimum/100)};delete proof.buy;}return proof;}});
 try{await trader.start({engine:'strategies'});await trader.tick();const before=await trader.status(),quantity=before.valuation.positions[0].quantity;assert.ok(!Number.isInteger(quantity));now+=60000;price=8;await trader.tick();const s=await trader.status();assert.equal(s.fills.length,1,'A whole-token sell quote cannot credit a fractional remaining token');assert.equal(s.valuation.positions[0].quantity,quantity);assert.equal(s.valuation.cashCents,before.valuation.cashCents);assert.ok(s.decisions.some(d=>/precision/i.test(d.result.reason)));assert.equal(s.valuation.positions[0].plan.pendingSignal.kind,'stop');}finally{trader.stop();}
}

// Once a quoted position exists, its exit does not depend on rebuilding an entry
// setup, nor on the ability to buy the token back after selling it.
for(const chain of ['solana','robinhood','arc']){
 let now=initial,price=10,missingSetup=false;const calls=[];
 const trader=createPaperTrader({autoStart:false,now:()=>now,getPools:()=>[token(chain,now,price)],localTradeSetup:p=>missingSetup?null:localSetup(p,now),getTradeSetup:async()=>{throw Error('An existing-position exit must not wait for new entry research');},getPaperExecution:async(p,o)=>{calls.push({...o});const proof=route(p,{now,...o});if(o.side==='sell')delete proof.buy;return proof;}});
 try{await trader.start({engine:'strategies'});await trader.tick();const held=(await trader.status()).valuation.positions[0];assert.ok(held);missingSetup=true;now+=60000;price=8;await trader.tick();const s=await trader.status();assert.equal(calls.length,2,chain+' exit requests its own current evidence despite unavailable entry cache');assert.equal(calls[1].side,'sell');assert.equal(calls[1].quantity,held.quantity);assert.equal(s.valuation.positions.length,0,chain+' stop sells through valid one-way exit evidence');assert.equal(s.fills[0].action,'sell');}finally{trader.stop();}
}

{
 let now=initial,price=10,blockSell=true;const calls=[];
 const trader=createPaperTrader({autoStart:false,now:()=>now,getPools:()=>[token('robinhood',now,price)],localTradeSetup:p=>localSetup(p,now),getPaperExecution:async(p,o)=>{calls.push({...o});if(o.side==='sell'&&blockSell)return null;const proof=route(p,{now,...o});if(o.side==='sell')delete proof.buy;return proof;}});
 try{
  await trader.start({engine:'strategies'});await trader.tick();const original=(await trader.status()).valuation.positions[0];
  now+=60000;price=11;await trader.tick();let s=await trader.status();assert.equal(s.fills.length,1,'Unavailable take-profit route cannot fabricate proceeds');assert.equal(s.valuation.positions[0].quantity,original.quantity);assert.equal(s.valuation.positions[0].plan.pendingSignal.kind,'take-profit');assert.equal(s.evaluation.cohorts[0].failedExitAttempts,1);
  blockSell=false;now+=60000;await trader.tick();s=await trader.status();const remaining=s.valuation.positions[0];assert.ok(remaining.quantity>0&&remaining.quantity<original.quantity,'The pending tranche sells only its requested original-position share');assert.equal(calls.at(-1).quantity,original.quantity*.25,'Provider exit recheck is for the actual partial-sale quantity');assert.equal(s.evaluation.cohorts[0].closed,0,'A profitable partial exit is not a completed win');
  now+=60000;price=8;await trader.tick();s=await trader.status();assert.equal(s.valuation.positions.length,0);assert.ok(Math.abs(calls.at(-1).quantity-remaining.quantity)<=Number.EPSILON*remaining.quantity,'Final stop checks only the remaining units');assert.equal(s.evaluation.cohorts[0].closed,1,'Partial and final fills produce one full-position outcome');
 }finally{trader.stop();}
}

// Use only a new temporary hash-chained journal; never read or modify a live run.
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'axo-five-chain-engine-')),ledger=path.join(dir,'legacy-paper.jsonl'),newLedger=path.join(dir,'new-paper.jsonl');
const oldConfig={...PAPER_DEFAULTS,...strategyConfig({maxMarketCap:7000000,stopPct:9,feeBps:23,maxEntryRiskBps:31}),version:'paper-strategy-v5'};
const oldPlan={version:'paper-strategy-v5',experimentId:'old-entry-config',config:{...oldConfig},entryPrice:10,initialQuantity:1,initialOutlayCents:1001,completed:[],lastObservedAt:0,highWater:10};
const oldFill={key:'base:'+address('base',1)+':'+address('base',2),chain:'base',address:address('base',1),pool:address('base',2),symbol:'OLD',quantity:1,initialQuantity:1,initialOutlayCents:1001,costCents:1001,netProceedsCents:0,notionalCents:1000,feeCents:1,cashDeltaCents:-1001,realizedCents:0,fillPrice:10,at:initial-8000,plan:oldPlan};
let head='0',sequence=0;const events=[];
function event(type,data,at){const base={version:1,id:'legacy-'+sequence++,at,previous:head,type,data},e={...base,hash:createHash('sha256').update(JSON.stringify(base)).digest('hex')};head=e.hash;events.push(e);}
event('start-run',{runId:'legacy-run',config:{...PAPER_DEFAULTS}},initial-10000);
event('strategy-config',{config:oldConfig},initial-9000);
event('decision',{proposal:{action:'buy',reason:'Historical synthetic fixture'},result:{accepted:true,action:'buy',fill:oldFill}},initial-8000);
event('control',{enabled:false},initial-7000);
await fs.writeFile(ledger,events.map(e=>JSON.stringify(e)).join('\n')+'\n');
const create=path=>createPaperTrader({ledgerPath:path,autoStart:false,now:()=>initial,getPools:()=>[]});
let trader=create(ledger);
try{
 const before=await trader.status(),migrated=await trader.upgradeEnabledRun();assert.equal(migrated.enabled,false);assert.equal(migrated.config.maxMarketCap,1e12);assert.equal(migrated.config.stopPct,9);assert.equal(migrated.config.feeBps,23);assert.equal(migrated.config.maxEntryRiskBps,31);assert.equal(migrated.runId,before.runId);assert.equal(migrated.valuation.cashCents,before.valuation.cashCents);assert.deepEqual(migrated.valuation.positions[0].plan,before.valuation.positions[0].plan,'Existing entry plan is unchanged by the actual journaled policy');assert.equal(migrated.ledger.events,before.ledger.events+1);
 assert.equal((await trader.upgradeEnabledRun()).ledger.events,migrated.ledger.events,'Repeated startup is idempotent');trader.stop();trader=create(ledger);assert.equal((await trader.status()).ledger.integrity,'verified');assert.equal((await trader.upgradeEnabledRun()).ledger.events,migrated.ledger.events,'Restart does not repeat ceiling change');
 await trader.start({engine:'strategies',maxMarketCap:5000000});await trader.pause();assert.equal((await trader.upgradeEnabledRun()).config.maxMarketCap,5000000,'Later deliberate operator ceiling survives startup');
 await trader.reset({confirm:'RESET PAPER SIMULATION'});await trader.start({engine:'strategies',maxMarketCap:3000000});await trader.pause();assert.equal((await trader.upgradeEnabledRun()).config.maxMarketCap,3000000,'Explicit reset does not regrant one-time expansion');
 const journal=(await fs.readFile(ledger,'utf8')).trim().split('\n').map(JSON.parse);assert.equal(journal.filter(e=>e.type==='paper-policy-upgrade'&&e.data.id===BLUECHIP_CEILING_POLICY).length,1);
 trader.stop();trader=create(newLedger);await trader.start({engine:'strategies',maxMarketCap:4000000});await trader.pause();trader.stop();trader=create(newLedger);assert.equal((await trader.upgradeEnabledRun()).config.maxMarketCap,4000000,'New explicitly configured run is not overwritten at its next restart');
}finally{trader.stop();await fs.rm(ledger,{force:true});await fs.rm(newLedger,{force:true});await fs.rmdir(dir);}
console.log('PASS five-chain paper engine: distinct quote/provider paths, actual-sized entry/exit rechecks, fresh entry risk, exits independent of entry cache/reverse-buy routes, unknown-tax honesty, failure and async cancellation, and one-time preserved-cap journal migration/replay. No live provider, wallet, model or production ledger used.');
