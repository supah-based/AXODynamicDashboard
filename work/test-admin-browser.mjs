import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {runtimeDependency} from './axo-runtime.mjs';
const {chromium}=runtimeDependency('playwright');
const browser=await chromium.launch(process.platform==='win32'?{channel:process.env.AXO_BROWSER_CHANNEL||'msedge',headless:true}:{executablePath:process.env.AXO_BROWSER_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const owner='0xD3B2eCfe77780bFfDFA356B70DC190C914511761';let calls=0;
try{
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.pathname==='/api/admin/identity')return route.fulfill({json:{wallet:owner}});if(url.pathname==='/api/admin/challenge')return route.fulfill({json:{message:'Fixture login message',nonce:'fixture'}});if(url.pathname==='/api/admin/verify')return route.fulfill({json:{csrf:'fixture',authenticated:true}});if(url.pathname==='/api/admin/status')return route.fulfill({json:{voiceKey:{configured:false,managed:false,verified:false,updatedAt:null},settings:{voiceEnabled:true,standardVoiceSessionSeconds:180,standardDailyStarts:10,radioEnabled:true}}});if(url.pathname.startsWith('/api/admin/')){calls++;return route.fulfill({json:{ok:true}})}return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#121821;color:#eee;font:15px sans-serif}.header-actions{display:flex;flex-wrap:wrap;gap:8px}.btn{padding:10px;border:1px solid #888;background:#28343c;color:white}.drawer{max-width:min(90vw,500px);padding:16px;margin:auto}.panel{padding:12px;border:1px solid #777;margin:12px 0}input{max-width:100%;box-sizing:border-box;display:block;margin:8px 0}</style><div class="header-actions"></div><div class="drawer" id="drawer"></div><script>let axoWallet=null;function open(html){document.getElementById("drawer").innerHTML=html}function close(){open("")}function toast(){};</script>'})});
 await page.goto('http://127.0.0.1:43188/');await page.addScriptTag({content:await fs.readFile('work/axo-admin-ui.js','utf8')});
 assert.equal(await page.locator('#axoAdminButton').count(),0);
 await page.evaluate(()=>{axoWallet={kind:'evm',address:'0x0000000000000000000000000000000000000001',provider:{request:async()=>[]}};window.dispatchEvent(new Event('axo:wallet-state'))});assert.equal(await page.locator('#axoAdminButton').count(),0);
 await page.evaluate(owner=>{axoWallet={kind:'evm',address:owner,provider:{request:async({method})=>method==='eth_accounts'?[owner]:'0x'+'ab'.repeat(65)}};window.dispatchEvent(new Event('axo:wallet-state'))},owner);
 await page.locator('#axoAdminButton').click();await page.locator('#adminKey').waitFor();assert.equal(await page.locator('#adminKey').getAttribute('type'),'password');assert.match(await page.locator('.drawer').innerText(),/billing is separate/);
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)}
 await page.evaluate(()=>{axoWallet.address='0x0000000000000000000000000000000000000002';window.dispatchEvent(new Event('axo:wallet-state'))});await page.locator('#axoAdminButton').waitFor({state:'detached'});assert.equal(calls,1);assert.deepEqual(errors,[]);
 console.log('PASS admin button exact-wallet only, masked form, separate billing warning, account-change logout and 1440/390/320 responsive layout');
}finally{await browser.close()}
