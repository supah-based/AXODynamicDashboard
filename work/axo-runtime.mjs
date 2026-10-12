import {createRequire} from 'node:module';import path from 'node:path';import os from 'node:os';
const require=createRequire(import.meta.url);
// Normal npm dependencies first; the existing local Codex runtime is a dev fallback.
export function runtimeDependency(name){if(!['sax','playwright'].includes(name))throw new Error('Unknown runtime dependency');try{return require(name)}catch{const base=process.env.AXO_DEPENDENCIES_DIR||path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules');return require(path.join(base,name))}}
