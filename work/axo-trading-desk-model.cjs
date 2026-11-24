/* Shared filters and ranking for the public Trading Desk. */
(function(root,factory){
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.AxoTradingDesk=factory();
})(globalThis,function(){
 const CHAIN_IDS=['solana','base','bsc','robinhood','arc'];
 const MARKET_MAX_AGE=300000;
 const HOUR=3600000;
 const MODES={
  active:{label:'Active',summary:'By hourly trading volume',description:'Pools with reported recent turnover and liquidity. Ordered by hourly USD volume.'},
  momentum:{label:'Momentum',summary:'Rising price and trade activity',description:'Positive 5m and 1h moves with at least 8 trades in 5m and 1.5× the preceding 55-minute volume pace.'},
  new:{label:'New pools',summary:'Pools opened in the last 24h',description:'Reported pool creation within 24 hours. Ordered newest first.'},
  rebound:{label:'Pullbacks',summary:'24h dips with a 1h rebound',description:'Down at least 15% over 24h, up at least 1% over 1h, with a non-negative 5m move. Price pattern only.'},
  following:{label:'Following',summary:'Your saved contracts',description:'Your saved contracts. Older observations and risk warnings remain visible.'}
 };
 const LIQUIDITY=[1000,10000,25000,50000,100000,250000];
 const CAPS=[null,1000000,5000000,25000000,100000000];
 const FLOW_WINDOWS={m5:'5m',h1:'1h',h24:'24h'};
 const SORTS={change5:'5m change',change1:'1h change',change24:'24h change',volume:'Volume',liquidity:'Liquidity',marketCap:'Market cap'};
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
   sort:typeof value.sort==='string'&&Object.hasOwn(SORTS,value.sort)?value.sort:null,
   direction:value.direction==='asc'?'asc':'desc',
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
   if(q){
    const address=normalizeAddress(p.chain,q);
    const identity=[p.address,p.pair||p.pool].some(value=>normalizeAddress(p.chain,value).includes(address));
    if(!identity&&![p.name,p.symbol].some(value=>typeof value==='string'&&value.toLowerCase().includes(q.toLowerCase())))return false;
   }
   if(filters.mode==='following')return followed.has(tokenKey(p));
   if(!(p.liquidity>=filters.liquidity))return false;
   if(filters.maxCap!==null&&(!finite(p.marketCap)||p.marketCap>filters.maxCap))return false;
   if(filters.screened&&(!row.risk?.fresh||row.risk.status!=='screened'||!fresh(row.risk.observedAt,now)))return false;
   return qualifies(row,filters.mode,now);
  });
  const sorted=order(matches,filters.mode);
  if(filters.sort){
   const metric=row=>{
    const p=row.project;
    if(filters.sort==='change5')return p.changes?.m5;
    if(filters.sort==='volume')return filters.mode==='momentum'?p.volume5:p.volume1;
    return p[filters.sort];
   };
   const direction=filters.direction==='asc'?1:-1;
   return sorted.sort((a,b)=>{
    const left=metric(a),right=metric(b);
    if(!finite(left)||!finite(right))return Number(finite(right))-Number(finite(left));
    return (left-right)*direction;
   });
  }
  if(filters.chain||filters.mode==='following'||q)return sorted;
  const head=CHAIN_IDS.map(chain=>sorted.find(row=>row.project.chain===chain)).filter(Boolean);
  const first=new Set(head);
  return [...order(head,filters.mode),...sorted.filter(row=>!first.has(row))];
 }
 function signals(rows,now,requestedWindow){
  const window=Object.hasOwn(FLOW_WINDOWS,requestedWindow)?requestedWindow:'h1';
  const unique=new Map();
  for(const row of rows){
   const p=row.project;
   if(row.outside||row.risk?.excluded||row.quality!=='current'||p.observationStatus==='stale'||!fresh(p.seenAt,now))continue;
   const key=tokenKey(p),old=unique.get(key)?.project;
   if(!old||p.seenAt>old.seenAt||p.seenAt===old.seenAt&&p.liquidity>old.liquidity)unique.set(key,row);
  }
  const trades={window,pools:0,buys:0,sells:0,buyShare:null};
  const liquidity={pools:0,usd:0,volume24:0};
  const movers=[];
  let oldestAt=null,newestAt=null,gainers=0,losers=0;
  for(const {project:p} of unique.values()){
   oldestAt=Math.min(oldestAt??p.seenAt,p.seenAt);
   newestAt=Math.max(newestAt??p.seenAt,p.seenAt);
   const {buys,sells}=p.transactions?.[window]||{};
   if(Number.isSafeInteger(buys)&&buys>=0&&Number.isSafeInteger(sells)&&sells>=0&&
      Number.isSafeInteger(trades.buys+trades.sells+buys+sells)){
    trades.pools++;
    trades.buys+=buys;
    trades.sells+=sells;
   }
   if(finite(p.liquidity)&&p.liquidity>0&&finite(p.volume24)&&p.volume24>=0&&
      finite(liquidity.usd+p.liquidity)&&finite(liquidity.volume24+p.volume24)){
    liquidity.pools++;
    liquidity.usd+=p.liquidity;
    liquidity.volume24+=p.volume24;
   }
   if(finite(p.change1)){
    if(p.change1>0)gainers++;
    else if(p.change1<0)losers++;
    movers.push(p);
   }
  }
  if(trades.buys+trades.sells>0)trades.buyShare=trades.buys/(trades.buys+trades.sells);
  movers.sort((a,b)=>Math.abs(b.change1)-Math.abs(a.change1)||(b.volume1??0)-(a.volume1??0)||poolKey(a).localeCompare(poolKey(b)));
  return {pools:unique.size,sampleSize:rows.length,oldestAt,newestAt,trades,liquidity,gainers,losers,withChange:movers.length,
   movers:movers.filter(p=>p.change1!==0).slice(0,3)};
 }
 return {CHAIN_IDS,MARKET_MAX_AGE,MODES,LIQUIDITY,CAPS,FLOW_WINDOWS,SORTS,tokenKey,poolKey,fresh,criteria,qualifies,order,select,signals};
});
