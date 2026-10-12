import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

delete process.env.AXO_CODEX_BROKER_SOCKET;
const {codexAnswer,codexStatus,closeCodexConnection}=await import('./axo-codex-provider.mjs');
const socketPath=process.env.AXO_CODEX_BROKER_LISTEN||'/run/axo-streams-codex.sock';
const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const projectGid=(await fs.stat(projectRoot)).gid;
try{await fs.unlink(socketPath)}catch(error){if(error.code!=='ENOENT')throw error}

const server=net.createServer(socket=>{
 let raw='',handled=false;
 const send=message=>{if(!socket.destroyed)socket.end(JSON.stringify(message)+'\n')};
 socket.setTimeout(105000,()=>socket.destroy());
 socket.on('data',async chunk=>{
  if(handled)return;raw+=chunk;if(raw.length>100000){handled=true;send({ok:false,error:'Request too large.',code:'request_too_large'});return}
  const end=raw.indexOf('\n');if(end<0)return;handled=true;let request;
  try{request=JSON.parse(raw.slice(0,end))}catch{send({ok:false,error:'Invalid request.',code:'invalid_request'});return}
  try{
   if(request.method==='status'){send({ok:true,value:await codexStatus()});return}
   if(request.method!=='answer'||!request.params?.args||typeof request.params.args!=='object')throw Object.assign(new Error('Unsupported broker request.'),{code:'unsupported_request'});
   const encoded=JSON.stringify(request.params.args);if(encoded.length>80000)throw Object.assign(new Error('Inference request too large.'),{code:'request_too_large'});
   send({ok:true,value:await codexAnswer(request.params.args,request.params.web===true)});
  }catch(error){send({ok:false,error:String(error.message||'Codex request failed.').slice(0,300),code:error.code||'codex_error'})}
 });
 socket.on('error',()=>{});
});
server.listen(socketPath,async()=>{await fs.chown(socketPath,0,projectGid);await fs.chmod(socketPath,0o660);console.log('Axo Codex broker listening on '+socketPath)});
const stop=()=>server.close(()=>{closeCodexConnection();process.exit(0)});process.on('SIGINT',stop);process.on('SIGTERM',stop);
