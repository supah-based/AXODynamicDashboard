import {randomBytes,createHash} from 'node:crypto';
import {recoverMessageAddress} from 'viem';
const ADDRESS=/^0x[a-fA-F0-9]{40}$/;
const SIGNATURE=/^0x[a-fA-F0-9]{130}$/;
const CHALLENGE_MS=5*60*1000;
const WHALE_UNITS=10000000n*10n**18n;
export function createVoiceAccess({getOwner,grant,revoke,readHoldings,now=Date.now,publicOrigin=String(process.env.AXO_PUBLIC_ORIGIN||'').trim()}={}){
 const challenges=new Map();
 const originAllowed=req=>req.headers.origin==='http://'+req.headers.host||Boolean(publicOrigin&&req.headers.origin===publicOrigin);
 const send=(res,status,body)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body))};
 async function body(req){if(!(req.headers['content-type']||'').startsWith('application/json'))throw Error('JSON is required.');let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1200)throw Error('Request too large.')}return JSON.parse(raw)}
 function prune(){for(const [owner,item]of challenges)if(item.expiresAt<=now())challenges.delete(owner)}
 async function handle(req,res,url){
  if(!['/api/voice-access/challenge','/api/voice-access/verify'].includes(url.pathname))return false;
  try{
   if(req.method!=='POST'||!originAllowed(req)||req.headers['x-axo-request']!=='1')throw Error('Use the Axo dashboard to verify voice access.');
   const owner=getOwner(req,res),input=await body(req);prune();
   if(url.pathname==='/api/voice-access/challenge'){
    if(!ADDRESS.test(input.wallet||''))throw Error('Connect a valid EVM wallet.');
    const wallet=input.wallet.toLowerCase(),nonce=randomBytes(18).toString('hex'),expiresAt=now()+CHALLENGE_MS;
    const message=['AXO Streams voice access','Origin: '+(publicOrigin||'local dashboard'),'Wallet: '+wallet,'Purpose: verify ownership for the 10,000,000 AXO whale voice tier','Nonce: '+nonce,'Expires: '+new Date(expiresAt).toISOString(),'This signature does not authorize a transaction.'].join('\n');
    challenges.set(owner,{wallet,nonce,message,expiresAt});send(res,200,{message,nonce,expiresAt});return true;
   }
   const challenge=challenges.get(owner);challenges.delete(owner);
   if(!challenge||challenge.expiresAt<=now()||input.nonce!==challenge.nonce||String(input.wallet||'').toLowerCase()!==challenge.wallet||!SIGNATURE.test(input.signature||''))throw Error('Voice access proof expired or was invalid.');
   const recovered=(await recoverMessageAddress({message:challenge.message,signature:input.signature})).toLowerCase();if(recovered!==challenge.wallet)throw Error('The signature does not match the connected wallet.');
   const holding=await readHoldings(challenge.wallet),qualified=holding.chainId===4663&&/^\d+$/.test(holding.units||'')&&BigInt(holding.units)>=WHALE_UNITS;
   if(!qualified){revoke(owner);send(res,403,{error:'This wallet does not currently meet the 10,000,000 AXO whale threshold.',tier:holding.tier?.id||'public',qualified:false});return true}
   grant(owner,{wallet:challenge.wallet,walletBinding:createHash('sha256').update('evm:'+challenge.wallet+':4663').digest('hex'),tier:'whale',balanceAt:holding.at,block:holding.block});
   send(res,200,{qualified:true,tier:'whale',minimumAxo:'10000000',balanceObservedAt:holding.at,block:holding.block,voice:{dailyStarts:'unlimited',applicationCutoffSeconds:null}});
  }catch(e){send(res,400,{error:e.message||'Voice access verification failed.'})}
  return true;
 }
 return {handle,whaleUnits:WHALE_UNITS};
}
