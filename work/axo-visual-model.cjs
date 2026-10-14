/* Shared, dependency-free chart geometry and exact-pool activity validation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AxoVisualModel=api;})(globalThis,function(){
 'use strict';
 const finite=v=>typeof v==='number'&&Number.isFinite(v),amount=v=>finite(v)&&v>=0?v:null,count=v=>Number.isSafeInteger(v)&&v>=0?v:null;
 function identity(p){if(!p||typeof p.chain!=='string')return null;const sol=p.chain==='solana',address=p.address,pool=p.pool||p.pair,token=sol?/^[1-9A-HJ-NP-Za-km-z]{32,44}$/:/^0x[a-f0-9]{40}$/i,pair=sol?token:/^0x(?:[a-f0-9]{40}|[a-f0-9]{64})$/i;if(!token.test(address||'')||!pair.test(pool||''))return null;return [p.chain,sol?address:address.toLowerCase(),sol?pool:pool.toLowerCase()].join(':');}
 function treemap(items,x=0,y=0,w=100,h=100){
  const rows=items.filter(r=>finite(r.weight)&&r.weight>0),total=rows.reduce((s,r)=>s+r.weight,0);if(!rows.length||!finite(total)||!(w>0&&h>0))return [];
  let remaining=rows.map(r=>({...r,area:r.weight/total*w*h})),out=[],box={x,y,w,h};
  const worst=(row,side)=>{const a=row.map(r=>r.area),sum=a.reduce((s,v)=>s+v,0);return Math.max(side*side*Math.max(...a)/(sum*sum),sum*sum/(side*side*Math.min(...a)));};
  while(remaining.length){const side=Math.min(box.w,box.h),row=[remaining.shift()];while(remaining.length&&worst([...row,remaining[0]],side)<=worst(row,side))row.push(remaining.shift());const sum=row.reduce((s,r)=>s+r.area,0),vertical=box.w>=box.h,thickness=sum/side;let offset=0;for(const r of row){const length=r.area/thickness;out.push({...r,x:box.x+(vertical?0:offset),y:box.y+(vertical?offset:0),w:vertical?thickness:length,h:vertical?length:thickness});offset+=length;}if(vertical){box.x+=thickness;box.w=Math.max(0,box.w-thickness);}else{box.y+=thickness;box.h=Math.max(0,box.h-thickness);}}
  return out;
 }
 function logAxis(values){const logs=values.filter(v=>finite(v)&&v>0).map(Math.log10);if(!logs.length)return null;const min=Math.floor(Math.min(...logs)),max=Math.max(min+1,Math.ceil(Math.max(...logs))),step=Math.max(1,Math.ceil((max-min)/4)),ticks=[];for(let n=min;n<=max;n+=step)ticks.push(10**n);if(Math.log10(ticks.at(-1))!==max)ticks.push(10**max);return {min,max,ticks,position:v=>(Math.log10(v)-min)/(max-min)};}
 function activityMap(rows,width=640,height=350){const shown=rows.filter(p=>finite(p.liquidity)&&p.liquidity>0&&finite(p.volume24)&&p.volume24>0).sort((a,b)=>b.volume24-a.volume24||String(identity(a)).localeCompare(String(identity(b)))).slice(0,24),x=logAxis(shown.map(p=>p.liquidity)),y=logAxis(shown.map(p=>p.volume24));if(!x||!y)return {rows:[],points:[],groups:[],x:null,y:null};const left=54,right=25,top=30,bottom=47,pw=Math.max(1,width-left-right),ph=Math.max(1,height-top-bottom),points=shown.map((p,i)=>({p,rank:i+1,x:left+x.position(p.liquidity)*pw,y:top+(1-y.position(p.volume24))*ph})),groups=[];for(const point of points){const near=groups.find(g=>Math.hypot(g.x-point.x,g.y-point.y)<42);if(near)near.points.push(point);else groups.push({...point,points:[point]});}return {rows:shown,points,groups,x,y,left,right,top,bottom,width,height,pw,ph};}
 function activity(p,{now=Date.now(),fresh,expected=p}={}){
  const key=identity(p),same=key&&key===identity(expected),raw=p?.priceObservedAt??p?.seenAt,at=finite(raw)?raw:typeof raw==='string'?Date.parse(raw):NaN,dated=finite(at)&&at>0&&at<=now,ttl=p?.provider==='GeckoTerminal'?900000:180000,status=!same?'unavailable':!dated?'undated':fresh===false||p?.observationStatus==='stale'||now-at>ttl?'stale':'available';
  const windows=[['m5','5m','volume5'],['h1','1h','volume1'],['h6','6h','volume6'],['h24','24h','volume24']].map(([id,label,field])=>{const t=same?p.transactions?.[id]:null,buys=count(t?.buys),sells=count(t?.sells),total=buys!==null&&sells!==null&&Number.isSafeInteger(buys+sells)?buys+sells:null;return {id,label,volume:same?amount(p[field]):null,buys,sells,total,buyShare:total>0?buys/total:null};});
  return {key:same?key:null,status,at:dated?at:null,windows};
 }
 function hourlyVolumes(p,d,now=Date.now()){
  if(!identity(p)||identity(d)!==identity(p)||d?.status!=='available'||d.timeframe!=='1h'||String(d.currency).toLowerCase()!=='usd'||d.bucketSeconds!==3600)return [];
  const seen=new Set();return (d.candles||[]).filter(r=>Array.isArray(r)&&r.length>=6&&r.slice(0,6).every(finite)&&Number.isInteger(r[0])&&r[0]>0&&r[0]%3600===0&&(r[0]+3600)*1000<=now&&r[1]>0&&r[3]>0&&r[2]>=Math.max(r[1],r[4])&&r[3]<=Math.min(r[1],r[4])&&r[5]>=0&&!seen.has(r[0])&&seen.add(r[0])).sort((a,b)=>a[0]-b[0]).slice(-24).map(r=>({time:r[0]*1000,value:r[5]}));
 }
 return Object.freeze({identity,treemap,logAxis,activityMap,activity,hourlyVolumes});
});
