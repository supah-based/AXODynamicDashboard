/* The home desk uses the shared public sample. Following stays in this browser's workspace. */
(function(){
 const Desk=AxoTradingDesk;
 const id='stream-data-action-desk',storageKey='axo-trading-desk-v1',pageSize=8;
 const picked=new Map(),painted=new WeakMap();
 let filters=Desk.criteria(axoReadJson(storageKey,{})||{}),sample=null,loading=false,error='',startedAt=0,limit=pageSize,showAll=false;
 let searchTimer=0,checkExpiry=0,returnFocus=null,inspected=null,check=null,checkRequest=null,contractRequest=null,mode='inspect',mounted=null;
 const dollars=new Intl.NumberFormat(undefined,{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1});
 const integer=new Intl.NumberFormat(undefined,{notation:'compact',maximumFractionDigits:1});
 const money=value=>Number.isFinite(value)?dollars.format(value):'—';
 const count=value=>Number.isFinite(value)?integer.format(value):'—';
 const pct=value=>Number.isFinite(value)?(value>0?'+':'')+value.toFixed(1)+'%':'—';
 const tone=value=>!Number.isFinite(value)||value===0?'':value>0?'gain':'loss';
 const stamp=at=>at?age(at):'unknown';
 const asOf=at=>at?new Date(at).toLocaleString():'Unknown';
 const funds={active:'1h volume',momentum:'5m volume',new:'1h volume',rebound:'1h volume',following:'1h volume'};
 const root=()=>$('board').querySelector('[data-trading-desk]');
 const deskResize=new ResizeObserver(()=>requestAnimationFrame(layout));
 const dialog=document.createElement('dialog');
 dialog.className='axo-desk-dialog';
 document.body.append(dialog);
 dialog.setAttribute('aria-labelledby','axoDeskDialogTitle');
 titles[id]='Trading Desk';

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
 function rowsForView(){
  const rows=sample?.rows||[],following=filters.mode==='following';
  const watched=new Set(axoWatch.map(Desk.tokenKey));
  return Desk.select(following?watchRows(rows):rows,filters,Date.now(),watched);
 }
 function rowFor(key){
  return (sample?.rows||[]).find(row=>Desk.poolKey(row.project)===key)
   ||watchRows([]).find(row=>Desk.poolKey(row.project)===key)||picked.get(key)||null;
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
   const spread=volume&&Number.isFinite(volume.change24)?'<strong class="'+tone(volume.change24)+'">'+esc(pct(volume.change24))+'</strong>':'<strong>—</strong>';
   const status=fresh?c.current+' current':c.observedAt?'Sample dated':'No current sample';
   return '<button type="button" class="axo-desk-chain" data-desk-chain="'+esc(c.chain)+'" aria-pressed="'+selected+'" title="'+esc('DEX volume 24h change · '+(volume?.source||'unavailable')+' · '+status)+'"><span>'+esc(c.name)+'</span>'+spread+'<small>'+esc(status)+'</small></button>';
  });
  return '<div class="axo-desk-marketline">'+bitcoin+'<span><small>Chain DEX volume change · 24h</small></span><button class="btn" type="button" data-desk-open="news">News &amp; narratives</button></div><div class="axo-desk-chains" role="group" aria-label="Trading Desk chain">'+
   '<button type="button" class="axo-desk-chain all" data-desk-chain="" aria-pressed="'+!filters.chain+'"><span>All chains</span><small>'+sample.chains.filter(c=>Desk.fresh(c.observedAt,Date.now())).length+' / 5 current</small></button>'+networks.join('')+'</div>';
 }
 function currentBadge(row){
  const risk=row.risk;
  if(risk?.excluded)return {label:risk.label||'Severe flag',className:'danger'};
  if(row.outside||!Desk.fresh(row.project.seenAt,Date.now())||row.quality==='stale')return {label:row.outside?'Outside current sample':'Dated market',className:'neutral'};
  if(row.quality!=='current')return {label:'Market needs review',className:'caution'};
  if(!risk?.fresh||!Desk.fresh(risk.observedAt,Date.now()))return {label:'Checks incomplete',className:'neutral'};
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
  const logo=p.imageUrl?'<img src="'+esc(p.imageUrl)+'" alt="" loading="lazy" referrerpolicy="no-referrer">':'<span aria-hidden="true">'+esc((p.symbol||p.name||'?').slice(0,2))+'</span>';
  const volume=filters.mode==='momentum'?p.volume5:p.volume1;
  return '<tr data-desk-row="'+esc(key)+'">'+
   '<th scope="row"><button class="axo-desk-token" data-desk-inspect="'+esc(key)+'" title="'+esc(p.name)+'">'+logo+'<span><b>'+esc(p.symbol||p.name)+'</b><small>'+esc(axoChainNames[p.chain])+(p.createdAt?' · Pool '+esc(age(p.createdAt)):'')+'</small></span></button></th>'+
   '<td data-label="5m" class="'+tone(p.changes?.m5)+'">'+esc(pct(p.changes?.m5))+'</td>'+
   '<td data-label="1h" class="'+tone(p.change1)+'">'+esc(pct(p.change1))+'</td>'+
   '<td data-label="24h" class="'+tone(p.change24)+'">'+esc(pct(p.change24))+'</td>'+
   '<td data-label="'+esc(funds[filters.mode])+'">'+esc(money(volume))+'</td>'+
   '<td data-label="Liquidity">'+esc(money(p.liquidity))+'</td>'+
   '<td data-label="Market cap">'+esc(money(p.marketCap))+'</td>'+
   '<td class="axo-desk-why"><span class="axo-desk-badge '+badge.className+'">'+esc(badge.label)+'</span>'+(reason?'<small>'+esc(reason)+'</small>':'')+'</td>'+
   '<td class="axo-desk-row-controls"><button class="btn" type="button" data-desk-pick="'+esc(key)+'" aria-pressed="'+picked.has(key)+'" aria-label="'+(picked.has(key)?'Remove ':'Compare ')+esc(p.symbol||p.name)+'">'+(picked.has(key)?'✓':'+')+'</button></td></tr>';
 }
 function paintTable(view){
  const rows=rowsForView(),rowsNode=view.querySelector('[data-desk-results]'),n=rows.length,prefix=filters.mode==='following'?'saved pools':'matching pools in the sample';
  let content;
  if(n){
   content='<table class="axo-desk-table"><caption class="axo-desk-sr">Sampled token pools</caption><thead><tr><th>Project</th><th>5m</th><th>1h</th><th>24h</th><th>'+esc(funds[filters.mode])+'</th><th>Liquidity</th><th>Market cap</th><th>Evidence</th><th><span class="axo-desk-sr">Compare</span></th></tr></thead><tbody>'+
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
   content='<p class="axo-desk-empty">'+esc(note)+'</p>';
  }
  if(n>limit)content+='<button class="btn axo-desk-more" type="button" data-desk-more>Show '+Math.min(n-limit,pageSize)+' more</button>';
  const focused=document.activeElement,focusedKey=focused?.dataset.deskInspect||focused?.dataset.deskPick;
  if(painted.get(rowsNode)!==content){
   rowsNode.innerHTML=content;
   painted.set(rowsNode,content);
   if(focusedKey&&focused.isConnected===false){
    const attr=focused.dataset.deskInspect?'deskInspect':'deskPick';
    const same=[...rowsNode.querySelectorAll('[data-desk-inspect],[data-desk-pick]')].find(button=>button.dataset[attr]===focusedKey);
    (same||view.querySelector('[data-desk-query]')).focus({preventScroll:true});
   }
  }
  view.querySelector('[data-desk-result-count]').textContent=n+' '+prefix+(n>limit?' · showing '+limit:'');
 }
 function coverage(){
  if(!sample)return '';
  const rows=sample.chains.filter(c=>!filters.chain||c.chain===filters.chain);
  return '<ul class="axo-desk-coverage-list">'+rows.map(c=>{
   const valid=Desk.fresh(c.observedAt,Date.now()),status=valid?c.state==='current'?'Current':'Partial':'No current sample';
   const head=Desk.fresh(c.head?.observedAt,Date.now(),600000)?c.head:null;
   return '<li><strong>'+esc(c.name)+'</strong><span>'+esc(status)+' · '+(valid?c.current:0)+' pools · '+(valid?c.withActivity:0)+' with 5m trades · '+(valid?c.withUnique:0)+' with unique traders</span><small>'+
    esc(c.sources.map(s=>s.provider+' '+(s.id||'')+' '+(s.status==='available'&&!Desk.fresh(s.at,Date.now())?'stale':s.status)+(s.at?' ('+stamp(s.at)+')':'')).join(' · ')||'Waiting on sources')+'</small>'+
    (head?'<small>'+esc(head.provider)+' · '+esc(head.kind)+' '+esc(head.height.toLocaleString())+' read '+esc(stamp(head.observedAt))+'</small>':'')+'</li>';
  }).join('')+'</ul><p>Up to '+sample.limits.rowsPerChain+' projects per chain, drawn from top, new and retained pool samples. One current, usable pool per contract where available. The selected pool and provider determine the figures. Changes in USD liquidity can also reflect a move in price.</p>';
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
   '</div><div class="axo-desk-filter-row"><label class="axo-desk-search"><span>Search sample</span><input type="search" data-desk-query maxlength="120" placeholder="Ticker, name or contract" autocomplete="off"></label>'+
   '<label data-desk-threshold><span>Min. liquidity</span><select data-desk-liquidity>'+Desk.LIQUIDITY.map(x=>'<option value="'+x+'">'+esc(money(x))+'</option>').join('')+'</select></label>'+
   '<label data-desk-threshold title="Select Any cap to include pools without a reported circulating market cap."><span>Max. market cap</span><select data-desk-cap>'+Desk.CAPS.map(x=>'<option value="'+(x??'')+'">'+esc(x===null?'Any cap':money(x))+'</option>').join('')+'</select></label>'+
   '<label class="axo-desk-screened" data-desk-threshold><input type="checkbox" data-desk-screened> Core checks only</label></div></div>'+
   '<div class="axo-desk-result-bar"><div><strong data-desk-result-count aria-live="polite"></strong><small data-desk-description></small></div><div class="axo-desk-micro-actions"><button type="button" class="btn" data-desk-search-all hidden>Search more pools</button><button type="button" class="btn" data-desk-compare disabled>Compare</button><button type="button" class="btn" data-desk-refresh>Refresh</button></div></div>'+
   '<p class="axo-desk-error" data-desk-error role="status" hidden></p><div data-desk-results></div>'+
   '<div class="axo-desk-footer"><details><summary>Coverage &amp; method</summary><div data-desk-coverage></div></details><details><summary>Recent changes</summary><ul data-desk-changes></ul><button class="btn" type="button" data-desk-open="changes">All changes</button></details>'+
   '<button class="btn" type="button" data-desk-open="launchpads">Launchpads &amp; graduations</button><button class="btn" type="button" data-desk-open="paper">Paper trading</button><button class="btn" type="button" data-desk-context>Show market context</button></div>';
 }
 function patchContent(node,markup){
  if(painted.get(node)===markup)return;
  const focus=document.activeElement;
  const chain=focus&&node.contains(focus)?focus.dataset.deskChain:undefined;
  node.innerHTML=markup;
  painted.set(node,markup);
  if(chain!==undefined)[...node.querySelectorAll('[data-desk-chain]')].find(b=>b.dataset.deskChain===chain)?.focus({preventScroll:true});
 }
 function paint(){
  const view=root();
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
  for(const label of view.querySelectorAll('[data-desk-threshold]'))label.hidden=filters.mode==='following';
  view.querySelector('[data-desk-description]').textContent=Desk.MODES[filters.mode].description;
  const compare=view.querySelector('[data-desk-compare]');
  compare.disabled=picked.size<2;compare.textContent='Compare'+(picked.size?' ('+picked.size+')':'');
  view.querySelector('[data-desk-search-all]').hidden=!filters.query;
  view.querySelector('[data-desk-refresh]').disabled=loading;
  const failure=view.querySelector('[data-desk-error]');failure.hidden=!error||!sample;failure.textContent=error;
  patchContent(view.querySelector('[data-desk-coverage]'),coverage());
  patchContent(view.querySelector('[data-desk-changes]'),recentChanges()||'<li>No dated changes in this sample yet.</li>');
  view.querySelector('[data-desk-context]').textContent=showAll?'Focus on Trading Desk':'Show market context';
  paintTable(view);
 }

 function detailMetric(label,value){
  return '<div><dt>'+esc(label)+'</dt><dd>'+esc(value)+'</dd></div>';
 }
 function tradeCounts(tx){
  return Number.isFinite(tx?.buys)&&Number.isFinite(tx?.sells)?count(tx.buys)+' buys / '+count(tx.sells)+' sells':'—';
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
   (holderFresh?'<p class="axo-desk-detail-note">GoPlus · '+esc(asOf(h.at))+' · Concentration can include pool, burn and locked addresses.</p>':'')+
   (row.risk?.reasons?.length||row.cautions?.length?'<ul class="axo-desk-cautions">'+[...(row.risk.reasons||[]),...(row.cautions||[])].map(c=>'<li>'+esc(c)+'</li>').join('')+'</ul>':'')+
   '<section class="axo-desk-check"><div><h3>Entry &amp; exit evidence</h3><button type="button" class="btn" data-desk-check '+(check?.loading||row.risk?.excluded?'disabled':'')+'>'+(check?'Check again':'Check entry & exit')+'</button></div>'+
   (execution?'<p>'+esc(({restriction:'Sell restriction reported',simulated:'Dated buy and sell simulation',inconclusive:'Simulation inconclusive'})[execution.status])+' · '+esc(execution.source||'')+' · '+esc(stamp(execution.at))+'</p>':'')+
   '<div data-desk-check-result aria-live="polite">'+checkMarkup()+'</div></section>'+
   '<details class="axo-desk-identity"><summary>Contract &amp; pool</summary><p>Contract <code>'+esc(p.address)+'</code></p><p>Pool <code>'+esc(p.pair)+'</code></p>'+(/^https:\/\/(?:dexscreener\.com|www\.geckoterminal\.com)\//i.test(p.url||'')?'<a href="'+esc(p.url)+'" target="_blank" rel="noopener noreferrer">Open market source ↗</a>':'')+
   '<button class="btn" type="button" data-desk-contract>Check on-chain facts</button><div data-desk-contract-result aria-live="polite"></div></details>'+
   '<footer><button class="btn" type="button" data-desk-project="'+identity+'">Open project &amp; chart</button><button class="btn" type="button" data-watch="'+esc(projectId)+'">'+watchLabel(p)+'</button>'+
   '<button class="btn" type="button" data-pc-alert="'+esc(projectId)+'">Set alert</button>'+
   '<button class="btn axo-desk-primary" type="button" data-desk-review="'+identity+'" '+(row.risk?.excluded?'disabled':'')+'>Review swap</button></footer>';
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
 document.addEventListener('change',event=>{
  const el=event.target;
  if(el.matches('[data-desk-liquidity]'))setFilters({liquidity:Number(el.value)});
  if(el.matches('[data-desk-cap]'))setFilters({maxCap:el.value?Number(el.value):null});
  if(el.matches('[data-desk-screened]'))setFilters({screened:el.checked});
 });
 document.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if(!button)return;
  if(button.hasAttribute('data-desk-mode'))setFilters({mode:button.dataset.deskMode});
  else if(button.hasAttribute('data-desk-chain'))setFilters({chain:button.dataset.deskChain||null});
  else if(button.hasAttribute('data-desk-entry'))openDesk(axoStream.chain||null);
  else if(button.hasAttribute('data-desk-more')){limit+=pageSize;paint();}
  else if(button.hasAttribute('data-desk-refresh'))void poll(true);
  else if(button.hasAttribute('data-desk-check'))void preflight();
  else if(button.hasAttribute('data-desk-contract'))void inspectContract(button);
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
  if(axoStream.type==='home')cards.push([id,shell(id,'Trading Desk','Find, compare and follow tokens across five chains','<div data-trading-desk></div>','','axo-trading-desk')]);
  return cards;
 };
 const visible=axoStreamCardVisible;
 axoStreamCardVisible=key=>key===id?axoStream.type==='home':visible(key);
 const order=axoOrderCards;
 axoOrderCards=function(cards){
  if(axoStream.type==='paper'&&Date.now()>=manualUntil){
   const priority=['overview','strategies','positions','daily','evaluation','equity','decisions','fills','policy'];
   const rank=key=>pins.includes(key)?-1:priority.includes(key.replace('stream-data-paper-',''))?priority.indexOf(key.replace('stream-data-paper-','')):20;
   return order(cards).sort((a,b)=>rank(a[0])-rank(b[0]));
  }
  if(axoStream.type!=='home')return order(cards);
  const desk=cards.find(([key])=>key===id),ordered=order(cards.filter(([key])=>key!==id));
  let shown=ordered;
  if(!showAll&&Date.now()>=manualUntil){
   let context=0;
   shown=ordered.filter(([key])=>pins.includes(key)||key.startsWith('request-')||key.startsWith('stream-data-attached-')||key==='stream-data-pulse'||key.startsWith('project-')||key==='stream-data-focus-more'||++context<=3);
  }
  if(desk)shown.splice(shown.filter(([key])=>pins.includes(key)).length,0,desk);
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
 setInterval(()=>{paint();void poll();},40000);
 render(true);
})();
