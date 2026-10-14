#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {createPrivateKey,createPublicKey,sign} from 'node:crypto';
import {connect} from 'node:net';
import {CoordinationStore,ROOT,signRequest,PORT} from './axo-coordination-service.mjs';
const state=new CoordinationStore({directory:process.env.AXO_COORDINATION_STATE_DIR||ROOT});
const challengePath=new URL('../docs/coordination-enrollment-challenge.json',import.meta.url);
function usage(){throw Error('Usage: status | inbox | process [message-id] | result [correlation-id] | enroll <signed-response.json> | revoke <key-id> | make-enrollment-response <output.json> | sign-request <envelope.json> | poll <correlation-id>');}
const [cmd,arg]=process.argv.slice(2);
if(['process','enroll','revoke'].includes(cmd)){
 const active=await new Promise(resolve=>{const socket=connect(PORT,'127.0.0.1');socket.once('connect',()=>{socket.destroy();resolve(true)});socket.once('error',()=>resolve(false));socket.setTimeout(1000,()=>{socket.destroy();resolve(true)});});
 if(active)throw Error('Stop the coordination service before changing its journal; restart after the local operation.');
}
if(cmd==='status')console.log(JSON.stringify(await state.snapshot(),null,2));
else if(cmd==='inbox'){await state.load();console.log(JSON.stringify(state.data.inbox.map(({id,correlationId,kind,at,receivedAt,processedAt,processing,text,context})=>({id,correlationId,kind,at,receivedAt,processedAt,processing,text,context})),null,2));}
else if(cmd==='process'){console.log(JSON.stringify(await state.process(arg||null),null,2));}
else if(cmd==='result'){console.log(JSON.stringify(await state.results(arg||null),null,2));}
else if(cmd==='enroll'&&arg){const response=JSON.parse(await fs.readFile(path.resolve(arg),'utf8')),challenge=JSON.parse(await fs.readFile(challengePath,'utf8'));console.log(JSON.stringify(await state.enroll(response,challenge),null,2));}
else if(cmd==='revoke'&&arg){console.log(JSON.stringify(await state.revoke(arg),null,2));}
else if(cmd==='sign-request'&&arg){
 const endpoint=new URL(process.env.AXO_COORDINATION_ENDPOINT||'http://127.0.0.1:3457/api/coordination/v1/messages');
 if(endpoint.origin!=='http://127.0.0.1:3457'||endpoint.pathname!=='/api/coordination/v1/messages'||endpoint.search||endpoint.hash)throw Error('Unexpected coordination endpoint.');
 const keyFile=process.env.AXO_COORDINATION_PRIVATE_KEY_FILE;if(!keyFile)throw Error('AXO_COORDINATION_PRIVATE_KEY_FILE is required.');const st=await fs.stat(keyFile);if((st.mode&0o077)!==0)throw Error('Private key file must be mode 0600.');
 const privateKeyPem=await fs.readFile(keyFile,'utf8'),priv=createPrivateKey(privateKeyPem);if(priv.asymmetricKeyType!=='ed25519')throw Error('Builder key must be Ed25519.');
 const data=JSON.parse(await fs.readFile(path.resolve(arg),'utf8')),body=Buffer.from(JSON.stringify(data)),auth=signRequest({privateKeyPem,method:'POST',target:endpoint.pathname,body});
 const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','x-axo-key-id':auth.keyId,'x-axo-timestamp':String(auth.timestamp),'x-axo-nonce':auth.nonce,'x-axo-signature':auth.signature},body,redirect:'error',signal:AbortSignal.timeout(10000)});const result=await response.json();if(!response.ok)throw Error(`Coordination request rejected (${response.status}): ${result.error||'unknown'}`);console.log(JSON.stringify(result,null,2));
}
else if(cmd==='poll'&&arg){
 const endpoint=new URL(process.env.AXO_COORDINATION_ENDPOINT||'http://127.0.0.1:3457/api/coordination/v1/results');if(endpoint.origin!=='http://127.0.0.1:3457'||endpoint.pathname!=='/api/coordination/v1/results')throw Error('Unexpected coordination endpoint.');
 const keyFile=process.env.AXO_COORDINATION_PRIVATE_KEY_FILE;if(!keyFile)throw Error('AXO_COORDINATION_PRIVATE_KEY_FILE is required.');const st=await fs.stat(keyFile);if((st.mode&0o077)!==0)throw Error('Private key file must be mode 0600.');const privateKeyPem=await fs.readFile(keyFile,'utf8');if(createPrivateKey(privateKeyPem).asymmetricKeyType!=='ed25519')throw Error('Builder key must be Ed25519.');
 endpoint.searchParams.set('correlationId',arg);const body=Buffer.alloc(0),auth=signRequest({privateKeyPem,method:'GET',target:endpoint.pathname+endpoint.search,body});const response=await fetch(endpoint,{method:'GET',headers:{'x-axo-key-id':auth.keyId,'x-axo-timestamp':String(auth.timestamp),'x-axo-nonce':auth.nonce,'x-axo-signature':auth.signature},redirect:'error',signal:AbortSignal.timeout(10000)});const result=await response.json();if(!response.ok)throw Error(`Coordination poll rejected (${response.status}): ${result.error||'unknown'}`);console.log(JSON.stringify(result,null,2));
}
else if(cmd==='make-enrollment-response'&&arg){
 const challenge=JSON.parse(await fs.readFile(challengePath,'utf8'));const keyFile=process.env.AXO_COORDINATION_PRIVATE_KEY_FILE;if(!keyFile)throw Error('AXO_COORDINATION_PRIVATE_KEY_FILE is required.');const st=await fs.stat(keyFile);if((st.mode&0o077)!==0)throw Error('Private key file must be mode 0600.');const privateKeyPem=await fs.readFile(keyFile,'utf8'),priv=createPrivateKey(privateKeyPem);if(priv.asymmetricKeyType!=='ed25519')throw Error('Builder key must be Ed25519.');const publicKeyPem=createPublicKey(priv).export({type:'spki',format:'pem'}),signature=sign(null,Buffer.from(`axo-coordination-enroll-v1\n${challenge.challengeId}\n${challenge.audience}\n${challenge.challenge}`),priv).toString('base64');await fs.writeFile(path.resolve(arg),JSON.stringify({version:1,challengeId:challenge.challengeId,publicKeyPem,signature},null,2)+'\n',{mode:0o644,flag:'wx'});console.log(JSON.stringify({written:path.resolve(arg),privateKeyNotIncluded:true}));
}
else usage();
