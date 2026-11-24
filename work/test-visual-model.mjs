import assert from 'node:assert/strict';
import Visual from './axo-visual-model.cjs';
const now=Date.now(),address='0x'+'a'.repeat(40),pair='0x'+'b'.repeat(40),p={chain:'base',address,pair,seenAt:now,volume24:500,volume1:0,transactions:{h1:{buys:0,sells:0},h24:{buys:7,sells:3}}};
for(const [width,height]of [[640,350],[270,340],[1200,320]])for(const weights of [[100,20,18,12,8,6,4,3,2,1],[10000,1,1,1],[1],[4,4,4,4]]){const tiles=Visual.treemap(weights.map((weight,i)=>({weight,i})),0,0,width,height),total=weights.reduce((a,b)=>a+b);assert.equal(tiles.length,weights.length);for(const t of tiles){assert.ok(Math.abs(t.w*t.h/(width*height)-t.weight/total)<1e-9,'area remains proportional');assert.ok(t.x>=-1e-8&&t.y>=-1e-8&&t.x+t.w<=width+1e-8&&t.y+t.h<=height+1e-8);for(const other of tiles)if(other!==t)assert.ok(Math.min(t.x+t.w,other.x+other.w)-Math.max(t.x,other.x)<1e-8||Math.min(t.y+t.h,other.y+other.h)-Math.max(t.y,other.y)<1e-8,'no overlapping tiles');}}
assert.deepEqual(Visual.treemap([{weight:0},{weight:-1},{weight:null}]),[]);
const map=Visual.activityMap([{...p,liquidity:1000,volume24:10000},{...p,address:'0x'+'c'.repeat(40),liquidity:1001,volume24:10001},{...p,address:'0x'+'d'.repeat(40),liquidity:100000,volume24:100}]);assert.equal(map.points.length,3);assert.equal(map.groups.length,2);for(const g of map.groups){assert.equal(g.x,g.points[0].x);assert.equal(g.y,g.points[0].y);}assert.equal(map.x.position(1000),0);assert.equal(map.x.position(100000),1);assert.ok(map.x.ticks.includes(10000));
const a=Visual.activity(p,{now});assert.equal(a.status,'available');assert.equal(a.windows[0].volume,null);assert.equal(a.windows[1].total,0);assert.equal(a.windows[1].volume,0);assert.equal(a.windows[1].buyShare,null);assert.equal(a.windows[3].total,10);assert.equal(a.windows[3].buyShare,.7);assert.equal(Visual.activity({...p,seenAt:now-180001},{now}).status,'stale');assert.equal(Visual.activity({...p,seenAt:null},{now}).status,'undated');assert.equal(Visual.activity(p,{now,expected:{...p,pair:address}}).windows[3].total,null);assert.equal(Visual.activity({...p,transactions:{h24:{buys:Number.MAX_SAFE_INTEGER,sells:1}}},{now}).windows[3].total,null);
const hour=Math.floor(now/3600000)*3600,d={chain:p.chain,address,pool:pair,status:'available',currency:'USD',timeframe:'1h',bucketSeconds:3600,candles:[[hour-7200,1,2,.5,1,20],[hour-3600,1,2,.5,1,0],[hour,1,2,.5,1,100],[hour-7200,1,2,.5,1,20]]};assert.equal(Visual.hourlyVolumes(p,d,now).length,2);assert.equal(Visual.hourlyVolumes(p,{...d,address:pair},now).length,0);assert.equal(Visual.hourlyVolumes(p,{...d,currency:'ETH'},now).length,0);
const sol={chain:'solana',address:'A'.repeat(32),pair:'B'.repeat(32)};assert.notEqual(Visual.identity(sol),Visual.identity({...sol,address:'a'.repeat(32)}));
const tracked={...p,liquidity:25000,changes:{m5:1.5,h1:0,h6:null,h24:-12}};
const longMove={...p,address:'0x'+'c'.repeat(40),changes:{m5:-101},change1:7,change24:2500};
const matrix=Visual.momentumMatrix([tracked,{...tracked,pair:address,changes:{m5:-50}},longMove,
 {...p,address:'0x'+'d'.repeat(40),observationStatus:'stale',changes:{m5:20}},
 {...p,address:'0x'+'e'.repeat(40),seenAt:now+1,changes:{m5:20}},
 {...p,address:'0x'+'f'.repeat(40)},{...p,pair:'wrong',changes:{m5:20}}],now);
assert.deepEqual(matrix.map(row=>row.returns),[[1.5,0,null,-12],[null,7,null,2500]]);
assert.equal(matrix[0].project.pair,pair);
assert.equal(matrix[0].liquidity,25000);
assert.equal(matrix[1].liquidity,null);
console.log('PASS treemap, log scales, exact-pool activity, dated history and momentum matrix with stale, duplicate, missing and zero checks.');
