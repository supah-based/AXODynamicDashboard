// DEX Screener USD fields stay separate from supply ratios and pool-relative prices.
export const numberOrNull=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isFinite(Number(v))?Number(v):null;
const nonnegative=v=>{const n=numberOrNull(v);return n!==null&&n>=0?n:null};
const count=v=>{const n=nonnegative(v);return Number.isSafeInteger(n)?n:null};
export function publicUrl(v){try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null}catch{return null}}
export function normalizePair(p,now=Date.now()){
 const windows=['m5','h1','h6','h24'];
 const changes=Object.fromEntries(windows.map(k=>[k,numberOrNull(p.priceChange?.[k])]));
 const transactions=Object.fromEntries(windows.map(k=>[k,{buys:count(p.txns?.[k]?.buys),sells:count(p.txns?.[k]?.sells)}]));
 const links=xs=>(Array.isArray(xs)?xs:[]).slice(0,8).map(x=>({type:String(x.type||x.label||'Website').slice(0,30),url:publicUrl(x.url)})).filter(x=>x.url);
 const image=publicUrl(p.info?.imageUrl),banner=publicUrl(p.info?.header);
 return {id:p.chainId+':'+p.pairAddress,chain:p.chainId,pair:p.pairAddress,address:p.baseToken?.address,symbol:String(p.baseToken?.symbol||'Unknown').slice(0,40),name:String(p.baseToken?.name||'Unknown').slice(0,100),quote:p.quoteToken?.symbol||'',dex:p.dexId,price:nonnegative(p.priceUsd),liquidity:nonnegative(p.liquidity?.usd),volume24:nonnegative(p.volume?.h24),volume6:nonnegative(p.volume?.h6),volume1:nonnegative(p.volume?.h1),volume5:nonnegative(p.volume?.m5),change24:changes.h24,change1:changes.h1,changes,transactions,marketCap:nonnegative(p.marketCap),fdv:nonnegative(p.fdv),buys:transactions.h1.buys,sells:transactions.h1.sells,createdAt:nonnegative(p.pairCreatedAt),boosts:count(p.boosts?.active),url:publicUrl(p.url),seenAt:now,websites:links(p.info?.websites),socials:links(p.info?.socials),imageUrl:image&&new URL(image).hostname==='cdn.dexscreener.com'?image:null,bannerUrl:banner&&new URL(banner).hostname==='cdn.dexscreener.com'?banner:null};
}
