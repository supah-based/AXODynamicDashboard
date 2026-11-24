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
const arc=data[4],alternateArc={...arc,id:'arc:'+evm(90,64),pair:evm(90,64),dex:'Alternate Fixture',quote:'USDC',price:.026,liquidity:24500,volume1:3500,volume5:500,seenAt:at-20000};
const datedArc={...arc,id:'arc:'+evm(91,64),pair:evm(91,64),dex:'Dated Fixture',quote:'USDT',price:99,seenAt:at-360000};
const overviewPools=Array.from({length:11},(_,i)=>{
 const p=data[1],change24=20-i;
 return {...p,id:'base:'+evm(510+i),address:evm(310+i),pair:evm(510+i),name:'Project '+(i+1),symbol:'PAGE'+(i+1),
  createdAt:at-(20-i)*3600000,liquidity:250000,volume24:90000+i,change24,changes:{m5:i===9?0:(i%4-1)*3,h1:2-i,h6:i===10?null:i*2-10,h24:change24}};
});
const rotationPools=['base','bsc','robinhood','arc'].flatMap((chain,index)=>Array.from({length:5},(_,i)=>{
 const source=data.find(p=>p.chain===chain),pair=evm(920+index*10+i,chain==='arc'?64:40),short=chain==='bsc'?-2:3;
 const volume5=chain==='arc'&&i===0?32000:chain==='bsc'?500:2400;
 return {...source,id:chain+':'+pair,address:evm(820+index*10+i),pair,name:names[chain]+' driver '+(i+1),symbol:'MOVE'+(i+1),
  createdAt:chain==='robinhood'&&i>1?at-15*60000:at-30*3600000,volume5,volume1:chain==='arc'&&i===0?50000:chain==='bsc'?11500:15600,
  volume6:65000,volume24:chain==='bsc'?160000:195000,changes:{m5:short,h1:3,h24:5}};
}));
const projectRows=[...data,alternateArc,datedArc,...rotationPools,...overviewPools];
const chainHistory=Array.from({length:34},(_,i)=>({time:Math.floor(at/86400000)*86400000-(34-i)*86400000,value:5000000+((i*19)%13+i)*120000}));
const chainFeed={source:'Fixture',status:'live',receivedAt:at-20000,data:{history:chainHistory,volume:9200000,previous:7500000}};
const historyFeed=(source,f)=>({source,status:'live',receivedAt:at-20000,data:{history:chainHistory.map((p,i)=>({...p,value:f(i)}))}});
const tvlFeed=historyFeed('TVL fixture',i=>9000000+(i*2+(i%14))*300000);
const supplyFeed=historyFeed('Stablecoin fixture',i=>12000000+(i>=18?1:0)*2000000+(i>=27?1:0)*1200000);
const screening=createTradingDesk({
 getPools:()=>data,getChain:chain=>({status:'available',sources:[{id:'top',provider:'GeckoTerminal',status:'available',fetchedAt:at-30000}],
  dex:{status:'live',source:'DefiLlama',receivedAt:at-30000,data:{volume:8250000,change:[5,12,-1.8,4.1,2][Desk.CHAIN_IDS.indexOf(chain)]}}}),
 getMarkets:()=>({status:'live',receivedAt:at,data:[{symbol:'btc',price:63000,change:-1,sourceTime:new Date(at-30000).toISOString()}]})
});
const rotationFixture=createTradingDesk({getPools:()=>rotationPools});
let useRotationFixture=false;
let useResearchFixture=false;
const browser=await chromium.launch({channel:process.env.AXO_BROWSER_CHANNEL||'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:990},reducedMotion:'reduce'});
 const errors=[],preflights=[],onchain=[],historyReads=[];page.on('pageerror',error=>errors.push(error.message));
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
  if(path==='/api/trading-desk')return route.fulfill({json:(useRotationFixture?rotationFixture:screening).snapshot()});
  if(path==='/api/dashboard')return route.fulfill({json:{version:3,chains:Desk.CHAIN_IDS.map(id=>({id,name:names[id]})),chainAppearance,feeds:{},events:[],capabilities:{}}});
  if(path==='/api/stream-memory')return route.fulfill({json:{revision:0,shortcuts:[],tombstones:[],preferences:{},projects:[]}});
  if(path==='/api/project'){
   const {chain,address,pool}=Object.fromEntries(url.searchParams);
   const p=projectRows.find(p=>p.chain===chain&&p.address===address&&p.pair===pool);
   if(!p)return route.fulfill({status:404,json:{error:'No exact fixture'}});
   const pools=chain==='arc'?[p,...projectRows.filter(other=>other!==p&&other.chain==='arc'),{...p,chain:'bsc',dex:'Wrong chain'}]:[p];
   return route.fulfill({json:{project:{chain,address,pool},market:{status:'available',primary:p},pools,identity:{name:p.name,symbol:p.symbol,links:[]},
    onchain:{simulation:{status:'unavailable'}},enrichment:{gmgn:{status:'not_configured'}},receivedAt:at}});
  }
  if(path==='/api/ohlcv'){
   const query=Object.fromEntries(url.searchParams),seconds={'15m':900,'1h':3600,'1d':86400,'1w':604800}[query.timeframe];
   const p=projectRows.find(p=>p.chain===query.chain&&p.address===query.address&&p.pair===query.pool);
   if(!p||!seconds)return route.fulfill({status:404,json:{status:'unavailable'}});
   historyReads.push(query);
   const bucket=Math.floor(at/1000/seconds)*seconds;
   const candles=Array.from({length:28},(_,i)=>{
    if(query.timeframe==='15m')return [bucket-(27-i)*seconds,p.price,p.price,p.price,p.price,1000];
    const open=p.price*(.78+i*.007+Math.sin(i)*.035),close=open*(i%3?.99:1.02);
    return [bucket-(27-i)*seconds,open,Math.max(open,close)*1.025,Math.min(open,close)*.965,close,1000+i*70];
   });
   return route.fulfill({json:{...query,pool:query.timeframe==='1d'?evm(999,64):query.pool,status:'available',currency:'USD',bucketSeconds:seconds,candles,receivedAt:at,notes:'Fixture candles only.'}});
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
   const pools=chain==='base'?overviewPools:first?[first]:[];
   return route.fulfill({json:{chain,pools,asOf:at,status:'available',dex:chainFeed,tvl:tvlFeed,capital:supplyFeed,sources:[],news:{items:[]}}});
  }
  if(path==='/api/intelligence/changes')return route.fulfill({json:{baselineCount:16,events:[
   {...data[1],kind:'project',pool:data[1].pair,id:'base-change',metric:'liquidity',from:50000,to:80000,change:60,
    fromAt:at-1800000,toAt:at-30000,source:'Fixture DEX',definition:'Both values refer to the same pool.'}] }});
  if(useResearchFixture&&path==='/api/market-intelligence')return route.fulfill({json:{framework:{researchStrategy:{stages:[]},feeds:[]},review:{
   observations:3,missedCandidates:1,failedSignals:1,unobservableOutcomes:1,coverageGaps:1,method:'Same dated horizons and benchmark.',playbooks:[],
   outcomes:[{key:'up',symbol:'FIX2',chain:'base',horizon:24,excessPoints:5,returnPct:7,btcReturnPct:2,flagged:true,at:at-86400000},
    {key:'down',symbol:'FIX3',chain:'bsc',horizon:24,excessPoints:-3,returnPct:-1,btcReturnPct:2,flagged:true,failedSignal:true,at:at-86400000},
    {key:'watch',symbol:'FIX5',chain:'arc',horizon:72,excessPoints:4,returnPct:6,btcReturnPct:2,missedCandidate:true,at:at-3*86400000} ]}}});
  if(useResearchFixture&&path==='/api/research-card'){
   const {action,requestId}=route.request().postDataJSON();
   const section={title:'Volume readings',note:'Read both dated observations before comparing.',
    rows:Array.from({length:4},(_,i)=>({label:'Reading '+(i+1),metrics:[['Pool liquidity','$50k'],['1h volume','$21k']],detail:'The original source detail remains available.'}))};
   return route.fulfill({json:{version:1,requestId,key:'b'.repeat(64),action,completedAt:at,status:'ready',
    sources:[{provider:'Fixture DEX',status:'current',fetchedAt:at,delivery:'fixture'}],sections:[section],gaps:['Some pools lack a dated holder count.']}});
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
 const chart=page.locator('[data-card="stream-data-project-chart"]'),venues=page.locator('[data-card="stream-data-project-venues"]');
 await chart.locator('[data-candle][aria-current="true"]').waitFor();
 assert.equal(await chart.locator('[data-candle][tabindex="0"]').count(),1);
 assert.equal(await chart.locator('[data-candle][aria-current="true"]').getAttribute('data-candle'),'27');
 await chart.locator('[data-candle][tabindex="0"]').focus();
 await page.keyboard.press('ArrowLeft');
 assert.equal(await chart.locator('[data-candle][aria-current="true"]').getAttribute('data-candle'),'26');
 assert.equal(await chart.locator('.axo-candle-detail time').getAttribute('datetime'),new Date((Math.floor(at/3600000)-1)*3600000).toISOString());
 await chart.getByRole('button',{name:'Previous candle'}).click();
 assert.equal(await chart.locator('[data-candle][aria-current="true"]').getAttribute('data-candle'),'25');
 await chart.locator('[data-stream-frame="1d"]').click();
 await chart.getByText('Chart evidence could not be matched to this pool and timeframe.').waitFor();
 assert.equal(await chart.locator('[data-candle]').count(),0);
 await chart.locator('[data-stream-frame="15m"]').click();
 await chart.locator('[data-candle][aria-current="true"]').waitFor();
 const flatChartFits=await chart.locator('.axo-candles').evaluate(svg=>[...svg.querySelectorAll(':scope > line')].every(line=>Number(line.getAttribute('y1'))>=0&&Number(line.getAttribute('y1'))<svg.viewBox.baseVal.height));
 assert(flatChartFits,'A flat price series keeps every axis level within the plot');
 await chart.locator('[data-stream-frame="1h"]').click();
 await chart.locator('[data-candle][aria-current="true"]').waitFor();
 assert.equal(await chart.locator('[data-candle][aria-current="true"]').getAttribute('data-candle'),'25');
 await venues.getByText('Alternate Fixture',{exact:true}).waitFor();
 assert.equal(await venues.getByText('Wrong chain').count(),0);
 assert.equal(await venues.locator('tbody tr').count(),3);
 assert.match(await venues.getByRole('row').filter({hasText:'Alternate Fixture'}).innerText(),/\+4\.0%/);
 const datedRow=venues.getByRole('row').filter({hasText:'Dated Fixture'});
 assert.match(await datedRow.innerText(),/Dated/);
 assert(!((await datedRow.innerText()).includes('$99')));
 await venues.getByRole('button',{name:/Open Alternate Fixture pool/}).click();
 await page.waitForFunction(pool=>axoStreamProject?.pair===pool,alternateArc.pair);
 await chart.locator('[data-candle][aria-current="true"]').waitFor();
 assert.equal(new URL(page.url()).searchParams.get('address'),exactArc.address);
 assert.equal(new URL(page.url()).searchParams.get('pool'),alternateArc.pair);
 assert(historyReads.some(query=>query.pool===alternateArc.pair&&query.timeframe==='1h'));
 await page.goBack();
 await page.waitForFunction(pool=>axoStreamProject?.pair===pool,exactArc.pool);
 await chart.locator('[data-candle][aria-current="true"]').waitFor();
 await page.locator('.axo-project-tools summary').click();
 await page.locator('[data-pulse-unchecked]').waitFor({state:'visible'});
 await page.locator('.axo-project-tools summary').click();
 const depth=page.locator('.axo-project-anchor .axo-project-depth');
 await depth.locator(':scope > summary').click();
 await page.evaluate(()=>render(true));
 assert(await depth.evaluate(node=>node.open),'Refreshing keeps the project details open');
 await depth.locator(':scope > summary').click();
 const projectSnapshot=page.locator('.axo-project-anchor');
 await projectSnapshot.locator('[data-axo-score-open]').click();
 await projectSnapshot.locator('.axo-score-detail[open]').waitFor();
 await projectSnapshot.locator('[data-axo-score-open]').click();
 const rail=page.locator('.utility-rail');
 await page.waitForFunction(()=>document.querySelector('.utility-rail').getBoundingClientRect().width<=60);
 await projectSnapshot.locator('[data-save-metric]').click();
 await page.waitForFunction(()=>document.querySelector('.utility-rail').getBoundingClientRect().width>100&&document.querySelector('.saved-metric'));
 await rail.locator('.saved-remove').first().click();
 await page.waitForFunction(()=>document.querySelector('.utility-rail').getBoundingClientRect().width<=60);
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:844});
  await page.evaluate(async()=>{document.activeElement?.blur();scrollTo(0,0);layout();await new Promise(requestAnimationFrame);});
  const layout=await page.evaluate(()=>{
   const anchor=document.querySelector('.axo-project-anchor'),board=document.querySelector('#board');
   return {first:anchor===board.firstElementChild,anchorY:anchor.getBoundingClientRect().top,
    priceEnd:anchor.querySelector('.pc-price-row').getBoundingClientRect().bottom,
    chartY:document.querySelector('[data-card="stream-data-project-chart"]').getBoundingClientRect().top,
    dockY:innerHeight-parseFloat(getComputedStyle(document.body,'::after').height),overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  assert(layout.first&&!layout.overflow,JSON.stringify({width,layout}));
  assert(layout.priceEnd<layout.dockY,JSON.stringify({width,layout}));
  if(width===1440){
   assert(Math.abs(layout.chartY-layout.anchorY)<=2,JSON.stringify({width,layout}));
   assert((await chart.boundingBox()).width>(await projectSnapshot.boundingBox()).width*1.4);
  }
  if(width===1440)await page.setViewportSize({width,height:1000});
  if(width!==320)await page.screenshot({path:'outputs/axo-project-research-'+(width===1440?'desktop':'mobile')+'.png',style:'#toast{visibility:hidden}.card[data-axo-reading]{outline:none!important;box-shadow:none!important}'});
  if(width!==1440){
   const jump=page.locator('[data-project-jump="stream-data-project-chart"]');
   await jump.click();
   assert.equal(await jump.getAttribute('aria-current'),'location');
   const target=await page.evaluate(()=>{
    const bar=document.querySelector('.axo-market-context.project'),plot=document.querySelector('.axo-candles');
    return {navBottom:bar.getBoundingClientRect().bottom,plot:plot.getBoundingClientRect().toJSON(),dock:innerHeight-parseFloat(getComputedStyle(document.body,'::after').height)};
   });
   assert(target.plot.top>=target.navBottom&&target.plot.bottom<target.dock,JSON.stringify({width,target}));
   if(width===390)await page.screenshot({path:'outputs/axo-project-research-mobile-chart.png',style:'#toast{visibility:hidden}.card[data-axo-reading]{outline:none!important;box-shadow:none!important}'});
  }
 }
 await page.setViewportSize({width:1440,height:990});
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
 useRotationFixture=true;
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(()=>axoGoStream({type:'home'}));
 await view.locator('[data-desk-refresh]').click();
 const rotation=page.locator('[data-card="stream-data-chain-rotation"]'),network=chain=>rotation.locator('[data-rotation-chain="'+chain+'"]');
 await network('base').getByText('Broadening').waitFor();
 await network('bsc').getByText('Cooling').waitFor();
 await network('arc').getByText('Concentrated').waitFor();
 await network('robinhood').getByText('2/5 comparable').waitFor();
 await network('solana').getByText('No current sample').waitFor();
 await view.getByRole('button',{name:'Rotation',exact:true}).click();
 assert(await rotation.getByRole('heading',{name:'Chain Rotation'}).evaluate(node=>node===document.activeElement));
 assert.equal(await network('base').getAttribute('aria-pressed'),'true');
 await rotation.getByText('How it’s measured').click();
 await rotation.getByText(/A chain signal needs 5 comparable pools/).waitFor();
 const hour=rotation.getByRole('button',{name:'1h',exact:true}),minutes=rotation.getByRole('button',{name:'5m',exact:true});
 await hour.click();
 assert.equal(await hour.getAttribute('aria-pressed'),'true');
 assert(await hour.evaluate(node=>node===document.activeElement),'Changing window preserves focus');
 await rotation.getByText('vs. the preceding 23h rate').waitFor();
 assert.equal(await rotation.locator('details').getAttribute('open'),'');
 await rotation.getByText('How it’s measured').click();
 await minutes.click();
 await network('arc').click();
 const arcDrivers=rotation.getByRole('region',{name:'Arc rotation drivers'});
 const leader=arcDrivers.getByRole('button',{name:'Inspect MOVE1 on Arc'});
 await leader.click();
 const review=page.getByRole('dialog');
 await review.getByRole('heading',{name:'Arc driver 1'}).waitFor();
 await review.getByText('Building across both windows').waitFor();
 const exactRotation=rotationPools.find(p=>p.chain==='arc'&&p.symbol==='MOVE1');
 assert.equal(await review.locator('[data-desk-project]').getAttribute('data-desk-project'),Desk.poolKey(exactRotation));
 await page.keyboard.press('Escape');
 assert(await leader.evaluate(node=>node===document.activeElement),'Inspect restores focus to the driver');
 await view.locator('[data-desk-query]').fill('no matching pool');
 await view.getByText('0 matching pools in the sample',{exact:true}).waitFor();
 await network('base').getByText('Broadening').waitFor();
 await view.locator('[data-desk-query]').fill('');
 const stillCurrent=await rotation.locator('time').getAttribute('datetime');
 assert.equal(Date.parse(stillCurrent),at-30000);
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:900});
  await rotation.evaluate(async node=>{document.activeElement?.blur();layout();await new Promise(requestAnimationFrame);node.scrollIntoView({block:'start',behavior:'instant'});});
  assert.equal(await rotation.evaluate(node=>document.documentElement.scrollWidth<=innerWidth+1&&
    [...node.querySelectorAll('[data-rotation-chain]')].every(button=>button.scrollWidth<=button.clientWidth+1)),true,'Rotation fits at '+width+'px');
  if(width!==320)await rotation.screenshot({path:'outputs/axo-chain-rotation-'+(width===1440?'desktop':'mobile')+'.png',
   style:'#toast,.composer,.composer-note,body::after{visibility:hidden}.card[data-axo-reading]{outline:none!important;box-shadow:none!important}'});
 }
 await page.evaluate(()=>{document.documentElement.dataset.theme='light';layout();});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Rotation fits in light mode at 320px');
 const previews='#toast,.composer,.composer-note,body::after{visibility:hidden}.card[data-axo-reading]{outline:none!important;box-shadow:none!important}';
 await page.setViewportSize({width:1440,height:1000});
 await page.evaluate(()=>{document.documentElement.dataset.theme='dark';axoGoStream({type:'chain',chain:'base'});});
 const baseOverview=page.locator('[data-card="stream-data-chain-base-overview"]');
 await baseOverview.getByRole('heading',{name:'Protocol TVL'}).waitFor();
 assert.equal(await baseOverview.locator('.axo-overview-trend').count(),3);
 assert.equal(await baseOverview.locator('details').getAttribute('open'),null);
 await baseOverview.getByText('Dates, sources and coverage').click();
 await baseOverview.getByText(/Daily DEX comparisons exclude/).waitFor();
 await baseOverview.getByText('Dates, sources and coverage').click();
 await baseOverview.screenshot({path:'outputs/axo-card-audit-chain-overview.png',style:previews});
 const cardPlan={template:{id:'a'.repeat(24)},title:'Price momentum matrix',targetStream:'current',components:['momentum_matrix','metric_table'],
  metrics:['liquidity','volume24','change24'],chains:['base'],liquidityMin:100000,volumeMin:90002};
 await page.evaluate(plan=>{axoApplyCardPlan(plan);axoApplyCardPlan(plan);},cardPlan);
 const matrix=page.locator('.axo-attached-card').filter({has:page.getByRole('heading',{name:cardPlan.title,exact:true})});
 const includeUnchecked=page.locator('[data-pulse-unchecked]');
 await includeUnchecked.uncheck();
 assert.equal(await matrix.locator('.axo-momentum-matrix').count(),0,'Unchecked projects stay out when screening is required');
 await includeUnchecked.check();
 await matrix.getByRole('table',{name:'Project price change by window'}).first().waitFor();
 assert.equal(await matrix.count(),1,'A repeated request reuses its attachment');
 assert.equal(await matrix.locator('.axo-matrix-meta').first().innerText(),'Price change by window\n9 / 9 pools');
 assert.equal(await matrix.locator('.axo-momentum-matrix tbody tr').first().locator('[data-direction="missing"]').count(),1);
 assert.equal(await matrix.locator('.axo-momentum-matrix tbody tr').nth(1).locator('[data-direction="flat"]').count(),1);
 assert.equal(await matrix.locator('.axo-compare-bar').count(),18);
 assert.deepEqual(await matrix.locator('.axo-momentum-matrix [data-project-dashboard]').evaluateAll(nodes=>nodes.map(node=>node.dataset.projectDashboard)),overviewPools.slice(2).reverse().map(p=>p.id));
 await matrix.getByText('Show 1 more pool',{exact:true}).click();
 assert.equal(await matrix.locator('.axo-momentum-matrix').last().isVisible(),true);
 await matrix.getByText('Show 1 more pool',{exact:true}).click();
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});
  await matrix.evaluate(async el=>{document.activeElement?.blur();layout();await new Promise(requestAnimationFrame);el.scrollIntoView({block:'start',behavior:'instant'});});
  assert.equal(await matrix.evaluate(el=>el.scrollWidth<=el.clientWidth+1&&document.documentElement.scrollWidth<=innerWidth+1),true,'Saved matrix fits '+width+'px');
  if(width===390)await matrix.locator('.axo-matrix-panel').screenshot({path:'outputs/axo-card-audit-momentum-mobile.png',style:previews});
 }
 await matrix.locator('.axo-momentum-matrix').first().getByRole('button',{name:/PAGE11/}).click();
 await page.waitForFunction(pool=>axoStream.project?.pool===pool,overviewPools.at(-1).pair);
 assert.equal(await page.evaluate(()=>axoStream.project.address),overviewPools.at(-1).address);
 await page.reload({waitUntil:'load'});
 await page.evaluate(()=>axoGoStream({type:'chain',chain:'base'}));
 await includeUnchecked.check();
 await matrix.getByText('Price change by window',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>axoAttachedCards[0].volumeMin),90002);
 await matrix.getByRole('button',{name:'Remove card'}).click();
 assert.equal(await matrix.count(),0);
 await page.evaluate(()=>axoGoStream({type:'changes'}));
 const changesCard=page.locator('[data-card="stream-data-changes"]');
 await changesCard.getByText('After',{exact:true}).waitFor();
 assert.equal(await changesCard.locator('.axo-compare-bar').count(),2);
 assert.equal(await changesCard.getByText('Both values refer to the same pool.').isVisible(),false);
 await changesCard.getByText('Fixture DEX').click();
 await changesCard.getByText('Both values refer to the same pool.').waitFor();
 useResearchFixture=true;
 await page.evaluate(()=>axoGoStream({type:'research-review'}));
 const reviewCard=page.locator('[data-card="stream-data-research-report"]');
 await reviewCard.getByText('+5.0 pp',{exact:true}).waitFor();
 assert.equal(await reviewCard.locator('.axo-review-zero [data-direction="down"]').count(),1);
 await reviewCard.getByRole('button',{name:'72h',exact:true}).click();
 await reviewCard.getByText('+4.0 pp',{exact:true}).waitFor();
 assert.equal(await reviewCard.locator('.axo-review-zero [data-direction="down"]').count(),0);
 await page.evaluate(()=>{axoGoStream({type:'home'});axoCreateResearchCard({version:1,kind:'markets',question:'Show the sample volume readings',scope:{chains:['base']}});});
 const researchCard=page.locator('.research-action-card');
 await researchCard.getByText('Reading 1',{exact:true}).waitFor();
 assert.equal(await researchCard.getByText('Reading 4',{exact:true}).isVisible(),false);
 await researchCard.getByText('Show 1 more finding',{exact:true}).click();
 await researchCard.getByText('Reading 4',{exact:true}).waitFor();
 assert.equal(await researchCard.getByText('Some pools lack a dated holder count.').isVisible(),false);
 await researchCard.getByText('Evidence gaps · 1',{exact:true}).click();
 await researchCard.getByText('Some pools lack a dated holder count.').waitFor();
 const updates=await page.evaluate(()=>{
  const originalNow=Date.now,originalPause=paused,initialPending=[...axoPendingMarkets];
  const saved={input:axoLastInput,scroll:axoMarketScrollAt,market:axoMarketPresented,arrivals:axoArrivalPending,promoted:[...axoArrivalPromoted],arrivalAt:axoArrivalPresented};
  const complete=[],readings=[];
  let t=originalNow(),canRead=false;
  try{
   Date.now=()=>t;paused=false;axoLastInput=t-2000;axoMarketScrollAt=t-2000;axoMarketPresented=t;axoPendingMarkets.clear();
   axoQueueMarketUpdate('fixture',()=>complete.push('original'));
   axoQueueMarketUpdate('fixture',()=>complete.push('latest'));
   t+=29999;axoFlushMarketUpdates();readings.push(complete.length);
   t++;axoFlushMarketUpdates();readings.push(complete.length);
   t+=30000;axoQueueMarketUpdate('read',()=>complete.push('after reading'),()=>canRead);readings.push(complete.length);
   canRead=true;axoFlushMarketUpdates();readings.push(complete.length);
   paused=true;t+=30000;axoQueueMarketUpdate('refresh',()=>complete.push('old auto'));readings.push(complete.length);
   axoPresentMarketNow('refresh',()=>complete.push('manual'));paused=false;t+=30000;axoFlushMarketUpdates();
   axoArrivalPromoted.clear();axoArrivalPresented=-Infinity;
   axoArrivalPending=new Map([['low',{at:t,relevance:0}],['high',{at:t,relevance:3}]]);
   axoAcceptArrivals();axoAcceptArrivals();const first=[...axoArrivalPromoted.keys()];
   t+=30000;axoAcceptArrivals();
   return {complete,readings,first,promoted:[...axoArrivalPromoted.keys()]};
  }finally{
   Date.now=originalNow;paused=originalPause;axoLastInput=saved.input;axoMarketScrollAt=saved.scroll;
   axoMarketPresented=saved.market;axoPendingMarkets.clear();for(const [key,job] of initialPending)axoPendingMarkets.set(key,job);
   axoArrivalPending=saved.arrivals;axoArrivalPresented=saved.arrivalAt;axoArrivalPromoted.clear();
   for(const [key,arrival] of saved.promoted)axoArrivalPromoted.set(key,arrival);
   axoArrivalBanner();
  }
 });
 assert.deepEqual(updates,{complete:['latest','after reading','manual'],readings:[0,1,1,2,2],first:['high'],promoted:['high','low']});
 assert.deepEqual(errors,[]);
 console.log('First result at an 844px viewport height',firstResultPositions);
 console.log('PASS Chrome five-chain research, custom matrix with saved filters and exact links, visual change cards, and 30-second update pacing.');
}finally{await browser.close();}
