// Render images only. Never execute or inline publisher HTML/SVG.
export function mediaUrl(value,source='project'){
 try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.port||/\.svg(?:$|[?#])/i.test(u.href)||u.href.length>2000)return null;
 const rules={project:[['assets.geckoterminal.com','/'],['coin-images.coingecko.com','/coins/'],['assets.coingecko.com','/coins/'],['cdn.geckoterminal.com','/'],['cdn.dexscreener.com','/'],['www.axo.vision','/brand/']],coindesk:[['cdn.sanity.io','/images/s3y3vcno/']],cointelegraph:[['s3-images.ctmedia.io','/media/'],['images.cointelegraph.com','/']],decrypt:[['img.decrypt.co','/'],['cdn.decrypt.co','/wp-content/']],base:[['storage.googleapis.com','/papyrus_images/']],ethereum:[['blog.ethereum.org','/'] ]};
 return (rules[source]||[]).some(([host,prefix])=>u.hostname===host&&u.pathname.startsWith(prefix))?u.href:null;
 }catch{return null}
}

