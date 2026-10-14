import {randomBytes} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {SiweMessage} from 'siwe';
import {getAddress} from 'ethers';
import {AXO} from './axo-identity.mjs';
import {ACCESS_TIERS, classifyBalanceUnits} from './axo-access.mjs';
import {isAxoOrigin,isSecureAxoRequest} from './axo-request-origin.mjs';
import {HOLDER_LIMITS} from './axo-tier-limits.mjs';
export {HOLDER_LIMITS} from './axo-tier-limits.mjs';
const CHALLENGE_MS = 5 * 60000, SESSION_MS = 2 * 3600000, BALANCE_MS = 60000;
const fail = (code, message, status = 403) => Object.assign(Error(message), {code, status});
const cookieName = 'axo-holder-session';
const cookieValue = req => String(req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
const required = new Map([
  ['/api/ai/ask', 'ask'], ['/api/ai/intent', 'ask'], ['/api/ai/voice', 'voice'],
  ['/api/research-card', 'customCards'], ['/api/discovery/control', 'ask'],
  ['/api/social', 'ask'], ['/api/tracked-projects', 'projectMonitoring']
]);

export function createHolderAuth({readHoldings, now = Date.now, usagePath = null} = {}) {
  const challenges = new Map(), sessions = new Map(), balances = new Map(), reads = new Map(), attempts = new Map();
  let ledger = {}, loaded = null, writes = Promise.resolve();
  const day = () => new Date(now()).toISOString().slice(0, 10);
  const send = (res, status, body) => {res.writeHead(status, {'content-type':'application/json', 'cache-control':'no-store', 'x-content-type-options':'nosniff'});res.end(JSON.stringify(body));};
  const setCookie = (req, res, value, age) => res.setHeader('Set-Cookie', cookieName + '=' + value + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=' + age + (isSecureAxoRequest(req) ? '; Secure' : ''));
  function prune() {
    for (const [id, v] of challenges) if (v.expiresAt <= now()) challenges.delete(id);
    for (const [id, v] of sessions) if (v.expiresAt <= now()) sessions.delete(id);
    for (const [id, v] of attempts) if (v.start < now() - 60000) attempts.delete(id);
  }
  function rate(req) {
    prune(); const key = req.socket?.remoteAddress || 'local', old = attempts.get(key);
    const v = old && old.start > now() - 60000 ? old : {start: now(), count: 0};
    if (++v.count > 20 || (!old && attempts.size >= 2000)) throw fail('auth_rate_limit', 'Too many sign-in attempts. Please wait a minute.', 429);
    attempts.set(key, v);
  }
  async function load() {
    if (!loaded) loaded = (async () => {
      if (!usagePath) return;
      try {const value = JSON.parse(await fs.readFile(usagePath, 'utf8')); if (!value || value.version !== 1 || !value.accounts || typeof value.accounts !== 'object' || Array.isArray(value.accounts) || Object.keys(value.accounts).length > 2000 || Object.entries(value.accounts).some(([k,v]) => !/^0x[a-f0-9]{40}:\d{4}-\d{2}-\d{2}$/.test(k) || !v || !['aiRequests','voiceSeconds'].every(n => Number.isSafeInteger(v[n]) && v[n]>=0 && v[n]<=1e9))) throw Error(); ledger = value.accounts;}
      catch(e) {if (e.code !== 'ENOENT') throw fail('usage_unavailable', 'Access accounting is unavailable. Please retry later.', 503);}
    })();
    return loaded;
  }
  async function save() {
    if (!usagePath) return;
    const data = JSON.stringify({version:1, accounts:ledger});
    const write = writes.catch(() => {}).then(async () => {await fs.mkdir(path.dirname(usagePath), {recursive:true}); const tmp = usagePath + '.tmp'; await fs.writeFile(tmp, data, {mode:0o600}); await fs.rename(tmp, usagePath);});
    writes = write;
    try {await write;} catch {throw fail('usage_unavailable', 'Access accounting could not be saved. No AI request was started.', 503);}
  }
  function session(req) {
    prune(); const id = cookieValue(req), value = sessions.get(id);
    if (!value) throw fail('wallet_sign_in_required', 'Connect an EVM wallet and verify ownership to use Ask Axo.', 401);
    return {id, ...value};
  }
  async function balance(address, {fresh = false} = {}) {
    if (fresh) {
      balances.delete(address);
      if (reads.has(address)) {try {await reads.get(address);} catch {} balances.delete(address);}
    }
    const previous = balances.get(address);
    if (previous && now() - previous.checkedAt < BALANCE_MS) return previous;
    if (reads.has(address)) return reads.get(address);
    const pending = (async () => {
      let value; try {value = await readHoldings(address);} catch {balances.delete(address); throw fail('holdings_unavailable', 'Your AXO balance could not be verified. Please retry.', 503);}
      if (value.wallet?.toLowerCase() !== address || value.chainId !== AXO.chainId || value.token?.toLowerCase() !== AXO.address || value.decimals !== 18 || !Number.isFinite(value.blockAt) || now() - value.blockAt > 120000 || value.blockAt > now() + 30000 || typeof value.rawBalance !== 'string') throw fail('holdings_unavailable', 'The AXO balance source could not be verified.', 503);
      const result = {...value, tier:classifyBalanceUnits(value.rawBalance), checkedAt:now()};
      balances.set(address, result); if (balances.size > 2000) balances.delete(balances.keys().next().value); return result;
    })(); reads.set(address, pending); try {return await pending;} finally {reads.delete(address);}
  }
  async function access(req, feature = null, fresh = false) {
    const s = session(req), b = await balance(s.address, {fresh}), limits = HOLDER_LIMITS[b.tier.id];
    if (!sessions.has(s.id)) throw fail('wallet_sign_in_required', 'Your wallet session ended. Sign in again.', 401);
    if (feature && b.tier.id === 'public') throw fail('axo_holding_required', 'Ask Axo requires at least 1,000,000 AXO in your verified wallet. Public browsing remains available.');
    if (['customCards','projectMonitoring'].includes(feature) && !limits[feature]) throw fail('axo_tier_required', 'This feature requires the Improved tier: at least 2,500,000 AXO.');
    return {s, b, limits};
  }
  function usage(address) {
    const key = address + ':' + day();
    for (const k of Object.keys(ledger)) if (!k.endsWith(':' + day())) delete ledger[k];
    if (!ledger[key] && Object.keys(ledger).length >= 2000) throw fail('usage_capacity','Access accounting is at capacity. Please retry later.',503);
    return ledger[key] ||= {aiRequests:0, voiceSeconds:0};
  }
  async function view(req, fresh = false) {
    await load(); let a;
    try {a = await access(req, null, fresh);} catch(e) {if (e.status === 401) return {authenticated:false, tier:ACCESS_TIERS[0], limits:HOLDER_LIMITS.public, features:{ask:false,voice:false,customCards:false,projectMonitoring:false}, reason:e.code}; throw e;}
    const used = usage(a.s.address);
    return {authenticated:true, wallet:a.s.address, expiresAt:a.s.expiresAt, tier:a.b.tier, balance:a.b.amount, checkedAt:a.b.checkedAt, block:a.b.block, limits:a.limits, remaining:{aiRequests:Math.max(0,a.limits.aiRequests-used.aiRequests),voiceSeconds:a.limits.voiceSeconds===null?null:Math.max(0,a.limits.voiceSeconds-used.voiceSeconds)}, resetAt:Date.parse(day()+'T00:00:00Z')+86400000, features:{ask:a.b.tier.id!=='public',voice:a.b.tier.id!=='public',customCards:a.limits.customCards,projectMonitoring:a.limits.projectMonitoring}};
  }
  async function handle(req, res, url) {
    if (!['/api/auth/challenge','/api/auth/verify','/api/auth/logout','/api/auth/status'].includes(url.pathname)) return false;
    try {
      if (url.pathname === '/api/auth/status' && req.method === 'GET') {send(res,200,await view(req));return true;}
      if (req.method !== 'POST' || !isAxoOrigin(req) || req.headers['x-axo-request'] !== '1' || !(req.headers['content-type'] || '').startsWith('application/json')) throw fail('auth_origin', 'Use the Axo dashboard to sign in.');
      rate(req); let raw='', size=0; for await(const c of req) {size+=Buffer.byteLength(c); if(size>6000) throw fail('request_too_large','Sign-in request is too large.',413); raw+=c;} let body; try {body=JSON.parse(raw);} catch {throw fail('invalid_json','Invalid sign-in request.',400);}
      if (url.pathname === '/api/auth/logout') {sessions.delete(cookieValue(req)); challenges.delete(cookieValue(req)); setCookie(req,res,'',0);send(res,200,{authenticated:false});return true;}
      if (url.pathname === '/api/auth/challenge') {
        let address; try {address=getAddress(body.address);} catch {throw fail('invalid_wallet','Connect a valid EVM wallet.',400);}
        if (![1,56,8453,4663,5042].includes(body.chainId)) throw fail('unsupported_sign_in_chain','Sign in with your EVM wallet on a supported chain.',400);
        if (challenges.size >= 1000) throw fail('auth_busy','Wallet sign-in is busy. Please retry.',503);
        const id=randomBytes(32).toString('hex'), origin=req.headers.origin, nonce=randomBytes(16).toString('hex'), expiresAt=now()+CHALLENGE_MS;
        const message=new SiweMessage({domain:new URL(origin).host,address,statement:'Sign in to Axo. This proves wallet ownership; it does not authorize transactions or token approvals.',uri:origin,version:'1',chainId:body.chainId,nonce,issuedAt:new Date(now()).toISOString(),expirationTime:new Date(expiresAt).toISOString()}).prepareMessage();
        challenges.delete(cookieValue(req)); challenges.set(id,{message,address:address.toLowerCase(),origin,nonce,expiresAt}); setCookie(req,res,id,CHALLENGE_MS/1000);send(res,200,{message,expiresAt});return true;
      }
      const id=cookieValue(req), challenge=challenges.get(id); challenges.delete(id);
      if (!challenge || challenge.expiresAt<=now() || challenge.origin!==req.headers.origin || body.message!==challenge.message || !/^0x[0-9a-f]{130}$/i.test(body.signature || '')) throw fail('invalid_sign_in','Wallet verification expired or did not match. Try signing in again.',401);
      try {const check=await new SiweMessage(body.message).verify({signature:body.signature,nonce:challenge.nonce,domain:new URL(challenge.origin).host,time:new Date(now()).toISOString()}); if(!check.success) throw Error();}
      catch {throw fail('invalid_signature','Wallet ownership could not be verified. Standard EVM message signing is required.',401);}
      if (sessions.size>=1000) throw fail('auth_busy','Wallet sign-in is busy. Please retry.',503);
      // Rotate the challenge cookie into a separate, random authenticated session.
      const token=randomBytes(32).toString('hex');sessions.delete(id);sessions.set(token,{address:challenge.address,expiresAt:now()+SESSION_MS});
      setCookie(req,res,token,SESSION_MS/1000);const request={...req,headers:{...req.headers,cookie:cookieName+'='+token}};send(res,200,await view(request,true));
    } catch(e) {send(res,e.status||503,{error:e.status?e.message:'Wallet authentication is unavailable.',code:e.code||'auth_unavailable'});}
    return true;
  }
  async function guard(req,res,url) {
    const feature=req.method==='POST'?required.get(url.pathname):null;
    if (!feature) return true;
    try {
      if (!isAxoOrigin(req) || req.headers['x-axo-request']!=='1') throw fail('auth_origin','Use the Axo dashboard to request this feature.');
      const a=await access(req,feature); await load(); const used=usage(a.s.address);
      const voiceSeconds=feature==='voice'?(a.limits.voiceSeconds===null?null:Math.min(300,a.limits.voiceSeconds-used.voiceSeconds)):0;
      const aiRequests=['/api/ai/ask','/api/ai/intent','/api/research-card','/api/social'].includes(url.pathname)?1:0;
      if (feature==='voice' && voiceSeconds!==null && voiceSeconds<=0 || aiRequests && used.aiRequests>=a.limits.aiRequests) throw fail('tier_daily_limit','Your tier’s daily allowance is used. Check My Utility for the reset time.',429);
      used.aiRequests+=aiRequests;used.voiceSeconds+=voiceSeconds||0;await save();
      let refundable=voiceSeconds||0;
      const refund=async seconds=>{const amount=Math.min(refundable,Math.max(0,Math.floor(seconds)));refundable-=amount;used.voiceSeconds=Math.max(0,used.voiceSeconds-amount);await save();};
      req.axoHolder={...a,voiceSeconds,check:()=>access({headers:{cookie:cookieName+'='+a.s.id}},'voice'),refund};
      // AI attempts remain metered even if planning/validation fails; a rejected plan can consume compute.
      res.once('finish',()=>{if(res.statusCode>=400&&voiceSeconds)void refund(voiceSeconds).catch(()=>{});});
      return true;
    } catch(e) {send(res,e.status||503,{error:e.message,code:e.code||'holder_access_unavailable'});return false;}
  }
  async function checkFeature(req,feature) {return access(req,feature);}
  async function checkWalletFeature(address,feature){if(!/^0x[a-f0-9]{40}$/.test(address||''))return false;const b=await balance(address);return HOLDER_LIMITS[b.tier.id][feature]===true;}
  return {handle,guard,view,checkFeature,checkWalletFeature,verifiedSession:session};
}
