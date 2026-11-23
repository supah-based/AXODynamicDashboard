import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {runtimeDependency} from './axo-runtime.mjs';
import {createTradingDesk} from './axo-trading-desk.mjs';
import Desk from './axo-trading-desk-model.cjs';

const {chromium}=runtimeDependency('playwright');
const html=await fs.readFile('outputs/axo-live-dashboard.html','utf8');
const backend=(await fs.readFile('work/axo-server.mjs','utf8'))+'\n'+await fs.readFile('work/axo-intelligence-runtime.mjs','utf8');
const files=new Set(await fs.readdir('work'));
const aliases=Object.fromEntries([...backend.matchAll(/['"](\/[\w-]+\.(?:js|css))['"]\s*:\s*['"]([\w.-]+)['"]/g)].map(m=>[m[1],m[2]]));
Object.assign(aliases,{'/ai.js':'axo-ai-client.js','/stream-schema.js':'axo-stream-schema.cjs','/project-cards.js':'axo-project-cards.js','/context.js':'axo-context.js','/reown.js':'axo-reown.bundle.js','/project-profile.js':'axo-profile-ui.js','/chain-overview-model.js':'axo-chain-overview.cjs'});
for(const m of backend.matchAll(/if\(u.pathname==='(\/[\w-]+\.(?:js|css))'[^)]*\)[\s\S]*?fs.readFile\(path.join\(root,'work','([\w.-]+)'\)\)/g))aliases[m[1]]=m[2];
aliases['/stablecoins.js']='axo-stablecoins.cjs';
const asset=path=>[aliases[path],'axo-'+path.slice(1),'axo-'+path.slice(1).replace(/\.js$/,'-ui.js'),'axo-'+path.slice(1).replace(/\.js$/,'.cjs')].find(f=>files.has(f));
const at=Date.now(),evm=(i,width=40)=>'0x'+i.toString(16).padStart(width,'0');
const names={solana:'Solana',base:'Base',bsc:'BNB Chain',robinhood:'Robinhood',arc:'Arc'};
const data=Desk.CHAIN_IDS.map((chain,i)=>{
 const address=chain==='solana'?'1'.repeat(31)+'2':evm(20+i);
 const pair=chain==='solana'?'2'.repeat(31)+'3':evm(40+i,chain==='arc'?64:40);
 return {
  id:chain+':'+pair,chain,address,pair,seenAt:at-30000,createdAt:at-5400000,provider:'GeckoTerminal',dex:'Fixture',
  name:names[chain]+' sample coin',symbol:'FIX'+(i+1),price:.025,marketCap:375000,fdv:990000,liquidity:51000,
  volume5:900,volume1:5500+i*200,volume6:40000,volume24:100000,change1:5,change24:chain==='arc'?-20:13,changes:{m5:2,h1:5,h24:chain==='arc'?-20:13},
  transactions:{m5:{buys:12,sells:7},h1:{buys:50,sells:26}},participants:{m5:{unique:11,buyers:8,sellers:6},h1:{unique:27}}
 };
});
const screening=createTradingDesk({
 getPools:()=>data,getChain:()=>({status:'available',sources:[{id:'top',provider:'GeckoTerminal',status:'available',fetchedAt:at-30000}]}),
 getMarkets:()=>({status:'live',receivedAt:at,data:[{symbol:'btc',price:63000,change:-1,sourceTime:new Date(at-30000).toISOString()}]})
});
const browser=await chromium.launch({channel:process.env.AXO_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:990},reducedMotion:'reduce'});
 const errors=[],preflights=[],onchain=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url()),path=url.pathname;
  if(url.hostname!=='axo-desk.test')return route.abort();
  if(path==='/')return route.fulfill({body:html,contentType:'text/html'});
  const file=asset(path);
  if(file)return route.fulfill({body:await fs.readFile('work/'+file),contentType:file.endsWith('.css')?'text/css':'text/javascript'});
  if(path==='/api/trading-desk')return route.fulfill({json:screening.snapshot()});
  if(path==='/api/dashboard')return route.fulfill({json:{version:3,chains:Desk.CHAIN_IDS.map(id=>({id,name:names[id]})),feeds:{},events:[],capabilities:{}}});
  if(path==='/api/stream-memory')return route.fulfill({json:{revision:0,shortcuts:[],tombstones:[],preferences:{},projects:[]}});
  if(path==='/api/trading-desk/contract'){
   const identity=Object.fromEntries(url.searchParams);
   onchain.push(identity);
   return route.fulfill({json:{identity,evidence:{status:'available',kind:'contract',provider:'Public RPC',height:72133,observedAt:Date.now(),decimals:18,amount:'9000000000'}}});
  }
  if(path==='/api/trade-setup'){
   const identity=Object.fromEntries(url.searchParams);
   preflights.push(identity);
   if(identity.chain==='base')return route.fulfill({json:{identity,riskExcluded:true,gaps:['Reported restriction']}});
   if(preflights.length===1)return route.fulfill({json:{identity,status:'queued',gaps:[]}});
   return route.fulfill({json:{identity,execution:{status:'quoted-route-observed',at:Date.now(),expiresAt:Date.now()+750,source:'LI.FI'},gaps:[]}});
  }
  if(path==='/api/chain'){
   const chain=url.searchParams.get('chain'),first=data.find(p=>p.chain===chain);
   const pools=chain==='base'?Array.from({length:11},(_,i)=>({...first,id:chain+':'+evm(510+i),address:evm(310+i),pair:evm(510+i),symbol:'PAGE'+(i+1),createdAt:at-(20-i)*3600000,liquidity:250000,volume24:90000+i,change24:20-i})):first?[first]:[];
   return route.fulfill({json:{chain,pools,asOf:at,status:'available',sources:[],news:{items:[]}}});
  }
  if(path.startsWith('/api/'))return route.fulfill({status:503,json:{error:'Public provider not connected in this browser test'}});
  return route.fulfill({status:404,body:''});
 });
 await page.goto('https://axo-desk.test/',{waitUntil:'load'});
 const view=page.locator('[data-trading-desk]'),rows=view.locator('[data-desk-row]');
 await rows.first().waitFor();
 assert.equal(await rows.count(),5);
 assert.equal(preflights.length,0);
 assert.equal(onchain.length,0);
 assert.equal(await view.locator('[data-desk-chain]').count(),6);
 await view.locator('[data-desk-pick]').nth(0).click();
 await view.locator('[data-desk-pick]').nth(1).click();
 await view.locator('[data-desk-compare]').click();
 const dialog=page.locator('.axo-desk-dialog');
 await dialog.getByRole('heading',{name:'Compare pools'}).waitFor();
 assert.equal(await dialog.locator('.axo-desk-compare-grid > section').count(),2);
 await page.keyboard.press('Escape');
 await view.locator('[data-desk-chain="arc"]').click();
 await view.locator('[data-desk-mode="rebound"]').click();
 assert.equal(await rows.count(),1);
 await rows.locator('[data-desk-inspect]').click();
 await dialog.getByRole('heading',{name:'Arc sample coin'}).waitFor();
 assert.match(await dialog.innerText(),/Unique traders \(5m \/ 1h\)[\s\S]*11 \/ 27/);
 await dialog.getByRole('button',{name:'Check entry & exit'}).click();
 await dialog.getByText('Entry and exit quotes observed').waitFor();
 const exactArc={chain:'arc',address:data[4].address,pool:data[4].pair};
 assert.deepEqual(preflights,[exactArc,exactArc]);
 await dialog.getByText('Current entry and exit evidence unavailable').waitFor();
 await dialog.getByText('Contract & pool',{exact:true}).click();
 await dialog.getByRole('button',{name:'Check on-chain facts'}).click();
 await dialog.getByText('Decimals 18 · Total issued supply 9000000000').waitFor();
 assert.deepEqual(onchain,[exactArc]);
 await dialog.getByRole('button',{name:'Follow',exact:true}).click();
 await dialog.getByRole('button',{name:'Following',exact:true}).waitFor();
 await dialog.getByRole('button',{name:'Set alert'}).click();
 await page.getByRole('heading',{name:'Create project alert'}).waitFor();
 await page.locator('#axoAlertThreshold').fill('0.05');
 await page.getByRole('button',{name:'Save alert'}).click();
 assert.equal(await page.evaluate(()=>axoAlertRules.find(r=>r.chain==='arc')?.pool),data[4].pair);
 await page.getByRole('button',{name:'Close detail panel'}).click();
 await rows.locator('[data-desk-inspect]').click();
 await dialog.getByRole('button',{name:'Following',exact:true}).waitFor();
 await dialog.getByRole('button',{name:'Review swap'}).click();
 await page.locator('.axo-trade-dialog[open]').waitFor();
 assert.equal(await page.evaluate(()=>tradeState.project.address),data[4].address);
 assert.equal(await page.evaluate(()=>tradeState.project.chain),'arc');
 await page.keyboard.press('Escape');
 await view.locator('[data-desk-mode="following"]').click();
 assert.equal(await rows.count(),1);
 assert.match(await rows.first().innerText(),/FIX5/);
 await view.locator('[data-desk-query]').fill('nobody');
 await view.getByText('No rows match this search and the selected filters.').waitFor();
 assert.equal(await view.locator('[data-desk-query]').evaluate(node=>node===document.activeElement),true);
 await view.locator('[data-desk-query]').fill('');
 await rows.first().waitFor();
 await view.locator('[data-desk-mode="active"]').click();
 await view.locator('[data-desk-chain=""]').click();
 await view.locator('[data-desk-chain="base"]').click();
 await rows.locator('[data-desk-inspect]').click();
 await dialog.getByRole('button',{name:'Check entry & exit'}).click();
 await dialog.getByText('Severe risk flag reported. Swap review is disabled for this pool.').waitFor();
 assert.equal(await dialog.getByRole('button',{name:'Review swap'}).isDisabled(),true);
 await page.keyboard.press('Escape');
 await view.locator('[data-desk-chain=""]').click();
 await page.locator('[data-card="stream-data-action-desk"]').scrollIntoViewIfNeeded();
 await page.screenshot({path:'outputs/axo-trading-desk-desktop.png',style:'#toast{visibility:hidden}'});
 for(const width of [390,320]){
  await page.setViewportSize({width,height:940});
  await page.evaluate(()=>layout());
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.equal(await view.locator('table').evaluate(node=>node.scrollWidth<=node.clientWidth+1),true,'Desk table fits '+width+'px');
  await page.locator('[data-card="stream-data-action-desk"]').scrollIntoViewIfNeeded();
  if(width===390)await page.screenshot({path:'outputs/axo-trading-desk-mobile.png',style:'#toast{visibility:hidden}'});
 }
 await page.reload({waitUntil:'load'});
 await view.locator('[data-desk-mode="active"][aria-pressed="true"]').waitFor();
 await page.setViewportSize({width:1440,height:990});
 await page.locator('[data-common-stream="base"]').click();
 await page.locator('[data-desk-entry]').waitFor();
 await page.locator('[data-pulse-unchecked]').check();
 await page.evaluate(()=>axoGoStream({type:'chain',chain:'base',id:'leaders'}));
 const ranking=page.locator('[data-card="stream-data-chain-base-ranking"]');
 await ranking.getByText(/Page 1 of 2/).waitFor();
 const before=await ranking.locator('[data-chain-project]').first().getAttribute('data-chain-project');
 await ranking.getByRole('button',{name:'Next',exact:true}).click();
 await ranking.getByText(/Page 2 of 2/).waitFor();
 assert.notEqual(await ranking.locator('[data-chain-project]').first().getAttribute('data-chain-project'),before);
 await page.locator('[data-desk-entry]').click();
 await view.locator('[data-desk-chain="base"][aria-pressed="true"]').waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS Chrome Trading Desk filters, comparison, exact and expiring preflight, RPC facts, watchlist, alerts, swap review, paging, persistence and mobile layout.');
}finally{await browser.close();}
