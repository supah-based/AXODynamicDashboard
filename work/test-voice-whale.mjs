import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {privateKeyToAccount} from 'viem/accounts';
import {createVoiceProfiles} from './axo-voice-profiles.mjs';
import {createVoiceAccess} from './axo-voice-access.mjs';
import {createAiApi} from './axo-ai-api.mjs';
const account=privateKeyToAccount('0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
const profiles=createVoiceProfiles({serverConfigured:()=>true});let cookie='';
const response=()=>{let status,data;return {setHeader:(k,v)=>{if(k==='Set-Cookie')cookie=v.split(';')[0]},writeHead:s=>status=s,end:s=>{data=JSON.parse(s)},result:()=>({status,data})}};
const firstRes=response(),owner=profiles.owner({headers:{host:'127.0.0.1:43187'}},firstRes);cookie=firstRes.result().data||cookie;
async function request(api,path,body){const req=Readable.from([JSON.stringify(body)]);req.method='POST';req.headers={host:'127.0.0.1:43187',cookie,origin:'https://streams.axo.vision','x-axo-request':'1','content-type':'application/json'};const res=response();await api.handle(req,res,new URL('http://localhost'+path));return res.result()}
const api=createVoiceAccess({getOwner:(req,res)=>profiles.owner(req,res),grant:(id,value)=>profiles.grantAccess(id,value),revoke:id=>profiles.revokeAccess(id),readHoldings:async wallet=>({wallet,chainId:4663,units:(10000000n*10n**18n).toString(),tier:{id:'whale'},at:Date.now(),block:123}),publicOrigin:'https://streams.axo.vision'});
const challenge=await request(api,'/api/voice-access/challenge',{wallet:account.address});assert.equal(challenge.status,200);const signature=await account.signMessage({message:challenge.data.message});const verified=await request(api,'/api/voice-access/verify',{wallet:account.address,nonce:challenge.data.nonce,signature});assert.equal(verified.status,200);assert.equal(verified.data.tier,'whale');assert.equal(profiles.access(owner).tier,'whale');assert.equal(profiles.status(owner).whaleVerified,true);
let sessions=0,schedules=0;const voice=createAiApi({apiKey:()=> 'sk-shared-fixture-only',getVoiceAccess:()=>({tier:'whale'}),authorizeVoiceAccess:async()=>({tier:'whale'}),schedule:()=>{schedules++;return 1},cancel:()=>{},localProvider:null,fetchImpl:async url=>url.endsWith('/hangup')?{ok:true,status:204}:{ok:true,status:201,json:async()=>({session:{id:'whale_'+(++sessions)},transport:{type:'webrtc',sdp:'answer'}})}});
for(let i=0;i<11;i++){const live=await voice.startVoice('v=0\r\n','whale');assert.equal(live.expiresAt,null);assert.equal(live.voiceTier,'whale');await voice.endVoice(live.id,'whale')}
const status=await voice.status('whale');assert.equal(status.voiceTier,'whale');assert.equal(status.maxVoiceSeconds,null);assert.equal(status.voiceDailyRemaining,null);assert.equal(schedules,0);
console.log('PASS signed 10,000,000 AXO ownership grants Whale voice with no Axo timer or daily-start quota.');
