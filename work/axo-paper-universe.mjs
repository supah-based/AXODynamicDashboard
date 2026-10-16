const norm=(chain,value)=>typeof value==='string'?(chain==='solana'?value:value.toLowerCase()):'';
export const exactPublicPoolKey=p=>p?.chain+':'+norm(p?.chain,p?.address)+':'+norm(p?.chain,p?.pair||p?.pool);
// Market windows stay atomic. Separately dated token identity facts can travel with a newer quote.
export function mergePaperPools(groups,now=Date.now()){
 const pools=new Map(),facts=new Map();
 for(const p of groups.flat()){
  if(!p||!p.address||!(p.pair||p.pool))continue;
  const token=p.chain+':'+norm(p.chain,p.address),key=exactPublicPoolKey(p),old=pools.get(key);
  if(!old||(Number.isFinite(p.seenAt)?p.seenAt:-1)>(Number.isFinite(old.seenAt)?old.seenAt:-1))pools.set(key,p);
  else if(p.seenAt===old.seenAt){
   const winner=old.observationStatus==='stale'&&p.observationStatus!=='stale'?p:old;
   const merged={...winner};
   if(old.curve||p.curve)merged.curve=old.curve||p.curve;
   if(old.activityIntegrity?.status==='inconsistent'||p.activityIntegrity?.status==='inconsistent')merged.activityIntegrity={status:'inconsistent'};
   if(old.providerObservations?.length||p.providerObservations?.length)merged.providerObservations=[...(old.providerObservations||[]),...(p.providerObservations||[])].slice(0,32);
   pools.set(key,merged);
  }
  const saved=facts.get(token)||{};
  const listing=p.credibleListing;
  if(listing?.chain===p.chain&&norm(p.chain,listing.address)===norm(p.chain,p.address)&&Number.isFinite(listing.at)&&listing.at>0&&listing.at<=now&&now-listing.at<=900000&&(!saved.credibleListing||listing.at>saved.credibleListing.at))saved.credibleListing=structuredClone(listing);
  if(Number.isFinite(p.tokenCreatedAt)&&p.tokenCreatedAt>0&&p.tokenCreatedAt<=now&&typeof p.tokenAgeSource==='string'&&p.tokenAgeSource.trim()){
   if(saved.tokenCreatedAt&&saved.tokenCreatedAt!==p.tokenCreatedAt)saved.ageConflict=true;
   saved.tokenCreatedAt=p.tokenCreatedAt;saved.tokenAgeSource=p.tokenAgeSource;
  }
  facts.set(token,saved);
 }
 return [...pools.values()].map(p=>{const f=facts.get(p.chain+':'+norm(p.chain,p.address));return {...p,pair:p.pair||p.pool,...(f?.credibleListing?{credibleListing:f.credibleListing}:{}),...(f?.ageConflict?{tokenCreatedAt:null,tokenAgeSource:null}:f?.tokenCreatedAt?{tokenCreatedAt:f.tokenCreatedAt,tokenAgeSource:f.tokenAgeSource}:{})};});
}
