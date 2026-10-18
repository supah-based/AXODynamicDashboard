import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createEcosystemApi,AXO_URLS} from './axo-ecosystem-api.mjs';
import Model from './axo-reward-education.cjs';
import {createSourceCache} from './axo-source-cache.mjs';

const now=Date.now(),read=file=>JSON.parse(fs.readFileSync(new URL(file,import.meta.url),'utf8'));
const fixtures={config:read('axo-public-rewards-2.json'),status:read('axo-public-rewards-3.json'),overview:read('axo-public-rewards-5.json'),catalog:read('axo-public-rewards-8.json')};
fixtures.overview.observedAt=fixtures.catalog.observedAt=new Date(now).toISOString();fixtures.overview.status='LIVE';
const protectedKeys=['status','overview','catalog'];
let reads=0;
const capture=async()=>{reads++;return {at:now,data:Object.fromEntries(protectedKeys.map(k=>[k,{data:structuredClone(fixtures[k]),at:now}]))};};
const fake=kind=>async url=>{
 const key=Object.keys(AXO_URLS).find(k=>AXO_URLS[k]===url);
 if(protectedKeys.includes(key)){
  if(kind==='legacy')return new Response('{}',{status:403});
  if(kind==='cached')throw Object.assign(Error('Source retry cooldown; original observation unavailable'),{status:403});
  if(kind==='429'||kind==='mixed'&&key==='catalog')return new Response('{}',{status:429});
  throw Object.assign(Error('Public source HTTP 403'),{status:403});
 }
 return Response.json(key==='config'?fixtures.config:key==='rpc'?[]:{});
};
for(const kind of ['legacy','shared','cached']){
 reads=0;const api=createEcosystemApi({now:()=>now,fetchImpl:fake(kind),publicRewards:capture});
 const [a,b]=await Promise.all([api.snapshot(),api.snapshot()]);assert.equal(a,b);assert.equal(reads,1);
 assert.equal(a.identity.officialMatch,true);assert.equal(a.rewards.selected.length,0,'A failed native catalog and unavailable RPC proof must not invent a current selection');assert.equal(a.rewards.assets.length,6);assert.equal(a.fees.rewardBps,300);
 for(const k of protectedKeys){const source=a.sources.find(s=>s.id===k);assert.equal(source.delivery,'public-browser');assert.equal(source.httpStatus,200);assert.equal(a.sources.filter(s=>s.id===k).length,1);}
 const m=Model.model(a,now);assert.equal(m.selected.length,0);assert.equal(m.assets.length,6);assert.equal(m.minimumAxo,'1000000');assert.equal(m.holderPayments,null);
}
const staleCapture=async()=>{const d=await capture();d.data.catalog.data.status='STALE';return d;};
const stale=await createEcosystemApi({now:()=>now,fetchImpl:fake('shared'),publicRewards:staleCapture}).snapshot();assert.equal(stale.rewards.catalogStatus,'stale');assert.equal(stale.rewards.selected.length,0);assert.equal(Model.model(stale,now).assets.length,6,'Historical accounting must remain available when the current selector fails');
for(const mutation of [d=>{for(const item of Object.values(d.data))item.at=now+1;},d=>{for(const item of Object.values(d.data))item.at=now-900001;},d=>{d.data.catalog.data.token.address='0x'+'1'.repeat(40);}]){
 const api=createEcosystemApi({now:()=>now,fetchImpl:fake('shared'),publicRewards:async()=>{const d=await capture();mutation(d);return d;}});assert.equal((await api.snapshot()).rewards.selected.length,0);
}
const failed=await createEcosystemApi({now:()=>now,fetchImpl:fake('shared'),publicRewards:async()=>{throw Error('Browser unavailable');}}).snapshot();assert.equal(failed.rewards.assets.length,0);assert.equal(failed.sources.find(s=>s.id==='overview').httpStatus,403);
for(const kind of ['429','mixed']){reads=0;await createEcosystemApi({now:()=>now,fetchImpl:fake(kind),publicRewards:capture}).snapshot();assert.equal(reads,0,'A provider rate limit must not trigger a browser retry');}
let calls=0;const cache=createSourceCache({policy:{'example.org':{spacing:0}},fetchImpl:async()=>{calls++;return new Response('{}',{status:403});}});
await assert.rejects(cache.get('https://example.org/rewards'),{status:403});await assert.rejects(cache.get('https://example.org/rewards'),{status:403});assert.equal(calls,1,'Failure caching retains the HTTP classification without refetching');
console.log('PASS: legacy/shared/cached 403 recovery, coalesced ordinary public-page reads, exact token and fresh capture checks, accounting vs current selection, stale/failed capture handling, preserved 429 limits and cached HTTP classification.');
