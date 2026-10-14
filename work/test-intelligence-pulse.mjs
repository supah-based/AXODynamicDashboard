import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Risk from './axo-risk-policy.cjs';
import {createIntelligencePulse} from './axo-intelligence-pulse.mjs';
import {createSecurityApi} from './axo-security-api.mjs';
import {publicRibbon} from './axo-public-ribbon.mjs';

let now=1792010000000;const address=i=>'0x'+i.toString(16).padStart(40,'0'),pool=i=>({id:'pulse-'+i,chain:'base',address:address(i),pair:address(i+100),name:'Fixture '+i,symbol:'FIX'+i,seenAt:now,createdAt:now-3600000,liquidity:100000,volume24:100000,volume1:10000,price:1,marketCap:1000000,privateWallet:'NEVER_PUBLIC',preferences:{secret:'NEVER_PUBLIC'}}),clean=p=>({chain:p.chain,address:p.address,source:'GoPlus',sourceUrl:'https://api.gopluslabs.io/',status:'available',receivedAt:now,checks:['is_honeypot','cannot_sell_all','owner_change_balance'].map(key=>({key,value:'0',label:key}))});
assert.equal(Risk.evaluate(pool(1),{...clean(pool(1)),checks:[{key:'is_honeypot',value:'0'}]},now).status,'unknown','One passed flag cannot count as core screening');
assert.equal(Risk.evaluate(pool(1),clean(pool(1)),now).status,'screened');
assert.equal(Risk.evaluate(pool(1),{...clean(pool(1)),receivedAt:now+1},now).status,'unknown');
const directory=await fs.mkdtemp(path.resolve('work/pulse-test-')),storagePath=path.join(directory,'public.json'),cache=new Map();let pools=[pool(1),pool(2)],reads=0,batches=0,failed=false;
const security={local:p=>cache.get(p.address)||null,security:async p=>{reads++;const d=failed?{status:'unavailable',chain:p.chain,address:p.address}:clean(p);cache.set(p.address,d);return d;},many:async ps=>{batches++;return Promise.all(ps.map(security.security));}};
let pulse=createIntelligencePulse({security,getPools:()=>pools,storagePath,now:()=>now,autoStart:false});
try{
 await Promise.all([pulse.tick(),pulse.tick()]);assert.equal(batches,1,'One shared scan even on simultaneous triggers');assert.equal(reads,2);assert.equal(pulse.snapshot().screening.screened,2);assert.equal(pulse.snapshot().events.filter(e=>e.type==='discovered').length,2);assert.doesNotMatch(JSON.stringify(pulse.snapshot()),/NEVER_PUBLIC|privateWallet|preferences/);
 await pulse.tick();assert.equal(reads,2,'Warm evidence reused');
 // A material liquidity change appends once, without pretending a withdrawal was proven.
 now+=60001;pools=pools.map((p,i)=>({...p,seenAt:now,liquidity:i?100000:30000}));await pulse.tick();const liq=pulse.snapshot().events.filter(e=>e.type==='liquidity');assert.equal(liq.length,1);assert.match(liq[0].evidence.note,/not proof/);now+=20000;pools=pools.map(p=>({...p,seenAt:now}));await pulse.tick();assert.equal(pulse.snapshot().events.filter(e=>e.type==='liquidity').length,1);
 // Severe exact-token flags survive outages, incomplete clear responses, and restart.
 cache.set(address(2),{...clean(pools[1]),checks:[{key:'is_honeypot',value:'1',label:'Honeypot'}]});await pulse.tick();assert.equal(pulse.local(pools[1]).checks[0].value,'1');assert.equal(pulse.snapshot().events.at(-1).type,'risk');await pulse.stop();
 assert.equal(JSON.parse(await fs.readFile(storagePath,'utf8')).quarantine.length,1,'Severe evidence must be written');failed=true;cache.clear();pulse=createIntelligencePulse({security,getPools:()=>pools,storagePath,now:()=>now,autoStart:false});await pulse.tick();assert.equal(Risk.evaluate(pools[1],pulse.local(pools[1]),now).excluded,true);assert.equal(pulse.snapshot().events.filter(e=>e.type==='discovered').length,2,'Restart does not fabricate repeated discoveries');
 cache.set(address(2),{...clean(pools[1]),checks:[{key:'is_honeypot',value:null}]});await pulse.tick();assert.equal(Risk.evaluate(pools[1],pulse.local(pools[1]),now).excluded,true);
 cache.set(address(2),clean(pools[1]));await pulse.tick();assert.equal(Risk.evaluate(pools[1],pulse.local(pools[1]),now).excluded,false);
 assert.deepEqual(publicRibbon({pools:[pool(9)],risk:()=>null,now}).projects,[]);assert.equal(publicRibbon({pools:[pool(9)],risk:clean,now}).projects.length,1);
 pools=[{...pool(7),seenAt:now+1},{...pool(8),seenAt:now-900001},{...pool(9),address:'not-a-token'},{...pool(10),address:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'}];await pulse.tick();assert.equal(pulse.snapshot().screening.tracked,0,'Future, stale, malformed and stable assets omitted');
 await pulse.stop();await fs.writeFile(storagePath,'broken');pulse=createIntelligencePulse({security,getPools:()=>[pool(1)],storagePath,now:()=>now,autoStart:false});await pulse.tick();assert.equal(pulse.snapshot().status,'storage_error');assert.equal(pulse.eligible(pool(1)),false);assert.equal((await pulse.security(pool(1))).status,'unavailable');
 // Real batching semantics with a mocked HTTP transport; missing exact contracts stay unknown.
 let requests=0;const api=createSecurityApi({now:()=>now,fetchImpl:async url=>{requests++;const u=new URL(url),tokens=u.searchParams.get('contract_addresses').split(',');assert.ok(tokens.length===2||tokens.length===1);return {ok:true,json:async()=>({result:{[tokens[0]]:{is_honeypot:'0',cannot_sell_all:'0',owner_change_balance:'0'}}})};}});const result=await api.many([pool(11),pool(12)]);assert.equal(requests,2,'Missing batch token gets a bounded single fallback');assert.equal(result[0].status,'available');assert.equal(result[1].status,'available');await api.security(pool(11));assert.equal(requests,2,'Batch result populates the ordinary exact-token cache');
 console.log('PASS shared pulse: critical-field completeness, batching/coalescing, evidence-first admission, incremental events, privacy whitelist, no duplicate restart discoveries, persistent severe flags, explicit clear, failure-closed storage, stale/future/native exclusion. Synthetic fixtures only.');
}finally{await pulse.stop();await fs.rm(directory,{recursive:true,force:true});}
