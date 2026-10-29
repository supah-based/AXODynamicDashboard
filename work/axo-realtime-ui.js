/* Realtime tools use the same scoped planner and receipts as typed dashboard actions. */
function axoRealtimeSend(s,event){if(axoLive!==s||s.closing||!s.ready||s.channel?.readyState!=='open')return false;try{s.channel.send(JSON.stringify({...event,event_id:'axo-'+crypto.randomUUID()}));return true}catch{axoLiveCleanup(s,'Voice event channel failed. Start live again.');return false}}
function axoRealtimeInterrupt(s){s.inputRevision=(s.inputRevision||0)+1;s.controller?.abort();s.processing=false;}
async function axoRealtimeDashboard(s,request,signal){
 if(typeof request!=='string'||!request.trim()||request.length>2000)throw Error('Please give Axo a request of 1–2000 characters.');
 if(s.realtimeHintPending&&s.projectHint){request=request.slice(0,1200)+'\nLatest user-provided exact contract: '+s.projectHint.address+'\nPrevious scope: '+s.projectHint.request.slice(0,500);s.realtimeHintPending=false;}
 s.activeVoiceQuestion=request;s.transcripts.push({role:'user',content:request});s.transcripts=s.transcripts.slice(-6);
 const result=await axoRunIntent(request,signal,true);if(result?.cancelled||signal.aborted)throw new DOMException('Request cancelled','AbortError');
 if(result?.handled!==false)return {message:result.message,clarification:!!result.clarification};
 const answer=await axoAiPost('/api/ai/ask',{question:request,history:s.transcripts.slice(0,-1),voice:true,voiceContext:{}},signal);
 if(signal.aborted)throw new DOMException('Request cancelled','AbortError');return {message:answer.answer,sources:answer.sources};
}
async function axoRealtimeTools(s,response,turn){
 const calls=(response.output||[]).filter(o=>o.type==='function_call');if(!calls.length)return;
 s.realtimeCalls||=new Set();const revision=s.inputRevision||0,controller=new AbortController();s.controller?.abort();s.controller=controller;s.processing=true;const done=axoBeginLiveTask('Updating dashboard');
 let emitted=false;
 try{for(const call of calls.slice(0,4)){
  if(typeof call.call_id!=='string'||s.realtimeCalls.has(call.call_id))continue;s.realtimeCalls.add(call.call_id);
  let result;try{
   if(controller.signal.aborted||turn.revision!==revision||turn.scope!==axoDashboardIdentity()&& !emitted)throw new DOMException('Request superseded','AbortError');
   if(typeof call.arguments!=='string'||call.arguments.length>5000)throw Error('Invalid dashboard tool arguments.');const args=JSON.parse(call.arguments);
   if(call.name==='get_dashboard_state'){if(!args||Array.isArray(args)||Object.keys(args).length)throw Error('Dashboard state takes no arguments.');result={stream:axoCaptureStream(),streams:axoAvailableStreams(),publicReferences:axoDashboardReferences(),note:'References identify public source data. Use ask_dashboard for measured answers and checked actions.'};}
   else if(call.name==='ask_dashboard'){if(!args||Object.keys(args).some(k=>k!=='request'))throw Error('Unsupported dashboard request.');result=await axoRealtimeDashboard(s,args.request,controller.signal);}
   else throw Error('That dashboard tool is unavailable.');
  }catch(e){result={error:e.name==='AbortError'?'Request cancelled or superseded. Do not report it as completed.':e.message};}
  if(axoLive!==s||s.closing)return;emitted=axoRealtimeSend(s,{type:'conversation.item.create',item:{type:'function_call_output',call_id:call.call_id,output:JSON.stringify(result)}})||emitted;
 }
 if(emitted&&!controller.signal.aborted&&revision===(s.inputRevision||0))axoRealtimeSend(s,{type:'response.create'});
 }finally{done();if(s.controller===controller){s.processing=false;axoLiveState('listening');}axoAiPanel.hidden=true;}
}
function axoHandleRealtimeEvent(s,e){
 if(axoLive!==s||s.closing)return;
 if(e.type==='session.created'){s.ready=true;s.phase='listening';clearTimeout(s.connectTimer);axoLiveState('listening','Connected · speak to Axo');$('voiceStatus').textContent='Live with Axo · Verse · '+(s.model||'Realtime');toast('Live voice connected.');return;}
 if(e.type==='input_audio_buffer.speech_started'){axoRealtimeInterrupt(s);axoLiveState('listening');return;}
 if(e.type==='response.created'){if(s.realtimeDoneResponses?.has(e.response.id))return;s.realtimeResponses||=new Map();s.realtimeResponses.set(e.response.id,{revision:s.inputRevision||0,scope:axoDashboardIdentity()});while(s.realtimeResponses.size>128)s.realtimeResponses.delete(s.realtimeResponses.keys().next().value);return;}
 // Arguments-done can belong to a cancelled response. Only completed responses execute tools.
 if(e.type==='response.done'){
  const turn=s.realtimeResponses?.get(e.response?.id);if(!turn)return;s.realtimeResponses.delete(e.response.id);s.realtimeDoneResponses||=new Set();s.realtimeDoneResponses.add(e.response.id);
  if(e.response.status!=='completed'||turn.revision!==(s.inputRevision||0)||turn.scope!==axoDashboardIdentity())return;
  void axoRealtimeTools(s,e.response,turn).catch(()=>{if(axoLive===s)axoLiveState('error','The dashboard request could not finish. Please retry.');});return;
 }
 if(e.type==='output_audio_buffer.started'){axoLiveState('speaking');return;}
 if(e.type==='output_audio_buffer.stopped'){axoLiveState(s.processing?'processing':'listening');return;}
 if(e.type==='error'){const code=/^[a-z0-9_]{1,80}$/i.test(e.error?.code||'')?e.error.code:'service_error';if(['response_cancel_not_active','conversation_already_has_active_response'].includes(code))return;axoLiveState('error','Voice service error ('+code+').');toast('Voice service error ('+code+'). Please retry your request.','error');}
}
const realtimeGuidance=axoSendLiveGuidance;axoSendLiveGuidance=async function(){
 const s=axoLive;if(s?.protocol!=='realtime')return realtimeGuidance();const input=axoLiveGuidance.querySelector('input'),text=input.value.trim();if(!text||!s.ready||s.closing)return;
 axoRealtimeInterrupt(s);input.value='';if(/^(?:0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/.test(text)){s.projectHint={address:text,request:axoIntentPending?.question||s.activeVoiceQuestion||''};s.realtimeHintPending=true;}axoRealtimeSend(s,{type:'response.cancel'});
 // A normal user turn lets the model combine exact pasted addresses with the spoken request.
 axoRealtimeSend(s,{type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text}]}});axoRealtimeSend(s,{type:'response.create'});toast('Guidance sent to Axo.');
};
