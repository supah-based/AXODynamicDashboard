/* Temporary reading anchors, not pins. Other cards continue reconciling around them. */
(function(){
 const board=$('board'),locks=new Map(),suppressed=new Set(),inspecting=new Set(),gap=12,idleMs=450;
 let pointer=null,pointerAt=0,pointerTimer=0,touch=null,selectionCards=new Set(),timer=0,pending=false,minHeight=0,scope='',layoutDepth=0,reservations=[];
 const hoverDelayMs=3000;
 function setPointer(el){if(pointer===el)return;clearTimeout(pointerTimer);pointer=el;pointerAt=performance.now();if(el)pointerTimer=setTimeout(()=>{sync();},hoverDelayMs+5);}
 const card=n=>n?.nodeType===3?card(n.parentElement):n?.closest?.('#board > .card[data-card]');
 const currentScope=()=>JSON.stringify([axoStream,selected,axoLiquidity,axoLens,mode,typeof axoFocusTopic==='undefined'?'':axoFocusTopic]);
 const expanded=el=>axoExpanded.has(el.dataset.card)||!!el.querySelector('.axo-inline-inspection')||inspecting.has(el)&&!!el.querySelector('details[open],[data-article-expand][aria-expanded="true"]');
 function selectedCards(){const s=getSelection(),out=new Set();if(s&&!s.isCollapsed)for(let i=0;i<s.rangeCount;i++){const r=s.getRangeAt(i);for(const el of board.children)if(el.matches('.card')&&r.intersectsNode(el))out.add(el);}return out;}
 function capture(el){if(!el?.isConnected||suppressed.has(el)||locks.has(el))return;const r=el.getBoundingClientRect();if(!r.width||!r.height)return;if(!locks.size)minHeight=board.offsetHeight;locks.set(el,{pageX:r.left+scrollX,pageY:r.top+scrollY,width:r.width,releaseAt:null});el.dataset.axoReading='true';}
 function remove(el){locks.delete(el);delete el.dataset.axoReading;}
 function sync(){
  const nextScope=currentScope();if(scope&&nextScope!==scope){reset();const previous=[...board.children];for(const el of previous)suppressed.add(el);requestAnimationFrame(()=>{for(const el of previous)suppressed.delete(el);sync();layout();});}scope=nextScope;
  const focus=card(document.activeElement);selectionCards=selectedCards();
  const hoverReady=pointer?.isConnected&&pointer.matches(':hover')&&performance.now()-pointerAt>=hoverDelayMs;
  for(const el of [hoverReady?pointer:null,touch,focus,...selectionCards,...[...board.children].filter(el=>el.matches('.card')&&expanded(el))])capture(el);
  const now=performance.now();for(const [el,s]of locks){if(!el.isConnected){remove(el);continue;}const held=!suppressed.has(el)&&(el===pointer&&hoverReady||el===touch||el===focus||selectionCards.has(el)||expanded(el));if(held)s.releaseAt=null;else if(s.releaseAt==null)s.releaseAt=now+idleMs;}
  clearTimeout(timer);const times=[...locks.values()].map(s=>s.releaseAt).filter(t=>t!=null);if(times.length)timer=setTimeout(release,Math.max(0,Math.min(...times)-now)+5);
 }
 function release(){sync();const now=performance.now();let released=false;for(const [el,s]of locks)if(s.releaseAt!=null&&s.releaseAt<=now){remove(el);rendered.delete(el.dataset.card);released=true;}if(released&&pending&&!paused&&!document.hidden){pending=false;render(true);}sync();}
 function reset(){clearTimeout(timer);clearTimeout(pointerTimer);for(const el of locks.keys())delete el.dataset.axoReading;locks.clear();inspecting.clear();pointer=null;pointerAt=0;touch=null;selectionCards.clear();pending=false;minHeight=0;reservations=[];}
 function sameShape(a,b){if(a.nodeType!==b.nodeType||a.nodeName!==b.nodeName)return false;if(a.nodeType===3)return true;if(a.nodeType!==1)return true;if(axoLiveNodeKey(a)!==axoLiveNodeKey(b)||a.childNodes.length!==b.childNodes.length)return false;return [...a.childNodes].every((n,i)=>sameShape(n,b.childNodes[i]));}
 const livePatch=window.axoPatchLiveCard,projectPatch=window.axoPatchProjectCard;
 function patch(target,fresh,apply){
  sync();if(!locks.has(target))return apply(target,fresh);
  pending=true;
  if(!selectionCards.has(target)&&sameShape(target,fresh)){livePatch(target,fresh);target.dataset.axoReading='true';return true;}
  // Requested async findings may arrive inside their existing status region without
  // replacing controls, focused nodes, selected text or the card being read.
  if(!selectionCards.has(target)){const old=[...target.querySelectorAll('[aria-live],[role="status"]')],next=[...fresh.querySelectorAll('[aria-live],[role="status"]')];if(old.length===next.length)for(let i=0;i<old.length;i++)if(!old[i].contains(document.activeElement)&&old[i].innerHTML!==next[i].innerHTML)livePatch(old[i],next[i]);}
  target.dataset.axoReading='true';return false;
 }
 window.axoPatchLiveCard=(a,b)=>patch(a,b,livePatch);window.axoPatchProjectCard=(a,b)=>patch(a,b,projectPatch);
 window.axoLayoutHold={active:()=>locks.size>0,held:el=>locks.has(el),reset,reconcile(cards){sync();const ids=new Set(cards.map(c=>c[0]));for(const el of locks.keys())if(!ids.has(el.dataset.card)&&!hidden.includes(el.dataset.card)){cards.push([el.dataset.card,rendered.get(el.dataset.card)||el.outerHTML]);pending=true;}return cards;}};
 const pack=axoPackDense;axoPackDense=function(items,count,g){return pack(items,count,g,layoutDepth?reservations:[]);};
 const baseLayout=layout;layout=function(...args){
  if(layoutDepth)return baseLayout(...args);sync();if(!locks.size)return baseLayout(...args);
  pending=true;const b=board.getBoundingClientRect(),count=Math.max(1,Math.min(5,Math.floor((board.clientWidth+gap)/294))),cw=(board.clientWidth-gap*(count-1))/count;
  reservations=[...locks].map(([el,s])=>{const x=s.pageX-scrollX-b.left,y=s.pageY-scrollY-b.top,col=Math.max(0,Math.min(count-1,Math.floor((x+.1)/(cw+gap)))),end=Math.max(col+1,Math.min(count,Math.ceil((x+s.width-.1)/(cw+gap))));return {el,col,span:end-col,y,height:el.offsetHeight,x,width:s.width};});
  layoutDepth++;try{baseLayout(...args);for(const r of reservations){r.el.style.width=r.width+'px';r.el.style.transform='translate('+r.x+'px,'+r.y+'px)';r.el.dataset.axoReading='true';}board.style.height=Math.max(minHeight,parseFloat(board.style.height)||0,...reservations.map(r=>r.y+r.el.offsetHeight))+'px';
   // A decorative filler never occupies a held card's real, possibly fractional footprint.
   for(const art of board.querySelectorAll('[data-axo-brand-gap]')){const a=art.getBoundingClientRect();if(reservations.some(r=>{const c=r.el.getBoundingClientRect();return a.left<c.right&&a.right>c.left&&a.top<c.bottom&&a.bottom>c.top;}))art.remove();}
  }finally{layoutDepth--;reservations=[];}
 };
 const baseRender=render;render=function(...args){sync();return baseRender(...args);};
 const go=axoGoStream;axoGoStream=function(...args){if(card(document.activeElement))document.activeElement.blur();if(selectedCards().size)getSelection().removeAllRanges();reset();return go(...args);};
 // Capture current geometry before any deliberate control changes it. The clicked
 // card is temporarily released so expanding, closing and editing remain immediate.
 document.addEventListener('click',e=>{const el=card(e.target);if(e.target.closest('[data-pin],[data-hide],[data-drag],[data-reset],[data-mode],[data-chain],#reset')){reset();return;}if(!el)return;suppressed.add(el);remove(el);requestAnimationFrame(()=>{suppressed.delete(el);if(e.target.closest('summary,[data-article-expand]')){if(el.querySelector('details[open],[data-article-expand][aria-expanded="true"]'))inspecting.add(el);else inspecting.delete(el);}sync();layout();});},true);
 board.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const el=card(e.target);if(el&&el!==pointer){setPointer(el);sync();}});
 board.addEventListener('pointerout',e=>{if(e.pointerType==='touch')return;if(pointer&&!pointer.contains(e.relatedTarget)){setPointer(card(e.relatedTarget));sync();}});
 document.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'){touch=card(e.target);sync();}else if(!board.contains(e.target)){setPointer(null);touch=null;sync();}},true);
 document.addEventListener('pointercancel',()=>{touch=null;sync();},true);
 document.addEventListener('focusin',sync);document.addEventListener('focusout',()=>queueMicrotask(sync));document.addEventListener('selectionchange',sync);
 board.addEventListener('toggle',sync,true);document.addEventListener('dragstart',reset,true);document.addEventListener('dragend',()=>{reset();requestAnimationFrame(()=>{sync();render(true);});},true);
 window.addEventListener('blur',()=>{setPointer(null);touch=null;sync();});
 window.addEventListener('scroll',()=>{if(touch){const r=touch.getBoundingClientRect();if(r.bottom<=28||r.top>=innerHeight){touch=null;sync();}}},{passive:true});
 let width=board.clientWidth;window.addEventListener('resize',()=>{if(Math.abs(board.clientWidth-width)>1){width=board.clientWidth;reset();suppressed.add(card(document.activeElement));layout();requestAnimationFrame(()=>{suppressed.clear();sync();});}});
 const css=document.createElement('style');css.textContent='#board{overflow-anchor:none}html[data-theme] body #board>.card[data-axo-reading="true"]{transition:none!important;animation:none!important;outline:1px solid color-mix(in srgb,var(--axo-reading-lime,#86b83f) 80%,transparent);outline-offset:1px;box-shadow:0 0 12px color-mix(in srgb,var(--axo-reading-lime,#86b83f) 22%,transparent)}';document.head.append(css);scope=currentScope();
})();
