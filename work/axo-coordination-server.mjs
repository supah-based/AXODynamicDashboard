import {startServer,HOST,PORT,CoordinationStore} from './axo-coordination-service.mjs';
const store=new CoordinationStore();
await store.load();
const server=await startServer({host:HOST,port:PORT,store});
console.log(`AXO coordination listener ready at ${HOST}:${server.address().port}`);
const timer=setInterval(async()=>{
 try{
  await store.load();
  for(const message of store.data.inbox.filter(x=>!x.processedAt&&['ping','status-question'].includes(x.kind)).slice(0,20))await store.process(message.id);
 }catch{console.error('Coordination response processing unavailable.');}
},5000);
timer.unref();
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{clearInterval(timer);server.close(()=>process.exit(0));});
