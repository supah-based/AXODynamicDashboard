import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {encodeFunctionResult,decodeFunctionResult,parseAbi} from 'viem';
import {createRewardSelectionReader,selectedRewardPaths,currentRewardCatalog,REWARD_DEPLOYMENT} from './axo-reward-selection.mjs';
import {rewardHookAbi} from './axo-reward-selection-abi.mjs';
import {createEcosystemApi,AXO_URLS} from './axo-ecosystem-api.mjs';
import Model from './axo-reward-education.cjs';
const fixture=JSON.parse(await fs.readFile(new URL('axo-reward-selection-fixture.json',import.meta.url),'utf8'));
const at=Number(BigInt(fixture.block.timestamp))*1000;let clock=at+10000;
const poolAbi=parseAbi(['function poolKeys(bytes25) view returns (address,address,uint24,int24,address)']),symbolAbi=parseAbi(['function symbol() view returns (string)']);
const rawPool=encodeFunctionResult({abi:poolAbi,functionName:'poolKeys',result:fixture.pool}),symbol=encodeFunctionResult({abi:symbolAbi,functionName:'symbol',result:'AAPL'});
function response(c){return c.method==='eth_chainId'?'0x1237':c.method==='eth_blockNumber'?fixture.block.number:c.method==='eth_getBlockByNumber'?fixture.block:c.method==='eth_getCode'?fixture.code:c.params[0].to.toLowerCase()===REWARD_DEPLOYMENT.positionManager?rawPool:c.params[0].to.toLowerCase()===REWARD_DEPLOYMENT.hook?fixture.rawConfig:symbol;}
const make=(mutate=()=>{})=>{const calls=[];return {calls,read:async(key,url,o)=>{assert.equal(url,REWARD_DEPLOYMENT.rpc);const req=JSON.parse(o.body);calls.push(req);const data=req.map(c=>({jsonrpc:'2.0',id:c.id,result:structuredClone(response(c))}));mutate(data,req,key);return {data,at:clock,source:{status:'available'}}}}};
const normal=make(),reader=createRewardSelectionReader({read:normal.read,now:()=>clock});const [a,b]=await Promise.all([reader(),reader()]);assert.equal(a,b);assert.equal(normal.calls.length,3,'Concurrent requests share the chain reads');
assert.equal(a.rewards.assets[0].symbol,'AAPL');assert.equal(a.rewards.assets[0].address,'0xaf3d76f1834a1d425780943c99ea8a608f8a93f9');assert.equal(a.rewards.assets[0].weightBps,10000);assert.equal(a.rewards.distribution.label,'ALL AT ONCE');assert.equal(a.evidence.blockHash,fixture.block.hash);assert.equal(a.observedAt,new Date(at).toISOString());assert(currentRewardCatalog(a,clock));
for(const req of normal.calls.slice(1).flat())if(['eth_call','eth_getCode'].includes(req.method))assert.equal(req.params[1],fixture.block.number,'Every dependent read is at the observed block');
await reader();assert.equal(normal.calls.length,3,'Reuse the public observation for fifteen minutes');clock=at+900001;assert.equal(await reader(),null,'An expired chain head must not be presented as current');clock=at+10000;
for(const mutate of [
 (d,r)=>{if(r[0].method==='eth_chainId')d[0].result='0x1'},
 (d,r)=>{if(r[0].method==='eth_getBlockByNumber')d[0].result.timestamp='0x'+Math.floor((clock+1000)/1000).toString(16)},
 (d,r)=>{if(r[0].method==='eth_getBlockByNumber')d[0].result.number='0x1'},
 (d,r)=>{if(r[0].method==='eth_getBlockByNumber')d[0].result.hash='not-a-block'},
 (d,r,key)=>{if(key.endsWith('metadata'))d.at(-1).result.hash='0x'+'1'.repeat(64)},
 (d,r)=>{const i=r.findIndex(x=>x.method==='eth_getCode');if(i>=0)d[i].result='0x00'},
 (d,r)=>{const i=r.findIndex(x=>x.method==='eth_call'&&x.params[0].to===REWARD_DEPLOYMENT.positionManager);if(i>=0)d[i].result=encodeFunctionResult({abi:poolAbi,functionName:'poolKeys',result:[fixture.pool[0],'0x'+'1'.repeat(40),...fixture.pool.slice(2)]})},
 (d,r)=>{const i=r.findIndex(x=>x.method==='eth_call'&&x.params[0].to===REWARD_DEPLOYMENT.hook);if(i>=0)d[i].result='0x'},
 d=>{if(d.length>1)d[1].id=d[0].id},
 d=>{d[0].error={code:-32000,message:'Provider unavailable'}}
]){const f=make(mutate);assert.equal(await createRewardSelectionReader({read:f.read,now:()=>clock})(),null,'Bad chain, block, identity, runtime, layout and RPC evidence must fail closed');}
const config=decodeFunctionResult({abi:rewardHookAbi,functionName:'getPoolFullConfig',data:fixture.rawConfig}),selection=config[8];assert.equal(selectedRewardPaths(selection,fixture.pool[0])[0].weightBps,10000);
for(const bad of [{...selection,RWAPercentsBps:[9999]},{...selection,RWAPercentsBps:[0]},{...selection,paths:[]},{...selection,paths:[{hops:[selection.paths[0].hops[1]]}]}])assert.throws(()=>selectedRewardPaths(bad,fixture.pool[0]));
// Integration uses one RPC URL with distinct bodies. A URL-only cache would
// return the ordinary token supply batch for selection, so this tests the seam.
const configPublic=JSON.parse(await fs.readFile(new URL('axo-public-rewards-2.json',import.meta.url),'utf8'));let rpcReads=0;
const fetchImpl=async(url,opts)=>{
 if(url===AXO_URLS.config)return Response.json(configPublic);
 if(url!==AXO_URLS.rpc)return new Response('{}',{status:403});
 rpcReads++;const req=JSON.parse(opts.body);return Response.json(req.map(c=>({jsonrpc:'2.0',id:c.id,result:response(c)})));
};
const snapshot=await createEcosystemApi({fetchImpl,now:()=>clock}).snapshot();assert.equal(rpcReads,4);assert.equal(snapshot.rewards.catalogStatus,'available');assert.equal(snapshot.rewards.selectionSource,'ROBINHOOD_EXACT_POOL_CONTRACT');assert.equal(snapshot.rewards.cycle.mode,'ALL AT ONCE');assert.equal(Model.model(snapshot,clock).selected[0].symbol,'AAPL');assert.equal(Model.model(snapshot,clock).holderPayments,null);assert(snapshot.sources.some(s=>s.id==='catalog'&&s.status==='unavailable'),'Preserve the failed native source alongside recovered on-chain evidence');
console.log('PASS: exact-pool on-chain reward selection, runtime/layout pin, coherent block reads, path/weight validation, coalescing, fifteen-minute freshness and catalog outage recovery with independent RPC caches.');
