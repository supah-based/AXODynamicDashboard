import {publicSources} from './axo-source-cache.mjs';
import {chainAddress} from './axo-chain-api.mjs';
import {exactAmount} from './axo-portfolio-api.mjs';

const networks={
 solana:{slug:'solana-mainnet',identity:'5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d',url:'https://api.mainnet.solana.com'},
 base:{slug:'base-mainnet',identity:8453,url:'https://mainnet.base.org'},
 bsc:{slug:'bnb-mainnet',identity:56,url:'https://bsc-dataseed.bnbchain.org'},
 robinhood:{slug:'robinhood-mainnet',identity:4663,url:'https://rpc.mainnet.chain.robinhood.com'},
 arc:{slug:'arc-mainnet',identity:5042,url:'https://rpc.mainnet.arc.io'}
};
const tokenPrograms=new Set(['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']);
const observedHeight=value=>Number.isSafeInteger(value)&&value>0;
const hexBlock=value=>typeof value==='string'&&/^0x[0-9a-f]{1,16}$/i.test(value)&&observedHeight(Number(value));
const rawUint=value=>typeof value==='string'&&/^0x[0-9a-f]{64}$/i.test(value)?BigInt(value):null;
const authority=value=>value===null?'disabled':chainAddress(value,'solana')?'active':'unknown';

export function createChainRpc({apiKey=null,source=publicSources,now=Date.now}={}){
 const key=typeof apiKey==='string'&&/^[a-zA-Z0-9_-]{16,120}$/.test(apiKey)?apiKey:null;
 const denied=new Map(),heads=new Map();

 async function read(url,credentials,method,params,ttl){
  const headers={'content-type':'application/json'};
  if(credentials)headers.authorization='Bearer '+credentials;
  const r=await source.get(url,{headers,method:'POST',ttl,body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const payload=r.data;
  if(payload?.jsonrpc!=='2.0'||payload.id!==1||payload.error||!Object.hasOwn(payload,'result')||
   !Number.isFinite(r.at)||r.at<=0||r.at>now()||now()-r.at>ttl||String(r.delivery).startsWith('stale-')){
   throw Error('Invalid RPC observation');
  }
  return {data:payload.result,at:r.at};
 }

 async function onNetwork(chain,operation){
  const config=Object.hasOwn(networks,chain)?networks[chain]:null;
  if(!config)return {status:'unsupported',provider:null,observedAt:null};
  const alchemy={provider:'Alchemy',url:'https://'+config.slug+'.g.alchemy.com/v2',credentials:key};
  const fallback={provider:'Public RPC',url:config.url,credentials:null};
  const sources=key&&(denied.get(chain)??0)<=now()?[alchemy,fallback]:[fallback];
  for(const endpoint of sources){
   const rpc=(method,params=[],ttl=60000)=>read(endpoint.url,endpoint.credentials,method,params,ttl);
   try{
    const identity=(await rpc(chain==='solana'?'getGenesisHash':'eth_chainId',[],3600000)).data;
    if((chain==='solana'?identity:Number(identity))!==config.identity)throw Error('Wrong chain RPC');
    return {provider:endpoint.provider,...await operation(rpc)};
   }catch(error){
    if(endpoint.credentials&&[401,403].includes(error?.status))denied.set(chain,now()+1800000);
   }
  }
  return {status:'unavailable',provider:null,observedAt:null};
 }

 async function head(chain){
  const result=await onNetwork(chain,async rpc=>{
   const solana=chain==='solana';
   const readout=solana?await rpc('getSlot',[{commitment:'finalized'}]):await rpc('eth_blockNumber');
   const valid=solana?observedHeight(readout.data):hexBlock(readout.data);
   if(!valid)throw Error('Invalid RPC height');
   return {status:'available',kind:solana?'slot':'block',height:Number(readout.data),observedAt:readout.at};
  });
  if(Object.hasOwn(networks,chain))heads.set(chain,result);
  return result;
 }

 async function token({chain,address}){
  if(!chainAddress(address,chain))return {status:'unsupported',provider:null,observedAt:null};
  const token=await onNetwork(chain,async rpc=>{
   if(chain==='solana'){
    const response=await rpc('getAccountInfo',[address,{encoding:'jsonParsed',commitment:'finalized'}],300000);
    const slot=response.data?.context?.slot,value=response.data?.value,parsed=value?.data?.parsed;
    if(!observedHeight(slot))throw Error('Missing mint slot');
    const base={kind:'mint',height:slot,observedAt:response.at};
    const info=parsed?.info;
    if(!tokenPrograms.has(value?.owner)||parsed?.type!=='mint'||info?.isInitialized!==true)return {...base,status:'unconfirmed'};
    const decimals=Number.isSafeInteger(info.decimals)&&info.decimals>=0&&info.decimals<=255?info.decimals:null;
    const units=typeof info.supply==='string'&&/^\d{1,20}$/.test(info.supply)&&BigInt(info.supply)<=18446744073709551615n?info.supply:null;
    return {...base,status:'available',decimals,units,mintAuthority:authority(info.mintAuthority),freezeAuthority:authority(info.freezeAuthority)};
   }
   const block=await rpc('eth_blockNumber');
   if(!hexBlock(block.data))throw Error('Invalid RPC block');
   const code=await rpc('eth_getCode',[address,block.data],300000);
   const base={kind:'contract',height:Number(block.data),observedAt:block.at};
   if(code.data==='0x')return {...base,status:'unconfirmed'};
   if(typeof code.data!=='string'||code.data.length%2||!/^0x[0-9a-f]+$/i.test(code.data))throw Error('Invalid contract bytecode');
   const result=await Promise.allSettled(['0x313ce567','0x18160ddd'].map(data=>rpc('eth_call',[{to:address,data},block.data],300000)));
   const decimals=rawUint(result[0].value?.data),supply=rawUint(result[1].value?.data);
   return {...base,status:'available',decimals:decimals!==null&&decimals<=255n?Number(decimals):null,units:supply?.toString()??null};
  });
  const amount=token.units!==null&&token.units!==undefined&&Number.isSafeInteger(token.decimals)&&token.decimals<=36
   ?exactAmount(token.units,token.decimals):null;
  return {...token,amount};
 }
 return {head,token,localHead:chain=>heads.get(chain)||null,configured:Boolean(key)};
}
