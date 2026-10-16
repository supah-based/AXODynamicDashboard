import {portfolioRisk,allocationRisk} from './axo-portfolio-risk.mjs';
import {cohortPolicy,experimentId} from './axo-paper-evaluation.mjs';

export const PAPER_SIZING_VERSION='stop-risk-v1';
export const CATEGORY_POLICY=Object.freeze({
 degen:{riskMultiplier:.6,maxHoldingHours:24,maxCategoryExposurePct:15},
 swing:{riskMultiplier:.8,maxHoldingHours:120,maxCategoryExposurePct:30},
 bluechip:{riskMultiplier:1,maxHoldingHours:336,maxCategoryExposurePct:30}
});
const finite=Number.isFinite;
// This sizes a hypothesis. The conviction score is not a probability or Kelly input.
export function sizePaperOpportunity({state,valuation,quote,setup,rank,config,now=Date.now()}){
 const blocked=reason=>({version:PAPER_SIZING_VERSION,allocationBps:0,riskBudgetBps:0,plannedLossBps:null,reason,limits:[],policyMultiplier:0});
 const category=rank?.category,policy=CATEGORY_POLICY[category],risk=portfolioRisk(state,valuation,now);
 if(!policy||!rank?.eligible||!setup?.eligible)return blocked('Category or entry evidence is incomplete');
 if(!finite(quote?.price)||quote.price<=0)return blocked('Positive observed entry quote required');
 if(!risk.allowEntries)return blocked(risk.halt?.reason||'Complete fresh portfolio marks required');
 if(Object.keys(state.positions).length>=state.config.maxPositions)return blocked('Maximum open positions reached');
 if(!finite(setup.technical?.atrPct)||setup.technical.atrPct<0)return blocked('Observed hourly ATR is required for risk sizing');
 if(!finite(rank.score)||rank.score<0||rank.score>100)return blocked('Evidence conviction unavailable');
 const stopPct=Math.max(config.stopPct,setup.technical.atrPct*2);
 if(stopPct>25)return blocked('Volatility needs a stop wider than the 25% paper ceiling');
 const {buyTax,sellTax}=setup.execution||{};
 if(![buyTax,sellTax].every(v=>finite(v)&&v>=0&&v<100))return blocked('Dated buy/sell tax assumptions required');
 const fee=config.feeBps/10000,slip=config.slippageBps/10000;
 // Net exit relative to entry debit includes both taxes, both fees and adverse slippage.
 const exitRatio=move=>(1+move)*(1-slip)/(1+slip)*(1-buyTax/100)*(1-sellTax/100)*(1-fee)/(1+fee);
 const lossFraction=1-exitRatio(-stopPct/100),firstTarget=config.tranches[0]?.targetPct;
 if(!finite(lossFraction)||lossFraction<=0||lossFraction>=1)return blocked('Modeled stop-loss cost is invalid');
 if(!finite(firstTarget)||exitRatio(firstTarget/100)<=1)return blocked('First profit target cannot cover modeled round-trip costs');
 const experiment=experimentId(config),adaptation=cohortPolicy(state,{experimentId:experiment,chain:quote.chain,category,strategy:setup.strategy},now,valuation);
 const convictionMultiplier=.35+.45*rank.score/100;
 const riskBudgetBps=config.maxEntryRiskBps*convictionMultiplier*policy.riskMultiplier*adaptation.multiplier;
 if(!finite(riskBudgetBps)||riskBudgetBps<=0)return blocked('No paper entry risk budget');
 const equity=valuation.equityCents,categoryExposure=valuation.positions.filter(p=>!CATEGORY_POLICY[p.plan?.opportunity?.category]||p.plan.opportunity.category===category).reduce((n,p)=>n+p.marketValueCents,0);
 // Convert every capacity to notional cents. Final deterministic validation remains authoritative.
 const caps=[
  ['planned stop risk',equity*riskBudgetBps/10000/lossFraction/(1+fee)],
  ['position ceiling',equity*state.config.maxPositionBps/10000],
  ['pool participation',quote.liquidity*100*state.config.maxParticipationBps/10000],
  ['cash reserve',(state.cashCents-equity*state.config.cashReserveBps/10000)/(1+fee)],
  ['gross exposure',(equity*risk.limits.maxGrossExposurePct/100-risk.exposureCents)/(1+fee*risk.limits.maxGrossExposurePct/100)],
  ['chain exposure',(equity*risk.limits.maxChainExposurePct/100-(risk.chainExposureCents[quote.chain]||0))/(1+fee*risk.limits.maxChainExposurePct/100)],
  ['category exposure',(equity*policy.maxCategoryExposurePct/100-categoryExposure)/(1+fee*policy.maxCategoryExposurePct/100)]
 ];
 if(caps.some(([,v])=>!finite(v)))return blocked('Allocation capacity cannot be established');
 const modeled=(notional,move)=>{const quantity=(notional/100)/(quote.price*(1+slip)/(1-buyTax/100)),gross=Math.floor(quantity*quote.price*(1+move)*(1-slip)*(1-sellTax/100)*100);return gross-Math.ceil(gross*fee);};
 const ceiling=Math.min(...caps.map(([,v])=>v));let bps=Math.max(0,Math.min(state.config.maxPositionBps,Math.floor(ceiling/equity*10000)));
 // Fees round up to cents. Recheck actual integer debits rather than floating point estimates.
 for(;bps>0;bps--){const notional=Math.floor(equity*bps/10000),feeCents=Math.ceil(notional*fee),debit=notional+feeCents;
  if(notional<100){bps=0;break;}
  const stopCredit=modeled(notional,-stopPct/100),targetCredit=modeled(notional,firstTarget/100);
  if(!Number.isSafeInteger(stopCredit)||stopCredit<0||!Number.isSafeInteger(targetCredit)||targetCredit<=debit){bps=0;break;}
  if(debit-stopCredit<=equity*riskBudgetBps/10000&&debit<=state.cashCents-Math.ceil(equity*state.config.cashReserveBps/10000)&&!allocationRisk(risk,quote.chain,notional,feeCents)&&(categoryExposure+notional)/(equity-feeCents)*100<=policy.maxCategoryExposurePct)break;
 }
 const notionalCents=Math.floor(equity*bps/10000),debit=notionalCents+Math.ceil(notionalCents*fee);
 return {version:PAPER_SIZING_VERSION,allocationBps:bps,notionalCents,riskBudgetBps,plannedLossBps:bps?(debit-modeled(notionalCents,-stopPct/100))/equity*10000:0,stopPct,maxHoldingHours:policy.maxHoldingHours,categoryExposureLimitPct:policy.maxCategoryExposurePct,unknownCategoryExposureCharged:valuation.positions.some(p=>!CATEGORY_POLICY[p.plan?.opportunity?.category]),convictionMultiplier,policyMultiplier:adaptation.multiplier,adaptation,limits:caps.filter(([,v])=>v<=ceiling+1).map(([k])=>k),reason:bps?'Evidence-weighted stop-loss budget, bounded by remaining portfolio and pool capacity':'Available capacity is below one virtual dollar',assumptions:'Planned loss at the modeled stop, not a guaranteed maximum: gaps, failed sells, gas and MEV can exceed it.'};
}
