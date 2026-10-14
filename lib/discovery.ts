import {db} from './db';
import {z} from 'zod';
const upstream=z.object({products:z.array(z.object({code:z.string(),product_name:z.string().nullish(),brands:z.string().nullish(),quantity:z.string().nullish(),categories_tags:z.array(z.string()).nullish(),image_front_url:z.string().nullish(),allergens_tags:z.array(z.string()).nullish(),origins:z.string().nullish()}).passthrough()).max(100)});
export function commodityCategory(tags:string[]){const joined=tags.join(' ').toLowerCase();if(/noodle|pasta/.test(joined))return 'Noodles & quick meals';if(/tea|coffee/.test(joined))return 'Tea & beverages';if(/rice|grain|cereal|flour/.test(joined))return 'Grains & flours';if(/pickle|sauce|condiment/.test(joined))return 'Pickles & condiments';if(/oil|ghee/.test(joined))return 'Oils & ghee';if(/lentil|pulse|bean/.test(joined))return 'Lentils & pulses';if(/snack|biscuit|chocolate/.test(joined))return 'Snacks & treats';if(/beverage|juice|water/.test(joined))return 'Tea & beverages';return 'Nepal market finds';}
export function essentialDiscovery(name:string){const n=name.toLowerCase();if(/noodle|biscuit|cookie|choco|candy|juice|nuts|peanut|butter|sugar-free|crisp|cracker|snack|cake|cocktail|yogurt|cereal/.test(n))return false;return /\b(rice|flour|atta|dal|daal|lentil|pulse|beans|chickpea|oil|ghee|salt|turmeric|cumin|coriander|tea|sugar|jaggery|millet|buckwheat|gundruk|pickle|spice|semolina|oats)\b/.test(n)||/चामल|दाल|तेल|नुन|पिठो|चिया|मसला/.test(n);}
type SyncResult={cached?:boolean;count?:number;error?:string};
let active:Promise<SyncResult>|undefined;
export async function syncDiscovery(force=false):Promise<SyncResult>{
 if(active)return active;
 const last=(await db.prepare("SELECT updated FROM discovery_runs WHERE id=2").get()) as {updated:number}|undefined;
 if(!force&&last&&Date.now()-last.updated<86400000)return {cached:true};
 if(force&&last&&Date.now()-last.updated<60000)throw Error('Please wait one minute before refreshing the product source again');
 active=(async()=>{
 try{
 const configured=await db.prepare("SELECT c.searchTag FROM commodities c JOIN categories g ON g.id=c.categoryId WHERE c.id IN ('rice','masoor','mustard-oil','spices','atta','tea') AND c.active=1 AND g.active=1 AND g.essential=1 AND c.searchTag<>''").all();
 const tags=[...new Set(configured.map(c=>String(c.searchTag)))].slice(0,6);
 if(!tags.length)return {count:0};
 const results=await Promise.allSettled(tags.map(async tag=>{const url='https://world.openfoodfacts.org/api/v2/search?countries_tags_en=nepal&categories_tags='+encodeURIComponent('en:'+tag)+'&page_size=100&fields=code,product_name,brands,quantity,categories_tags,image_front_url,allergens_tags,origins';const res=await fetch(url,{headers:{'User-Agent':process.env.PRODUCT_SOURCE_USER_AGENT??'GharBox/0.3 (essentials discovery)'},signal:AbortSignal.timeout(12000),cache:'no-store'});if(!res.ok)throw Error('Product source unavailable');return upstream.parse(await res.json()).products;}));
 const records=results.flatMap(r=>r.status==='fulfilled'?r.value:[]);if(results.every(r=>r.status==='rejected'))throw Error('Product source unavailable');const data={products:[...new Map(records.map(p=>[p.code,p])).values()]};let count=0;
 const sql=('INSERT INTO discoveries(code,name,brand,category,pack,imageUrl,sourceUrl,source,origin,allergens,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name,brand=excluded.brand,category=excluded.category,pack=excluded.pack,imageUrl=excluded.imageUrl,origin=excluded.origin,allergens=excluded.allergens,updated=excluded.updated');
 (await db.exec('BEGIN IMMEDIATE'));try{
 const entries:{sql:string;args:(string|number)[]}[]=[];
 for(const p of data.products){if(!/^\d{8,14}$/.test(p.code)||!p.product_name||/^\d+$/.test(p.product_name)||!p.image_front_url)continue;const image=new URL(p.image_front_url);if(image.protocol!=='https:'||image.hostname!=='images.openfoodfacts.org')continue;
 entries.push({sql,args:[p.code,p.product_name.slice(0,200),p.brands?.slice(0,150)??'Brand not supplied',commodityCategory(p.categories_tags??[]),p.quantity?.slice(0,80)??'Pack size to verify',image.href,`https://world.openfoodfacts.org/product/${p.code}`,'Open Food Facts',p.origins?.slice(0,120)??'Origin not verified',JSON.stringify(p.allergens_tags??[]),Date.now()]});count++;}
 await db.batch(entries);
 (await db.prepare('INSERT INTO discovery_runs VALUES(2,?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,status=excluded.status,detail=excluded.detail').run(Date.now(),results.some(r=>r.status==='rejected')?'partial':'success',`${count} essential source records refreshed; missing staples need supplier review`));(await db.exec('COMMIT'));}catch(e){(await db.exec('ROLLBACK'));throw e;}
 return {count};
 }catch(e){(await db.prepare('INSERT INTO discovery_runs VALUES(2,?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated,status=excluded.status,detail=excluded.detail').run(Date.now(),'unavailable','Source unavailable. Previously fetched records remain visible.'));return {error:'Product source unavailable; cached discoveries retained'};}
 })().finally(()=>{active=undefined});return active;
}
export async function discovered(){const products=await db.prepare('SELECT * FROM discoveries').all();return {products:products.map(p=>({...p,essential:essentialDiscovery(p.name)})).sort((a,b)=>Number(b.essential)-Number(a.essential)||a.name.localeCompare(b.name)),run:await db.prepare('SELECT * FROM discovery_runs WHERE id=2').get(),attribution:'Open Food Facts / ODbL; contributor photographs CC BY-SA. Source records do not establish stock or Nepal origin.'};}


