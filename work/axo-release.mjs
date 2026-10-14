import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
const exec=promisify(execFile),validSha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
export async function assetFingerprint(root,read=fs.readFile,list=fs.readdir){const files=['outputs/axo-live-dashboard.html',...(await list(path.join(root,'work'))).filter(f=>/^axo-.*\.(?:mjs|js|cjs|css)$/.test(f)).sort().map(f=>'work/'+f)];const h=createHash('sha256');for(const f of files)h.update(f+'\0').update(await read(path.join(root,f)));return h.digest('hex');}
export async function createReleaseMetadata({root,env=process.env,git=async args=>(await exec('git',args,{cwd:root,timeout:5000,windowsHide:true})).stdout.trim(),read=fs.readFile,fingerprint=()=>assetFingerprint(root),now=Date.now}={}){
 let commit=null,dirty=null,source='unknown',version='unknown',manifest=null;try{version=JSON.parse(await read(path.join(root,'package.json'),'utf8')).version||'unknown';}catch{}
 try{const sha=await git(['rev-parse','HEAD']);if(validSha(sha)){commit=sha;dirty=Boolean(await git(['status','--porcelain','--untracked-files=normal']));source='startup-git';}}catch{}
 if(!commit){try{manifest=JSON.parse(await read(path.join(root,'axo-build.json'),'utf8'));}catch{}const sha=env.AXO_RELEASE_COMMIT||manifest?.commit;if(validSha(sha)){commit=sha;source=env.AXO_RELEASE_COMMIT?'deployment-environment':'build-manifest';dirty=manifest?.dirty===false?false:null;}}
 let hash=null;try{hash=await fingerprint();}catch{}if(manifest?.assetHash&&manifest.assetHash!==hash){dirty=true;source+='-assets-mismatch';}
 const stamped={version,commit,shortCommit:commit?.slice(0,7)||null,dirty,source,startedAt:now(),assetHash:hash,buildTime:manifest?.builtAt||null,commitUrl:commit?'https://github.com/supah-based/AXODynamicDashboard/commit/'+commit:null};
 return {async snapshot(){let changed=null;try{changed=hash?await fingerprint()!==hash:null;}catch{}return {...stamped,assetsChanged:changed,state:changed?'assets-changed-restart-required':dirty===true?'development-unpublished':commit&&dirty===false?'identified-build':commit?'deployment-commit-unverified-worktree':'unknown-build'};}};
}
