import assert from 'node:assert/strict';
import vm from 'node:vm';
export async function testAiUi({c,document}){
 const original=c.fetch,calls=[];c.fetch=async(url,options)=>{calls.push({url,options});return {ok:true,json:async()=>({model:'gpt-6-luna',answer:'<img src=x onerror=evil()> fixture',sources:[],cards:['markets','swap','<script>']})}};
 await vm.runInContext('ask("Why does liquidity matter?")',c);assert.equal(calls.length,1);assert.equal(calls[0].url,'/api/ai/ask');assert.equal(JSON.parse(calls[0].options.body).question,'Why does liquidity matter?');
 assert.match(document.querySelector('.axo-ai-answer').textContent,/<img/);assert.equal(document.querySelector('.axo-ai-answer img'),null);assert.equal(document.querySelectorAll('[data-ai-card]').length,1);assert.equal(document.querySelector('[data-ai-card]').dataset.aiCard,'markets');
 await vm.runInContext('ask("show sentiment")',c);assert.equal(calls.length,1);assert.equal(vm.runInContext('axoFocusTopic',c),'sentiment');
 c.fetch=async()=>({ok:false,json:async()=>({error:'API unavailable'})});await vm.runInContext('ask("Explain market depth")',c);assert.equal(document.querySelector('.axo-ai-answer').textContent,'API unavailable');
 assert.equal(document.querySelector('.axo-live-toggle').disabled,true);assert.ok(document.querySelector('header .axo-brand-logo img'));c.fetch=original;
 console.log('AI UI tests passed: general questions route to Luna, safe text, allowlisted navigation, explicit commands, errors, voice unavailable without API credential.');
}
