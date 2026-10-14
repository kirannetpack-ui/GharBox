import {spawn} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
const directory=mkdtempSync(join(tmpdir(),'gharbox-integration-'));
const email='integration-admin@example.com',password=randomBytes(24).toString('hex'),base='http://127.0.0.1:3002';
const env={...process.env,DATABASE_PATH:join(directory,'test.sqlite'),ENABLE_SAMPLE_ORDERS:'true',ADMIN_EMAIL:email,ADMIN_PASSWORD:password};
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3002'],{env,stdio:'ignore'});
try{
let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/catalog')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
if(!ready)throw Error('Test server failed to start');
const test=spawn(process.execPath,['scripts/smoke.mjs'],{env:{...env,BASE_URL:base,TEST_ADMIN_EMAIL:email,TEST_ADMIN_PASSWORD:password},stdio:'inherit'});
const code=await new Promise(resolve=>test.once('exit',resolve));if(code!==0)process.exitCode=1;
}finally{server.kill();console.log('Isolated integration database retained for diagnosis:',directory);}

