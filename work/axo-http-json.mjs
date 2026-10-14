export async function responseJson(response,source='Public provider'){
 if(typeof response.text!=='function'){try{return await response.json();}catch{throw Error(source+' returned unreadable data. Retry shortly.');}}
 let text;try{text=await response.text();}catch(e){if(e.name==='AbortError')throw e;throw Error(source+' connection was interrupted. Retry shortly.');}
 if(!text.trim())throw Error(source+' returned an empty response (HTTP '+response.status+'). Retry shortly.');if(text.length>4000000)throw Error(source+' response exceeds the supported size.');
 try{const d=JSON.parse(text);if(d===null||typeof d!=='object')throw Error();return d;}catch{throw Error(source+' returned unreadable data (HTTP '+response.status+'). Retry shortly.');}
}
