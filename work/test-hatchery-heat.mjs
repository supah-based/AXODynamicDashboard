import assert from 'node:assert/strict';
import http from 'node:http';
import {Wallet} from 'ethers';
import {SiweMessage} from 'siwe';
import {createHatcheryHeat,heatJudgment} from './axo-hatchery-heat.mjs';

let clock=Date.now(),mode='',posts=0,delay=null,observed=[];
const owner=Wallet.createRandom(),other=Wallet.createRandom(),token='0x'+'a'.repeat(40);
const sessions=new Map([['one',{id:'one',address:owner.address,expiresAt:clock+3600000}],['two',{id:'two',address:other.address,expiresAt:clock+3600000}]]);
const cookie='__Host-axo_holder_session=private-upstream-secret; Secure; HttpOnly; Path=/; Max-Age=3600';
const boards=new Map();
const makeBoard=()=>({hatched:true,player:{participation:{complete:true}},canonicalAxoCorroboration:{required:true,complete:true},projectQuests:[{address:token,accepting:true,completedByPlayer:false,task:{id:'server-chosen-current-task',type:'contract_scout'}}]});
function nativeOwner(options){return options.headers.cookie.includes('private-upstream-secret-two')?other.address:owner.address;}
const upstream=async(url,options)=>{
 assert.ok(url.startsWith('https://axo.pet/api/'));assert.equal(options.redirect,'error');assert.equal(options.headers.origin,'https://axo.pet');
 assert.ok(!options.headers.cookie.includes('dashboard-private-cookie'));
 const route=new URL(url).pathname,b=options.body?JSON.parse(options.body):null;observed.push(route);
 if(route==='/api/wallet/challenge'){
  const message=new SiweMessage({domain:mode==='wrong_domain'?'bad.example':'axo.pet',address:mode==='wrong_address'?other.address:owner.address,statement:'Sign in to AXO. This does not submit a transaction or grant token approval.',uri:'https://axo.pet',version:'1',chainId:mode==='wrong_chain'?1:4663,nonce:'abc12345',issuedAt:new Date(clock).toISOString(),expirationTime:new Date(clock+300000).toISOString()}).prepareMessage();
  return Response.json({message,chainId:4663});
 }
 if(route==='/api/wallet/verify')return Response.json({connected:true,address:mode==='wrong_verified_wallet'?other.address:owner.address},{headers:{'set-cookie':cookie}});
 if(route==='/api/wallet/session')return Response.json({connected:mode!=='expired',address:mode==='wrong_session'?other.address:nativeOwner(options)});
 const address=nativeOwner(options);if(!boards.has(address))boards.set(address,makeBoard());const d=boards.get(address);
 if(route==='/api/hatchery'){
  if(mode==='unhatched')return Response.json({hatched:false,wallet:address});
  if(mode==='passport')return Response.json({...d,player:{participation:{complete:false}}});
  if(mode==='canonical')return Response.json({...d,canonicalAxoCorroboration:{required:true,complete:false,address:'0x'+'b'.repeat(40)}});
  return Response.json(d);
 }
 if(route==='/api/hatchery/feed'){
  posts++;assert.equal(b.taskId,'server-chosen-current-task');assert.equal(b.data,token);assert.equal(b.type,'contract_scout');assert.deepEqual({...b,taskId:undefined,type:undefined,data:undefined},{...heatJudgment(b.heatScore),taskId:undefined,type:undefined,data:undefined});
  if(delay)await delay;if(mode==='timeout')throw Error('network reset');if(mode==='empty')return new Response('');if(mode==='rejected')return Response.json({error:'hatchery_crew_passport_required'},{status:403});
  if(mode==='bad_receipt')return Response.json({result:{heatScore:1,epochId:'AXO-2026-W42',xpAwarded:4}});
  d.projectQuests[0].completedByPlayer=true;d.projectQuests[0].userJudgment={heatScore:b.heatScore};return Response.json({result:{heatScore:b.heatScore,epochId:'AXO-2026-W42',xpAwarded:4}});
 }
 throw Error('unexpected route');
};
const api=createHatcheryHeat({now:()=>clock,session:req=>{const s=sessions.get(req.headers['x-test-owner']||'one');if(!s)throw Object.assign(Error('Sign in'),{status:401});return s;},fetchImpl:upstream});
const server=http.createServer(async(req,res)=>{if(!await api.handle(req,res,new URL(req.url,'http://localhost'))){res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
async function call(route='',body,headers={}){return new Promise((resolve,reject)=>{const q=http.request(base+'/api/hatchery-heat'+route,{method:body===undefined?'GET':'POST',headers:{host:'127.0.0.1:43187',origin:'http://127.0.0.1:43187','content-type':'application/json','x-axo-request':'1',cookie:'dashboard-private-cookie=never-forward',...headers}},r=>{let raw='';r.on('data',x=>raw+=x);r.on('end',()=>{try{const data=JSON.parse(raw);assert.equal(r.headers['cache-control'],'private, no-store');assert.ok(!JSON.stringify(data).includes('private-upstream-secret'));resolve({status:r.statusCode,data});}catch(e){reject(e);}});});q.on('error',reject);q.end(body===undefined?undefined:JSON.stringify(body));});}
async function login(){clock+=60001;mode='';const c=await call('/challenge',{});assert.equal(c.status,200);return call('/verify',{signature:await owner.signMessage(c.data.message)});}
try{
 assert.deepEqual(heatJudgment(0),{heatScore:0,verdict:'NOT_INTERESTING',confidence:100});assert.deepEqual(heatJudgment(5),{heatScore:5,verdict:'NEUTRAL',confidence:50});assert.deepEqual(heatJudgment(10),{heatScore:10,verdict:'INTERESTING',confidence:100});for(const n of [-1,11,null,'5',1.1])assert.throws(()=>heatJudgment(n));
 assert.equal((await call()).data.connected,false);assert.equal(observed.length,0);
 assert.equal((await call('',undefined,{'x-test-owner':'missing'})).status,401);
 assert.equal((await call('/vote',{address:token,heatScore:8},{origin:'https://bad.example'})).status,403);
 assert.equal((await call('/vote',{address:token,heatScore:8},{'x-axo-request':''})).status,403);
 for(const m of ['wrong_domain','wrong_address','wrong_chain']){mode=m;assert.equal((await call('/challenge',{})).status,502);}
 mode='';let c=await call('/challenge',{});assert.equal((await call('/verify',{signature:await other.signMessage(c.data.message)})).status,401);
 c=await call('/challenge',{});clock+=300001;assert.equal((await call('/verify',{signature:await owner.signMessage(c.data.message)})).status,401);
 c=await call('/challenge',{});mode='wrong_verified_wallet';assert.equal((await call('/verify',{signature:await owner.signMessage(c.data.message)})).status,401);
 assert.equal((await login()).data.projects[0].canVote,true);
 assert.equal((await call('/verify',{signature:'0x00'})).status,401);
 const before=posts;for(const m of ['passport','canonical']){mode=m;assert.equal((await call('/vote',{address:token,heatScore:8})).status,409);}assert.equal(posts,before);
 mode='';assert.equal((await call('/vote',{address:other.address,heatScore:8,taskId:'forged'})).status,409);
 boards.get(owner.address).projectQuests[0].accepting=false;assert.equal((await call('/vote',{address:token,heatScore:8})).status,409);boards.get(owner.address).projectQuests[0].accepting=true;
 let release;delay=new Promise(r=>release=r);const pending=call('/vote',{address:token,heatScore:8,taskId:'forged'});await new Promise(r=>setTimeout(r,30));assert.equal((await call('/vote',{address:token,heatScore:2})).status,409);release();const saved=await pending;delay=null;assert.equal(saved.status,200);assert.equal(saved.data.receipt.heatScore,8);assert.equal(saved.data.receipt.xpAwarded,4);assert.equal(saved.data.projects[0].canVote,false);assert.equal((await call('/vote',{address:token,heatScore:2})).status,409);
 assert.equal((await call('',undefined,{'x-test-owner':'two'})).data.connected,false);
 for(const m of ['timeout','empty','bad_receipt']){sessions.set('one',{id:'session-'+m,address:owner.address,expiresAt:clock+3600000});boards.set(owner.address,makeBoard());await call('/disconnect',{});await login();mode=m;const r=await call('/vote',{address:token,heatScore:9});assert.equal(r.status,502);mode='';assert.equal((await call('?refresh=1')).data.projects[0].uncertain,true);const p=posts;assert.equal((await call('/vote',{address:token,heatScore:9})).status,409);assert.equal(posts,p);clock+=60001;}
 // A new signed Streams session gets a separate native connection and uncertainty ledger.
 sessions.set('one',{id:'new-session',address:owner.address,expiresAt:clock+3600000});boards.set(owner.address,makeBoard());await login();mode='unhatched';const unhatched=await call('?refresh=1');assert.equal(unhatched.status,200);assert.equal(unhatched.data.hatched,false);assert.deepEqual(unhatched.data.projects,[]);
 mode='wrong_session';assert.equal((await call('?refresh=1')).status,401);assert.equal((await call()).data.connected,false);
 console.log('PASS: native Hatchery challenge/signature/session binding, owner isolation, cold/hot judgments, passport/current AXO/task/window gates, serial votes, exact receipts, duplicate prevention, ambiguous-response lock and unhatched state.');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
