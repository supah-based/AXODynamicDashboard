import assert from 'node:assert/strict';
import {BLUECHIP_CEILING_POLICY,BLUECHIP_MARKET_CAP_CEILING,marketCapPolicyUpgrade,applyPaperPolicyUpgrade,acknowledgePaperPolicies} from './axo-paper-policy-migrations.mjs';

const now=Date.parse('2026-10-16T12:00:00Z');
function previous({enabled=true,cap=25000000,engine='strategies'}={}){return {runId:'existing-run',enabled,config:{engine,version:'paper-strategy-v5',maxMarketCap:cap,minMarketCap:123456,minLiquidity:250000,feeBps:23,slippageBps:63,stopPct:6,maxDailyLossPct:2,maxPositions:4,tranches:[{targetPct:20,sellPct:25}]},cashCents:888888,realizedCents:-2222,stats:{decisions:17,experiments:{old:{closed:3}}},positions:{held:{quantity:10,costCents:100000,plan:{version:'paper-strategy-v4',experimentId:'old-experiment',config:{maxMarketCap:25000000,stopPct:7},opportunity:{category:'swing',sizing:{stopPct:7}}}}}};}

for(const enabled of [true,false])for(const cap of [25000000,9876543,BLUECHIP_MARKET_CAP_CEILING]){
 const state=previous({enabled,cap}),old=structuredClone(state),before=JSON.stringify(state),event=marketCapPolicyUpgrade(state);
 assert.equal(JSON.stringify(state),before,'Planning cannot alter the real run');assert.equal(event.id,BLUECHIP_CEILING_POLICY);
 assert.deepEqual(event.config,{maxMarketCap:BLUECHIP_MARKET_CAP_CEILING});
 assert.equal(applyPaperPolicyUpgrade(state,event,now),true);
 assert.deepEqual(state.config,{...old.config,maxMarketCap:BLUECHIP_MARKET_CAP_CEILING},'Only the specifically authorized ceiling changes');
 for(const field of ['runId','enabled','cashCents','realizedCents','stats','positions'])assert.deepEqual(state[field],old[field],field+' must remain unchanged');
 const applied=JSON.stringify(state);assert.equal(marketCapPolicyUpgrade(state),null);assert.equal(applyPaperPolicyUpgrade(state,event,now+1),false);assert.equal(JSON.stringify(state),applied,'Replay/retry is idempotent');
 const replay=JSON.parse(before);assert.equal(applyPaperPolicyUpgrade(replay,JSON.parse(JSON.stringify(event)),now),true);assert.deepEqual(replay,state,'The public journal event completely determines replay');
 state.config.maxMarketCap=5000000;
 assert.equal(marketCapPolicyUpgrade(state),null,'A later deliberate operator lower is not overwritten on restart');
 // Reset/new-run keeps installation-level policy markers while replacing the run.
 Object.assign(state,{runId:'later-run',enabled:false,config:{...state.config,maxMarketCap:3000000},positions:{}});
 assert.equal(marketCapPolicyUpgrade(state),null,'Reset is not a new grant to expand the ceiling');
}
for(const state of [{...previous(),runId:null},previous({engine:'luna'}),previous({cap:NaN}),previous({cap:0}),previous({cap:Infinity}),previous({cap:BLUECHIP_MARKET_CAP_CEILING+1})])assert.equal(marketCapPolicyUpgrade(state),null);

const stale=previous(),planned=marketCapPolicyUpgrade(stale);stale.runId='newer-run';assert.equal(applyPaperPolicyUpgrade(stale,planned,now),false,'An event queued for the former run cannot cross reset');
stale.runId=planned.runId;stale.config.maxMarketCap=2000000;assert.equal(applyPaperPolicyUpgrade(stale,planned,now),false,'An intervening manual cap edit cannot be overwritten by stale planning');
for(const mutation of [{id:'unknown-policy'},{config:{maxMarketCap:1e12,stopPct:30}},{config:{maxMarketCap:1e11}},{previousMaxMarketCap:null}]){const state=previous(),event={...marketCapPolicyUpgrade(state),...mutation},before=JSON.stringify(state);assert.equal(applyPaperPolicyUpgrade(state,event,now),false);assert.equal(JSON.stringify(state),before);}

const created=previous({cap:7000000});created.runId='new-release-run';
assert.equal(acknowledgePaperPolicies(created,[],now),false,'Historical events without an acknowledgement still need migration');
assert.equal(acknowledgePaperPolicies(created,[BLUECHIP_CEILING_POLICY],now),true);assert.equal(created.config.maxMarketCap,7000000,'New explicit operator settings are respected from creation');assert.equal(marketCapPolicyUpgrade(created),null);
assert.equal(acknowledgePaperPolicies(created,[BLUECHIP_CEILING_POLICY],now+1),false);
console.log('PASS one-time paper ceiling policy: enabled/paused existing runs, custom and already-expanded ceilings, immutable positions/accounting, persisted replay, no restart/reset override, narrow event validation and explicit new-run acknowledgement.');
