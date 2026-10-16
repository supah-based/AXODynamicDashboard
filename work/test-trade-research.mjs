import assert from 'node:assert/strict';
import {createTradeResearch} from './axo-trade-research.mjs';
import {STRATEGY_DEFAULTS} from './axo-trade-strategy.mjs';
const now=Date.now(),a='0x'+'1'.repeat(40),b='0x'+'2'.repeat(40),identity={chain:'base',address:a,pool:b},p={...identity,pair:b,price:10,seenAt:now,liquidity:1000000,marketCap:1000000,buys:20,sells:10},start=Math.floor(now/3600000)*3600-60*3600,history={status:'available',...identity,timeframe:'1h',bucketSeconds:3600,currency:'USD',receivedAt:now,source:'Fixture',candles:Array.from({length:60},(_,i)=>[start+i*3600,10,10.1,9.9,10,1000])};let histories=0;
const service=createTradeResearch({now:()=>now,getProject:async()=>p,getHistory:async()=>{histories++;return history;},getRisk:async()=>({source:'GoPlus',status:'available',chain:'base',address:a,receivedAt:now,checks:['is_honeypot','cannot_sell_all','owner_change_balance'].map(key=>({key,value:'0'}))}),getSimulation:async()=>({status:'available',...identity,receivedAt:now,simulationSuccess:true,isHoneypot:false,buyTax:0,sellTax:0})});await Promise.all([service.analyze(identity),service.analyze(identity)]);assert.equal(histories,1);const cfg={...STRATEGY_DEFAULTS};assert.notEqual(service.local({...identity,price:10,observedAt:now},cfg).entry.status,'wait · extended');assert.equal(service.local({...identity,price:210,observedAt:now,marketCap:20000000},cfg).entry.status,'wait · extended','Fresh execution price rechecks anti-chasing against cached closed indicators');assert.equal(service.local({...identity,price:10,observedAt:now-300001},cfg).entry.status,'unknown');assert.equal(service.local({...identity,price:10,observedAt:now,marketCap:null},cfg).eligible,false,'Current unknown MC cannot inherit cached circulating cap');assert.match(service.local({...identity,price:10,provider:'Different provider',observedAt:now},cfg).gaps.join(),/participation/);p.price=210;assert.equal((await service.analyze(identity)).entry.status,'wait · extended','HTTP cache refreshes current quote from existing cache without fetching more history');assert.equal(histories,1);await service.analyze({chain:'base',address:'0x'+'3'.repeat(40),pool:b});assert.equal(histories,1,'Mismatched project cache does not trigger provider work');console.log('PASS trade research coalescing, immutable cached inputs, parameter reuse and fresh execution-price/market-cap guard without extra history calls.');

let latestRisk={source:"GoPlus",status:"available",chain:"base",address:a,receivedAt:now,checks:[{key:"is_honeypot",value:"0"},{key:"cannot_sell_all",value:"0"},{key:"owner_change_balance",value:"0"}]};const guarded=createTradeResearch({now:()=>now,getProject:async()=>({...p,price:10}),getHistory:async()=>history,getRisk:async()=>latestRisk,getCachedRisk:()=>latestRisk,getSimulation:async()=>({status:"available",...identity,receivedAt:now,simulationSuccess:true,isHoneypot:false,buyTax:0,sellTax:0})});await guarded.analyze(identity);latestRisk={...latestRisk,checks:[{key:"is_honeypot",value:"1"}]};assert.equal(guarded.local({...identity,price:10,observedAt:now},cfg).riskExcluded,true,"New severe evidence overrides cached technical setup immediately");latestRisk=null;assert.equal(guarded.local({...identity,price:10,observedAt:now},cfg).riskStatus,"unknown","Unavailable risk history cannot reuse an old passed entry gate");console.log("PASS cached technical setups consume current shared risk, including immediate severe flags and missing-ledger failure.");

const freshParticipation=service.local({...identity,price:10,provider:'Different provider',observedAt:now,transactions:{h1:{buys:30,sells:10}}},cfg);assert.ok(!freshParticipation.gaps.some(g=>g.includes('participation')),'Fresh nested hourly counts replace older top-level counts when the provider changes');

const currentTime=now+60000,atomic=createTradeResearch({now:()=>currentTime,getProject:async()=>({...p,price:10,seenAt:now}),getHistory:async()=>history,getRisk:async()=>latestRisk,getSimulation:async()=>null});await atomic.analyze(identity);const partial=atomic.local({...identity,price:10,observedAt:currentTime,liquidity:1000000},cfg);assert.ok(partial.gaps.some(g=>g.includes('Actual circulating market cap missing')),'A newer partial quote cannot re-date an older market cap');

const dated={...p,price:10,createdAt:now-10*86400000,tokenCreatedAt:now-30*86400000,tokenAgeSource:'Synthetic exact genesis'};
let categoryHistoryReads=0;
const categories=createTradeResearch({now:()=>now,getProject:async()=>dated,getHistory:async()=>{categoryHistoryReads++;return history;},getRisk:async()=>latestRisk,getSimulation:async()=>null});
await categories.analyze(identity);
assert.equal(categories.local(dated,cfg).category,'swing');
const revoked={...dated,tokenCreatedAt:null,tokenAgeSource:null};
assert.equal(categories.local(revoked,cfg).category,null,'Explicitly revoked current genesis evidence cannot survive in cached setup inputs');
const listed={...revoked,marketCap:2e9,credibleListing:{chain:p.chain,address:p.address,coinId:'synthetic-test',rank:10,marketCap:2e9,at:now}};
assert.equal(categories.local(listed,cfg).category,'bluechip','New separately dated exact listing enriches the cached history immediately');
assert.equal(categories.local({...listed,credibleListing:null},cfg).category,null,'Listing revocation immediately removes cached category qualification');
assert.equal(categories.local({...listed,credibleListing:{...listed.credibleListing,address:b}},cfg).category,null,'Mismatched current listing cannot borrow cached exact listing');
assert.equal(categories.local({...listed,credibleListing:{...listed.credibleListing,at:now+1}},cfg).category,null,'Future-dated current listing cannot borrow cached exact listing');
assert.equal(categoryHistoryReads,1,'Identity facts update without another history fetch');
categories.stop();
console.log('PASS cached technical setup category enrichment, explicit age/listing revocation, wrong-identity and future-dated listing rejection without extra history calls.');

let routeClock=now,routeRequests=0;
const routeIdentity={...identity,chain:'robinhood'},routeProject={...dated,...routeIdentity};
const routeFailure=createTradeResearch({now:()=>routeClock,getProject:async()=>({...routeProject,seenAt:routeClock}),getHistory:async()=>({...history,...routeIdentity}),getRisk:async()=>null,getSimulation:async()=>{routeRequests++;return {...routeIdentity,kind:'bidirectional-quote-paper',status:'unavailable',source:'LI.FI',message:'Synthetic route coverage gap'};}});
try{
 await routeFailure.analyze(routeIdentity);
 assert.equal(routeFailure.local(routeProject).execution.coverage,'unavailable','Unavailable quote evidence stays visible instead of disappearing immediately');
 routeClock+=29999;await routeFailure.analyze(routeIdentity);assert.equal(routeRequests,1,'Bounded negative caching avoids re-requesting a known route gap every sweep');
 routeClock++;assert.equal(routeFailure.local(routeProject),null,'Quote failure cache expires at thirty seconds');
 await routeFailure.analyze(routeIdentity);assert.equal(routeRequests,2,'Expired failure evidence can refresh promptly');
}finally{routeFailure.stop();}
console.log('PASS quote-route failures retain visible coverage gaps with a thirty-second retry boundary.');
