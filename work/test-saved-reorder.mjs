import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

export async function testSavedReorder({window,document,c,mem,html}){
 const run=code=>vm.runInContext(code,c);
 const ids=()=>[...document.querySelectorAll('[data-saved-metric]')].map(el=>el.dataset.savedMetric);
 const stored=()=>JSON.parse(mem.get('axo-saved-metrics-v1')).map(r=>r.id);
 const card=id=>document.querySelector('[data-saved-metric="'+id+'"]');
 const grip=id=>document.querySelector('[data-reorder-metric="'+id+'"]');
 const emit=(el,type,props={})=>{const e=new window.Event(type,{bubbles:true,cancelable:true});Object.assign(e,props);el.dispatchEvent(e);return e};
 const source=await fs.readFile('work/axo-saved-metrics.js','utf8');
 assert.equal([...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].filter(m=>m[1].includes("const axoRailKey=")).length,1);
 assert.ok(html.includes(source),'served document embeds the exact source');
 run(`axoSavedMetrics=['capital','markets','sentiment'].map(id=>({id,title:titles[id]||id,chains:[],liquidity:1000,savedAt:Date.now()}));axoSaveMetrics();axoRenderSavedMetrics();var reorderWrites=0;var originalRailSet=localStorage.setItem;localStorage.setItem=(k,v)=>{if(k===axoRailKey)reorderWrites++;originalRailSet(k,v)};`);
 const originalCapital=card('capital'),originalGrip=grip('capital');
 let focused=null;const originalFocus=window.HTMLElement.prototype.focus;
 window.HTMLElement.prototype.focus=function(){focused=this};
 emit(originalGrip,'click');assert.ok(originalCapital.classList.contains('saved-selected'));
 assert.equal(emit(originalGrip,'keydown',{key:'ArrowDown'}).defaultPrevented,true);
 assert.deepEqual(ids(),['markets','capital','sentiment']);assert.deepEqual(stored(),ids());assert.equal(focused,originalGrip);
 assert.equal(card('capital'),originalCapital);assert.equal(grip('capital'),originalGrip);
 emit(originalGrip,'keydown',{key:'End'});assert.deepEqual(ids(),['markets','sentiment','capital']);
 const writes=run('reorderWrites');
 emit(originalGrip,'keydown',{key:'ArrowDown'});emit(originalGrip,'keydown',{key:'End'});
 for(const expr of ['axoMoveSavedMetric("missing",0)','axoMoveSavedMetric("capital",-1)','axoMoveSavedMetric("capital",3)','axoMoveSavedMetric("capital",1.5)'])assert.equal(run(expr),false);
 assert.equal(run('reorderWrites'),writes,'boundaries and invalid moves must not persist');
 emit(originalGrip,'keydown',{key:'Home'});emit(originalGrip,'keydown',{key:'ArrowUp'});
 assert.deepEqual(ids(),['capital','markets','sentiment']);
 run('axoSavedMetrics=axoReadSavedMetrics();axoRenderSavedMetrics()');assert.deepEqual(ids(),stored(),'reload reader retains manual order');
 run('snapshot.feeds["capital-base"]={status:"live",receivedAt:Date.now(),data:{delta:2345678,time:Date.now()}};render(true)');
 assert.match(originalCapital.textContent,/2.35m/);assert.deepEqual(ids(),stored());assert.equal(grip('capital'),originalGrip);
 // Measured rectangles let the DOM harness exercise real pointer event handlers.
 const list=document.getElementById('axoSavedList'),rail=list.closest('.utility-rail');
 const rect=(top,bottom,left=0,right=200)=>({top,bottom,left,right,width:right-left,height:bottom-top});
 list.getBoundingClientRect=()=>rect(0,300);rail.getBoundingClientRect=()=>rect(0,300);
 for(const el of list.children)el.getBoundingClientRect=()=>{const i=[...list.children].indexOf(el);return rect(i*100,i*100+90)};
 let capture=null;originalGrip.setPointerCapture=id=>{capture=id};originalGrip.hasPointerCapture=id=>capture===id;originalGrip.releasePointerCapture=()=>{capture=null};
 const pointer=(el,type,x,y,extra={})=>emit(el,type,{pointerId:7,button:0,isPrimary:true,clientX:x,clientY:y,...extra});
 const begin=()=>pointer(originalGrip,'pointerdown',20,20);
 begin();assert.equal(capture,7);pointer(document,'pointermove',20,270);
 assert.ok(originalCapital.classList.contains('saved-moving'));assert.ok(card('sentiment').classList.contains('saved-drop-after'));
 const beforeSummary=originalCapital.querySelector('.saved-open').innerHTML;
 run('snapshot.feeds["capital-base"].data.delta=3456789;render(true)');
 assert.equal(originalCapital.querySelector('.saved-open').innerHTML,beforeSummary,'no source replacement or layout changes mid-gesture');
 assert.equal(grip('capital'),originalGrip);assert.deepEqual(stored(),['capital','markets','sentiment'],'pointer preview does not commit');
 const focusBefore=run('axoFocusTopic');pointer(document,'pointerup',20,270);
 assert.deepEqual(ids(),['markets','sentiment','capital']);assert.deepEqual(stored(),ids());assert.equal(capture,null);
 assert.match(originalCapital.textContent,/3.46m/);assert.ok(!originalCapital.classList.contains('saved-moving'));assert.equal(document.querySelector('.saved-drop-after'),null);
 emit(originalGrip,'click',{detail:1});emit(originalCapital.querySelector('[data-remove-metric]'),'click',{detail:1});
 assert.deepEqual(ids(),['markets','sentiment','capital'],'release clicks do not open/remove');assert.equal(run('axoFocusTopic'),focusBefore);
 // No-op drops, cancellation, outside drops, secondary pointers and short clicks.
 const afterDragWrites=run('reorderWrites');
 pointer(originalGrip,'pointerdown',20,220);pointer(document,'pointermove',20,240);pointer(document,'pointerup',20,240);
 pointer(originalGrip,'pointerdown',20,220);pointer(document,'pointermove',20,20);emit(document,'keydown',{key:'Escape'});
 pointer(originalGrip,'pointerdown',20,220);pointer(document,'pointermove',20,20);pointer(document,'pointercancel',20,20);
 pointer(originalGrip,'pointerdown',20,220);pointer(document,'pointermove',20,20);emit(originalGrip,'lostpointercapture',{pointerId:7});
 pointer(originalGrip,'pointerdown',20,220);pointer(document,'pointermove',20,20);pointer(document,'pointerup',400,20);
 pointer(originalGrip,'pointerdown',20,220,{isPrimary:false});assert.equal(run('axoRailDrag'),null);
 pointer(originalGrip,'pointerdown',20,220);pointer(document,'pointermove',21,221);pointer(document,'pointerup',21,221);
 assert.equal(run('reorderWrites'),afterDragWrites);assert.deepEqual(ids(),stored());
 // A touch pointer uses the same path and can move a card to the first position.
 pointer(originalGrip,'pointerdown',20,220,{pointerType:'touch'});pointer(document,'pointermove',20,10,{pointerType:'touch'});pointer(document,'pointerup',20,10,{pointerType:'touch'});
 assert.deepEqual(ids(),['capital','markets','sentiment']);assert.deepEqual(stored(),ids());
 // Two-column hit testing and gaps must resolve a real before/after target.
 card('capital').getBoundingClientRect=()=>rect(0,90,0,90);card('markets').getBoundingClientRect=()=>rect(0,90,110,200);card('sentiment').getBoundingClientRect=()=>rect(100,190,0,90);
 assert.equal(run('axoSavedDropAt(150,20).card.dataset.savedMetric'),'markets');assert.equal(run('axoSavedDropAt(150,20).after'),false);
 assert.equal(run('axoSavedDropAt(150,80).after'),true);assert.equal(run('axoSavedDropAt(400,20)'),null);
 run('axoRailSuppressClickUntil=0');
 emit(originalCapital.querySelector('[data-open-metric]'),'click',{detail:0});assert.equal(run('axoFocusTopic'),'capital');
 emit(originalCapital.querySelector('[data-remove-metric]'),'click',{detail:0});assert.deepEqual(ids(),['markets','sentiment']);assert.deepEqual(stored(),ids());
 for(const id of ['markets','sentiment'])emit(document.querySelector('[data-remove-metric="'+id+'"]'),'click',{detail:0});
 assert.deepEqual(ids(),[]);assert.deepEqual(stored(),[]);assert.ok(document.querySelector('.saved-empty'));
 window.HTMLElement.prototype.focus=originalFocus;
 console.log('Saved reorder validation passed: keyboard, pointer/touch, persistence, boundaries, refresh stability, cancellation, click isolation, open/remove, exact inline source.');
}
