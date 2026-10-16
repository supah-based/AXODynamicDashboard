import assert from 'node:assert/strict';
import {PAPER_CHAINS,PAPER_CATEGORIES,classifyOpportunity,buildOpportunityUniverse,rankOpportunity,fairResearchCandidates} from './axo-paper-opportunities.mjs';

const now = Date.UTC(2026,9,16,12), day = 86400000;
const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const addr = (n,chain='base') => chain === 'solana' ? 'A'.repeat(31)+alphabet[n] : '0x'+n.toString(16).padStart(40,'0');
function project(n=1,chain='base',category='degen') {
 const p = {chain,address:addr(n,chain),pair:addr(n+8,chain),name:'Research '+n,symbol:'R'+n,price:10,marketCap:1000000,liquidity:300000,seenAt:now,createdAt:now-3*day,provider:'Fixture',volume1:10000,volume24:100000};
 if (category === 'swing') Object.assign(p,{tokenCreatedAt:now-30*day,tokenAgeSource:'Verified provider genesis'});
 if (category === 'bluechip') Object.assign(p,{marketCap:2e9,credibleListing:{chain,address:p.address,coinId:'fixture',rank:12,marketCap:2e9,at:now,source:'https://example.org/listing'}});
 return p;
}
const p = project(), old = project(2,'base','swing'), blue = project(3,'base','bluechip');
assert.deepEqual(PAPER_CHAINS,['solana','base','bsc','robinhood','arc']);
assert.equal(classifyOpportunity(p,now).category,'degen');
assert.match(classifyOpportunity(p,now).reason,/does not establish the token launch/);
assert.equal(classifyOpportunity(old,now).category,'swing','Dated token genesis takes precedence over a newer pool');
assert.equal(classifyOpportunity({...blue,tokenCreatedAt:now-30*day,tokenAgeSource:'Genesis'},now).category,'bluechip');
assert.equal(classifyOpportunity({...old,tokenCreatedAt:now-7*day,createdAt:now-8*day},now).category,null,'Swing threshold is strictly older than seven days');
assert.equal(classifyOpportunity({...p,createdAt:now-8*day},now).category,null,'Pool age does not become token genesis');
assert.equal(classifyOpportunity({...p,createdAt:null},now).category,null,'Unknown age is not an automatic degen entry');
assert.equal(classifyOpportunity({...p,tokenCreatedAt:now+1},now).category,null,'Future token dates cannot be bypassed by pool age');
for (const listing of [{...blue.credibleListing,address:addr(9)},{...blue.credibleListing,chain:'arc'},{...blue.credibleListing,at:now+1},{...blue.credibleListing,at:now-900001},{...blue.credibleListing,rank:101},{...blue.credibleListing,marketCap:999999999}]) assert.notEqual(classifyOpportunity({...blue,credibleListing:listing},now).category,'bluechip');
assert.equal(classifyOpportunity({...blue,credibleListing:{...blue.credibleListing,address:blue.address.toUpperCase().replace('0X','0x')}},now).category,'bluechip','EVM contract comparison is case-insensitive');
const sol = project(1,'solana','bluechip');
assert.notEqual(classifyOpportunity({...sol,credibleListing:{...sol.credibleListing,address:sol.address.toLowerCase()}},now).category,'bluechip','Solana mint comparison is case-sensitive');

const all = PAPER_CHAINS.flatMap(chain => PAPER_CATEGORIES.map((category,i) => project(i+1,chain,category)));
const inputBefore = JSON.stringify(all), universe = buildOpportunityUniverse(all,{now});
assert.equal(universe.rows.length,15); assert.equal(universe.coverage.length,15);
assert.ok(universe.coverage.every(c => c.observed===1 && c.usable===1));
assert.equal(JSON.stringify(all),inputBefore,'Selection does not mutate provider observations');
const deeper = {...p,pair:addr(20),liquidity:700000};
assert.equal(buildOpportunityUniverse([p,deeper],{now}).rows[0].pair,deeper.pair);
const crossPoolBlue={...deeper,credibleListing:{...blue.credibleListing,address:p.address},liquidity:100000};
const merged=buildOpportunityUniverse([p,crossPoolBlue],{now}).rows[0];
assert.equal(merged.pair,p.pair,'Exact-token listing enrichment does not replace the deepest usable pool');
assert.equal(merged.category,'bluechip','Exact-token blue-chip evidence survives selection of a different pool');
assert.equal(merged.price,p.price,'Cross-pool enrichment never borrows market measurements');
assert.equal(buildOpportunityUniverse([p,{...deeper,seenAt:now-300001}],{now}).rows[0].pair,p.pair,'Stale deeper pools cannot displace a current pool');
assert.equal(buildOpportunityUniverse([p,{...p,seenAt:now+1}],{now}).rows.length,0,'Newer future quote cannot revive an older same-pool quote');
assert.equal(buildOpportunityUniverse([{...p,seenAt:now-1000},{...p,marketCap:null}],{now}).rows.length,0,'Newer partial quote cannot inherit old market cap');
assert.equal(buildOpportunityUniverse([p,deeper],{now,held:[{...p,pool:addr(30)}]}).rows.length,0,'Holding the token excludes every alternative pool');
assert.equal(buildOpportunityUniverse([p],{now,held:[{...p,address:p.address.toUpperCase().replace('0X','0x')}]}).counts.held,1);
assert.equal(buildOpportunityUniverse([p],{now,held:[p.chain+':'+p.address.toUpperCase().replace('0X','0x')+':'+p.pair]}).counts.held,1,'Held key strings normalize EVM token identity');
const excluded = buildOpportunityUniverse([{...p,address:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'},{...p,chain:'ethereum'}, {...p,address:'broken'}, {...p,marketCap:null,fdv:1e6}, {...old,createdAt:null,tokenCreatedAt:null}, {...blue,seenAt:now-300001}],{now});
assert.equal(excluded.counts.excludedAsset,1);assert.equal(excluded.counts.unsupportedChain,1);assert.equal(excluded.counts.invalidIdentity,1);assert.equal(excluded.counts.invalidMarket,1);assert.equal(excluded.counts.unclassified,1);assert.equal(excluded.counts.stale,1);assert.equal(excluded.rows.length,0);
assert.equal(excluded.coverage.find(c=>c.chain==='base'&&c.category==='degen').waiting,1);
assert.equal(excluded.unclassified.find(c=>c.chain==='base').observed,1);
assert.ok(excluded.gaps.some(x=>x.includes('category')));
assert.equal(buildOpportunityUniverse([{...p,volume1:200000,volume24:10}],{now}).rows.length,0,'Contradictory rolling windows cannot be ranked');
assert.equal(buildOpportunityUniverse([{...p,providerObservations:[{seenAt:now,price:10,provider:'A'},{seenAt:now,price:20,provider:'B'}]}],{now}).rows.length,0,'Same-pool quote conflicts are withheld');

const selected = fairResearchCandidates([...all,...all.map((p,i)=>({...p,address:addr(i+5,p.chain),pair:addr(i+25,p.chain),volume1:1e8,credibleListing:p.credibleListing?{...p.credibleListing,address:addr(i+5,p.chain)}:undefined}))],{now,limit:15});
assert.equal(selected.rows.length,15);
assert.equal(new Set(selected.rows.map(p=>p.chain+':'+p.category)).size,15,'Each of fifteen cells receives research before a repeated cell');
const firstCells = new Set();
// Refresh the fixture while advancing time; otherwise the five-minute evidence window correctly closes.
firstCells.clear();for(let i=0;i<15;i++){const at=now+i*60000,rows=all.map(p=>({...p,seenAt:at,credibleListing:p.credibleListing?{...p.credibleListing,at}:undefined}));const row=fairResearchCandidates(rows,{now:at,limit:1}).rows[0];firstCells.add(row.chain+':'+row.category);}
assert.equal(firstCells.size,15,'A low research limit rotates across every chain/category cell');
assert.equal(fairResearchCandidates(all,{now,limit:0}).rows.length,0);
assert.equal(fairResearchCandidates([{...p,createdAt:null}],{now}).counts.unclassified,1,'Unknown projects remain counted when not scheduled');

const config={minLiquidity:100000,maxExtensionPct:12,minVolumeAcceleration:1.3};
const setup={eligible:true,at:now,identity:{chain:p.chain,address:p.address,pool:p.pair},technical:{status:'available',at:now-3600000,atrPct:3,volumeAcceleration:2,rsi14:55},entry:{currentExtensionPct:2},priority:1};
const rank=rankOpportunity(p,setup,config,now);
assert.equal(rank.eligible,true);assert.ok(rank.score>0&&rank.score<=100);assert.equal(rank.category,'degen');assert.match(rank.reason,/not a win probability/);
assert.ok(rankOpportunity(p,{...setup,entry:{currentExtensionPct:10}},config,now).score<rank.score,'Extended entries rank below the same closer-to-trend entry');
assert.ok(rankOpportunity(p,{...setup,technical:{...setup.technical,atrPct:15}},config,now).score<rank.score,'Higher observed volatility reduces evidence strength');
assert.equal(rankOpportunity(p,{...setup,priority:100},config,now).score-rank.score,5,'Venue popularity adds no more than five points');
for(const bad of [{...setup,eligible:false,gaps:['Sell route missing']},{...setup,at:now+1},{...setup,identity:{...setup.identity,pool:addr(30)}},{...setup,technical:{...setup.technical,atrPct:NaN}},{...setup,technical:{...setup.technical,at:now-7200001}}]){const r=rankOpportunity(p,bad,config,now);assert.equal(r.eligible,false);assert.equal(r.score,0);assert.ok(r.gaps.length);}
assert.equal(rankOpportunity({...p,marketCap:null},setup,config,now).score,0);
assert.equal(rankOpportunity({...p,createdAt:null},setup,config,now).score,0);
assert.ok(!Object.hasOwn(rank,'probability')&&!Object.hasOwn(rank,'expectedReturn'));
console.log('PASS paper opportunity categories, fifteen-cell coverage, current exact-pool deduplication, held-token exclusion, fair research and bounded non-probabilistic evidence ranking.');
