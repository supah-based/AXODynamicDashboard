export const BLUECHIP_CEILING_POLICY='paper-bluechip-ceiling-v1';
export const BLUECHIP_MARKET_CAP_CEILING=1000000000000;
const validAt=at=>Number.isFinite(at)&&at>0&&at<=8640000000000000;
const considered=state=>Boolean(state.policyMigrations?.[BLUECHIP_CEILING_POLICY]);

// The user authorized this one configuration expansion for existing paper runs.
// The marker belongs to this installation's journal, not to an individual run.
export function marketCapPolicyUpgrade(state){
 const cap=state.config?.maxMarketCap;
 if(!state.runId||state.config?.engine!=='strategies'||considered(state)||!Number.isFinite(cap)||cap<=0||cap>BLUECHIP_MARKET_CAP_CEILING)return null;
 return {id:BLUECHIP_CEILING_POLICY,runId:state.runId,previousMaxMarketCap:cap,config:{maxMarketCap:BLUECHIP_MARKET_CAP_CEILING},source:'User-authorized paper-only blue-chip ceiling expansion; all other operator controls and existing entry plans are preserved.'};
}

// Apply only the recognized narrow journal event. Pending events cannot cross a
// reset or overwrite a ceiling deliberately edited after the event was planned.
export function applyPaperPolicyUpgrade(state,data,at){
 if(!data||data.id!==BLUECHIP_CEILING_POLICY||!validAt(at)||!state.runId||data.runId!==state.runId||state.config?.engine!=='strategies'||considered(state)||!data.config||Object.keys(data.config).length!==1||data.config.maxMarketCap!==BLUECHIP_MARKET_CAP_CEILING||!Number.isFinite(data.previousMaxMarketCap)||data.previousMaxMarketCap<=0||data.previousMaxMarketCap>BLUECHIP_MARKET_CAP_CEILING||state.config.maxMarketCap!==data.previousMaxMarketCap)return false;
 state.config={...state.config,maxMarketCap:BLUECHIP_MARKET_CAP_CEILING};
 state.policyMigrations={...state.policyMigrations,[BLUECHIP_CEILING_POLICY]:{status:'applied',at,runId:state.runId,previousMaxMarketCap:data.previousMaxMarketCap,maxMarketCap:BLUECHIP_MARKET_CAP_CEILING}};
 return true;
}

// New release-created runs carry this explicit acknowledgement in start/reset
// event payloads. Older journal events omit it and therefore still migrate once.
export function acknowledgePaperPolicies(state,ids,at){
 if(!state.runId||!validAt(at)||!Array.isArray(ids)||!ids.includes(BLUECHIP_CEILING_POLICY)||considered(state))return false;
 state.policyMigrations={...state.policyMigrations,[BLUECHIP_CEILING_POLICY]:{status:'considered-at-run-creation',at,runId:state.runId}};
 return true;
}
