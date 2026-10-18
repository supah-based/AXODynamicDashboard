(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AxoRewardEducation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const fresh=(at,now)=>Number.isFinite(at)&&at>0&&at<=now&&now-at<=900000;
 const address=s=>typeof s==='string'&&/^0x[a-f0-9]{40}$/i.test(s);
 function model(d,now=Date.now()){
  const valid=d?.identity?.officialMatch===true&&d.identity.chainId===4663&&d.identity.address?.toLowerCase()==='0x219b75d4068253cee3e83b8ad97ac8393d76fb1d',r=valid?d.rewards:null,f=valid?d.fees:null;
  const selected=r&&(!r.catalogStatus||r.catalogStatus==='available')&&fresh(r.catalogAt,now)?(Array.isArray(r.selected)?r.selected:[]).filter(a=>address(a.address)&&typeof a.symbol==='string'&&a.symbol.length<=30).slice(0,10):[];
  const assets=r&&fresh(r.observedAt,now)?(Array.isArray(r.assets)?r.assets:[]).filter(a=>address(a.address)&&typeof a.distributed==='string'&&/^\d+(?:\.\d+)?$/.test(a.distributed)).slice(0,20):[];
  const percent=b=>Number.isFinite(b)&&b>=0&&b<=10000?b/100:null;
  return {selected,assets,selectionAt:selected.length?r.catalogAt:null,accountingAt:assets.length?r.observedAt:null,minimumAxo:r&&fresh(r.observedAt,now)?r.minimumAxo:null,eligibleHolders:r&&fresh(r.observedAt,now)?r.eligibleHolders:null,distributionCount:r&&fresh(r.observedAt,now)&&r.eventHistoryComplete===true?r.distributionCount:null,currentMarkUsd:assets.length&&assets.every(a=>fresh(a.priceAt,now))&&Number.isFinite(r.markTotalUsd)?r.markTotalUsd:null,holderPayments:null,feeAt:f&&fresh(f.observedAt,now)?f.observedAt:null,buyHookPercent:f&&fresh(f.observedAt,now)?percent(f.buyBps):null,rewardTradePercent:f&&fresh(f.observedAt,now)?percent(f.rewardBps):null};
 }
 return {model};
});
