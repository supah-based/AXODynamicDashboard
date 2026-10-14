/* Personal browser fallbacks are selected only after signed ownership is known. */
(function(){
 const keys=new Set(['axo-watchlist-v1','axo-information-feedback-v1','axo-stream-shortcuts-v1','axo-stream-shortcut-tombstones-v1','axo-attached-cards-v1','axo-alert-rules-v1','axo-companion-memory-v1','axo-stream-preferences-v1']);
 const get=Storage.prototype.getItem,set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;let owner=null;
 const scoped=k=>owner&&keys.has(k)?'axo-private:'+owner+':'+k:k;
 Storage.prototype.getItem=function(k){return get.call(this,this===localStorage?scoped(k):k);};
 Storage.prototype.setItem=function(k,v){set.call(this,this===localStorage?scoped(k):k,v);if(this===localStorage&&keys.has(k))window.dispatchEvent(new Event('axo:personal-dirty'));};
 Storage.prototype.removeItem=function(k){remove.call(this,this===localStorage?scoped(k):k);if(this===localStorage&&keys.has(k))window.dispatchEvent(new Event('axo:personal-dirty'));};
 window.AxoPrivateStorage={switchOwner(key){owner=key||null;},anonymous(k){return get.call(localStorage,k);},clearOwner(key){for(const k of keys)remove.call(localStorage,'axo-private:'+key+':'+k);}};
})();
