import assert from 'node:assert/strict';
import {assessPaperExecution,paperExecutionCosts,PAPER_ROUTE_KIND} from './axo-paper-execution-policy.mjs';
import {paperQuotes,paperKey} from './axo-paper.mjs';
import {mergePaperPools,exactPublicPoolKey} from './axo-paper-universe.mjs';
import {buildOpportunityUniverse} from './axo-paper-opportunities.mjs';
import {createSimulationApi} from './axo-simulation-api.mjs';

const now=Date.UTC(2026,9,16,12),address=n=>'0x'+n.toString(16).padStart(40,'0');
function fixture({chain='robinhood',side='buy',cents=10000}={}){
 const token=chain==='solana'?'A'.repeat(32):address(1),counter=chain==='solana'?'B'.repeat(32):address(2),pool=chain==='solana'?'C'.repeat(32):'0x'+'3'.repeat(64),identity={chain,address:token,pool};
 const leg=(name,value,minimum)=>({chain,fromToken:name==='buy'?counter:token,toToken:name==='buy'?token:counter,fromDecimals:6,toDecimals:6,fromAmountRaw:String(value*10000),toAmountRaw:String(value*10000),toAmountMinRaw:String(minimum*10000),fromValueCents:value,toMinValueCents:minimum,externalCostCents:0,costsComplete:true,receivedAt:now-1000,expiresAt:now+20000});
 const first=Math.floor(cents*.99),second=Math.floor(first*.99),evidence={kind:PAPER_ROUTE_KIND,status:'route-observed',chain,address:token,poolContext:pool,side,source:'LI.FI',counterToken:counter,receivedAt:now-500,expiresAt:now+20000,taxesKnown:false,poolBinding:'not-established'};
 evidence[side]=leg(side,cents,first);evidence[side==='buy'?'sell':'buy']=leg(side==='buy'?'sell':'buy',first,second);
 return {identity,evidence};
}
const assess=(f,options={})=>assessPaperExecution(f.identity,f.evidence,{now,side:f.evidence.side,...options});
for(const chain of ['solana','robinhood','arc']){
 const f=fixture({chain}),before=JSON.stringify(f),result=assess(f,{notionalCents:10000});
 assert.equal(result.usable,true,chain);assert.equal(result.execution.status,'quoted-route-observed');
 assert.equal(result.execution.buyTax,null);assert.equal(result.execution.sellTax,null);assert.equal(result.execution.taxesKnown,false);
 assert.equal(result.execution.poolBinding,'not-established');assert.equal(result.execution.simulationSuccess,undefined);
 assert.deepEqual(paperExecutionCosts(result.execution),{buyHaircutPct:2,sellHaircutPct:2,taxSource:null,maxNotionalCents:10000,buyTax:null,sellTax:null,taxesKnown:false,kind:PAPER_ROUTE_KIND});
 assert.equal(JSON.stringify(f),before,'Pure assessment does not mutate its observations');
}
const failures=[
 e=>e.status='available',e=>e.kind='simulation',e=>e.source='unknown',e=>e.taxesKnown=true,e=>e.poolBinding='exact-pool',e=>e.address=address(9),e=>e.poolContext=address(8),e=>e.side='sell',
 e=>e.receivedAt=now+1,e=>e.expiresAt=now,e=>e.expiresAt=now+60000,e=>e.buy.receivedAt=now-61000,e=>e.buy.expiresAt=now-1,
 e=>e.buy.fromToken=address(9),e=>e.sell.toToken=address(9),e=>e.buy.chain='arc',e=>e.sell.fromDecimals=9,
 e=>e.buy.toAmountMinRaw='0',e=>e.sell.fromAmountRaw='0',e=>e.buy.toAmountRaw='1',e=>e.sell.fromAmountRaw='42',
 e=>e.buy.costsComplete=false,e=>e.buy.externalCostCents=null,e=>e.buy.fromValueCents='10000',e=>e.sell.toMinValueCents=NaN,
 e=>e.buy.externalCostCents=1000,e=>e.sell.externalCostCents=1000,e=>e.buy.fromDecimals=-1
];
for(const mutate of failures){const f=fixture();mutate(f.evidence);assert.equal(assess(f).usable,false,mutate.toString());}
for(const chain of ['solana','robinhood','arc'])for(const field of ['fromAmountRaw','toAmountRaw','toAmountMinRaw']){
 const f=fixture({chain});f.evidence.buy[field]=(chain==='solana'?1n<<64n:1n<<256n).toString();const result=assess(f);
 assert.equal(result.usable,false);assert.ok(result.gaps.some(g=>g.includes('chain integer bounds')),chain+' '+field+' independently enforces the token amount width');
}
assert.equal(assess(fixture({chain:'base'})).usable,false,'Quote route path cannot override the existing simulation chains');
const casing=fixture({chain:'solana'});casing.evidence.address=casing.evidence.address.toLowerCase();assert.equal(assess(casing).usable,false,'Solana token matching is case-sensitive');
const boundary=fixture();boundary.evidence.buy.toMinValueCents=9800;assert.equal(assess(boundary).usable,true,'Exactly 2% measured leg cost is within the paper model');boundary.evidence.buy.externalCostCents=1;assert.equal(assess(boundary).usable,false,'A further one-cent external cost exceeds the ceiling');
assert.equal(assess(fixture({cents:10001})).usable,false,'New positions cannot exceed the measured $100 route limit');
assert.equal(assess(fixture(),{notionalCents:9999}).usable,false,'Quote cannot spend more than the actual proposed notional');
assert.equal(assess(fixture(),{notionalCents:9990}).usable,false);
assert.equal(assess(fixture({cents:9999}),{notionalCents:10000}).usable,true,'One-cent conversion flooring is accepted');
assert.equal(assess(fixture({cents:9998}),{notionalCents:10000}).usable,false,'Probe evidence cannot replace a different final notional');

const exit=fixture({side:'sell'});
assert.equal(assess(exit).usable,false,'A paper exit must bind the held quantity');
assert.equal(assess(exit,{quantity:100}).usable,true);
assert.equal(assess(exit,{quantityRaw:'100000000'}).usable,true);
assert.equal(assess(exit,{quantity:100.000001}).usable,true,'At most one raw unit of conversion difference');
assert.equal(assess(exit,{quantity:100.000002}).usable,false);
assert.equal(assess(exit,{quantityRaw:'100000001'}).usable,false,'Raw quantities have no conversion tolerance');
assert.equal(assess(fixture({side:'sell',cents:20000}),{quantity:200}).usable,true,'Appreciated positions may exit above the new-entry notional ceiling');
const reverse=fixture({side:'sell'});reverse.evidence.buy=null;assert.equal(assess(reverse,{quantity:100}).usable,true,'A missing reverse buy cannot block an exact-size paper exit');
assert.equal(assess(reverse,{quantity:100}).execution.evidence.buy,null,'Exit evidence does not imply an observed reverse buy');
const small=fixture({side:'sell'});for(const leg of [small.evidence.buy,small.evidence.sell]){leg.fromDecimals=18;leg.toDecimals=18;}small.evidence.sell.fromAmountRaw='100000000000';small.evidence.sell.toAmountRaw='100000000000';small.evidence.sell.toAmountMinRaw='99000000000';small.evidence.buy.fromAmountRaw='99000000000';small.evidence.buy.toAmountRaw='99000000000';small.evidence.buy.toAmountMinRaw='98000000000';
assert.equal(assess(small,{quantity:1e-7}).usable,true,'Exponent-form quantities use deterministic raw-unit comparison');
small.evidence.sell.fromAmountRaw='100000000002';assert.equal(assess(small,{quantity:1e-7}).usable,false,'Floating precision cannot conceal a two-raw-unit mismatch');

const secrets=fixture();secrets.evidence.transactionRequest={data:'not propagated'};secrets.evidence.buy.transactionRequest={data:'not propagated'};const clean=assess(secrets).execution;
assert.equal(clean.evidence.transactionRequest,undefined);assert.equal(clean.evidence.buy.transactionRequest,undefined,'Paper evidence never carries transaction instructions');
assert.deepEqual(paperExecutionCosts({status:'simulated-route-observed',source:'Honeypot.is',buyTax:1,sellTax:2}),{buyHaircutPct:1,sellHaircutPct:2,buyTax:1,sellTax:2,taxesKnown:true,taxSource:'Honeypot.is',maxNotionalCents:null,kind:'provider-tax-simulation'});
assert.equal(paperExecutionCosts({status:'simulated-route-observed',buyTax:null,sellTax:0}),null);
assert.equal(paperExecutionCosts({...clean,modelCosts:{...clean.modelCosts,buyHaircutPct:0}}),null,'Caller cannot lower the adverse quote model');
assert.equal(paperExecutionCosts({...clean,buyTax:0}),null,'Unknown route taxes cannot masquerade as an observed zero');
for(const chain of ['base','bsc','robinhood','arc']){
 const f=fixture({chain}),p={...f.identity,pair:f.identity.pool,price:1,liquidity:1000000,marketCap:1000000,seenAt:now,createdAt:now-86400000,provider:'Synthetic exact-pool fixture',url:'https://example.org/pool'};
 const universe=buildOpportunityUniverse(mergePaperPools([[p]],now),{now}),quotes=paperQuotes(universe.rows,now);
 assert.equal(universe.rows.length,1,chain+' 32-byte pool hash remains in the categorized universe');
 assert.equal(quotes.length,1,chain+' 32-byte pool hash remains available for paper market observations');
 assert.equal(quotes[0].key,exactPublicPoolKey(p));assert.equal(paperKey(quotes[0]),exactPublicPoolKey(p),'Merge, universe and paper keys preserve the same exact pool identity');
 assert.equal(paperQuotes([{...p,address:p.pair}],now).length,0,'A 32-byte pool hash cannot become an EVM token address');
}
let simulationCalls=0;const simulator=createSimulationApi({now:()=>now,source:{get:async()=>{simulationCalls++;throw Error('Unsupported pool must not request provider simulation');}}});
for(const chain of ['base','arc'])assert.equal((await simulator.simulation(fixture({chain}).identity)).status,'unsupported','Pool-hash observations do not expand the Honeypot simulation adapter');
assert.equal(simulationCalls,0);
console.log('PASS paper quote evidence: exact token/direction/size, consecutive bidirectional amounts, freshness, cost ceilings, immutable sanitized evidence and distinct simulation versus quote cost models. Synthetic observations only.');
