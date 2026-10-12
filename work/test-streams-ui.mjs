import assert from 'node:assert/strict';
import vm from 'node:vm';
export async function testStreamsUi({c,document,window,mem}){
 const run=s=>vm.runInContext(s,c),click=el=>el.dispatchEvent(new window.Event('click',{bubbles:true}));
 const oldFetch=c.fetch;
 run(`snapshot.feeds.launches={status:'live',data:{items:[{...testPool,id:'base:pool1',pair:'0x2222222222222222222222222222222222222222',liquidity:200000,price:10},{...testPool,id:'solana:pool2',chain:'solana',liquidity:300000}]}};snapshot.feeds.dex={status:'live',data:{launchpads:[{name:'Base launchpad fixture',slug:'pad-base',chains:['Base'],volume:20},{name:'Solana launchpad fixture',slug:'pad-sol',chains:['Solana'],volume:30}]}};axoChains.data.set('base',{chain:'base',asOf:Date.now(),status:'available',pools:snapshot.feeds.launches.data.items.filter(p=>p.chain==='base').map(p=>({...p,seenAt:Date.now()})),sources:[],sample:'Fixture',dex:{},capital:{},launchpads:[],news:{items:[]}});axoGoStream({type:'chain',chain:'base',filters:{liquidity:1000,lens:'all'}});`);
 assert.equal(run('candidates().length'),1);assert.equal(run('candidates()[0].chain'),'base');assert.equal(document.querySelector('[data-card="markets"]'),null);assert.equal(document.querySelector('.header-actions').lastElementChild.id,'walletButton');
 click(document.querySelector('[data-stream-save]'));document.getElementById('axoStreamName').value='Base live';document.getElementById('axoSaveStreamForm').onsubmit({preventDefault(){}});
 const saved=JSON.parse(mem.get('axo-stream-shortcuts-v1'));assert.equal(saved[0].stream.type,'chain');assert.equal(saved[0].stream.chain,'base');assert.equal(saved[0].stream.cards,undefined);assert.equal(saved[0].stream.filters.liquidity,1000);
 run(`snapshot.feeds.launches.data.items.push({...testPool,id:'base:pool-new',address:'0x3333333333333333333333333333333333333333',liquidity:80000});axoChains.data.get('base').pools=snapshot.feeds.launches.data.items.filter(p=>p.chain==='base').map(p=>({...p,seenAt:Date.now()}));axoGoStream({type:'home'});`);click(document.querySelector('[data-stream-shortcut]'));assert.equal(run('candidates().length'),2,'saved stream recomputes fresh results');
 run(`axoGoStream({type:'home'});axoGoStream({type:'launchpads',chain:'base'});`);assert.match(document.querySelector('#board').textContent,/Base launchpad fixture/);assert.doesNotMatch(document.querySelector('#board').textContent,/Solana launchpad fixture/);assert.equal(run('candidates().length'),0);
 click(document.querySelector('[data-stream-pad]'));assert.match(document.querySelector('#board').textContent,/does not identify/);
 run(`axoGoStream({type:'narrative',id:'liquid',filters:{liquidity:1000}})`);assert.equal(run('candidates().length'),0);assert.match(document.querySelector('#axoStreamTitle').title,/not a verified cultural narrative/);
 run(`snapshot.feeds.trending={status:'live',data:{coins:[],categories:[{name:'Verified category fixture',change:3,volume:100}]}};axoGoStream({type:'narrative',id:'category:Verified category fixture'});`);assert.match(document.querySelector('#board').textContent,/CoinGecko category metadata/);assert.match(document.querySelector('#board').textContent,/not verified membership/);assert.equal(run('candidates().length'),0);
 c.fetch=async url=>url.startsWith('/api/project')?{ok:true,json:async()=>({receivedAt:Date.now(),pools:[run('snapshot.feeds.launches.data.items[0]')]})}:{ok:true,json:async()=>({status:'unavailable',reason:'No exact-pool history fixture',candles:[]})};
 run(`axoOpenProjectStream(snapshot.feeds.launches.data.items[0])`);await new Promise(r=>setTimeout(r,15));assert.match(document.querySelector('#board').textContent,/No exact-pool history fixture/);assert.equal(document.querySelectorAll('[data-stream-frame]').length,4);assert.ok(document.querySelectorAll('#board > .axo-stream-data-card').length>=2);assert.equal(document.querySelector('.axo-stream-ui'),null);
 click(document.querySelector('[data-stream-frame="1w"]'));await new Promise(r=>setTimeout(r,5));assert.equal(run('axoCaptureStream().timeframe'),'1w');assert.equal(run('axoCaptureStream().project.pool'),'0x2222222222222222222222222222222222222222');
 run(`var alertFixture={id:'test',enabled:true,chain:'base',address:'a',pool:'p',metric:'price',direction:'below',threshold:10};var alertPool={chain:'base',address:'a',pair:'p',price:9,seenAt:1000};`);
 assert.equal(run('axoEvaluateAlert(alertFixture,alertPool,1000,1000).trigger'),false,'initial beyond never fires');
 assert.equal(run('axoEvaluateAlert(alertFixture,{...alertPool,price:11,seenAt:2000},2000,2000).status'),'armed');
 assert.equal(run('axoEvaluateAlert(alertFixture,{...alertPool,price:9,seenAt:3000},3000,3000).trigger'),true);
 assert.equal(run('axoEvaluateAlert(alertFixture,{...alertPool,price:9,seenAt:4000},4000,4000).trigger'),false);
 assert.equal(run('axoEvaluateAlert(alertFixture,{...alertPool,price:11,seenAt:5000},5000,5000).status'),'armed');
 assert.equal(run('axoEvaluateAlert(alertFixture,{...alertPool,price:1,seenAt:5000},5000,999999).trigger'),false,'stale data cannot alert');
 assert.equal(run('axoEvaluateAlert(alertFixture,{...alertPool,pair:"wrong",price:1,seenAt:6000},6000,6000).trigger'),false);
 run(`axoGoStream({type:'home'});`);c.fetch=oldFetch;
 console.log('Stream/alert UI tests passed: real scope changes, saved live definitions re-evaluate, chain launchpad mapping, explicit narrative screens, exact project/history gaps, timeframe persistence, rightmost wallet, threshold crossing/rearm and stale/mismatched data suppression.');
}
