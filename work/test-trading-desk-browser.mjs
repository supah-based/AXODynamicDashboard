import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {runtimeDependency} from './axo-runtime.mjs';
import {createTradingDesk} from './axo-trading-desk.mjs';
import Desk from './axo-trading-desk-model.cjs';

const {chromium}=runtimeDependency('playwright');
const html=await fs.readFile('outputs/axo-live-dashboard.html','utf8');
const chainAppearance=JSON.parse(await fs.readFile('work/axo-chain-palette.json','utf8'));
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
 const change1=[2.1,3.2,-8.7,4.1,5][i];
 return {
  id:chain+':'+pair,chain,address,pair,seenAt:at-30000,createdAt:at-5400000,provider:'GeckoTerminal',dex:'Fixture',
  name:names[chain]+' sample coin',symbol:'FIX'+(i+1),price:.025,marketCap:375000,fdv:990000,liquidity:51000,
  volume5:900,volume1:5500+i*200,volume6:40000,volume24:100000,change1,change24:chain==='arc'?-20:13,changes:{m5:2,h1:change1,h24:chain==='arc'?-20:13},
  transactions:{m5:{buys:12,sells:7},h1:{buys:50,sells:26},h24:i===2?{buys:800,sells:null}:{buys:700+i*20,sells:560+i*50}},participants:{m5:{unique:11,buyers:8,sellers:6},h1:{unique:27}}
 };
});
const screening=createTradingDesk({
 getPools:()=>data,getChain:chain=>({status:'available',sources:[{id:'top',provider:'GeckoTerminal',status:'available',fetchedAt:at-30000}],
  dex:{status:'live',source:'DefiLlama',receivedAt:at-30000,data:{volume:8250000,change:[5,12,-1.8,4.1,2][Desk.CHAIN_IDS.indexOf(chain)]}}}),
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
  const assetType=path.match(/^\/assets\/[a-z0-9_-]+\.(gif|png|webp|svg)$/i)?.[1];
  if(assetType){
   const body=await fs.readFile('outputs'+path).catch(()=>null);
   if(body)return route.fulfill({body,contentType:'image/'+(assetType==='svg'?'svg+xml':assetType)});
  }
  if(path==='/api/trading-desk')return route.fulfill({json:screening.snapshot()});
  if(path==='/api/dashboard')return route.fulfill({json:{version:3,chains:Desk.CHAIN_IDS.map(id=>({id,name:names[id]})),chainAppearance,feeds:{},events:[],capabilities:{}}});
  if(path==='/api/stream-memory')return route.fulfill({json:{revision:0,shortcuts:[],tombstones:[],preferences:{},projects:[]}});
  if(path==='/api/project'){
   const {chain,address,pool}=Object.fromEntries(url.searchParams);
   const p=data.find(p=>p.chain===chain&&p.address===address&&p.pair===pool);
   if(!p)return route.fulfill({status:404,json:{error:'No exact fixture'}});
   return route.fulfill({json:{project:{chain,address,pool},market:{status:'available',primary:p},pools:[p],identity:{name:p.name,symbol:p.symbol,links:[]},
    onchain:{simulation:{status:'unavailable'}},enrichment:{gmgn:{status:'not_configured'}},receivedAt:at}});
  }
  if(path==='/api/trading-desk/contract'){
   const identity=Object.fromEntries(url.searchParams);
   onchain.push(identity);
   const observedAt=Date.now();
   return route.fulfill({json:{identity,evidence:{status:'available',kind:'contract',provider:'Alchemy',height:72133,observedAt,decimals:18,amount:'9000000000',
    metadata:{name:'Arc sample coin',symbol:'FIX5',observedAt}}}});
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
 const signalCards=view.locator('[data-desk-signal-cards]');
 await signalCards.getByText('250 buys').waitFor();
 assert.match(await signalCards.innerText(),/5\/5 current pools with both metrics/);
 assert.match(await signalCards.innerText(),/4 up · 1 down/);
 assert.equal(await signalCards.getByRole('button',{name:/Inspect/}).first().getAttribute('aria-label'),'Inspect FIX3 on BNB Chain');
 await signalCards.getByRole('button',{name:'Inspect FIX3 on BNB Chain'}).click();
 await page.getByRole('heading',{name:'BNB Chain sample coin'}).waitFor();
 await page.keyboard.press('Escape');
 await signalCards.getByRole('button',{name:'24h',exact:true}).click();
 await signalCards.getByText('24h trades · 4/5 current pools',{exact:true}).waitFor();
 await signalCards.getByRole('button',{name:'1h',exact:true}).click();
 await page.keyboard.press('/');
 assert(await view.locator('[data-desk-query]').evaluate(el=>document.activeElement===el));
 await view.locator('[data-desk-query]').fill(data[4].pair);
 await view.getByText('1 matching pool in the sample',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>axoDashboardReferences().projects.filter(x=>x.chain==='arc')), [{chain:'arc',address:data[4].address,pool:data[4].pair}]);
 await view.locator('[data-desk-query]').fill('');
 await view.getByText('5 matching pools in the sample',{exact:true}).waitFor();
 const sort=view.locator('[data-desk-sort="change1"]');
 await sort.click();
 assert.equal(await sort.locator('..').getAttribute('aria-sort'),'descending');
 assert.match(await rows.first().innerText(),/FIX5/);
 await sort.click();
 assert.equal(await sort.locator('..').getAttribute('aria-sort'),'ascending');
 assert.match(await rows.first().innerText(),/FIX3/);
 await sort.click();
 assert.equal(await sort.locator('..').getAttribute('aria-sort'),null);
 await page.evaluate(()=>document.activeElement.blur());
 const firstResultPositions=[];
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:844});
  await page.evaluate(async()=>{window.scrollTo({top:0,behavior:'instant'});layout();await new Promise(requestAnimationFrame);});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  const firstResult=await page.evaluate(()=>({
   pool:Math.round(document.querySelector('[data-desk-row]').getBoundingClientRect().top),
   end:Math.round(document.querySelector('[data-desk-row]').getBoundingClientRect().bottom),
   ask:Math.round(innerHeight-parseFloat(getComputedStyle(document.body,'::after').height))
  }));
  assert(firstResult.end<=firstResult.ask,'The full first pool is visible above Ask Axo at '+width+'px '+JSON.stringify(firstResult));
  firstResultPositions.push({width,firstResult:firstResult.pool,resultEnd:firstResult.end,ask:firstResult.ask});
  if(width!==320)await page.screenshot({path:'outputs/axo-streams-redesign-'+(width===1440?'desktop':'mobile')+'.png',style:'#toast{visibility:hidden}.card[data-axo-reading]{outline:none!important;box-shadow:none!important}'});
 }
 await page.evaluate(()=>{document.documentElement.dataset.theme='light';layout();});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'The light theme fits at 320px');
 const observationRows=await page.locator('.axo-token-observation').locator(':scope > *').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().top));
 assert.equal(observationRows.length,4);
 assert(Math.max(...observationRows)-Math.min(...observationRows)<2,'All four AXO readings share one row on narrow screens');
 await page.evaluate(()=>{document.documentElement.dataset.theme='dark';layout();});
 const chainPicker=view.locator('[data-desk-chain-picker]');
 await chainPicker.selectOption('arc');
 assert.equal(await rows.count(),1);
 assert.equal(await signalCards.isVisible(),false);
 await view.locator('[data-desk-signals-toggle]').click();
 await signalCards.getByText('50 buys').waitFor();
 await signalCards.getByRole('button',{name:'5m',exact:true}).click();
 await signalCards.getByText('12 buys').waitFor();
 await signalCards.getByRole('button',{name:'1h',exact:true}).click();
 await view.locator('[data-desk-signals-toggle]').click();
 await view.locator('[data-desk-filter-label]').click();
 await view.locator('[data-desk-sort-picker]').selectOption('change1:asc');
 assert.equal(await view.locator('[data-desk-sort-picker]').inputValue(),'change1:asc');
 await view.locator('[data-desk-liquidity]').selectOption('100000');
 await view.getByText(/Nothing meets this screen/).waitFor();
 await view.getByRole('button',{name:'Reset filters'}).click();
 await rows.first().waitFor();
 assert.equal(await view.locator('[data-desk-sort-picker]').inputValue(),'');
 await view.locator('[data-desk-filter-label]').click();
 await chainPicker.selectOption('');
 await page.setViewportSize({width:1440,height:990});
 const context=page.locator('.axo-market-context.home > summary');
 assert.equal(await page.locator('#axoFocus').isVisible(),false);
 await context.click();
 assert.equal(await page.locator('#axoFocus').isVisible(),true);
 await context.click();
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
 await page.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:'https://axo-desk.test'});
 await dialog.getByRole('button',{name:'Copy contract'}).click();
 await dialog.getByText('Contract copied.').waitFor();
 assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),exactArc.address);
 await dialog.getByRole('button',{name:'Copy pool'}).click();
 await dialog.getByText('Pool copied.').waitFor();
 assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),exactArc.pool);
 await dialog.getByRole('button',{name:'Check on-chain facts'}).click();
 await dialog.getByText('Decimals 18 · Total issued supply 9000000000').waitFor();
 await dialog.getByText('Alchemy Token API · Arc sample coin · FIX5').waitFor();
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
 assert.equal(await view.locator('[data-desk-ref]').count(),0,'Personal following rows stay out of the public dashboard references');
 await view.locator('[data-desk-query]').fill('nobody');
 await view.getByText('No rows match this search and the selected filters.').waitFor();
 assert.equal(await view.locator('[data-desk-query]').evaluate(node=>node===document.activeElement),true);
 await view.getByRole('button',{name:'Clear search'}).click();
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
 await page.goBack();
 await ranking.waitFor();
 assert.equal(new URL(page.url()).searchParams.get('section'),'leaders');
 assert.equal(await page.locator('[data-common-stream="base"]').getAttribute('aria-current'),'page');
 await page.reload({waitUntil:'load'});
 assert.equal(await page.evaluate(()=>axoStream.id),'leaders');
 await page.getByRole('button',{name:/Find stream/}).click();
 await page.getByRole('searchbox',{name:'Search streams and saved shortcuts'}).fill('BSC');
 await page.getByRole('button',{name:/BNB Chain market/}).last().click();
 assert.equal(new URL(page.url()).searchParams.get('chain'),'bsc');
 await page.getByRole('button',{name:'Back to previous stream',exact:true}).click();
 await page.waitForURL(url=>url.searchParams.get('section')==='leaders');
 await page.evaluate(()=>axoGoStream({type:'discovery',discovery:{chains:['arc'],liqMin:25000,mcMax:3000000}}));
 assert.equal(new URL(page.url()).searchParams.get('stream'),'discovery');
 await page.reload({waitUntil:'load'});
 assert.deepEqual(await page.evaluate(()=>[axoStream.type,axoStream.discovery.chains,axoStream.discovery.liqMin,axoStream.discovery.mcMax]),['discovery',['arc'],25000,3000000]);
 await page.evaluate(project=>axoGoStream({type:'project',chain:project.chain,project}),exactArc);
 await page.waitForFunction(()=>axoStreamProject?.symbol==='FIX5');
 const params=new URL(page.url()).searchParams;
 assert.equal(params.get('pool'),exactArc.pool);
 await page.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:'https://axo-desk.test'});
 await page.getByRole('button',{name:'Copy stream link'}).click();
 await page.waitForFunction(async()=>new URLSearchParams((await navigator.clipboard.readText()).split('?')[1]||'').get('stream')==='project');
 const copied=new URL(await page.evaluate(()=>navigator.clipboard.readText()));
 assert.equal(copied.searchParams.get('address'),exactArc.address);
 assert.equal(copied.searchParams.get('pool'),exactArc.pool);
 await page.reload({waitUntil:'load'});
 await page.waitForFunction(()=>axoStreamProject?.symbol==='FIX5');
 assert.deepEqual(await page.evaluate(()=>axoStream.project),exactArc);
 await page.evaluate(()=>axoGoStream({type:'watchlist',id:'personal watch name'}));
 assert.equal(await page.getByRole('button',{name:'Copy stream link'}).isVisible(),false);
 assert.equal(new URL(page.url()).searchParams.has('stream'),false);
 assert(!page.url().includes('personal'));
 await page.goBack();
 await page.waitForFunction(()=>axoStreamProject?.symbol==='FIX5');
 await page.goForward();
 await page.waitForFunction(()=>axoStream.type==='watchlist');
 await page.evaluate(()=>axoGoStream({type:'launchpads',chain:'base',launchpadView:'graduating'}));
 assert.equal(new URL(page.url()).searchParams.get('pad-view'),'graduating');
 await page.evaluate(()=>axoGoStream({type:'chain',chain:'base'}));
 await page.goBack();
 await page.waitForFunction(()=>axoStream.type==='launchpads'&&axoStream.launchpadView==='graduating');
 for(const width of [390,320]){
  await page.setViewportSize({width,height:844});
  for(const chain of Desk.CHAIN_IDS){
   await page.locator('[data-common-stream="'+chain+'"]').click();
   await page.locator('[data-card="stream-data-chain-'+chain+'-overview"]').waitFor();
   const chainSignals=page.locator('[data-card="stream-data-chain-'+chain+'-market-signals"]');
   await chainSignals.getByRole('heading',{name:'Flow pulse'}).waitFor();
   await chainSignals.getByText(/up · .* down · .* with 1h change/).waitFor();
   assert.equal(new URL(page.url()).searchParams.get('chain'),chain);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,chain+' fits '+width+'px');
   if(width===390&&chain==='arc'){
    await chainSignals.getByRole('button',{name:'Inspect FIX5 on Arc'}).click();
    await page.waitForFunction(()=>axoStream.type==='project'&&axoStreamProject?.symbol==='FIX5');
    assert.deepEqual(await page.evaluate(()=>axoStream.project),exactArc);
   }
  }
  for(const type of ['home','watchlist','discovery','launchpads','news','profile','portfolio','risk']){
   await page.evaluate(type=>{axoGoStream({type});layout();},type);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,type+' fits '+width+'px');
  }
 }
 assert.deepEqual(errors,[]);
 console.log('First result at an 844px viewport height',firstResultPositions);
 console.log('PASS Chrome Trading Desk and user journeys: market signals, exact pool search and copy, sorting, visible first results, mobile filters, project evidence, browser history and all five chain streams.');
}finally{await browser.close();}
