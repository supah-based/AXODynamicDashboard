/* Exact identities only. A direct route is not proof of indexing or executable liquidity. */
(function(root){
 const routes={ethereum:'ethereum',base:'base',bsc:'bnb',solana:'solana',robinhood:'robinhood',arc:'arc'};
 function project(p={}){
  const chain=p.chain,sol=chain==='solana',address=p.address,pool=p.pair||p.pool,validToken=Object.hasOwn(routes,chain)&&typeof address==='string'&&(sol?/^[1-9A-HJ-NP-Za-km-z]{32,44}$/:/^0x[a-fA-F0-9]{40}$/).test(address),validPool=validToken&&typeof pool==='string'&&(sol?/^[1-9A-HJ-NP-Za-km-z]{32,44}$/:/^0x(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/).test(pool);
  const gmgnChain={ethereum:'eth',base:'base',bsc:'bsc',solana:'sol',robinhood:'robinhood',arc:'arc'};
  return {gmgn:validToken?'https://gmgn.ai/'+gmgnChain[chain]+'/token/'+address:null,dex:validPool?'https://dexscreener.com/'+chain+'/'+pool:null,dexExact:!!validPool,matcha:validToken?'https://matcha.xyz/swap/'+routes[chain]+'/'+address:null,matchaExact:!!validToken};
 }
 const api={project};root.AxoProjectLinks=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
