import {build} from 'esbuild';
const nodePaths=process.env.REOWN_NODE_PATH?process.env.REOWN_NODE_PATH.split(requireSeparator()):[];
function requireSeparator(){return process.platform==='win32'?';':':'}
await build({entryPoints:['work/axo-reown-entry.js'],bundle:true,format:'iife',platform:'browser',target:['es2020'],outfile:'work/axo-reown.bundle.js',resolveExtensions:['.js','.mjs','.ts'],nodePaths,minify:true,legalComments:'none',logLevel:'warning'});
console.log('Reown browser bundle built.');
