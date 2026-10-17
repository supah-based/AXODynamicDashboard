import {SiweMessage} from 'siwe';
import {verifyMessage} from 'ethers';
import {isAxoOrigin} from './axo-request-origin.mjs';

const upstream='https://axo.pet', prefix='/api/hatchery-heat';
const address=v=>/^0x[0-9a-f]{40}$/i.test(v||'')?v.toLowerCase():null;
const fail=(code,message,status=400)=>Object.assign(Error(message),{code,status});
const labels=['Ice cold','Frozen','Very cold','Cold','Cool','Neutral','Warm','Heating','Hot','Very hot','Red hot alpha'];
export function heatJudgment(score){
 if(!Number.isInteger(score)||score<0||score>10)throw fail('invalid_heat','Choose a heat position from 0 to 10.');
 return {heatScore:score,verdict:score<5?'NOT_INTERESTING':score>5?'INTERESTING':'NEUTRAL',confidence:score===5?50:Math.abs(score-5)*20};
}
// A separate native session per signed Streams session. Cookies and signatures never
// enter public snapshots, logs, local storage or the community research database.
export function createHatcheryHeat({session,fetchImpl=fetch,now=Date.now}={}){
 const clients=new Map();
 function client(req){
  const s=session(req),owner=address(s.address);
  if(!owner||!s.id||!Number.isFinite(s.expiresAt)||s.expiresAt<=now())throw fail('wallet_required','Connect and verify your wallet first.',401);
  for(const [id,c]of clients)if(c.expiresAt<=now())clients.delete(id);
  let c=clients.get(s.id);
  if(c&&c.owner!==owner){clients.delete(s.id);c=null;}
  if(!c){if(clients.size>=2000)throw fail('busy','Hatchery connections are busy. Try again shortly.',503);c={owner,expiresAt:s.expiresAt,cookies:new Map(),connected:false,challenge:null,busy:false,uncertain:new Set(),calls:[]};clients.set(s.id,c);}
  return c;
 }
 function live(req,c){if(client(req)!==c)throw fail('wallet_changed','Your wallet session changed. Reconnect Hatchery.',401);}
 function limit(c){c.calls=c.calls.filter(t=>t>now()-60000);if(c.calls.length>=30)throw fail('rate_limit','Wait a moment before checking Hatchery again.',429);c.calls.push(now());}
 function cookieHeader(c){return [...c.cookies].filter(([,v])=>v.expiresAt>now()).map(([k,v])=>k+'='+v.value).join('; ');}
 function cookies(c,headers){for(const raw of headers.getSetCookie?.()||[]){
  const parts=raw.split(';').map(v=>v.trim()),equal=parts[0].indexOf('='),name=parts[0].slice(0,equal),value=parts[0].slice(equal+1);
  if(equal<1||!/^[-\w]+$/.test(name)||/[\r\n;]/.test(value))continue;
  const domain=parts.find(v=>/^domain=/i.test(v))?.slice(7).replace(/^\./,'').toLowerCase();if(domain&&domain!=='axo.pet')continue;
  const maxAge=parts.find(v=>/^max-age=/i.test(v))?.slice(8),expires=parts.find(v=>/^expires=/i.test(v))?.slice(8);
  const expiresAt=maxAge!==undefined?now()+Number(maxAge)*1000:expires?Date.parse(expires):c.expiresAt;
  if(Number.isFinite(expiresAt)&&expiresAt>now()&&value)c.cookies.set(name,{value,expiresAt:Math.min(c.expiresAt,expiresAt)});else c.cookies.delete(name);
 }}
 async function native(c,path,body){
  let r;try{r=await fetchImpl(upstream+path,{method:body===undefined?'GET':'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{accept:'application/json','content-type':'application/json',origin:upstream,cookie:cookieHeader(c)},...(body===undefined?{}:{body:JSON.stringify(body)})});}catch{throw fail('upstream_unavailable','Hatchery did not respond. No receipt is confirmed.',502);}
  cookies(c,r.headers);
  if(Number(r.headers.get('content-length'))>1048576)throw fail('upstream_response','Hatchery returned an unexpected response.',502);
  let raw='';try{for await(const chunk of r.body){raw+=Buffer.from(chunk).toString('utf8');if(Buffer.byteLength(raw)>1048576){await r.body.cancel?.().catch(()=>{});throw Error();}}}catch{throw fail('upstream_response','Hatchery returned an incomplete response. No receipt is confirmed.',502);}
  let d;try{d=JSON.parse(raw);}catch{throw fail('upstream_response','Hatchery returned an incomplete response. No receipt is confirmed.',502);}
  if(!r.ok){const code=typeof d.error==='string'&&/^[a-z_]{1,80}$/.test(d.error)?d.error:'hatchery_rejected';if(r.status===401){c.connected=false;c.cookies.clear();}throw fail(code,'Hatchery could not accept this request. Refresh your connection or check your passport.',r.status>=500?502:r.status);}
  return d;
 }
 async function board(req,c){
  const s=await native(c,'/api/wallet/session');live(req,c);
  if(s.connected!==true||address(s.address)!==c.owner){c.connected=false;c.cookies.clear();throw fail('hatchery_sign_in_required','Connect this wallet to Hatchery to make a heat call.',401);}
  const d=await native(c,'/api/hatchery');live(req,c);
  if(!d||typeof d.hatched!=='boolean'||d.hatched&&!Array.isArray(d.projectQuests))throw fail('upstream_response','Hatchery project state is unavailable. No vote was sent.',502);
  if(!d.hatched)d.projectQuests=[];
  c.connected=true;c.board=d;c.checkedAt=now();return d;
 }
 function view(c,d=c.board){
  const passport=d?.player?.participation?.complete===true||d?.dailyPromotionQuest?.prerequisitesMet===true,canonical=d?.canonicalAxoCorroboration;
  return {version:1,connected:c.connected,wallet:c.owner,checkedAt:c.checkedAt||null,hatched:d?.hatched===true,passportReady:passport,
   projects:c.connected?(d?.projectQuests||[]).slice(0,200).flatMap(p=>{const a=address(p.address);if(!a)return [];const done=p.completedByPlayer===true,gate=canonical?.required===true&&canonical?.complete!==true&&canonical?.questAccessComplete!==true&&a!==address(canonical?.address),uncertain=c.uncertain.has(a)&&!done;
    return [{address:a,accepting:p.accepting===true,completed:done,heatScore:done&&Number.isInteger(p.userJudgment?.heatScore)?p.userJudgment.heatScore:null,uncertain,canVote:d.hatched===true&&passport&&!gate&&p.accepting===true&&!done&&!uncertain&&p.task?.type==='contract_scout'&&typeof p.task?.id==='string',reason:done?'Heat call already saved':uncertain?'Receipt unconfirmed. Check Hatchery before trying again.':d.hatched!==true?'Hatch your Axo in Hatchery first':!passport?'Complete your Hatchery passport first':gate?'Make your current AXO heat call first':p.accepting!==true?'Review window closed':!p.task?.id?'Current review task unavailable':'Choose your heat position'}];}):[]};
 }
 async function body(req){let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8192)throw fail('body_too_large','Request is too large.',413);}try{const v=JSON.parse(raw);if(!v||typeof v!=='object'||Array.isArray(v))throw Error();return v;}catch{throw fail('invalid_body','Use a valid heat request.');}}
 const send=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
 async function handle(req,res,u){
  if(!u.pathname.startsWith(prefix))return false;
  try{
   const route=u.pathname.slice(prefix.length);
   if(!['','/challenge','/verify','/vote','/disconnect'].includes(route))throw fail('not_found','Unknown Hatchery operation.',404);
   if(req.method!==(route?'POST':'GET'))throw fail('method','Unsupported Hatchery operation.',405);
   if(route&&(!isAxoOrigin(req)||req.headers['x-axo-request']!=='1'||!(req.headers['content-type']||'').startsWith('application/json')))throw fail('origin','Use the dashboard to make a heat call.',403);
   const c=client(req);limit(c);
   if(!route){if(!c.connected)return send(res,200,view(c)),true;if(!c.checkedAt||now()-c.checkedAt>=10000||u.searchParams.get('refresh')==='1')await board(req,c);live(req,c);send(res,200,view(c));return true;}
   const input=await body(req);live(req,c);
   if(c.busy)throw fail('in_progress','A Hatchery request is already running. Please wait.',409);
   c.busy=true;
   try{
    if(route==='/disconnect'){c.connected=false;c.cookies.clear();c.board=null;c.challenge=null;send(res,200,view(c));return true;}
    if(route==='/challenge'){
     c.challenge=null;
     const d=await native(c,'/api/wallet/challenge',{address:c.owner});live(req,c);
     let m;try{m=new SiweMessage(d.message);}catch{throw fail('invalid_challenge','Hatchery sign-in could not be verified.',502);}
     const expiry=Date.parse(m.expirationTime),issued=Date.parse(m.issuedAt);
     if(m.domain!=='axo.pet'||m.uri!==upstream||m.version!=='1'||Number(m.chainId)!==4663||address(m.address)!==c.owner||!Number.isFinite(expiry)||expiry<=now()||expiry>now()+310000||!Number.isFinite(issued)||issued>now()+30000||now()-issued>60000||!m.nonce||m.resources?.length||m.statement!=='Sign in to AXO. This does not submit a transaction or grant token approval.')throw fail('invalid_challenge','Hatchery sign-in could not be verified.',502);
     c.challenge={message:d.message,expiresAt:expiry};send(res,200,{message:d.message,expiresAt:expiry,chainId:4663,origin:upstream});return true;
    }
    if(route==='/verify'){
     const challenge=c.challenge;c.challenge=null;
     if(!challenge||challenge.expiresAt<=now()||typeof input.signature!=='string'||input.signature.length>1024)throw fail('challenge_expired','Request a new Hatchery sign-in.',401);
     let signer;try{signer=address(verifyMessage(challenge.message,input.signature));}catch{}
     if(signer!==c.owner)throw fail('signature_mismatch','The signature does not match this wallet.',401);
     const d=await native(c,'/api/wallet/verify',{address:c.owner,signature:input.signature});live(req,c);
     if(d.connected!==true||address(d.address)!==c.owner){c.cookies.clear();throw fail('wallet_mismatch','Hatchery returned a different wallet. No vote was sent.',401);}
     await board(req,c);send(res,200,view(c));return true;
    }
    const a=address(input.address),judgment=heatJudgment(input.heatScore);if(!a)throw fail('invalid_project','Choose an exact Robinhood project.');
    if(!c.connected)throw fail('hatchery_sign_in_required','Connect Hatchery before making a heat call.',401);
    const d=await board(req,c),project=d.projectQuests.find(p=>address(p.address)===a),v=view(c,d).projects.find(p=>p.address===a);
    if(!project||!v?.canVote)throw fail('vote_unavailable',v?.reason||'This project is not open for your current Hatchery review.',409);
    if(project.task.type!=='contract_scout'||typeof project.task.id!=='string'||project.task.id.length>160)throw fail('task_unavailable','Current Hatchery review task unavailable.',409);
    let result;try{result=await native(c,'/api/hatchery/feed',{taskId:project.task.id,type:'contract_scout',data:a,...judgment});}catch(e){if(e.status>=500)c.uncertain.add(a);throw e;}live(req,c);
    const receipt=result?.result;
    if(!receipt||receipt.heatScore!==judgment.heatScore||typeof receipt.epochId!=='string'||!/^AXO-\d{4}-W\d{2}$/.test(receipt.epochId)||!Number.isSafeInteger(receipt.xpAwarded)||receipt.xpAwarded<0||receipt.xpAwarded>1000000){c.uncertain.add(a);throw fail('receipt_unconfirmed','Hatchery has not returned a verifiable receipt. Check before trying again.',502);}
    c.board=null;c.checkedAt=0;
    try{await board(req,c);}catch{c.uncertain.add(a);}
    live(req,c);send(res,200,{...view(c),receipt:{address:a,heatScore:receipt.heatScore,label:labels[receipt.heatScore],epochId:receipt.epochId,xpAwarded:receipt.xpAwarded}});return true;
   }finally{c.busy=false;}
  }catch(e){send(res,e.status||502,{version:1,code:e.code||'hatchery_unavailable',error:e.status?e.message:'Hatchery is unavailable. No receipt is confirmed.'});return true;}
 }
 return {handle};
}
