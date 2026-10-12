import {randomBytes,timingSafeEqual} from 'node:crypto';
import fs from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {recoverMessageAddress} from 'viem';

const DEFAULT_WALLET='0xD3B2eCfe77780bFfDFA356B70DC190C914511761';
const ADDRESS=/^0x[a-fA-F0-9]{40}$/;
const KEY=/^sk-(?:proj-)?[A-Za-z0-9_-]{16,500}$/;
const defaults=Object.freeze({voiceEnabled:true,standardVoiceSessionSeconds:180,standardDailyStarts:10,radioEnabled:true});
export function validateSettings(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!==Object.keys(defaults).sort().join(','))throw Error('Only the four dashboard settings are accepted.');
 if(typeof value.voiceEnabled!=='boolean'||typeof value.radioEnabled!=='boolean'||!Number.isInteger(value.standardVoiceSessionSeconds)||value.standardVoiceSessionSeconds<30||value.standardVoiceSessionSeconds>600||!Number.isInteger(value.standardDailyStarts)||value.standardDailyStarts<1||value.standardDailyStarts>100)throw Error('Invalid dashboard settings types or ranges.');
 return {...value};
}
export function createAdmin({directory='/var/lib/axo-streams',adminWallet=process.env.AXO_ADMIN_WALLET||DEFAULT_WALLET,publicOrigin=process.env.AXO_PUBLIC_ORIGIN||'',now=Date.now,verifyKey=async key=>{const r=await fetch('https://api.openai.com/v1/models/gpt-live-1',{headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(10000)});if(!r.ok)return false;const model=await r.json();return model?.id==='gpt-live-1'&&model?.object==='model'}}={}){
 if(!ADDRESS.test(adminWallet))throw Error('Invalid AXO_ADMIN_WALLET');
 if(publicOrigin&&!/^https:\/\/[^/]+$/.test(publicOrigin))throw Error('Invalid AXO_PUBLIC_ORIGIN');
 const wallet=adminWallet.toLowerCase(),settingsFile=path.join(directory,'admin-settings.json'),secretFile=path.join(directory,'admin-voice-key'),challenges=new Map(),sessions=new Map();
 const challengeMs=3*60000,sessionMs=30*60000;
 function origin(req){return publicOrigin||'http://'+req.headers.host}
 function sameOrigin(req){return req.headers.origin===origin(req)&&req.headers['sec-fetch-site']!=='cross-site'}
 function send(res,code,data,headers={}){res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store, private','pragma':'no-cache','x-content-type-options':'nosniff',...headers});res.end(JSON.stringify(data))}
 function token(){return randomBytes(32).toString('hex')}
 function cookie(req,value,maxAge){return `axo-admin=${value}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${maxAge}`+(origin(req).startsWith('https:')?'; Secure':'')}
 function session(req){const value=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('axo-admin='))?.slice(10);return /^[a-f0-9]{64}$/.test(value||'')?sessions.get(value):null}
 function prune(){for(const [k,v]of challenges)if(v.expires<=now())challenges.delete(k);for(const [k,v]of sessions)if(v.expires<=now())sessions.delete(k)}
 async function body(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))throw Error('JSON required');let raw='',size=0;for await(const b of req){size+=b.length;if(size>2048)throw Error('Request too large');raw+=b}return JSON.parse(raw)}
 async function atomic(file,value){await fs.mkdir(directory,{recursive:true,mode:0o700});const tmp=file+'.'+token();try{await fs.writeFile(tmp,value,{mode:0o600,flag:'wx'});await fs.rename(tmp,file);await fs.chmod(file,0o600)}finally{await fs.rm(tmp,{force:true}).catch(()=>{})}}
 function settings(){try{return validateSettings(JSON.parse(readFileSync(settingsFile,'utf8')).settings)}catch{return {...defaults}}}
 function voiceKey(){try{const key=readFileSync(secretFile,'utf8').trim();return KEY.test(key)?key:null}catch{return null}}
 function effectiveKey(){return voiceKey()||process.env.OPENAI_API_KEY?.trim()||null}
 async function status(){let updatedAt=null;try{updatedAt=JSON.parse(await fs.readFile(settingsFile,'utf8')).keyUpdatedAt||null}catch{}return {wallet:adminWallet,settings:settings(),voiceKey:{configured:!!effectiveKey(),managed:!!voiceKey(),verified:!!voiceKey(),updatedAt}}}
 async function handle(req,res,u){if(!u.pathname.startsWith('/api/admin/'))return false;
  prune();try{
   if(u.pathname==='/api/admin/identity'&&req.method==='GET'){send(res,200,{wallet:adminWallet});return true}
   if(!sameOrigin(req)){send(res,403,{error:'Origin denied'});return true}
   if(req.method==='POST'&&req.headers['x-axo-request']!=='1'){send(res,403,{error:'Request denied'});return true}
   if(u.pathname==='/api/admin/challenge'&&req.method==='POST'){
    const input=await body(req);if(typeof input.wallet!=='string'||input.wallet.toLowerCase()!==wallet){send(res,403,{error:'Wallet not authorized'});return true}
    if(challenges.size>=128){send(res,429,{error:'Try later'});return true}
    const nonce=token(),expires=now()+challengeMs,message=['AXO Dynamic Dashboard admin login','Origin: '+origin(req),'Wallet: '+wallet,'Purpose: authenticate a short-lived admin settings session','Nonce: '+nonce,'Expires: '+new Date(expires).toISOString(),'This signature grants no transaction authority.'].join('\n');challenges.set(nonce,{message,expires,origin:origin(req),wallet});send(res,200,{nonce,message,expiresAt:expires});return true
   }
   if(u.pathname==='/api/admin/verify'&&req.method==='POST'){
    const input=await body(req),challenge=challenges.get(input.nonce);challenges.delete(input.nonce);
    if(!challenge||challenge.expires<=now()||challenge.origin!==origin(req)||typeof input.signature!=='string'||!/^0x[a-fA-F0-9]{130}$/.test(input.signature)||String(input.wallet).toLowerCase()!==wallet){send(res,403,{error:'Proof invalid or expired'});return true}
    const recovered=(await recoverMessageAddress({message:challenge.message,signature:input.signature})).toLowerCase();if(recovered!==wallet){send(res,403,{error:'Wallet not authorized'});return true}
    const id=token(),csrf=token();sessions.set(id,{wallet,csrf,expires:now()+sessionMs});send(res,200,{authenticated:true,csrf,expiresAt:now()+sessionMs},{'set-cookie':cookie(req,id,sessionMs/1000)});return true
   }
   const auth=session(req);if(!auth||auth.expires<=now()||auth.wallet!==wallet){send(res,401,{error:'Admin session required'});return true}
   if(u.pathname==='/api/admin/session'&&req.method==='GET'){send(res,200,{authenticated:true,csrf:auth.csrf,expiresAt:auth.expires});return true}
   if(req.method!=='POST'||typeof req.headers['x-axo-csrf']!=='string'||!safeEq(req.headers['x-axo-csrf'],auth.csrf)){send(res,403,{error:'CSRF denied'});return true}
   if(u.pathname==='/api/admin/logout'){for(const [id,item]of sessions)if(item===auth)sessions.delete(id);send(res,200,{ok:true},{'set-cookie':cookie(req,'',0)});return true}
   if(u.pathname==='/api/admin/status'){send(res,200,await status());return true}
   if(u.pathname==='/api/admin/settings'){const next=validateSettings(await body(req));const old=await status();await atomic(settingsFile,JSON.stringify({settings:next,keyUpdatedAt:old.voiceKey.updatedAt}));send(res,200,await status());return true}
   if(u.pathname==='/api/admin/voice-key'){
    const input=await body(req);if(Object.keys(input).length!==1||typeof input.key!=='string'||!KEY.test(input.key)){send(res,400,{error:'Invalid key format'});return true}
    let valid=false;try{valid=await verifyKey(input.key)}catch{}if(!valid){send(res,422,{error:'OpenAI voice model verification failed; previous key retained'});return true}
    await atomic(secretFile,input.key+'\n');const previous=await status();await atomic(settingsFile,JSON.stringify({settings:previous.settings,keyUpdatedAt:new Date(now()).toISOString()}));send(res,200,await status());return true
   }
   if(u.pathname==='/api/admin/voice-key/remove'){await fs.rm(secretFile,{force:true});const previous=await status();await atomic(settingsFile,JSON.stringify({settings:previous.settings,keyUpdatedAt:new Date(now()).toISOString()}));send(res,200,await status());return true}
   send(res,404,{error:'Not found'});
  }catch{send(res,400,{error:'Admin request failed'})}return true;
 }
 return {handle,settings,voiceKey,effectiveKey,status,wallet:adminWallet,paths:{settingsFile,secretFile}};
}
function safeEq(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
