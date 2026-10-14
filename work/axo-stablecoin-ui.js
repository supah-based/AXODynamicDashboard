/* Suppress suggested canonical stable, native and wrapped-native base assets. Quotes, explicit projects and personal holdings remain inspectable. */
const axoSuggestedProject=p=>AxoStablecoins.isSuggestedProject(p);
const stableNumericBase=discoveryNumeric;discoveryNumeric=function(p,d){return axoSuggestedProject(p)&&stableNumericBase(p,d)};
const stableCandidatesBase=candidates;candidates=function(...args){return stableCandidatesBase(...args).filter(axoSuggestedProject)};
const stableChainBase=chProjectRows;chProjectRows=function(...args){const rows=stableChainBase(...args);return axoStream.type==='chain'&&chView()==='followed'?rows:rows.filter(axoSuggestedProject)};
const stableLpBase=lpRows;lpRows=function(...args){return stableLpBase(...args).filter(axoSuggestedProject)};
const stableCompactBase=axoDiscoveryRows;axoDiscoveryRows=function(rows,...args){return stableCompactBase(rows.filter(axoSuggestedProject),...args)};
const stableRowBase=axoProjectRow;axoProjectRow=function(p,...args){return axoSuggestedProject(p)||axoRiskProtected(p)&&axoStream.type!=='project'?stableRowBase(p,...args):''};
const stableExtraBase=axoExtraCards;axoExtraCards=function(...args){return stableExtraBase(...args).filter(([id])=>!id.startsWith('project-')||!axoProjectMap.has(id)||axoRiskProtected(axoProjectMap.get(id))||axoSuggestedProject(axoProjectMap.get(id)))};
render(true);
