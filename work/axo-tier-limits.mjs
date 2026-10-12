// Initial daily per-wallet limits, independent of the unconfigured credit-price system.
export const HOLDER_LIMITS=Object.freeze(Object.fromEntries(Object.entries({
 public:{aiRequests:0,voiceSeconds:0,customCards:false,projectMonitoring:false},
 holder:{aiRequests:20,voiceSeconds:300,customCards:false,projectMonitoring:false},
 enhanced:{aiRequests:60,voiceSeconds:900,customCards:true,projectMonitoring:true},
 top:{aiRequests:120,voiceSeconds:1800,customCards:true,projectMonitoring:true},
 whale:{aiRequests:240,voiceSeconds:null,customCards:true,projectMonitoring:true}
}).map(([tier,limits])=>[tier,Object.freeze(limits)])));
