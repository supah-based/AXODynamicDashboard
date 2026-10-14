import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Wallet} from 'ethers';
import {createHolderAuth,HOLDER_LIMITS} from './axo-holder-auth.mjs';
import {AXO} from './axo-identity.mjs';
let clock=Date.parse('2026-10-12T12:00:00Z'), bad=null, protectedCalls=0, voice=null;
const wallet=Wallet.createRandom(), other=Wallet.createRandom(), amounts=new Map();
amounts.set(wallet.address.toLowerCase(),1000000n*10n**18n);
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'axo-holder-test-'));
const options={now:()=>clock,usagePath:path.join(dir,'usage.json'),readHoldings:async address=>({wallet:address,chainId:bad==='chain'?1:4663,token:bad==='token'?'0x'+'1'.repeat(40):AXO.address,decimals:18,rawBalance:(amounts.get(address)||0n).toString(),amount:'Test fixture',block:12,blockAt:bad==='stale'?clock-130000:clock,at:clock})};
let auth=createHolderAuth(options);
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');if(await auth.handle(req,res,u))return;if(!await auth.guard(req,res,u))return;if(req.axoHolder){protectedCalls++;if(u.pathname==='/api/ai/voice')voice=req.axoHolder;}res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({public:true,voiceSeconds:req.axoHolder?.voiceSeconds}));}catch{res.writeHead(500);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
async function call(route,{cookie='',body,origin='http://127.0.0.1:43187',headers={}}={}){return new Promise((resolve,reject)=>{const req=http.request(base+route,{method:body===undefined?'GET':'POST',headers:{host:'127.0.0.1:43187',origin,cookie,connection:'close','content-type':'application/json','x-axo-request':'1',...headers}},res=>{let raw='';res.setEncoding('utf8');res.on('data',c=>raw+=c);res.on('end',()=>{try{const setCookie=res.headers['set-cookie']?.[0];resolve({status:res.statusCode,data:JSON.parse(raw),cookie:setCookie?.split(';')[0],setCookie});}catch(e){reject(e);}});});req.on('error',reject);req.end(body===undefined?undefined:JSON.stringify(body));});}
async function login(w=wallet){const c=await call('/api/auth/challenge',{body:{address:w.address,chainId:8453}});assert.equal(c.status,200);const signature=await w.signMessage(c.data.message);const v=await call('/api/auth/verify',{cookie:c.cookie,body:{message:c.data.message,signature}});assert.equal(v.status,200);assert.notEqual(v.cookie,c.cookie);return {...v,challenge:c,signature};}
try{
 assert.equal((await call('/api/auth/status')).data.authenticated,false);
 assert.equal((await call('/api/dashboard')).status,200);
 for(const route of ['/api/ai/ask','/api/ai/intent','/api/ai/voice','/api/research-card','/api/tracked-projects']){const r=await call(route,{body:{wallet:wallet.address,tier:'whale',balance:'100000000'}});assert.equal(r.status,401);}
 assert.equal(protectedCalls,0);
 assert.equal((await call('/api/ai/ask',{body:{},headers:{'x-axo-request':''}})).status,403);
 assert.equal((await call('/api/auth/challenge',{origin:'https://unrelated.example',body:{address:wallet.address,chainId:8453}})).status,403);
 let c=await call('/api/auth/challenge',{body:{address:wallet.address,chainId:8453}});
 assert.equal((await call('/api/auth/verify',{cookie:c.cookie,body:{message:c.data.message,signature:await other.signMessage(c.data.message)}})).status,401);
 c=await call('/api/auth/challenge',{body:{address:wallet.address,chainId:8453}});
 const changed=c.data.message.replace('URI: http://127.0.0.1:43187','URI: https://unrelated.example');
 assert.equal((await call('/api/auth/verify',{cookie:c.cookie,body:{message:changed,signature:await wallet.signMessage(changed)}})).status,401);
 c=await call('/api/auth/challenge',{body:{address:wallet.address,chainId:8453}});clock+=301000;
 assert.equal((await call('/api/auth/verify',{cookie:c.cookie,body:{message:c.data.message,signature:await wallet.signMessage(c.data.message)}})).status,401);
 const signed=await login();assert.equal(signed.data.tier.id,'holder');assert.equal(signed.data.features.voice,true);assert.match(signed.setCookie,/HttpOnly; SameSite=Strict/);
 const secure=await call('/api/auth/challenge',{origin:'https://streams.axo.vision',body:{address:wallet.address,chainId:4663}});assert.equal(secure.status,200);assert.match(secure.setCookie,/; Secure/);assert.match(secure.data.message,/streams.axo.vision wants you to sign in/);
 assert.equal((await call('/api/auth/verify',{cookie:signed.challenge.cookie,body:{message:signed.challenge.data.message,signature:signed.signature}})).status,401);
 // A new signed connection must bypass any still-fresh cached holding and apply the current tier immediately.
 amounts.set(other.address.toLowerCase(),0n);assert.equal(await auth.checkWalletFeature(other.address.toLowerCase(),'customCards'),false);
 amounts.set(other.address.toLowerCase(),5000000n*10n**18n);const freshlyConnected=await login(other);assert.equal(freshlyConnected.data.tier.id,'top');assert.equal(freshlyConnected.data.features.customCards,true);
 assert.equal((await call('/api/research-card',{cookie:signed.cookie,body:{}})).status,403);
 assert.equal((await call('/api/ai/ask',{cookie:signed.cookie,origin:'https://unrelated.example',body:{}})).status,403);
 const results=await Promise.all(Array.from({length:22},()=>call('/api/ai/ask',{cookie:signed.cookie,body:{question:'Test fixture'}})));
 assert.equal(results.filter(r=>r.status===200).length,HOLDER_LIMITS.holder.aiRequests);assert.equal(results.filter(r=>r.status===429).length,2);
 const second=await login();assert.equal(second.data.remaining.aiRequests,0);
 assert.equal((await call('/api/ai/intent',{cookie:second.cookie,body:{}})).status,429);
 assert.equal((await call('/api/ai/voice',{cookie:second.cookie,body:{}})).data.voiceSeconds,300);
 assert.equal((await call('/api/ai/voice',{cookie:signed.cookie,body:{}})).status,429);
 await voice.refund(200);assert.equal((await call('/api/auth/status',{cookie:signed.cookie})).data.remaining.voiceSeconds,200);
 await voice.refund(1000);await voice.refund(1000);assert.equal((await call('/api/auth/status',{cookie:signed.cookie})).data.remaining.voiceSeconds,300,'Refunds cannot exceed this request’s reservation');
 auth=createHolderAuth(options);const restarted=await login();assert.equal(restarted.data.remaining.aiRequests,0);assert.equal(restarted.data.remaining.voiceSeconds,300);
 amounts.set(wallet.address.toLowerCase(),2500000n*10n**18n);clock+=61000;
 assert.equal((await call('/api/research-card',{cookie:restarted.cookie,body:{}})).status,200);
 let status=await call('/api/auth/status',{cookie:restarted.cookie});assert.equal(status.data.tier.id,'enhanced');assert.equal(status.data.remaining.aiRequests,39);
 amounts.set(wallet.address.toLowerCase(),10000000n*10n**18n);clock+=61000;
 status=await call('/api/auth/status',{cookie:restarted.cookie});assert.equal(status.data.tier.id,'whale');assert.equal(status.data.remaining.voiceSeconds,null,'Verified Whale voice is unlimited');
 assert.equal((await call('/api/ai/voice',{cookie:restarted.cookie,body:{}})).data.voiceSeconds,null);
 for(const kind of ['stale','chain','token']){bad=kind;clock+=61000;assert.equal((await call('/api/ai/ask',{cookie:restarted.cookie,body:{}})).status,503);}bad=null;
 amounts.set(wallet.address.toLowerCase(),1000000n*10n**18n-1n);clock+=61000;
 assert.equal((await call('/api/ai/ask',{cookie:restarted.cookie,body:{}})).data.code,'axo_holding_required');
 assert.equal((await call('/api/auth/status',{cookie:restarted.cookie})).data.tier.id,'public');
 assert.equal((await call('/api/dashboard',{cookie:restarted.cookie})).status,200);
 await call('/api/auth/logout',{cookie:restarted.cookie,body:{}});
 assert.equal((await call('/api/ai/ask',{cookie:restarted.cookie,body:{}})).status,401);
 amounts.set(wallet.address.toLowerCase(),1000000n*10n**18n);const final=await login();clock+=7200001;
 assert.equal((await call('/api/ai/ask',{cookie:final.cookie,body:{}})).status,401);
 clock=Date.parse('2026-10-13T12:00:00Z');auth=createHolderAuth(options);const tomorrow=await login();assert.equal(tomorrow.data.remaining.aiRequests,20);assert.equal(tomorrow.data.remaining.voiceSeconds,300);
 console.log('PASS: real SIWE signatures, wrong signer/domain, one-use expiring nonce, session rotation/expiry/logout, exact holder boundary, stale/wrong-chain/token failures, public browsing, per-wallet concurrent daily limits and restart persistence.');
}finally{await new Promise(r=>server.close(r));await fs.rm(dir,{recursive:true,force:true});}
