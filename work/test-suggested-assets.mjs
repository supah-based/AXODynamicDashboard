import assert from 'node:assert/strict';
import Assets from './axo-stablecoins.cjs';
import {publicRibbon} from './axo-public-ribbon.mjs';
import {screenProjects} from './axo-project-screens.mjs';
const now=Date.now(),p={chain:'base',address:'0x'+ '4'.repeat(40),pair:'0x'+'5'.repeat(40),name:'USDC',symbol:'USDC',seenAt:now,liquidity:200000,volume24:50000};
for(const [chain,types]of Object.entries(Assets.canonical))for(const [kind,addresses]of Object.entries(types))for(const address of addresses){const q={...p,chain,address,name:'Unknown renamed token',symbol:'UNKNOWN'};assert.equal(Assets.isSuggestedProject(q),false,chain+':'+kind);if(chain!=='solana')assert.equal(Assets.isSuggestedProject({...q,address:address.toUpperCase().replace('0X','0x')}),false);}
assert.equal(Assets.isSuggestedProject(p),true,'Same display name on another contract is not authenticated as a stablecoin');
assert.equal(Assets.isSuggestedProject({...p,name:'Wrapped Ether',symbol:'WETH',coingeckoId:'wrapped-ether'}),true);
assert.equal(Assets.isSuggestedProject({...p,address:Assets.canonical.ethereum.wrapped[0],chain:'base'}),true,'Wrong-chain contract is not native');
assert.equal(Assets.isSuggestedProject({...p,quote:'USDC',name:'Research project',symbol:'LAB',price:1}),true);
assert.equal(Assets.isStablecoin({...p,credibleListing:{chain:'base',address:p.address,coinId:'usd-coin'}}),true);
assert.equal(Assets.isStablecoin({...p,credibleListing:{chain:'bsc',address:p.address,coinId:'usd-coin'}}),false);
assert.equal(Assets.isSuggestedProject({...p,chain:'solana',address:Assets.canonical.solana.wrapped[0].toLowerCase()}),true,'Solana mint identity is case-sensitive');
for(const address of ['0x'+'0'.repeat(40),'0x'+'e'.repeat(40)])assert.equal(Assets.isNative({...p,address}),true);
const rows=[p,...Assets.canonical.base.stable.map(address=>({...p,address})),...Assets.canonical.base.wrapped.map(address=>({...p,address}))];assert.equal(publicRibbon({pools:rows,now}).projects.length,1);assert.equal(screenProjects(rows,'degen',{now}).length,1);
console.log('PASS opportunity asset policy: canonical chain/address identities, wrapped/native/stable exclusion, case-sensitive Solana, wrong-chain and display-name lookalikes preserved, quote assets preserved. Explicit portfolio/funding routes do not use this opportunity predicate.');
