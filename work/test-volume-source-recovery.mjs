import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createSourceCache,sourceResponseLimit} from './axo-source-cache.mjs';

const root='https://api.llama.fi/overview/dexs',catalog=root+'?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true',chain=root+'/Base?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true';
assert.equal(sourceResponseLimit(catalog),4000000);
for(const url of [chain,root,root+'?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true',catalog.replace('api.llama.fi','api.llama.fi.example')])assert.equal(sourceResponseLimit(url),2000000);
assert.equal(sourceResponseLimit(catalog,'text'),2000000);
const payload=JSON.stringify({protocols:[],padding:'x'.repeat(2250000)});
let reads=0;const cache=createSourceCache({policy:{defillama:{spacing:0}},fetchImpl:async url=>{reads++;return new Response(url===catalog?payload:'{"chain":"Base","total24h":123}');}});
const accepted=await cache.get(catalog);assert.equal(accepted.data.padding.length,2250000);await cache.get(catalog);assert.equal(reads,1,'The larger bounded catalog still uses the shared cache');
assert.equal((await cache.get(chain)).data.total24h,123);assert.equal(cache.status().providers[0].cooldownUntil,0);

for(const declared of [true,false]){
 let cancelled=false;
 const bounded=createSourceCache({policy:{defillama:{spacing:0}},fetchImpl:async url=>{
  if(url!==catalog)return Response.json({chain:'Base',total24h:456});
  if(declared)return new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-length':'4000001'}});
  return new Response(JSON.stringify({padding:'x'.repeat(4000000)}));
 }});
 await assert.rejects(bounded.get(catalog),{code:'source_size_limit'});if(declared)assert.equal(cancelled,true);
 assert.equal(bounded.status().providers[0].cooldownUntil,0,'A local response-size policy must not cool down other endpoints');
 assert.equal((await bounded.get(chain)).data.total24h,456,'The chain feed remains readable after the catalog is rejected');
}
let limitedCalls=0;const limited=createSourceCache({policy:{defillama:{spacing:0}},fetchImpl:async()=>{limitedCalls++;return new Response('{}',{status:429,headers:{'retry-after':'120'}});}});
await assert.rejects(limited.get(catalog));await assert.rejects(limited.get(chain));assert.equal(limitedCalls,1,'Real provider rate limits still apply across endpoints');

// Exercise the production collector without starting the server or any background jobs.
const source=await fs.readFile(new URL('./axo-server.mjs',import.meta.url),'utf8'),start=source.indexOf('async function loadDex(){'),end=source.indexOf('\nasync function loadCapital()',start),collector=source.slice(start,end);
assert.ok(start>0&&end>start);
const chains=[{id:'solana',name:'Solana',llama:'Solana'},{id:'base',name:'Base',llama:'Base'},{id:'bsc',name:'BNB Chain',llama:'BSC'},{id:'robinhood',name:'Robinhood',llama:'Robinhood Chain'},{id:'arc',name:'Arc',llama:'Arc'}];
let finishCatalog,wrongChain=false;const delayed=new Promise((_,reject)=>finishCatalog=()=>reject(Error('Catalog unavailable'))),state={},feed=async(key,source,fn)=>{try{state[key]={status:'live',data:await fn()};}catch(e){state[key]={status:'unavailable',error:e.message};}},get=async url=>{
 const u=new URL(url);assert.equal(u.origin,'https://api.llama.fi');if(u.pathname==='/overview/dexs')return delayed;
 const requested=decodeURIComponent(u.pathname.split('/').at(-1));return {chain:wrongChain?'Ethereum':requested,total24h:100,total48hto24h:80,change_1d:25,totalDataChart:[[1792195200,90]]};
},num=v=>v==null?null:Number(v);
const run=Function('chains','feed','get','num',collector+';return loadDex;')(chains,feed,get,num),pending=run();
await new Promise(r=>setTimeout(r,0));assert.equal(chains.filter(c=>state['dex-'+c.id]?.status==='live').length,5,'All chain reads finish before the optional catalog');finishCatalog();await pending;assert.equal(state.dex.status,'unavailable');
wrongChain=true;await run();assert.equal(chains.filter(c=>state['dex-'+c.id].status==='live').length,0,'A mismatched aggregate must never be assigned to a requested chain');
console.log('PASS: real-sized catalog caching, exact endpoint caps, header/stream bounds, isolated size failures, preserved provider 429 cooldown, five independent chain reads and exact chain attribution.');
