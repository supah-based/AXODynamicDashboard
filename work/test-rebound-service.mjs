import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createReboundService} from './axo-rebound-service.mjs';
import {reboundKey} from './axo-rebound-model.mjs';
import {reboundFixture,fixtureNow} from './test-rebound-fixture.mjs';
let clock=fixtureNow,bounce=false,allowed=true,historyCalls=0,block=null;
const wallet='0x'+'a'.repeat(40),other='0x'+'b'.repeat(40),dir=await fs.mkdtemp(path.join(os.tmpdir(),'axo-rebound-'));
const fixture=()=>reboundFixture(clock,bounce),options={storagePath:path.join(dir,'state.json'),now:()=>clock,autoStart:false,getCandidates:()=>[fixture().project],getProject:async()=>fixture().project,getHistory:async p=>{historyCalls++;if(block)await block;return fixture()[p.timeframe==='1d'?'daily':'hourly'];},getDevelopment:async()=>fixture().development,getRisk:async()=>fixture().risk,checkOwner:async()=>allowed};
let api=createReboundService(options);
async function settle(){for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,5));const d=await api.snapshot();if(!d.sampling&&!d.running)return;}throw Error('Fixture research did not finish.');}
try{
 await api.requestScan(wallet,['base']);await settle();let rows=(await api.snapshot()).rows;assert.equal(rows.length,1);assert.equal(rows[0].eligible,true);const key=reboundKey(rows[0].project);
 await api.track(wallet,key);assert.equal((await api.list(wallet)).alerts.length,0,'Registration records a baseline, not an alert');assert.equal((await api.list(other)).monitors.length,0);
 bounce=true;clock+=3600000;await api.tick();assert.equal((await api.list(wallet)).alerts.length,0,'One closed-hour observation does not confirm');
 clock+=15*60000;await api.tick();assert.equal((await api.list(wallet)).alerts.length,0,'Polling the same candle does not confirm twice');
 clock+=45*60000;await api.tick();let own=await api.list(wallet);assert.equal(own.alerts.length,1);assert.equal(own.alerts[0].row.met,7);assert.equal(own.alerts[0].row.probability,null);
 clock+=15*60000;await api.tick();assert.equal((await api.list(wallet)).alerts.length,1);api=createReboundService(options);assert.equal((await api.list(wallet)).alerts.length,1,'Alerts and original thesis survive restart');
 clock+=3600000;await api.tick();assert.equal((await api.list(wallet)).alerts.length,1,'A restart does not retrigger the same repair episode');
 await assert.rejects(api.control(other,key,'remove'));await api.control(wallet,own.alerts[0].id,'read');assert.ok((await api.list(wallet)).alerts[0].readAt);
 allowed=false;const reads=historyCalls;clock+=3600000;await api.tick();own=await api.list(wallet);assert.equal(own.monitors[0].accessPaused,true);assert.equal(historyCalls,reads,'Downgrade or failed holdings verification stops source checks');
 allowed=true;clock+=3600000;await api.tick();await api.control(wallet,key,'pause');clock+=3600000;await api.tick();assert.equal((await api.list(wallet)).monitors[0].paused,true);
 await api.control(wallet,key,'resume');bounce=false;clock+=3600000;await api.tick();bounce=true;clock+=3600000;await api.tick();assert.equal((await api.list(wallet)).alerts.length,1,'Cooldown prevents repeated alerts');
 let release;block=new Promise(r=>release=r);clock+=3600000;const job=api.tick();await new Promise(r=>setTimeout(r,10));await api.control(wallet,key,'remove');release();block=null;await job;assert.equal((await api.list(wallet)).monitors.length,0);assert.equal((await api.list(wallet)).alerts.length,1,'Removing a watch cancels notification from its in-flight check');
 api.stop();await fs.writeFile(options.storagePath,'invalid');api=createReboundService(options);await assert.rejects(api.snapshot(),/storage/);
 console.log('PASS wallet-owned rebound watches: first-snapshot baseline, two distinct consecutive hours, same-bar dedupe, restart persistence, cooldown, private ownership, tier suspension, pause/remove and in-flight cancellation, corrupt-storage refusal.');
}finally{api.stop();await fs.rm(dir,{recursive:true,force:true});}
