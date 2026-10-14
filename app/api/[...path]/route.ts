import { NextRequest,NextResponse } from 'next/server';
import {randomUUID,randomBytes,createHash,scryptSync,timingSafeEqual} from 'node:crypto';
import {db,passwordHash,audit,ensureDatabase,databaseScope} from '../../../lib/db';
import {forecast,pack,type Product,type Rules} from '../../../lib/engine';
import {z} from 'zod';
import {preferencesSchema,recommend,assistedAnswer,type Preferences} from '../../../lib/intelligence';
import {syncDiscovery,discovered} from '../../../lib/discovery';
export const runtime='nodejs';
type User={id:string;email:string;name:string;role:string;password:string};
const limits=new Map<string,{count:number;until:number}>();
async function current(req:NextRequest){const token=req.cookies.get('gharbox_session')?.value;if(!token)return;return (await db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.userId WHERE token=? AND expires>?').get(createHash('sha256').update(token).digest('hex'),Date.now())) as User|undefined;}
async function household(id:string){return (await db.prepare('SELECT * FROM households WHERE userId=? ORDER BY rowid DESC LIMIT 1').get(id)) as Record<string,string|number>|undefined;}
async function quote(id:string){const h=(await household(id));if(!h)throw Error('Set up your household first');const r=(await db.prepare('SELECT * FROM destinations WHERE code=?').get(h.destination)) as Rules;const rows=(await db.prepare('SELECT products.*,baskets.quantity,baskets.reason FROM baskets JOIN products ON products.id=baskets.productId WHERE userId=?').all(id)) as (Product&{quantity:number})[];return {...pack(rows.map(p=>({product:p,quantity:p.quantity})),r),items:rows,household:h};}
const productSchema=z.object({id:z.string().min(1).max(50),name:z.string().min(1).max(120),brand:z.string().max(80),category:z.string().max(50),price:z.number().int().positive().max(10000000),stock:z.number().int().min(0).max(100000),weight:z.number().positive().max(100),l:z.number().positive().max(200),w:z.number().positive().max(200),h:z.number().positive().max(200),daily:z.number().nonnegative().max(10),emoji:z.string().max(10),pack:z.string().max(30),vegan:z.number().int().min(0).max(1)});
async function handler(req:NextRequest){
try{
await ensureDatabase();
const route=req.nextUrl.pathname.replace('/api/',''),method=req.method,user=(await current(req));
if(route.startsWith('media/')&&method==='GET'){
const media=(await db.prepare('SELECT bytes,mime FROM product_media WHERE productId=?').get(route.slice(6))) as {bytes:Uint8Array;mime:string}|undefined;
if(!media?.bytes)return new NextResponse(null,{status:404});return new NextResponse(new Uint8Array(media.bytes),{headers:{'Content-Type':media.mime,'Cache-Control':'public, max-age=300','X-Content-Type-Options':'nosniff'}});
}
if(method!=='GET'){
 const origin=req.headers.get('origin');if(origin&&new URL(origin).host!==req.headers.get('host'))return NextResponse.json({error:'Origin not permitted'},{status:403});
 if(Number(req.headers.get('content-length')??0)>(route==='admin/media'?3000000:32000))return NextResponse.json({error:'Request too large'},{status:413});
}
let raw='';
if(method!=='GET'&&req.body){const reader=req.body.getReader(),chunks:Uint8Array[]=[];let size=0;const maximum=route==='admin/media'?3000000:32000;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximum){await reader.cancel();return NextResponse.json({error:'Request too large'},{status:413});}chunks.push(value);}raw=Buffer.concat(chunks).toString('utf8');}
const body=method==='GET'?{}:JSON.parse(raw);
if(route==='auth'&&method==='POST'){
const auth=z.object({email:z.string().email().max(200),password:z.string().min(12).max(128),name:z.string().min(1).max(80).optional(),mode:z.enum(['login','register'])}).parse(body);
const key=auth.email.toLowerCase();const limit=limits.get(key)??{count:0,until:Date.now()+600000};if(limit.until<Date.now()){limit.count=0;limit.until=Date.now()+600000;}limit.count++;limits.set(key,limit);if(limit.count>12)return NextResponse.json({error:'Too many attempts. Try again in 10 minutes.'},{status:429});
let account=(await db.prepare('SELECT * FROM users WHERE email=?').get(key)) as User|undefined;
if(auth.mode==='register'){if(account)throw Error('Unable to register this email');const id=randomUUID();(await db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(id,key,auth.name??'Friend',passwordHash(auth.password),'customer'));account=(await db.prepare('SELECT * FROM users WHERE id=?').get(id)) as User;(await db.prepare('INSERT INTO subscriptions(userId) VALUES(?)').run(id));}
else{if(!account)throw Error('Invalid email or password');const [salt,hash]=account.password.split(':');if(!timingSafeEqual(Buffer.from(hash,'hex'),scryptSync(auth.password,salt,64)))throw Error('Invalid email or password');}
const token=randomBytes(32).toString('hex');(await db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),account.id,Date.now()+7*86400000));
const res=NextResponse.json({ok:true});res.cookies.set('gharbox_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:604800});return res;
}
if(route==='catalog'&&method==='GET')return NextResponse.json({products:(await db.prepare("SELECT products.*, CASE WHEN product_media.bytes IS NOT NULL THEN '/api/media/'||products.id ELSE product_media.imageUrl END AS imageUrl,product_media.credit,product_media.sourceUrl FROM products LEFT JOIN product_media ON product_media.productId=products.id").all()),destinations:(await db.prepare('SELECT * FROM destinations ORDER BY name').all())});
if(route==='discover'&&method==='GET'){await syncDiscovery();return NextResponse.json((await discovered()));}
if(route==='me'&&method==='GET')return NextResponse.json({user:user?{id:user.id,name:user.name,email:user.email,role:user.role}:null});
if(!user)return NextResponse.json({error:'Please sign in'},{status:401});
if(route==='onboarding'&&method==='GET'){
const saved=(await db.prepare('SELECT * FROM onboarding WHERE userId=?').get(user.id)) as {answers:string;step:number;complete:number}|undefined;
return NextResponse.json(saved?{...saved,answers:JSON.parse(saved.answers)}:{step:0,complete:0,answers:preferencesSchema.parse({})});
}
if(route==='onboarding'&&method==='POST'){
const input=z.object({step:z.number().int().min(0).max(5),complete:z.boolean(),answers:preferencesSchema}).parse(body);const p=input.answers;
if(input.complete&&(!p.recipient.trim()||p.address.trim().length<8))throw Error('Add a recipient and a complete delivery address before finishing');
if(!(await db.prepare('SELECT code FROM destinations WHERE code=? AND active=1').get(p.destination)))throw Error('Destination unavailable');
(await db.exec('BEGIN IMMEDIATE'));try{
(await db.prepare('INSERT INTO onboarding(userId,step,complete,answers) VALUES(?,?,?,?) ON CONFLICT(userId) DO UPDATE SET step=excluded.step,complete=excluded.complete,answers=excluded.answers,updated=CURRENT_TIMESTAMP').run(user.id,input.step,input.complete?1:0,JSON.stringify(p)));
if(input.complete){const h=(await household(user.id));(await db.prepare('INSERT INTO households VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,recipient=excluded.recipient,address=excluded.address,destination=excluded.destination,adults=excluded.adults,children=excluded.children,budget=excluded.budget,days=excluded.days,vegan=excluded.vegan').run(h?.id??randomUUID(),user.id,p.householdName,p.recipient,p.address,p.destination,p.adults,p.children,p.budget,p.days,p.diet==='vegan'?1:0));}
(await db.exec('COMMIT'));}catch(e){(await db.exec('ROLLBACK'));throw e;}return NextResponse.json({ok:true});
}
if(route==='recommendations'&&method==='GET'){const row=(await db.prepare('SELECT * FROM recommendation_drafts WHERE userId=?').get(user.id)) as {payload:string;created:string}|undefined;return NextResponse.json(row?{...JSON.parse(row.payload),created:row.created}:null);}
if(route==='recommendations'&&method==='POST'){
const saved=(await db.prepare('SELECT answers,complete FROM onboarding WHERE userId=?').get(user.id)) as {answers:string;complete:number}|undefined;
if(!saved?.complete)throw Error('Finish your household conversation before generating suggestions');
const products=((await db.prepare('SELECT products.*,product_facts.allergens,product_facts.ingredientsVerified FROM products LEFT JOIN product_facts ON products.id=product_facts.productId').all()) as (Product&{allergens?:string;ingredientsVerified?:number})[]).map(p=>({...p,allergens:JSON.parse(p.allergens??'[]'),ingredientsVerified:!!p.ingredientsVerified}));
const suggestions=recommend(products,preferencesSchema.parse(JSON.parse(saved.answers)));
(await db.prepare('INSERT INTO recommendation_drafts(userId,payload) VALUES(?,?) ON CONFLICT(userId) DO UPDATE SET payload=excluded.payload,created=CURRENT_TIMESTAMP').run(user.id,JSON.stringify(suggestions)));
return NextResponse.json(suggestions);
}
if(route==='recommendations/selection'&&method==='POST'){
const {selected}=z.object({selected:z.record(z.number().int().min(0).max(100))}).parse(body);
const row=(await db.prepare('SELECT payload FROM recommendation_drafts WHERE userId=?').get(user.id)) as {payload:string}|undefined;if(!row)throw Error('Generate suggestions first');
const draft=JSON.parse(row.payload) as {items:{productId:string}[];selected?:Record<string,number>};
if(Object.keys(selected).some(id=>!draft.items.some(item=>item.productId===id)))throw Error('A selected product is not in this suggestion draft');
(await db.prepare('UPDATE recommendation_drafts SET payload=? WHERE userId=?').run(JSON.stringify({...draft,selected}),user.id));return NextResponse.json({ok:true});
}
if(route==='recommendations/apply'&&method==='POST'){
const input=z.object({items:z.array(z.object({productId:z.string(),quantity:z.number().int().min(1).max(100)})).min(1).max(100)}).parse(body);
if(new Set(input.items.map(p=>p.productId)).size!==input.items.length)throw Error('Duplicate products in approval');
const saved=(await db.prepare('SELECT answers,complete FROM onboarding WHERE userId=?').get(user.id)) as {answers:string;complete:number}|undefined;if(!saved?.complete)throw Error('Complete onboarding first');
const preferences=preferencesSchema.parse(JSON.parse(saved.answers));
const products=((await db.prepare('SELECT products.*,product_facts.allergens,product_facts.ingredientsVerified FROM products LEFT JOIN product_facts ON products.id=product_facts.productId').all()) as (Product&{allergens?:string;ingredientsVerified?:number})[]).map(p=>({...p,allergens:JSON.parse(p.allergens??'[]'),ingredientsVerified:!!p.ingredientsVerified}));
const fresh=recommend(products,preferences);let subtotal=0;
for(const line of input.items){const item=fresh.items.find(i=>i.productId===line.productId);if(!item||line.quantity>item.product.stock)throw Error('Suggestions changed; regenerate and review');subtotal+=line.quantity*item.product.price;}
if(subtotal>preferences.budget)throw Error('Selected quantities exceed your product budget');
(await db.exec('BEGIN IMMEDIATE'));try{(await db.prepare('DELETE FROM baskets WHERE userId=?').run(user.id));for(const line of input.items){const item=fresh.items.find(p=>p.productId===line.productId)!;(await db.prepare('INSERT INTO baskets VALUES(?,?,?,?)').run(user.id,line.productId,line.quantity,'Buyer approved · '+item.reason));}const prior=(await db.prepare('SELECT payload FROM recommendation_drafts WHERE userId=?').get(user.id)) as {payload:string}|undefined;if(prior)(await db.prepare('UPDATE recommendation_drafts SET payload=? WHERE userId=?').run(JSON.stringify({...JSON.parse(prior.payload),selected:Object.fromEntries(input.items.map(i=>[i.productId,i.quantity]))}),user.id));const q=(await quote(user.id));(await db.exec('COMMIT'));return NextResponse.json(q);}catch(e){(await db.exec('ROLLBACK'));throw e;}
}
if(route==='assistant'&&method==='GET')return NextResponse.json({messages:(await db.prepare('SELECT role,content,mode,created FROM (SELECT * FROM assistant_messages WHERE userId=? ORDER BY rowid DESC LIMIT 30) ORDER BY created').all(user.id)),aiConfigured:!!process.env.AI_GATEWAY_URL&&!!process.env.AI_GATEWAY_KEY});
if(route==='assistant'&&method==='POST'){
const {message}=z.object({message:z.string().min(1).max(1000)}).parse(body);
const recent=(await db.prepare("SELECT count(*) n FROM assistant_messages WHERE userId=? AND role='user' AND created>datetime('now','-1 minute')").get(user.id)) as {n:number};if(recent.n>=10)return NextResponse.json({error:'Please wait a moment before asking more questions'},{status:429});
const saved=(await db.prepare('SELECT answers FROM onboarding WHERE userId=?').get(user.id)) as {answers:string}|undefined;
const response=await assistedAnswer(message,saved?preferencesSchema.parse(JSON.parse(saved.answers)):undefined);
const insert=db.prepare('INSERT INTO assistant_messages(id,userId,role,content,mode) VALUES(?,?,?,?,?)');(await insert.run(randomUUID(),user.id,'user',message,'user'));(await insert.run(randomUUID(),user.id,'assistant',response.message,response.mode));return NextResponse.json(response);
}
if(route==='logout'&&method==='POST'){(await db.prepare('DELETE FROM sessions WHERE userId=?').run(user.id));const res=NextResponse.json({ok:true});res.cookies.delete('gharbox_session');return res;}
if(route==='dashboard'&&method==='GET')return NextResponse.json({onboarding:(await db.prepare('SELECT complete,step FROM onboarding WHERE userId=?').get(user.id))??null,households:(await db.prepare('SELECT * FROM households WHERE userId=?').all(user.id)),basket:(await household(user.id))?(await quote(user.id)):null,orders:(await db.prepare('SELECT * FROM orders WHERE userId=? ORDER BY created DESC').all(user.id)),requests:(await db.prepare('SELECT * FROM requests WHERE userId=?').all(user.id)),subscription:(await db.prepare('SELECT * FROM subscriptions WHERE userId=?').get(user.id)),notifications:(await db.prepare('SELECT * FROM notifications WHERE userId=? ORDER BY created DESC LIMIT 20').all(user.id))});
if(route==='households'&&method==='POST'){
const h=z.object({id:z.string().optional(),name:z.string().min(1).max(80),recipient:z.string().min(1).max(80),address:z.string().min(8).max(400),destination:z.string().length(2),adults:z.number().int().min(1).max(20),children:z.number().int().min(0).max(20),budget:z.number().int().min(100).max(10000000),days:z.number().int().min(7).max(90),vegan:z.number().int().min(0).max(1)}).parse(body);
if(!(await db.prepare('SELECT code FROM destinations WHERE code=? AND active=1').get(h.destination)))throw Error('Destination unavailable');
if(h.id&&!(await db.prepare('SELECT id FROM households WHERE id=? AND userId=?').get(h.id,user.id)))return NextResponse.json({error:'Forbidden'},{status:403});
(await db.prepare('INSERT INTO households VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,recipient=excluded.recipient,address=excluded.address,destination=excluded.destination,adults=excluded.adults,children=excluded.children,budget=excluded.budget,days=excluded.days,vegan=excluded.vegan').run(h.id??randomUUID(),user.id,h.name,h.recipient,h.address,h.destination,h.adults,h.children,h.budget,h.days,h.vegan));
const prior=(await db.prepare('SELECT answers FROM onboarding WHERE userId=?').get(user.id)) as {answers:string}|undefined;
if(prior){const answers=preferencesSchema.parse(JSON.parse(prior.answers));(await db.prepare('UPDATE onboarding SET answers=?,updated=CURRENT_TIMESTAMP WHERE userId=?').run(JSON.stringify({...answers,householdName:h.name,recipient:h.recipient,address:h.address,destination:h.destination,adults:h.adults,children:h.children,budget:h.budget,days:h.days,diet:h.vegan?'vegan':answers.diet}),user.id));}
return NextResponse.json({ok:true});
}
if(route==='forecast'&&method==='POST'){
const h=(await household(user.id));if(!h)throw Error('Create a household first');
const products=(await db.prepare('SELECT * FROM products').all()) as Product[];
const recommendations=forecast(products,Number(h.adults),Number(h.children),Number(h.days),Number(h.budget),!!h.vegan);
(await db.exec('BEGIN IMMEDIATE'));try{(await db.prepare('DELETE FROM baskets WHERE userId=?').run(user.id));for(const r of recommendations)(await db.prepare('INSERT INTO baskets VALUES(?,?,?,?)').run(user.id,r.productId,r.quantity,r.reason));(await db.exec('COMMIT'));}catch(e){(await db.exec('ROLLBACK'));throw e;}return NextResponse.json((await quote(user.id)));
}
if(route==='basket'&&method==='POST'){
const b=z.object({productId:z.string(),quantity:z.number().int().min(0).max(100)}).parse(body);const p=(await db.prepare('SELECT * FROM products WHERE id=?').get(b.productId)) as Product|undefined;if(!p||b.quantity>p.stock)throw Error('Product unavailable or insufficient stock');
if(b.quantity===0)(await db.prepare('DELETE FROM baskets WHERE userId=? AND productId=?').run(user.id,b.productId));else (await db.prepare('INSERT INTO baskets VALUES(?,?,?,?) ON CONFLICT(userId,productId) DO UPDATE SET quantity=excluded.quantity,reason=excluded.reason').run(user.id,b.productId,b.quantity,'Customer selected'));return NextResponse.json((await quote(user.id)));
}
if(route==='requests'&&method==='POST'){const r=z.object({name:z.string().min(2).max(120),brand:z.string().max(80).default(''),comments:z.string().max(1000).default('')}).parse(body);(await db.prepare('INSERT INTO requests(id,userId,name,brand,comments) VALUES(?,?,?,?,?)').run(randomUUID(),user.id,r.name,r.brand,r.comments));return NextResponse.json({ok:true});}
if(route==='subscriptions'&&method==='POST'){const s=z.object({status:z.enum(['active','paused','cancelled','skipped']),consent:z.boolean(),intervalDays:z.number().int().min(7).max(90)}).parse(body);if(s.status==='active'&&!s.consent)throw Error('Explicit approval is required');(await db.prepare('INSERT INTO subscriptions VALUES(?,?,?,?,?) ON CONFLICT(userId) DO UPDATE SET status=excluded.status,intervalDays=excluded.intervalDays,nextDate=excluded.nextDate,consent=excluded.consent').run(user.id,s.status,s.intervalDays,new Date(Date.now()+s.intervalDays*86400000).toISOString(),s.consent?1:0));return NextResponse.json({ok:true});}
if(route==='orders'&&method==='POST'){
const {idempotency}=z.object({idempotency:z.string().uuid()}).parse(body);
(await db.exec('BEGIN IMMEDIATE'));try{
const existing=(await db.prepare('SELECT * FROM orders WHERE userId=? AND idempotency=?').get(user.id,idempotency));if(existing){(await db.exec('COMMIT'));return NextResponse.json(existing);}
const q=(await quote(user.id));if(q.items.length===0)throw Error('Your basket is empty');if(q.household.destination!=='NP')throw Error('International and overseas local routes await approved compliance, pricing and carrier setup. Use Nepal for the sample workflow.');
if(process.env.ENABLE_SAMPLE_ORDERS!=='true')throw Error('Sample ordering is disabled; configure a live payment provider before accepting paid orders.');
const id=randomUUID();for(const p of q.items){const result=(await db.prepare('UPDATE products SET stock=stock-? WHERE id=? AND stock>=?').run(p.quantity,p.id,p.quantity));if(result.changes!==1)throw Error('Stock changed; refresh your basket');}
(await db.prepare('INSERT INTO orders(id,userId,householdId,status,total,currency,snapshot,idempotency) VALUES(?,?,?,?,?,?,?,?)').run(id,user.id,q.household.id,'sample_confirmed',q.total,q.currency,JSON.stringify(q),idempotency));
(await db.prepare('INSERT INTO notifications(id,userId,message) VALUES(?,?,?)').run(randomUUID(),user.id,`Sample order ${id.slice(0,8)} confirmed. No payment was collected.`));(await audit(user.id,'order.created',{id,total:q.total,sample:true}));(await db.exec('COMMIT'));return NextResponse.json({id});
}catch(e){(await db.exec('ROLLBACK'));throw e;}
}
if(route.startsWith('admin/')){
if(user.role!=='admin')return NextResponse.json({error:'Administrator permission required'},{status:403});
if(route==='admin/discovery'&&method==='POST'){const result=await syncDiscovery(true);(await audit(user.id,'discovery.refreshed',result));return NextResponse.json({...result,...(await discovered())});}
if(route==='admin/media'&&method==='POST'){
const input=z.object({productId:z.string(),imageUrl:z.string().url().optional(),imageData:z.string().max(2800000).optional(),credit:z.string().min(2).max(200),sourceUrl:z.string().url().optional()}).refine(i=>!!i.imageUrl!==!!i.imageData,'Choose upload or image URL').parse(body);
if(!(await db.prepare('SELECT id FROM products WHERE id=?').get(input.productId)))throw Error('Product not found');
let bytes:Buffer|null=null,mime:string|null=null;
if(input.imageData){const match=input.imageData.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);if(!match)throw Error('Upload a JPEG, PNG or WebP photo');bytes=Buffer.from(match[2],'base64');mime=match[1];if(bytes.length>2000000)throw Error('Maximum photo size is 2 MB');const isPng=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),isJpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,isWebp=bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';if(!(mime==='image/png'&&isPng||mime==='image/jpeg'&&isJpeg||mime==='image/webp'&&isWebp))throw Error('Photo content does not match the file type');}
if(input.imageUrl&&new URL(input.imageUrl).protocol!=='https:')throw Error('Image URL must use HTTPS');
if(input.sourceUrl&&new URL(input.sourceUrl).protocol!=='https:')throw Error('Source page URL must use HTTPS');
(await db.prepare('INSERT INTO product_media(productId,imageUrl,bytes,mime,credit,sourceUrl) VALUES(?,?,?,?,?,?) ON CONFLICT(productId) DO UPDATE SET imageUrl=excluded.imageUrl,bytes=excluded.bytes,mime=excluded.mime,credit=excluded.credit,sourceUrl=excluded.sourceUrl,updated=CURRENT_TIMESTAMP').run(input.productId,input.imageUrl??null,bytes,mime,input.credit,input.sourceUrl??null));(await audit(user.id,'product.photo.updated',{productId:input.productId,credit:input.credit}));return NextResponse.json({ok:true});
}
if(route==='admin/facts'&&method==='POST'){const f=z.object({productId:z.string(),allergens:z.array(z.string().max(40)).max(20),ingredientsVerified:z.boolean()}).parse(body);if(!(await db.prepare('SELECT id FROM products WHERE id=?').get(f.productId)))throw Error('Product not found');(await db.prepare('INSERT INTO product_facts VALUES(?,?,?) ON CONFLICT(productId) DO UPDATE SET allergens=excluded.allergens,ingredientsVerified=excluded.ingredientsVerified').run(f.productId,JSON.stringify(f.allergens),f.ingredientsVerified?1:0));(await audit(user.id,'product.ingredients.reviewed',f));return NextResponse.json({ok:true});}
if(route==='admin/overview'&&method==='GET')return NextResponse.json({products:(await db.prepare('SELECT * FROM products').all()),destinations:(await db.prepare('SELECT * FROM destinations').all()),orders:(await db.prepare('SELECT orders.*,users.name FROM orders JOIN users ON users.id=orders.userId ORDER BY created DESC').all()),requests:(await db.prepare('SELECT * FROM requests').all()),audit:(await db.prepare('SELECT * FROM audit ORDER BY created DESC LIMIT 50').all())});
if(route==='admin/products'&&method==='POST'){const p=productSchema.parse(body);(await db.prepare('INSERT INTO products VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,brand=excluded.brand,category=excluded.category,price=excluded.price,stock=excluded.stock,weight=excluded.weight,l=excluded.l,w=excluded.w,h=excluded.h,daily=excluded.daily,emoji=excluded.emoji,pack=excluded.pack,vegan=excluded.vegan').run(p.id,p.name,p.brand,p.category,p.price,p.stock,p.weight,p.l,p.w,p.h,p.daily,p.emoji,p.pack,p.vegan));(await audit(user.id,'product.updated',p));return NextResponse.json({ok:true});}
if(route==='admin/destinations'&&method==='POST'){const r=z.object({code:z.string().regex(/^[A-Z]{2}$/),name:z.string().min(2).max(100),currency:z.string().length(3),active:z.number().int().min(0).max(1),maxWeight:z.number().min(1).max(50),length:z.number().min(5).max(100),width:z.number().min(5).max(100),height:z.number().min(5).max(100),divisor:z.number().min(1000).max(10000),baseRate:z.number().int().nonnegative(),kgRate:z.number().int().nonnegative(),region:z.string().max(40)}).parse(body);(await db.prepare('INSERT INTO destinations VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name,currency=excluded.currency,active=excluded.active,maxWeight=excluded.maxWeight,length=excluded.length,width=excluded.width,height=excluded.height,divisor=excluded.divisor,baseRate=excluded.baseRate,kgRate=excluded.kgRate,region=excluded.region').run(r.code,r.name,r.currency,r.active,r.maxWeight,r.length,r.width,r.height,r.divisor,r.baseRate,r.kgRate,r.region));(await audit(user.id,'destination.updated',r));return NextResponse.json({ok:true});}
if(route==='admin/requests'&&method==='POST'){const r=z.object({id:z.string().uuid(),status:z.enum(['submitted','under review','sourcing','approved','unavailable','completed'])}).parse(body);(await db.prepare('UPDATE requests SET status=? WHERE id=?').run(r.status,r.id));(await audit(user.id,'request.reviewed',r));return NextResponse.json({ok:true});}
if(route==='admin/orders'&&method==='POST'){const r=z.object({id:z.string().uuid(),status:z.enum(['picking','packed','dispatched','delivered'])}).parse(body);const prior=(await db.prepare('SELECT status,userId FROM orders WHERE id=?').get(r.id)) as {status:string;userId:string}|undefined;const states=['sample_confirmed','picking','packed','dispatched','delivered'];if(!prior||states.indexOf(r.status)!==states.indexOf(prior.status)+1)throw Error('Invalid order state transition');(await db.prepare('UPDATE orders SET status=? WHERE id=?').run(r.status,r.id));(await audit(user.id,'order.status',r));(await db.prepare('INSERT INTO notifications(id,userId,message) VALUES(?,?,?)').run(randomUUID(),prior.userId,`Order ${r.id.slice(0,8)}: ${r.status}`));return NextResponse.json({ok:true});}
}
return NextResponse.json({error:'Endpoint not found'},{status:404});
}catch(error){return NextResponse.json({error:error instanceof z.ZodError?'Please check the supplied fields':error instanceof Error?error.message:'Request failed'},{status:400});}
}
const scopedHandler=(req:NextRequest)=>databaseScope(()=>handler(req));
export {scopedHandler as GET,scopedHandler as POST};




