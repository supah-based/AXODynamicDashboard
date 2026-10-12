import {isAxoOrigin} from './axo-request-origin.mjs';
import {AXO} from './axo-identity.mjs';
import {exactAmount} from './axo-portfolio-api.mjs';
import {classifyBalanceUnits} from './axo-access.mjs';
const RPC='https://rpc.mainnet.chain.robinhood.com';
export function createHoldingsApi({fetchImpl=fetch,now=Date.now}={}){
 const jobs=new Map();
 async function read(wallet){
  if(!/^0x[a-f0-9]{40}$/i.test(wallet||''))throw Error('An EVM wallet address is required.');wallet=wallet.toLowerCase();
  if(jobs.has(wallet))return jobs.get(wallet);if(jobs.size>=4)throw Error('Balance reads are busy. Please retry shortly.');
  const job=(async()=>{let id=0;const rpc=async(method,params=[])=>{const n=++id,r=await fetchImpl(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:n,method,params}),signal:AbortSignal.timeout(10000),redirect:'error'});if(!r.ok)throw Error('Robinhood balance source is unavailable. Please retry.');const d=await r.json();if(d.id!==n||d.error)throw Error('Robinhood balance source returned an invalid response.');return d.result};
   if(Number(await rpc('eth_chainId'))!==4663)throw Error('Robinhood balance source returned the wrong network.');
   const block=await rpc('eth_blockNumber');if(!/^0x[0-9a-f]{1,16}$/i.test(block||''))throw Error('Robinhood block could not be verified.');
   const header=await rpc('eth_getBlockByNumber',[block,false]);if(header?.number?.toLowerCase()!==block.toLowerCase()||!/^0x[0-9a-f]+$/i.test(header?.timestamp||''))throw Error('Robinhood block date could not be verified.');const blockAt=Number(BigInt(header.timestamp))*1000;if(!Number.isSafeInteger(blockAt)||blockAt>now()+30000||now()-blockAt>120000)throw Error('Robinhood balance source is behind the chain. Please retry.');
   const decimals=await rpc('eth_call',[{to:AXO.address,data:'0x313ce567'},block]);if(!/^0x[0-9a-f]{64}$/i.test(decimals||'')||BigInt(decimals)!==18n)throw Error('AXO token decimals could not be verified.');
   const raw=await rpc('eth_call',[{to:AXO.address,data:'0x70a08231'+wallet.slice(2).padStart(64,'0')},block]);if(!/^0x[0-9a-f]{64}$/i.test(raw||''))throw Error('AXO balance could not be verified.');
   const amount=exactAmount(BigInt(raw).toString(),18);return {wallet,chainId:4663,token:AXO.address,decimals:18,amount,rawBalance:BigInt(raw).toString(),block:Number(BigInt(block)),blockAt,at:now(),provider:'Robinhood public RPC',tier:classifyBalanceUnits(BigInt(raw).toString())};
  })();jobs.set(wallet,job);try{return await job}finally{jobs.delete(wallet)}
 }
 async function handle(req,res,u){if(u.pathname!=='/api/axo-holdings')return false;let status=200,data;try{if(req.method!=='POST'||!isAxoOrigin(req)||req.headers['x-axo-request']!=='1')throw Error('Use the local dashboard for balance reads.');let raw='';for await(const b of req){raw+=b;if(raw.length>300)throw Error('Request too large.')}data=await read(JSON.parse(raw).wallet)}catch(e){status=400;data={error:e.message}}res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));return true}
 return {read,handle};
}
