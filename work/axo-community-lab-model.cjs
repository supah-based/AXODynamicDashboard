(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AxoCommunityLab=api;})(globalThis,function(){
 const topics=Object.freeze({contract:{title:'Contract controls',question:'Which permissions or sell restrictions need checking?',next:'Inspect the current contract screening and explorer source.'},liquidity:{title:'Liquidity & exits',question:'What supports liquidity and the ability to exit?',next:'Inspect pool depth, liquidity changes and a current sell quote.'},delivery:{title:'Product delivery',question:'What has the team shipped that can be checked?',next:'Inspect the release, repository or working product.'},catalyst:{title:'Upcoming catalyst',question:'What dated event could change the project?',next:'Check the original announcement and whether the event happened.'}});
 const windowMs=7*86400000,uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 function source(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||u.href.length>500||!u.hostname.includes('.')||/^(?:\[|\d+\.)/.test(u.hostname)||/(?:^|\.)(?:localhost|local|internal|test|example|invalid)$/.test(u.hostname)||[...u.searchParams.keys()].some(k=>/^(?:api[_-]?key|access[_-]?token|auth|password|secret|signature)$/i.test(k)))throw Error('Use a public HTTPS evidence link without credentials.');u.hash='';return u.href;}
 function finding(value,now=Date.now()){
  if(typeof value?.topic!=='string'||!Object.hasOwn(topics,value.topic))throw Error('Choose a research check.');
  const text=typeof value.text==='string'?value.text.replace(/<[^>]*>/g,' ').replace(/[\u0000-\u001f\u007f]/g,' ').trim():'';
  if(text.length<20||text.length>500)throw Error('Describe the evidence in 20–500 characters.');
  if(!Number.isSafeInteger(value.observedAt)||value.observedAt>now||now-value.observedAt>windowMs||value.observedAt<=0)throw Error('Evidence needs a date within the last seven days.');
  return {topic:value.topic,text,source:source(value.source),observedAt:value.observedAt};
 }
 function projectBoard({requests=[],findings=[],reviews=[],now=Date.now()}){
  const fresh=at=>Number.isFinite(at)&&at>0&&at<=now&&now-at<windowMs;
  return Object.entries(topics).map(([topic,definition])=>{
   const demand=new Set(requests.filter(r=>r.topic===topic&&fresh(r.at)).map(r=>r.owner)),notes=findings.filter(r=>r.topic===topic&&fresh(r.at)&&fresh(r.observedAt)&&uuid.test(r.id)).sort((a,b)=>b.at-a.at).slice(0,8).flatMap(r=>{
    try{const body=finding(r,now);const distinct=new Map();for(const v of reviews)if(v.id===r.id&&v.revision===r.revision&&v.owner!==r.owner&&fresh(v.at)&&['useful','needs-evidence'].includes(v.verdict)){const old=distinct.get(v.owner);if(!old||v.at>old.at)distinct.set(v.owner,v);}
     const values=[...distinct.values()],count=values.length,publicCounts=count>=3;
     return [{id:r.id,revision:r.revision,...body,at:r.at,review:{status:!count?'awaiting-review':!publicCounts?'small-review-group':values.some(v=>v.verdict==='needs-evidence')?'mixed-feedback':'reviewed-useful',reviewers:publicCounts?count:null,useful:publicCounts?values.filter(v=>v.verdict==='useful').length:null,needsEvidence:publicCounts?values.filter(v=>v.verdict==='needs-evidence').length:null},next:definition.next}];
    }catch{return [];}
   });
   return {topic,...definition,requested:demand.size>0,requesters:demand.size>=3?demand.size:demand.size?null:0,status:notes.length?'evidence-submitted':demand.size?'help-requested':'open-check',findings:notes};
  });
 }
 return Object.freeze({topics,windowMs,uuid,source,finding,projectBoard});
});
