import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {identity,safePayload} from './axo-durable-store.mjs';
const files=['axo-chain-snapshots.json','axo-discovery-state.json','axo-live-cache.json'];
export async function importPublicFile({store,file,readFile=fs.readFile,now=Date.now}){
 const name=path.basename(file);if(!files.includes(name))throw Error('Import filename not allowlisted');const raw=await readFile(file);if(raw.length>4_000_000)throw Error('Import file too large');const hash=createHash('sha256').update(raw).digest('hex');const previous=await store.query('SELECT sha256 FROM axo_cache_imports WHERE file_name=$1',[name]);if(previous.rows[0]?.sha256===hash)return {file:name,skipped:true,count:0};
 const d=JSON.parse(raw),rows=[];
 if(name==='axo-chain-snapshots.json'){
  for(const [chain,snapshot] of Object.entries(d.snapshots||{}))for(const p of (snapshot?.pools||[]).slice(0,150)){
   if(p.chain!==chain||!['available','live'].includes(p.observationStatus)||!Number.isSafeInteger(p.seenAt)||p.seenAt>now()||p.seenAt<now()-90*86400000)continue;
   try{const id=identity({chain,address:p.address,pool:p.pair}),data=safePayload({chain:id.chain,address:id.address,pool:id.pool,name:p.name||null,symbol:p.symbol||null,websites:(p.websites||[]).slice(0,5),socials:(p.socials||[]).slice(0,5),asOf:p.seenAt,status:'available',source:'imported exact-pool public market metadata'});rows.push({id,data,provider:'imported-public-snapshot',at:p.seenAt})}catch{}
  }
 }else if(name==='axo-live-cache.json'){
  for(const [feed,r] of Object.entries(d.feeds||{})){if(!/^(markets|sentiment|trending|launches|market-global|market-tvl|market-sectors|capital-(?:solana|base|bsc|robinhood|arc))$/.test(feed)||!r?.data||!Number.isSafeInteger(r.receivedAt)||r.receivedAt>now()||r.receivedAt<now()-7*86400000)continue;
   try{rows.push({sourceArchive:true,kind:feed,data:safePayload({feed,source:String(r.source||'').slice(0,120),receivedAt:r.receivedAt,data:r.data}),at:r.receivedAt})}catch{}
  }
 }else for(const [kind,r] of Object.entries(d.results||{})){
  if(!['market','solana','base','bsc','robinhood','arc','strategy-review'].includes(kind)||typeof r?.summary!=='string'||r.summary.length>1300||!Number.isSafeInteger(r.at)||r.at>now()||r.at<now()-7*86400000)continue;
  try{rows.push({research:true,kind,data:safePayload({kind,at:r.at,headline:r.headline,summary:r.summary,nextAction:r.nextAction,status:r.status,source:'imported historical research; not a fresh model response'}),at:r.at})}catch{}
 }
 const client=await store.pool.connect();try{await client.query('BEGIN');await client.query("SET LOCAL statement_timeout='5s'");for(const row of rows){if(row.sourceArchive)await client.query('INSERT INTO axo_source_cache(cache_key,provider,source,fetched_at,observed_at,expires_at,stale_until,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(cache_key) DO NOTHING',[createHash('sha256').update('historical:'+name+':'+row.kind+':'+hash).digest('hex'),'imported-public','historical',new Date(row.at),new Date(row.at),new Date(row.at+1),new Date(row.at+1),JSON.stringify(row.data)]);else if(row.research)await client.query('INSERT INTO axo_ai_cache(cache_key,provider,source,model,operation,fetched_at,observed_at,expires_at,stale_until,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(cache_key) DO NOTHING',[createHash('sha256').update('historical:'+name+':'+row.kind+':'+hash).digest('hex'),'imported-public','historical','historical','historical',new Date(row.at),new Date(row.at),new Date(row.at+1),new Date(row.at+1),JSON.stringify(row.data)]);else await client.query('INSERT INTO axo_projects(chain,address,pool,provider,observed_at,payload) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(chain,address,pool_key) DO UPDATE SET provider=excluded.provider,observed_at=excluded.observed_at,payload=excluded.payload,updated_at=now() WHERE axo_projects.observed_at<=excluded.observed_at',[row.id.chain,row.id.address,row.id.pool,row.provider,new Date(row.at),JSON.stringify(row.data)])}await client.query('INSERT INTO axo_cache_imports(file_name,sha256,row_count) VALUES($1,$2,$3) ON CONFLICT(file_name) DO UPDATE SET sha256=excluded.sha256,row_count=excluded.row_count,imported_at=now()',[name,hash,rows.length]);await client.query('COMMIT');return {file:name,skipped:false,count:rows.length}}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
export async function importPublicDirectory({store,dir='/var/lib/axo-streams'}={}){if(!store||!await store.ready())throw Error('Database migrations required');const result=[];for(const name of files){const file=path.join(dir,name);try{result.push(await importPublicFile({store,file}))}catch(e){if(e.code!=='ENOENT')throw e}}return result}
