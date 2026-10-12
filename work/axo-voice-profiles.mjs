import {randomBytes} from 'node:crypto';
/* Local browser sessions. Credentials live only in server memory, never public snapshots or files. */
export function createVoiceProfiles({now=Date.now,serverConfigured=()=>Boolean(process.env.OPENAI_API_KEY?.trim())}={}){
 const sessions=new Map(),ttl=6*60*60*1000;
 function owner(req,res){const name='axo-voice-browser-'+String(req.headers.host||'').split(':').at(-1),cookies=String(req.headers.cookie||'').split(';').map(s=>s.trim()),value=cookies.find(s=>s.startsWith(name+'='))?.slice(name.length+1);let id=/^[a-f0-9]{48}$/.test(value||'')?value:null;
  for(const [key,item]of sessions)if(now()-item.at>ttl)sessions.delete(key);
  if(!id||!sessions.has(id)){if(sessions.size>=128)throw Error('Local voice profile capacity reached. Try again later.');id=randomBytes(24).toString('hex');sessions.set(id,{at:now(),key:null});res.setHeader('Set-Cookie',name+'='+id+'; HttpOnly; SameSite=Strict; Path=/; Max-Age='+ttl/1000)}sessions.get(id).at=now();return id;
 }
 const credential=id=>sessions.get(id)?.key||null;
 const status=id=>({personalKeyConfigured:Boolean(credential(id)),serverKeyConfigured:serverConfigured(),source:credential(id)?'personal':serverConfigured()?'shared':'unavailable',storage:'Server memory for this browser session; re-enter after server restart or six hours of inactivity.',scope:'Voice only; typed Ask Axo keeps its existing provider.'});
 async function handle(req,res,url){if(url.pathname!=='/api/profile/voice-key')return false;const send=(code,body)=>{res.writeHead(code,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body))};
  try{if(!['GET','POST'].includes(req.method)){send(405,{error:'Method not allowed'});return true}if(req.method==='POST'&&(req.headers.origin!=='http://'+req.headers.host||req.headers['x-axo-request']!=='1'||!(req.headers['content-type']||'').startsWith('application/json'))){send(403,{error:'Use the local profile to update your voice key.'});return true}const id=owner(req,res);if(req.method==='GET'){send(200,status(id));return true}let raw='',size=0;for await(const chunk of req){size+=Buffer.byteLength(chunk);if(size>2048){send(413,{error:'Voice key request too large.'});return true}raw+=chunk}let body;try{body=JSON.parse(raw)}catch{send(400,{error:'Invalid voice key request.'});return true}
   if(body.remove===true&&Object.keys(body).length===1)sessions.get(id).key=null;else if(Object.keys(body).length===1&&typeof body.key==='string'&&/^sk-[A-Za-z0-9_-]{16,500}$/.test(body.key.trim()))sessions.get(id).key=body.key.trim();else{send(400,{error:'Enter an OpenAI API key, or remove the personal key.'});return true}send(200,status(id));
  }catch{send(503,{error:'Your local voice profile could not be updated.'})}return true;
 }
 return {owner,credential,status,handle};
}
