import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {runtimeDependency} from './axo-runtime.mjs';
const {chromium}=runtimeDependency('playwright'),browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
const now=Date.now(),p={id:'base:rich-fixture',chain:'base',address:'0x'+'1'.repeat(40),pair:'0x'+'2'.repeat(40),symbol:'TEST',name:'Rich project fixture',provider:'Synthetic fixture',seenAt:now,holders:100,holdersAt:now,holderSource:'Synthetic fixture',holderHistory:[{at:now-86400000,count:105,source:'Synthetic fixture'},{at:now,count:100,source:'Synthetic fixture'}],marketCap:null,fdv:999999999,price:0,liquidity:123456,volume24:98765,volume1:0,changes:{h1:2,h6:null,h24:-4},transactions:{h1:{buys:0,sells:12}},createdAt:now-3*86400000,bannerUrl:'https://cdn.dexscreener.com/cms/images/fixture-banner.png',imageUrl:'https://cdn.dexscreener.com/cms/images/fixture-logo.png'};
await page.route('https://cdn.dexscreener.com/**',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="240"><rect width="800" height="240" fill="#59796a"/><path d="M0 220L700 40" stroke="#c6ed7c" stroke-width="80"/></svg>'}));
await page.route('**/api/project?**',r=>r.fulfill({status:503,json:{error:'Fixture source unavailable'}}));
await page.route('**/api/security?**',r=>r.fulfill({json:{status:'unavailable'}}));
await page.route('**/api/ohlcv?**',r=>r.fulfill({json:{status:'unavailable',candles:[]}}));
await page.route('**/api/discovery/control',r=>r.fulfill({json:{enabled:false,jobs:[],results:{},alerts:[]}}));
try{
 await page.goto('http://127.0.0.1:43187/?view=compact-intel',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof axoListEvidence==='function');
 const result=await page.evaluate(p=>{axoWatch=[p];axoStream={type:'discovery'};return {row:axoProjectRow(p),watch:watchOverviewMarkup(),discovery:axoDiscoveryRows([p]),unknown:axoListEvidence({...p,createdAt:Date.now()+86400000,transactions:{h1:{buys:null,sells:null}},buys:null,sells:null,holderHistory:[]},['poolAge','holderDelta','trades'])}},p);
 assert.match(result.row,/apr-banner/);assert.match(result.row,/Market cap unavailable/);assert.ok(!result.row.includes('999.9M'));assert.match(result.row,/Holders Δ ~1d<b>-5/);assert.match(result.row,/Buys \/ sells · 1h<b>0 \/ 12/);assert.match(result.row,/Vol 1h<b>\$0/);assert.match(result.row,/data-list-metric="h6"[^>]*>6h<b>—/);assert.match(result.unknown,/Pool age<b>—/);assert.match(result.unknown,/Holders Δ ~1d<b>—/);assert.match(result.unknown,/Buys \/ sells · 1h<b>— \/ —/);
 checks.push('Independent price windows, zero activity, negative holder delta, missing MC without FDV, missing history and future pool timestamps');
 for(const [kind,html]of Object.entries({row:result.row,watch:result.watch,discovery:result.discovery}))for(const width of [1440,390,320])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:1000});await page.evaluate(({html,theme})=>{document.documentElement.dataset.theme=theme;paused=true;document.querySelector('#board').innerHTML=shell('fixture-rich','Project list test','Synthetic values for layout verification',html);layout()},{html,theme});await page.waitForTimeout(120);
  const card=page.locator('[data-card="fixture-rich"]');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),kind+' page width '+width);assert.ok(await card.evaluate(e=>e.scrollWidth<=e.clientWidth+1),kind+' card width '+width);assert.ok(await card.locator('.axo-list-evidence').evaluateAll(es=>es.every(e=>e.scrollWidth<=e.clientWidth+1)),kind+' metric width '+width);
  if(width===390)await card.screenshot({path:'outputs/axo-rich-list-'+kind+'-'+theme+'-390.png'});checks.push({kind,width,theme});
 }
 await page.evaluate(p=>{axoWatch=[p];axoGoStream({type:'watchlist'});render(true)},p);await page.locator('[data-watch-stream-project]').first().click();assert.equal(await page.evaluate(()=>axoStream.project.address),p.address);
 await page.evaluate(p=>{document.querySelector('#board').innerHTML=shell('fixture-rich','Project list test','Synthetic',axoProjectRow(p));layout()},p);await page.locator('.apr-open').click();assert.equal(await page.evaluate(()=>axoStream.project.pool),p.pair);
 assert.deepEqual(errors,[]);await fs.writeFile('outputs/axo-rich-project-lists-verification.json',JSON.stringify({passed:true,checks,errors,mode:'Synthetic public project fixtures; no market claims or live model use'},null,2));console.log('PASS richer project lists, exact clicks, honest metrics, three widths and two themes');
}finally{await browser.close()}
