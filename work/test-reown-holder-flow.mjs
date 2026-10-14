import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {runtimeDependency} from './axo-runtime.mjs';

const {chromium}=runtimeDependency('playwright');
const browser=await chromium.launch({...(process.env.AXO_BROWSER_EXECUTABLE?{executablePath:process.env.AXO_BROWSER_EXECUTABLE}:{channel:process.env.AXO_BROWSER_CHANNEL||'chrome'}),headless:true});
const [walletScript,holderScript]=await Promise.all([fs.readFile('work/axo-wallet.js','utf8'),fs.readFile('work/axo-holder-access-ui.js','utf8')]);
const page=await browser.newPage({viewport:{width:390,height:850}});
try{
 await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><div class="header-actions"></div><form id="askForm"><input id="ask"></form><div id="drawer"></div>');
 await page.evaluate(()=>{
  window.$=id=>document.getElementById(id);window.esc=s=>String(s??'');window.modalOpen=false;window.open=html=>{$('drawer').innerHTML=html};window.close=()=>{};window.toast=()=>{};window.ecoMetric=(k,v)=>'<div>'+k+': '+v+'</div>';window.ask=()=>{};window.inspect=()=>{};window.axoStartLive=()=>{};window.axoEndLive=()=>{};window.axoAiPost=async()=>({});window.axoAiStatus=null;window.axoLive=false;
  window.__authenticated=false;window.__signatures=0;window.__opened=0;window.__cb=null;
  const publicAccess={authenticated:false,tier:{id:'public',name:'Public'},features:{ask:false,voice:false},reason:'wallet_sign_in_required'};
  const signedAccess={authenticated:true,wallet:'0x1111111111111111111111111111111111111111',tier:{id:'normal',name:'Normal holder'},features:{ask:true,voice:true},remaining:{aiRequests:20,voiceSeconds:300},balance:'1000000',resetAt:Date.now()+60000,checkedAt:Date.now(),expiresAt:Date.now()+60000};
  window.fetch=async(url,options={})=>{const path=String(url);if(path==='/api/wallet-config')return new Response(JSON.stringify({chains:[]}));if(path==='/api/auth/status')return new Response(JSON.stringify(window.__authenticated?signedAccess:publicAccess));if(path==='/api/auth/challenge')return new Response(JSON.stringify({message:'Sign in to AXO Streams'}));if(path==='/api/auth/verify'){window.__authenticated=true;return new Response(JSON.stringify(signedAccess));}if(path==='/api/access-policy')return new Response(JSON.stringify({tiers:[{id:'public',name:'Public',tokens:'0'},{id:'normal',name:'Normal holder',tokens:'1000000'}],serviceLimits:{public:{aiRequests:0,voiceSeconds:0,customCards:false},normal:{aiRequests:20,voiceSeconds:300,customCards:false}},identity:{tradingUrl:'https://example.invalid'}}));return new Response(JSON.stringify({}),{status:404});};
  window.__provider={request:async({method})=>{if(method==='eth_accounts')return['0x1111111111111111111111111111111111111111'];if(method==='eth_chainId')return'0x1237';if(method==='eth_getBalance')return'0x0';if(method==='personal_sign'){window.__signatures++;return'0x'+'1'.repeat(130)}return null},on(){},removeListener(){}};
  window.AxoReown={hasPersistedSession:()=>false,init:async()=>{},subscribe:async fn=>{window.__cb=fn;return()=>{}},open:async()=>{window.__opened++},resync(){},disconnect:async()=>{}};
 });
 await page.addScriptTag({content:walletScript});
 await page.addScriptTag({content:holderScript});
 await page.waitForFunction(()=>typeof axoHolderConnectAndSign==='function'&&axoHolderAccess!==null);
 assert.equal(await page.locator('.holder-status').count(),0,'holder access must not expose a second connect button');
 assert.equal(await page.evaluate(()=>window.__signatures),0,'page load must not request a signature');
 await page.evaluate(()=>axoWalletPanel());
 assert.equal(await page.locator('#axoReownConnect').count(),1);
 assert.equal(await page.locator('[data-axo-provider],#axoConnectSol').count(),0,'only Reown is exposed');
 await page.locator('#walletButton').click();
 await page.waitForFunction(()=>window.__cb!==null&&window.__opened===1);
 assert.equal(await page.evaluate(()=>window.__signatures),0,'opening Reown alone must not sign before an account connects');
 await page.evaluate(()=>window.__cb({account:{address:'0x1111111111111111111111111111111111111111',isConnected:true},provider:window.__provider,chainId:4663,connected:true}));
 await page.waitForFunction(()=>axoHolderAccess?.authenticated===true&&axoHolderPending===false);
 assert.equal(await page.evaluate(()=>window.__signatures),1,'the explicit Reown connect action signs once after connection');
 assert.equal(await page.evaluate(()=>axoWallet?.reown),true);
 assert.equal(await page.locator('#walletButton').innerText(),'◈ Normal holder','the verified balance tier is applied to the connected wallet UI');
 assert.match(await page.locator('#drawer').innerText(),/automatically applied from verified AXO holdings/);
 await page.locator('#walletButton').click();
 await page.waitForFunction(()=>document.querySelector('#drawerTitle')?.textContent==='Wallet & AXO access');
 assert.equal(await page.locator('#axoManageReown').count(),1);assert.equal(await page.locator('#axoDisconnect').count(),1);
 console.log('PASS one wallet/access control, explicit connect-then-sign, fresh AXO check and automatic tier display');
}finally{await browser.close()}
