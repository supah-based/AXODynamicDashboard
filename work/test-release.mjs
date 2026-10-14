import assert from 'node:assert/strict';
import {createReleaseMetadata} from './axo-release.mjs';
const sha='a'.repeat(40),read=async file=>{if(file.endsWith('package.json'))return '{"version":"0.2.0"}';throw Error('No manifest');},fingerprint=async()=> 'b'.repeat(64);
let r=await createReleaseMetadata({root:'.',env:{},read,fingerprint,git:async args=>args[0]==='rev-parse'?sha:''});assert.equal((await r.snapshot()).dirty,false);assert.equal((await r.snapshot()).commit,sha);
r=await createReleaseMetadata({root:'.',env:{},read,fingerprint,git:async args=>args[0]==='rev-parse'?sha:' M work/axo-server.mjs'});assert.equal((await r.snapshot()).state,'development-unpublished');
r=await createReleaseMetadata({root:'.',env:{},read,fingerprint,git:async()=>{throw Error('No git');}});assert.equal((await r.snapshot()).commit,null);assert.equal((await r.snapshot()).state,'unknown-build');
r=await createReleaseMetadata({root:'.',env:{AXO_RELEASE_COMMIT:sha},read,fingerprint,git:async()=>{throw Error('No git');}});assert.equal((await r.snapshot()).source,'deployment-environment');assert.equal((await r.snapshot()).dirty,null);
let current='b'.repeat(64);r=await createReleaseMetadata({root:'.',env:{},read,fingerprint:async()=>current,git:async args=>args[0]==='rev-parse'?sha:''});current='c'.repeat(64);assert.equal((await r.snapshot()).assetsChanged,true);assert.equal((await r.snapshot()).commit,sha,'assets changes never replace the running startup commit with remote HEAD');
console.log('PASS clean/dirty/no-Git/deployment fallback and running-startup identity versus changed assets.');
