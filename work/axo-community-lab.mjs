import {createHash,randomUUID} from 'node:crypto';
import Stream from './axo-stream-schema.cjs';
import Model from './axo-community-lab-model.cjs';
import {walletKey} from './axo-personal-model.mjs';
import {isAxoOrigin} from './axo-request-origin.mjs';
const pk=p=>createHash('sha256').update(Stream.key({chain:p.chain,address:p.address})).digest('hex');
const error=(message,status=400)=>Object.assign(Error(message),{status});
const consent=" JOIN axo_wallet_workspaces w ON w.wallet_key=c.owner_key AND w.payload->'preferences'->>'communitySharing'='true' ";
const at=value=>new Date(value).getTime();
export function createCommunityLab({store,session,authorize,personal,now=Date.now}={}){
 const calls=new Map();let cached=null,pending=null,epoch=0;
 function invalidate(){epoch++;cached=null;}
 async function collect(){
  try{
   // Three bounded shared reads, rather than a separate query per project.
   const [requestRows,findingRows,reviewRows]=await Promise.all([
    store.query("SELECT c.* FROM axo_community_requests c"+consent+"WHERE c.updated_at>now()-interval '7 days' ORDER BY c.updated_at DESC LIMIT 400"),
    store.query("SELECT c.* FROM axo_community_findings c"+consent+"WHERE c.updated_at>now()-interval '7 days' ORDER BY c.updated_at DESC LIMIT 400"),
    store.query("SELECT r.* FROM axo_community_reviews r JOIN axo_community_findings c ON c.id=r.finding_id AND c.revision=r.revision"+consent+" JOIN axo_wallet_workspaces v ON v.wallet_key=r.reviewer_key AND v.payload->'preferences'->>'communitySharing'='true' WHERE r.updated_at>now()-interval '7 days' AND c.updated_at>now()-interval '7 days' ORDER BY r.updated_at DESC LIMIT 1200")
   ]);
   const projects=new Map();
   for(const r of [...requestRows.rows,...findingRows.rows])try{const identity=Stream.exact({chain:r.chain,address:r.address}),key=pk(identity);if(!projects.has(key))projects.set(key,{identity,requests:[],findings:[]});const row={owner:r.owner_key,topic:r.topic,at:at(r.updated_at)};if(r.id)projects.get(key).findings.push({...row,id:r.id,revision:r.revision,...r.payload});else projects.get(key).requests.push(row);}catch{}
   const reviews=reviewRows.rows.map(r=>({id:r.finding_id,revision:r.revision,owner:r.reviewer_key,verdict:r.verdict,at:at(r.updated_at)}));
   return {version:1,status:'available',asOf:now(),rows:[...projects.values()].slice(0,60).map(p=>({identity:p.identity,checks:Model.projectBoard({...p,reviews,now:now()})})),topics:Model.topics,limits:{projects:60,findingsPerCheck:8,windowDays:7,minimumPublicReviewers:3},method:'Member-submitted evidence and peer feedback. Reviews assess usefulness, not truth, safety or profitability. Counts below three wallets are withheld; wallets are not necessarily distinct people.'};
  }catch{return {version:1,status:'unavailable',asOf:now(),rows:[],topics:Model.topics,requiredMigration:7,reason:'Shared research is unavailable. Please try again after the service is connected.'};}
 }
 async function snapshot(){if(cached&&now()-cached.at<15000)return cached.value;if(pending)return pending;const generation=epoch;pending=collect().then(value=>{if(generation!==epoch)return {version:1,status:'unavailable',rows:[],topics:Model.topics,asOf:now(),reason:'Research changed during this refresh. Refresh to see the current shared record.'};cached={at:now(),value};return value;}).finally(()=>pending=null);return pending;}
 async function own(owner){const key=walletKey(owner),[requests,findings,reviews]=await Promise.all([
  store.query('SELECT chain,address,topic,updated_at FROM axo_community_requests WHERE owner_key=$1 ORDER BY updated_at DESC LIMIT 80',[key]),
  store.query('SELECT id,chain,address,topic,revision,payload,updated_at FROM axo_community_findings WHERE owner_key=$1 ORDER BY updated_at DESC LIMIT 80',[key]),
  store.query('SELECT finding_id,revision,verdict FROM axo_community_reviews WHERE reviewer_key=$1 ORDER BY updated_at DESC LIMIT 120',[key])]);
  return {requests:requests.rows.map(r=>({identity:Stream.exact(r),topic:r.topic,at:at(r.updated_at)})),findings:findings.rows.map(r=>({identity:Stream.exact(r),id:r.id,revision:r.revision,...r.payload,at:at(r.updated_at)})),reviews:reviews.rows.map(r=>({id:r.finding_id,revision:r.revision,verdict:r.verdict}))};
 }
 async function withdraw(address){invalidate();const key=walletKey(address);for(const [table,column]of [['axo_community_reviews','reviewer_key'],['axo_community_findings','owner_key'],['axo_community_requests','owner_key']])try{await store.query('DELETE FROM '+table+' WHERE '+column+'=$1',[key]);}catch(e){if(e.code!=='42P01')throw e;}invalidate();}
 async function mutate(req,b){
  const s=session(req),key=walletKey(s.address);
  if(!isAxoOrigin(req)||req.headers['x-axo-request']!=='1')throw error('Same-origin signed contribution required.',403);
  if(b.action==='withdraw-all'){await withdraw(s.address);return {accepted:true};}
  if(!['remove-request','remove-finding'].includes(b.action))await authorize(req,'ask');
  let p;try{p=Stream.exact(b.project);}catch{throw error('Choose an exact project identity.');}const projectKey=pk(p);if(typeof b.topic!=='string'||!Object.hasOwn(Model.topics,b.topic))throw error('Choose a research check.');
  if(b.action==='remove-request'||b.action==='remove-finding'){await store.query('DELETE FROM '+(b.action==='remove-request'?'axo_community_requests':'axo_community_findings')+' WHERE project_key=$1 AND owner_key=$2 AND topic=$3',[projectKey,key,b.topic]);invalidate();return {accepted:true};}
  const workspace=await personal.read(key);if(workspace.value.preferences.communitySharing!==true)throw error('Enable community sharing in Profile before contributing.',403);
  const previous=calls.get(key);if(previous!==undefined&&now()-previous<10000)throw error('Wait ten seconds between contributions.',429);
  if(!['request','finding','review','remove-request','remove-finding'].includes(b.action))throw error('Choose a supported research action.');
  const stamp=now();calls.set(key,stamp);if(calls.size>2000)calls.delete(calls.keys().next().value);
  const values=[projectKey,key,p.chain,p.address,b.topic];
  if(b.action==='request'||b.action==='finding'){
   const count=await store.query('SELECT (SELECT count(*) FROM axo_community_requests WHERE owner_key=$1)+(SELECT count(*) FROM axo_community_findings WHERE owner_key=$1) AS total, EXISTS(SELECT 1 FROM axo_community_requests WHERE owner_key=$1 AND project_key=$2 AND topic=$3) AS request_exists, EXISTS(SELECT 1 FROM axo_community_findings WHERE owner_key=$1 AND project_key=$2 AND topic=$3) AS finding_exists',[key,projectKey,b.topic]);
   if(Number(count.rows[0]?.total)>=80&&!count.rows[0]?.[b.action==='request'?'request_exists':'finding_exists'])throw error('Manage or withdraw an older contribution before adding more.',429);
  }
  if(b.action==='request'){const r=await store.query("INSERT INTO axo_community_requests(project_key,owner_key,chain,address,topic) SELECT $1,$2,$3,$4,$5 FROM axo_wallet_workspaces WHERE wallet_key=$2 AND payload->'preferences'->>'communitySharing'='true' ON CONFLICT(project_key,owner_key,topic) DO UPDATE SET updated_at=now() RETURNING topic",values);if(!r.rows.length)throw error('Sharing permission changed. Reload Profile.',409);}
  if(b.action==='finding'){
   let payload;try{payload=Model.finding(b,now());}catch(e){throw error(e.message);}if(!Number.isSafeInteger(b.revision)||b.revision<0||b.revision>=2147483647)throw error('Reload your current finding revision.');
   const r=await store.query("INSERT INTO axo_community_findings(id,project_key,owner_key,chain,address,topic,payload) SELECT $1,$2,$3,$4,$5,$6,$7 FROM axo_wallet_workspaces WHERE wallet_key=$3 AND payload->'preferences'->>'communitySharing'='true' AND ($8=0 OR EXISTS(SELECT 1 FROM axo_community_findings WHERE project_key=$2 AND owner_key=$3 AND topic=$6 AND revision=$8)) ON CONFLICT(project_key,owner_key,topic) DO UPDATE SET payload=excluded.payload,revision=axo_community_findings.revision+1,updated_at=now() WHERE axo_community_findings.revision=$8 RETURNING id,revision",[randomUUID(),...values,JSON.stringify(payload),b.revision]);
   if(!r.rows.length)throw error('This finding changed in another session. Reload before editing.',409);
   invalidate();return {accepted:true,id:r.rows[0].id,revision:r.rows[0].revision};
  }
  if(b.action==='review'){
   if(!Model.uuid.test(b.id||'')||!Number.isSafeInteger(b.revision)||b.revision<1||!['useful','needs-evidence'].includes(b.verdict))throw error('Choose a current finding and feedback.');
   const r=await store.query("INSERT INTO axo_community_reviews(finding_id,revision,reviewer_key,verdict) SELECT c.id,c.revision,$3,$4 FROM axo_community_findings c"+consent+"WHERE c.id=$1 AND c.revision=$2 AND c.owner_key<>$3 AND c.project_key=$5 AND c.topic=$6 AND c.updated_at>now()-interval '7 days' AND EXISTS(SELECT 1 FROM axo_wallet_workspaces WHERE wallet_key=$3 AND payload->'preferences'->>'communitySharing'='true') ON CONFLICT(finding_id,revision,reviewer_key) DO UPDATE SET verdict=excluded.verdict,updated_at=now() RETURNING finding_id",[b.id,b.revision,key,b.verdict,projectKey,b.topic]);
   if(!r.rows.length)throw error('This finding is yours, changed, or is no longer shared. Reload the research board.',409);
  }
  invalidate();return {accepted:true};
 }
 async function handle(req,res,u){if(!['/api/community-lab','/api/community-lab/own'].includes(u.pathname))return false;const send=(status,value)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(value));};try{
  if(req.method==='GET'){send(200,u.pathname.endsWith('/own')?await own(session(req).address):await snapshot());return true;}
  session(req);if(req.method!=='POST'||u.pathname.endsWith('/own'))throw error('Method not supported.',405);
  if(!isAxoOrigin(req)||req.headers['x-axo-request']!=='1')throw error('Same-origin signed contribution required.',403);
  let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>6000)throw error('Research contribution too large.',413);}const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['action','project','topic','text','source','observedAt','revision','id','verdict'].includes(k)))throw error('Unsupported research field.');
  send(200,await mutate(req,body));
 }catch(e){send(e.status||(e instanceof SyntaxError?400:503),{error:e.status?e.message:'Community research is unavailable or the contribution is invalid.'});}return true;}
 return {snapshot,own,withdraw,invalidate,handle};
}
