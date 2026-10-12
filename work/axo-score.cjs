/* Research triage, never a calibrated probability of profit. Missing evidence earns no points. */
(function(root){
 const fresh=(at,now,ttl)=>Number.isFinite(at)&&at>0&&at<=now&&now-at<=ttl;
 const number=v=>Number.isFinite(v)&&v>=0;
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 function evaluate(p,{risk={},holders={},trend={},narrative={}}={},now=Date.now()){
  const market=fresh(p.seenAt,now,p.provider==='GeckoTerminal'?900000:180000)&&p.observationStatus!=='stale',rows=[];
  const add=(id,label,max,known,points,reason,at)=>rows.push({id,label,max,known,points:known?Math.round(clamp(points,0,max)):0,reason,at:known?at:null});
  add('liquidity','Liquidity',20,market&&number(p.liquidity),p.liquidity>=1000000?20:p.liquidity>=250000?16:p.liquidity>=100000?12:p.liquidity>=25000?6:0,'Pool liquidity: $25k / $100k / $250k / $1m earn 6 / 12 / 16 / 20. Reported liquidity is not executable depth.',p.seenAt);
  const activity=market&&number(p.volume1)&&number(p.volume24)&&p.volume24>0,pace=activity?p.volume1/(p.volume24/24):0;
  add('activity','Trading activity',15,activity,(p.volume24>=100000?5:p.volume24>=10000?3:0)+(pace>=2?10:pace>=1.25?7:pace>=.75?4:0),'Daily volume and latest-hour pace against the 24h hourly average. A spike can reflect wash trading.',p.seenAt);
  const h1=p.changes?.h1??p.change1,h24=p.changes?.h24??p.change24,price=market&&Number.isFinite(h1)&&Number.isFinite(h24);
  add('momentum','Price momentum',15,price,(h24>0&&h24<=30?8:h24>30&&h24<=100?4:0)+(h1>0&&h1<=10?7:h1>10&&h1<=30?3:0),'Aligned 1h and 24h gains; extreme moves lose points. These windows do not establish a trend or forecast.',p.seenAt);
  const checks=risk.checks||[],required=p.chain==='solana'?['non_transferable','mintable','freezable']:['is_honeypot','cannot_sell_all','is_blacklisted','transfer_pausable','hidden_owner','owner_change_balance','is_mintable','is_proxy'];
  const security=risk.fresh===true&&fresh(risk.observedAt,now,300000)&&(p.chain==='solana'||risk.verification==='1')&&required.every(k=>checks.some(c=>c.key===k&&['0','1'].includes(c.value)));
  const ok=k=>checks.find(c=>c.key===k)?.value==='0';
  add('security','Contract screening',25,security,required.filter(ok).length/required.length*25,'Full points need every listed chain-specific source check. No flag is not proof of safety; missing checks earn no points.',risk.observedAt);
  const count=fresh(holders.at,now,300000)&&number(holders.count),delta=count&&trend.status==='available'&&fresh(trend.to,now,900000)&&trend.after===holders.count&&Number.isFinite(trend.delta)&&trend.windowHours>=23&&trend.windowHours<=25;
  add('holders','Holder participation',15,count,(holders.count>=10000?8:holders.count>=1000?6:holders.count>=100?3:0)+(delta&&trend.delta>0?7:0),'Address count plus a comparable, sourced day-over-day increase. Addresses are not people.',holders.at);
  const narr=narrative.verified===true&&fresh(narrative.at,now,900000)&&Array.isArray(narrative.sources)&&narrative.sources.length>0;
  add('narrative','Narrative evidence',10,narr,narrative.confirmations>=2?10:5,'Needs dated sourced narrative evidence; a category label, paid boost or model opinion alone does not qualify.',narrative.at);
  const coverage=rows.filter(r=>r.known).reduce((s,r)=>s+(r.id==='holders'&&!delta?8:r.max),0),raw=rows.reduce((s,r)=>s+r.points,0),cap=risk.excluded?19:risk.status==='warning'?59:!security?69:99;
  return {version:'1.0',score:market?Math.min(raw,cap):null,coverage,raw,cap,rows,at:market?p.seenAt:null,label:!market?'Needs fresh data':risk.excluded?'Severe source flag':risk.status==='warning'?'Risk flags':coverage<75?'Limited evidence':raw>=75?'Investigate further':'Research candidate',limits:'Evidence score out of 100; not probability, expected profit or position size. Missing points are never redistributed. Uncalibrated heuristic; 100 is not issued.'};
 }
 const api={evaluate,fresh};root.AxoScore=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
