export const PORTFOLIO_LIMITS=Object.freeze({maxDailyLossPct:3,maxPortfolioDrawdownPct:10,maxGrossExposurePct:40,maxChainExposurePct:25});

export function portfolioLimits(config={}){
 const out={...PORTFOLIO_LIMITS};
 for(const [key,min,max] of [['maxDailyLossPct',.5,20],['maxPortfolioDrawdownPct',1,40],['maxGrossExposurePct',10,80],['maxChainExposurePct',10,60]]){
  if(config[key]!==undefined){if(!Number.isFinite(config[key])||config[key]<min||config[key]>max)throw Error('Invalid '+key);out[key]=config[key];}
 }
 if(out.maxChainExposurePct>out.maxGrossExposurePct)throw Error('Chain exposure limit cannot exceed total exposure limit');
 return out;
}

// Limits are paper-account controls, not predictions or exchange stop orders.
export function portfolioRisk(state,valuation,now=Date.now()){
 const limits=portfolioLimits(state.config),day=new Date(now).toISOString().slice(0,10),prior=state.portfolio||{},newDay=prior.day!==day,complete=valuation.complete&&Number.isSafeInteger(valuation.equityCents)&&valuation.equityCents>0;
 const dayStartEquityCents=newDay?(complete?valuation.equityCents:null):prior.dayStartEquityCents??(complete?valuation.equityCents:null),dayStartedAt=newDay||!prior.dayStartEquityCents?now:prior.dayStartedAt;
 const peakEquityCents=complete?Math.max(prior.peakEquityCents||valuation.equityCents,valuation.equityCents):prior.peakEquityCents||null;
 const dailyLossPct=complete&&dayStartEquityCents?(1-valuation.equityCents/dayStartEquityCents)*100:null,drawdownPct=complete&&peakEquityCents?(1-valuation.equityCents/peakEquityCents)*100:null;
 let halt=prior.halt&&(!newDay||prior.halt.kind!=='daily-loss')?prior.halt:null;
 if(!halt&&drawdownPct>=limits.maxPortfolioDrawdownPct)halt={kind:'drawdown',at:now,reason:'Paper portfolio drawdown limit reached; operator review required'};
 if(!halt&&dailyLossPct>=limits.maxDailyLossPct)halt={kind:'daily-loss',at:now,reason:'Paper daily loss limit reached; entries halted for this UTC day'};
 const exposureCents=complete?valuation.positions.reduce((n,p)=>n+p.marketValueCents,0):null,chains={};
 if(complete)for(const p of valuation.positions)chains[p.chain]=(chains[p.chain]||0)+p.marketValueCents;
 return {version:1,at:now,day,dayStartedAt,dayStartEquityCents,peakEquityCents,dailyLossPct,drawdownPct,exposureCents,chainExposureCents:chains,equityCents:complete?valuation.equityCents:null,limits,halt,allowEntries:complete&&!halt,status:halt?'halted':complete?'observing':'unknown',basis:'First complete fresh mark of UTC day; drawdown since risk baseline. Chain concentration is a proxy, not measured cross-asset correlation. Exits remain eligible for evaluation.'};
}

export function allocationRisk(risk,chain,notionalCents,feeCents=0){
 if(!risk.allowEntries)return risk.halt?.reason||'Complete fresh portfolio valuation required for new entries';
 const equity=risk.equityCents-feeCents;
 if(!(equity>0))return 'No positive equity after modeled fees';
 if((risk.exposureCents+notionalCents)/equity*100>risk.limits.maxGrossExposurePct)return 'Total paper exposure limit would be exceeded';
 if(((risk.chainExposureCents[chain]||0)+notionalCents)/equity*100>risk.limits.maxChainExposurePct)return 'Per-chain paper concentration limit would be exceeded';
 return null;
}
