import assert from 'node:assert/strict';
import http from 'node:http';
import {Wallet,toUtf8String} from 'ethers';
import {runtimeDependency} from './axo-runtime.mjs';
import {createHolderAuth} from './axo-holder-auth.mjs';
import {AXO} from './axo-identity.mjs';
const {chromium}=runtimeDependency('playwright'),wallet=Wallet.createRandom();
let units=1000000n*10n**18n,signatures=0,decline=false,protectedCalls=0,rewardAmount='12.345678901234567891',clockOffset=0;
const now=()=>Date.now()+clockOffset;
const auth=createHolderAuth({now,readHoldings:async address=>({wallet:address,chainId:4663,token:AXO.address,decimals:18,rawBalance:units.toString(),amount:(units/10n**18n).toString(),blockAt:now(),block:1})});
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(await auth.handle(req,res,u))return;if(!await auth.guard(req,res,u))return;protectedCalls++;res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({answer:'Fixture response',cards:[],sources:[]}));}catch(e){res.writeHead(500);res.end(JSON.stringify({error:e.message}));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
async function proxy(route){const incoming=route.request(),headers=await incoming.allHeaders();return new Promise((resolve,reject)=>{const req=http.request('http://127.0.0.1:'+server.address().port+new URL(incoming.url()).pathname,{method:incoming.method(),headers:{...headers,host:'127.0.0.1:43187',connection:'close'}},res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>{const h={'content-type':'application/json'};if(res.headers['set-cookie'])h['set-cookie']=res.headers['set-cookie'][0];resolve(route.fulfill({status:res.statusCode,headers:h,body}));});});req.on('error',reject);req.end(incoming.postData()||undefined);});}
function rewardFixture(){const now=Date.now();return {identity:{officialMatch:true,chainId:4663,address:AXO.address},fees:{observedAt:now,buyBps:500,rewardBps:300},rewards:{observedAt:now,catalogAt:now,minimumAxo:'1000000',eligibleHolders:42,selected:[{address:'0x'+'1'.repeat(40),symbol:'SELECTED'}],assets:[{address:'0x'+'2'.repeat(40),symbol:'DISTRIBUTED',distributed:rewardAmount}],eventHistoryComplete:false}};}
const browser=await chromium.launch({...(process.env.AXO_BROWSER_EXECUTABLE?{executablePath:process.env.AXO_BROWSER_EXECUTABLE}:{channel:process.env.AXO_BROWSER_CHANNEL||'msedge'}),headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1100},reducedMotion:'reduce'}),p=await context.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.exposeFunction('holderFixtureSign',async hex=>{signatures++;if(decline)throw Error('User declined fixture signature');return wallet.signMessage(toUtf8String(hex));});
 await p.route('**/api/auth/**',proxy);await p.route('**/api/ai/ask',proxy);await p.route('**/api/ai/intent',proxy);
 await p.route('**/api/axo-ecosystem',r=>r.fulfill({json:rewardFixture()}));
 await p.route('**/api/discovery/control',r=>r.fulfill({json:{enabled:true,jobs:[],results:{},alerts:[]}}));
 await p.route('**/api/discovery',r=>r.fulfill({json:{enabled:true,jobs:[],results:{},alerts:[]}}));
 await p.goto('http://127.0.0.1:43187/?view=compact-intel');await p.waitForFunction(()=>typeof axoHolderPanel==='function'&&axoHolderAccess!==null);
 assert.equal(signatures,0,'Page load must never request a signature');
 await p.evaluate(()=>{window.holderMicCalls=0;navigator.mediaDevices.getUserMedia=async()=>{holderMicCalls++;throw Error('No microphone needed for this test');};});
 await p.evaluate(()=>ask('Find a project'));assert.match(await p.locator('#detail').innerText(),/verify ownership/);assert.equal(protectedCalls,0);
 await p.evaluate(()=>axoStartLive());assert.equal(await p.evaluate(()=>holderMicCalls),0);
 await p.evaluate(address=>{axoWallet={kind:'evm',address,name:'Fixture wallet',provider:{request:async({method,params})=>method==='eth_accounts'?[address]:method==='eth_chainId'?'0x2105':method==='personal_sign'?holderFixtureSign(params[0]):null}};axoWalletLabel();},wallet.address);
 await p.evaluate(()=>axoHolderPanel());await p.locator('[data-holder-verify]').click();
 await p.waitForFunction(()=>axoHolderAccess?.authenticated&&axoHolderPending===false);assert.equal(signatures,1);
 assert.match(await p.locator('#detail').innerText(),/Normal holder.*verified wallet/s);assert.match(await p.locator('#detail').innerText(),/20 backend AI requests\/day/);
 assert.equal(await p.evaluate(()=>axoHolderRequire('voice')),true);
 assert.equal(await p.evaluate(()=>axoHolderRequire('customCards')),false);
 await p.evaluate(()=>axoAiPost('/api/ai/ask',{question:'Fixture'}));assert.equal(protectedCalls,1);await p.waitForFunction(()=>axoHolderAccess?.remaining.aiRequests===19);
 for(const theme of ['light','dark'])for(const width of [1440,390,320]){await p.setViewportSize({width,height:1100});await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);await p.waitForTimeout(100);const fit=await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);if(!fit){await p.screenshot({path:'outputs/axo-education-overflow.png'});console.log(await p.evaluate(()=>[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,id:e.id,className:String(e.className),x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right})).filter(e=>e.x<-1||e.right>innerWidth+1).slice(0,12)));}assert.ok(fit,'Holder panel overflow '+theme+' '+width);}
 await p.screenshot({path:'outputs/axo-holder-access-mobile.png'});
 // A wallet account change immediately revokes the browser's access.
 await p.evaluate(()=>{axoWallet=null;axoWalletLabel();});await p.waitForFunction(()=>axoHolderAccess===null||axoHolderAccess.authenticated===false);assert.equal(await p.evaluate(()=>axoHolderRequire()),false);
 const cookies=await context.cookies();assert.ok(!cookies.some(c=>c.name==='axo-holder-session'),'Sign-out clears the authentication cookie');
 // Upgrading and signing again grants the higher tier without a wallet chain switch.
 units=2500000n*10n**18n;clockOffset+=61000;decline=true;
 await p.evaluate(address=>{axoWallet={kind:'evm',address,name:'Fixture wallet',provider:{request:async({method,params})=>method==='eth_accounts'?[address]:method==='eth_chainId'?'0x2105':method==='personal_sign'?holderFixtureSign(params[0]):null}};axoWalletLabel();},wallet.address);
 await p.evaluate(()=>axoHolderSignIn());assert.equal(await p.evaluate(()=>Boolean(axoHolderAccess?.authenticated)),false);
 decline=false;await p.evaluate(()=>axoHolderSignIn());assert.equal(await p.evaluate(()=>axoHolderAccess.tier.id),'enhanced');assert.equal(await p.evaluate(()=>axoHolderRequire('customCards')),true);
 // Dynamic rewards preserve exact amounts and distinguish selection, allocation and payment.
 await p.evaluate(async()=>{close();axoEducationShown?.node.remove();axoEducationShown=null;localStorage.removeItem(educationKey);axoStream={type:'home'};const board=$('board');board.replaceChildren();for(let i=0;i<9;i++){const node=document.createElement('article');node.className='card';node.textContent='Data card '+i;board.append(node);}await axoMaybeEducation();});
 await p.waitForSelector('.axo-education');assert.equal(await p.locator('.axo-education').count(),1);assert.equal(await p.locator('#board>.card').nth(3).getAttribute('data-card'),'axo-education');assert.equal(await p.locator('.axo-education').getAttribute('data-size'),'wide');
 // Each topic renders its own real banner, with a fixed panoramic ratio in both themes.
 for(const type of [0,1,2]){
  await p.evaluate(async type=>{const content=await axoEducationMarkup(type),shown=axoEducationShown;shown.node.remove();const node=axoEducationNode(type,content);axoEducationShown={...shown,node,type};const cards=[...$('board').children].filter(e=>e.matches('article.card'));$('board').insertBefore(node,cards[3]||null);layout();},type);
  await p.waitForFunction(()=>{const img=document.querySelector('.axo-education .edu-header img');return img?.complete&&img.naturalWidth>0;});
  assert.ok((await p.locator('.edu-header img').getAttribute('src')).endsWith(['tiers','buy','rewards'][type]+'-header-v1.png'));
  for(const theme of ['light','dark'])for(const width of [1440,390,320]){
   await p.setViewportSize({width,height:1100});await p.evaluate(theme=>{document.documentElement.dataset.theme=theme;layout();},theme);await p.waitForTimeout(100);
   const box=await p.locator('.edu-header').boundingBox();assert.ok(Math.abs(box.width/box.height-3)<.02,'3:1 header '+type+' '+theme+' '+width);
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Education overflow '+type+' '+theme+' '+width);
   if(width===1440)assert.ok(await p.locator('.axo-education').evaluate(e=>e.classList.contains('wide-card')));
   if(theme==='dark'&&width!==390)await p.locator('.axo-education').screenshot({path:'outputs/axo-education-'+['tiers','buy','rewards'][type]+(width===1440?'-desktop':'-mobile')+'.png'});
  }
 }
 let text=await p.locator('.axo-education').innerText();assert.match(text,/SELECTED/);assert.match(text,/DISTRIBUTED/);assert.match(text,/12\.345678901234567891/);assert.match(text,/Confirmed holder payments\s+Unverified/);assert.match(text,/Holder reward share of trade · buy\s+3%/);
 const header=await p.locator('.edu-header img').getAttribute('src');rewardAmount='99.123456789012345678';await p.evaluate(()=>axoRefreshRewardEducation());assert.match(await p.locator('.axo-education').innerText(),/99\.123456789012345678/);assert.equal(await p.locator('.edu-header img').getAttribute('src'),header,'Reward refresh keeps the topic header');
 await p.locator('.axo-education').screenshot({path:'outputs/axo-rewards-education-mobile.png'});await p.locator('.edu-dismiss').click();await p.evaluate(()=>axoMaybeEducation());assert.equal(await p.locator('.axo-education').count(),0);
 const stored=await p.evaluate(()=>JSON.stringify({...localStorage}));assert.ok(!stored.includes('axo-holder-session'));assert.ok(!stored.includes('Sign in to Axo'));
 await p.reload();await p.waitForFunction(()=>typeof axoHolderPanel==='function');await p.evaluate(()=>axoMaybeEducation());assert.equal(await p.locator('.axo-education').count(),0,'Dismissed education does not return on reload within 15 minutes');
 // Advance only the education clock, without waiting or expiring wallet sessions.
 await p.evaluate(()=>{window.educationOriginalNow=Date.now;window.educationClockOffset=14*60000;Date.now=()=>educationOriginalNow()+educationClockOffset;});
 await p.evaluate(()=>axoMaybeEducation());assert.equal(await p.locator('.axo-education').count(),0,'The cooldown still applies at 14 minutes');
 await p.evaluate(async()=>{educationClockOffset=15*60000+1000;await axoMaybeEducation();});await p.waitForSelector('.axo-education');
 assert.equal(await p.locator('.axo-education').count(),1,'One card returns after the 15-minute cooldown');
 const shown=await p.evaluate(()=>axoEducationShown.shownAt);
 await p.evaluate(async()=>{educationClockOffset+=15*60000+1000;await axoMaybeEducation();});
 assert.equal(await p.locator('.axo-education').count(),1,'Scheduled updates replace the card rather than stacking it');assert.ok(await p.evaluate(()=>axoEducationShown.shownAt)>shown);
 await p.evaluate(()=>{axoStream={type:'chain',chain:'base'};$('board').replaceChildren();for(let i=0;i<4;i++){const card=document.createElement('article');card.className='card';$('board').append(card);}});await p.waitForSelector('.axo-education');
 assert.equal(await p.evaluate(()=>axoEducationShown.shownAt),await p.evaluate(()=>Number(localStorage.getItem(educationKey))),'Switching streams preserves the same cooldown');
 await p.evaluate(async()=>{axoStream={type:'project'};$('board').replaceChildren();educationClockOffset+=15*60000+1000;await axoMaybeEducation();});assert.equal(await p.locator('.axo-education').count(),0,'Education does not displace the project-page anchor');
 await p.evaluate(()=>{Date.now=educationOriginalNow;});
 assert.deepEqual(errors,[]);console.log('PASS: public browsing, no automatic signatures, authenticated SIWE browser flow, microphone and Ask gates, decline/account change, higher-tier access, daily counters, sparse dynamic rewards, exact amounts, both themes and mobile widths.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
