/* Shared filters and ranking for the public Trading Desk. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.AxoTradingDesk=factory();
})(globalThis,function(){
 const CHAIN_IDS=['solana','base','bsc','robinhood','arc'];
 const MARKET_MAX_AGE=300000;
 const HOUR=3600000;
 const MODES={
  active:{label:'Active',description:'Pools with reported recent turnover and liquidity. Ordered by hourly USD volume.'},
  momentum:{label:'Momentum',description:'Positive 5m and 1h moves with at least 8 trades in 5m and 1.5× the preceding 55-minute volume pace.'},
  new:{label:'New pools',description:'Reported pool creation within 24 hours. Ordered newest first.'},
  rebound:{label:'Pullbacks',description:'Down at least 15% over 24h, up at least 1% over 1h, with a non-negative 5m move. Price pattern only.'},
  following:{label:'Following',description:'Your saved contracts. Older observations and risk warnings remain visible.'}
 };
 const LIQUIDITY=[1000,10000,25000,50000,100000,250000];
 const CAPS=[null,1000000,5000000,25000000,100000000];
 const finite=Number.isFinite;
 const normalizeAddress=(chain,value)=>typeof value==='string'?(chain==='solana'?value:value.toLowerCase()):'';
 const tokenKey=p=>p.chain+':'+normalizeAddress(p.chain,p.address);
 const poolKey=p=>tokenKey(p)+':'+normalizeAddress(p.chain,p.pair||p.pool);
 const fresh=(at,now,max=MARKET_MAX_AGE)=>finite(at)&&at>0&&at<=now&&now-at<=max;

 function criteria(value={}){
  return {
   mode:Object.hasOwn(MODES,value.mode)?value.mode:'active',
   chain:CHAIN_IDS.includes(value.chain)?value.chain:null,
   liquidity:LIQUIDITY.includes(value.liquidity)?value.liquidity:10000,
   maxCap:CAPS.includes(value.maxCap)?value.maxCap:25000000,
   screened:value.screened===true,
   query:typeof value.query==='string'?value.query.trim().slice(0,120):''
  };
 }
 function qualifies(row,mode,now){
  const p=row.project;
  if(mode==='following')return true;
  if(row.risk?.excluded||row.quality!=='current'||p.observationStatus==='stale'||!fresh(p.seenAt,now))return false;
  if(mode==='new')return fresh(p.createdAt,now,24*HOUR);
  const traded=p.volume1>=1000||p.volume5>=250;
  if(!traded)return false;
  if(mode==='momentum')return p.changes?.m5>0&&p.change1>0&&row.activity.trades5>=8&&row.activity.pace>=1.5;
  if(mode==='rebound')return finite(p.change24)&&p.change24<=-15&&p.change1>=1&&finite(p.changes?.m5)&&p.changes.m5>=0;
  return true;
 }
 function score(row,mode){
  const p=row.project;
  if(mode==='new')return p.createdAt??-Infinity;
  if(mode==='momentum')return Math.min(row.activity.pace??0,8)*Math.log10(1+(p.volume5??0));
  if(mode==='rebound')return Math.min(p.change1??0,50)*Math.log10(1+(p.volume1??0));
  if(mode==='following')return row.risk?.excluded?Infinity:p.seenAt??-Infinity;
  return p.volume1??-Infinity;
 }
 function order(rows,mode){
  return [...rows].sort((a,b)=>score(b,mode)-score(a,mode)
   ||(b.project.liquidity??-1)-(a.project.liquidity??-1)
   ||poolKey(a.project).localeCompare(poolKey(b.project)));
 }
 function select(rows,value,now,followed=new Set()){
  const filters=criteria(value),q=filters.query;
  const matches=rows.filter(row=>{
   const p=row.project;
   if(filters.chain&&p.chain!==filters.chain)return false;
   if(q&&!([p.name,p.symbol].some(v=>typeof v==='string'&&v.toLowerCase().includes(q.toLowerCase()))||normalizeAddress(p.chain,p.address).includes(normalizeAddress(p.chain,q))))return false;
   if(filters.mode==='following')return followed.has(tokenKey(p));
   if(!(p.liquidity>=filters.liquidity))return false;
   if(filters.maxCap!==null&&(!finite(p.marketCap)||p.marketCap>filters.maxCap))return false;
   if(filters.screened&&(!row.risk?.fresh||row.risk.status!=='screened'||!fresh(row.risk.observedAt,now)))return false;
   return qualifies(row,filters.mode,now);
  });
  const sorted=order(matches,filters.mode);
  if(filters.chain||filters.mode==='following'||q)return sorted;
  const head=CHAIN_IDS.map(chain=>sorted.find(row=>row.project.chain===chain)).filter(Boolean);
  const first=new Set(head);
  return [...order(head,filters.mode),...sorted.filter(row=>!first.has(row))];
 }
 return {CHAIN_IDS,MARKET_MAX_AGE,MODES,LIQUIDITY,CAPS,tokenKey,poolKey,fresh,criteria,qualifies,order,select};
});
