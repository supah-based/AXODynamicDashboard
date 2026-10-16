import {PublicKey} from '@solana/web3.js';
import {publicSources} from './axo-source-cache.mjs';
import Assets from './axo-stablecoins.cjs';

// Quotes are observations for a bounded paper cost model, never proof that a
// transaction, exact pool, token tax or wallet has been simulated successfully.
export const PAPER_ROUTE_CHAINS=Object.freeze({solana:1151111081099710,robinhood:4663,arc:5042});
export const PAPER_ROUTE_RECIPIENTS=Object.freeze({evm:'0x000000000000000000000000000000000000dEaD',solana:new PublicKey(Uint8Array.from({length:32},(_,i)=>i+1)).toBase58()});
const TTL=30000,SLIPPAGE=.005,MAX_USD=100,MAX_COST=.02;
const fail=m=>{throw Error(m);},finite=n=>typeof n==='number'&&Number.isFinite(n),positive=n=>finite(n)&&n>0;
const number=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isFinite(Number(v))?Number(v):null;
const raw=v=>typeof v==='string'&&/^(0|[1-9]\d*)$/.test(v)&&v.length<=78;
const maxRaw=chain=>chain==='solana'?18446744073709551615n:(1n<<256n)-1n;
const decimals=v=>Number.isInteger(v)&&v>=0&&v<=36;
const valid=(chain,a)=>{if(typeof a!=='string')return false;if(chain!=='solana')return /^0x[\da-fA-F]{40}$/.test(a);try{return new PublicKey(a).toBase58()===a;}catch{return false;}};
const eq=(chain,a,b)=>valid(chain,a)&&valid(chain,b)&&(chain==='solana'?a===b:a.toLowerCase()===b.toLowerCase());
const normal=(chain,a)=>chain==='solana'?a:a.toLowerCase();
function rawFloor(n,d){
 if(!positive(n)||!decimals(d))fail('Positive finite amount and exact decimals required');
 const [mantissa,exponent='0']=String(n).split('e'),[whole,fraction='']=mantissa.split('.'),digits=whole+fraction,places=whole.length+Number(exponent)+d;
 if(places<=0)return '0';if(places>78)fail('Amount outside bounded token units');
 return BigInt((digits.slice(0,places)+'0'.repeat(Math.max(0,places-digits.length)))||'0').toString();
}
const amount=(r,d)=>{if(!raw(r)||!decimals(d))fail('Exact integer token amount unavailable');const n=Number(r)/10**d;if(!finite(n)||n<0)fail('Token amount outside numeric bounds');return n;};
const centsUp=n=>Math.max(0,Math.ceil(n*100-1e-8)),centsDown=n=>Math.floor(n*100+1e-8);
function exactToken(t,{chain,id,address,dec}){return t&&t.chainId===id&&eq(chain,t.address,address)&&decimals(t.decimals)&&(dec===undefined||t.decimals===dec)&&(chain!=='solana'||t.decimals<=18);}
function costRows(rows,kind,chain,id){
 if(!Array.isArray(rows)||rows.length>24||(kind==='gas'&&!rows.length))fail('Complete quoted gas and fee costs required');
 let external=0,included=0;
 for(const f of rows){let usd=number(f?.amountUSD);const t=f?.token;
  if(usd===null||usd<0||!raw(f.amount)||!t||t.chainId!==id||!valid(chain,t.address)||!decimals(t.decimals)||(kind==='fee'&&typeof f.included!=='boolean'))fail('Quoted cost is missing its value, currency or inclusion status');
  if(number(f.feeSplit?.integratorFee??0)!==0)fail('Unexpected integrator fee');
  const price=number(t.priceUSD);if(BigInt(f.amount)>0n&&usd===0&&!(price>0))fail('Nonzero quoted cost has no usable USD valuation');if(price!==null&&price>0){const calculated=amount(f.amount,t.decimals)*price;if(Math.abs(usd-calculated)>.01+calculated*.1)fail('Quoted cost value disagrees with token amount');usd=Math.max(usd,calculated);}
  if(f.included===true)included+=usd;else external+=usd;
 }
 if(!finite(external)||!finite(included))fail('Quoted costs outside numeric bounds');return {external,included};
}
function validateQuote(q,r,at){
 const a=q?.action,e=q?.estimate;
 if(!a||!e||a.fromChainId!==r.id||a.toChainId!==r.id||!eq(r.chain,a.fromAddress,r.recipient)||!eq(r.chain,a.toAddress,r.recipient)||!exactToken(a.fromToken,{...r,address:r.from,dec:r.fromDecimals})||!exactToken(a.toToken,{...r,address:r.to,dec:r.toDecimals})||a.fromAmount!==r.input||e.fromAmount!==r.input||number(a.slippage)!==SLIPPAGE)fail('Quote chain, token, recipient, amount or decimals mismatch');
 if(!raw(e.toAmount)||!raw(e.toAmountMin)||BigInt(e.toAmountMin)<=0n||BigInt(e.toAmountMin)>BigInt(e.toAmount)||BigInt(e.toAmountMin)<BigInt(e.toAmount)*995n/1000n)fail('Quoted minimum output or slippage is invalid');
 if(BigInt(e.toAmount)>maxRaw(r.chain))fail('Quoted token output exceeds chain integer bounds');
 if(!Array.isArray(q.includedSteps)||!q.includedSteps.length||q.includedSteps.length>20)fail('Quoted route steps unavailable');
 let total=0;function steps(list,depth=0){if(depth>4)fail('Route nesting outside bounds');for(const s of list){if(++total>30)fail('Too many quoted route steps');const x=s?.action;if(s.type==='cross'||!x||x.fromChainId!==r.id||x.toChainId!==r.id||!exactToken(x.fromToken,{...r,address:x.fromToken?.address})||!exactToken(x.toToken,{...r,address:x.toToken?.address})||!raw(x.fromAmount)||BigInt(x.fromAmount)<=0n||BigInt(x.fromAmount)>maxRaw(r.chain))fail('Route contains unknown, out-of-bounds or cross-chain steps');for(const t of [x.fromToken,x.toToken]){if(eq(r.chain,t.address,r.from)&&t.decimals!==r.fromDecimals||eq(r.chain,t.address,r.to)&&t.decimals!==r.toDecimals)fail('Route step token decimals contradict metadata');}if(s.includedSteps!==undefined){if(!Array.isArray(s.includedSteps))fail('Invalid nested route steps');steps(s.includedSteps,depth+1);}}}steps(q.includedSteps);
 const gas=costRows(e.gasCosts,'gas',r.chain,r.id),fees=costRows(e.feeCosts,'fee',r.chain,r.id),external=gas.external+fees.external;
 const fromValue=amount(r.input,r.fromDecimals)*r.fromPrice,toValue=amount(e.toAmountMin,r.toDecimals)*r.toPrice;
 if(!positive(fromValue)||!positive(toValue)||Math.abs(toValue/fromValue-1)>.1)fail('Quoted output and current reference price disagree');
 const fromValueCents=centsUp(fromValue),toMinValueCents=centsDown(toValue),externalCostCents=centsUp(external),costPct=(fromValueCents-toMinValueCents+externalCostCents)/fromValueCents;
 if(![fromValueCents,toMinValueCents,externalCostCents].every(Number.isSafeInteger))fail('Quoted valuation exceeds safe accounting precision');
 if(fromValueCents<=0||toMinValueCents<=0||costPct>MAX_COST+1e-9)fail('Observed route cost exceeds the 2% per-leg paper limit');
 return {chain:r.chain,fromToken:r.from,toToken:r.to,fromDecimals:r.fromDecimals,toDecimals:r.toDecimals,fromAmountRaw:r.input,toAmountRaw:e.toAmount,toAmountMinRaw:e.toAmountMin,fromValueCents,toMinValueCents,externalCostCents,costsComplete:true,receivedAt:at,expiresAt:at+TTL,costPct,at,inputRaw:r.input,outputMinRaw:e.toAmountMin,decimals:{from:r.fromDecimals,to:r.toDecimals},gasUsd:gas.external,feeUsd:fees.external,includedFeeUsd:fees.included,minimumValueUsd:toValue,tool:typeof q.tool==='string'?q.tool.slice(0,60):'unknown'};
}
export function createPaperRoutes({source=publicSources,now=Date.now}={}){
 const cache=new Map(),pending=new Map(),calls=[];let active=0,cooldownUntil=0;
 const unavailable=(identity,message,status='unavailable')=>({status,kind:'bidirectional-quote-paper',chain:identity?.chain,address:identity?.address,poolContext:identity?.pool,source:'LI.FI',taxesKnown:false,poolBinding:'not-established',message});
 async function read(url){while(calls.length&&now()-calls[0]>=60000)calls.shift();if(now()<cooldownUntil||calls.length>=24)fail('Public paper-route request budget or provider cooldown reached');calls.push(now());const r=await source.get(url,{ttl:TTL});if(!r||!positive(r.at)||r.at>now()||now()-r.at>=TTL||String(r.delivery||'').startsWith('stale'))fail('Fresh route observation unavailable; stale results cannot authorize a paper fill');return r;}
 async function probe(identity,options={}){
  const chain=identity?.chain,id=PAPER_ROUTE_CHAINS[chain],address=identity?.address,pool=identity?.pool,side=options.side??'buy',marketPrice=options.marketPrice,notionalUsd=options.notionalUsd??MAX_USD;
  if(!id)return unavailable(identity,'No quote-only paper adapter for this chain','unsupported');
  if(!valid(chain,address)||typeof pool!=='string'||pool.length<1||pool.length>200||!['buy','sell'].includes(side)||!positive(marketPrice)||side==='buy'&&(!positive(notionalUsd)||notionalUsd>MAX_USD)||side==='sell'&&!positive(options.quantity))return unavailable(identity,'Exact token, pool context, price and bounded paper amount required');
  const counterToken=Assets.canonical[chain].stable[0];if(eq(chain,address,counterToken))return unavailable(identity,'Project and counter token must differ');
  const key=JSON.stringify([chain,normal(chain,address),pool,side,marketPrice,side==='buy'?notionalUsd:options.quantity]),hit=cache.get(key);
  if(hit&&hit.receivedAt<=now()&&hit.expiresAt>now())return structuredClone(hit);cache.delete(key);if(pending.has(key))return structuredClone(await pending.get(key));
  if(active>=2||now()<cooldownUntil)return unavailable(identity,'Paper route service is busy or cooling down');active++;
  const task=(async()=>{try{
   const recipient=chain==='solana'?PAPER_ROUTE_RECIPIENTS.solana:PAPER_ROUTE_RECIPIENTS.evm;
   const metadata=async token=>{const r=await read('https://li.quest/v1/token?'+new URLSearchParams({chain:String(id),token}));if(!exactToken(r.data,{chain,id,address:token}))fail('Exact token metadata unavailable');return {...r.data,observedAt:r.at};};
   const [project,counter]=await Promise.all([metadata(address),metadata(counterToken)]),counterPrice=number(counter.priceUSD);
   if(counter.decimals!==6||counterPrice===null||counterPrice<.98||counterPrice>1.02)fail('Fresh exact canonical dollar stablecoin price near its peg is required; no assumed dollar value');
   let oldest=Math.min(project.observedAt,counter.observedAt);const request=async(from,to,input,fromPrice,toPrice)=>{
    if(!raw(input)||BigInt(input)<=0n||BigInt(input)>maxRaw(chain))fail('Amount below token precision or outside supported units');
    const params=new URLSearchParams({fromChain:String(id),toChain:String(id),fromToken:from.address,toToken:to.address,fromAmount:input,fromAddress:recipient,toAddress:recipient,slippage:String(SLIPPAGE),integrator:'axo-paper',fee:'0',skipSimulation:'true',maxPriceImpact:'0.02'}),r=await read('https://li.quest/v1/quote?'+params);oldest=Math.min(oldest,r.at);
    return validateQuote(r.data,{chain,id,from:from.address,to:to.address,fromDecimals:from.decimals,toDecimals:to.decimals,fromPrice,toPrice,input,recipient},r.at);
   };
   let buy=null,sell;if(side==='buy'){buy=await request(counter,project,rawFloor(notionalUsd/counterPrice,counter.decimals),counterPrice,marketPrice);sell=await request(project,counter,buy.toAmountMinRaw,marketPrice,counterPrice);}else{sell=await request(project,counter,rawFloor(options.quantity,project.decimals),marketPrice,counterPrice);}
   if(now()-oldest>=TTL||oldest>now())fail('Route evidence expired before the required legs completed');
   const result={status:'route-observed',kind:'bidirectional-quote-paper',chain,address:project.address,poolContext:pool,source:'LI.FI',sourceUrl:'https://docs.li.fi/li.fi-api/li.fi-api/requesting-a-quote',side,counterToken:counter.address,counterPrice,marketPrice,receivedAt:now(),observedFromAt:oldest,expiresAt:oldest+TTL,notionalUsd:side==='buy'?buy.fromValueCents/100:sell.fromValueCents/100,quantity:side==='buy'?amount(buy.toAmountMinRaw,project.decimals):amount(sell.fromAmountRaw,project.decimals),buy,sell,taxesKnown:false,poolBinding:'not-established',simulationSuccess:null,limits:{paperOnly:true,maxEntryUsd:MAX_USD,maxLegCostPct:MAX_COST*100,slippage:SLIPPAGE,ttlMs:TTL,syntheticRecipient:true,transactionSimulation:'skipped',exactPool:false},limitations:(side==='buy'?'Two fresh token-route quotes':'A fresh sell-route quote')+', using a synthetic public recipient. No transaction was signed, sent or simulated. Taxes, exact-pool execution, wallet eligibility and future sellability remain unverified; outputs are estimates for a separate bounded paper model.'};
   cache.set(key,result);while(cache.size>80)cache.delete(cache.keys().next().value);return result;
  }catch(e){if(e?.status===429||/429|cooldown|rate.limit/i.test(e?.message||''))cooldownUntil=Math.max(cooldownUntil,now()+60000);return unavailable(identity,String(e?.message||'Public quote provider unavailable').slice(0,220));}finally{active--;}})();pending.set(key,task);try{return structuredClone(await task);}finally{pending.delete(key);}
 }
 return {probe,status:()=>({active,inFlight:pending.size,cached:cache.size,requestsLastMinute:calls.filter(t=>now()-t<60000).length,cooldownUntil,maxRequestsPerMinute:24})};
}
