(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AxoDiscoveryFilters=api;})(globalThis,function(){
 const ranges=[['mc','Market cap'],['liq','Liquidity'],['vol','24h volume'],['holders','Holders'],['score','Axo score']],requirements={verified:'Source verified',activeX:'X activity · 7d',website:'Website listed'};
 function parse(input,max=1e15){
  let raw=String(input??'').trim().replace(/^\$\s*/,'').toLowerCase();if(!raw)return {valid:true,value:null};
  if(raw.includes(',')&&!/^\d{1,3}(,\d{3})+(\.\d+)?[kmb]?$/.test(raw))return {valid:false,value:null};raw=raw.replaceAll(',','');
  const m=raw.match(/^((?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)([kmb]?)$/);if(!m)return {valid:false,value:null};
  const value=Number(m[1])*({k:1e3,m:1e6,b:1e9}[m[2]]||1);return {valid:Number.isFinite(value)&&value>=0&&value<=max,value};
 }
 function validate(d){return ranges.flatMap(([key,label])=>{const lo=d[key+'Min'],hi=d[key+'Max'],max=key==='score'?100:1e15;return [lo,hi].some(v=>v!=null&&(!Number.isFinite(v)||v<0||v>max))?[{keys:[key+'Min',key+'Max'],message:label+' must be between 0 and '+format(max)+'.'}]:lo!=null&&hi!=null&&lo>hi?[{keys:[key+'Min',key+'Max'],message:label+' minimum must not exceed maximum.'}]:[];});}
 function format(v){if(!Number.isFinite(v))return '';for(const [n,s]of [[1e9,'b'],[1e6,'m'],[1e3,'k']])if(v>=n&&Number.isInteger(v/n*1000))return String(v/n)+s;return String(v);}
 function chips(d){const out=[];for(const [k,label]of ranges)for(const side of ['Min','Max']){const value=d[k+side];if(value!=null&&!(k==='liq'&&side==='Min'&&value===1000))out.push({key:k+side,label:label+' '+(side==='Min'?'≥':'≤')+' '+format(value)});}for(const [key,label]of Object.entries(requirements))if(d[key])out.push({key,label});return out;}
 return {ranges,requirements,parse,format,validate,chips};
});
