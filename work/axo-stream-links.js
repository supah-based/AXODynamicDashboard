/* Public stream links and browser history use the same normalized stream as the dashboard. */
(function(){
 const publicTypes=new Set(['home','chain','project','discovery','launchpads','launchpad','news','news-topic','narrative','axo','hatchery','changes','research-review','rebound']);
 const fields=['stream','chain','section','address','pool','frame','filters','pad-view','pad-sort'];
 const safeId=value=>typeof value==='string'&&/^[a-z0-9][a-z0-9:-]{0,79}$/i.test(value)?value:null;
 function sectionFor(type,value){
  const id=safeId(value);
  if(!id)return null;
  if(type==='chain')return Object.hasOwn(axoChainViews,id)||/^news:[a-z0-9-]+$/.test(id)?id:null;
  if(type==='discovery')return ['sniper','degen'].includes(id)?id:null;
  if(type==='launchpad')return lpPlatforms.some(pad=>pad.id===id)?id:null;
  if(type==='narrative')return Object.hasOwn(axoNarratives,id)||/^category:[a-z0-9-]+$/.test(id)?id:null;
  if(type==='news-topic')return id;
  return null;
 }
 const shareable=s=>publicTypes.has(s.type)&&!s.requestedView;
 const defaultFilters=AxoStreamSchema.normalize({filters:{liquidity:50000}}).filters;
 const defaultDiscovery=AxoStreamSchema.discovery();
 const entries=new Map(),original=axoGoStream;
 const saved=history.state?.axoNavigation;
 const hasPosition=s=>typeof s?.session==='string'&&Number.isSafeInteger(s?.index)&&s.index>=0;
 const session=hasPosition(saved)?saved.session:crypto.randomUUID?.()||String(Date.now());
 let index=hasPosition(saved)?saved.index:0,navigating=false,scrollEpoch=0;
 history.scrollRestoration='manual';

 function publicUrl(s,base){
  const url=new URL(base,location.origin),p=url.searchParams;
  for(const key of fields)p.delete(key);
  if(!shareable(s))return url;
  if(s.type!=='home')p.set('stream',s.type);
  if(s.chain)p.set('chain',s.chain);
  const section=sectionFor(s.type,s.id);
  if(section)p.set('section',section);
  if(s.project){
   p.set('address',s.project.address);
   p.set('pool',s.project.pool);
   if(s.timeframe!=='1h')p.set('frame',s.timeframe);
  }
  const filters={};
  const general={...s.filters,chains:s.chain?[]:s.filters.chains};
  const overrides=Object.fromEntries(Object.entries(general).filter(([key,value])=>JSON.stringify(value)!==JSON.stringify(defaultFilters[key])));
  if(Object.keys(overrides).length)filters.filters=overrides;
  if(s.type==='discovery'&&JSON.stringify(s.discovery)!==JSON.stringify(defaultDiscovery))filters.discovery=s.discovery;
  if(Object.keys(filters).length)p.set('filters',JSON.stringify(filters));
  if(s.launchpadView&&s.launchpadView!=='launches')p.set('pad-view',s.launchpadView);
  if(s.launchpadSort&&s.launchpadSort!=='screen')p.set('pad-sort',s.launchpadSort);
  return url;
 }

 function readUrl(){
  const p=new URLSearchParams(location.search),type=p.get('stream')||'home',chain=p.get('chain'),id=sectionFor(type,p.get('section'));
  if(!publicTypes.has(type)||type==='chain'&&!Object.hasOwn(axoChainNames,chain))return null;
  if(type==='launchpad'&&!lpPlatforms.some(pad=>pad.id===id))return null;
  if(type==='news-topic'&&!id)return null;
  let scope={};
  const raw=p.get('filters');
  if(raw&&raw.length<1600)try{scope=JSON.parse(raw)||{};}catch{}
  let project;
  if(type==='project'){
   try{project=AxoStreamSchema.exact({chain,address:p.get('address'),pool:p.get('pool')},true);}catch{return null;}
  }
  return axoNormalizeStream({type,chain,id,project,filters:{...defaultFilters,...scope.filters},discovery:scope.discovery,timeframe:p.get('frame'),
   launchpadView:p.get('pad-view'),launchpadSort:p.get('pad-sort')});
 }

 const share=document.createElement('button');
 share.type='button';share.className='btn axo-stream-link';share.dataset.shareStream='';
 share.setAttribute('aria-label','Copy stream link');share.title='Copy stream link';
 share.innerHTML='<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M8 12l4-4M7 14l-1 1a2 2 0 0 1-3-3l4-4a2 2 0 0 1 3 0m0 4a2 2 0 0 0 3 0l4-4a2 2 0 0 0-3-3l-1 1"/></svg><span>Copy link</span>';
 document.querySelector('.axo-navigation-context [data-find-stream]').before(share);
 const css=document.createElement('style');
 css.textContent='.axo-stream-link{display:inline-flex;align-items:center;gap:4px}.axo-stream-link[hidden]{display:none}@media(max-width:550px){.axo-navigation-context .axo-stream-link{min-width:34px;justify-content:center}.axo-stream-link span{display:none}}';
 document.head.append(css);

 function remember(){
  const s=axoCaptureStream();
  entries.set(index,{stream:s,scroll:window.scrollY});
  if(entries.size>100)entries.delete(entries.keys().next().value);
  return s;
 }
 function syncBack(){
  axoStreamBack.length=0;
  const previous=entries.get(index-1);
  // The browser owns the earlier entry even when this page was reloaded.
  if(index>0)axoStreamBack.push(previous?.stream||{type:'home'});
  for(const button of document.querySelectorAll('[data-stream-back]'))button.disabled=index===0;
 }
 function publish(s,push=false){
  const url=publicUrl(s,location.href);
  const state={...history.state,axoNavigation:{session,index}};
  const marker=history.state?.axoNavigation;
  if(push)history.pushState(state,'',url);
  else if(url.href!==location.href||marker?.session!==session||marker?.index!==index)history.replaceState(state,'',url);
  share.hidden=!shareable(s);
  syncBack();
 }
 function go(value,push=true){
  const before=remember();
  navigating=true;
  try{
   const result=original(value,false);
   const after=axoCaptureStream();
   const changed=push&&axoShortcutSignature(before)!==axoShortcutSignature(after);
   if(changed){
    index++;
    for(const id of entries.keys())if(id>=index)entries.delete(id);
   }
   remember();
   publish(after,changed);
   scrollEpoch++;
   return result;
  }finally{navigating=false;}
 }
 axoGoStream=go;

 window.addEventListener('popstate',event=>{
  remember();
  const marker=event.state?.axoNavigation;
  index=hasPosition(marker)&&marker.session===session?marker.index:0;
  const previous=entries.get(index);
  const target=previous?.stream||readUrl()||{type:'home'};
  if(modalOpen)close();
  navigating=true;
  try{original({...target,restoreStream:true},false);}finally{navigating=false;}
  publish(remember());
  const epoch=++scrollEpoch;
  requestAnimationFrame(()=>{if(epoch===scrollEpoch)window.scrollTo({top:previous?.scroll||0,behavior:'instant'});});
 });
 window.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-stream-back]');
  if(!button||index===0||button.disabled)return;
  event.preventDefault();event.stopImmediatePropagation();
  history.back();
 },true);
 share.addEventListener('click',async()=>{
  const s=axoCaptureStream();
  if(!shareable(s))return;
  const base=new URL(location.pathname,location.origin);
  if(new URLSearchParams(location.search).get('view')==='compact-intel')base.searchParams.set('view','compact-intel');
  const url=publicUrl(s,base.href).href;
  try{await navigator.clipboard.writeText(url);toast('Stream link copied.');}
  catch{open('<h2 id="drawerTitle">Stream link</h2><label for="axoShareUrl">Copy this link</label><input id="axoShareUrl" class="wide" readonly value="'+esc(url)+'">');$('axoShareUrl')?.select();}
 });

 if(fields.some(key=>new URLSearchParams(location.search).has(key))){
  try{go(readUrl()||{type:'home'},false);}catch{go({type:'home'},false);}
 }else publish(remember());

 const renderBase=render;
 render=function(...args){
  const result=renderBase(...args);
  if(!navigating)publish(remember());
  return result;
 };
})();
