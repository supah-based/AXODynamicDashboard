import assert from 'node:assert/strict';
import {runtimeDependency} from './axo-runtime.mjs';

const {chromium}=runtimeDependency('playwright');
const browser=await chromium.launch({
  ...(process.env.AXO_BROWSER_EXECUTABLE
    ? {executablePath:process.env.AXO_BROWSER_EXECUTABLE}
    : process.env.AXO_BROWSER_CHANNEL==='chromium'
      ? {}
      : {channel:process.env.AXO_BROWSER_CHANNEL||'msedge'}),
  headless:true,
});
const page=await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce'});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const at=Date.now();
const row={
  id:'base:0x'+'2'.repeat(40),chain:'base',address:'0x'+'1'.repeat(40),pair:'0x'+'2'.repeat(40),
  name:'Five-chain fixture',symbol:'FIVE',liquidity:100000,marketCap:500000,price:0.05,
  volume1:10000,volume24:90000,change1:2,change24:5,createdAt:at-3600000,seenAt:at,
  buys:20,sells:10,provider:'Fixture',websites:[],socials:[],observationStatus:'available',
};
await page.route('**/api/discovery/control',route=>route.fulfill({json:{enabled:false,jobs:[],results:{},alerts:[]}}));
await page.route('**/api/social?**',route=>route.fulfill({json:{status:'unavailable',leads:[],observations:[]}}));
await page.route('**/api/project-screens?**',route=>{
  const url=new URL(route.request().url());
  return route.fulfill({json:{kind:url.searchParams.get('kind'),chain:url.searchParams.get('chain')||null,projects:[row],status:'available',gaps:[],at}});
});
try{
  await page.goto('http://127.0.0.1:43187/?view=compact-intel',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof discoveryPicks==='function');
  assert.equal(await page.locator('[data-common-stream="sniper"]').count(),1);
  assert.equal(await page.locator('[data-common-stream="degen"]').count(),1);
  await page.locator('[data-common-stream="sniper"]').click();
  assert.equal(await page.evaluate(()=>axoStream.id),'sniper');
  assert.deepEqual(await page.evaluate(()=>axoStream.discovery.categories),['sniper']);
  assert.deepEqual(await page.evaluate(()=>axoStream.discovery.chains),['solana','base','bsc','robinhood','arc']);
  assert.equal(await page.locator('[data-common-stream="sniper"]').getAttribute('aria-current'),'page');
  assert.equal(await page.locator('[data-common-stream="new"]').getAttribute('aria-current'),null);
  await page.locator('[data-common-stream="degen"]').click();
  assert.equal(await page.evaluate(()=>axoStream.id),'degen');
  assert.deepEqual(await page.evaluate(()=>axoStream.discovery.categories),['degen']);
  assert.deepEqual(await page.evaluate(()=>axoStream.discovery.chains),['solana','base','bsc','robinhood','arc']);
  assert.equal(await page.locator('[data-common-stream="degen"]').getAttribute('aria-current'),'page');
  assert.deepEqual(errors,[]);
  console.log('PASS five-chain Sniper and Degen stream presets with isolated active state.');
} finally {
  await browser.close();
}
