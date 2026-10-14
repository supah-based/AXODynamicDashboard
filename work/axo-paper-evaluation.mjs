import {createHash} from 'node:crypto';

export function experimentId(config){
 const sorted=value=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,sorted(value[k])])):value;
 return createHash('sha256').update(JSON.stringify(sorted(config))).digest('hex').slice(0,16);
}

// Aggregate only full round trips; partial exits never become separate winning trades.
export function recordCompletedTrade(state,event){
 const fill=event.data?.result?.fill;
 if(event.data?.result?.action!=='sell'||!fill||fill.remainingQuantity>0)return;
 const prior=state.positions[fill.key];if(!prior)return;
 const original=prior.initialOutlayCents??prior.costCents,net=fill.netProceedsCents;
 if(!Number.isSafeInteger(original)||original<=0||!Number.isSafeInteger(net))return;
 const id=prior.plan?.experimentId||'legacy-unversioned',groups=state.stats.experiments??={};
 if(!groups[id]&&Object.keys(groups).length>=32){state.stats.ungroupedClosed=(state.stats.ungroupedClosed||0)+1;return;}
 const group=groups[id]??={id,firstEntryAt:prior.at,lastExitAt:event.at,closed:0,wins:0,losses:0,flat:0,netCents:0,gainCents:0,lossCents:0,outlayCents:0,returnSum:0,samples:[]};
 const pnl=net-original,ret=pnl/original*100;group.closed++;group.wins+=Number(pnl>0);group.losses+=Number(pnl<0);group.flat+=Number(pnl===0);group.netCents+=pnl;group.gainCents+=Math.max(0,pnl);group.lossCents+=Math.max(0,-pnl);group.outlayCents+=original;group.returnSum+=ret;group.firstEntryAt=Math.min(group.firstEntryAt,prior.at);group.lastExitAt=event.at;
 group.samples.push({entryAt:prior.at,exitAt:event.at,pnlCents:pnl,returnPct:ret});group.samples=group.samples.slice(-120);
}

export function paperEvaluation(state,now=Date.now()){
 const experiments=Object.values(state.stats.experiments||{}).map(g=>({...g,samples:g.samples.slice(-30),winRatePct:g.closed?g.wins/g.closed*100:null,meanReturnPct:g.closed?g.returnSum/g.closed:null,profitFactor:g.lossCents>0?g.gainCents/g.lossCents:null,daysObserved:Math.max(0,(g.lastExitAt-g.firstEntryAt)/86400000),status:g.id==='legacy-unversioned'?'unversioned':g.closed<30||g.lastExitAt-g.firstEntryAt<7*86400000?'collecting':'review-required'}));
 return {at:now,mode:'prospective-paper',experiments,ungroupedClosed:state.stats.ungroupedClosed||0,status:experiments.some(g=>g.status==='review-required')?'review-required':'collecting',method:'Completed journal round trips grouped by immutable entry-plan configuration. Modeled fees, slippage and dated taxes included; partial proceeds count once at final exit. No-trade periods and losses remain in the journal.',limits:['Thirty closed trades and seven observed days are a review checkpoint, not statistical proof or automatic live-trading permission.','No calibrated profit probability, out-of-sample profitability claim, gas/MEV or user-size execution validation.','Legacy positions without an entry configuration fingerprint remain unversioned.']};
}
