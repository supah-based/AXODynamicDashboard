/* Shared filters and pool analytics for the public Trading Desk. */
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
 const ROTATION_WINDOWS={
  m5:{label:'5m',prior:'55m',duration:HOUR/12,intervals:11,volume:'volume5',total:'volume1',minTurnover:1000},
  h1:{label:'1h',prior:'23h',duration:HOUR,intervals:23,volume:'volume1',total:'volume24',minTurnover:10000}
 };
 const ROTATION_RULES={liquidity:10000,minPools:5,coverage:.5,broadPace:1.5,coolPace:.75,upShare:.6,coolUpShare:.4,dominantShare:.5};
 const SORTS={change5:'5m change',change1:'1h change',change24:'24h change',volume:'Volume',liquidity:'Liquidity',marketCap:'Market cap'};
 const finite=Number.isFinite;
 const normalizeAddress=(chain,value)=>typeof value==='string'?(chain==='solana'?value:value.toLowerCase()):'';
 const tokenKey=p=>p.chain+':'+normalizeAddress(p.chain,p.address);
 const poolKey=p=>tokenKey(p)+':'+normalizeAddress(p.chain,p.pair||p.pool);
 const fresh=(at,now,max=MARKET_MAX_AGE)=>finite(at)&&at>0&&at<=now&&now-at<=max;
 const currentEvidence=(row,now)=>!row.outside&&!row.risk?.excluded&&row.quality==='current'&&
  row.project.observationStatus!=='stale'&&fresh(row.project.seenAt,now);

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
 function currentSample(rows,now){
  const unique=new Map();
  for(const row of rows){
   const p=row.project;
   if(!currentEvidence(row,now))continue;
   const key=tokenKey(p),old=unique.get(key)?.project;
   if(!old||p.seenAt>old.seenAt||p.seenAt===old.seenAt&&p.liquidity>old.liquidity)unique.set(key,row);
  }
  return unique;
 }
 function signals(rows,now,requestedWindow){
  const window=Object.hasOwn(FLOW_WINDOWS,requestedWindow)?requestedWindow:'h1';
  const unique=currentSample(rows,now);
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
 function turnoverComparison(project,window){
  const {duration,intervals,volume,total,minTurnover}=ROTATION_WINDOWS[window];
  const recent=project[volume],enclosing=project[total];
  if(!finite(project.createdAt)||project.createdAt<=0||project.seenAt-project.createdAt<duration*(intervals+1))return null;
  if(!finite(recent)||!finite(enclosing)||recent<0||enclosing<=recent)return null;
  // Subtract the overlapping volume before normalizing the preceding interval to the same duration.
  const baseline=(enclosing-recent)/intervals,pace=recent/baseline;
  if(!(baseline>0)||!finite(pace))return null;
  const change=project.changes?.[window]??(window==='h1'?project.change1:null);
  return {recent,baseline,pace,delta:recent-baseline,change:finite(change)?change:null,active:enclosing>=minTurnover};
 }
 function followThrough(row,now){
  if(!currentEvidence(row,now))return {state:'unavailable',m5:null,h1:null,sustained:false};
  const m5=turnoverComparison(row.project,'m5'),h1=turnoverComparison(row.project,'h1');
  const {broadPace,coolPace}=ROTATION_RULES;
  const comparable=m5?.active&&h1?.active&&m5.change!==null&&h1.change!==null;
  let state='incomplete';
  if(comparable){
   const shortLift=m5.pace>=broadPace&&m5.change>0,hourLift=h1.pace>=broadPace&&h1.change>0;
   if(shortLift&&hourLift)state='building';
   else if(m5.pace<=coolPace&&m5.change<=0&&hourLift)state='fading';
   else if(shortLift)state='burst';
   else state='mixed';
  }
  return {state,m5,h1,sustained:row.activity?.sustained===true};
 }
 function rotationState(comparable,pools,pace,breadth,concentration){
  const {minPools,coverage,broadPace,coolPace,upShare,coolUpShare,dominantShare}=ROTATION_RULES;
  if(!pools)return 'empty';
  if(comparable<minPools||comparable/pools<coverage)return 'limited';
  if(concentration>=dominantShare)return 'concentrated';
  if(pace>=broadPace&&breadth>=upShare)return 'broadening';
  if(pace<=coolPace&&breadth<=coolUpShare)return 'cooling';
  return 'mixed';
 }
 function rotation(rows,now,requestedWindow){
  const window=Object.hasOwn(ROTATION_WINDOWS,requestedWindow)?requestedWindow:'m5';
  const sample=[...currentSample(rows.filter(row=>row.project.liquidity>=ROTATION_RULES.liquidity),now).values()];
  return {window,chains:CHAIN_IDS.map(chain=>{
   const poolRows=sample.filter(row=>row.project.chain===chain);
   const comparable=poolRows.flatMap(({project})=>{
    const comparison=turnoverComparison(project,window);
    return comparison?.active&&comparison.change!==null?[{project,...comparison}]:[];
   });
   const n=comparable.length,paces=comparable.map(p=>p.pace).sort((a,b)=>a-b),middle=Math.floor(n/2);
   const pace=n===0?null:n%2?paces[middle]:paces[middle-1]+(paces[middle]-paces[middle-1])/2;
   const rising=comparable.filter(p=>p.change>0).length,breadth=n?rising/n:null;
   const lead=comparable.reduce((largest,p)=>!largest||p.recent>largest.recent?p:largest,null);
   const turnover=comparable.reduce((sum,p)=>sum+p.recent,0);
   const concentration=finite(turnover)&&turnover>0?lead.recent/turnover:null;
   const state=rotationState(n,poolRows.length,pace,breadth,concentration);
   const drivers=[...comparable].sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta)||poolKey(a.project).localeCompare(poolKey(b.project)));
   if(state==='concentrated')drivers.unshift(...drivers.splice(drivers.indexOf(lead),1));
   return {chain,state,pools:poolRows.length,comparable:n,pace,rising,breadth,concentration,
    newestAt:n?Math.max(...comparable.map(({project})=>project.seenAt)):null,
    oldestAt:n?Math.min(...comparable.map(({project})=>project.seenAt)):null,
    drivers:drivers.slice(0,3)};
  })};
 }
 return {CHAIN_IDS,MARKET_MAX_AGE,MODES,LIQUIDITY,CAPS,FLOW_WINDOWS,ROTATION_WINDOWS,ROTATION_RULES,SORTS,tokenKey,poolKey,fresh,criteria,qualifies,order,select,signals,followThrough,rotation};
});
