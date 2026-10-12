/* Source flags, not verdicts. Shared pure policy; never treats price/volume as rug proof. */
(function(root){
const eq=(a,b,c)=>typeof a==='string'&&typeof b==='string'&&(c==='solana'?a===b:a.toLowerCase()===b.toLowerCase());
function evaluate(p,d,now=Date.now()){
 const exact=d?.chain===p.chain&&eq(d.address,p.address,p.chain)&&d.source==='GoPlus',at=exact?d.receivedAt:null,fresh=exact&&d.status==='available'&&Number.isFinite(at)&&at>0&&at<=now&&now-at<=300000;
 const checks=exact&&Number.isFinite(at)&&at>0&&at<=now&&d.status==='available'?d.checks||[]:[],positive=checks.filter(c=>c.value==='1'),severe=positive.filter(c=>c.key==='is_honeypot'||p.chain==='solana'&&c.key==='non_transferable'),warnings=positive.filter(c=>!severe.includes(c));
 const known=checks.some(c=>c.value==='0'||c.value==='1'),status=severe.length?'excluded':!fresh?'unknown':warnings.length?'warning':known?'screened':'unknown';
 return {chain:p.chain,address:p.address,status,excluded:status==='excluded',fresh,stale:!!at&&!fresh,observedAt:at||null,source:exact?'GoPlus':null,sourceUrl:exact?d.sourceUrl:null,confidence:severe.length?'Explicit provider flag; not independently proven':known?'Provider observation; incomplete coverage':'Unknown',reasons:(severe.length?severe:warnings).map(c=>({key:c.key,label:c.label})),label:severe.length?(fresh?'Severe source flag':'Severe flag · dated'):!fresh?'Risk unknown':warnings.length?'Risk flags':known?'No severe flags reported':'Risk unknown'};
}
function origin(p){const e=p.originEvidence;if(!e||e.chain!==p.chain||!eq(e.address,p.address,p.chain)||!Number.isFinite(e.observedAt)||e.observedAt<=0||e.observedAt>Date.now()||!/^https:\/\//.test(e.url||'')||!e.source)return {label:'Origin unverified'};return e.kind==='launchpad'&&e.name?{...e,label:e.name}:e.kind==='custom'&&e.deploymentVerified===true?{...e,label:'Custom contract'}:{label:'Origin unverified'}}
const api={evaluate,origin,eq};root.AxoRiskPolicy=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
