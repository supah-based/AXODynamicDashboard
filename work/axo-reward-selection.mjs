import {parseAbi, encodeFunctionData, decodeFunctionResult, encodeAbiParameters, keccak256} from 'viem';
import {AXO} from './axo-identity.mjs';
import {rewardHookAbi} from './axo-reward-selection-abi.mjs';

// Exact public deployment and compact-full ABI published by Based.bid. Unknown
// deployments/layouts fail closed; there is no write method or wallet client.
export const REWARD_DEPLOYMENT=Object.freeze({rpc:'https://rpc.mainnet.chain.robinhood.com',positionManager:'0x58daec3116aae6d93017baaea7749052e8a04fa7',hook:'0x037bf303462bb3cde80038a1945cd10af1ebdacc',codeHash:'0x81e90bf90efb2e0221a0e6bef8b34a3c0c6d8fa99a77e478ac34301aea0d3d96'});
const zero='0x'+'0'.repeat(40),eq=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase(),address=a=>typeof a==='string'&&/^0x[a-f0-9]{40}$/i.test(a),fresh=(at,now)=>Number.isFinite(at)&&at>0&&at<=now&&now-at<=900000;
const poolAbi=parseAbi(['function poolKeys(bytes25) view returns (address,address,uint24,int24,address)']),tokenAbi=parseAbi(['function symbol() view returns (string)']);
export function currentRewardCatalog(catalog,now=Date.now()){return catalog?.status==='LIVE'&&catalog?.token?.chainId===4663&&eq(catalog.token.address,AXO.address)&&fresh(Date.parse(catalog.observedAt),now)}
function hexNumber(s){if(typeof s!=='string'||!/^0x[0-9a-f]+$/i.test(s))throw Error('Invalid RPC number');const n=Number(BigInt(s));if(!Number.isSafeInteger(n)||n<0)throw Error('Invalid RPC number');return n}
function symbol(result){try{const s=decodeFunctionResult({abi:tokenAbi,functionName:'symbol',data:result});return typeof s==='string'&&/^[\p{L}\p{N} ._+/-]{1,30}$/u.test(s)?s:null}catch{return null}}
export function selectedRewardPaths(selection,raiseCurrency){
 if(!selection||typeof selection.isSwapAll!=='boolean'||!Array.isArray(selection.paths)||!selection.paths.length||selection.paths.length>10||!Array.isArray(selection.RWAPercentsBps)||selection.paths.length!==selection.RWAPercentsBps.length)throw Error('Unsupported reward paths');
 const weights=selection.RWAPercentsBps.map(Number);if(weights.some(n=>!Number.isInteger(n)||n<=0||n>10000)||weights.reduce((a,b)=>a+b,0)!==10000)throw Error('Invalid reward weights');
 const assets=new Map();for(let i=0;i<selection.paths.length;i++){
  const hops=selection.paths[i]?.hops;if(!Array.isArray(hops)||hops.length>5)throw Error('Unsupported reward route');let end=raiseCurrency.toLowerCase();
  for(const hop of hops){if(!address(hop.currency0)||!address(hop.currency1)||eq(hop.currency0,hop.currency1)||!address(hop.hooks)||!Number.isInteger(hop.fee)||hop.fee<0||hop.fee>0xffffff||!Number.isInteger(hop.tickSpacing))throw Error('Invalid reward hop');if(eq(hop.currency0,end))end=hop.currency1.toLowerCase();else if(eq(hop.currency1,end))end=hop.currency0.toLowerCase();else throw Error('Disconnected reward path');}
  // Native payouts cannot be represented by the existing ERC20 catalog schema.
  if(end===zero)throw Error('Native reward selection needs a distinct asset schema');
  assets.set(end,(assets.get(end)||0)+weights[i]);
 }
 return [...assets].map(([address,weightBps])=>({address,weightBps}));
}
export function createRewardSelectionReader({read,now=Date.now}={}){
 let cached=null,job=null,nextAttempt=0;
 async function batch(label,calls){
  const r=await read('reward-selection-'+label,REWARD_DEPLOYMENT.rpc,{method:'POST',ttl:0,headers:{'content-type':'application/json'},body:JSON.stringify(calls.map((c,i)=>({jsonrpc:'2.0',id:i+1,...c})))});
  if(r.source?.status!=='available'||!fresh(r.at,now())||!Array.isArray(r.data)||r.data.length!==calls.length)throw Error('Reward RPC unavailable');
  return calls.map((_,i)=>{const matches=r.data.filter(v=>v.id===i+1);if(matches.length!==1||matches[0].error||matches[0].result==null)throw Error('Reward RPC read failed');return matches[0].result});
 }
 return async function selection(){
  if(cached&&fresh(Date.parse(cached.observedAt),now()))return cached;if(job)return job;if(now()<nextAttempt)return null;nextAttempt=now()+60000;
  job=(async()=>{try{
   const [chain,blockTag]=await batch('head',[{method:'eth_chainId',params:[]},{method:'eth_blockNumber',params:[]}]);if(hexNumber(chain)!==4663)throw Error('Reward chain mismatch');hexNumber(blockTag);
   const poolCall=encodeFunctionData({abi:poolAbi,functionName:'poolKeys',args:[AXO.pool.slice(0,52)]});
   const [block,rawPool,code,rawConfig]=await batch('config',[{method:'eth_getBlockByNumber',params:[blockTag,false]},{method:'eth_call',params:[{to:REWARD_DEPLOYMENT.positionManager,data:poolCall},blockTag]},{method:'eth_getCode',params:[REWARD_DEPLOYMENT.hook,blockTag]},{method:'eth_call',params:[{to:REWARD_DEPLOYMENT.hook,data:encodeFunctionData({abi:rewardHookAbi,functionName:'getPoolFullConfig',args:[AXO.pool]})},blockTag]}]);
   const at=hexNumber(block?.timestamp)*1000;if(!fresh(at,now())||block.number!==blockTag||!/^0x[a-f0-9]{64}$/i.test(block.hash||''))throw Error('Stale or invalid reward block');
   const pool=decodeFunctionResult({abi:poolAbi,functionName:'poolKeys',data:rawPool});
   const poolId=keccak256(encodeAbiParameters([{type:'address'},{type:'address'},{type:'uint24'},{type:'int24'},{type:'address'}],pool));
   if(!eq(poolId,AXO.pool)||!eq(pool[4],REWARD_DEPLOYMENT.hook)||!eq(keccak256(code),REWARD_DEPLOYMENT.codeHash))throw Error('Reward deployment mismatch');
   const config=decodeFunctionResult({abi:rewardHookAbi,functionName:'getPoolFullConfig',data:rawConfig}),[settings,fees]=config;
   if(!address(settings.poolOwner)||eq(settings.poolOwner,zero)||!eq(pool[settings.projectTokenIsCurrency1?1:0],AXO.address)||!Number.isInteger(fees.rewardFeeBps)||fees.rewardFeeBps<=0||fees.rewardFeeBps>10000)throw Error('Unconfigured reward pool');
   const assets=selectedRewardPaths(config[8],pool[settings.projectTokenIsCurrency1?0:1]);
   // Exact token metadata is read at the same block; no old symbol/catalog fixture.
   const metadata=await batch('metadata',[...assets.map(a=>({method:'eth_call',params:[{to:a.address,data:encodeFunctionData({abi:tokenAbi,functionName:'symbol'})},blockTag]})),{method:'eth_getBlockByNumber',params:[blockTag,false]}]);
   if(!eq(metadata.at(-1)?.hash,block.hash)||metadata.at(-1)?.number!==blockTag)throw Error('Reward block changed during observation');
   assets.forEach((a,i)=>{a.symbol=symbol(metadata[i])||a.address.slice(0,8)+'…'+a.address.slice(-4);a.weightPercent=a.weightBps/100});
   const all=config[8].isSwapAll,distribution={mode:all?'ALL_AT_ONCE':'ROTATING',label:all?'ALL AT ONCE':'ROTATING',weightsVerified:true,weightsBps:assets.map(a=>a.weightBps),modeSource:'ROBINHOOD_EXACT_POOL_CONTRACT'};
   cached={status:'LIVE',source:'ROBINHOOD_EXACT_POOL_CONTRACT',observedAt:new Date(at).toISOString(),token:{chainId:4663,address:AXO.address},evidence:{blockNumber:hexNumber(blockTag),blockHash:block.hash,poolId:AXO.pool,hook:REWARD_DEPLOYMENT.hook,codeHash:REWARD_DEPLOYMENT.codeHash},rewards:{assets,coreAssets:assets,distribution}};return cached;
  }catch{return null}})();try{return await job}finally{job=null}
 };
}
