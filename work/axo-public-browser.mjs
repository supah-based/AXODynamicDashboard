// Ordinary, unauthenticated rendering of the official public Rewards page.
// No copied cookies, spoofed headers, login, wallet, or gated machine endpoints.
import {runtimeDependency} from './axo-runtime.mjs';const {chromium}=runtimeDependency('playwright');
const accepted=new Map(['status','overview','catalog'].map(k=>['https://www.axo.vision/api/rewards/'+k,k]));
export function createPublicRewardsReader({now=Date.now}={}){
 const channel=process.env.AXO_BROWSER_CHANNEL||(process.platform==='win32'?'msedge':'chromium'),browserOptions=channel==='chromium'?{}:{channel};
 let cached=null,job=null,nextAttempt=0;
 return async function publicRewards(){if(cached&&now()-cached.at<300000)return cached;if(job)return job;if(now()<nextAttempt)return null;nextAttempt=now()+300000;
  job=(async()=>{let browser;const data={},tasks=[];try{browser=await chromium.launch({...browserOptions,headless:true});const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();page.setDefaultNavigationTimeout(20000);
   let done;const ready=new Promise(resolve=>done=resolve);page.on('response',response=>{const key=accepted.get(response.url());if(!key||!response.ok())return;tasks.push((async()=>{try{if(Number(response.headers()['content-length'])>1800000)return;const body=await response.body();if(body.byteLength>1800000)return;data[key]={data:JSON.parse(body.toString('utf8')),at:now()};if(Object.keys(data).length===3)done()}catch{}})())});
   await page.goto('https://www.axo.vision/rewards',{waitUntil:'domcontentloaded'});let timeout;await Promise.race([ready,new Promise(resolve=>timeout=setTimeout(resolve,15000))]);clearTimeout(timeout);await Promise.allSettled(tasks);cached={at:now(),data};return cached;
  }catch{return null}finally{await browser?.close().catch(()=>{})}})();try{return await job}finally{job=null}
 };
}
