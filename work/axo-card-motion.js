/* New cards reveal at their final packed position; only neighbours translate. */
(function(){
 const board=$('board'),known=new WeakSet([...board.children]),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const css=document.createElement('style');css.textContent='html[data-theme] #board>.card{transition:transform .24s ease-out,opacity .18s ease-out}html[data-theme] #board>.card.new{animation:none}@media(prefers-reduced-motion:reduce){html[data-theme] #board>.card{transition:none!important;animation:none!important}}';document.head.append(css);
 for(const el of board.children){el.style.transition='none';el.classList.remove('new');}void board.offsetHeight;requestAnimationFrame(()=>{for(const el of board.children)el.style.removeProperty('transition');});
 const base=layout;layout=function(...args){
  const arrivals=[...board.children].filter(el=>el.matches('.card')&&!known.has(el));
  for(const el of arrivals){known.add(el);el.style.transition='none';el.classList.remove('new');}
  const result=base(...args);
  if(arrivals.length){void board.offsetHeight;for(const el of arrivals){if(!reduce.matches)el.animate([{opacity:0,scale:'.985'},{opacity:1,scale:'1'}],{duration:180,easing:'ease-out'});requestAnimationFrame(()=>{if(el.isConnected)el.style.removeProperty('transition');});}}
  return result;
 };
})();
