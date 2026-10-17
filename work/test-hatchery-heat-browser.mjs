import assert from 'node:assert/strict';
import fs from 'node:fs';
import {runtimeDependency} from './axo-runtime.mjs';
const {chromium}=runtimeDependency('playwright'),browser=await chromium.launch({channel:process.env.AXO_BROWSER_CHANNEL||'chrome',headless:true});
const fixture=JSON.parse(fs.readFileSync('work/axo-ecosystem-fixture.json','utf8')),a=fixture.community.projects[0].address,wallet='0x'+'1'.repeat(40),other='0x'+'2'.repeat(40),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
let connected=false,score=null,posts=[],pendingVote=null;
const view=()=>({version:1,connected,wallet,hatched:true,passportReady:true,checkedAt:Date.now(),projects:connected?fixture.community.projects.map(p=>({address:p.address,canVote:score===null&&p.address===a,completed:score!==null&&p.address===a,heatScore:p.address===a?score:null,reason:score===null?'Choose your heat position':'Heat call already saved'})):[]});
page.on('pageerror',e=>errors.push(e.message));
await page.route('**/api/axo-ecosystem',r=>r.fulfill({json:{...fixture,asOf:Date.now()}}));
await page.route('**/api/auth/status',r=>r.fulfill({json:{authenticated:true,wallet,tier:{id:'holder',name:'Fixture'},features:{ask:true}}}));
await page.route('**/api/events',r=>r.fulfill({contentType:'text/event-stream',body:'data: {}\n\n'}));
await page.route('**/api/hatchery-heat**',async r=>{
 const u=new URL(r.request().url()),b=r.request().method()==='POST'?r.request().postDataJSON():null;if(b)posts.push({route:u.pathname,body:b});
 if(u.pathname.endsWith('/challenge'))return r.fulfill({json:{origin:'https://axo.pet',chainId:4663,message:'axo.pet wants you to sign in with your Ethereum account:\n'+wallet+'\n\nSign in to AXO. This does not submit a transaction or grant token approval.'}});
 if(u.pathname.endsWith('/verify'))connected=true;
 if(u.pathname.endsWith('/vote')){if(pendingVote)await pendingVote;score=b.heatScore;return r.fulfill({json:{...view(),receipt:{address:a,heatScore:score,epochId:'AXO-2026-W42',xpAwarded:4}}});}
 return r.fulfill({json:view()});
});
try{
 await page.goto('http://127.0.0.1:43187/?view=compact-intel');await page.waitForFunction(()=>window.AxoHatcheryHeat);
 await page.locator('[data-common-stream="hatchery"]').click();const card=page.locator('[data-card="stream-data-hatchery-list"]'),bar=card.locator('[data-hatchery-heat="'+a+'"]');await bar.waitFor();
 assert.equal(await bar.locator('[data-hatchery-score]').count(),11);assert.equal(await bar.locator('[data-hatchery-score]:enabled').count(),0);assert.equal(posts.length,0);assert.equal(await card.getByText('CORROBORATE IN HATCHERY',{exact:false}).count(),0);
 await page.evaluate(wallet=>{window.hhSignatures=0;axoWallet={kind:'evm',address:wallet,provider:{request:async q=>{if(q.method==='eth_accounts')return [wallet];if(q.method==='personal_sign'){window.hhSignatures++;return '0x'+'1'.repeat(130);}throw Error('No transactions permitted');}}};axoHolderAccess={authenticated:true,wallet,tier:{id:'holder',name:'Fixture'},features:{ask:true}};window.dispatchEvent(new Event('axo:holder-access'));},wallet);
 await bar.getByRole('button',{name:'Connect Hatchery',exact:true}).waitFor();assert.equal(await page.evaluate(()=>hhSignatures),0);assert.equal(posts.length,0);
 await bar.getByRole('button',{name:'Connect Hatchery',exact:true}).click();await bar.locator('[data-hatchery-score="8"]:enabled').waitFor();assert.equal(await page.evaluate(()=>hhSignatures),1);assert.deepEqual(posts.map(p=>p.route),['/api/hatchery-heat/challenge','/api/hatchery-heat/verify']);
 await bar.locator('[data-hatchery-score="8"]').focus();await page.keyboard.press('Enter');await page.waitForFunction(a=>document.querySelector('[data-hatchery-heat="'+a+'"]')?.textContent.includes('4 XP from Hatchery'),a);assert.equal(await bar.locator('[aria-pressed="true"]').getAttribute('data-hatchery-score'),'8');assert.equal(await bar.locator('[data-hatchery-score]:enabled').count(),0);assert.equal(posts.filter(p=>p.route.endsWith('/vote')).length,1);
 assert.deepEqual(posts.at(-1).body,{address:a,heatScore:8});
 // The same inline control appears in project details; no outbound corroborate link.
 await card.locator('[data-eco-project]').first().click();assert.equal(await page.locator('#detail [data-hatchery-heat]').count(),1);assert.equal(await page.locator('#detail a').filter({hasText:/Corroborate in Hatchery/i}).count(),0);await page.evaluate(()=>close());
 for(const theme of ['light','dark'])for(const width of [320,390,1440]){await page.setViewportSize({width,height:1000});await page.evaluate(t=>{document.documentElement.dataset.theme=t;layout();},theme);await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No overflow '+theme+width);const bounds=await bar.locator('.hh-zones').boundingBox();assert.ok(bounds.width>150);await bar.screenshot({path:'outputs/axo-inline-heat-'+theme+'-'+width+'.png'});}
 // Account changes clear receipts immediately, including in-flight responses.
 await page.evaluate(other=>{axoWallet.address=other;axoHolderAccess.wallet=other;window.dispatchEvent(new Event('axo:wallet-state'));},other);
 assert.equal(await bar.locator('[aria-pressed="true"]').count(),0);assert.doesNotMatch(await bar.innerText(),/4 XP from Hatchery/);
 // Reset the fixture and reconnect; delayed receipt cannot follow a wallet switch.
 score=null;connected=false;await page.evaluate(wallet=>{axoWallet.address=wallet;axoHolderAccess.wallet=wallet;window.dispatchEvent(new Event('axo:wallet-state'));},wallet);await bar.getByRole('button',{name:'Connect Hatchery',exact:true}).click();await bar.locator('[data-hatchery-score="10"]:enabled').waitFor();
 let release;pendingVote=new Promise(r=>release=r);await bar.locator('[data-hatchery-score="10"]').click();await page.waitForFunction(a=>document.querySelector('[data-hatchery-heat="'+a+'"]')?.textContent.includes('Saving Red hot'),a);assert.equal(await bar.locator('[data-hatchery-score]:enabled').count(),0);
 await page.evaluate(other=>{axoWallet.address=other;axoHolderAccess.wallet=other;window.dispatchEvent(new Event('axo:wallet-state'));},other);release();await page.waitForTimeout(150);assert.equal(await bar.locator('[aria-pressed="true"]').count(),0);assert.doesNotMatch(await bar.innerText(),/4 XP from Hatchery/);
 assert.deepEqual(errors,[]);console.log('PASS: inline cold/hot bar in Hatchery rows and detail, explicit native sign-in, keyboard vote, exact receipt feedback, duplicate lock, wallet-switch clearing, delayed response isolation and 320/390/1440 light/dark layouts.');
}finally{await browser.close();}
