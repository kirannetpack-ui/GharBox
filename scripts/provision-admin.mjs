import {createClient} from '@libsql/client';
import {randomUUID,randomBytes,scryptSync} from 'node:crypto';
import {writeFileSync} from 'node:fs';

const email=process.argv[2]?.trim().toLowerCase();
if(!email||!/^\S+@\S+\.\S+$/.test(email))throw Error('Supply the explicitly authorized administrator email');
if(!process.env.TURSO_DATABASE_URL||!process.env.TURSO_AUTH_TOKEN)throw Error('Load private Turso environment variables first');
const db=createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN});
const tx=await db.transaction('write');
let password,created=false;
try{
 const account=(await tx.execute({sql:'SELECT id,role FROM users WHERE email=?',args:[email]})).rows[0];
 const id=account?.id??randomUUID();
 if(account){await tx.execute({sql:"UPDATE users SET role='admin' WHERE id=?",args:[id]});}
 else{
  created=true;password=randomBytes(24).toString('base64url');const salt=randomBytes(16).toString('hex');
  const hash=`${salt}:${scryptSync(password,salt,64).toString('hex')}`;
  // Save the recovery information before committing the new account. Never overwrite existing credentials.
  writeFileSync('.env.admin.local',`# Private GharBox administrator login. Do not commit or share this file.\n# Sign in at https://gharbox.vercel.app using the existing-account form.\nADMIN_EMAIL=${email}\nADMIN_PASSWORD=${password}\n`,{flag:'wx',mode:0o600});
  await tx.execute({sql:'INSERT INTO users VALUES(?,?,?,?,?)',args:[id,email,'GharBox Administrator',hash,'admin']});
  await tx.execute({sql:'INSERT INTO subscriptions(userId) VALUES(?)',args:[id]});
 }
 await tx.execute({sql:'INSERT INTO audit(id,actor,action,detail) VALUES(?,?,?,?)',args:[randomUUID(),id,'account.admin.provisioned',JSON.stringify({email,created,source:'Owner-authorized operational provisioning'})]});
 await tx.commit();
 const base='https://gharbox.vercel.app';
 if(created){
  const response=await fetch(base+'/api/auth',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({mode:'login',email,password})});
  if(!response.ok)throw Error('Account committed, but live login verification failed. Credentials remain in the private file.');
  const cookie=response.headers.get('set-cookie')?.split(';')[0];
  const check=await fetch(base+'/api/admin/catalogue',{headers:{Cookie:cookie??''}});
  if(!check.ok)throw Error('Account committed, but admin API verification failed.');
  await fetch(base+'/api/logout',{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie??''},body:'{}'});
 }
 console.log(created?'Administrator created; live login and catalogue access verified. Credentials saved in .env.admin.local.':'Existing account promoted to administrator; password unchanged. Sign out and sign in to refresh the interface.');
}catch(e){if(!tx.closed)await tx.rollback();throw e;}finally{db.close();}
