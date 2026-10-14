import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {db,databaseScope} from '../lib/storage.ts';

test('libSQL preserves named length columns, blobs, and transaction rollback',async()=>{
 process.env.DATABASE_PATH=join(mkdtempSync(join(tmpdir(),'gharbox-storage-')),'test.sqlite');
 await databaseScope(async()=>{
  await db.exec('CREATE TABLE fixture(id INTEGER PRIMARY KEY,length REAL,bytes BLOB)');
  await db.prepare('INSERT INTO fixture VALUES(?,?,?)').run(1,40,new Uint8Array([1,2,3]));
  const row=await db.prepare('SELECT * FROM fixture').get();
  assert.equal(row.length,40);
  assert.deepEqual(Array.from(row.bytes),[1,2,3]);
 });
 await assert.rejects(databaseScope(async()=>{
  await db.exec('BEGIN IMMEDIATE');
  await db.prepare('UPDATE fixture SET length=99').run();
  throw Error('rollback this request');
 }));
 assert.equal((await db.prepare('SELECT length FROM fixture').get()).length,40);
 await databaseScope(async()=>{await db.exec('BEGIN IMMEDIATE');await db.prepare('UPDATE fixture SET length=41').run();await db.exec('COMMIT');});
 assert.equal((await db.prepare('SELECT length FROM fixture').get()).length,41);
});
