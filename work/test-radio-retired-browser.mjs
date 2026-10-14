import assert from 'node:assert/strict';
import {runtimeDependency} from './axo-runtime.mjs';
const {chromium}=runtimeDependency('playwright'),browser=await chromium.launch({channel:process.env.AXO_BROWSER_CHANNEL||'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'}),errors=[],radioRequests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/\/api\/radio\//.test(r.url()))radioRequests.push(r.url());});
await page.addInitScript(()=>{localStorage.setItem('axo-stream-shortcuts-v1',JSON.stringify([{id:'legacy-radio',name:'Axo Radio',updatedAt:Date.now(),stream:{type:'radio'}}]));});
await page.route('**/api/ai/**',r=>r.fulfill({status:503,json:{error:'No real voice/provider use in layout test'}}));
try{
 await page.goto('http://127.0.0.1:43187/?view=compact-intel',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof axoStartLive==='function'&&typeof axoRibbonRender==='function');
 assert.equal(await page.locator('#radio,#axoRadioPanel,#adminRadioEnabled').count(),0);assert.equal(await page.locator('[data-common-stream]').count(),19);assert.equal(await page.locator('#walletButton,#axoPortfolioButton,#axoCredits').count(),3);assert.equal(await page.locator('#askForm').isVisible(),true);
 assert.equal(await page.evaluate(()=>typeof axoEndLive==='function'&&typeof axoSendLiveGuidance==='function'),true);
 const legacy=await page.evaluate(()=>({type:axoNormalizeStream({type:'radio',chain:'base'}).type,chain:axoNormalizeStream({type:'radio',chain:'base'}).chain,visible:axoStreamCardVisible('stream-data-radio-station')}));assert.deepEqual(legacy,{type:'home',chain:null,visible:false});
 const link=page.locator('[data-stream-shortcut="legacy-radio"]');assert.match(await link.getAttribute('title'),/retired/);await link.click();assert.equal(await page.evaluate(()=>axoStream.type),'home');
 for(const theme of ['dark','light'])for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});await page.evaluate(t=>{document.documentElement.dataset.theme=t;layout();},theme);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.locator('#askForm').isVisible(),true);}
 await page.waitForTimeout(11000);assert.deepEqual(radioRequests,[],'No legacy listener/polling calls');assert.deepEqual(errors,[]);
 const response=await page.request.get('http://127.0.0.1:43187/api/radio/status');assert.equal(response.status(),410);assert.equal((await response.json()).status,'retired');
 console.log('PASS Radio-free desktop/390/320 light/dark layout, 19 streams and Ask Axo retained, old saved Radio safely opens Market home, no polling and retired backend 410.');
}finally{await browser.close();}
