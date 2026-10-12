import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createIntentApi} from './axo-intent-api.mjs';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'axo-tier-plans-'));
let allowed=false,operation='add_card';
const api=createIntentApi({cardDirectory:dir,model:async()=>({value:{operation,chains:['base','arc'],query:null,ticker:null,title:'Fixture research',clarification:null,liquidityMin:100000,volumeMin:10000,components:['ranked_list'],metrics:['volume24'],change:null,targetStream:'current',scoreMin:null,scoreMax:null,rankBy:'activity'}}),authorizePlan:async(_req,p)=>{if(!allowed&&['add_card','create_stream','compare'].includes(p.operation))throw Object.assign(Error('Higher tier required'),{status:403,code:'axo_tier_required'});}});
async function call(){const req=Readable.from([JSON.stringify({question:'Create a research view'})]);req.method='POST';req.headers={host:'127.0.0.1:43187',origin:'http://127.0.0.1:43187','x-axo-request':'1'};const res=new EventEmitter();let status,data;res.writeHead=s=>status=s;res.end=s=>{data=JSON.parse(s);res.writableEnded=true;};await api.handle(req,res,new URL('http://localhost/api/ai/intent'));return {status,data};}
try{for(operation of ['add_card','compare','create_stream']){const r=await call();assert.equal(r.status,403);assert.equal(r.data.template,undefined);assert.equal((await fs.readdir(dir)).length,0,'A rejected plan must not write a shared template');}allowed=true;operation='add_card';const r=await call();assert.equal(r.status,200);assert.ok(r.data.template);assert.equal((await fs.readdir(dir)).length,1);console.log('PASS: custom cards, comparisons and saved research plans enforce tier authorization before persisting templates.');}
finally{await fs.rm(dir,{recursive:true,force:true});}
