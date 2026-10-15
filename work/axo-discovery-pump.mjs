// Independent from slow global feeds. One shared collection, never one per visitor.
export function createDiscoveryPump({collect,ingest=async()=>{},publish=()=>{},intervalMs=60000,setTimer=setInterval,clearTimer=clearInterval}={}){
 let job=null,timer=null;
 function tick(){if(job)return job;job=Promise.resolve().then(collect).then(ingest).then(publish).finally(()=>{job=null;});return job;}
 function start(){if(timer)return;timer=setTimer(()=>void tick().catch(()=>{}),intervalMs);timer?.unref?.();void tick().catch(()=>{});}
 return {tick,start,async stop(){if(timer)clearTimer(timer);timer=null;await job?.catch(()=>{});}};
}
