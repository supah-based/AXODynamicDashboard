import {fairResearchCandidates} from './axo-paper-opportunities.mjs';
import {tradeSetup,STRATEGY_DEFAULTS,strategyConfig} from './axo-trade-strategy.mjs';
import Stream from './axo-stream-schema.cjs';
import Risk from './axo-risk-policy.cjs';
import Assets from './axo-stablecoins.cjs';
import {paperKey} from './axo-paper.mjs';

const priorities={position:100,interactive:60,signal:40,discovery:10};
export function createTradeResearch({getProject,getHistory,getRisk,getCachedRisk=null,getCurrentProgression=null,getSimulation,getRebound=()=>null,venues,now=Date.now,getCandidates=()=>[],getPositions=async()=>[],autoStart=false,perMinute=6,maxQueued=64,waitMs=1200}={}){
 const cache=new Map(),jobs=new Map(),calls=[];let active=0,wake=null,stopped=false,sweeping=false,lastChain='',timer=null;
 const metrics={completed:0,failed:0,coalesced:0,expired:0,queueFull:0,displaced:0};
 const currentInputs=(p,inputs)=>getCachedRisk?{...inputs,risk:getCachedRisk(p)}:inputs;
 const diagnostic=(identity,reason,status='queued')=>({at:now(),identity,eligible:false,status,technical:{status:'unknown',reason},entry:{status:'unknown'},execution:{status:'unknown'},gaps:[reason]});
 function evaluate(c,p,config){
  const market={...c.inputs.p,...Object.fromEntries(['price','liquidity','marketCap','volume1','volume6','volume24','buys','sells','provider'].filter(k=>p?.[k]!==undefined).map(k=>[k,p[k]])),seenAt:p?.observedAt??p?.seenAt??c.inputs.p.seenAt};
  if(Number.isFinite(p?.seenAt))for(const field of ['credibleListing','tokenCreatedAt','tokenAgeSource','createdAt'])market[field]=p[field]??null;
  const sameProvider=!p?.provider||p.provider===c.inputs.p.provider,tx=p?.transactions?.h1,supplied=p?.buys!==undefined||p?.sells!==undefined||tx;if(supplied){market.buys=p?.buys??tx?.buys??null;market.sells=p?.sells??tx?.sells??null;}market.participationObservedAt=supplied?market.seenAt:sameProvider?c.inputs.p.seenAt:null;if(!sameProvider&&!supplied){market.buys=null;market.sells=null;market.transactions=null;}if(market.seenAt!==c.inputs.p.seenAt||!sameProvider){for(const field of ['price','liquidity','marketCap','volume1','volume6','volume24'])market[field]=p?.[field]??null;market.activityIntegrity=p?.activityIntegrity||null;market.transactions=p?.transactions||null;market.volume5=p?.volume5??null;market.providerObservations=p?.providerObservations||[];}
  market.progression=getCurrentProgression?getCurrentProgression(market):p?.progression||market.progression||null;
  return tradeSetup(market,currentInputs(market,c.inputs),config,now());
 }
 function local(p,config=null){const c=cache.get(paperKey(p));return c&&now()>=c.at&&now()-c.at<=300000?(c.inputs?evaluate(c,p,strategyConfig(config||c.config)):c.value):null;}
 function trimCalls(){while(calls.length&&now()-calls[0]>=60000)calls.shift();}
 function status(){trimCalls();return {mode:'shared-priority-queue',active,queued:[...jobs.values()].filter(j=>!j.running).length,capacityPerMinute:perMinute,callsLastMinute:calls.length,nextEligibleAt:calls.length>=perMinute?calls[0]+60000:now(),...metrics,priorities:'Held positions, user requests, signals, discovery; provider caches/backoff still apply'};}
 function schedule(){clearTimeout(wake);if(stopped)return;wake=setTimeout(drain,100);wake.unref?.();}
 async function collect(job){
  try{
   const p=await getProject(job.identity);if(!p||paperKey(p)!==job.key)throw Error('Exact cached pool unavailable');
   const [history,risk,simulation,rebound]=await Promise.all([getHistory({...job.identity,timeframe:'1h'}).catch(()=>null),getRisk(p).catch(()=>null),getSimulation(job.identity).catch(()=>null),Promise.resolve().then(()=>getRebound(job.identity)).catch(()=>null)]);
   const inputs=structuredClone({p,history,risk,simulation,rebound,priority:venues?.priority(p)||1});
   const entry={at:now(),config:job.config,inputs};cache.set(job.key,entry);metrics.completed++;
   while(cache.size>120)cache.delete(cache.keys().next().value);
   job.resolve(evaluate(entry,p,job.config));
  }catch{metrics.failed++;const value=diagnostic(job.identity,'Exact public evidence unavailable','unavailable');cache.set(job.key,{at:now()-100000,config:job.config,value});job.resolve(value);}
  finally{active--;jobs.delete(job.key);schedule();}
 }
 function drain(){
  if(stopped)return;trimCalls();
  for(const [key,j]of jobs)if(!j.running&&now()-j.enqueuedAt>180000){jobs.delete(key);metrics.expired++;j.resolve(diagnostic(j.identity,'Research queue expired; fresh request required','expired'));}
  while(active<2&&calls.length<perMinute){
   const pending=[...jobs.values()].filter(j=>!j.running).sort((a,b)=>b.priority-a.priority||a.enqueuedAt-b.enqueuedAt);if(!pending.length)break;
   const top=pending[0].priority,j=pending.find(j=>j.priority===top&&j.identity.chain!==lastChain)||pending[0];lastChain=j.identity.chain;
   j.running=true;active++;calls.push(now());void collect(j);
  }
  if([...jobs.values()].some(j=>!j.running)){clearTimeout(wake);wake=setTimeout(drain,Math.max(100,Math.min(60000,(calls[0]||now())+60001-now())));wake.unref?.();}
 }
 function enqueue(identity,config=STRATEGY_DEFAULTS,{priority='interactive'}={}){
  config=strategyConfig(config);const exact=Stream.exact(identity,true),key=paperKey(exact),hit=cache.get(key);
  if(hit&&now()>=hit.at&&now()-hit.at<120000)return {state:'cached',identity:exact,promise:Promise.resolve(local(exact,config))};
  if(stopped)return {state:'stopped',identity:exact,promise:Promise.resolve(diagnostic(exact,'Research service stopped','unavailable'))};
  let job=jobs.get(key);
  if(job){metrics.coalesced++;job.priority=Math.max(job.priority,priorities[priority]||priorities.interactive);return {state:job.running?'running':'queued',identity:exact,promise:job.promise};}
  if(jobs.size>=maxQueued){
   const lower=[...jobs.values()].filter(j=>!j.running&&j.priority<(priorities[priority]||priorities.interactive)).sort((a,b)=>a.priority-b.priority||b.enqueuedAt-a.enqueuedAt)[0];
   if(lower){jobs.delete(lower.key);metrics.displaced++;lower.resolve(diagnostic(lower.identity,'Deferred for higher-priority evidence; retry on the next sweep','deferred'));}
   else{metrics.queueFull++;return {state:'capacity',identity:exact,promise:Promise.resolve(diagnostic(exact,'Research queue at capacity; existing position work is retained'))};}
  }
  const deferred=Promise.withResolvers();job={identity:exact,key,config,priority:priorities[priority]||priorities.interactive,enqueuedAt:now(),running:false,promise:deferred.promise,resolve:deferred.resolve};jobs.set(key,job);schedule();return {state:'queued',identity:exact,promise:job.promise};
 }
 async function analyze(identity,config=STRATEGY_DEFAULTS,options={}){
  const ticket=enqueue(identity,config,options);let timeout;
  try{const result=await Promise.race([ticket.promise,new Promise(resolve=>{timeout=setTimeout(()=>resolve(diagnostic(ticket.identity,'Shared research queued; held positions have priority')),waitMs);})]);const c=cache.get(paperKey(ticket.identity));return result.status==='queued'?result:c?.inputs?evaluate(c,await getProject(ticket.identity)||c.inputs.p,strategyConfig(config)):result;}finally{clearTimeout(timeout);}
 }
 async function sweep(){
  if(stopped||sweeping)return;sweeping=true;
  try{
   const positions=await getPositions();for(const p of positions.slice(0,10))try{enqueue(p.identity||{chain:p.chain,address:p.address,pool:p.pool||p.pair},STRATEGY_DEFAULTS,{priority:'position'});}catch{}
   const candidates=getCandidates().filter(p=>Assets.isSuggestedProject(p)&&p.seenAt>0&&p.seenAt<=now()&&now()-p.seenAt<=300000&&Risk.evaluate(p,getCachedRisk?.(p),now()).status==='screened');
   const pending=candidates.filter(p=>{const key=paperKey(p),hit=cache.get(key);return !jobs.has(key)&&!(hit&&now()>=hit.at&&now()-hit.at<120000);});
   const ordered=fairResearchCandidates(pending,{now:now(),limit:5}).rows;
   for(const p of ordered.slice(0,5))try{enqueue({chain:p.chain,address:p.address,pool:p.pair||p.pool},STRATEGY_DEFAULTS,{priority:'discovery'});}catch{}
  }finally{sweeping=false;}
 }
 async function handle(req,res,u){
  if(!['/api/trade-setup','/api/venue-activity'].includes(u.pathname))return false;let code=200,data;
  try{if(req.method!=='GET')throw Object.assign(Error('GET required'),{status:405});data=u.pathname==='/api/venue-activity'?{...venues.snapshot(),research:status(),setups:[...cache.values()].filter(c=>now()-c.at<=300000).map(c=>c.inputs?evaluate(c,c.inputs.p,c.config):c.value)}:await analyze(Object.fromEntries(u.searchParams));}
  catch(e){code=e.status||400;data={error:e.status?e.message:'Valid exact project identity required',code:'trade_research_unavailable'};}
  res.writeHead(code,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));return true;
 }
 if(autoStart){timer=setInterval(()=>void sweep().catch(()=>{}),15000);timer.unref?.();}
 return {analyze,enqueue:(p,c,o)=>{const t=enqueue(p,c,o);return {state:t.state,identity:t.identity};},local,handle,status,sweep,drain,stop(){stopped=true;clearTimeout(wake);clearInterval(timer);for(const [key,j]of jobs)if(!j.running){j.resolve(diagnostic(j.identity,'Research service stopped','unavailable'));jobs.delete(key);}}};
}
