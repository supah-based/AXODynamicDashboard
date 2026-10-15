import assert from 'node:assert/strict';
import Links from './axo-project-links.cjs';
const token='0x'+'1'.repeat(40),pool='0x'+'2'.repeat(64);
for(const chain of ['base','ethereum','bsc','robinhood','arc']){const links=Links.project({chain,address:token,pool,url:'https://evil.example/home'});assert.equal(links.dex,'https://dexscreener.com/'+chain+'/'+pool);assert.equal(links.matcha,'https://matcha.xyz/swap/'+(chain==='bsc'?'bnb':chain)+'/'+token);assert.equal(new URL(links.matcha).search,'','No amount, approval or trade execution parameters');}
const sol='So11111111111111111111111111111111111111112',solPool='A'.repeat(44);assert.equal(Links.project({chain:'solana',address:sol,pair:solPool}).matcha,'https://matcha.xyz/swap/solana/'+sol);assert.equal(Links.project({chain:'base',address:token,pair:'bad'}).dex,null);for(const p of [{chain:'unknown',address:token,pair:pool},{chain:'base',address:token+'?recipient=other',pair:pool},{chain:'solana',address:'0'.repeat(44),pair:solPool}])assert.deepEqual(Links.project(p),{gmgn:null,dex:null,dexExact:false,matcha:null,matchaExact:false});
console.log('PASS direct external routes: exact chain/token/pool, pair and pool identities, BNB slug, Solana case preserved, six chains, invalid identity rejected, no generic-homepage or execution parameters.');

for(const chain of ['ethereum','base','bsc','solana','robinhood','arc']){const address=chain==='solana'?sol:token;assert.equal(Links.project({chain,address}).gmgn,'https://gmgn.ai/'+({ethereum:'eth',solana:'sol'}[chain]||chain)+'/token/'+address);}
