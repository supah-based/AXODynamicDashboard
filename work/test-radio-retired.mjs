import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRadioStation} from './axo-radio-api.mjs';
import {createLunaQueue} from './axo-luna-queue.mjs';
import {validateSettings} from './axo-admin.mjs';
const forbidden=()=>{throw Error('Retired Radio must not access providers, settings or scheduling');};
const oldInterval=globalThis.setInterval,oldFetch=globalThis.fetch;globalThis.setInterval=forbidden;globalThis.fetch=forbidden;
try{
 const radio=createRadioStation({apiKey:forbidden,getAdminSettings:forbidden,getState:forbidden,getPools:forbidden,editor:forbidden,fetchImpl:forbidden,recordUsage:forbidden});
 for(let i=0;i<5;i++)assert.equal(await radio.tick(),false);
 assert.equal(radio.status().status,'retired');assert.equal(radio.status().configured,false);assert.equal(radio.status().listeners,0);assert.deepEqual(radio.status().tracks,[]);
 assert.throws(()=>radio.join('legacy',{type:'home'}),e=>e.status===410);assert.throws(()=>radio.heartbeat('legacy'),e=>e.status===410);assert.equal(radio.audio('legacy'),undefined);assert.equal(radio.leave().retired,true);radio.stop();
 for(const method of ['GET','POST'])for(const path of ['status','join','heartbeat','leave','audio/old.wav']){let status,body;const res={writeHead:n=>status=n,end:s=>body=JSON.parse(s)};assert.equal(await radio.handle({method},res,new URL('http://localhost/api/radio/'+path)),true);assert.equal(status,410);assert.equal(body.status,'retired');}
 assert.equal(await radio.handle({}, {},new URL('http://localhost/api/ai/voice')),false);
}finally{globalThis.setInterval=oldInterval;globalThis.fetch=oldFetch;}
const q=createLunaQueue({autoStart:false,startSpacingMs:0});try{await assert.rejects(q.run('radio','legacy-radio',forbidden),e=>e.code==='invalid_job');assert.equal(await q.run('question','voice-research',async()=>42),42);}finally{q.stop();}
assert.equal(validateSettings({voiceEnabled:true,standardVoiceSessionSeconds:180,standardDailyStarts:10,radioEnabled:true}).radioEnabled,false,'Old persisted settings cannot revive Radio');
const server=await fs.readFile('work/axo-server.mjs','utf8'),html=await fs.readFile('outputs/axo-live-dashboard.html','utf8'),shim=await fs.readFile('work/axo-radio-ui.js','utf8');
assert.doesNotMatch(server,/createRadioStation|radioApi|lunaRun\('radio'/);assert.match(server,/status:'retired'/);assert.doesNotMatch(html,/id="radio"|src="\/radio.js"|stopRadio|radioOn/);assert.doesNotMatch(shim,/fetch\(|setInterval|setTimeout|new Audio|speechSynthesis/);
assert.match(server,/createAiApi/);assert.match(html,/src="\/ai.js"/);
console.log('PASS Radio retired: no generation, provider/key reads, timers, listeners, jobs or UI; legacy routes return 410, settings cannot revive it, Ask Axo voice remains separate.');
