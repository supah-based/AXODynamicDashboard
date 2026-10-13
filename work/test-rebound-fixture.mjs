export const fixtureNow=Date.parse('2026-10-13T12:05:00Z');
export function reboundFixture(now=fixtureNow,bounce=true){
 const address='0x'+'1'.repeat(40),pool='0x'+'2'.repeat(40),project={id:'base-'+pool,chain:'base',address,pair:pool,name:'Fixture Research',symbol:'FIX',price:34,liquidity:250000,volume24:50000,change24:-3,createdAt:now-90*86400000,seenAt:now,provider:'Fixture provider',url:'https://dexscreener.com/base/'+pool};
 const day=Math.floor(now/86400000)*86400,hour=Math.floor(now/3600000)*3600;
 const daily={status:'available',chain:'base',address,pool,currency:'USD',bucketSeconds:86400,receivedAt:now,source:'Fixture candles',url:project.url,timeframe:'1d',candles:Array.from({length:30},(_,i)=>{const c=i===0?100:30;return [day-(30-i)*86400,c,c+1,Math.min(c,29),c,5000];})};
 const hourly={...daily,bucketSeconds:3600,timeframe:'1h',candles:Array.from({length:80},(_,i)=>{const c=!bounce?30:i<30?40:i<56?20+(i-30)*.05:i<79?24+(i-56)*.3:34;return [hour-(80-i)*3600,c,c+.1,c-.1,c,bounce&&i>=74?300:100];})};
 const development={chain:'base',address,checkedAt:now,links:[{url:'https://github.com/fixture/research'}],github:{status:'available',sourceAt:now,repository:'fixture/research',url:'https://github.com/fixture/research',archived:false,commits:[{sha:'a'.repeat(40),at:new Date(now-86400000).toISOString()},{sha:'b'.repeat(40),at:new Date(now-3*86400000).toISOString()}]}};
 const risk={chain:'base',address,source:'GoPlus',status:'available',receivedAt:now,sourceUrl:'https://gopluslabs.io',checks:[{key:'is_honeypot',label:'Honeypot',value:'0'},{key:'cannot_sell_all',label:'Cannot sell',value:'0'}]};
 return {project,daily,hourly,development,risk};
}
