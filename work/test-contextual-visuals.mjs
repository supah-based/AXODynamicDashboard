import assert from 'node:assert/strict';
import {runtimeDependency} from './axo-runtime.mjs';
const {chromium}=runtimeDependency('playwright');
const b=await chromium.launch({channel:'msedge',headless:true}),p=await b.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
p.on('pageerror',e=>errors.push(e.message));
await p.route('**/api/discovery/control',r=>r.fulfill({json:{enabled:false,jobs:[],results:{},alerts:[]}}));
await p.route('**/api/social?**',r=>r.fulfill({json:{status:'unavailable',leads:[],observations:[]}}));
try{
 await p.goto('http://127.0.0.1:43187/?view=compact-intel');await p.waitForSelector('.axo-metric-visual');
 const model=await p.evaluate(()=>{
  const original=feed('markets').data,now=Date.now();feed('markets').data=[{id:'bitcoin',price:8,change:1,points:[4,7,5,8],sourceTime:new Date(now).toISOString()}];axoFocusRender();
  const tile=document.querySelector('[data-context-tile="markets"]'),history=tile.dataset.metricKind,colors=new Set([...tile.querySelectorAll('path')].map(x=>x.getAttribute('stroke')).filter(Boolean));
  tile.focus();feed('markets').data[0].points=[8];axoFocusRender();const single=tile.dataset.metricKind,retained=document.activeElement===tile;
  feed('markets').data=original;axoFocusRender();
  return {history,colors:[...colors],single,retained,empty:axoMetricSpark([{value:null}], 'x','fixture',true),zero:axoMetricShare(0,8,'sample','fixture'),bad:axoMetricShare(8,0,'sample','fixture')};
 });
 assert.equal(model.history,'history');assert.ok(model.colors.includes('var(--metric-up)')&&model.colors.includes('var(--metric-down)'));assert.equal(model.single,'status');assert.ok(model.retained);assert.equal(model.empty,null);assert.equal(model.bad,null);assert.match(model.zero.detail,/0 of 8/);assert.doesNotMatch(model.zero.svg,/width="0"/);
 const metrics=await p.evaluate(()=>[...document.querySelectorAll('#axoFocus [data-context-tile]')].map(e=>({color:e.style.getPropertyValue('--nav-accent'),bg:getComputedStyle(e).backgroundImage,title:e.title,visuals:e.querySelectorAll('.axo-metric-visual').length})));
 assert.equal(metrics.length,10);assert.ok(new Set(metrics.map(m=>m.color)).size>=6);assert.ok(metrics.every(m=>m.bg.includes('gradient')&&m.visuals===1&&m.title.includes('Visual:')));
 for(const scope of ['chain','launchpad','project','watchlist','news']){
  await p.evaluate(scope=>{
   paused=true;const now=Date.now();axoStream=axoNormalizeStream({type:scope,chain:scope==='chain'?'solana':scope==='launchpad'?'bsc':null,id:scope==='launchpad'?'four-meme':null,project:scope==='project'?{chain:'base',address:'0x'+'1'.repeat(40),pool:'0x'+'2'.repeat(40)}:null});
   if(scope==='chain')axoChains.data.set('solana',{chain:'solana',asOf:now,status:'available',pools:[],launchpads:[],news:{items:[],sources:[]},dex:{status:'live',source:'Fixture',receivedAt:now,data:{volume:4,history:[{time:now-86400000,value:3},{time:now,value:4}]}},capital:{status:'live',source:'Fixture',receivedAt:now,data:{current:8,history:[{time:now-86400000,value:10},{time:now,value:8}]}}});
   if(scope==='launchpad')lp.data.set(lpKey(),{asOf:now,projects:Array(10).fill({}),screens:{fresh:[1,2],curves:[1,2,3],momentum:[],winners:[],sustained:[],holders:[],activity:[],reported:[]}});
   if(scope==='project'){axoStreamProject={price:3,volume1:10,liquidity:100,marketCap:null};axoChartData={status:'available',provider:'Fixture',fetched:now,timeframe:'1h',candles:[[now/1000-3600,2,3,1,2,5],[now/1000,3,4,2,3,10]]}}
   if(scope==='watchlist')axoWatch=[{chain:'base',address:'0x1',seenAt:now},{chain:'solana',address:'A',seenAt:now-3600000}];
   axoFocusRender();
  },scope);
  assert.equal(await p.locator('#axoFocus [data-context-tile]').count(),10,scope);
  assert.equal(await p.locator('#axoFocus .axo-metric-visual').count(),10,scope);
  if(scope==='chain'){assert.equal(await p.locator('[data-context-tile="chainvolume"]').getAttribute('data-metric-kind'),'history');assert.equal(await p.locator('[data-context-tile="overview"]').getAttribute('aria-pressed'),'true')}
  if(scope==='launchpad'){assert.match(await p.locator('[data-context-tile="lp-fresh"]').getAttribute('title'),/2 of 10/);assert.equal(await p.locator('[data-context-tile="lp-fresh"]').getAttribute('aria-pressed'),'true')}
  if(scope==='project'){assert.equal(await p.locator('[data-context-tile="price"]').getAttribute('data-metric-kind'),'history');assert.equal(await p.locator('[data-context-tile="liquidity"]').getAttribute('data-metric-kind'),'status');assert.match(await p.locator('[data-context-tile="price"]').getAttribute('title'),/UTC/)}
  if(scope==='watchlist')assert.match(await p.locator('[data-context-tile="watch-fresh"]').getAttribute('title'),/1 of 2/);
  for(const theme of ['dark','light'])for(const width of [1440,390,320]){
   await p.setViewportSize({width,height:1000});await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);
   await p.waitForTimeout(250);const fits=await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);if(!fits){console.log(await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,wide:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&!e.closest('#axoFocus')).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,w:e.getBoundingClientRect().width}))})));await p.screenshot({path:'outputs/contextual-test-overflow.png'})}assert.ok(fits,scope+' '+theme+' '+width);
   assert.ok(await p.locator('[data-context-tile]').first().evaluate(e=>{const r=e.getBoundingClientRect(),v=e.querySelector('.axo-metric-visual').getBoundingClientRect(),c=e.querySelector('small').getBoundingClientRect();return r.height>=44&&r.height<=90&&v.top<c.top&&v.bottom>=c.bottom&&getComputedStyle(e.querySelector('.axo-metric-visual')).pointerEvents==='none'}),scope+' background stays within compact button and cannot intercept input');
  }
 }
 await p.locator('[data-context-tile]').first().focus();await p.keyboard.press('Tab');assert.ok(await p.evaluate(()=>document.activeElement.matches('[data-context-tile]')));
 assert.deepEqual(errors,[]);console.log('PASS: contextual color survives all renderers/themes/widths; real two-tone history, no fabricated single-point curve, dated source explanations, proportional counts, selected state, focus retained, keyboard targets, background graphics with overlaid text.');
}finally{await b.close()}

