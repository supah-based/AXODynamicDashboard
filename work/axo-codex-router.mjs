import net from 'node:net';
import {codexAnswer as directAnswer,codexStatus as directStatus,closeCodexConnection} from './axo-codex-provider.mjs';

const socketPath=String(process.env.AXO_CODEX_BROKER_SOCKET||'').trim();

function brokerCall(method,params,signal){
 return new Promise((resolve,reject)=>{
  const socket=net.createConnection(socketPath);let raw='',settled=false;
  const finish=(error,value)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);socket.destroy();error?reject(error):resolve(value)};
  const abort=()=>finish(Object.assign(new Error('Local Luna request cancelled'),{code:'job_cancelled'}));
  signal?.addEventListener('abort',abort,{once:true});
  socket.setTimeout(method==='answer'?100000:20000,()=>finish(new Error('Codex broker timed out.')));
  socket.on('connect',()=>socket.write(JSON.stringify({method,params})+'\n'));
  socket.on('data',chunk=>{raw+=chunk;if(raw.length>500000){finish(new Error('Codex broker response too large.'));return}const end=raw.indexOf('\n');if(end<0)return;let message;try{message=JSON.parse(raw.slice(0,end))}catch{finish(new Error('Codex broker returned invalid JSON.'));return}if(message.ok)finish(null,message.value);else finish(Object.assign(new Error(String(message.error||'Codex broker request failed.').slice(0,300)),{code:message.code||'codex_broker_error'}))});
  socket.on('error',error=>finish(error));socket.on('end',()=>{if(!settled)finish(new Error('Codex broker closed before responding.'))});
 });
}

export async function codexStatus(){return socketPath?brokerCall('status',{}):directStatus()}
export async function codexAnswer(args,web=false){if(!socketPath)return directAnswer(args,web);const {signal,...safeArgs}=args||{};return brokerCall('answer',{args:safeArgs,web:Boolean(web)},signal)}
export function closeCodexRouter(){if(!socketPath)closeCodexConnection()}
