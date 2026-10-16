import Stream from './axo-stream-schema.cjs';
import Assets from './axo-stablecoins.cjs';
import MarketIntel from './axo-market-intel.cjs';

export const PAPER_CHAINS = Object.freeze(['solana', 'base', 'bsc', 'robinhood', 'arc']);
export const PAPER_CATEGORIES = Object.freeze(['degen', 'swing', 'bluechip']);
const DAY = 86400000, MARKET_TTL = 300000, LISTING_TTL = 900000;
const finite = Number.isFinite;
const recent = (at, now, ttl) => finite(at) && at > 0 && at <= now && now - at <= ttl;
const bounded = (value, low, high) => Math.min(high, Math.max(low, value));
const positive = value => finite(value) && value > 0;
const exact = (p, pool = true) => { try { return Stream.exact(p, pool); } catch { return null; } };
const tokenKey = p => { const id = exact(p, false); return id ? id.chain + ':' + id.address : null; };
const poolKey = p => { const id = exact(p); return id ? id.chain + ':' + id.address + ':' + id.pool : null; };
const text = value => typeof value === 'string' && value.trim() ? value.trim().slice(0,200) : null;

// Categories describe sourced identity/age evidence. They do not imply safety or a return forecast.
export function classifyOpportunity(p, now = Date.now()) {
 const unknown = reason => ({category:null, reason, basis:null, at:null, source:null});
 if (!p || !PAPER_CHAINS.includes(p.chain) || !exact(p, false)) return unknown('Exact project identity on a supported paper chain required');
 if (!Assets.isSuggestedProject(p)) return unknown('Stablecoins and native or wrapped chain assets are excluded');
 const c = p.credibleListing, listed = c && exact(c, false);
 if (listed && tokenKey(c) === tokenKey(p) && text(c.coinId) && Number.isInteger(c.rank) && c.rank > 0 && c.rank <= 100 && finite(c.marketCap) && c.marketCap >= 1e9 && recent(c.at,now,LISTING_TTL)) {
  return {category:'bluechip', reason:'Exact listed contract · provider rank ' + c.rank + ' · circulating market cap at least $1B', basis:'exact listed contract and current provider rank', at:c.at, source:text(c.source) || 'CoinGecko exact-contract listing'};
 }
 const tokenAt = p.tokenCreatedAt, tokenSource = text(p.tokenAgeSource);
 if (positive(tokenAt) && tokenAt <= now && tokenSource && now - tokenAt > 7 * DAY) {
  return {category:'swing', reason:'Source-reported token or project genesis is more than seven days old', basis:'source-reported token or project genesis', at:tokenAt, source:tokenSource};
 }
 if (finite(tokenAt) && tokenAt > now) return unknown('Token genesis is future-dated; resolve age evidence');
 const poolAt = p.createdAt;
 if (positive(poolAt) && poolAt <= now && now - poolAt <= 7 * DAY) {
  return {category:'degen', reason:'Exact pool is at most seven days old; this does not establish the token launch date', basis:'exact pool creation only', at:poolAt, source:text(p.poolAgeSource) || text(p.provider) || text(p.url) || 'Source-reported pool creation'};
 }
 return unknown('Category age or exact current blue-chip listing is not established; old pools alone do not prove token genesis');
}

function marketGaps(p, now) {
 const gaps = [];
 if (!recent(p.seenAt, now, MARKET_TTL) || p.observationStatus === 'stale') gaps.push('Fresh exact-pool market observation required');
 if (p.curve) gaps.push('Bonding-curve execution is not covered by this pool simulation');
 if (!positive(p.price)) gaps.push('Positive observed USD price required');
 if (!positive(p.marketCap)) gaps.push('Actual circulating market cap required; FDV is not substituted');
 if (!positive(p.liquidity)) gaps.push('Positive observed pool liquidity required');
 try {
  if (MarketIntel.integrity(p).issues.length) gaps.push('Market activity windows are inconsistent');
  if (MarketIntel.quality(p,now).status === 'conflict') gaps.push('Fresh same-pool provider prices disagree');
 } catch { gaps.push('Market evidence is malformed'); }
 return gaps;
}

/** Fresh public candidates only. Coverage counts unique chain/token identities, not pools. */
export function buildOpportunityUniverse(pools, {now = Date.now(), held = []} = {}) {
 const coverage = PAPER_CHAINS.flatMap(chain => PAPER_CATEGORIES.map(category => ({chain,category,observed:0,usable:0,held:0,waiting:0})));
 const unclassified = PAPER_CHAINS.map(chain => ({chain,observed:0}));
 const counts = {input:0, invalidIdentity:0, unsupportedChain:0, excludedAsset:0, duplicatePools:0, stale:0, invalidMarket:0, held:0, unclassified:0, usable:0};
 const heldKeys = new Set((Array.isArray(held) ? held : Object.values(held || {})).map(p => {
  if (typeof p === 'string') { const [chain,address] = p.split(':'); return tokenKey({chain,address}); }
  return tokenKey(p?.identity || p);
 }).filter(Boolean));
 const latest = new Map();
 for (const p of Array.isArray(pools) ? pools : []) {
  counts.input++;
  if (!p || !PAPER_CHAINS.includes(p.chain)) { counts.unsupportedChain++; continue; }
  const k = poolKey(p);
  if (!k) { counts.invalidIdentity++; continue; }
  if (!Assets.isSuggestedProject(p)) { counts.excludedAsset++; continue; }
  const prior = latest.get(k);
  if (prior) counts.duplicatePools++;
  // A newer incomplete observation must never revive an older usable quote for the same pool.
  if (!prior || (finite(p.seenAt) ? p.seenAt : -1) > (finite(prior.seenAt) ? prior.seenAt : -1) || p.seenAt === prior.seenAt && (p.liquidity || 0) > (prior.liquidity || 0)) latest.set(k,p);
 }
 const tokens = new Map();
 for (const p of latest.values()) {
  const k = tokenKey(p);
  if (!tokens.has(k)) tokens.set(k,[]);
  tokens.get(k).push({p,classification:classifyOpportunity(p,now),gaps:marketGaps(p,now)});
 }
 const rows = [];
 for (const [k,candidates] of tokens) {
  candidates.sort((a,b) => (positive(b.p.liquidity) ? b.p.liquidity : -1) - (positive(a.p.liquidity) ? a.p.liquidity : -1) || (b.p.seenAt || 0) - (a.p.seenAt || 0) || poolKey(a.p).localeCompare(poolKey(b.p)));
  const chosen = candidates.find(c => !c.gaps.length) || candidates[0];
  const {gaps} = chosen;
  // Contract listing and token genesis are token facts. Carry those facts between exact-token
  // pools without combining prices, volume or liquidity from different market observations.
  const tokenEvidence = candidates.find(c => c.classification.category === 'bluechip') || candidates.find(c => c.classification.category === 'swing');
  const classification = tokenEvidence?.classification || chosen.classification;
  const p = tokenEvidence?.classification.category === 'bluechip' ? {...chosen.p,credibleListing:tokenEvidence.p.credibleListing} : tokenEvidence?.classification.category === 'swing' ? {...chosen.p,tokenCreatedAt:tokenEvidence.p.tokenCreatedAt,tokenAgeSource:tokenEvidence.p.tokenAgeSource} : chosen.p;
  const category = classification.category, cell = coverage.find(c => c.chain === p.chain && c.category === category);
  if (cell) cell.observed++;
  else { unclassified.find(c => c.chain === p.chain).observed++; counts.unclassified++; }
  if (heldKeys.has(k)) { counts.held++; if (cell) cell.held++; continue; }
  if (gaps.length) {
   if (!recent(p.seenAt,now,MARKET_TTL) || p.observationStatus === 'stale') counts.stale++;
   else counts.invalidMarket++;
   if (cell) cell.waiting++;
   continue;
  }
  if (!category) continue;
  const identity = exact(p);
  rows.push({...p,...identity,pair:identity.pool,category,categoryEvidence:classification});
  cell.usable++; counts.usable++;
 }
 rows.sort((a,b) => PAPER_CHAINS.indexOf(a.chain) - PAPER_CHAINS.indexOf(b.chain) || PAPER_CATEGORIES.indexOf(a.category) - PAPER_CATEGORIES.indexOf(b.category) || tokenKey(a).localeCompare(tokenKey(b)));
 const gaps = [];
 if (counts.unclassified) gaps.push(counts.unclassified + ' sampled projects have no supported category age or listing evidence');
 if (counts.stale) gaps.push(counts.stale + ' sampled projects lack a current five-minute market observation');
 if (counts.invalidMarket) gaps.push(counts.invalidMarket + ' sampled projects have incomplete or conflicting market facts');
 if (counts.invalidIdentity) gaps.push(counts.invalidIdentity + ' observations lack an exact chain, token and pool identity');
 return {rows,coverage,unclassified,gaps,counts};
}

/** A bounded evidence-strength ranking, never a calibrated probability of profit. */
export function rankOpportunity(p, setup, config = {}, now = Date.now()) {
 const classification = classifyOpportunity(p,now), gaps = [...marketGaps(p || {},now)];
 if (!classification.category) gaps.push(classification.reason);
 if (!setup?.eligible) gaps.push(...(setup?.gaps?.length ? setup.gaps : ['Configured technical and execution entry checks have not passed']));
 if (!recent(setup?.at,now,MARKET_TTL)) gaps.push('Current setup evidence required');
 if (!setup?.identity || poolKey(setup.identity) !== poolKey(p)) gaps.push('Setup identity must match this exact chain, token and pool');
 const t = setup?.technical, extension = setup?.entry?.currentExtensionPct;
 if (t?.status !== 'available' || !recent(t.at,now,7200000) || !positive(t.atrPct) || !finite(t.volumeAcceleration) || t.volumeAcceleration < 0 || !finite(t.rsi14) || t.rsi14 < 0 || t.rsi14 > 100 || !finite(extension)) gaps.push('Dated usable closed-bar technical measurements required for ranking');
 if (gaps.length) return {score:0,evidenceStrength:'unavailable',label:'Waiting for evidence',category:classification.category,categoryEvidence:classification,eligible:false,reason:gaps[0],reasons:[],gaps:[...new Set(gaps)],components:{}};
 const minLiquidity = positive(config.minLiquidity) ? config.minLiquidity : 100000;
 const maxExtension = positive(config.maxExtensionPct) ? config.maxExtensionPct : 12;
 const minAcceleration = positive(config.minVolumeAcceleration) ? config.minVolumeAcceleration : 1.3;
 const liquidity = 10 + bounded(Math.log2(Math.max(1,p.liquidity/minLiquidity)),0,3) * 5;
 const timing = bounded(1 - Math.max(0,extension)/maxExtension,0,1) * 20;
 const volatility = bounded(1 - t.atrPct/20,0,1) * 15;
 const acceleration = bounded(t.volumeAcceleration/minAcceleration - .5,0,1) * 10;
 const rsiBalance = bounded(1 - Math.abs(t.rsi14 - 55)/25,0,1) * 10;
 const venue = bounded((finite(setup.priority) ? setup.priority : 1) - 1,0,.5) * 10;
 const components = {passedChecks:15,liquidity,timing,volatility,acceleration,rsiBalance,venue};
 const score = Math.round(bounded(Object.values(components).reduce((sum,n) => sum+n,0),0,100));
 const evidenceStrength = score >= 75 ? 'strong' : score >= 55 ? 'moderate' : 'limited';
 const reasons = [classification.reason,'Fresh risk, execution and closed-bar entry checks passed','Pool liquidity ' + (p.liquidity/minLiquidity).toFixed(1) + '× the configured minimum','Current EMA extension ' + extension.toFixed(1) + '% · ATR ' + t.atrPct.toFixed(1) + '%','Closed-bar volume acceleration ' + t.volumeAcceleration.toFixed(2) + '×'];
 if (venue > 0) reasons.push('Observed venue activity adds at most five ranking points');
 return {score,evidenceStrength,label:evidenceStrength[0].toUpperCase()+evidenceStrength.slice(1)+' evidence',category:classification.category,categoryEvidence:classification,eligible:true,reason:'Relative evidence strength within the sampled universe; not a win probability or expected return',reasons,gaps:[],components};
}

/** One candidate per nonempty chain/category cell before a second candidate from any cell. */
export function fairResearchCandidates(pools, {now = Date.now(), limit = 15, held = []} = {}) {
 const universe = buildOpportunityUniverse(pools,{now,held}), cap = Number.isInteger(limit) ? bounded(limit,0,120) : 15;
 const priority = p => (positive(p.volume1) ? Math.log10(1+p.volume1) : 0) + (positive(p.liquidity) ? Math.log10(1+p.liquidity) * .25 : 0);
 const cells = PAPER_CATEGORIES.flatMap(category => PAPER_CHAINS.map(chain => universe.rows.filter(p => p.chain === chain && p.category === category).sort((a,b) => priority(b)-priority(a) || tokenKey(a).localeCompare(tokenKey(b)))));
 // Rotate both category and chain exploration over time; low limits do not starve the last cells.
 const offset = Math.floor(now/60000) % cells.length, ordered = [...cells.slice(offset),...cells.slice(0,offset)], rows = [];
 while (rows.length < cap && ordered.some(cell => cell.length)) for (const cell of ordered) { if (cell.length && rows.length < cap) rows.push(cell.shift()); }
 return {...universe,rows,selected:rows.length};
}
