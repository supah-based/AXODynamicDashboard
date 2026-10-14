/* Shared capabilities for both voice and text. No executable model output. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AxoActionRegistry=api;})(globalThis,function(){
 const actions={
 answer:{feature:'ask',target:'context',description:'Explain dated supplied evidence'},
 open_project:{feature:'ask',target:'exact-project',description:'Open the full exact project page; clarify ambiguous identity'},
 create_stream:{feature:'customCards',target:'chains',description:'Create a saved live research stream'},
 compare:{feature:'customCards',target:'chains',description:'Compare supplied measured projects or chain context'},
 add_card:{feature:'customCards',target:'stream',description:'Attach a supported data-only layout to the current or named stream'},
 clarify:{feature:'ask',target:'choices',description:'Ask one question with clickable candidates and custom input'},
 manage_watchlist:{feature:'ask',target:'exact-project',description:'Add, remove or show personal follows'},
 manage_favorites:{feature:'ask',target:'workspace-item',description:'Manage personal saved information'},
 manage_alerts:{feature:'ask',target:'exact-project',description:'Manage explicit price, liquidity or volume thresholds'},
 manage_rebounds:{feature:'projectMonitoring',target:'exact-project',description:'Track, pause, resume or remove a qualifying Bounce watch'},
 manage_streams:{feature:'ask',target:'workspace-item',description:'Show, save, rename, move or remove a saved stream'},
 manage_kept:{feature:'ask',target:'workspace-item',description:'Manage kept metric references'},
 set_preference:{feature:'ask',target:'workspace-preference',description:'Change available presentation and consent preferences'},
 prepare_trade:{feature:'ask',target:'exact-project',description:'Open trade review only; wallet approval remains separate'},
 manage_inbox:{feature:'ask',target:'workspace-item',description:'Open, read, mute or rate a dated personal signal'},
 investigate:{feature:'ask',target:'exact-project',description:'Queue bounded exact-project evidence collection'},
 navigate:{feature:'ask',target:'stream',description:'Open a supported existing stream with explicit scope'}
 };
 function feature(p){if(!actions[p.operation])throw Error('Unsupported Axo action');if(p.operation==='manage_rebounds'&&!['add','enable'].includes(p.change?.action))return 'ask';return actions[p.operation].feature;}
 function validate(p){if(!p||!actions[p.operation])throw Error('Unsupported Axo action');if(['manage_inbox','navigate','investigate'].includes(p.operation)&&p.change?.action&&!['show','add','remove','enable','disable','set'].includes(p.change.action))throw Error('Unsupported Axo action change');return p;}
 function target(p){if(p.operation==='navigate'&&!['home','chain','discovery','rebound','watchlist','launchpads','news','axo','hatchery','portfolio','profile','risk','changes','research-review','inbox','quality'].includes(p.change?.target))throw Error('Choose a supported stream');return validate(p);}
 return Object.freeze({version:1,actions,operations:Object.keys(actions),feature,validate:target});
});
