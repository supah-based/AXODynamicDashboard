import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {model}=createRequire(import.meta.url)('./axo-reward-education.cjs');const now=Date.now(),address='0x'+'1'.repeat(40);
const d={identity:{officialMatch:true,chainId:4663,address:'0x219b75d4068253cee3e83b8ad97ac8393d76fb1d'},rewards:{catalogAt:now,observedAt:now,selected:[{address,symbol:'TEST'}],assets:[{address,symbol:'TEST',distributed:'12.123456789123456789',priceAt:now}],minimumAxo:'1000000',eligibleHolders:4,distributionCount:3,eventHistoryComplete:true,markTotalUsd:12},fees:{observedAt:now,buyBps:500,rewardBps:300}};
let m=model(d,now);assert.equal(m.selected[0].symbol,'TEST');assert.equal(m.assets[0].distributed,'12.123456789123456789');assert.equal(m.buyHookPercent,5);assert.equal(m.rewardTradePercent,3);assert.equal(m.holderPayments,null);assert.equal(m.currentMarkUsd,12);
assert.equal(model(d,now+300001).selected.length,0);assert.equal(model(d,now+300001).assets.length,0);assert.equal(model({...d,identity:{...d.identity,address}},now).assets.length,0);
assert.equal(model({...d,rewards:{...d.rewards,eventHistoryComplete:false}},now).distributionCount,null);
assert.equal(model({...d,rewards:{...d.rewards,assets:[{...d.rewards.assets[0],priceAt:now-300001}]}},now).currentMarkUsd,null);
assert.equal(model({...d,fees:{...d.fees,rewardBps:10001}},now).rewardTradePercent,null);
console.log('PASS: current basket vs lifetime assets, precise separate denominations, no inferred holder payments/profit, exact identity, freshness, incomplete receipt history and honest fee denominators.');
