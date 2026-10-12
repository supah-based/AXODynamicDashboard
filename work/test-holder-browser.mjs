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
const browser=await chromium.launch({channel:process.env.AXO_BROWSER_CHANNEL||'msedge',headless:true});
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
 for(const theme of ['light','dark'])for(const width of [1440,390,320]){await p.setViewportSize({width,height:1100});await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);await p.waitForTimeout(100);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Holder panel overflow '+theme+' '+width);}
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
 await p.waitForSelector('.axo-education');assert.equal(await p.locator('.axo-education').count(),1);assert.equal(await p.locator('#board>.card').nth(8).getAttribute('data-card'),'axo-education');
 await p.evaluate(async()=>{axoEducationShown.type=2;axoEducationShown.node.querySelector('.edu-content').innerHTML=await axoEducationMarkup(2);layout();});
 let text=await p.locator('.axo-education').innerText();assert.match(text,/SELECTED/);assert.match(text,/DISTRIBUTED/);assert.match(text,/12\.345678901234567891/);assert.match(text,/Confirmed holder payments\s+Unverified/);assert.match(text,/Holder reward share of trade · buy\s+3%/);
 rewardAmount='99.123456789012345678';await p.evaluate(()=>axoRefreshRewardEducation());assert.match(await p.locator('.axo-education').innerText(),/99\.123456789012345678/);
 for(const width of [1440,390,320]){await p.setViewportSize({width,height:1100});await p.evaluate(()=>layout());await p.waitForTimeout(100);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Education overflow '+width);}
 await p.screenshot({path:'outputs/axo-rewards-education-mobile.png'});await p.locator('.edu-dismiss').click();await p.evaluate(()=>axoMaybeEducation());assert.equal(await p.locator('.axo-education').count(),0);
 const stored=await p.evaluate(()=>JSON.stringify({...localStorage}));assert.ok(!stored.includes('axo-holder-session'));assert.ok(!stored.includes('Sign in to Axo'));
 await p.reload();await p.waitForFunction(()=>typeof axoHolderPanel==='function');await p.evaluate(()=>axoMaybeEducation());assert.equal(await p.locator('.axo-education').count(),0,'Dismissed education does not return on reload within 24 hours');
 assert.deepEqual(errors,[]);console.log('PASS: public browsing, no automatic signatures, authenticated SIWE browser flow, microphone and Ask gates, decline/account change, higher-tier access, daily counters, sparse dynamic rewards, exact amounts, both themes and mobile widths.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
