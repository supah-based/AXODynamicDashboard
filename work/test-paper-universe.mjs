import assert from 'node:assert/strict';
import {mergePaperPools,exactPublicPoolKey} from './axo-paper-universe.mjs';
import {buildOpportunityUniverse} from './axo-paper-opportunities.mjs';

const now=Date.UTC(2026,9,16,12),day=86400000,a='0x'+'a'.repeat(40),pool='0x'+'b'.repeat(40);
const project={chain:'base',address:a,pair:pool,price:10,marketCap:1000000,liquidity:100000,volume1:1000,volume24:10000,seenAt:now,createdAt:now-3*day,provider:'Provider A'};
const listing={chain:'base',address:a,coinId:'fixture',rank:10,marketCap:2e9,at:now,source:'https://example.org/listing'};
const older={...project,seenAt:now-60000,marketCap:900000,volume1:900,credibleListing:listing,tokenCreatedAt:now-30*day,tokenAgeSource:'Exact genesis'};
const partial={...project,marketCap:null,volume1:null};
const input=[[older],[partial]],before=JSON.stringify(input),merged=mergePaperPools(input,now);
assert.equal(merged.length,1);assert.equal(merged[0].marketCap,null,'A newer missing market cap cannot inherit an older market cap');
assert.equal(merged[0].volume1,null,'Rolling market windows remain atomic');
assert.equal(merged[0].credibleListing.coinId,'fixture','Separately dated exact listing survives newer quote');
assert.equal(merged[0].tokenCreatedAt,older.tokenCreatedAt,'Sourced token genesis survives newer quote');
assert.equal(JSON.stringify(input),before,'Merge must not mutate input sources');
assert.equal(buildOpportunityUniverse(merged,{now}).rows.length,0,'Missing actual cap remains ineligible after merge');

const badListings=[{...listing,address:'0x'+'c'.repeat(40)},{...listing,chain:'arc'},{...listing,at:now+1},{...listing,at:now-900001}];
for(const c of badListings){const d=mergePaperPools([[{...older,credibleListing:c}],[project]],now)[0];assert.equal(d.credibleListing,undefined,'Mismatched/stale/future listing does not travel onto newer quote');}
const conflictingAge=mergePaperPools([[older],[{...project,tokenCreatedAt:now-90*day,tokenAgeSource:'Other source'}]],now)[0];
assert.equal(conflictingAge.tokenCreatedAt,null);assert.equal(conflictingAge.tokenAgeSource,null,'Conflicting token genesis stays unknown');
const dated=mergePaperPools([[{...project,observationStatus:'stale'}],[{...project}]],now)[0];
assert.notEqual(dated.observationStatus,'stale','An equal-dated live observation can recover a stale source state');
const sol={...project,chain:'solana',address:'A'.repeat(32),pair:'B'.repeat(32)};
assert.equal(mergePaperPools([[sol],[{...sol,address:'a'.repeat(32)}]],now).length,2,'Solana mints retain case identity');
assert.equal(exactPublicPoolKey({...project,address:a.toUpperCase(),pair:pool.toUpperCase()}),exactPublicPoolKey(project),'EVM pool identity normalizes case');

const future=mergePaperPools([[project],[{...project,seenAt:now+60000}]],now);
assert.equal(buildOpportunityUniverse(future,{now}).rows.length,0,'Newer future observation must not revive an older same-pool quote');
const memory={...project};
const conflict={...project,providerObservations:[{provider:'Provider A',price:10,seenAt:now},{provider:'Provider B',price:20,seenAt:now}]};
for(const groups of [[[memory],[conflict]],[[conflict],[memory]]])assert.equal(buildOpportunityUniverse(mergePaperPools(groups,now),{now}).rows.length,0,'Equal-date sanitation cannot erase known same-pool quote conflict');
for(const groups of [[[memory],[{...project,curve:true}]],[[{...project,curve:true}],[memory]]])assert.equal(buildOpportunityUniverse(mergePaperPools(groups,now),{now}).rows.length,0,'Equal-date sanitation cannot erase curve execution coverage gap');
for(const groups of [[[memory],[{...project,activityIntegrity:{status:'inconsistent'}}]],[[{...project,activityIntegrity:{status:'inconsistent'}}],[memory]]])assert.equal(buildOpportunityUniverse(mergePaperPools(groups,now),{now}).rows.length,0,'Equal-date sanitation cannot erase detected activity inconsistency');
console.log('PASS merged paper universe preserves atomic quotes, dated category facts, token-age conflicts, exact identity and restrictive evidence across sanitized source ties.');
