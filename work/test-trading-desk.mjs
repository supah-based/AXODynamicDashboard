import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import Desk from './axo-trading-desk-model.cjs';
import {createTradingDesk} from './axo-trading-desk.mjs';
import {createChainApi,normalizeGecko} from './axo-chain-api.mjs';
import {createSecurityApi} from './axo-security-api.mjs';
import {createHistoryApi} from './axo-history-api.mjs';
import {createChainRpc} from './axo-chain-rpc.mjs';
import Assets from './axo-stablecoins.cjs';

let now=Date.now();
const evm=(i,width=40)=>'0x'+i.toString(16).padStart(width,'0');
const clone=structuredClone;
function pool(chain,i,change={}){
 const address=chain==='solana'?'3'.repeat(31)+String(i):evm(i);
 const pair=chain==='solana'?'2'.repeat(31)+String(i):evm(i+100,chain==='arc'?64:40);
 return {
  id:chain+':'+pair,chain,address,pair,name:'Token '+chain+i,symbol:'TK'+i,provider:'GeckoTerminal',price:.05,
  seenAt:now-30000,createdAt:now-5400000,liquidity:37000,marketCap:350000,fdv:800000,
  volume5:2200,volume1:9000,volume6:27000,volume24:100000,change1:8,change24:12,changes:{m5:2,h1:8,h24:12},
  transactions:{m5:{buys:12,sells:5},h1:{buys:78,sells:44}},participants:{m5:{buyers:8,sellers:4,unique:10},h1:{unique:70}},
  ...change
 };
}
const all=Desk.CHAIN_IDS.map(chain=>pool(chain,1));
const dip=pool('arc',2,{change24:-25,changes:{m5:0,h1:8,h24:-25}});
const severe=pool('base',2),mismatch=pool('bsc',2),unknownCap=pool('base',3,{marketCap:null}),late=pool('robinhood',2,{seenAt:now-320000});
const holder=p=>({chain:p.chain,address:p.address,source:'GoPlus',status:'available',receivedAt:now-40000,
 checks:['is_honeypot','cannot_sell_all','owner_change_balance'].map(key=>({key,value:'0'})),
 holderCount:1000,concentration:{share:.3,addresses:10}});
const otherPool=pool('arc',3).pair;
const market=createTradingDesk({
 now:()=>now,getPools:()=>[...all,dip,severe,mismatch,unknownCap,late,pool('arc',4,{name:'USD Coin',symbol:'USDC',address:Assets.canonical.arc.stable[0]}),pool('arc',5,{curve:true}),pool('base',4,{seenAt:now+1000}),pool('arc',6,{volume5:10000})],
 getRisk:p=>p.address===severe.address&&p.chain==='base'?{...holder(p),checks:[{key:'is_honeypot',label:'Honeypot',value:'1'}]}:
  p.address===mismatch.address&&p.chain==='bsc'?{...holder(p),address:evm(98)}:p.chain==='solana'?null:holder(p),
 getSimulation:p=>p.chain==='arc'?{chain:p.chain,address:p.address,pool:otherPool,receivedAt:now-30000,isHoneypot:true}:null,
 getChain:()=>({status:'available',sources:[{id:'top',provider:'GeckoTerminal',status:'available',fetchedAt:now-30000}],dex:{status:'live',receivedAt:now-60000,data:{volume:1000000,change:5},source:'DefiLlama'}}),
 getMarkets:()=>({status:'live',receivedAt:now-20000,data:[{symbol:'btc',price:62000,change:1,sourceTime:new Date(now-90000).toISOString()}]}),
 getChanges:()=>[{...dip,pool:dip.pair,kind:'project',metric:'liquidity',change:-20,toAt:now-60000}]
});
const d=market.snapshot();
assert.equal(d.chains.length,5);
assert.equal(d.bitcoin.price,62000);
assert.equal(d.changes[0].pool,dip.pair);
assert.equal(d.rows.find(r=>r.project.address===mismatch.address&&r.project.chain==='bsc').holders,null);
assert.equal(d.rows.find(r=>r.project.address===dip.address&&r.project.chain==='arc').risk.excluded,false,'Mismatched pool may not supply execution evidence');
const active=Desk.select(d.rows,{},now);
assert.deepEqual(new Set(active.slice(0,5).map(r=>r.project.chain)),new Set(Desk.CHAIN_IDS));
assert(active.every(r=>r.project.marketCap!==null&&r.risk.excluded===false&&Desk.fresh(r.project.seenAt,now)));
assert(!active.some(r=>r.project.address===evm(6)),'Inconsistent short windows cannot qualify');
assert(!d.rows.some(r=>r.project.symbol==='USDC'||r.project.address===evm(5)),'Stablecoins and launch-curve reserves stay out of DEX screens');
assert.equal(Desk.select(d.rows,{chain:'arc',mode:'rebound'},now)[0].project.address,dip.address);
assert(Desk.select(d.rows,{mode:'momentum'},now).every(r=>r.activity.pace>=1.5));
assert.equal(Desk.select(d.rows,{chain:'base',query:unknownCap.address,maxCap:null},now).length,1);
assert.equal(Desk.select(d.rows,{chain:'base',query:unknownCap.address},now).length,0,'FDV is never substituted for missing circulating cap');
assert.equal(Desk.select(d.rows,{mode:'following'},now,new Set([Desk.tokenKey(severe)]))[0].risk.excluded,true);
assert.equal(Desk.select(d.rows,{screened:true,chain:'solana'},now).length,0);
assert.equal(Desk.select(d.rows,{},now+300000).length,0,'A previously painted response cannot keep an expired market on the active screen');
assert.deepEqual(Desk.select(d.rows,{query:all[0].address.replace(/1$/,'2')},now).map(r=>r.project.address),[],'Exact Solana case and bytes are preserved');

const raw=JSON.parse((await fs.readFile('work/chain-probe-base.json','utf8')).replaceAll('"base_0x','"arc_0x'));
const tx=raw.data[0].attributes.transactions.m5;
Object.assign(tx,{buys:9,sells:3,buyers:7,sellers:2,unique_traders:8});
const arc=normalizeGecko(raw,'arc',now);
assert.equal(arc.length,20);
assert.deepEqual(arc[0].participants.m5,{buyers:7,sellers:2,unique:8});
const malformed=clone(raw);malformed.data[0].attributes.transactions.m5.unique_traders=50;
assert.equal(normalizeGecko(malformed,'arc',now)[0].participants.m5.unique,null);
let primary=0,fallback=0,native=0;
const marketSea=pool('arc',3),nativeRow=pool('arc',4);
const toDs=p=>({
 chainId:p.chain,pairAddress:p.pair,baseToken:{address:p.address,symbol:p.symbol,name:p.name},
 priceUsd:String(p.price),liquidity:{usd:p.liquidity},volume:{h1:p.volume1},txns:p.transactions
});
const chain=createChainApi({
 now:()=>now,getState:()=>({feeds:{}}),getSeeds:()=>[marketSea],getNativeSeeds:async()=>{native++;return {projects:[nativeRow],sources:[]}},
 gecko:{get:async url=>{primary++;assert.match(url,/\/networks\/arc\/(?:pools|new_pools)/);throw Error('provider cooldown')}},
 dex:{get:async url=>{
  fallback++;
  if(new URL(url).searchParams.get('q')==='Arc')return {at:now-12000,data:{pairs:[toDs(nativeRow)]}};
  assert.match(url,/tokens\/v1\/arc/);
  return {at:now-10000,data:[toDs(marketSea),toDs({...marketSea,chain:'base'}),toDs(pool('arc',7))]};
 }}
});
const [a,b]=await Promise.all([chain.snapshot('arc'),chain.snapshot('arc')]);
assert.deepEqual(a,b);assert.equal(primary,2);assert.equal(fallback,2);assert.equal(native,1);
assert.equal(a.status,'partial');assert(a.pools.every(p=>p.address===marketSea.address||p.address===nativeRow.address));
assert.equal(a.pools.find(p=>p.address===marketSea.address).seenAt,now-10000,'The newest exact DEX observation keeps its own fetch time');
const bnbSeed=pool('bsc',8);
let bnbSeedReads=0,bnbPoolReads=0;
const coldChain=createChainApi({
 now:()=>now,getState:()=>({feeds:{}}),
 getCandidateSeeds:async chain=>{assert.equal(chain,'bsc');bnbSeedReads++;return [bnbSeed,{...marketSea,seenAt:now}];},
 gecko:{get:async()=>{throw Error('provider cooldown');}},
 dex:{get:async url=>{
  if(new URL(url).searchParams.get('q')==='PancakeSwap')return {at:now,data:{pairs:[toDs({...marketSea,seenAt:now})]}};
  bnbPoolReads++;
  assert.equal(new URL(url).pathname,'/tokens/v1/bsc/'+bnbSeed.address);
  return {at:now,data:[toDs(bnbSeed)]};
 }}
});
const bnbSnapshot=await coldChain.snapshot('bsc');
assert.equal(bnbSeedReads,1);
assert.equal(bnbPoolReads,1);
assert.deepEqual(bnbSnapshot.pools.map(p=>p.address),[bnbSeed.address]);
assert.equal(bnbSnapshot.status,'partial');

const key='fixture-credentials-for-test';
const rpcCalls=[];
const rpc=createChainRpc({apiKey:key,now:()=>now,source:{get:async (url,options)=>{
 const host=new URL(url).hostname,request=JSON.parse(options.body);
 assert(!url.includes(key));
 const authenticated=host.endsWith('.g.alchemy.com');
 assert.equal(options.headers.authorization,authenticated?'Bearer '+key:undefined);
 rpcCalls.push({host,method:request.method,params:request.params});
 if(host==='bnb-mainnet.g.alchemy.com')throw Object.assign(Error('Rejected'),{status:403});
 const values={
  eth_chainId:host==='bsc-dataseed.bnbchain.org'?'0x38':'0x2105',eth_blockNumber:'0x1234',eth_getCode:'0x1234',
  eth_call:request.params[0]?.data==='0x313ce567'?'0x'+(18).toString(16).padStart(64,'0'):'0x'+(9007199254740993180000000000000001n).toString(16).padStart(64,'0'),
  getGenesisHash:'5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',
  getSlot:123456,
  getAccountInfo:{context:{slot:123456},value:{owner:'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',data:{parsed:{type:'mint',info:{isInitialized:true,decimals:6,supply:'100000001',mintAuthority:null,freezeAuthority:'1'.repeat(32)}}}}}
 };
 return {at:now,data:{jsonrpc:'2.0',id:1,result:values[request.method]}};
}}});
assert.equal((await rpc.head('bsc')).provider,'Public RPC');
assert.equal(rpc.localHead('bsc').height,4660);
await rpc.head('bsc');
assert.equal(rpcCalls.filter(c=>c.host==='bnb-mainnet.g.alchemy.com').length,1);
assert.equal((await rpc.head('arc')).status,'unavailable','Wrong-chain fallback cannot provide a block');
const contract=await rpc.token({chain:'base',address:pool('base',1).address});
assert.equal(contract.provider,'Alchemy');
assert.equal(contract.amount,'9007199254740993.180000000000000001');
assert(rpcCalls.some(c=>c.method==='eth_call'&&c.params[0].data==='0x18160ddd'&&c.params[1]==='0x1234'));
const mint=await rpc.token({chain:'solana',address:pool('solana',1).address});
assert.deepEqual([mint.amount,mint.mintAuthority,mint.freezeAuthority],['100.000001','disabled','active']);

let contractCalls=0;
const deskApi=createTradingDesk({getPools:()=>[marketSea],getContract:()=>{contractCalls++;return contract;},now:()=>now});
async function callDesk(path,method='GET'){
 let status,body;
 assert.equal(await deskApi.handle({method},{writeHead(v){status=v;},end(v){body=JSON.parse(v);}},new URL(path,'https://axo.test')),true);
 return {status,body};
}
const route='/api/trading-desk/contract?';
assert.equal((await callDesk(route+'chain=arc&address='+marketSea.address)).status,400);
assert.equal((await callDesk(route+new URLSearchParams({chain:'base',address:marketSea.address,pool:marketSea.pair}))).status,404);
assert.equal(contractCalls,0);
const exactFact=await callDesk(route+new URLSearchParams({chain:'arc',address:marketSea.address,pool:marketSea.pair}));
assert.equal(exactFact.status,200);
assert.equal(exactFact.body.evidence.amount,contract.amount);
assert.equal(contractCalls,1);
assert(!JSON.stringify(exactFact).includes(key));

const historyCalls=[];
const history=createHistoryApi({now:()=>now,fetchImpl:async url=>{
 historyCalls.push(url);
 const tokenId='arc_'+dip.address;
 const data=url.includes('/ohlcv/')?{attributes:{ohlcv_list:[[Math.floor(now/1000)-3600,1,1.2,.8,1,100]]}}:
  {attributes:{address:dip.pair},relationships:{base_token:{data:{id:tokenId}}}};
 return {ok:true,json:async()=>({data,included:[{id:tokenId,attributes:{address:dip.address}}]})};
}});
assert.equal((await history.history({chain:'arc',address:dip.address,pool:dip.pair})).candles.length,1);
assert(historyCalls.every(url=>url.includes('/networks/arc/pools/'+dip.pair)),'Arc v4 history must use the exact 32-byte pool ID');
let requests=0;
const security=createSecurityApi({now:()=>now,fetchImpl:async url=>{
 requests++;
 const contract=new URL(url).searchParams.get('contract_addresses').split(',')[0];
 return {ok:true,json:async()=>({result:{[contract]:{is_honeypot:0}}})};
}});
const background=await security.many([all[1],severe],{background:true});
assert.equal(requests,1,'Missing batch entries may not trigger per-token background retries');
assert.deepEqual(background.map(r=>r.status),['available','unavailable']);
console.log('PASS five-chain fair screening, provenance and age gates, filters, exact pool and holder checks, and bounded public fallback collection.');
