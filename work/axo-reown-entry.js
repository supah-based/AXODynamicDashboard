import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { mainnet, base, bsc, defineChain } from '@reown/appkit/networks';

const robinhood=defineChain({id:4663,caipNetworkId:'eip155:4663',chainNamespace:'eip155',name:'Robinhood Chain',nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18},rpcUrls:{default:{http:['https://rpc.mainnet.chain.robinhood.com']}}});
const arc=defineChain({id:5042,caipNetworkId:'eip155:5042',chainNamespace:'eip155',name:'Arc',nativeCurrency:{name:'USDC',symbol:'USDC',decimals:6},rpcUrls:{default:{http:['https://rpc.arc-scan.org']}}});
let creating=null,kit=null;
const listeners=new Set();
function hasPersistedSession(){try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i)||'';if(key==='@appkit/eip155:connected_connector_id'||key.startsWith('wc@2:client:')&&key.includes('//session'))return true}}catch{}return false}
async function init(){if(kit)return kit;if(creating)return creating;creating=(async()=>{const r=await fetch('/api/wallet-config',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('Wallet configuration unavailable');const cfg=await r.json(),projectId=cfg?.reown?.projectId;if(!/^[a-f0-9]{32}$/i.test(projectId||''))throw Error('Reown unavailable');kit=createAppKit({adapters:[new EthersAdapter()],networks:[robinhood,mainnet,base,bsc,arc],defaultNetwork:robinhood,projectId,metadata:{name:'AXO Robinhood Intelligence',description:'AXO intelligence tools',url:location.origin,icons:[location.origin+'/axo-mark.svg']},features:{analytics:false,email:false,socials:[]},enableWalletGuide:true,themeMode:'dark',themeVariables:{'--w3m-accent':'#3cff91','--w3m-border-radius-master':'2px'}});return kit})();try{return await creating}catch(e){creating=null;throw e}}
function emit(){if(!kit)return;const a=kit.getAccount('eip155')||{},p=kit.getWalletProvider(),n=kit.getChainId();for(const fn of [...listeners])fn({account:a,provider:p,chainId:n,connected:Boolean(a.isConnected&&p?.request)});}
async function subscribe(fn){await init();listeners.add(fn);const unsubs=[kit.subscribeAccount(emit,'eip155'),kit.subscribeNetwork(emit),kit.subscribeState(emit)];emit();let active=true;return()=>{if(!active)return;active=false;listeners.delete(fn);for(const u of unsubs)if(typeof u==='function')u()}}
window.AxoReown={init,subscribe,hasPersistedSession,open:async view=>{await init();return kit.open({view:view||'Connect'})},disconnect:async()=>{await init();return kit.disconnect('eip155')},resync:()=>emit(),provider:()=>kit?.getWalletProvider()||null};
