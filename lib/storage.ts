import {createClient,type Client,type Transaction,type InValue} from '@libsql/client';
import {AsyncLocalStorage} from 'node:async_hooks';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

type Scope={transaction?:Transaction};
const scopes=new AsyncLocalStorage<Scope>();
let client:Client|undefined;
function connection(){
 if(client)return client;
 const url=process.env.TURSO_DATABASE_URL;
 if(process.env.VERCEL&&!url)throw Error('Persistent database is not configured');
 const path=resolve(process.env.DATABASE_PATH??'data/gharbox.sqlite');
 if(!url)mkdirSync(dirname(path),{recursive:true});
 client=createClient({url:url??`file:${path.replaceAll('\\','/')}`,authToken:process.env.TURSO_AUTH_TOKEN});
 return client;
}
export function databaseScope<T>(work:()=>Promise<T>){return scopes.run({},async()=>{try{return await work();}finally{const tx=scopes.getStore()?.transaction;if(tx&&!tx.closed)await tx.rollback();}});}
function executor(){return scopes.getStore()?.transaction??connection();}
function row(value:Record<string,unknown>,columns:string[]){return Object.fromEntries(columns.map((key,index)=>{const v=value[index];return [key,v instanceof ArrayBuffer?new Uint8Array(v):v];}));}
export const db={
 async batch(statements:{sql:string;args:InValue[]}[]){await executor().batch(statements);},
 prepare(sql:string){
  const execute=(args:unknown[])=>executor().execute({sql,args:args.map(v=>v===undefined?null:v) as InValue[]});
  return {
   async get(...args:unknown[]):Promise<any>{const result=await execute(args);return result.rows[0]?row(result.rows[0],result.columns):undefined;},
   async all(...args:unknown[]):Promise<any[]>{const result=await execute(args);return result.rows.map(value=>row(value,result.columns));},
   async run(...args:unknown[]){const result=await execute(args);return {changes:result.rowsAffected};}
  };
 },
 async exec(sql:string){
  const context=scopes.getStore();
  if(/^BEGIN/i.test(sql)){if(!context||context.transaction)throw Error('Invalid transaction scope');context.transaction=await connection().transaction('write');return;}
  if(/^(COMMIT|ROLLBACK)$/i.test(sql)){const tx=context?.transaction;if(!tx)return;try{if(/^COMMIT/i.test(sql))await tx.commit();else await tx.rollback();}finally{context!.transaction=undefined;}return;}
  await executor().executeMultiple(sql.replace(/PRAGMA journal_mode=WAL;/gi,''));
 }
};
