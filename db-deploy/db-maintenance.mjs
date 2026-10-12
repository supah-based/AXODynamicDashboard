import {DurableStore,applyMigrations} from '../work/axo-durable-store.mjs';
import {importPublicDirectory} from '../work/axo-import-public.mjs';
const store=await DurableStore.fromEnv();if(!store.pool)throw Error('Explicit private socket DB settings required');try{
 if(process.argv[2]==='migrate')console.log('Applied/verified migrations:',await applyMigrations(store.pool));
 else if(process.argv[2]==='import')console.log(JSON.stringify(await importPublicDirectory({store})));
 else if(process.argv[2]==='retain')console.log(JSON.stringify(await store.retain()));
 else throw Error('Usage: node db-deploy/db-maintenance.mjs migrate|import|retain');
}finally{await store.close()}
