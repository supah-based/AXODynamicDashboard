/* Heat calls use the native Hatchery ledger, not community-lab reviews. */
(()=>{
 const labels=['Ice cold','Frozen','Very cold','Cold','Cool','Neutral','Warm','Heating','Hot','Very hot','Red hot alpha'];
 let state=null,owner='',generation=0,loading=false,busy=false,notice='',receipts=new Map();
 const wallet=()=>typeof axoHolderMatches==='function'&&axoHolderMatches()?axoWallet.address.toLowerCase():'';
 const current=p=>state?.connected&&state.wallet===wallet()?state.projects?.find(v=>v.address===p.address.toLowerCase()):null;
 function markup(p){
  const row=current(p),receipt=receipts.get(p.address.toLowerCase()),done=row?.completed||!!receipt,score=receipt?.heatScore??row?.heatScore,enabled=!!row?.canVote&&!done&&!busy;
  const message=notice||(receipt?'Saved '+receipt.heatScore+'/10 · '+receipt.epochId+' · '+receipt.xpAwarded+' XP from Hatchery':done?'Your heat call is saved'+(score!=null?' · '+score+'/10':''):loading?'Checking your Hatchery access…':!wallet()?'Connect your wallet to make a heat call here.':!state?.connected?'Connect Hatchery once to use your existing Pet and passport.':row?.reason||'No current Hatchery review task for this project.');
  return '<section class="axo-hatchery-heat" data-hatchery-heat="'+esc(p.address.toLowerCase())+'" aria-label="Your Hatchery heat call"><div class="hh-heading"><b>Your heat call</b><span>Cold → hot · not safety</span></div><div class="hh-zones" role="group" aria-label="Choose project heat from 0 to 10">'+labels.map((label,n)=>'<button type="button" class="hh-zone" style="--heat:'+n+'" data-hatchery-score="'+n+'" data-hatchery-address="'+esc(p.address.toLowerCase())+'" aria-label="'+n+' of 10 · '+label+'" aria-pressed="'+(done&&score===n)+'" title="'+label+' · '+n+'/10" '+(!enabled?'disabled':'')+'>'+n+'</button>').join('')+'</div><div class="hh-legend" aria-hidden="true"><span>Ice cold</span><span>Neutral</span><span>Red hot</span></div><p class="hh-status" role="status" tabindex="-1">'+esc(message)+'</p><div class="hh-actions">'+(!wallet()?'<button type="button" class="btn" data-hatchery-connect>Connect wallet</button>':!state?.connected?'<button type="button" class="btn" data-hatchery-connect '+(busy?'disabled':'')+'>Connect Hatchery</button>':'<button type="button" class="btn" data-hatchery-refresh '+(busy?'disabled':'')+'>Check receipt</button>')+(state?.connected&&!row?.canVote&&!done?'<a href="https://axo.pet/hatchery" target="_blank" rel="noopener noreferrer">Pet &amp; passport ↗</a>':'')+'</div></section>';
 }
 function paint(){
  for(const el of document.querySelectorAll('[data-hatchery-heat]')){const a=el.dataset.hatcheryHeat,p={address:a};const focused=el.contains(document.activeElement)?document.activeElement.dataset.hatcheryScore:undefined;el.outerHTML=markup(p);if(focused!==undefined){const next=document.querySelector('[data-hatchery-heat="'+a+'"] [data-hatchery-score="'+focused+'"]');(next?.disabled?next.closest('.axo-hatchery-heat').querySelector('.hh-status'):next)?.focus({preventScroll:true});}}
  if(typeof layout==='function')layout();
 }
 function sync(){const next=wallet();if(next===owner)return;owner=next;generation++;state=null;notice='';loading=false;busy=false;receipts.clear();paint();if(owner&&axoStream.type==='hatchery')void refresh();}
 async function request(route,body){const r=await fetch('/api/hatchery-heat'+route,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(25000),...(body===undefined?{}:{method:'POST',headers:{'content-type':'application/json','x-axo-request':'1'},body:JSON.stringify(body)})});let d;try{d=await r.json();}catch{throw Error('Hatchery response was incomplete. No receipt is confirmed.');}if(!r.ok)throw Object.assign(Error(d.error||'Hatchery is unavailable.'),{code:d.code,status:r.status});return d;}
 async function refresh(force=false){
  sync();if(!owner||loading||busy)return;const version=generation;loading=true;paint();
  try{const d=await request(force?'?refresh=1':'');if(version!==generation||wallet()!==owner)return;if(d.wallet!==owner)throw Error('Hatchery returned a different wallet. Reconnect.');state=d;notice='';}catch(e){if(version===generation){notice=e.message;if(e.status===401)state=null;}}finally{if(version===generation){loading=false;paint();}}
 }
 async function connect(){
  sync();if(!owner){void axoWalletEntry();return;}if(busy)return;const version=generation,w=axoWallet,a=owner;busy=true;notice='Preparing Hatchery sign-in · ownership only, no spending.';paint();
  try{
   const c=await request('/challenge',{});if(version!==generation||wallet()!==a)return;
   if(c.origin!=='https://axo.pet'||c.chainId!==4663||typeof c.message!=='string'||!c.message.startsWith('axo.pet wants you to sign in with your Ethereum account:')||!c.message.toLowerCase().includes('\n'+a+'\n'))throw Error('Hatchery sign-in could not be verified.');
   const accounts=await w.provider.request({method:'eth_accounts'});if(accounts[0]?.toLowerCase()!==a)throw Error('Your wallet account changed. Reconnect.');
   const hex='0x'+[...new TextEncoder().encode(c.message)].map(v=>v.toString(16).padStart(2,'0')).join('');
   const signature=await w.provider.request({method:'personal_sign',params:[hex,a]});if(version!==generation||wallet()!==a)return;
   const d=await request('/verify',{signature});if(version!==generation||wallet()!==a)return;if(d.wallet!==a)throw Error('Hatchery wallet does not match.');state=d;notice='';
  }catch(e){if(version===generation)notice=e.code===4001?'Hatchery sign-in declined. No heat call was sent.':e.message;}finally{if(version===generation){busy=false;paint();}}
 }
 async function vote(a,score){
  sync();if(busy||!owner)return;const row=current({address:a});if(!row?.canVote||receipts.has(a))return;
  const version=generation;busy=true;notice='Saving '+labels[score]+' · '+score+'/10 in Hatchery…';paint();
  try{const d=await request('/vote',{address:a,heatScore:score});if(version!==generation||wallet()!==owner)return;if(d.wallet!==owner||d.receipt?.address!==a||d.receipt?.heatScore!==score)throw Error('Receipt identity was not confirmed. Check Hatchery before retrying.');state=d;receipts.set(a,d.receipt);notice='';}
  catch(e){if(version===generation){notice=e.message;if((!e.status||e.status>=500)&&state?.projects){const p=state.projects.find(p=>p.address===a);if(p){p.canVote=false;p.uncertain=true;}}if(e.status===401)state=null;}}
  finally{if(version===generation){busy=false;paint();}}
 }
 window.AxoHatcheryHeat={markup};
 document.addEventListener('click',e=>{const b=e.target.closest('[data-hatchery-score],[data-hatchery-connect],[data-hatchery-refresh]');if(!b)return;e.preventDefault();if(b.disabled)return;if(b.hasAttribute('data-hatchery-connect'))void connect();else if(b.hasAttribute('data-hatchery-refresh'))void refresh(true);else void vote(b.dataset.hatcheryAddress,Number(b.dataset.hatcheryScore));});
 window.addEventListener('axo:wallet-state',sync);window.addEventListener('axo:holder-access',sync);
 const base=axoGoStream;axoGoStream=function(...args){base(...args);if(axoStream.type==='hatchery')void refresh();};
 // Existing rows were rendered before this small controller loaded.
 paint();if(axoStream.type==='hatchery')void refresh();
})();
