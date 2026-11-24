/* The home desk uses the shared public sample. Following stays in this browser's workspace. */
(function(){
 const Desk=AxoTradingDesk;
 const id='stream-data-action-desk',rotationId='stream-data-chain-rotation',storageKey='axo-trading-desk-v1',pageSize=8;
 const picked=new Map(),painted=new WeakMap();
 let filters=Desk.criteria(axoReadJson(storageKey,{})||{}),sample=null,loading=false,error='',startedAt=0,limit=pageSize,showAll=false;
 let searchTimer=0,checkExpiry=0,returnFocus=null,inspected=null,check=null,checkRequest=null,contractRequest=null,mode='inspect',mounted=null;
 let flowWindow='h1',signalsExpanded=false,rotationWindow='m5',rotationChain=null;
 const rotationStates={
  broadening:['Broadening','Volume pace is rising across the sample and most comparable pools are advancing.'],
  cooling:['Cooling','Volume pace has slowed and few comparable pools are advancing.'],
  concentrated:['Concentrated','One pool accounts for at least half the recent turnover in this sample.'],
  mixed:['Mixed','The comparable pools show a mix of price moves and volume pace.'],
  limited:['Limited coverage','The sample has too few comparable pools for a chain signal.'],
  empty:['No current sample','There are no current pools for this chain in the rotation screen.']
 };
 const compactSignals=matchMedia('(max-width: 760px)');
 const dollars=new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',currencyDisplay:'narrowSymbol',notation:'compact',maximumFractionDigits:1});
 const integer=new Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:1});
 const tradeTotal=new Intl.NumberFormat(undefined);
 const money=value=>Number.isFinite(value)?dollars.format(value):'—';
 const count=value=>Number.isFinite(value)?integer.format(value):'—';
 const pct=value=>Number.isFinite(value)?(value>0?'+':'')+value.toFixed(1)+'%':'—';
 const multiple=value=>value===null?'—':value>0&&value<.1?'<0.1×':value.toFixed(1)+'×';
 const share=value=>value===null?'—':Math.round(value*100)+'%';
 const moneyDelta=value=>(value>0?'+':value<0?'−':'')+money(Math.abs(value));
 const tone=value=>!Number.isFinite(value)||value===0?'':value>0?'gain':'loss';
 const stamp=at=>at?age(at):'unknown';
 const asOf=at=>at?new Date(at).toLocaleString():'Unknown';
 const funds={active:'1h volume',momentum:'5m volume',new:'1h volume',rebound:'1h volume',following:'1h volume'};
 const root=()=>$('board').querySelector('[data-trading-desk]');
 const rotationRoot=()=>$('board').querySelector('[data-chain-rotation]');
 const deskResize=new ResizeObserver(()=>requestAnimationFrame(layout));
 const dialog=document.createElement('dialog');
 dialog.className='axo-desk-dialog';
 document.body.append(dialog);
 dialog.setAttribute('aria-labelledby','axoDeskDialogTitle');
 titles[id]='Trading Desk';
 titles[rotationId]='Chain Rotation';
 cardVisuals[id]=['search','Public market sample','#c8f45d','#26331a'];
 cardVisuals[rotationId]=['layers','Volume pace and breadth','#c8f45d','#26331a'];
 compactSignals.addEventListener('change',paint);

 function setFilters(value){
  filters=Desk.criteria({...filters,...value});
  limit=pageSize;
  try{localStorage.setItem(storageKey,JSON.stringify({...filters,query:''}));}catch{}
  paint();
 }
 function watchRows(rows){
  const existing=new Map(rows.map(row=>[Desk.poolKey(row.project),row]));
  return axoWatch.filter(p=>Desk.CHAIN_IDS.includes(p.chain)).flatMap(p=>{
   let identity;
   try{identity=AxoStreamSchema.exact({...p,pool:p.pair||p.pool},true);}catch{return [];}
   const project={...p,...identity,pair:identity.pool};
   const known=existing.get(Desk.poolKey(project));
   if(known)return known;
   return {project,quality:'stale',activity:{},risk:axoRiskState(p),outside:true,cautions:[]};
  });
 }
 function rowsForView(now){
  const rows=sample?.rows||[],following=filters.mode==='following';
  const watched=new Set(axoWatch.map(Desk.tokenKey));
  return Desk.select(following?watchRows(rows):rows,filters,now,watched);
 }
 function rowFor(key){
  return (sample?.rows||[]).find(row=>Desk.poolKey(row.project)===key)
   ||watchRows([]).find(row=>Desk.poolKey(row.project)===key)||picked.get(key)||null;
 }
 function chainMark(chain){
  const icon=axoCommonStreams.find(s=>s.chain===chain)?.icon;
  return icon?'<svg viewBox="0 0 24 24" aria-hidden="true">'+icon+'</svg>':cardIcon('layers');
 }
 function overview(){
  if(!sample)return '';
  const t=sample.bitcoin;
  const bitcoin=t&&Desk.fresh(t.at,Date.now(),900000)
   ?'<span title="'+esc((t.source||'Bitcoin source')+' · '+asOf(t.at))+'"><b>BTC '+esc(money(t.price))+'</b> <em class="'+tone(t.change24)+'">'+esc(pct(t.change24))+'</em> <small>24h</small></span>'
   :'<span><b>BTC</b> <small>Current reading unavailable</small></span>';
  const networks=sample.chains.map(c=>{
   const fresh=Desk.fresh(c.observedAt,Date.now()),selected=filters.chain===c.chain;
   const volume=c.volume&&Desk.fresh(c.volume.at,Date.now(),900000)?c.volume:null;
   const status=fresh?c.current+' current pools':c.observedAt?'Sample dated':'No current sample';
   const measure=volume&&Number.isFinite(volume.change24)
    ?'<strong class="'+tone(volume.change24)+'">'+esc(pct(volume.change24))+'</strong>'
    :'<span class="axo-desk-chain-state"><i data-current="'+fresh+'"></i>'+esc(fresh?c.current:'—')+'</span>';
   return '<button type="button" class="axo-desk-chain" data-desk-chain="'+esc(c.chain)+'" data-scope-chain="'+esc(c.chain)+'" aria-pressed="'+selected+'" title="'+esc(c.name+' · '+status+(volume?.source?' · 24h DEX volume from '+volume.source:''))+'"><span class="axo-desk-chain-mark">'+chainMark(c.chain)+'</span><span class="axo-desk-chain-name">'+esc(c.name)+'</span>'+measure+'</button>';
  });
  const chainOptions=sample.chains.map(c=>'<option value="'+esc(c.chain)+'" '+(filters.chain===c.chain?'selected':'')+'>'+esc(c.name)+'</option>').join('');
  return '<div class="axo-desk-marketline">'+bitcoin+'<span><small>24h DEX volume change or current pool count</small></span><div class="axo-desk-market-links">'+
   (hidden.includes(rotationId)?'':'<button class="btn" type="button" data-desk-rotation-link>Rotation</button>')+
   '<button class="btn" type="button" data-desk-open="news">News &amp; narratives</button></div></div><div class="axo-desk-chains" role="group" aria-label="Trading Desk chain">'+
   '<button type="button" class="axo-desk-chain all" data-desk-chain="" aria-pressed="'+!filters.chain+'"><span class="axo-desk-chain-mark">'+chainMark(null)+'</span><span class="axo-desk-chain-name">All chains</span><small>'+sample.chains.filter(c=>Desk.fresh(c.observedAt,Date.now())).length+'/5</small></button>'+networks.join('')+'</div>'+
   '<label class="axo-desk-chain-picker">Chain <select data-desk-chain-picker><option value="">All chains</option>'+chainOptions+'</select></label>';
 }
 function signalCards(evidence,chainView=false){
  const {pools,sampleSize,trades,liquidity,withChange,gainers,losers,movers,oldestAt,newestAt}=evidence;
  const window=Desk.FLOW_WINDOWS[trades.window],buys=tradeTotal.format(trades.buys),sells=tradeTotal.format(trades.sells);
  const share=trades.buyShare===null?null:(trades.buyShare*100).toFixed(1);
  const sellShare=share===null?null:(100-Number(share)).toFixed(1);
  const windowButtons=Object.entries(Desk.FLOW_WINDOWS).map(([id,label])=>'<button type="button" data-desk-flow-window="'+id+'" aria-pressed="'+(id===flowWindow)+'">'+label+'</button>').join('');
  const flow=trades.pools?'<div class="axo-signal-figures"><b class="gain">'+buys+' buys'+(share===null?'':' <small>'+share+'%</small>')+'</b><b class="loss">'+sells+' sells'+(sellShare===null?'':' <small>'+sellShare+'%</small>')+'</b></div>'+
   (share===null?'<small>No trades in this window</small>':'<div class="axo-signal-bar" role="img" aria-label="'+share+'% of reported trades were buys"><i style="width:'+share+'%"></i></div>')
   :'<p class="axo-signal-missing">Trade counts unavailable</p>';
  const depth=liquidity.pools?'<dl class="axo-signal-depth"><div><dt>Pool liquidity</dt><dd>'+esc(money(liquidity.usd))+'</dd></div><div><dt>Volume · 24h</dt><dd>'+esc(money(liquidity.volume24))+'</dd></div></dl>'
   :'<p class="axo-signal-missing">Paired liquidity and volume unavailable</p>';
  const pace=movers.length?'<ol class="axo-signal-movers" role="list">'+movers.map(p=>{
   const target=chainView?'data-chain-project="'+esc(p.id)+'"':'data-desk-inspect="'+esc(Desk.poolKey(p))+'"';
   return '<li><button type="button" '+target+' aria-label="Inspect '+esc((p.symbol||p.name)+' on '+axoChainNames[p.chain])+'"><b>'+esc(p.symbol||p.name)+'</b><small>'+esc(axoChainNames[p.chain])+'</small><span class="'+tone(p.change1)+'">'+esc(pct(p.change1))+'</span></button></li>';
  }).join('')+'</ol>'
   :'<p class="axo-signal-missing">'+(withChange?'Reported 1h changes are flat':'1h changes unavailable')+'</p>';
  return '<div class="axo-desk-signal-grid">'+
   '<section class="axo-desk-signal"><div class="axo-signal-head"><h3>Flow pulse</h3><div class="axo-signal-windows" role="group" aria-label="Trade count window">'+windowButtons+'</div></div>'+flow+
    '<small title="Counts include repeat trades. Volume reports USD turnover.">'+window+' trades · '+trades.pools+'/'+pools+' current pools</small></section>'+
   '<section class="axo-desk-signal"><div class="axo-signal-head"><h3>Liquidity check</h3></div>'+depth+
    '<small title="Reported reserves and turnover; execution depth can differ">'+liquidity.pools+'/'+pools+' current pools with both metrics</small></section>'+
   '<section class="axo-desk-signal"><div class="axo-signal-head"><h3>Fast movers</h3><small>1h</small></div>'+pace+
    '<small>'+gainers+' up · '+losers+' down · '+withChange+'/'+pools+' with 1h change</small></section></div>'+
   '<div class="axo-desk-signal-foot"><small>Filtered sample · '+pools+'/'+sampleSize+' current pools'+(newestAt?' · <time datetime="'+new Date(newestAt).toISOString()+'" title="'+esc(asOf(oldestAt)+' to '+asOf(newestAt))+'">Latest '+esc(stamp(newestAt))+'</time>':'')+'</small></div>';
 }
 function currentBadge(row){
  const risk=row.risk;
  if(risk?.excluded)return {label:risk.label||'Severe flag',className:'danger'};
  if(row.outside||!Desk.fresh(row.project.seenAt,Date.now())||row.quality==='stale')return {label:row.outside?'Outside current sample':'Dated market',className:'neutral'};
  if(row.quality!=='current')return {label:'Market needs review',className:'caution'};
  if(!risk?.fresh||!Desk.fresh(risk.observedAt,Date.now()))return {label:'Checks incomplete',className:'caution'};
  if(risk.status==='warning')return {label:'Review risk flags',className:'caution'};
  if(risk.status==='screened')return {label:'Core checks observed',className:'observed'};
  return {label:'Checks incomplete',className:'neutral'};
 }
 function why(row){
  const p=row.project,a=row.activity;
  if(row.risk?.excluded)return row.risk.label||'Severe source flag';
  if(row.outside)return 'Saved exact pool';
  if(filters.mode==='new')return 'Pool opened '+stamp(p.createdAt);
  if(filters.mode==='rebound')return pct(p.change1)+' this hour after '+pct(p.change24)+' over 24h';
  if(a.sustained)return 'Pace repeated on 3 observations';
  if(a.pace>=1.5)return a.pace.toFixed(1)+'× five-minute volume pace';
  if(a.unique5!==null&&a.unique5!==undefined)return count(a.unique5)+' unique traders in 5m';
  return null;
 }
 function listing(row){
  const p=row.project,key=Desk.poolKey(p),badge=currentBadge(row),reason=why(row);
  const logo=p.imageUrl?'<img src="'+esc(p.imageUrl)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'<span aria-hidden="true" data-scope-chain="'+esc(p.chain)+'">'+esc((p.symbol||p.name||'?').slice(0,2))+'</span>';
  const volume=filters.mode==='momentum'?p.volume5:p.volume1;
  const ref=filters.mode==='following'?'':' data-desk-ref="'+esc(p.chain)+'" data-desk-address="'+esc(p.address)+'" data-desk-pool="'+esc(p.pair)+'"';
  return '<tr data-desk-row="'+esc(key)+'"'+ref+'>'+
   '<th scope="row"><button class="axo-desk-token" data-desk-inspect="'+esc(key)+'" title="'+esc(p.name)+'">'+logo+'<span><b>'+esc(p.symbol||p.name)+'</b><small>'+esc(axoChainNames[p.chain])+(p.createdAt?' · Pool '+esc(age(p.createdAt)):'')+'</small></span></button></th>'+
   '<td data-label="5m" class="'+tone(p.changes?.m5)+'">'+esc(pct(p.changes?.m5))+'</td>'+
   '<td data-label="1h" class="'+tone(p.change1)+'">'+esc(pct(p.change1))+'</td>'+
   '<td data-label="24h" class="'+tone(p.change24)+'">'+esc(pct(p.change24))+'</td>'+
   '<td data-label="'+(filters.mode==='momentum'?'5m vol':'1h vol')+'">'+esc(money(volume))+'</td>'+
   '<td data-label="Liq.">'+esc(money(p.liquidity))+'</td>'+
   '<td data-label="MCap">'+esc(money(p.marketCap))+'</td>'+
   '<td class="axo-desk-why"><span class="axo-desk-badge '+badge.className+'">'+esc(badge.label)+'</span>'+(reason?'<small>'+esc(reason)+'</small>':'')+'</td>'+
   '<td class="axo-desk-row-controls"><button class="btn" type="button" data-desk-pick="'+esc(key)+'" aria-pressed="'+picked.has(key)+'" aria-label="'+(picked.has(key)?'Remove ':'Compare ')+esc(p.symbol||p.name)+'">'+(picked.has(key)?'✓':'+')+'</button></td></tr>';
 }
 function sortHeading(key,label){
  const direction=filters.sort===key?(filters.direction==='asc'?'ascending':'descending'):'';
  return '<th scope="col"'+(direction?' aria-sort="'+direction+'"':'')+'><button type="button" data-desk-sort="'+key+'">'+esc(label)+(direction?'<span aria-hidden="true">'+(direction==='ascending'?' ↑':' ↓')+'</span>':'')+'</button><span class="axo-desk-mobile-head">'+esc(label)+'</span></th>';
 }
 function paintTable(view,rows){
  const rowsNode=view.querySelector('[data-desk-results]'),n=rows.length,poolNoun=n===1?'pool':'pools';
  const prefix=filters.mode==='following'?'saved '+poolNoun:'matching '+poolNoun+' in the sample';
  let content;
  if(n){
   content='<table class="axo-desk-table"><caption class="axo-desk-sr">Sampled token pools</caption><thead><tr><th scope="col">Project</th>'+sortHeading('change5','5m')+sortHeading('change1','1h')+sortHeading('change24','24h')+sortHeading('volume',funds[filters.mode])+sortHeading('liquidity','Liquidity')+sortHeading('marketCap','Market cap')+'<th scope="col">Evidence</th><th scope="col"><span class="axo-desk-sr">Compare</span></th></tr></thead><tbody>'+
    rows.slice(0,limit).map(listing).join('')+'</tbody></table>';
  }else if(!sample&&filters.mode!=='following'){
   content='<p class="axo-desk-empty">'+esc(error||'Loading the five-chain sample…')+'</p>';
  }else{
   const scoped=(sample?.chains||[]).filter(c=>!filters.chain||c.chain===filters.chain);
   const current=scoped.some(c=>Desk.fresh(c.observedAt,Date.now()));
   const note=filters.mode==='following'&&!axoWatch.length?'Follow a project to see its exact pool here.':
    filters.query?'No rows match this search and the selected filters.':
    !current&&filters.mode!=='following'?'No current market sample in this scope. Open Coverage & method for source status.':
    'Nothing meets this screen in the current sample. Widen the filters'+(filters.mode==='active'?'.':' or try Active.');
   content='<p class="axo-desk-empty">'+esc(note)+'</p>'+(filters.query?'<button class="btn axo-desk-clear" type="button" data-desk-clear>Clear search</button>':'');
  }
  if(n>limit)content+='<button class="btn axo-desk-more" type="button" data-desk-more>Show '+Math.min(n-limit,pageSize)+' more</button>';
  const focused=document.activeElement,focusedKey=focused?.dataset.deskInspect||focused?.dataset.deskPick||focused?.dataset.deskSort;
  if(painted.get(rowsNode)!==content){
   rowsNode.innerHTML=content;
   painted.set(rowsNode,content);
   if(focusedKey&&focused.isConnected===false){
    const attr=focused.dataset.deskSort?'deskSort':focused.dataset.deskInspect?'deskInspect':'deskPick';
    const same=[...rowsNode.querySelectorAll('[data-desk-inspect],[data-desk-pick],[data-desk-sort]')].find(button=>button.dataset[attr]===focusedKey);
    (same||view.querySelector('[data-desk-query]')).focus({preventScroll:true});
   }
  }
  view.querySelector('[data-desk-result-count]').textContent=n+' '+prefix+(n>limit?' · showing '+limit:'');
 }
 function coverage(){
  if(!sample)return '';
  const rows=sample.chains.filter(c=>!filters.chain||c.chain===filters.chain);
  return '<p>'+esc(Desk.MODES[filters.mode].description)+'</p><ul class="axo-desk-coverage-list">'+rows.map(c=>{
   const valid=Desk.fresh(c.observedAt,Date.now()),status=valid?c.state==='current'?'Current':'Partial':'No current sample';
   const head=Desk.fresh(c.head?.observedAt,Date.now(),600000)?c.head:null;
   return '<li><strong>'+esc(c.name)+'</strong><span>'+esc(status)+' · '+(valid?c.current:0)+' pools · '+(valid?c.withActivity:0)+' with 5m trades · '+(valid?c.withUnique:0)+' with unique traders</span><small>'+
    esc(c.sources.map(s=>s.provider+' '+(s.id||'')+' '+(s.status==='available'&&!Desk.fresh(s.at,Date.now())?'stale':s.status)+(s.at?' ('+stamp(s.at)+')':'')).join(' · ')||'Waiting on sources')+'</small>'+
    (head?'<small>'+esc(head.provider)+' · '+esc(head.kind)+' '+esc(head.height.toLocaleString())+' read '+esc(stamp(head.observedAt))+'</small>':'')+'</li>';
  }).join('')+'</ul><p>Up to '+sample.limits.rowsPerChain+' projects per chain, drawn from top, new and retained pool samples. One current, usable pool per contract where available. Flow pulse counts reported buys and sells. Liquidity check uses pools that report both reserves and 24h turnover. Fast movers ranks the largest absolute 1h price changes.</p>';
 }
 function recentChanges(){
  const rows=(sample?.changes||[]).filter(e=>!filters.chain||e.chain===filters.chain).filter(e=>Desk.fresh(e.toAt,Date.now(),86400000));
  const followed=new Set(axoWatch.map(Desk.tokenKey));
  return [...rows].sort((a,b)=>Number(followed.has(Desk.tokenKey(b)))-Number(followed.has(Desk.tokenKey(a)))||b.toAt-a.toAt)
   .slice(0,3).map(e=>'<li><button class="btn" data-desk-change="'+esc(Desk.poolKey(e))+'">'+esc(e.symbol||'Pool')+'</button> '+esc(axoChainNames[e.chain])+' · '+esc(({liquidity:'Liquidity',price:'Price',volume24:'24h volume',holders:'Holders'})[e.metric]||e.metric)+' <strong class="'+tone(e.change)+'">'+esc(pct(e.change))+'</strong> · '+esc(stamp(e.toAt))+'</li>').join('');
 }
 function fields(){
  return '<div data-desk-market></div><div class="axo-desk-filters"><div class="axo-desk-modes" role="group" aria-label="Project screen">'+
   Object.entries(Desk.MODES).map(([key,m])=>'<button class="btn" type="button" data-desk-mode="'+key+'">'+esc(m.label)+'</button>').join('')+
   '</div><div class="axo-desk-filter-row"><label class="axo-desk-search"><span class="axo-desk-sr">Search sample</span>'+cardIcon('search')+'<input type="search" data-desk-query maxlength="120" placeholder="Ticker, token or pool address" autocomplete="off" aria-keyshortcuts="/"><kbd aria-hidden="true">/</kbd></label>'+
   '<details class="axo-desk-filter-menu" data-desk-threshold><summary class="btn" data-desk-filter-label>Filters</summary><div class="axo-desk-filter-options">'+
   '<label><span>Min. liquidity</span><select data-desk-liquidity>'+Desk.LIQUIDITY.map(x=>'<option value="'+x+'">'+esc(money(x))+'</option>').join('')+'</select></label>'+
   '<label title="Select Any cap to include pools without a reported circulating market cap."><span>Max. market cap</span><select data-desk-cap>'+Desk.CAPS.map(x=>'<option value="'+(x??'')+'">'+esc(x===null?'Any cap':money(x))+'</option>').join('')+'</select></label>'+
   '<label><span>Sort pools</span><select data-desk-sort-picker><option value="">Screen rank</option>'+Object.entries(Desk.SORTS).map(([id,label])=>'<option value="'+id+':desc">'+esc(label)+' ↓</option><option value="'+id+':asc">'+esc(label)+' ↑</option>').join('')+'</select></label>'+
   '<label class="axo-desk-screened"><input type="checkbox" data-desk-screened> Core checks only</label>'+
   '<button class="btn" type="button" data-desk-reset>Reset filters</button></div></details></div></div>'+
   '<details class="axo-desk-signals" data-desk-signals hidden><summary data-desk-signals-toggle><span>Market signals</span><small data-desk-signal-count></small></summary><div data-desk-signal-cards></div></details>'+
   '<div class="axo-desk-result-bar"><div><strong data-desk-result-count aria-live="polite"></strong><small data-desk-description></small><small data-desk-summary></small></div><div class="axo-desk-micro-actions"><button type="button" class="btn" data-desk-search-all hidden>Search more pools</button><button type="button" class="btn" data-desk-compare disabled>Compare</button><button type="button" class="btn" data-desk-refresh>Refresh</button></div></div>'+
   '<p class="axo-desk-error" data-desk-error role="status" hidden></p><div data-desk-results></div>'+
   '<div class="axo-desk-footer"><details><summary>Coverage &amp; method</summary><div data-desk-coverage></div></details><details><summary>Recent changes</summary><ul data-desk-changes></ul><button class="btn" type="button" data-desk-open="changes">All changes</button></details>'+
   '<button class="btn" type="button" data-desk-open="launchpads">Launchpads &amp; graduations</button><button class="btn" type="button" data-desk-open="paper">Paper trading</button><button class="btn" type="button" data-desk-context>More dashboard cards</button></div>';
 }
 function patchContent(node,markup){
  if(painted.get(node)===markup)return;
  const focus=document.activeElement;
  const key=focus&&node.contains(focus)&&['data-desk-chain','data-desk-chain-picker','data-desk-flow-window','data-desk-inspect',
   'data-chain-project','data-desk-rotation-link','data-rotation-window','data-rotation-chain'].find(name=>focus.hasAttribute(name));
  const value=key&&focus.getAttribute(key);
  node.innerHTML=markup;
  painted.set(node,markup);
  if(key)node.querySelector('['+key+'="'+CSS.escape(value)+'"]')?.focus({preventScroll:true});
  return true;
 }
 function rotationMethod(){
  const r=Desk.ROTATION_RULES,w=Desk.ROTATION_WINDOWS;
  return '<details class="axo-rotation-method"><summary>How it’s measured</summary>'+
   '<p>Each chain uses one current Trading Desk pool per token with at least '+esc(money(r.liquidity))+' liquidity. A comparable pool is old enough to cover the full baseline and reports price change and positive prior turnover. It must report '+esc(money(w.m5.minTurnover))+' volume over the full hour for 5m pace, or '+esc(money(w.h1.minTurnover))+' over 24h for 1h pace.</p>'+
   '<p>Pool pace compares recent turnover with the preceding average for the same duration. Chain pace is the median. A chain signal needs '+r.minPools+' comparable pools and at least '+share(r.coverage)+' sample coverage. Broadening needs '+multiple(r.broadPace)+' pace and '+share(r.upShare)+' advancing. Cooling needs '+r.coolPace+'× or less and '+share(r.coolUpShare)+' or fewer advancing. A pool with '+share(r.dominantShare)+' or more of turnover takes priority as concentrated.</p>'+
   '<p>USD trading turnover in the sampled pools. Coverage varies by chain and source.</p></details>';
 }
 function rotationRow(row,chain){
  const state=rotationStates[row.state][0],pressed=row.chain===chain;
  const meter=row.pace===null?'':'<span class="axo-rotation-meter" aria-hidden="true"><i style="--pace:'+Math.min(100,row.pace*25).toFixed(2)+'%"></i></span>';
  const participation=row.comparable?row.rising+'/'+row.comparable+'<small> up</small>':'—';
  const coverage=row.pools?row.comparable+'/'+row.pools+' comparable':'0 eligible pools';
  return '<button type="button" class="axo-rotation-row" data-rotation-chain="'+row.chain+'" data-scope-chain="'+row.chain+'" aria-pressed="'+pressed+'">'+
   '<span class="axo-rotation-network"><span class="axo-desk-chain-mark">'+chainMark(row.chain)+'</span><b>'+esc(axoChainNames[row.chain])+'</b></span>'+
   '<span class="axo-rotation-pace"><b>'+esc(multiple(row.pace))+'</b>'+meter+'</span>'+
   '<span class="axo-rotation-advancing">'+participation+'</span>'+
   '<span class="axo-rotation-state" data-state="'+row.state+'">'+state+'<small>'+coverage+'</small></span></button>';
 }
 function rotationDetails(chain,window){
  const [label,description]=rotationStates[chain.state];
  const times=chain.newestAt?'<time datetime="'+new Date(chain.newestAt).toISOString()+'" title="'+esc(asOf(chain.oldestAt)+' to '+asOf(chain.newestAt))+'">Latest '+esc(stamp(chain.newestAt))+'</time>':'';
  const drivers=chain.drivers.map(({project:p,delta,recent,pace},i)=>
   '<li><button type="button" data-desk-inspect="'+esc(Desk.poolKey(p))+'" aria-label="Inspect '+esc((p.symbol||p.name)+' on '+axoChainNames[p.chain])+'" aria-describedby="axoRotationDriver'+i+'">'+
   '<span><b>'+esc(p.symbol||p.name)+'</b><small>'+esc(p.dex||p.provider||'Pool')+'</small></span><span id="axoRotationDriver'+i+'"><b class="'+tone(delta)+'">'+esc(moneyDelta(delta))+'</b><small>'+esc(money(recent))+' vol · '+esc(multiple(pace))+'</small></span><span aria-hidden="true">↗</span></button></li>').join('');
  return '<section class="axo-rotation-details" aria-label="'+esc(axoChainNames[chain.chain]+' rotation drivers')+'">'+
   '<div class="axo-rotation-detail-head"><h3>'+esc(axoChainNames[chain.chain])+'</h3><span class="axo-rotation-state" data-state="'+chain.state+'">'+label+'</span></div>'+
   '<p>'+description+'</p><div class="axo-rotation-reading"><span>Largest pool share <b>'+share(chain.concentration)+'</b></span>'+times+'</div>'+
   (drivers?'<h4>Pool drivers <small>'+window.label+' volume vs. preceding rate</small></h4><ol class="axo-rotation-drivers" role="list">'+drivers+'</ol>':
    '<p class="axo-rotation-empty">Comparable pool activity is unavailable for this window.</p>')+'</section>';
 }
 function rotationMarkup(now){
  if(!sample)return '<p class="axo-rotation-empty" role="status">'+(error?'Trading Desk sample is unavailable. Use Refresh above to try again.':'Loading the Trading Desk sample…')+'</p>';
  const {chains,window}=Desk.rotation(sample.rows,now,rotationWindow),interval=Desk.ROTATION_WINDOWS[window];
  const chain=chains.find(row=>row.chain===rotationChain)||chains.find(row=>!['limited','empty'].includes(row.state))||
   chains.find(row=>row.comparable)||chains.find(row=>row.pools)||chains[0];
  const controls=Object.entries(Desk.ROTATION_WINDOWS).map(([id,w])=>
   '<button class="btn" type="button" data-rotation-window="'+id+'" aria-pressed="'+(window===id)+'">'+w.label+'</button>').join('');
  return '<div class="axo-rotation-toolbar"><span><b>'+interval.label+' turnover pace</b><small>vs. the preceding '+interval.prior+' rate</small></span>'+
   '<div role="group" aria-label="Rotation window">'+controls+'</div></div>'+
   '<div class="axo-rotation-grid"><div><div class="axo-rotation-labels" aria-hidden="true"><span>Chain</span><span>Median pace</span><span>Rising</span><span>Sample signal</span></div>'+
   '<div class="axo-rotation-chains" role="group" aria-label="Select a chain to inspect its pools">'+chains.map(row=>rotationRow(row,chain.chain)).join('')+'</div>'+
   '<small class="axo-rotation-key">Pace scale 0–4× · vertical mark at 1×</small></div>'+rotationDetails(chain,interval)+'</div>';
 }
 function paintRotation(now=Date.now()){
  const view=rotationRoot();
  if(view&&patchContent(view,rotationMarkup(now)))requestAnimationFrame(layout);
 }
 function chainSignalMarkup(data){
  if(!data)return;
  const now=Date.now();
  const rows=data.pools.filter(p=>p.id&&p.address&&p.pair&&p.liquidity>=axoLiquidity&&!p.curve&&chInLens(p)&&axoSuggestedProject(p)).map(project=>({
   project,
   quality:data.status==='stale'?'stale':AxoMarketIntel.quality(project,now).status,
   risk:axoRiskState(project)
  }));
  return signalCards(Desk.signals(rows,now,flowWindow),true);
 }
 function paintChainSignals(){
  if(!axoChainScope()||chView()!=='overview')return;
  const target=$('board').querySelector('[data-chain-signal-cards]'),data=target&&chData();
  if(data&&patchContent(target,chainSignalMarkup(data)))requestAnimationFrame(()=>layout());
 }
 function paint(){
  const view=root();
  const now=Date.now();
  paintRotation(now);
  const followThrough=dialog.querySelector('[data-desk-follow-through]');
  if(dialog.open&&inspected&&followThrough)patchContent(followThrough,followThroughMarkup(inspected));
  if(view!==mounted){
   deskResize.disconnect();mounted=view;
   if(view)deskResize.observe(view);
  }
  if(!view)return;
  if(!view.firstElementChild)view.innerHTML=fields();
  patchContent(view.querySelector('[data-desk-market]'),overview());
  for(const button of view.querySelectorAll('[data-desk-mode]'))button.setAttribute('aria-pressed',String(button.dataset.deskMode===filters.mode));
  const field=view.querySelector('[data-desk-query]');
  if(document.activeElement!==field)field.value=filters.query;
  view.querySelector('[data-desk-liquidity]').value=String(filters.liquidity);
  view.querySelector('[data-desk-cap]').value=String(filters.maxCap??'');
  view.querySelector('[data-desk-screened]').checked=filters.screened;
  view.querySelector('[data-desk-sort-picker]').value=filters.sort?filters.sort+':'+filters.direction:'';
  const following=filters.mode==='following';
  for(const input of view.querySelectorAll('[data-desk-liquidity],[data-desk-cap],[data-desk-screened]'))input.closest('label').hidden=following;
  const defaults=Desk.criteria(),overrides=(following?['sort']:['liquidity','maxCap','screened','sort']).filter(key=>defaults[key]!==filters[key]).length;
  view.querySelector('[data-desk-filter-label]').textContent='Filters'+(overrides?' ('+overrides+')':'');
  view.querySelector('[data-desk-reset]').disabled=!overrides;
  const orderHint=filters.sort?'Sorted by '+(filters.sort==='volume'?funds[filters.mode]:Desk.SORTS[filters.sort].toLowerCase()):null;
  view.querySelector('[data-desk-description]').textContent=orderHint?orderHint+(filters.direction==='asc'?', low to high':', high to low'):Desk.MODES[filters.mode].description;
  view.querySelector('[data-desk-summary]').textContent=orderHint||Desk.MODES[filters.mode].summary;
  const compare=view.querySelector('[data-desk-compare]');
  compare.hidden=!picked.size;compare.disabled=picked.size<2;compare.textContent='Compare'+(picked.size?' ('+picked.size+')':'');
  view.querySelector('[data-desk-search-all]').hidden=!filters.query;
  view.querySelector('[data-desk-refresh]').disabled=loading;
  const failure=view.querySelector('[data-desk-error]');failure.hidden=!error||!sample;failure.textContent=error;
  patchContent(view.querySelector('[data-desk-coverage]'),coverage());
  patchContent(view.querySelector('[data-desk-changes]'),recentChanges()||'<li>No dated changes in this sample yet.</li>');
  view.querySelector('[data-desk-context]').textContent=showAll?'Fewer dashboard cards':'More dashboard cards';
  const rows=rowsForView(now),signals=view.querySelector('[data-desk-signals]');
  signals.hidden=!sample||following||!rows.length;
  if(!signals.hidden){
   signals.open=!compactSignals.matches||signalsExpanded;
   const evidence=Desk.signals(rows,now,flowWindow),{trades}=evidence;
   signals.querySelector('[data-desk-signal-count]').textContent=trades.buyShare===null?rows.length+(rows.length===1?' pool':' pools')
    :Math.round(trades.buyShare*100)+'% buys · '+Desk.FLOW_WINDOWS[trades.window];
   patchContent(view.querySelector('[data-desk-signal-cards]'),signalCards(evidence));
  }
  paintTable(view,rows);
 }

 function detailMetric(label,value){
  return '<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>';
 }
 function tradeCounts(tx){
  return Number.isFinite(tx?.buys)&&Number.isFinite(tx?.sells)?count(tx.buys)+' buys / '+count(tx.sells)+' sells':'—';
 }
 function followThroughMarkup(row){
  const {state,m5,h1,sustained}=Desk.followThrough(row,Date.now());
  const labels={building:'Building across both windows',fading:'Short-term activity fading',burst:'Short burst',mixed:'Mixed activity',incomplete:'Limited comparable history',unavailable:'Current evidence unavailable'};
  if(state==='unavailable')return '<section class="axo-desk-follow-through"><h3>Pool follow-through</h3><p>'+labels[state]+'</p></section>';
  const metric=(w,result)=>detailMetric(w.label+' vs. prior '+w.prior,result?multiple(result.pace)+' pace · '+pct(result.change)+' price':'—');
  return '<section class="axo-desk-follow-through"><h3>Pool follow-through</h3><p>'+labels[state]+'</p>'+
   '<dl class="axo-desk-metrics">'+metric(Desk.ROTATION_WINDOWS.m5,m5)+metric(Desk.ROTATION_WINDOWS.h1,h1)+'</dl>'+
   (sustained?'<small>Short-term pace held across three spaced observations.</small>':'')+'</section>';
 }
 function watchLabel(project){
  return axoWatch.some(p=>Desk.tokenKey(p)===Desk.tokenKey(project))?'Following':'Follow';
 }
 function evidenceExpiry(execution){
  const max=execution?.status==='simulated-route-observed'?300000:30000;
  return Math.min((execution?.at||0)+max,execution?.expiresAt||Infinity);
 }
 function checkMarkup(){
  if(!check)return '<p>Entry and exit evidence has not been checked for this session.</p>';
  if(check.loading)return '<p>Checking exact-pool evidence…</p>';
  if(check.error)return '<p>'+esc(check.error)+'</p>';
  const result=check.value;
  if(result.status==='queued')return '<p>Evidence is queued. Check again shortly.</p>';
  if(result.riskExcluded)return '<p><strong>Severe risk flag reported. Swap review is disabled for this pool.</strong></p>'+
   (result.gaps?.length?'<ul>'+result.gaps.slice(0,4).map(g=>'<li>'+esc(g)+'</li>').join('')+'</ul>':'');
  const x=result.execution;
  const now=Date.now(),recent=Number.isFinite(x?.at)&&x.at<=now&&evidenceExpiry(x)>now;
  const status=recent?({'simulated-route-observed':'Buy and sell simulated','quoted-route-observed':'Entry and exit quotes observed'})[x.status]:null;
  return '<p><strong>'+esc(status||'Current entry and exit evidence unavailable')+'</strong>'+
   (recent&&x.source?' · '+esc(x.source)+' · '+esc(stamp(x.at)):'')+'</p>'+
   (recent&&Number.isFinite(x.buyTax)&&Number.isFinite(x.sellTax)?'<p>Simulated taxes '+esc(pct(x.buyTax))+' buy / '+esc(pct(x.sellTax))+' sell.</p>':'')+
   (result.entry?.reason?'<p>'+esc(result.entry.reason)+'</p>':'')+
   (recent&&x.status==='quoted-route-observed'?'<p>The provider quoted token routes at a test size. The selected pool is market context. Review an actual amount in the swap form.</p>':'')+
   (result.gaps?.length?'<ul>'+result.gaps.slice(0,4).map(g=>'<li>'+esc(g)+'</li>').join('')+'</ul>':'');
 }
 function inspectMarkup(row){
  const p=row.project,a=row.activity,badge=currentBadge(row),h=row.holders;
  const key=Desk.poolKey(p),identity=esc(key);
  const holderFresh=h&&Desk.fresh(h.at,Date.now());
  const projectId='desk:'+key;
  axoProjectMap.set('project-'+projectId,{...p,id:projectId});
  const concentration=holderFresh&&h.concentration?count(h.concentration.addresses)+' addresses · '+(h.concentration.share*100).toFixed(1)+'%':'—';
  const marketSource=p.provider?esc(p.provider)+' · '+esc(asOf(p.seenAt)):'Source date unavailable';
  const execution=row.execution&&Desk.fresh(row.execution.at,Date.now())?row.execution:null;
  return '<header><div><h2 id="axoDeskDialogTitle">'+esc(p.name||p.symbol)+'</h2><p>'+esc(p.symbol)+' · '+esc(axoChainNames[p.chain])+(p.dex?' · '+esc(p.dex):'')+'</p></div><button class="btn" type="button" data-desk-close aria-label="Close project review">×</button></header>'+
   '<div class="axo-desk-dialog-status"><span class="axo-desk-badge '+badge.className+'">'+esc(badge.label)+'</span><small>'+marketSource+'</small></div>'+
   '<dl class="axo-desk-metrics">'+detailMetric('Price',axoCardPrice(p.price))+detailMetric('Pool liquidity',money(p.liquidity))+detailMetric('Market cap',money(p.marketCap))+detailMetric('FDV',money(p.fdv))+
   detailMetric('5m change',pct(p.changes?.m5))+detailMetric('1h change',pct(p.change1))+detailMetric('24h change',pct(p.change24))+detailMetric('Pool age',p.createdAt?age(p.createdAt):'—')+
   detailMetric('5m volume',money(p.volume5))+detailMetric('1h volume',money(p.volume1))+detailMetric('5m trades',tradeCounts(p.transactions?.m5))+
   detailMetric('Unique traders (5m / 1h)',count(a.unique5)+' / '+count(a.unique1))+detailMetric('Holder addresses',holderFresh?count(h.count):'—')+
   detailMetric('Top holder share',concentration)+detailMetric('Comparable liquidity change',Number.isFinite(a.liquidityChange)?pct(a.liquidityChange)+' since '+stamp(a.baselineAt):'—')+
   detailMetric('Launchpad',row.origin||'Unverified')+'</dl>'+
   '<div data-desk-follow-through>'+followThroughMarkup(row)+'</div>'+
   (holderFresh?'<p class="axo-desk-detail-note">GoPlus · '+esc(asOf(h.at))+' · Concentration can include pool, burn and locked addresses.</p>':'')+
   (row.risk?.reasons?.length||row.cautions?.length?'<ul class="axo-desk-cautions">'+[...(row.risk.reasons||[]),...(row.cautions||[])].map(c=>'<li>'+esc(c)+'</li>').join('')+'</ul>':'')+
   '<section class="axo-desk-check"><div><h3>Entry &amp; exit evidence</h3><button type="button" class="btn" data-desk-check '+(check?.loading||row.risk?.excluded?'disabled':'')+'>'+(check?'Check again':'Check entry & exit')+'</button></div>'+
   (execution?'<p>'+esc(({restriction:'Sell restriction reported',simulated:'Dated buy and sell simulation',inconclusive:'Simulation inconclusive'})[execution.status])+' · '+esc(execution.source||'')+' · '+esc(stamp(execution.at))+'</p>':'')+
   '<div data-desk-check-result aria-live="polite">'+checkMarkup()+'</div></section>'+
   '<details class="axo-desk-identity"><summary>Contract &amp; pool</summary>'+
   '<div class="axo-desk-id-row"><p>Contract <code>'+esc(p.address)+'</code></p><button class="btn" type="button" data-desk-copy="address">Copy contract</button></div>'+
   '<div class="axo-desk-id-row"><p>Pool <code>'+esc(p.pair)+'</code></p><button class="btn" type="button" data-desk-copy="pair">Copy pool</button></div>'+
   '<label data-desk-manual-copy hidden>Address <input type="text" readonly></label><small data-desk-copy-status role="status"></small>'+
   (/^https:\/\/(?:dexscreener\.com|www\.geckoterminal\.com)\//i.test(p.url||'')?'<a href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer">Open market source ↗</a>':'')+
   '<button class="btn" type="button" data-desk-contract>Check on-chain facts</button><div data-desk-contract-result aria-live="polite"></div></details>'+
   '<footer><button class="btn" type="button" data-desk-project="'+identity+'">Open project &amp; chart</button><button class="btn" type="button" data-watch="'+esc(projectId)+'">'+watchLabel(p)+'</button>'+
   '<button class="btn" type="button" data-pc-alert="'+esc(projectId)+'">Set alert</button>'+
   '<button class="btn axo-desk-primary" type="button" data-desk-review="'+identity+'" '+(row.risk?.excluded?'disabled':'')+'>Review swap</button></footer>';
 }
 async function copyIdentity(key){
  const project=inspected?.project,value=project?.[key];
  if(!value)return;
  const manual=dialog.querySelector('[data-desk-manual-copy]');
  const status=dialog.querySelector('[data-desk-copy-status]');
  try{
   await navigator.clipboard.writeText(value);
   if(!manual.isConnected||!dialog.open)return;
   manual.hidden=true;
   status.textContent=key==='address'?'Contract copied.':'Pool copied.';
  }catch{
   if(!manual.isConnected||!dialog.open)return;
   const input=manual.querySelector('input');
   input.value=value;
   manual.hidden=false;
   input.focus();
   input.select();
   status.textContent='Address selected for copying.';
  }
 }
 function compareMarkup(){
  return '<header><div><h2 id="axoDeskDialogTitle">Compare pools</h2><p>Separate exact pools and source times</p></div><button class="btn" type="button" data-desk-close aria-label="Close comparison">×</button></header>'+
   '<div class="axo-desk-compare-grid">'+[...picked].map(([key,original])=>{
    const row=rowFor(key)||original,p=row.project,b=currentBadge(row);
    return '<section><h3>'+esc(p.symbol||p.name)+'</h3><p>'+esc(axoChainNames[p.chain])+' · '+esc(p.provider||'Source unknown')+' · '+esc(stamp(p.seenAt))+'</p><span class="axo-desk-badge '+b.className+'">'+esc(b.label)+'</span>'+
     '<dl>'+detailMetric('Liquidity',money(p.liquidity))+detailMetric('Market cap',money(p.marketCap))+detailMetric('1h volume',money(p.volume1))+
     detailMetric('5m / 1h / 24h',pct(p.changes?.m5)+' / '+pct(p.change1)+' / '+pct(p.change24))+
     detailMetric('5m trades',tradeCounts(p.transactions?.m5))+detailMetric('Unique traders · 5m',count(row.activity.unique5))+'</dl>'+
     '<button class="btn" type="button" data-desk-inspect="'+esc(key)+'">Inspect '+esc(p.symbol||p.name)+'</button> <button class="btn" type="button" data-desk-pick="'+esc(key)+'">Remove</button></section>';
   }).join('')+'</div>';
 }
 function show(content){
  dialog.innerHTML=content;
  if(!dialog.open){returnFocus=document.activeElement;dialog.showModal();}
  dialog.querySelector('[data-desk-close]')?.focus({preventScroll:true});
 }
 function showInspect(row){
  checkRequest?.abort();contractRequest?.abort();contractRequest=null;
  clearTimeout(checkExpiry);
  mode='inspect';inspected=row;check=null;
  show(inspectMarkup(row));
 }
 function contractMarkup(d){
  if(!d||!Desk.fresh(d.observedAt,Date.now(),300000))return '<p>Current on-chain facts unavailable.</p>';
  const basis=esc(d.provider)+' · '+(d.kind==='mint'?'finalized slot':'block')+' '+esc(d.height.toLocaleString())+' · '+esc(asOf(d.observedAt));
  if(d.status==='unconfirmed')return '<p>Contract or mint could not be confirmed at this observation.</p><small>'+basis+'</small>';
  if(d.status!=='available')return '<p>Current on-chain facts unavailable.</p>';
  const mint=d.kind==='mint';
  const metadata=d.metadata?[d.metadata.name,d.metadata.symbol].filter(Boolean).join(' · '):'';
  return '<p><b>'+ (mint?'Initialized SPL mint':'Contract bytecode observed')+'</b></p><small>'+basis+'</small>'+
   '<p>Decimals '+esc(d.decimals??'Unknown')+' · Total issued supply '+esc(d.amount??'Unknown')+'</p>'+
   (metadata?'<p title="'+esc(asOf(d.metadata.observedAt))+'">Alchemy Token API · '+esc(metadata)+'</p>':'')+
   (mint?'<p>Mint authority '+esc(d.mintAuthority)+' · Freeze authority '+esc(d.freezeAuthority)+'</p>':'');
 }
 async function inspectContract(button){
  if(!inspected||contractRequest)return;
  const p=inspected.project,request=new AbortController();
  contractRequest=request;
  const result=dialog.querySelector('[data-desk-contract-result]');
  button.disabled=true;result.textContent='Reading exact token from mainnet…';
  try{
   const query=new URLSearchParams({chain:p.chain,address:p.address,pool:p.pair});
   const response=await fetch('/api/trading-desk/contract?'+query,{signal:AbortSignal.any([request.signal,AbortSignal.timeout(35000)])});
   const value=await response.json();
   if(!response.ok)throw Error(value.error||'Current on-chain facts unavailable.');
   if(!value.identity||Desk.poolKey(value.identity)!==Desk.poolKey(p))throw Error('The on-chain response did not match the selected pool.');
   if(!request.signal.aborted)result.innerHTML=contractMarkup(value.evidence);
  }catch(error){
   if(!request.signal.aborted)result.textContent=error.name==='TimeoutError'?'On-chain read timed out. Try again shortly.':error.message;
  }finally{
   if(contractRequest===request){contractRequest=null;button.disabled=false;}
  }
 }
 async function preflight(){
  const row=inspected;
  if(!row||row.risk?.excluded||check?.loading)return;
  const identity=row.project;
  const control=new AbortController();checkRequest=control;check={loading:true};clearTimeout(checkExpiry);
  const button=dialog.querySelector('[data-desk-check]'),result=dialog.querySelector('[data-desk-check-result]');
  button.disabled=true;result.innerHTML=checkMarkup();
  try{
   const query=new URLSearchParams({chain:identity.chain,address:identity.address,pool:identity.pair});
   const signal=AbortSignal.any([control.signal,AbortSignal.timeout(18000)]);
   let value;
   for(const delay of [0,2500,4000]){
    if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
    signal.throwIfAborted();
    const response=await fetch('/api/trade-setup?'+query,{signal});
    if(!response.ok)throw Error('Entry and exit evidence is unavailable.');
    value=await response.json();
    if(!value.identity||Desk.poolKey(value.identity)!==Desk.poolKey(identity))throw Error('The evidence did not match the selected pool.');
    if(value.status!=='queued')break;
   }
   if(!control.signal.aborted){
    check={value};
    if(value.riskExcluded)dialog.querySelector('[data-desk-review]').disabled=true;
    const until=evidenceExpiry(value.execution)-Date.now();
    if(until>0)checkExpiry=setTimeout(()=>{if(inspected===row&&dialog.open)result.innerHTML=checkMarkup();},until+20);
   }
  }catch(error){
   if(!control.signal.aborted)check={error:error.name==='TimeoutError'?'The evidence request timed out. Check again shortly.':error.message};
  }finally{
   if(!control.signal.aborted&&inspected===row){
    button.disabled=false;button.textContent='Check again';result.innerHTML=checkMarkup();checkRequest=null;
   }
  }
 }
 function openDesk(chain){
  setFilters({chain});
  if(axoStream.type!=='home')axoGoStream({type:'home'});
  requestAnimationFrame(()=>{
   const element=root()?.closest('.card');
   if(element){element.scrollIntoView({block:'start'});element.querySelector('[data-desk-query]')?.focus({preventScroll:true});}
  });
 }
 dialog.addEventListener('close',()=>{
  if(dialog.open)return;
  checkRequest?.abort();contractRequest?.abort();clearTimeout(checkExpiry);checkRequest=null;contractRequest=null;inspected=null;check=null;
  if(!tradeDialog.open)returnFocus?.focus?.({preventScroll:true});
  returnFocus=null;
 });
 dialog.addEventListener('click',event=>{
  if(event.target.closest('[data-pc-alert]'))dialog.close();
  if(event.target.closest('[data-watch]'))requestAnimationFrame(()=>{
   if(inspected&&dialog.open)dialog.querySelector('[data-watch]').textContent=watchLabel(inspected.project);
  });
 });
 document.addEventListener('input',event=>{
  if(!event.target.matches('[data-desk-query]'))return;
  clearTimeout(searchTimer);const query=event.target.value;
  searchTimer=setTimeout(()=>setFilters({query}),125);
 });
 document.addEventListener('keydown',event=>{
  if(event.key!=='/'||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||
     event.target.closest?.('input,textarea,select,[contenteditable]')||modalOpen||document.querySelector('dialog[open]'))return;
  const search=root()?.querySelector('[data-desk-query]');
  if(search?.getClientRects().length){event.preventDefault();search.focus();}
 });
 document.addEventListener('change',event=>{
  const el=event.target;
  if(el.matches('[data-desk-chain-picker]'))setFilters({chain:el.value||null});
  if(el.matches('[data-desk-liquidity]'))setFilters({liquidity:Number(el.value)});
  if(el.matches('[data-desk-cap]'))setFilters({maxCap:el.value?Number(el.value):null});
  if(el.matches('[data-desk-screened]'))setFilters({screened:el.checked});
  if(el.matches('[data-desk-sort-picker]')){
   const [sort,direction]=el.value.split(':');
   setFilters({sort,direction});
  }
 });
 document.addEventListener('click',event=>{
  if(compactSignals.matches&&event.target.closest('[data-desk-signals-toggle]')){
   signalsExpanded=!event.target.closest('[data-desk-signals]').open;
   return;
  }
  const button=event.target.closest('button');
  if(!button)return;
  if(button.hasAttribute('data-desk-mode'))setFilters({mode:button.dataset.deskMode});
  else if(button.hasAttribute('data-desk-reset')){
   const {liquidity,maxCap,screened,sort,direction}=Desk.criteria();
   setFilters(filters.mode==='following'?{sort,direction}:{liquidity,maxCap,screened,sort,direction});
  }
  else if(button.hasAttribute('data-desk-sort')){
   const key=button.dataset.deskSort,same=filters.sort===key;
   setFilters({sort:same&&filters.direction==='asc'?null:key,direction:same&&filters.direction==='desc'?'asc':'desc'});
  }
  else if(button.hasAttribute('data-desk-clear')){
   clearTimeout(searchTimer);setFilters({query:''});root()?.querySelector('[data-desk-query]')?.focus();
  }
  else if(button.hasAttribute('data-desk-flow-window')){
   flowWindow=button.dataset.deskFlowWindow;
   if(axoStream.type==='chain')paintChainSignals();else paint();
  }
  else if(button.hasAttribute('data-rotation-window')){rotationWindow=button.dataset.rotationWindow;paintRotation();}
  else if(button.hasAttribute('data-rotation-chain')){rotationChain=button.dataset.rotationChain;paintRotation();}
  else if(button.hasAttribute('data-desk-rotation-link')){
   const card=rotationRoot()?.closest('.card'),heading=card?.querySelector('h2');
   if(heading){
    heading.tabIndex=-1;
    card.scrollIntoView({block:'start'});
    heading.focus({preventScroll:true});
   }
  }
  else if(button.hasAttribute('data-desk-chain'))setFilters({chain:button.dataset.deskChain||null});
  else if(button.hasAttribute('data-desk-entry'))openDesk(axoStream.chain||null);
  else if(button.hasAttribute('data-desk-more')){limit+=pageSize;paint();}
  else if(button.hasAttribute('data-desk-refresh'))void poll(true);
  else if(button.hasAttribute('data-desk-check'))void preflight();
  else if(button.hasAttribute('data-desk-contract'))void inspectContract(button);
  else if(button.hasAttribute('data-desk-copy'))void copyIdentity(button.dataset.deskCopy);
  else if(button.hasAttribute('data-desk-close'))dialog.close();
  else if(button.hasAttribute('data-desk-inspect')){const row=rowFor(button.dataset.deskInspect);if(row)showInspect(row);}
  else if(button.hasAttribute('data-desk-project')||button.hasAttribute('data-desk-review')){
   const row=rowFor(button.dataset.deskProject||button.dataset.deskReview)||inspected;
   if(!row)return;
   if(button.hasAttribute('data-desk-review')&&(row.risk?.excluded||check?.value?.riskExcluded))return;
   dialog.close();
   if(button.hasAttribute('data-desk-project'))axoOpenProjectStream(row.project);
   else axoTradeModal(row.project);
  }else if(button.hasAttribute('data-desk-change')){
   const row=rowFor(button.dataset.deskChange);
   const change=sample?.changes.find(e=>Desk.poolKey(e)===button.dataset.deskChange);
   if(row)showInspect(row);else if(change)axoOpenProjectStream({...change,pair:change.pool});
  }else if(button.hasAttribute('data-desk-pick')){
   const key=button.dataset.deskPick,row=rowFor(key);
   if(picked.has(key))picked.delete(key);
   else if(picked.size<3&&row)picked.set(key,row);
   else if(row)toast('Compare up to three pools at a time.');
   paint();
   if(dialog.open&&mode==='compare'){
    if(picked.size<2)dialog.close();else show(compareMarkup());
   }
  }else if(button.hasAttribute('data-desk-compare')&&picked.size>=2){mode='compare';show(compareMarkup());}
  else if(button.hasAttribute('data-desk-search-all')&&filters.query)void find(filters.query);
  else if(button.hasAttribute('data-desk-open')){
   const type=button.dataset.deskOpen;
   axoGoStream({type,chain:['changes','launchpads'].includes(type)?filters.chain:null});
  }
  else if(button.hasAttribute('data-desk-context')){
   showAll=!showAll;
   if(showAll)axoIntel.more.add(axoAttachedScope());else axoIntel.more.delete(axoAttachedScope());
   window.axoLayoutHold?.reset();render(true);
  }
 });
 async function poll(force=false){
  if(loading||document.hidden||axoStream.type!=='home'||!force&&Date.now()-startedAt<40000)return;
  loading=true;startedAt=Date.now();paint();
  try{
   const response=await fetch('/api/trading-desk',{signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw Error();
   const value=await response.json();
   if(!Array.isArray(value.rows)||value.chains?.length!==5)throw Error();
   sample=value;error='';
  }catch{error='Trading Desk refresh unavailable. Source times are retained.';}
  finally{loading=false;paint();}
 }
 const extra=axoExtraCards;
 axoExtraCards=function(){
  const cards=extra();
  if(axoStream.type==='home'){
   cards.push([id,shell(id,'Trading Desk','Five-chain pool research','<div data-trading-desk></div>','','axo-trading-desk')],
    [rotationId,shell(rotationId,'Chain Rotation','Short-term market breadth','<div data-chain-rotation></div>'+rotationMethod(),'','axo-chain-rotation')]);
  }
  return cards;
 };
 const streamCards=axoStreamDataCards;
 axoStreamDataCards=function(){
  const cards=streamCards();
  if(axoChainScope()&&chView()==='overview'&&!hidden.includes(chId('market-signals'))){
   const overview=cards.findIndex(([key])=>key===chId('overview'));
   if(overview>=0)cards.splice(overview+1,0,chCard('market-signals','Market signals','Activity in this chain’s filtered pool sample','<div class="axo-chain-signal-cards" data-chain-signal-cards>'+chainSignalMarkup(chData())+'</div>','Exact pool observations'));
  }
  return cards;
 };
 const visible=axoStreamCardVisible;
 axoStreamCardVisible=key=>key===id||key===rotationId?axoStream.type==='home':visible(key);
 const order=axoOrderCards;
 axoOrderCards=function(cards){
  if(axoChainScope()&&chView()==='overview'){
   const signalId=chId('market-signals'),signal=cards.find(([key])=>key===signalId);
   if(signal){
    const ordered=order(cards.filter(([key])=>key!==signalId));
    const overview=ordered.findIndex(([key])=>key===chId('overview'));
    const pinned=ordered.filter(([key])=>pins.includes(key)).length;
    ordered.splice(pins.includes(signalId)?pinned:Math.max(pinned,overview+1),0,signal);
    return ordered;
   }
  }
  if(axoStream.type==='paper'&&Date.now()>=manualUntil){
   const priority=['overview','strategies','positions','daily','evaluation','equity','decisions','fills','policy'];
   const rank=key=>pins.includes(key)?-1:priority.includes(key.replace('stream-data-paper-',''))?priority.indexOf(key.replace('stream-data-paper-','')):20;
   return order(cards).sort((a,b)=>rank(a[0])-rank(b[0]));
  }
  if(axoStream.type!=='home')return order(cards);
  const desk=cards.find(([key])=>key===id),rotation=cards.find(([key])=>key===rotationId);
  const leading=[desk,rotation].filter(card=>card&&!pins.includes(card[0]));
  const ordered=order(cards.filter(card=>!leading.includes(card)));
  let shown=ordered;
  if(!showAll&&Date.now()>=manualUntil){
   let context=0;
   shown=ordered.filter(([key])=>pins.includes(key)||key.startsWith('request-')||key.startsWith('stream-data-attached-')||key==='stream-data-pulse'||key.startsWith('project-')||key==='stream-data-focus-more'||++context<=3);
  }
  shown.splice(shown.filter(([key])=>pins.includes(key)).length,0,...leading);
  return shown;
 };
 const entry=document.createElement('button');
 entry.className='btn axo-desk-entry';entry.type='button';entry.dataset.deskEntry='';entry.textContent='Trading Desk';
 document.querySelector('.stream-heading')?.append(entry);
 const renderBase=render;
 render=function(...args){
  const result=renderBase(...args);
  entry.hidden=!['chain','discovery','watchlist'].includes(axoStream.type);
  if(axoStream.type==='home'){paint();void poll();}
  return result;
 };
 setInterval(()=>{paint();paintChainSignals();void poll();},40000);
 render(true);
})();
