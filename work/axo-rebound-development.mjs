import {publicSources} from './axo-source-cache.mjs';
import {fetchPublicLead,publicLeadUrl} from './axo-lead-public.mjs';
import {leadPage} from './axo-tracked-projects.mjs';
import {githubRepo} from './axo-discovery.mjs';
export function createReboundDevelopment({investigate,now=Date.now,readJson=url=>publicSources.get(url,{ttl:3600000}),readText=url=>publicSources.get(url,{ttl:3600000,responseType:'text',fetcher:fetchPublicLead,headers:{accept:'text/html'}})}={}){
 const cache=new Map();
 return async p=>{const key=p.chain+':'+p.address,old=cache.get(key);if(old&&now()-old.checkedAt<3600000)return old;let base;
  try{base=await investigate(p);}catch{return {chain:p.chain,address:p.address,checkedAt:now(),github:{status:'unavailable'},links:[]};}
  const out={...base,links:[...(base.links||[])]};let repo=out.links.map(l=>githubRepo(l.url)).find(Boolean);
  if(!repo){for(const link of out.links.filter(l=>{try{return !['github.com','x.com','twitter.com','t.me'].includes(new URL(l.url).hostname);}catch{return false;}}).slice(0,1)){
   try{const url=publicLeadUrl(link.url),page=await readText(url),found=leadPage(page.data,url).links.map(l=>githubRepo(l.url)).find(Boolean);if(found){repo=found;out.links.push({url:'https://github.com/'+repo,type:'Repository linked by provider-listed website',website:url,observedAt:page.at});break;}}catch{}
  }}
  if(repo)try{const [metadata,commits]=await Promise.all([readJson('https://api.github.com/repos/'+repo),readJson('https://api.github.com/repos/'+repo+'/commits?per_page=100&since='+encodeURIComponent(new Date(now()-30*86400000).toISOString()))]);if(metadata.data.full_name?.toLowerCase()!==repo.toLowerCase())throw Error('Repository mismatch');out.links.push({url:'https://github.com/'+repo,type:'Canonical provider/website-linked repository'});out.github={status:'available',repository:metadata.data.full_name,url:'https://github.com/'+repo,archived:metadata.data.archived,commits:(Array.isArray(commits.data)?commits.data:[]).filter(c=>c.author?.type!=='Bot'&&c.committer?.type!=='Bot'&&!/\[bot\]$/.test(c.author?.login||'')).slice(0,100).map(c=>({sha:c.sha,url:c.html_url,at:c.commit?.committer?.date})),sourceUrl:commits.url,sourceAt:Math.min(metadata.at,commits.at),coverage:'Up to 100 commits in 30 days; explicitly identified GitHub bots excluded. Unknown authors and ownership remain unverified.'};}catch{out.github={status:'unavailable'};}
  out.checkedAt=now();cache.set(key,out);if(cache.size>128)cache.delete(cache.keys().next().value);return out;
 };
}
