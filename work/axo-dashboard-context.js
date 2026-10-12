function axoDashboardIdentity(){return JSON.stringify(axoCaptureStream())}
/* Capture public references, never rendered prose, wallet balances or private profile data. */
function axoDashboardReferences(){
 const cards=[...document.querySelectorAll('#board>[data-card]')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').slice(0,24),projects=new Map(),researchKeys=[];
 const add=p=>{if(!p?.chain||!p.address||!p.pair||projects.size>=12)return;const ref={chain:p.chain,address:p.address,pool:p.pair};projects.set(JSON.stringify(ref),ref)};
 for(const el of cards){add(axoProjectMap.get(el.dataset.card));for(const row of el.querySelectorAll('[data-project-row]'))add(axoRowFind(row.dataset.projectRow));const r=[...axoResearchCards.values()].find(r=>r.id===el.dataset.card);if(r?.data?.key&&researchKeys.length<3)researchKeys.push(r.data.key)}
 if(axoStream.type==='project')add(axoStreamProject);
 if(axoStream.type==='watchlist')for(const p of axoWatch.slice(0,12))add(p);
 return {version:1,capturedAt:Date.now(),cards:cards.map(e=>e.dataset.card),projects:[...projects.values()],researchKeys,loading:cards.some(e=>e.getAttribute('aria-busy')==='true')||(axoStream.type==='chain'&&axoChains.jobs.has(axoStream.chain))};
}
async function axoAwaitDashboardContext(signal){
 const scope=axoDashboardIdentity(),jobs=[];
 if(axoStream.type==='chain'){const job=axoChains.jobs.get(axoStream.chain);if(job)jobs.push(job)}
 for(const r of axoResearchCards.values())if(r.loading&&r.pending&&document.querySelector('#board>[data-card="'+r.id+'"]')?.getClientRects().length)jobs.push(r.pending);
 let timer,onAbort;try{if(signal?.aborted)throw new DOMException('Request cancelled','AbortError');if(jobs.length)await Promise.race([Promise.allSettled(jobs),new Promise(resolve=>{timer=setTimeout(resolve,8000)}),new Promise((_,reject)=>{onAbort=()=>reject(new DOMException('Request cancelled','AbortError'));signal?.addEventListener('abort',onAbort,{once:true})})]);if(signal?.aborted||scope!==axoDashboardIdentity())throw new DOMException('The active stream changed; ask again in the new stream.','AbortError')}
 finally{clearTimeout(timer);if(onAbort)signal?.removeEventListener('abort',onAbort)}
 return {stream:axoCaptureStream(),dashboard:axoDashboardReferences()};
}
