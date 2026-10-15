import assert from 'node:assert/strict';
import {runtimeDependency} from './axo-runtime.mjs';
const {chromium}=runtimeDependency('playwright'),browser=await chromium.launch({channel:process.env.AXO_BROWSER_CHANNEL||'chrome',headless:true});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const at=Date.now(),address='0x'+'1'.repeat(40),pair='0x'+'2'.repeat(40);
const fixture={id:'base:'+pair,chain:'base',address,pair,name:'Retained fixture',symbol:'KEEP',price:1,marketCap:200000,liquidity:100000,volume1:6000,volume24:30000,volume5:1000,seenAt:at,provider:'Test only',transactions:{m5:{buys:15,sells:5}},discoveryKinds:['degen'],discoveryRank:50,discoveryMemory:{firstSeen:at,fresh:true},screenReason:'Shared community interest · Core checks observed'};
fixture.sharedSecurity={chain:'base',address,status:'available',source:'GoPlus',receivedAt:at,checks:['is_honeypot','cannot_sell_all','owner_change_balance'].map(key=>({key,value:'0'}))};
let projects=[fixture];
await page.route('**/api/discovery-memory',r=>r.fulfill({json:{scope:'public-discovery',asOf:Date.now(),projects,remembered:[{...fixture,address:'0x'+'3'.repeat(40),id:'base:old-fixture',name:'Dated fixture',symbol:'OLD',seenAt:at-3600000}],retained:projects.length+1,community:'available'}}));
// The slow provider screen never supplies the first results: retained memory must render first.
await page.route('**/api/project-screens?**',async r=>{await new Promise(resolve=>setTimeout(resolve,1800));const u=new URL(r.request().url());await r.fulfill({json:{kind:u.searchParams.get('kind'),chain:null,projects:[],gaps:['Provider fixture unavailable'],status:'partial'}}).catch(()=>{});});
await page.route('**/api/events',r=>r.fulfill({contentType:'text/event-stream',body:'data: {}\n\n'}));
try{
 await page.goto('http://127.0.0.1:43187/?view=compact-intel',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof discoveryLoadMemory==='function'&&typeof AxoMarketIntel==='object');
 await page.evaluate(()=>axoGoStream({type:'discovery',discovery:{categories:['degen'],chains:['base'],liqMin:1000}}));
 await page.waitForFunction(()=>discoveryPicks().some(p=>p.symbol==='KEEP'),null,{timeout:1200});
 assert.match(await page.locator('[data-card="stream-data-discovery"]').innerText(),/retained discoveries/);
 assert.equal(await page.locator('.discovery-history').count(),1);
 assert.equal(await page.locator('.pc-card [data-pc-external="gmgn"]').first().getAttribute('href'),'https://gmgn.ai/base/token/'+address);
 projects.push({...fixture,id:'base:'+'0x'+'4'.repeat(40),pair:'0x'+'4'.repeat(40),address:'0x'+'5'.repeat(40),symbol:'NEXT',name:'New live fixture',seenAt:Date.now(),sharedSecurity:{...fixture.sharedSecurity,address:'0x'+'5'.repeat(40)}});
 await page.evaluate(()=>discoveryLoadMemory());await page.waitForFunction(()=>discoveryPicks().length===2);
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});await page.evaluate(()=>layout());await page.waitForTimeout(300);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 // Test insertion geometry independently from provider updates and card ranking.
 await page.setViewportSize({width:390,height:900});
 const result=await page.evaluate(async()=>{
  paused=true;stream.close();const board=$('board');board.replaceChildren();
  const make=id=>{const el=document.createElement('article');el.className='card';el.dataset.card=id;el.style.height='130px';el.textContent=id;return el;};
  const a=make('motion-a'),b=make('motion-b');board.append(a,b);layout();await new Promise(r=>setTimeout(r,300));const old=b.getBoundingClientRect().top;
  const c=make('motion-new');c.classList.add('new');board.insertBefore(c,b);layout();const finalY=new DOMMatrix(c.style.transform).m42,actual=c.getBoundingClientRect().top-board.getBoundingClientRect().top;
  const anim=c.getAnimations().flatMap(a=>a.effect.getKeyframes());await new Promise(r=>setTimeout(r,350));return {finalY,actual,old,newB:b.getBoundingClientRect().top,translated:anim.some(k=>typeof k.transform==='string'&&k.transform!=='none'),count:board.children.length};
 });
 assert.ok(Math.abs(result.finalY-result.actual)<4,JSON.stringify(result));assert.ok(result.newB>result.old+100);assert.equal(result.translated,false);assert.ok(result.count>=3);
 assert.deepEqual(errors,[]);
 console.log('PASS browser: Discovery renders retained projects before slow providers, adds live discoveries, shows dated history separately, links GMGN exactly, fits 320px, and reveals new cards at their final position while neighbours move.');
}finally{await browser.close();}
