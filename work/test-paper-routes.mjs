import assert from 'node:assert/strict';
import {createPaperRoutes,PAPER_ROUTE_CHAINS,PAPER_ROUTE_RECIPIENTS} from './axo-paper-routes.mjs';
import Assets from './axo-stablecoins.cjs';
import {assessPaperExecution} from './axo-paper-execution-policy.mjs';
const identities={solana:{chain:'solana',address:'So11111111111111111111111111111111111111112',pool:'11111111111111111111111111111111'},robinhood:{chain:'robinhood',address:'0x1111111111111111111111111111111111111111',pool:'0x2222222222222222222222222222222222222222'},arc:{chain:'arc',address:'0x3333333333333333333333333333333333333333',pool:'0x'+'4'.repeat(64)}};
let time=1792152000000;
function fixture({mutate=()=>{},counterPrice=1,error=null,delivery='fresh',timeShift=0,delay=null}={}){
 const calls=[];let quotes=0;return {calls,source:{async get(url,options){calls.push({url,options});if(delay)await delay();if(error)throw error;const u=new URL(url),id=Number(u.searchParams.get('chain')||u.searchParams.get('fromChain')),chain=Object.keys(PAPER_ROUTE_CHAINS).find(c=>PAPER_ROUTE_CHAINS[c]===id),counter=Assets.canonical[chain].stable[0],token=address=>({chainId:id,address,decimals:6,priceUSD:address.toLowerCase()===counter.toLowerCase()?String(counterPrice):'1',symbol:'TEST'});let data;
  if(u.pathname==='/v1/token')data=token(u.searchParams.get('token'));
  else{quotes++;const fromToken=token(u.searchParams.get('fromToken')),toToken=token(u.searchParams.get('toToken')),input=u.searchParams.get('fromAmount'),out=Math.floor(Number(input)*Number(fromToken.priceUSD)/Number(toToken.priceUSD)).toString(),minimum=(BigInt(out)*995n/1000n).toString(),action={fromChainId:id,toChainId:id,fromToken,toToken,fromAmount:input,fromAddress:u.searchParams.get('fromAddress'),toAddress:u.searchParams.get('toAddress'),slippage:Number(u.searchParams.get('slippage'))},gas={token:token(counter),amount:'1000',amountUSD:String(.001*counterPrice)},fee={token:fromToken,amount:(BigInt(input)/400n).toString(),amountUSD:String(Number(input)/1e6*.0025*Number(fromToken.priceUSD)),included:true};data={action,estimate:{fromAmount:input,toAmount:out,toAmountMin:minimum,gasCosts:[gas],feeCosts:[fee]},includedSteps:[{type:'swap',action:structuredClone(action)}],tool:'fixture',transactionRequest:{data:'MUST-NOT-BE-EXPOSED'}};}
  mutate(data,{url:u,quotes,calls});return {at:time+timeShift,delivery,data};}}};
}
for(const chain of Object.keys(identities)){
 const f=fixture(),api=createPaperRoutes({source:f.source,now:()=>time}),r=await api.probe(identities[chain],{marketPrice:1});assert.equal(r.status,'route-observed',r.message);assert.equal(r.sell.fromAmountRaw,r.buy.toAmountMinRaw);assert.equal(r.poolBinding,'not-established');assert.equal(r.taxesKnown,false);assert.equal(r.buy.externalCostCents,1);assert.ok(r.buy.includedFeeUsd>0);assert.equal(r.buy.feeUsd,0,'Included fee must not be charged twice');assert.equal(r.expiresAt-r.receivedAt,30000);assert.ok(!JSON.stringify(r).includes('MUST-NOT-BE-EXPOSED'));assert.ok(!JSON.stringify(r).includes('transactionRequest'));assert.equal(f.calls.length,4);
 assert.equal(assessPaperExecution(identities[chain],r,{now:time,side:'buy',notionalCents:10000}).usable,true,'Adapter shape must pass pure execution policy');
 const quoteCalls=f.calls.filter(c=>c.url.includes('/quote?'));for(const c of quoteCalls){const q=new URL(c.url).searchParams;assert.equal(q.get('skipSimulation'),'true');assert.equal(q.get('fee'),'0');assert.equal(q.get('fromAddress'),chain==='solana'?PAPER_ROUTE_RECIPIENTS.solana:PAPER_ROUTE_RECIPIENTS.evm);}
 r.buy.fromValueCents=999;const cached=await api.probe(identities[chain],{marketPrice:1});assert.equal(cached.buy.fromValueCents,10000,'Caller cannot mutate cached evidence');assert.equal(f.calls.length,4);
 const sell=await api.probe(identities[chain],{marketPrice:1,side:'sell',quantity:125});assert.equal(sell.status,'route-observed',sell.message);assert.equal(sell.buy,null,'Exit does not depend on a buy route');assert.equal(sell.sell.fromAmountRaw,'125000000','Sell can exceed entry cap as positions appreciate');assert.equal(assessPaperExecution(identities[chain],sell,{now:time,side:'sell',quantity:125}).usable,true,'Sell evidence must pass pure execution policy');
 time+=30001;await api.probe(identities[chain],{marketPrice:1});assert.equal(f.calls.length,11,'Expired success must refresh');
}
async function rejects(label,settings,opts={marketPrice:1}){const f=fixture(settings),api=createPaperRoutes({source:f.source,now:()=>time}),r=await api.probe(identities.robinhood,opts);assert.notEqual(r.status,'route-observed',label);return {f,api,r};}
await rejects('wrong chain',{mutate:d=>{if(d.action)d.action.toChainId=1;}});
await rejects('wrong token',{mutate:d=>{if(d.action)d.action.toToken.address='0x'+'9'.repeat(40);}});
await rejects('wrong metadata decimals',{mutate:d=>{if(d.action)d.action.toToken.decimals=18;}});
await rejects('cross-chain nested step',{mutate:d=>{if(d.includedSteps)d.includedSteps[0].action.fromChainId=1;}});
await rejects('uint256 overflow in nested step',{mutate:d=>{if(d.includedSteps)d.includedSteps[0].action.fromAmount=(1n<<256n).toString();}});
await rejects('unknown fee inclusion',{mutate:d=>{if(d.estimate)delete d.estimate.feeCosts[0].included;}});
await rejects('missing gas cost',{mutate:d=>{if(d.estimate)delete d.estimate.gasCosts[0].amountUSD;}});
await rejects('missing gas array',{mutate:d=>{if(d.estimate)d.estimate.gasCosts=[];}});
for(const price of [undefined,null,'0'])await rejects('nonzero unpriced gas cannot become zero cost',{mutate:d=>{if(d.estimate){d.estimate.gasCosts[0].amountUSD='0.00';d.estimate.gasCosts[0].token.priceUSD=price;}}});
await rejects('included nonzero unpriced fee cannot become known zero',{mutate:d=>{if(d.estimate){d.estimate.feeCosts[0].amountUSD='0.00';delete d.estimate.feeCosts[0].token.priceUSD;}}});
await rejects('negative fee',{mutate:d=>{if(d.estimate)d.estimate.feeCosts[0].amountUSD='-1';}});
await rejects('absent fees is unknown',{mutate:d=>{if(d.estimate)delete d.estimate.feeCosts;}});
await rejects('output discrepancy',{mutate:d=>{if(d.estimate){d.estimate.toAmount='200000000';d.estimate.toAmountMin='199000000';}}});
await rejects('slippage outside request',{mutate:d=>{if(d.action)d.action.slippage=.5;}});
await rejects('changed raw amount',{mutate:d=>{if(d.estimate)d.estimate.fromAmount='7';}});
await rejects('zero output',{mutate:d=>{if(d.estimate)d.estimate.toAmountMin='0';}});
await rejects('missing route steps',{mutate:d=>{delete d.includedSteps;}});
await rejects('stale source fallback',{delivery:'stale-memory'});
await rejects('expired observation',{timeShift:-30001});
await rejects('future observation',{timeShift:1});
await rejects('no assumed USDC peg',{counterPrice:.95});
await rejects('unbounded entry',{}, {marketPrice:1,notionalUsd:101});
await rejects('zero market price',{}, {marketPrice:0});
await rejects('raw amount below precision',{}, {marketPrice:1,side:'sell',quantity:1e-12});
const overflowingInput=await rejects('uint256 input overflow',{}, {marketPrice:1e-71,side:'sell',quantity:2e71});
assert.equal(overflowingInput.f.calls.filter(c=>c.url.includes('/quote?')).length,0,'An impossible EVM integer amount must reject before a quote request');
const svmOverflow=fixture(),svmOverflowApi=createPaperRoutes({source:svmOverflow.source,now:()=>time});
assert.equal((await svmOverflowApi.probe(identities.solana,{marketPrice:1e-13,side:'sell',quantity:2e13})).status,'unavailable');
assert.equal(svmOverflow.calls.filter(c=>c.url.includes('/quote?')).length,0,'An impossible Solana integer amount must reject before a quote request');
const nearPeg=fixture({counterPrice:.99}),near=await createPaperRoutes({source:nearPeg.source,now:()=>time}).probe(identities.arc,{marketPrice:1});assert.equal(near.status,'route-observed',near.message);assert.equal(near.buy.fromAmountRaw,'101010101');assert.equal(near.buy.fromValueCents,10000,'USDC valued at observed price, not assumed peg');
const rounded=fixture({mutate:d=>{if(d.estimate)d.estimate.gasCosts[0].amountUSD='0.00';}}),rounding=await createPaperRoutes({source:rounded.source,now:()=>time}).probe(identities.arc,{marketPrice:1});assert.equal(rounding.status,'route-observed',rounding.message);assert.equal(rounding.buy.externalCostCents,1,'Rounded display zero must retain calculated nonzero gas');assert.equal(rounding.limits.maxLegCostPct,2);
const genuineZero=fixture({mutate:d=>{if(d.estimate){d.estimate.gasCosts[0].amount='0';d.estimate.gasCosts[0].amountUSD='0.00';delete d.estimate.gasCosts[0].token.priceUSD;}}}),zeroProof=await createPaperRoutes({source:genuineZero.source,now:()=>time}).probe(identities.arc,{marketPrice:1});assert.equal(zeroProof.status,'route-observed',zeroProof.message);assert.equal(zeroProof.buy.externalCostCents,0,'An explicit zero raw gas amount remains distinct from an unpriced nonzero amount');
const limited=await rejects('429', {error:Object.assign(Error('HTTP429'),{status:429})}),count=limited.f.calls.length;await limited.api.probe(identities.arc,{marketPrice:1});assert.equal(limited.f.calls.length,count,'429 must cool down subsequent chains too');
let release;const gate=new Promise(r=>release=r),coalesced=fixture({delay:()=>gate}),api=createPaperRoutes({source:coalesced.source,now:()=>time}),a=api.probe(identities.arc,{marketPrice:1}),b=api.probe(identities.arc,{marketPrice:1});release();const [aa,bb]=await Promise.all([a,b]);assert.equal(aa.status,'route-observed');assert.deepEqual(aa,bb);assert.equal(coalesced.calls.length,4);
const budget=fixture(),bounded=createPaperRoutes({source:budget.source,now:()=>time});for(let n=0;n<8;n++)await bounded.probe(identities.arc,{marketPrice:1,notionalUsd:100-n});assert.ok(budget.calls.length<=24);assert.equal(bounded.status().requestsLastMinute,24);
const errorsAfterCache=fixture(),changed=createPaperRoutes({source:errorsAfterCache.source,now:()=>time});assert.equal((await changed.probe(identities.arc,{marketPrice:1})).status,'route-observed');time+=30001;errorsAfterCache.source.get=async()=>{throw Error('Public quote unavailable');};assert.equal((await changed.probe(identities.arc,{marketPrice:1})).status,'unavailable','Provider failure must not reuse an expired success');
const advancing=fixture({mutate:()=>{time+=5;}}),ordered=await createPaperRoutes({source:advancing.source,now:()=>time}).probe(identities.arc,{marketPrice:1});assert.equal(assessPaperExecution(identities.arc,ordered,{now:time,side:'buy',notionalCents:10000}).usable,true,'Sequential timestamps retain oldest validity without extending source expiry');
const exitOnly=fixture({mutate:d=>{if(d.action&&d.action.fromToken.address.toLowerCase()===Assets.canonical.arc.stable[0].toLowerCase())throw Error('Buy routes unavailable');}}),exitProof=await createPaperRoutes({source:exitOnly.source,now:()=>time}).probe(identities.arc,{marketPrice:1,side:'sell',quantity:20});assert.equal(exitProof.status,'route-observed','Buy outage must not prevent an observed sell exit');assert.equal(exitOnly.calls.filter(c=>c.url.includes('/quote?')).length,1);
const recoveredFixture=fixture();let throttled=true;const recoveredApi=createPaperRoutes({source:{get:async(...args)=>{if(throttled)throw Object.assign(Error('HTTP429'),{status:429});return recoveredFixture.source.get(...args);}},now:()=>time});assert.equal((await recoveredApi.probe(identities.arc,{marketPrice:1})).status,'unavailable');throttled=false;time+=60001;assert.equal((await recoveredApi.probe(identities.arc,{marketPrice:1})).status,'route-observed','Provider may recover after bounded cooldown');
console.log('PASS paper route observations: all 3 chains, exact two-way amounts, conservative costs, freshness, no fake simulations/transactions, coalescing, bounded requests and rate-limit recovery. Fixtures only; no trades or wallet calls.');
