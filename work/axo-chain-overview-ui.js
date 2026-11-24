/* Reusable, data-bound layouts attached to a stream, rather than a frozen snapshot. */
const axoCardComponents=new Set(AxoStreamSchema.components);
let axoAttachedCards=axoReadJson('axo-attached-cards-v1',[]);if(!Array.isArray(axoAttachedCards))axoAttachedCards=[];
axoAttachedCards=axoAttachedCards.filter(r=>typeof r?.id==='string'&&typeof r.scope==='string'&&r.scope.length<4000&&typeof r.title==='string'&&r.title.length<=80&&Array.isArray(r.components)&&r.components.every(c=>axoCardComponents.has(c))&&Array.isArray(r.metrics)&&r.metrics.every(k=>Object.hasOwn(axoIntentMetrics,k))&&Array.isArray(r.chains)&&r.chains.every(c=>Object.hasOwn(axoChainNames,c))).slice(0,64);
axoAttachedCards=axoAttachedCards.map(r=>{try{return {...r,scope:AxoStreamSchema.scope(JSON.parse(r.scope))};}catch{return null;}}).filter(Boolean);
const axoAttachedJobs=new Map();
function axoAttachedScope(s=axoStream){return AxoStreamSchema.scope(s);}
function axoOverviewTrend(points,label){
 if(points.length<2)return '<span class="axo-trend-unavailable">History unavailable</span>';
 const first=Math.floor(points[0].time/86400000),last=Math.floor(points.at(-1).time/86400000),step=120/(last-first+1),max=Math.max(...points.map(p=>p.value));
 return '<svg class="axo-overview-trend" viewBox="0 0 120 30" role="img" aria-label="'+esc(label+' daily observations, '+points.length+' days reported, scaled from zero')+'">'+
  '<line x1="0" x2="120" y1="28" y2="28"/>'+points.map(p=>{
   const height=max>0?p.value/max*26:0,x=(Math.floor(p.time/86400000)-first)*step;
   return '<rect x="'+x+'" y="'+(28-height)+'" width="'+(step*.76)+'" height="'+height+'"><title>'+esc(ecoDate(p.time)+' · '+axoCardMoney(p.value))+'</title></rect>';
  }).join('')+'</svg>';
}
function axoOverviewMarkup(chain){
 const d=axoChains.data.get(chain);
 if(!d)return '<p class="mini">Collecting '+esc(axoChainNames[chain])+' chain evidence…</p>';
 const o=AxoChainOverview.build(d,Date.now(),p=>!AxoStablecoins.isSuggestedProject(p));
 const breadth=o.momentum.positivePercent,sampled=o.sampledPools>0||o.status==='available';
 const metric=(label,value,extra='')=>'<div><span>'+label+'</span><strong>'+esc(value)+'</strong>'+extra+'</div>';
 const series=[['Daily DEX volume',o.volumeDaily],['Protocol TVL',o.tvl],['Stablecoin supply',o.capital]];
 const comparisons=series.map(([label,s])=>'<section class="axo-overview-measure"><div><h3>'+label+'</h3><strong>'+esc(axoCardMoney(s.value))+'</strong>'+
  '<small>'+esc(s.at?new Date(s.at).toLocaleDateString():'Date unavailable')+(s.status==='stale'?' · Dated':'')+'</small></div>'+axoOverviewTrend(s.points,label)+
  '<dl>'+s.comparisons.map(c=>'<div><dt>'+c.days+'d</dt><dd>'+axoPctHeat(c.percent)+'</dd></div>').join('')+'</dl></section>').join('');
 return '<div class="axo-overview-kpis">'+metric('24h DEX volume',axoCardMoney(o.volume24),axoPctHeat(o.volume24Change))+
  metric('Sampled projects',sampled?o.projects:'—')+metric('New pools today · UTC',sampled?o.newPoolsToday:'—')+
  metric('Projects up · 24h',o.momentum.eligible?o.momentum.positive+' / '+o.momentum.eligible:'—',breadth===null?'':'<span class="axo-overview-breadth" aria-hidden="true"><i style="width:'+breadth.toFixed(2)+'%"></i></span>')+
  '</div><div class="axo-overview-measures">'+comparisons+'</div>'+
  '<details class="axo-overview-sources"><summary>Dates, sources and coverage</summary><p>'+esc(o.sample)+'</p><ul>'+o.limitations.map(l=>'<li>'+esc(l)+'</li>').join('')+'</ul>'+
  series.map(([label,s])=>'<p><b>'+label+'</b> · '+esc(s.source)+' · '+esc(s.status)+' · data '+esc(s.at?ecoDate(s.at):'unavailable')+' · fetched '+esc(s.receivedAt?ecoDate(s.receivedAt):'unavailable')+'</p>').join('')+
  '<p>Pool dates available for '+o.knownLaunchTimes+' of '+o.sampledPools+' fresh sampled pools.</p></details>';
}
chOverview=function(){return chCard('overview',chName()+' chain overview','Trading and capital context',axoOverviewMarkup(axoStream.chain));};
const axoAttachedAttempt=new Map();
async function axoLoadAttachedChain(chain){
 if(document.hidden||axoAttachedJobs.has(chain)||axoChains.jobs.has(chain)||Date.now()-(axoAttachedAttempt.get(chain)??-Infinity)<60000)return;
 const prior=axoChains.data.get(chain);
 if(prior&&prior.asOf>0&&Date.now()-prior.asOf<60000)return;
 axoAttachedAttempt.set(chain,Date.now());
 const job=(async()=>{
  let next;
  try{
   const r=await fetch('/api/chain?'+new URLSearchParams({chain,initial:'1'}),{signal:AbortSignal.timeout(90000)});
   next=await r.json();
   if(!r.ok||next.chain!==chain||!Array.isArray(next.pools))throw Error('Chain evidence unavailable');
  }catch{
   if(prior)return;
   next={chain,status:'unavailable',pools:[],sample:'Chain evidence unavailable'};
  }finally{axoAttachedJobs.delete(chain);}
  const present=()=>{if(axoChains.data.get(chain)!==prior)return;axoChains.data.set(chain,next);render(!prior);};
  if(prior)axoQueueMarketUpdate('attached-chain:'+chain,present);else present();
 })();
 axoAttachedJobs.set(chain,job);
 return job;
}
function axoAttachedRows(r){
 const scoped=axoStream.type==='discovery'?discoveryPicks():axoStream.type==='watchlist'?axoWatch:
  axoStream.type==='project'?(axoStreamProject?[axoStreamProject]:[]):lpScope()?lpRows(lpTab()):r.chains.flatMap(c=>axoChains.data.get(c)?.pools||[]);
 const rows=new Map(),scoreNeeded=r.scoreMin!=null||r.scoreMax!=null||r.rankBy==='axoScore';
 for(const p of scoped){
  if(!r.chains.includes(p.chain)||!AxoVisualModel.identity(p)||!AxoStablecoins.isSuggestedProject(p)||!axoRowModel(p).fresh||p.curve)continue;
  if(!axoRiskAllowed(p)&&(!axoRiskProtected(p)||axoRiskState(p).excluded))continue;
  if(!(p.liquidity>=Math.max(axoLiquidity,r.liquidityMin??0))||r.volumeMin!=null&&!(p.volume24>=r.volumeMin))continue;
  if(axoLens==='trenches'&&(!p.createdAt||Date.now()-p.createdAt>604800000)||axoLens==='swing'&&(!p.createdAt||Date.now()-p.createdAt<2592000000||p.liquidity<1000000))continue;
  const score=scoreNeeded?axoScoreData(p).score:null;
  if(scoreNeeded&&(score===null||score<(r.scoreMin??0)||score>(r.scoreMax??100)))continue;
  const key=watchIdentity(p),old=rows.get(key);
  if(!old||p.liquidity>old.p.liquidity)rows.set(key,{p,score});
 }
 return [...rows.values()].sort((a,b)=>(r.rankBy==='axoScore'?b.score-a.score:0)||(b.p.volume24??-1)-(a.p.volume24??-1)).slice(0,12).map(row=>row.p);
}
function axoComparisonMarkup(rows,requested){
 if(!rows.length)return '<p class="axo-viz-empty">No current projects match these filters.</p>';
 const keys=requested.length?requested:['liquidity','volume24'],shown=rows.slice(0,24);
 const value=(p,k)=>k==='axoScore'?axoScoreData(p).score:k==='holders'?axoRowModel(p).h.count:p[k];
 const items=shown.map(p=>({p,values:Object.fromEntries(keys.map(k=>[k,value(p,k)]))}));
 const maxima=Object.fromEntries(keys.map(k=>[k,k==='axoScore'?100:Math.max(0,...items.map(({values})=>Number.isFinite(values[k])?values[k]:0))]));
 const item=({p,values})=>'<section class="axo-compare-row"><div><button class="btn"'+axoVizOpen(p)+'><b>'+esc(p.symbol||p.name)+'</b><small>'+esc(axoChainNames[p.chain])+'</small></button>'+
  '<small title="'+esc(p.provider||'Public source')+'">'+esc(age(p.seenAt))+'</small></div><dl>'+keys.map(k=>{
   const n=values[k],known=Number.isFinite(n)&&n>=0;
   const display=known?(['holders','axoScore'].includes(k)?axoCardCount(n):k==='price'?axoCardPrice(n):axoCardMoney(n)):'—';
   const bar=k!=='price'&&k!=='change24'&&known&&maxima[k]>0?'<span class="axo-compare-bar" aria-hidden="true"><i style="width:'+Math.min(100,n/maxima[k]*100).toFixed(2)+'%"></i></span>':'';
   return '<div><dt>'+esc(axoIntentMetrics[k])+'</dt><dd>'+(k==='change24'?axoPctHeat(n):esc(display))+bar+'</dd></div>';
  }).join('')+'</dl></section>';
 return '<div class="axo-compare-visual">'+items.slice(0,6).map(item).join('')+(items.length>6?'<details><summary>Show '+(items.length-6)+' more projects</summary>'+items.slice(6).map(item).join('')+'</details>':'')+
  '<small>'+shown.length+' / '+rows.length+' projects · bars scaled within each metric</small></div>';
}
function axoAttachedComponent(component,r,rows){
 if(component==='project_activity')return axoActivityComponent(r,rows);
 if(component==='chain_overview')return r.chains.map(c=>'<h3>'+esc(axoChainNames[c])+'</h3>'+axoOverviewMarkup(c)).join('');
 if(component==='momentum_board')return axoMomentumBoard(rows);
 if(component==='momentum_matrix')return axoMomentumMatrix(rows);
 if(component==='liquidity_map')return axoActivityMap(rows);
 if(component==='metric_table')return axoComparisonMarkup(rows,r.metrics.filter(k=>Object.hasOwn(axoIntentMetrics,k)));
 const intel=typeof axoIntelComponent==='function'?axoIntelComponent(component):null;
 if(intel!==null)return intel;
 if(component==='ranked_list')return rows.map(p=>{axoProjectMap.set('project-'+p.id,p);return axoProjectRow(p);}).join('')||'<p class="mini">No fresh eligible projects in this public sample.</p>';
 return '<p class="mini">This component is unavailable here.</p>';
}
function axoAttachedMarkup(r){
 const rows=axoAttachedRows(r),body=r.components.map(c=>axoAttachedComponent(c,r,rows)).join('');
 return shell(r.id,r.title,'Saved layout · public evidence',body+'<footer class="axo-attached-footer"><small>'+esc(r.chains.map(c=>axoChainNames[c]).join(', '))+'</small><button class="btn" data-attached-remove="'+esc(r.id)+'">Remove card</button></footer>','','axo-attached-card axo-visual-layout');
}
function axoActiveAttached(){
 return axoAttachedCards.filter(r=>r.scope===axoAttachedScope()&&!hidden.includes(r.id));
}
function axoLoadAttachedEvidence(r){
 const needsPools=r.components.some(c=>['ranked_list','metric_table','momentum_board','momentum_matrix','liquidity_map','project_activity'].includes(c));
 if(r.components.includes('chain_overview')||needsPools&&!['discovery','watchlist','project','launchpads','launchpad'].includes(axoStream.type))for(const chain of r.chains)void axoLoadAttachedChain(chain);
}
const attachedExtra=axoExtraCards;axoExtraCards=function(){
 const cards=attachedExtra();
 for(const r of axoActiveAttached()){axoLoadAttachedEvidence(r);cards.push([r.id,axoAttachedMarkup(r)]);}
 return cards;
};
setInterval(()=>{if(!document.hidden)for(const r of axoActiveAttached())axoLoadAttachedEvidence(r);},60000);
const attachedVisible=axoStreamCardVisible;axoStreamCardVisible=function(id){return id.startsWith('stream-data-attached-')?axoAttachedCards.some(r=>r.id===id&&r.scope===axoAttachedScope()):attachedVisible(id)};
const attachedOrder=axoOrderCards;axoOrderCards=function(cards){const added=cards.filter(([id])=>id.startsWith('stream-data-attached-')),ordered=attachedOrder(cards.filter(([id])=>!id.startsWith('stream-data-attached-')));ordered.splice(['chain','project','discovery'].includes(axoStream.type)?Math.min(1,ordered.length):0,0,...added);return ordered};
const attachedWanted=axoIntentWanted;axoIntentWanted=function(q){return attachedWanted(q)||/\b(?:card|chart|matrix|treemap|visuali[sz]ation|overview)\b/i.test(q)&&/\b(?:create|make|build|add|show|want|need)\b/i.test(q)};
const attachedRun=axoRunIntent;axoRunIntent=async function(q,...args){return attachedRun(q,...args)};
function axoApplyCardPlan(plan){
 if(!plan.template||!plan.components?.every(c=>axoCardComponents.has(c)))throw Error('This card layout is unavailable.');
 const target=plan.targetStream||'current';if(target.startsWith('chain:'))axoGoStream({type:'chain',chain:target.slice(6)});else if(target!=='current'){const saved=axoShortcuts.find(s=>s.id===target);if(!saved)throw Error('Choose an existing destination stream.');axoGoStream(saved.stream)}
 const chains=plan.chains?.length?plan.chains:axoStream.chain?[axoStream.chain]:axoStream.project?[axoStream.project.chain]:axoStream.discovery?.chains?.length?axoStream.discovery.chains:Object.keys(axoChainNames);
 if(plan.components.length===1&&plan.components.includes('chain_overview')&&axoChainScope()&&chView()==='overview'&&chains.length===1&&chains[0]===axoStream.chain){hidden=hidden.filter(id=>id!==chId('overview'));render(true);return 'The '+chName()+' chain overview is shown in this stream, with dated volume, TVL, stablecoin supply and sampled project activity.'}
 const scope=axoAttachedScope(),old=axoAttachedCards.find(r=>r.scope===scope&&r.templateId===plan.template.id&&(r.liquidityMin??null)===(plan.liquidityMin??null)&&(r.volumeMin??null)===(plan.volumeMin??null)&&r.scoreMin===(plan.scoreMin??null)&&r.scoreMax===(plan.scoreMax??null)&&(r.rankBy||'activity')===(plan.rankBy||'activity')&&JSON.stringify(r.chains)===JSON.stringify(chains));if(old){hidden=hidden.filter(id=>id!==old.id);render(true);return 'The requested card is already attached to this stream and is now shown.'}
 if(axoAttachedCards.length>=64||axoAttachedCards.filter(r=>r.scope===scope).length>=8)throw Error('Remove a saved card before adding another to this stream.');
 const r={id:'stream-data-attached-'+crypto.randomUUID(),scope,title:plan.title||'Axo research card',templateId:plan.template.id,components:plan.components,metrics:plan.metrics,chains,liquidityMin:plan.liquidityMin??null,volumeMin:plan.volumeMin??null,scoreMin:plan.scoreMin??null,scoreMax:plan.scoreMax??null,rankBy:plan.rankBy||'activity'};const before=axoAttachedCards;axoAttachedCards=[...before,r];try{localStorage.setItem('axo-attached-cards-v1',JSON.stringify(axoAttachedCards))}catch{axoAttachedCards=before;throw Error('The card could not be saved in this browser.')};axoLoadAttachedEvidence(r);render(true);return 'Added '+r.title+' to '+axoStreamTitle()+'. Its saved layout refreshes from public evidence; missing measurements stay visible.';
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-attached-remove]');if(!b)return;const before=axoAttachedCards;axoAttachedCards=axoAttachedCards.filter(r=>r.id!==b.dataset.attachedRemove);try{localStorage.setItem('axo-attached-cards-v1',JSON.stringify(axoAttachedCards))}catch{axoAttachedCards=before;toast('Could not remove the saved card.','error')}render(true)});
const overviewCss=document.createElement('style');overviewCss.textContent='.axo-overview-table{max-width:100%;overflow-x:auto;margin:12px 0}.axo-overview-table table{width:100%;border-collapse:collapse;font-size:10px}.axo-overview-table th,.axo-overview-table td{padding:7px 5px;border-bottom:1px solid var(--ax-border);text-align:left;white-space:nowrap}.axo-overview-table th small{display:block;font-weight:400;color:var(--ax-muted)}.axo-overview-sources{font-size:10px}.axo-overview-sources p{overflow-wrap:anywhere}.axo-attached-card{min-width:0}.axo-attached-card h3{font-size:12px}.axo-attached-card .btn{font-size:10px;white-space:normal}.axo-attached-card .project-row{max-width:100%}';document.head.append(overviewCss);render(false);
