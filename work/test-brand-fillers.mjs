import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runtimeDependency} from './axo-runtime.mjs';
const root='http://127.0.0.1:43187',manifest=JSON.parse(await fs.readFile('work/axo-brand-manifest.json','utf8'));
assert.equal(manifest.images.length,20);
const hashes=new Set();
for(const asset of manifest.images){
 const bytes=await fs.readFile('outputs/axo-brand-set/'+asset.file),width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 assert.ok(Math.abs(width/height-16/9)<.02,asset.name+' landscape framing');
 const digest=createHash('sha256').update(bytes).digest('hex');assert.ok(!hashes.has(digest),'Each scene has a distinct image');hashes.add(digest);
 const response=await fetch(root+'/assets/axo-brand/'+asset.file+'?v=action-v2');assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
 assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),digest,'The server returns the replaced image');
}
const {chromium}=runtimeDependency('playwright'),browser=await chromium.launch({channel:process.env.AXO_BROWSER_CHANNEL||'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1800,height:1400},reducedMotion:'reduce'});
 await page.addInitScript(()=>localStorage.setItem('axo-education-last-shown',String(Date.now())));
 await page.route('**/api/dashboard',r=>r.fulfill({json:{feeds:{},events:[]}}));
 await page.route('**/api/discovery*',r=>r.fulfill({json:{enabled:false,jobs:[],results:{},alerts:[]}}));
 await page.goto(root+'/?view=compact-intel');await page.waitForFunction(()=>typeof axoFindBrandGaps==='function');
 const checked=await page.evaluate(()=>{
  // Keep background feed arrivals from rebuilding the controlled geometry fixture.
  render=()=>{};axoStream={type:'home'};axoEducationShown?.node.remove();axoEducationShown=null;localStorage.setItem(educationKey,String(Date.now()));
  const board=$('board');board.replaceChildren();const columns=Math.max(1,Math.min(5,Math.floor((board.clientWidth+12)/294)));
  for(let i=0;i<columns;i++){const card=document.createElement('article');card.className='card';card.dataset.card='filler-fixture-'+i;card.style.height=(i===0?600:150+i*30)+'px';card.textContent='Research card '+i;board.append(card);}
  const geometry=()=>[...board.querySelectorAll('article.card')].map(e=>({id:e.dataset.card,width:e.style.width,transform:e.style.transform,height:e.offsetHeight}));
  brandLayoutBase();const baseline=geometry(),height=board.style.height;layout();
  const base=board.getBoundingClientRect(),rect=e=>{const r=e.getBoundingClientRect();return {x:r.x-base.x,y:r.y-base.y,width:r.width,height:r.height};};
  return {columns,baseline,after:geometry(),height,afterHeight:board.style.height,width:board.clientWidth,cards:[...board.querySelectorAll('article.card')].map(rect),fillers:[...board.querySelectorAll('[data-axo-brand-gap]')].map(e=>({...rect(e),src:e.querySelector('img').getAttribute('src'),hidden:e.getAttribute('aria-hidden')}))};
 });
 assert.ok(checked.columns>=3);assert.deepEqual(checked.after,checked.baseline,'Art never moves or resizes research cards');assert.equal(checked.afterHeight,checked.height,'Art never extends the board');
 assert.ok(checked.fillers.length>=2);assert.equal(new Set(checked.fillers.map(x=>x.src)).size,checked.fillers.length,'Visible gaps use different scenes');
 for(const art of checked.fillers){assert.equal(art.hidden,'true');assert.ok(art.src.endsWith('?v=action-v2'));assert.ok(art.x>=-1&&art.y>=-1&&art.x+art.width<=checked.width+1&&art.y+art.height<=parseFloat(checked.height)+1);for(const card of checked.cards)assert.ok(art.x+art.width<=card.x+1||card.x+card.width<=art.x+1||art.y+art.height<=card.y+1||card.y+card.height<=art.y+1,'Art stays in unoccupied space');}
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.evaluate(()=>document.querySelectorAll('[data-axo-brand-gap] img').forEach(i=>i.loading='eager'));
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-axo-brand-gap] img')].every(i=>i.complete&&i.naturalWidth>0));
 await page.locator('#board').screenshot({path:'outputs/axo-action-fillers-desktop.png'});
 await page.evaluate(()=>{document.querySelectorAll('#board article.card').forEach(e=>e.style.height='600px');layout();});assert.equal(await page.locator('[data-axo-brand-gap]').count(),0,'Closing the gaps removes the artwork');
 await page.setViewportSize({width:390,height:1000});await page.evaluate(()=>layout());assert.equal(await page.locator('[data-axo-brand-gap]').count(),0,'Single-column mobile layout adds no filler');
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 console.log('PASS: twenty distinct replaced images, public cache-versioned routes, landscape framing, no repeated visible scenes, no research-card displacement or overlap, gap removal and mobile layout.');
}finally{await browser.close();}
