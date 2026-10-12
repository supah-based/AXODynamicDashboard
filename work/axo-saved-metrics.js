/* Independent of adaptive ordering: only an explicit Remove clears a saved metric. */
const axoRailKey='axo-saved-metrics-v1';
function axoReadSavedMetrics(){try{const d=JSON.parse(localStorage.getItem(axoRailKey));return Array.isArray(d)?d.filter(x=>x&&typeof x.id==='string'&&typeof x.title==='string'):[]}catch{return []}}
let axoSavedMetrics=axoReadSavedMetrics();const axoRailUpdates=new Map(),axoRailBusy=new Set();
function axoSaveMetrics(){try{localStorage.setItem(axoRailKey,JSON.stringify(axoSavedMetrics))}catch{}}
const savedStyle=document.createElement('style');savedStyle.textContent=`.utility-rail{max-height:calc(100vh - 38px);overflow-y:auto;scrollbar-width:thin}.saved-metrics{margin-bottom:16px;padding-bottom:13px;border-bottom:1px solid #d9cce4}.saved-metrics-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}.saved-metrics-head h3{font-size:11px}.saved-metric{border:1px solid color-mix(in srgb,var(--saved-color) 40%,#ddd2e7);border-radius:10px;padding:9px;margin:7px 0;background:linear-gradient(145deg,#fff,color-mix(in srgb,var(--saved-color) 8%,#fff));overflow:hidden}.saved-metric-head{display:flex;align-items:start;gap:6px;margin-bottom:6px}.saved-metric-head strong{font-size:10px;line-height:1.4;flex:1}.saved-metric-head .category-icon{width:21px;height:21px;border-radius:6px;--accent:var(--saved-color);--accent-soft:transparent}.saved-metric-head .category-icon svg{width:13px;height:13px}.saved-remove{padding:0 3px;color:#8d779b;font-size:16px;line-height:18px}.saved-open{width:100%;text-align:left;padding:0;display:block}.saved-line{display:flex;justify-content:space-between;align-items:center;gap:5px;margin:5px 0;font-size:10px}.saved-line b{font-variant-numeric:tabular-nums;font-size:11px}.saved-line .chain-badge{font-size:8px;padding:1px 3px}.saved-caption{font-size:9px;line-height:1.45;color:#8b769b;margin-top:5px}.saved-number{font-size:22px;font-weight:650;letter-spacing:-.6px}.saved-bar{height:4px;background:#e9deef;overflow:hidden;border-radius:3px}.saved-bar i{display:block;height:100%;background:var(--saved-color);border-radius:3px}.saved-empty{font-size:10px;color:#8b769b;line-height:1.5}.save-to-rail{color:#9374b3}.save-to-rail.saved{background:#ede2f8;color:#694a8c}.save-to-rail svg{width:13px;height:13px;vertical-align:middle;fill:none;stroke:currentColor;stroke-width:1.6}.saved-metrics .spark{height:30px}.saved-metrics-foot{font-size:8px;color:#927da0;line-height:1.5}html[data-theme="dark"] .saved-metrics{border-color:#51405e}html[data-theme="dark"] .saved-metric{background:linear-gradient(145deg,#302738,color-mix(in srgb,var(--saved-color) 14%,#29232f));border-color:color-mix(in srgb,var(--saved-color) 45%,#504057)}html[data-theme="dark"] .saved-caption,html[data-theme="dark"] .saved-empty,html[data-theme="dark"] .saved-metrics-foot{color:#b9a5c9}html[data-theme="dark"] .save-to-rail.saved{background:#4c365f;color:#e2c5f8}html[data-theme="dark"] .saved-bar{background:#503d60}@media(max-width:700px){.utility-rail{max-height:none}.saved-metrics-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}.saved-metric{margin:0}.saved-metric .saved-line{font-size:10px}}
`;document.head.appendChild(savedStyle);
const savedSection=document.createElement('section');savedSection.className='saved-metrics';savedSection.setAttribute('aria-label','Saved sidebar metrics');savedSection.innerHTML='<div class="saved-metrics-head"><h3>Kept in view</h3><span class="mini" id="axoSavedCount">0</span></div><div class="saved-metrics-list" id="axoSavedList"></div><div class="saved-metrics-foot">Saved in this browser · remove with ×</div>';document.querySelector('.utility-rail').prepend(savedSection);
const axoRailShell=shell;shell=function(id,title,sub,content,footer='',extra=''){const saved=axoSavedMetrics.some(x=>x.id===id),button='<button class="iconbtn save-to-rail '+(saved?'saved':'')+'" data-save-metric="'+esc(id)+'" aria-label="'+(saved?'Kept in sidebar: ':'Keep in sidebar: ')+esc(title)+'" aria-pressed="'+saved+'" title="'+(saved?'Already kept in sidebar':'Keep a compact version in sidebar')+'"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="3.5" width="15" height="13" rx="2"/><path d="M8 4v12M12.5 7v6M10 10h5"/></svg></button>';return axoRailShell(id,title,sub,content,footer,extra).replace('<div class="card-tools">','<div class="card-tools">'+button)};
const axoSigned=n=>!finite(n)?'—':(n>=0?'+':'−')+fmt(Math.abs(n));
function axoRailChains(record){return snapshot.chains.filter(c=>!record.chains?.length||record.chains.includes(c.id))}
function axoRailLine(label,value){return '<div class="saved-line"><span>'+label+'</span><b>'+value+'</b></div>'}
function axoRailSummary(r){const cs=axoRailChains(r);let body='',status='',keys=[];const id=r.id;
 if(id==='capital'){keys=cs.map(c=>'capital-'+c.id);const rows=cs.filter(c=>usable('capital-'+c.id)).sort((a,b)=>feed('capital-'+b.id).data.delta-feed('capital-'+a.id).data.delta);body=rows.slice(0,3).map(c=>axoRailLine(chainBadge(c.id),axoSigned(feed('capital-'+c.id).data.delta))).join('')||'<div class="saved-caption">Awaiting stablecoin observations</div>';body+='<div class="saved-caption">Stablecoin supply Δ · '+rows.length+'/'+cs.length+' chains. Not net bridge flows.</div>';if(rows[0])body+='<div class="saved-caption">Latest '+date(feed('capital-'+rows[0].id).data.time)+'</div>'}
 else if(id==='chainvolume'){keys=cs.map(c=>'dex-'+c.id);const rows=cs.filter(c=>usable('dex-'+c.id)).sort((a,b)=>feed('dex-'+b.id).data.volume-feed('dex-'+a.id).data.volume),max=Math.max(1,...rows.map(c=>feed('dex-'+c.id).data.volume));body=rows.slice(0,3).map(c=>axoRailLine(chainBadge(c.id),fmt(feed('dex-'+c.id).data.volume))+'<div class="saved-bar"><i style="width:'+Math.min(100,feed('dex-'+c.id).data.volume/max*100)+'%"></i></div>').join('');body+='<div class="saved-caption">Reported DEX volume · 24 hours</div>'}
 else if(id==='markets'){keys=['markets'];body=(feed('markets').data||[]).map(p=>axoRailLine(esc(p.symbol.toUpperCase()),price(p.price))+'<div class="saved-caption">'+pct(p.change)+' · 24h</div>').join('')}
 else if(id==='sentiment'){keys=['sentiment'];const d=feed('sentiment').data,m=d?.[0];body=m?'<div class="saved-number">'+m.value+'<span class="mini"> /100</span></div><div class="saved-caption">'+esc(m.label)+' · Bitcoin-focused</div>'+spark([...d].reverse().map(x=>x.value),'#bb916c',30,'Daily sentiment trend'):''}
 else if(id==='launches'){keys=['launches'];const count=(feed('launches').data?.items||[]).filter(p=>(!r.chains.length||r.chains.includes(p.chain))&&p.liquidity>=r.liquidity&&p.volume1>0).length;body='<div class="saved-number">'+count+'<span class="mini"> pools</span></div><div class="saved-caption">Sampled · ≥'+fmt(r.liquidity)+' liquidity · risk unchecked</div>'}
 else if(id==='launchpads'){keys=['dex'];body=(feed('dex').data?.launchpads||[]).slice(0,3).map(p=>axoRailLine(esc(p.name),fmt(p.volume))).join('')+'<div class="saved-caption">Launchpad DEX volume · 24h</div>'}
 else if(id==='attention'){keys=['trending'];body=(feed('trending').data?.coins||[]).slice(0,3).map((p,i)=>axoRailLine((i+1)+'. '+esc(p.symbol),pct(p.change))).join('')+'<div class="saved-caption">CoinGecko search interest · price Δ 24h</div>'}
 else if(id==='coverage'){const f=Object.values(snapshot.feeds);body='<div class="saved-number">'+f.filter(x=>x.status==='live').length+'<span class="mini"> /'+f.length+' feeds</span></div><div class="saved-caption">Public source availability</div>'}
 else if(id==='watchlist'){body='<div class="saved-number">'+axoWatch.length+'<span class="mini"> projects</span></div><div class="saved-caption">Your local watchlist</div>'}
 else if(id==='x'){body='<div class="saved-caption">X activity source not connected. Account and topic rankings unavailable.</div>'}
 else if(id==='brief'){keys=['markets',...cs.map(c=>'dex-'+c.id)];const top=cs.filter(c=>usable('dex-'+c.id)).sort((a,b)=>feed('dex-'+b.id).data.volume-feed('dex-'+a.id).data.volume)[0];body=(feed('markets').data||[]).map(p=>axoRailLine(esc(p.symbol.toUpperCase()),pct(p.change))).join('')+(top?'<div class="saved-caption">'+esc(top.name)+' leads DEX volume at '+fmt(feed('dex-'+top.id).data.volume)+'.</div>':'')}
 else if(r.project){const update=axoRailUpdates.get(id),live=allPairs().find(p=>p.chain===r.project.chain&&p.address===r.project.address),p=update?.project||live||r.project;body=axoRailLine(esc(p.symbol),price(p.price))+axoRailLine('Liquidity',fmt(p.liquidity))+axoRailLine('Volume · 1h',fmt(p.volume1))+'<div class="saved-caption">'+esc(p.chain)+' · risk not certified</div>';status=update?.error?'Refresh unavailable · saved observation':p.seenAt?'Observed '+age(p.seenAt):'Saved observation';}
 else if(r.query){const u=axoRailUpdates.get(id);body=(u?.items||r.items||[]).slice(0,3).map(p=>axoRailLine(esc(p.symbol),price(p.price))).join('');status=u?.error?'Refresh unavailable · saved results':u?.at?'Fetched '+age(u.at):'Saved search results'}
 else {body='<div class="saved-caption">'+esc(r.observation||'Saved observation')+'</div>';status='Saved '+age(r.savedAt)}
 if(keys.length){const fs=keys.map(feed),last=Math.max(0,...fs.map(f=>f.receivedAt||0));status=fs.some(f=>f.status==='stale'||f.status==='unavailable')?'Some sources stale / unavailable':last?'Fetched '+age(last):'Waiting for source data'}
 return (body||'<div class="saved-caption">Awaiting source data</div>')+(status?'<div class="saved-caption">'+esc(status)+'</div>':'');
}
// Keep controls mounted across feed refreshes, and freeze the rail during a gesture.
let axoRailSelected=null,axoRailDrag=null,axoRailSuppressClickUntil=0;
savedStyle.textContent+=`
.saved-grip{flex:0 0 24px;width:24px;height:24px;padding:2px;border-radius:5px;cursor:grab;touch-action:none;user-select:none;color:var(--ax-muted);background:var(--ax-raised)}
.saved-grip svg{width:14px;height:18px;fill:currentColor;pointer-events:none}
.saved-grip:hover{color:var(--ax-text)}
html[data-theme] body .saved-metric.saved-selected{outline:1px solid var(--ax-muted);outline-offset:-1px}
html[data-theme] body .saved-metric.saved-moving{opacity:.55;outline:2px dashed var(--ax-text);outline-offset:-3px}
.saved-moving .saved-grip{cursor:grabbing}
html[data-theme] body .saved-metric.saved-drop-before{box-shadow:inset 0 3px var(--ax-text)}
html[data-theme] body .saved-metric.saved-drop-after{box-shadow:inset 0 -3px var(--ax-text)}
.saved-reorder-status{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
`;
savedSection.querySelector('.saved-metrics-foot').textContent='Drag the grip to reorder · or focus it and use ↑ / ↓ · remove with ×';
const axoRailStatus=document.createElement('div');axoRailStatus.className='saved-reorder-status';axoRailStatus.setAttribute('role','status');axoRailStatus.setAttribute('aria-live','polite');savedSection.append(axoRailStatus);
function axoSelectSavedMetric(id){axoRailSelected=id;for(const card of $('axoSavedList').querySelectorAll('[data-saved-metric]'))card.classList.toggle('saved-selected',card.dataset.savedMetric===id)}
function axoMoveSavedMetric(id,index){
 const from=axoSavedMetrics.findIndex(r=>r.id===id);
 if(from<0||!Number.isInteger(index)||index<0||index>=axoSavedMetrics.length||from===index)return false;
 const [record]=axoSavedMetrics.splice(from,1);axoSavedMetrics.splice(index,0,record);axoSaveMetrics();axoRenderSavedMetrics();
 axoRailStatus.textContent=record.title+' moved to position '+(index+1)+' of '+axoSavedMetrics.length+'.';toast(axoRailStatus.textContent);return true;
}
function axoRenderSavedMetrics(){
 const list=$('axoSavedList');if(!list||axoRailDrag)return;
 $('axoSavedCount').textContent=axoSavedMetrics.length;
 if(!axoSavedMetrics.length){if(!list.querySelector('.saved-empty'))list.innerHTML='<div class="saved-empty">Use the sidebar icon on a card to keep its key metrics here.</div>';axoRailSelected=null;return}
 list.querySelector('.saved-empty')?.remove();
 const existing=new Map([...list.children].map(el=>[el.dataset.savedMetric,el]));
 for(const [index,r] of axoSavedMetrics.entries()){
  let card=existing.get(r.id);existing.delete(r.id);
  if(!card){const v=cardVisuals[r.id]||['search','','#9270bf'];card=document.createElement('article');card.className='saved-metric';card.dataset.savedMetric=r.id;card.style.setProperty('--saved-color',v[2]);
   card.innerHTML='<div class="saved-metric-head"><button type="button" class="saved-grip" data-reorder-metric="'+esc(r.id)+'" title="Drag to reorder; use arrow keys when focused" aria-keyshortcuts="ArrowUp ArrowDown Home End"><svg viewBox="0 0 12 18" aria-hidden="true"><circle cx="3" cy="4" r="1.2"/><circle cx="9" cy="4" r="1.2"/><circle cx="3" cy="9" r="1.2"/><circle cx="9" cy="9" r="1.2"/><circle cx="3" cy="14" r="1.2"/><circle cx="9" cy="14" r="1.2"/></svg></button><span class="category-icon">'+cardIcon(v[0])+'</span><strong>'+esc(r.title)+'</strong><button class="saved-remove" data-remove-metric="'+esc(r.id)+'" aria-label="Remove '+esc(r.title)+' from sidebar" title="Remove from sidebar">×</button></div><button class="saved-open" data-open-metric="'+esc(r.id)+'" title="Open full card"></button>';
  }
  const grip=card.querySelector('[data-reorder-metric]');grip.setAttribute('aria-label','Reorder '+r.title+', position '+(index+1)+' of '+axoSavedMetrics.length+'. Use up or down arrow keys.');
  const body=card.querySelector('.saved-open'),summary=axoRailSummary(r);if(body.innerHTML!==summary)body.innerHTML=summary;
  if(list.children[index]!==card)list.insertBefore(card,list.children[index]||null);
 }
 for(const card of existing.values())card.remove();axoSelectSavedMetric(axoRailSelected);
}
savedSection.addEventListener('focusin',e=>{const card=e.target.closest('[data-saved-metric]');if(card)axoSelectSavedMetric(card.dataset.savedMetric)});
savedSection.addEventListener('click',e=>{
 if(axoRailDrag||Date.now()<axoRailSuppressClickUntil&&e.detail!==0){e.preventDefault();e.stopImmediatePropagation();return}
 const grip=e.target.closest('[data-reorder-metric]');if(grip){e.preventDefault();e.stopPropagation();axoSelectSavedMetric(grip.dataset.reorderMetric)}
},true);
savedSection.addEventListener('keydown',e=>{
 const grip=e.target.closest('[data-reorder-metric]');if(!grip||axoRailDrag)return;
 const id=grip.dataset.reorderMetric,index=axoSavedMetrics.findIndex(r=>r.id===id);
 const next={ArrowUp:index-1,ArrowDown:index+1,Home:0,End:axoSavedMetrics.length-1}[e.key];if(next===undefined)return;
 e.preventDefault();e.stopPropagation();axoSelectSavedMetric(id);
 if(!axoMoveSavedMetric(id,next))axoRailStatus.textContent='Already at the '+(next<=0?'first':'last')+' position.';
 grip.focus({preventScroll:true});grip.scrollIntoView?.({block:'nearest'});
});
function axoClearSavedDrop(){for(const el of $('axoSavedList').children)el.classList.remove('saved-drop-before','saved-drop-after')}
function axoSavedDropAt(x,y){
 const list=$('axoSavedList'),bounds=list.getBoundingClientRect();
 if(x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom)return null;
 // Pick the nearest card, also covering gaps and the two-column mobile layout.
 let best=null,distance=Infinity;
 for(const card of list.children){const r=card.getBoundingClientRect(),dx=Math.max(r.left-x,0,x-r.right),dy=Math.max(r.top-y,0,y-r.bottom),d=dx*dx+dy*dy;if(d<distance){distance=d;best={card,after:y>(r.top+r.bottom)/2}}}
 return best;
}
savedSection.addEventListener('pointerdown',e=>{
 axoRailSuppressClickUntil=0;
 const grip=e.target.closest('[data-reorder-metric]');if(!grip||e.button!==0||e.isPrimary===false||axoRailDrag)return;
 e.preventDefault();grip.focus({preventScroll:true});axoSelectSavedMetric(grip.dataset.reorderMetric);
 axoRailDrag={id:grip.dataset.reorderMetric,grip,pointerId:e.pointerId,x:e.clientX,y:e.clientY,moving:false,target:null};
 grip.setPointerCapture?.(e.pointerId);
});
document.addEventListener('pointermove',e=>{
 const drag=axoRailDrag;if(!drag||e.pointerId!==drag.pointerId)return;
 if(!drag.moving&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<5)return;
 e.preventDefault();drag.moving=true;drag.grip.closest('.saved-metric').classList.add('saved-moving');
 const rail=savedSection.closest('.utility-rail'),bounds=rail.getBoundingClientRect();
 if(e.clientX>=bounds.left&&e.clientX<=bounds.right){if(e.clientY<bounds.top+28)rail.scrollTop-=18;else if(e.clientY>bounds.bottom-28)rail.scrollTop+=18}
 axoClearSavedDrop();drag.target=axoSavedDropAt(e.clientX,e.clientY);
 if(drag.target&&drag.target.card.dataset.savedMetric!==drag.id)drag.target.card.classList.add(drag.target.after?'saved-drop-after':'saved-drop-before');
},{passive:false});
function axoFinishSavedDrag(commit){
 const drag=axoRailDrag;if(!drag)return;
 axoRailDrag=null;axoClearSavedDrop();drag.grip.closest('.saved-metric').classList.remove('saved-moving');
 if(drag.moving)axoRailSuppressClickUntil=Date.now()+500;
 if(drag.grip.hasPointerCapture?.(drag.pointerId))drag.grip.releasePointerCapture(drag.pointerId);
 if(commit&&drag.moving&&drag.target&&drag.target.card.dataset.savedMetric!==drag.id){
  const from=axoSavedMetrics.findIndex(r=>r.id===drag.id),to=axoSavedMetrics.findIndex(r=>r.id===drag.target.card.dataset.savedMetric);
  axoMoveSavedMetric(drag.id,to+(drag.target.after?1:0)-(from<to?1:0));
 }else if(drag.moving)axoRailStatus.textContent='Reorder cancelled.';
 axoRenderSavedMetrics();if(commit)drag.grip.focus({preventScroll:true});
}
document.addEventListener('pointerup',e=>{if(axoRailDrag&&e.pointerId===axoRailDrag.pointerId){if(axoRailDrag.moving)axoRailDrag.target=axoSavedDropAt(e.clientX,e.clientY);axoFinishSavedDrag(true)}});
document.addEventListener('pointercancel',e=>{if(axoRailDrag&&e.pointerId===axoRailDrag.pointerId)axoFinishSavedDrag(false)});
savedSection.addEventListener('lostpointercapture',e=>{if(axoRailDrag&&e.pointerId===axoRailDrag.pointerId)axoFinishSavedDrag(false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&axoRailDrag){e.preventDefault();axoFinishSavedDrag(false)}});
window.addEventListener('blur',()=>axoFinishSavedDrag(false));
document.addEventListener('visibilitychange',()=>{if(document.hidden)axoFinishSavedDrag(false)});
async function axoRefreshSavedMetrics(){for(const r of axoSavedMetrics){if((!r.project&&!r.query)||axoRailBusy.has(r.id))continue;axoRailBusy.add(r.id);try{if(r.project){const d=await window.AxoResearchAdapter.project(r.project),p=d.pools?.find(p=>p.id===r.project.id)||d.pools?.[0];if(!p)throw new Error('No current pool');axoRailUpdates.set(r.id,{project:p});r.project=p}else{const response=await fetch('/api/search?q='+encodeURIComponent(r.query));if(!response.ok)throw new Error('Search unavailable');const d=await response.json();axoRailUpdates.set(r.id,{items:d.items||[],at:d.receivedAt});r.items=d.items||[]}axoSaveMetrics()}catch{axoRailUpdates.set(r.id,{...axoRailUpdates.get(r.id),error:true})}finally{axoRailBusy.delete(r.id);axoRenderSavedMetrics()}}}
const axoRenderBeforeRail=render;render=function(force=false){axoRenderBeforeRail(force);axoRenderSavedMetrics()};
document.addEventListener('click',e=>{let b=e.target.closest('[data-save-metric]');if(b){const id=b.dataset.saveMetric;if(axoSavedMetrics.some(r=>r.id===id)){toast('Already kept in the sidebar. Remove it there with ×.');return}const card=b.closest('[data-card]'),p=axoProjectMap.get(id),request=requests.find(r=>r.id===id),event=(snapshot.events||[]).find(x=>'event-'+x.id===id);const record={id,title:card?.querySelector('h2')?.textContent||titles[id]||id,chains:[...selected],liquidity:axoLiquidity,savedAt:Date.now()};if(p)record.project={...p};if(request){record.query=request.title.replace(/^Investigate: /,'');record.items=request.items||[]}if(event)record.observation=event.detail;axoSavedMetrics.push(record);axoSaveMetrics();axoRenderSavedMetrics();b.classList.add('saved');b.setAttribute('aria-pressed','true');b.title='Already kept in sidebar';toast('Kept in the sidebar. It stays until you remove it.');if(p||request)axoRefreshSavedMetrics();return}
 b=e.target.closest('[data-remove-metric]');if(b){const id=b.dataset.removeMetric;axoSavedMetrics=axoSavedMetrics.filter(r=>r.id!==id);axoRailUpdates.delete(id);axoSaveMetrics();axoRenderSavedMetrics();toast('Removed metric from Kept in view.');for(const button of document.querySelectorAll('[data-save-metric]'))if(button.dataset.saveMetric===id){button.classList.remove('saved');button.setAttribute('aria-pressed','false');button.title='Keep a compact version in sidebar'}return}
 b=e.target.closest('[data-open-metric]');if(b){const r=axoSavedMetrics.find(r=>r.id===b.dataset.openMetric);if(!r)return;selected=[...r.chains];axoLiquidity=r.liquidity;$('axoLiquidity').value=String(axoLiquidity/1000);$('axoLiquidityValue').textContent=fmt(axoLiquidity);hidden=hidden.filter(x=>x!==r.id);axoFocusTopic=r.id;manualUntil=0;if(r.project){const p=axoRailUpdates.get(r.id)?.project||r.project;axoProjectMap.set(r.id,p);axoExpanded.add(r.id)}if(r.query&&!requests.some(x=>x.id===r.id))requests.push({id:r.id,title:r.title,items:axoRailUpdates.get(r.id)?.items||r.items||[],receivedAt:r.savedAt});render(true);const full=[...$('board').children].find(el=>el.dataset.card===r.id);if(full)full.scrollIntoView?.({behavior:'smooth',block:'nearest'});else if(r.id==='watchlist')axoWatchPanel();else toast('The compact observation remains saved; its original event is no longer in the live stream.')}
});
setInterval(()=>{if(!document.hidden)axoRefreshSavedMetrics()},120000);render(true);axoRefreshSavedMetrics();
