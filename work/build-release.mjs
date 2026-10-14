import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createReleaseMetadata} from './axo-release.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),service=await createReleaseMetadata({root}),m=await service.snapshot();
await fs.writeFile(path.join(root,'axo-build.json'),JSON.stringify({version:m.version,commit:m.commit,dirty:m.dirty,assetHash:m.assetHash,builtAt:Date.now()},null,2));
console.log(JSON.stringify({version:m.version,commit:m.shortCommit,state:m.state}));
