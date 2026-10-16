import Stream from './axo-stream-schema.cjs';

export const PAPER_QUOTE_CHAINS=Object.freeze(['solana','robinhood','arc']);
export const PAPER_ROUTE_KIND='bidirectional-quote-paper';
export const PAPER_ROUTE_MAX_AGE_MS=60000;
export const PAPER_ROUTE_MAX_NOTIONAL_CENTS=10000;
export const PAPER_ROUTE_HAIRCUT_PCT=2;
const finite=Number.isFinite;
const eq=(a,b,chain)=>typeof a==='string'&&typeof b==='string'&&(chain==='solana'?a===b:a.toLowerCase()===b.toLowerCase());
const exact=(p,pool=false)=>{try{return Stream.exact(p,pool);}catch{return null;}};
const raw=v=>typeof v==='string'&&/^\d{1,78}$/.test(v)&&BigInt(v)>0n?BigInt(v):null;
const money=v=>Number.isSafeInteger(v)&&v>=0;
const dated=(at,expiresAt,now)=>finite(at)&&at>0&&at<=now&&now-at<=PAPER_ROUTE_MAX_AGE_MS&&finite(expiresAt)&&expiresAt>now&&expiresAt>at&&expiresAt<=at+PAPER_ROUTE_MAX_AGE_MS;
const quantityUnits=(value,decimals)=>{if(!finite(value)||value<=0||!Number.isInteger(decimals)||decimals<0||decimals>36)return null;const [mantissa,exponent='0']=String(value).split('e'),parts=mantissa.split('.'),digits=BigInt(parts.join('')),power=decimals+Number(exponent)-(parts[1]?.length||0);return power>=0?digits*10n**BigInt(power):digits/10n**BigInt(-power);};

// Quote observations are a separate, deliberately conservative paper cost model.
// They never establish a pool simulation, token safety, actual taxes or a live fill.
export function assessPaperExecution(identity,evidence,{now=Date.now(),side='buy',notionalCents,quantityRaw,quantity}={}){
 const gaps=[],p=exact(identity,true),e=evidence;
 const invalid=()=>({usable:false,gaps,execution:{status:'unknown',kind:PAPER_ROUTE_KIND,source:e?.source||null,coverage:e?.status||'unknown',coverageReason:gaps.join('; '),at:finite(e?.receivedAt)?e.receivedAt:null,buyTax:null,sellTax:null,taxesKnown:false,poolBinding:'not-established'}});
 if(!p||!PAPER_QUOTE_CHAINS.includes(p.chain)){gaps.push('Exact supported paper project identity required');return invalid();}
 if(!['buy','sell'].includes(side)){gaps.push('Paper quote direction must be buy or sell');return invalid();}
 if(!e||e.kind!==PAPER_ROUTE_KIND||e.status!=='route-observed'||e.source!=='LI.FI'||e.taxesKnown!==false||e.poolBinding!=='not-established'){gaps.push('Distinct LI.FI quote evidence with unknown taxes and unproven pool binding required');return invalid();}
 if(e.chain!==p.chain||!eq(e.address,p.address,p.chain)||!eq(e.poolContext,p.pool,p.chain)||e.side!==side)gaps.push('Quote project context or requested direction does not match');
 if(!dated(e.receivedAt,e.expiresAt,now))gaps.push('Quote evidence expired, future-dated or older than sixty seconds');
 const counter=exact({chain:p.chain,address:e.counterToken});
 if(!counter||eq(counter.address,p.address,p.chain))gaps.push('Distinct exact counter token required');
 const legs={buy:null,sell:null};
 for(const name of side==='buy'?['buy','sell']:['sell']){
  const leg=e[name],from=name==='buy'?e.counterToken:p.address,to=name==='buy'?p.address:e.counterToken;
  if(!leg||leg.chain!==p.chain||!eq(leg.fromToken,from,p.chain)||!eq(leg.toToken,to,p.chain)){gaps.push(name+' quote assets or chain do not match');continue;}
  if(!Number.isInteger(leg.fromDecimals)||!Number.isInteger(leg.toDecimals)||[leg.fromDecimals,leg.toDecimals].some(d=>d<0||d>(p.chain==='solana'?18:36)))gaps.push(name+' token decimals are invalid');
  const input=raw(leg.fromAmountRaw),out=raw(leg.toAmountRaw),minimum=raw(leg.toAmountMinRaw);
  if(input===null||out===null||minimum===null||minimum>out)gaps.push(name+' raw amounts or minimum output are invalid');
  const integerMaximum=p.chain==='solana'?18446744073709551615n:(1n<<256n)-1n;
  if([input,out,minimum].some(value=>value!==null&&value>integerMaximum))gaps.push(name+' raw amount exceeds chain integer bounds');
  if(!dated(leg.receivedAt,leg.expiresAt,now)||e.receivedAt<leg.receivedAt||e.expiresAt>leg.expiresAt)gaps.push(name+' source quote is stale or its validity was extended');
  if(leg.costsComplete!==true||![leg.fromValueCents,leg.toMinValueCents,leg.externalCostCents].every(money)||leg.fromValueCents<=0||leg.toMinValueCents<=0){gaps.push(name+' complete observed cost valuation is unavailable');continue;}
  const measuredCostPct=(leg.fromValueCents-leg.toMinValueCents+leg.externalCostCents)/leg.fromValueCents*100;
  if(!finite(measuredCostPct)||measuredCostPct>PAPER_ROUTE_HAIRCUT_PCT+1e-10)gaps.push(name+' measured cost exceeds the two-percent paper model');
  // A better-than-reference quote is not extra paper profit; the model still charges 2%.
  legs[name]={chain:p.chain,fromToken:from,toToken:to,fromDecimals:leg.fromDecimals,toDecimals:leg.toDecimals,fromAmountRaw:input?.toString()||null,toAmountRaw:out?.toString()||null,toAmountMinRaw:minimum?.toString()||null,fromValueCents:leg.fromValueCents,toMinValueCents:leg.toMinValueCents,externalCostCents:leg.externalCostCents,costsComplete:true,receivedAt:leg.receivedAt,expiresAt:leg.expiresAt,measuredCostPct};
 }
 if(side==='buy'&&legs.buy&&legs.sell){
  if(legs.buy.fromDecimals!==legs.sell.toDecimals||legs.buy.toDecimals!==legs.sell.fromDecimals)gaps.push('Round-trip token decimals disagree');
  if(legs.buy.toAmountMinRaw!==legs.sell.fromAmountRaw)gaps.push('Reverse quote does not spend the exact first-leg minimum output');
   if(legs.buy.fromValueCents>PAPER_ROUTE_MAX_NOTIONAL_CENTS)gaps.push('New paper entry exceeds the one-hundred-dollar route limit');
   if(notionalCents!==undefined&&(!money(notionalCents)||notionalCents<=0||notionalCents>PAPER_ROUTE_MAX_NOTIONAL_CENTS||legs.buy.fromValueCents>notionalCents||notionalCents-legs.buy.fromValueCents>1))gaps.push('Buy quote does not cover the exact requested paper notional');
 }
 if(side==='sell'&&legs.sell){
   if(quantityRaw!==undefined&&(raw(quantityRaw)===null||raw(quantityRaw)?.toString()!==legs.sell.fromAmountRaw))gaps.push('Sell quote does not cover the exact requested raw quantity');
   if(quantity!==undefined){
    const expected=quantityUnits(quantity,legs.sell.fromDecimals),quoted=raw(legs.sell.fromAmountRaw),delta=expected!==null&&quoted!==null?expected-quoted:null;
    if(delta===null||delta>1n||delta< -1n)gaps.push('Sell quote does not cover the requested quantity within one raw unit');
   }
   if(quantityRaw===undefined&&quantity===undefined)gaps.push('Exact held quantity is required for a paper exit quote');
 }
 if(gaps.length)return invalid();
 const normalized={kind:PAPER_ROUTE_KIND,status:'route-observed',chain:p.chain,address:p.address,poolContext:p.pool,side,source:'LI.FI',counterToken:counter.address,receivedAt:e.receivedAt,expiresAt:e.expiresAt,taxesKnown:false,poolBinding:'not-established',buy:legs.buy,sell:legs.sell};
 return {usable:true,gaps:[],execution:{status:'quoted-route-observed',kind:PAPER_ROUTE_KIND,source:'LI.FI',identity:p,side,coverage:'route-observed',coverageReason:side==='buy'?'Current exact-token bidirectional quote observations; analytics pool is context only':'Current exact-size token sell quote; no reverse buy required for a paper exit',at:e.receivedAt,expiresAt:e.expiresAt,buyTax:null,sellTax:null,taxesKnown:false,poolBinding:'not-established',modelCosts:{buyHaircutPct:PAPER_ROUTE_HAIRCUT_PCT,sellHaircutPct:PAPER_ROUTE_HAIRCUT_PCT,taxSource:null,maxNotionalCents:PAPER_ROUTE_MAX_NOTIONAL_CENTS},evidence:normalized,note:'Paper hypothesis only: a fixed 2% adverse haircut per leg plus configured fee/slippage. Quotes do not prove token safety, exact-pool execution, taxes, transaction success or future sellability.'}};
}

export function paperExecutionCosts(execution){
 if(execution?.status==='simulated-route-observed'&&[execution.buyTax,execution.sellTax].every(v=>finite(v)&&v>=0&&v<100))return {buyHaircutPct:execution.buyTax,sellHaircutPct:execution.sellTax,buyTax:execution.buyTax,sellTax:execution.sellTax,taxesKnown:true,taxSource:execution.source||null,maxNotionalCents:null,kind:'provider-tax-simulation'};
 if(execution?.status==='quoted-route-observed'&&execution.kind===PAPER_ROUTE_KIND&&execution.taxesKnown===false&&execution.buyTax===null&&execution.sellTax===null&&execution.poolBinding==='not-established'&&execution.modelCosts?.buyHaircutPct===PAPER_ROUTE_HAIRCUT_PCT&&execution.modelCosts?.sellHaircutPct===PAPER_ROUTE_HAIRCUT_PCT&&execution.modelCosts?.taxSource===null&&execution.modelCosts?.maxNotionalCents===PAPER_ROUTE_MAX_NOTIONAL_CENTS)return {...execution.modelCosts,buyTax:null,sellTax:null,taxesKnown:false,kind:PAPER_ROUTE_KIND};
 return null;
}
