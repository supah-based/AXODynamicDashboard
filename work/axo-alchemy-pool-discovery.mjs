import {chainAddress} from './axo-chain-api.mjs';
import {createSourceCache} from './axo-source-cache.mjs';
import Assets from './axo-stablecoins.cjs';

const networks={solana:'solana-mainnet',base:'base-mainnet',bsc:'bnb-mainnet',robinhood:'robinhood-mainnet',arc:'arc-mainnet'};
const docs='https://www.alchemy.com/docs/data/trading-api/endpoints/discovery/get-new-pools';
const pageSize=10,retention=900000;
const norm=(value,chain)=>chain==='solana'?value:value.toLowerCase();

export function createAlchemyPoolDiscovery({apiKey,fetchImpl=fetch,now=Date.now}={}){
 const key=typeof apiKey==='string'&&/^[a-zA-Z0-9_-]{16,120}$/.test(apiKey)?apiKey:null;
 // The preview URL contains the credential. This cache is isolated and memory-only.
 const transport=createSourceCache({
  now,staleMs:0,maxWaitMs:2000,maxQueued:4,
  fetchImpl:(url,options)=>fetchImpl(url,{...options,signal:AbortSignal.any([options.signal,AbortSignal.timeout(3500)])})
 });
 let authRetryAt=0;
 const observation={id:'alchemy-new',provider:'Alchemy Trading API',url:docs};
 const unavailable=(error,httpStatus)=>({source:{...observation,status:'unavailable',error,httpStatus},seeds:[]});

 async function discover(chain){
  if(!key||!Object.hasOwn(networks,chain))return null;
  if(authRetryAt>now())return unavailable('Trading preview credential rejected');
  const network=networks[chain];
  const url='https://api.g.alchemy.com/trading/v1/'+encodeURIComponent(key)+'/pools/new?'+new URLSearchParams({network,pageSize:String(pageSize)});
  try{
   const {data,at}=await transport.get(url,{ttl:retention});
   if(!Array.isArray(data?.data)||data.pageKey!==null&&!(typeof data.pageKey==='string'&&data.pageKey.length)||
    !Number.isFinite(at)||at<=0||at>now()||now()-at>retention)return unavailable('Invalid or expired new-pool snapshot');
   const exact=new Map();
   for(const row of data.data.slice(0,pageSize)){
    if(row?.network!==network||!chainAddress(row.tokenAddress,chain)||!chainAddress(row.poolAddress,chain,true))continue;
    const createdAt=Date.parse(row.createdAt);
    if(!Number.isFinite(createdAt)||createdAt<=0||createdAt>at||at-createdAt>7*86400000)continue;
    const address=norm(row.tokenAddress,chain),pair=norm(row.poolAddress,chain);
    if(Assets.isSuggestedProject({chain,address}))exact.set(address+':'+pair,{chain,address,pair,createdAt,seenAt:at});
   }
   const seeds=[...exact.values()];
   return {source:{...observation,fetchedAt:at,status:'available',returned:seeds.length},seeds};
  }catch(error){
   const code=error?.status;
   if(code===401||code===403){
    authRetryAt=now()+1800000;
    return unavailable('Trading preview credential rejected',code);
   }
   return unavailable(code===429?'Trading preview rate limited':'Trading preview source unavailable',Number.isInteger(code)?code:undefined);
  }
 }
 return {discover};
}
