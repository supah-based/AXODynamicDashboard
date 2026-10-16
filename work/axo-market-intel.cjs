(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AxoMarketIntel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const finite=v=>typeof v==='number'&&Number.isFinite(v),valid=v=>finite(v)&&v>=0,count=v=>Number.isSafeInteger(v)&&v>=0;
 const recent=(t,now,ttl=300000)=>finite(t)&&t>0&&t<=now&&now-t<=ttl;
 const equal=(a,b,chain)=>typeof a==='string'&&typeof b==='string'&&(chain==='solana'?a===b:a.toLowerCase()===b.toLowerCase());
 function integrity(p){
  if(!p||typeof p!=='object'||Array.isArray(p))return {status:'inconsistent',issues:['Market observation unavailable']};
  const issues=[],windows=[['m5','5m','volume5'],['h1','1h','volume1'],['h6','6h','volume6'],['h24','24h','volume24']],volumes=[],trades=[];if(p.activityIntegrity?.status==='inconsistent')issues.push('Earlier normalization reported inconsistent activity data');
  for(const [key,label,field]of windows){const value=p[field];if(value!==undefined&&value!==null&&!valid(value))issues.push('Invalid '+label+' USD volume');if(valid(value))volumes.push({label,value});const tx=p.transactions?.[key];for(const side of ['buys','sells'])if(tx?.[side]!==undefined&&tx[side]!==null&&!count(tx[side]))issues.push('Invalid '+label+' transaction count');if(count(tx?.buys)&&count(tx?.sells)){const total=tx.buys+tx.sells;if(Number.isSafeInteger(total))trades.push({label,value:total});else issues.push('Invalid '+label+' transaction total');}}
  for(const side of ['buys','sells']){if(p[side]!==undefined&&p[side]!==null&&!count(p[side]))issues.push('Invalid hourly '+side+' count');if(count(p[side])&&count(p.transactions?.h1?.[side])&&p[side]!==p.transactions.h1[side])issues.push('Hourly '+side+' counts disagree within the snapshot');}
  for(const rows of [volumes,trades])for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i],tolerance=rows===volumes?Math.max(1,b.value*.02):0;if(a.value>b.value+tolerance)issues.push(a.label+' '+(rows===volumes?'USD volume':'transaction count')+' exceeds the enclosing '+b.label+' window');}
  for(const side of ['buys','sells']){const rows=windows.filter(([key])=>count(p.transactions?.[key]?.[side])).map(([key,label])=>({label,value:p.transactions[key][side]}));for(let i=1;i<rows.length;i++)if(rows[i-1].value>rows[i].value)issues.push(rows[i-1].label+' '+side+' count exceeds the enclosing '+rows[i].label+' window');}
  return {status:issues.length?'inconsistent':'no_conflict_observed',issues};
 }
 function quality(p,now=Date.now()){
  const observations=(p.providerObservations||[]).filter(o=>recent(o.seenAt,now)&&Math.abs(o.seenAt-p.seenAt)<=60000&&finite(o.price)&&o.price>0),providers=[...new Set(observations.map(o=>o.provider))];
  const activity=integrity(p),values=observations.map(o=>o.price),spread=values.length>1?(Math.max(...values)/Math.min(...values)-1)*100:null;
  return {status:!recent(p.seenAt,now)||p.observationStatus==='stale'?'stale':!finite(p.price)||p.price<=0?'incomplete':spread>20?'conflict':activity.issues.length?'inconsistent':'current',activity,priceSpreadPct:spread,providers,observedAt:p.seenAt||null,meaning:'Same selected pool, USD quotes, fresh provider snapshots. Providers may share upstreams; agreement is not independent verification.'};
 }
 function brief(p,{risk={},now=Date.now(),external=null,progression=p.progression||null}={}){
  const q=quality(p,now),gaps=[],signals=[],cautions=[];
  const tx=p.transactions?.m5,b=count(tx?.buys)?tx.buys:null,s=count(tx?.sells)?tx.sells:null,transactions=b!==null&&s!==null?b+s:null;
  const v5=valid(p.volume5)?p.volume5:null,v1=valid(p.volume1)?p.volume1:null;
  // Remove the latest five minutes from the hour before comparing equal-duration rates.
  const prior55=v5!==null&&v1!==null&&v1>=v5?v1-v5:null,pace=prior55>0?v5/(prior55/11):null;
  const sufficient=transactions!==null&&transactions>=10&&v1>=5000;
  if(q.status!=='current')gaps.push(...(q.status==='inconsistent'?q.activity.issues:[q.status==='conflict'?'Fresh providers disagree on this pool price':'Fresh usable market observation required']));
  if(pace===null)gaps.push('Comparable 5m / prior 55m USD volume unavailable');
  if(transactions===null)gaps.push('Five-minute transaction counts unavailable');
  if(sufficient&&pace>=2)signals.push('5m activity pace '+pace.toFixed(1)+'× the prior 55m rate');
  if(transactions>=10&&b/transactions>=.65)signals.push(Math.round(b/transactions*100)+'% of sampled 5m trades are buys');
  if(!valid(p.liquidity)||p.liquidity<50000)cautions.push('Thin or unknown pool liquidity');
  if(valid(p.change24)&&p.change24>=300)cautions.push('Extended daily move; inspect entry timing');
  if(finite(p.change24)&&p.change24<=-50)cautions.push('Large daily decline; recovery is unconfirmed');
  if(valid(p.liquidity)&&p.liquidity>0&&v1!==null&&v1/p.liquidity>10)cautions.push('Very high turnover relative to liquidity; inspect artificial activity');
  if(external?.chain===p.chain&&equal(external.address,p.address,p.chain)&&external.status==='available'&&external.stale!==true&&!external.refreshStatus&&external.receivedAt>0&&external.receivedAt<=now&&now-external.receivedAt<=300000&&external.top10Rate>.5)cautions.push('GMGN reports concentrated top holders');
  if(external?.chain===p.chain&&equal(external.address,p.address,p.chain)&&external.status==='available'&&external.stale!==true&&!external.refreshStatus&&recent(external.receivedAt,now)&&external.reportedRatios?.devTeam>.5)cautions.push('GMGN reports concentrated developer-team supply');
  const comparable=progression?.status==='available'&&progression.identity?.chain===p.chain&&equal(progression.identity.address,p.address,p.chain)&&equal(progression.identity.pool,p.pair||p.pool,p.chain)&&progression.identity.provider===p.provider&&progression.observedAt===p.seenAt&&q.status==='current';
  if(risk.status!=='screened')gaps.push(risk.status==='warning'?'Contract source flags need review':risk.excluded?'Severe source flag':'Complete current core contract checks required');
  if(comparable&&progression.liquidityPct<=-25)cautions.push('Reported pool liquidity down '+Math.abs(progression.liquidityPct).toFixed(0)+'% in '+progression.windowMinutes.toFixed(1)+' minutes');
  if(comparable&&progression.holderDelta>0)signals.push('Provider holder count +'+progression.holderDelta+' addresses over a dated short interval');
  if(comparable&&progression.sustained)signals.unshift('Activity pace confirmed on three spaced observations');
  if(q.status!=='current'||risk.excluded)signals.length=0;
  const state=risk.excluded?'risk-warning':q.status!=='current'||risk.status!=='screened'?'check-data':cautions.length?'wait':signals.length&&sufficient?'investigate':'observe';
  const headline={'risk-warning':'Review severe risk', 'check-data':'Check missing evidence',wait:'Inspect entry risks',investigate:'Activity worth researching',observe:'Watch for a clearer change'}[state];
  return {version:1,at:now,observedAt:p.seenAt||null,state,headline,quality:q,progression:comparable?progression:null,signals:signals.slice(0,3),cautions,gaps,metrics:{volume5:v5,volume1:v1,pace5toPrior55:pace,transactions5:transactions,buyShare5:transactions>0?b/transactions:null,turnover1:valid(p.liquidity)&&p.liquidity>0&&v1!==null?v1/p.liquidity:null},next:state==='risk-warning'?'Review the source flags; excluded from suggestions':state==='investigate'?'Open screening and check the chart, sellability and costs':state==='wait'?'Wait for a stronger entry or resolve the cautions':'Collect the missing evidence before acting',limits:'Attention and transaction counts do not prove unique buyers, net inflows, safety or future profit. Experimental triage only.'};
 }
 return {quality,brief,integrity};
});
