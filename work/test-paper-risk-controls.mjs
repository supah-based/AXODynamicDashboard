import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Readable} from 'node:stream';
import {createPaperTrader,paperKey} from './axo-paper.mjs';
let now=Date.now(),price=10,authorized=false;const address='0x'+'1'.repeat(40),pair='0x'+'2'.repeat(40),path='work/paper-risk-control-test.jsonl',pool=()=>({chain:'base',address,pair,price,createdAt:now-4*86400000,seenAt:now,marketCap:2000000,liquidity:1000000,volume24:1000000,url:'https://example.com/fixture'});
const setup=p=>({at:now,identity:{chain:p.chain,address:p.address,pool:p.pool||p.pair},eligible:true,strategy:'momentum',riskStatus:'screened',technical:{status:'available',at:now,atrPct:2,volumeAcceleration:2,rsi14:55},entry:{status:'aligned',currentExtensionPct:2,reason:'Synthetic test'},execution:{status:'simulated-route-observed',buyTax:0,sellTax:0}});
const create=()=>createPaperTrader({ledgerPath:path,autoStart:false,now:()=>now,getPools:()=>[pool()],getTradeSetup:async p=>setup(p),localTradeSetup:setup,authorizeControl:async()=>authorized,reserveModel:async()=>{throw Error('No model calls');}});
const request=body=>Object.assign(Readable.from([JSON.stringify(body)]),{method:'POST',headers:{host:'127.0.0.1:43187',origin:'http://127.0.0.1:43187','x-axo-request':'1'}}),response=()=>({writeHead(status){this.status=status;},end(s){this.data=JSON.parse(s);}});
await fs.rm(path,{force:true});let trader=create();
try{
 assert.equal((await trader.upgradeEnabledRun()).runId,null,'Startup policy does not create or arm a run');
 await trader.start();const legacy=await trader.status();assert.equal(legacy.background,false);
 await trader.pause();assert.equal((await trader.upgradeEnabledRun()).background,false,'Paused legacy run stays paused');
 await trader.start();const upgraded=await trader.upgradeEnabledRun();assert.equal(upgraded.runId,legacy.runId);assert.equal(upgraded.background,true);const count=upgraded.ledger.events;assert.equal((await trader.upgradeEnabledRun()).ledger.events,count,'Repeated startup policy is idempotent');
 await trader.start({engine:'strategies',maxDailyLossPct:.5});await trader.tick();assert.equal((await trader.status()).fills.length,1);
 now+=60000;price=5;await trader.tick();const halted=await trader.status();assert.equal(halted.portfolioRisk.halt.kind,'daily-loss');assert.equal(halted.valuation.positions.length,0,'Protective exit still evaluates while entry loss halt is active');assert.equal(halted.evaluation.experiments[0].closed,1);assert.ok(halted.evaluation.experiments[0].netCents<0);
 trader.stop();trader=create();assert.equal((await trader.status()).portfolioRisk.halt.kind,'daily-loss','Halt survives journal replay');
 let res=response();await trader.handle(request({confirm:'REARM PAPER RISK LIMITS'}),res,new URL('http://local/api/paper/rearm'));assert.equal(res.status,403);
 authorized=true;res=response();await trader.handle(request({}),res,new URL('http://local/api/paper/rearm'));assert.equal(res.status,400,'Rearm requires deliberate confirmation');
 res=response();await trader.handle(request({confirm:'REARM PAPER RISK LIMITS'}),res,new URL('http://local/api/paper/rearm'));assert.equal(res.status,200);assert.equal(res.data.portfolioRisk.allowEntries,true);assert.ok(res.data.valuation.realizedCents<0);assert.equal(res.data.evaluation.experiments[0].closed,1,'Rearm never removes the loss');assert.equal(res.data.runId,legacy.runId);assert.ok(res.data.ledger.events>halted.ledger.events);
 assert.equal(res.data.realFunds,false);assert.equal(res.data.walletConnected,false);assert.ok(paperKey(pool()));
}finally{trader.stop();await fs.rm(path,{force:true});}
console.log('PASS journal integration: explicit existing-enabled-run upgrade, paused preservation, stop during loss halt, full-trade evaluation/replay, operator-only confirmed rearm without wiping losses or enabling funds.');
