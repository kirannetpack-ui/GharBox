import {db} from './db';
import {z} from 'zod';
const upstream=z.object({products:z.array(z.object({code:z.string(),product_name:z.string().nullish(),brands:z.string().nullish(),quantity:z.string().nullish(),categories_tags:z.array(z.string()).nullish(),image_front_url:z.string().nullish(),allergens_tags:z.array(z.string()).nullish(),origins:z.string().nullish()}).passthrough()).max(100)});
export function commodityCategory(tags:string[]){const joined=tags.join(' ').toLowerCase();if(/noodle|pasta/.test(joined))return 'Noodles & quick meals';if(/tea|coffee/.test(joined))return 'Tea & beverages';if(/rice|grain|cereal|flour/.test(joined))return 'Grains & flours';if(/pickle|sauce|condiment/.test(joined))return 'Pickles & condiments';if(/oil|ghee/.test(joined))return 'Oils & ghee';if(/lentil|pulse|bean/.test(joined))return 'Lentils & pulses';if(/snack|biscuit|chocolate/.test(joined))return 'Snacks & treats';if(/beverage|juice|water/.test(joined))return 'Tea & beverages';return 'Nepal market finds';}
type SyncResult={cached?:boolean;count?:number;error?:string};
let active:Promise<SyncResult>|undefined;
export async function syncDiscovery(force=false):Promise<SyncResult>{
 if(active)return active;
 const last=db.prepare("SELECT updated FROM discovery_runs WHERE id=1").get() as {updated:number}|undefined;
 if(!force&&last&&Date.now()-last.updated<86400000)return {cached:true};
 if(force&&last&&Date.now()-last.updated<60000)throw Error('Please wait one minute before refreshing the product source again');
 active=(async()=>{
 try{
 const url='https://world.openfoodfacts.org/api/v2/search?countries_tags_en=nepal&page_size=100&fields=code,product_name,brands,quantity,categories_tags,image_front_url,allergens_tags,origins';
 const res=await fetch(url,{headers:{'User-Agent':process.env.PRODUCT_SOURCE_USER_AGENT??'GharBox/0.2 (local research prototype)'},signal:AbortSignal.timeout(18000),cache:'no-store'});
 if(!res.ok)throw Error(`Product source responded ${res.status}`);const data=upstream.parse(await res.json());let count=0;
 const insert=db.prepare('INSERT INTO discoveries(code,name,brand,category,pack,imageUrl,sourceUrl,source,origin,allergens,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name,brand=excluded.brand,category=excluded.category,pack=excluded.pack,imageUrl=excluded.imageUrl,origin=excluded.origin,allergens=excluded.allergens,updated=excluded.updated');
 db.exec('BEGIN IMMEDIATE');try{
 for(const p of data.products){if(!/^\d{8,14}$/.test(p.code)||!p.product_name||/^\d+$/.test(p.product_name)||!p.image_front_url)continue;const image=new URL(p.image_front_url);if(image.protocol!=='https:'||image.hostname!=='images.openfoodfacts.org')continue;
 insert.run(p.code,p.product_name.slice(0,200),p.brands?.slice(0,150)??'Brand not supplied',commodityCategory(p.categories_tags??[]),p.quantity?.slice(0,80)??'Pack size to verify',image.href,`https://world.openfoodfacts.org/product/${p.code}`,'Open Food Facts',p.origins?.slice(0,120)??'Origin not verified',JSON.stringify(p.allergens_tags??[]),Date.now());count++;}
 db.prepare('INSERT INTO discovery_runs VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,status=excluded.status,detail=excluded.detail').run(Date.now(),'success',`${count} source records refreshed`);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 return {count};
 }catch(e){db.prepare('INSERT INTO discovery_runs VALUES(1,?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,status=excluded.status,detail=excluded.detail').run(Date.now(),'unavailable','Source unavailable. Previously fetched records remain visible.');return {error:'Product source unavailable; cached discoveries retained'};}
 })().finally(()=>{active=undefined});return active;
}
export function discovered(){return {products:db.prepare('SELECT * FROM discoveries ORDER BY CASE WHEN lower(brand) LIKE \'%wai%\' OR lower(brand) LIKE \'%yashoda%\' OR lower(brand) LIKE \'%asian thai%\' THEN 0 ELSE 1 END,name').all(),run:db.prepare('SELECT * FROM discovery_runs WHERE id=1').get(),attribution:'Product metadata: Open Food Facts (ODbL). Product images: contributors, CC BY-SA. Nepal market listing does not verify Nepal origin, availability or import eligibility.'};}


