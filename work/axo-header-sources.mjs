import {AXO} from './axo-identity.mjs';
const eq=(a,b)=>typeof a==='string'&&a.toLowerCase()===b.toLowerCase();
export function axoGeckoHolders(response,at,now=Date.now()){
 const d=response?.data,a=d?.attributes,h=a?.holders,t=Date.parse(h?.last_updated);
 if(d?.type!=='token'||!eq(d.id,'robinhood_'+AXO.address)||!eq(a?.address,AXO.address)||a.decimals!==18||!Number.isSafeInteger(h?.count)||h.count<0||!Number.isFinite(t)||t>now||now-t>7*86400000)return null;
 return {count:h.count,observedAt:t,checkedAt:at,source:'GeckoTerminal exact Robinhood token',url:'https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/'+AXO.address+'/info',status:now-t<=900000?'current':'dated',top10:Number(h.distribution_percentage?.top_10)>=0&&Number(h.distribution_percentage?.top_10)<=100?Number(h.distribution_percentage.top_10):null};
}
export function reconcileAxoHeader(d,observation,now=Date.now()){
 if(!d.identity.officialMatch)return d;
 if(observation){d.holders.lastReported=observation;if(observation.status==='current'&&(d.holders.current===null||!d.holders.observedAt||observation.observedAt>d.holders.observedAt)){d.holders.current=observation.count;d.holders.observedAt=observation.observedAt;d.holders.source=observation.source;d.holders.sourceUrl=observation.url}d.holders.observations=[{count:d.holders.current,observedAt:d.holders.observedAt,source:d.holders.source||'Blockscout exact token'},observation].filter(x=>x.count!==null)}
 return d;
}
export function selectedCatalogFallback(input,now=Date.now()){
 const direct=input.catalog?.data,t=Date.parse(direct?.observedAt);if(direct?.status==='LIVE'&&Number.isFinite(t)&&now-t<=900000&&t<=now)return;
 const parent=input.overview?.data,c=parent?.rewardCatalog,at=Date.parse(c?.observedAt);
 if(parent?.chain?.id!==4663||!eq(parent?.token?.address,AXO.address)||!eq(parent?.contracts?.poolId,AXO.pool)||c?.status!=='LIVE'||c.source!=='BASED.BID_REWARD_CATALOG'||c.token?.chainId!==4663||!eq(c.token.address,AXO.address)||!Number.isFinite(at)||at>now||now-at>900000)return;
 input.sources=input.sources.map(s=>s.id==='catalog'?{...s,id:'catalog-direct'}:s);const source={id:'catalog',provider:'Official AXO overview · exact current reward catalog',url:'https://www.axo.vision/api/rewards/overview',status:'available',fetchedAt:input.overview.at,observedAt:at,delivery:'embedded-current-selector',error:null};input.catalog={data:c,at:input.overview.at,source};input.sources.push(source);
}
