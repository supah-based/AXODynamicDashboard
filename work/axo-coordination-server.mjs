import fs from 'node:fs/promises';
import path from 'node:path';
import {startServer,HOST,PORT,ROOT,CoordinationStore} from './axo-coordination-service.mjs';
const store=new CoordinationStore();
await store.load();
const responseQueue=path.join(ROOT,'response-queue');
await fs.mkdir(responseQueue,{recursive:true,mode:0o700});
const server=await startServer({host:HOST,port:PORT,store});
console.log(`AXO coordination listener ready at ${HOST}:${server.address().port}`);
let processing=false;
const timer=setInterval(async()=>{
 if(processing)return;processing=true;
 try{
  await store.load();
  for(const message of store.data.inbox.filter(x=>!x.processedAt&&['ping','status-question'].includes(x.kind)).slice(0,20))await store.process(message.id);
  for(const name of (await fs.readdir(responseQueue)).filter(x=>/^[a-f0-9-]+\.json$/.test(x)).slice(0,20)){
   const file=path.join(responseQueue,name);
   try{const response=JSON.parse(await fs.readFile(file,'utf8'));await store.respond(response.messageId,response);await fs.unlink(file);}catch(e){console.error(`Coordination response queue rejected ${name}: ${e.message}`);}
  }
 }catch{console.error('Coordination response processing unavailable.');}finally{processing=false;}
},2000);
timer.unref();
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{clearInterval(timer);server.close(()=>process.exit(0));});
