import {runtimeDependency} from './axo-runtime.mjs';const {chromium}=runtimeDependency('playwright');
import assert from 'node:assert/strict';
const browser=await chromium.launch({...(process.env.AXO_BROWSER_CHANNEL==='chromium'?{}:{channel:process.env.AXO_BROWSER_CHANNEL||'msedge'}),headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:43187/?view=compact-intel');
 await page.waitForSelector('[data-common-stream="news"]');
 const common=page.locator('.axo-common-group');
 assert.equal(await common.locator('button').count(),11);
 assert.equal(await page.locator('.top-instruments [data-stream-home]').count(),1);
 const cases=[['solana','chain','solana',null],['base','chain','base',null],['bsc','chain','bsc',null],['new','narrative',null,'new'],['launchpads','launchpads',null,null],['momentum','narrative',null,'momentum'],['news','news',null,null],['axo','axo','robinhood','axo'],['hatchery','hatchery','robinhood','hatchery'],['home','home',null,null]];
 for(const [key,type,chain,id] of cases){
  const button=page.locator('[data-common-stream="'+key+'"]');
  assert.ok(await button.getAttribute('aria-label'));assert.ok(await button.getAttribute('title'));
  await button.click();
  assert.deepEqual(await page.evaluate(()=>({type:axoStream.type,chain:axoStream.chain,id:axoStream.id,selected})),{type,chain,id,selected:chain?[chain]:[]});
  assert.equal(await common.locator('[aria-current]').count(),1);assert.equal(await button.getAttribute('aria-current'),'page');
 }
 // Navigation from scoped streams must clear stale chains for global shortcuts.
 await page.locator('[data-common-stream="base"]').click();
 await page.locator('[data-common-stream="news"]').click();
 await page.locator('.axo-saved-group [data-stream-manage]').click();await page.locator('#detail [data-stream-back]').click();
 assert.equal(await page.locator('[data-common-stream="base"]').getAttribute('aria-current'),'page');
 // Native activation plus arrow navigation; feed renders must retain keyboard focus.
 await page.locator('[data-common-stream="home"]').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>axoStream.chain),'solana');
 await page.evaluate(()=>render(true));assert.equal(await page.evaluate(()=>document.activeElement.dataset.commonStream),'solana');
 await page.keyboard.press('End');await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>axoStream.type),'hatchery');
 await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>document.activeElement.dataset.commonStream),'home');
 await page.locator('[data-common-stream="base"]').click();
 await page.locator('.axo-saved-group [data-stream-save]').click();await page.locator('#axoStreamName').fill('My Base');await page.locator('#axoSaveStreamForm button').click();
 const saved=await page.evaluate(()=>axoShortcuts.at(-1).id);
 assert.equal(await page.locator('[data-stream-shortcut="'+saved+'"]').getAttribute('aria-current'),'page');
 await page.locator('[data-common-stream="news"]').click();assert.equal(await page.locator('.axo-saved-icons [aria-current]').count(),0);
 await page.reload();await page.locator('[data-stream-shortcut="'+saved+'"]').click();assert.equal(await page.evaluate(()=>axoStream.chain),'base');
 assert.equal(await page.locator('[data-stream-shortcut="'+saved+'"]').getAttribute('aria-current'),'page');
 assert.equal(await page.locator('.top-instruments details').count(),5);assert.equal(await page.locator('.focus-tile').count(),10);
 assert.equal(await page.evaluate(()=>document.querySelector('.header-actions').lastElementChild.id),'walletButton');
 await page.locator('#axoToolPulse summary').click();assert.equal(await page.locator('#axoToolPulse').getAttribute('open'),'');await page.locator('#axoToolPulse summary').click();
 // Full capacity saved shortcuts must scroll internally, leaving controls reachable.
 await page.evaluate(()=>{while(axoShortcuts.length<12)axoShortcuts.push({id:'fixture-'+axoShortcuts.length,name:'Saved scope '+axoShortcuts.length,stream:axoNormalizeStream({type:'narrative',id:'liquid'})});axoPersistShortcuts();axoRenderShortcuts()});
 await page.addStyleTag({content:'.card{transition:none!important;animation:none!important}.composer,.composer-note,#toast{visibility:hidden!important}'});
 for(const theme of ['light','dark'])for(const width of [320,390,1440]){
  await page.setViewportSize({width,height:1050});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  const sizing=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,buttons:[...document.querySelectorAll('.axo-common-group button,.axo-saved-group>[data-stream-save],.axo-saved-group>[data-stream-manage],.top-instruments details summary')].map(b=>{const r=b.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width}})}));
  assert.ok(sizing.scroll<=width,'Page overflow at '+width+': '+JSON.stringify(sizing));assert.ok(sizing.buttons.every(b=>b.x>=0&&b.right<=width&&b.width>0),'Unreachable control');
  await page.locator('.top-instruments').screenshot({path:'outputs/axo-common-streams-'+theme+'-'+width+'.png'});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: ten live destinations, unique toolbar Home, chain reset, Back/active states, keyboard/focus, saved persistence, all five tool menus, ten tiles, rightmost wallet, 12 saved shortcuts, 320/390/1440px light/dark without overflow.');
} finally {await browser.close()}
