import assert from 'node:assert/strict';
import {socialScope,xUrl,observedCount,engagement,normalizeDirect,normalizeSearch,createSocialApi} from './axo-social.mjs';
const at=Date.now(),scope=socialScope({chain:'base',address:'0x'+'1'.repeat(40)}),profile='https://x.com/project';
assert.equal(xUrl('https://x.com.evil.test/project'),null);assert.equal(xUrl('https://x.com/i'),null);assert.throws(()=>socialScope({chain:'base',address:'ticker'}));assert.equal(observedCount(null).value,null);assert.equal(observedCount('0').value,0);assert.equal(observedCount('1.2K').approximate,true);
const direct=normalizeDirect({url:profile,followers:'100',posts:[{url:profile+'/status/123',text:'Release shipped',publishedAt:new Date(at-3600000).toISOString(),metrics:{likes:'10',replies:'2',reposts:'3',quotes:'1',views:'200'}},{url:profile+'/status/123',text:'duplicate'},{url:'https://x.com/other/status/456',text:'wrong handle'}]},profile,at);
assert.equal(direct.posts.length,1);assert.equal(direct.posts[0].proxy.value,.08);assert.equal(engagement({likes:{value:3}},100),null);assert.equal(normalizeDirect({url:'https://x.com/other'},profile,at).status,'identity_mismatch');
const search=normalizeSearch({summary:'Example',sentiment:'bullish',leads:[{url:profile+'/status/123',title:'Release',text:'Base product released',publishedAt:'2099-01-01'},{url:'https://sotwe.com/project',text:'mirror'}],observations:[{text:'Concrete release',sources:[profile+'/status/123']},{text:'unsupported',sources:['https://x.com/other/status/42']}]},scope,profile,at,direct);assert.equal(search.leads.length,1);assert.equal(search.leads[0].metrics,null);assert.equal(search.leads[0].publishedAt,null);assert.equal(search.observations.length,1);
assert.equal(normalizeSearch({leads:[{url:profile+'/status/3',text:'Solana only'}]},socialScope({chain:'base'}),null,at).leads.length,0);
let clock=at,allow=false,calls=0;const api=createSocialApi({now:()=>clock,profiles:{profile:async()=>({socials:[{url:profile,label:'Provider-listed'}]})},reserveModel:async()=>allow,read:async()=>({url:profile,status:'login_required',posts:[]}),model:async()=>{calls++;return {model:'gpt-6-luna',webCalls:1,value:{summary:'No original evidence',sentiment:'insufficient evidence',leads:[],observations:[]}}}});
try{
 assert.equal((await api.snapshot({chain:'base'})).status,'queued');await api.tick();assert.equal(calls,0);
 allow=true;await api.tick();assert.equal(calls,1);assert.equal((await api.snapshot({chain:'base'})).status,'unavailable');
 clock+=299999;await api.snapshot({chain:'base'},true);await api.tick();assert.equal(calls,1,'Explicit refresh must respect the empty-result retry delay');
 clock+=1;await api.snapshot({chain:'base'});await new Promise(r=>setTimeout(r,0));await api.tick();assert.equal(calls,2,'An empty sample becomes eligible after five minutes');
 clock+=2*3600000;await api.snapshot({chain:'base'});await new Promise(r=>setTimeout(r,0));await api.tick();assert.equal(calls,3);
 await api.snapshot({chain:'base'},true);await api.tick();assert.equal(calls,3,'Immediate repeated refresh cannot spend another call');
}finally{api.stop()}
let successfulCalls=0;
const successful=createSocialApi({now:()=>clock,reserveModel:async()=>true,model:async()=>{successfulCalls++;return {model:'gpt-6-luna',value:{summary:'Release',leads:[{url:profile+'/status/123',text:'Base product released'}],observations:[]}}}});
try{
 await successful.snapshot({chain:'base'});await new Promise(r=>setTimeout(r,0));await successful.tick();assert.equal(successfulCalls,1);
 clock+=10800000-1;await successful.snapshot({chain:'base'});await successful.tick();assert.equal(successfulCalls,1,'Useful chain evidence retains its three-hour cache');
 clock+=1;await successful.snapshot({chain:'base'});await new Promise(r=>setTimeout(r,0));await successful.tick();assert.equal(successfulCalls,2);
}finally{successful.stop()}
console.log('PASS: exact identities, public metrics/proxies, missing vs zero, future dates, mirror rejection, chain scope, dedupe, quality citations, cache/refresh and hard shared-budget deferral.');
