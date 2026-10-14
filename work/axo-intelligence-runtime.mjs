import fs from 'node:fs/promises';
import path from 'node:path';
import Stream from './axo-stream-schema.cjs';
import Registry from './axo-action-registry.cjs';
import {createPersonalStore} from './axo-personal-store.mjs';
import {createPersonalApi} from './axo-personal-api.mjs';
import {createEvidenceService} from './axo-evidence-service.mjs';
import {createCommunityApi} from './axo-community-api.mjs';
import {createAccountingApi} from './axo-accounting-api.mjs';
import {createAccountHistory} from './axo-account-history.mjs';
import {createSignalInbox} from './axo-signal-inbox.mjs';
import {createQualityMetrics} from './axo-quality-metrics.mjs';
export function createIntelligenceRuntime({root,store,auth,getProject,getCachedProject,profiles,security,development,origin,attention,sectors,changes,bounces,positions,review,hatchery,coordination,positionMonitor}){
 const session=req=>auth.verifiedSession(req),authorize=(req,feature)=>auth.checkFeature(req,feature),repository=createPersonalStore(store);
 const community=createCommunityApi({store,session,authorize,personal:repository,positions});
 const evidence=createEvidenceService({store,getProject,getProfile:p=>profiles.profile(p.chain,p.address),getSecurity:p=>security.security(p),getDevelopment:development,getCommunity:p=>{const d=hatchery?.(),source=d?.sources?.find(s=>s.id==='community'&&s.status==='available'),row=d?.community?.projects?.find(x=>x.chain===p.chain&&x.address===p.address),at=source?.observedAt||source?.fetchedAt;if(!row||!Number.isFinite(at))return null;return {chain:p.chain,address:p.address,heat:row.heat??null,fidelity:row.fidelity??null,receipts:row.receiptCount??null,source:source.url,observedAt:at,meaning:'Hatchery participation and peer agreement; neither market activity nor safety or investment quality.'};},getOrigin:origin,getAttention:attention,getSectors:sectors,authorize});
 const personal=createPersonalApi({repository,session,authorize,onRead:async(req,address,value)=>{try{await authorize(req,'ask');for(const p of value.watchlist.slice(0,20))evidence.enqueue(p,'followed');}catch{}},onSave:async(address,before,after)=>{if(before.preferences.communitySharing&&!after.preferences.communitySharing)await community.withdraw(address);for(const p of after.watchlist.slice(0,20))try{evidence.enqueue(p,'followed');}catch{}},forget:async address=>{await community.withdraw(address);await bounces.forgetOwner(address);await positionMonitor?.forgetOwner(address);}});
 const accounting=createAccountingApi({store,session,authorize,positions,history:createAccountHistory({directory:process.env.AXO_ACCOUNT_HISTORY_DIR})});
 const inbox=createSignalInbox({store,personal:repository,session,authorize,projects:getCachedProject,changes,positionAlerts:address=>positionMonitor?.list(address),bounces:address=>bounces.list(address),evidence});
 const quality=createQualityMetrics({store,review});
 const files={'/progress-ui.js':'axo-progress-ui.js','/discovery-ribbon.js':'axo-discovery-ribbon.js','/reading-layout.js':'axo-reading-layout.js','/release-ui.js':'axo-release-ui.js','/action-registry.js':'axo-action-registry.cjs','/community-model.js':'axo-community-model.cjs','/personal-ui.js':'axo-personal-ui.js','/intelligence-ui.js':'axo-intelligence-ui.js','/private-storage.js':'axo-private-storage.js'};
 const retention=setInterval(async()=>{for(const [table,condition]of [['axo_project_evidence',"observed_at<now()-interval '180 days'"],['axo_personal_signals',"at<now()-interval '30 days'"],['axo_portfolio_history',"observed_at<now()-interval '90 days'"],['axo_quality_metrics',"at<now()-interval '30 days'"],['axo_intelligence_outcomes',"issued_at<now()-interval '180 days'"],['axo_signal_baselines',"updated_at<now()-interval '90 days'"],['axo_community_contributions',"created_at<now()-interval '7 days'"],['axo_community_reports',"created_at<now()-interval '30 days'"]])await store.query(`DELETE FROM ${table} WHERE ${condition}`).catch(()=>{});},6*3600000);retention.unref();
 async function handle(req,res,u){if(req.method==='GET'&&files[u.pathname]){res.writeHead(200,{'content-type':'text/javascript','cache-control':'no-store'});res.end(await fs.readFile(path.join(root,'work',files[u.pathname])));return true;}
 if(u.pathname==='/api/intelligence-quality'&&req.method==='GET'){res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify({...await quality.snapshot(),database:store.status().state,evidenceQueue:evidence.status(),coordination:coordination?.status()||{configured:false,connected:false},capabilities:Registry.actions,streamSchema:Stream.version}));return true;}
 for(const api of [personal,evidence,inbox,community,accounting])if(await api.handle(req,res,u))return true;return false;}
 return {handle,personal,repository,evidence,inbox,community,accounting,quality,stop(){evidence.stop();clearInterval(retention);}};
}
