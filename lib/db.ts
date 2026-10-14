import {migrateCatalogue} from './catalogue';
import {randomUUID,scryptSync,randomBytes} from 'node:crypto';
import {db,databaseScope} from './storage';
export {db,databaseScope};
let ready:Promise<void>|undefined;
export function ensureDatabase(){return ready??=databaseScope(async()=>{try{await db.exec('BEGIN IMMEDIATE');await initialize();await db.exec('COMMIT');}catch(e){await db.exec('ROLLBACK');ready=undefined;throw e;}});}
async function initialize(){
(await db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY,applied TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'customer');
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,userId TEXT REFERENCES users(id),expires INTEGER);
CREATE TABLE IF NOT EXISTS destinations(code TEXT PRIMARY KEY,name TEXT,currency TEXT,active INTEGER DEFAULT 1,maxWeight REAL,length REAL,width REAL,height REAL,divisor REAL,baseRate INTEGER,kgRate INTEGER,region TEXT);
CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,name TEXT,brand TEXT,category TEXT,price INTEGER CHECK(price>0),stock INTEGER CHECK(stock>=0),weight REAL,l REAL,w REAL,h REAL,daily REAL,emoji TEXT,pack TEXT,vegan INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS households(id TEXT PRIMARY KEY,userId TEXT REFERENCES users(id),name TEXT,recipient TEXT,address TEXT,destination TEXT REFERENCES destinations(code),adults INTEGER,children INTEGER,budget INTEGER,days INTEGER,vegan INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS baskets(userId TEXT REFERENCES users(id),productId TEXT REFERENCES products(id),quantity INTEGER CHECK(quantity>0),reason TEXT,PRIMARY KEY(userId,productId));
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,userId TEXT REFERENCES users(id),householdId TEXT REFERENCES households(id),status TEXT,total INTEGER,currency TEXT,snapshot TEXT,idempotency TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP,UNIQUE(userId,idempotency));
CREATE TABLE IF NOT EXISTS requests(id TEXT PRIMARY KEY,userId TEXT REFERENCES users(id),name TEXT,brand TEXT,comments TEXT,status TEXT DEFAULT 'submitted',created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS subscriptions(userId TEXT PRIMARY KEY REFERENCES users(id),status TEXT DEFAULT 'paused',intervalDays INTEGER DEFAULT 30,nextDate TEXT,consent INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS notifications(id TEXT PRIMARY KEY,userId TEXT REFERENCES users(id),message TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,actor TEXT REFERENCES users(id),action TEXT,detail TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS orders_user ON orders(userId,created);
INSERT OR IGNORE INTO migrations(version) VALUES(1);`));
(await db.exec(`
CREATE TABLE IF NOT EXISTS onboarding(userId TEXT PRIMARY KEY REFERENCES users(id),step INTEGER DEFAULT 0,complete INTEGER DEFAULT 0,answers TEXT NOT NULL,updated TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS recommendation_drafts(userId TEXT PRIMARY KEY REFERENCES users(id),payload TEXT NOT NULL,created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS product_media(productId TEXT PRIMARY KEY REFERENCES products(id),imageUrl TEXT,bytes BLOB,mime TEXT,credit TEXT,sourceUrl TEXT,updated TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS product_facts(productId TEXT PRIMARY KEY REFERENCES products(id),allergens TEXT DEFAULT '[]',ingredientsVerified INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS discoveries(code TEXT PRIMARY KEY,name TEXT,brand TEXT,category TEXT,pack TEXT,imageUrl TEXT,sourceUrl TEXT,source TEXT,origin TEXT,allergens TEXT,updated INTEGER);
CREATE TABLE IF NOT EXISTS discovery_runs(id INTEGER PRIMARY KEY,updated INTEGER,status TEXT,detail TEXT);
CREATE TABLE IF NOT EXISTS assistant_messages(id TEXT PRIMARY KEY,userId TEXT REFERENCES users(id),role TEXT,content TEXT,mode TEXT,created TEXT DEFAULT CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO migrations(version) VALUES(2);`));
if(!((await db.prepare('SELECT count(*) n FROM products').get()) as {n:number}).n){
const products=[['rice','Basmati rice','Daawat','Grains',1899,120,5.15,32,22,10,.025,'🌾','5 kg',1],['dal','Red lentils','Aashirvaad','Pulses',649,160,1.05,20,14,7,.018,'🫘','1 kg',1],['atta','Whole wheat atta','Aashirvaad','Grains',1299,85,5.1,30,22,10,.015,'🌾','5 kg',1],['oil','Mustard oil','Dhara','Cooking',899,70,1.1,10,10,25,.008,'🫒','1 litre',1],['tea','Ilam loose leaf tea','Tokla','Beverages',599,90,.27,12,8,15,.009,'🍵','250 g',1],['achar','Lapsi pickle','Aama ko achar','Pickles',749,40,.55,9,9,14,.005,'🫙','400 g',1],['spice','Everyday spice collection','Everest','Spices',449,100,.23,14,10,6,.007,'🌶️','200 g',1],['ghee','Pure cow ghee','Amul','Cooking',1199,50,.55,10,10,12,.006,'🧈','500 g',0],['noodles','Wai Wai noodles','Wai Wai','Snacks',399,150,.45,22,15,12,.009,'🍜','6 × 75 g',1],['sel','Sel roti flour mix','GharBox','Festive',549,35,.55,18,12,6,.004,'🥨','500 g',1],['biscuit','Glucose biscuits','Parle-G','Snacks',249,120,.42,20,12,8,.008,'🍪','400 g',0],['soap','Neem hand soap','Himalaya','Household',299,80,.15,9,6,4,.004,'🧼','125 g',1]];
await db.batch(products.map(args=>({sql:'INSERT INTO products VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',args})));
const countries=[['NP','Nepal','NPR','Asia'],['AU','Australia','AUD','Oceania'],['GB','United Kingdom','GBP','Europe'],['US','United States','USD','Americas'],['CA','Canada','CAD','Americas'],...['AT:Austria','BE:Belgium','BG:Bulgaria','HR:Croatia','CY:Cyprus','CZ:Czechia','DK:Denmark','EE:Estonia','FI:Finland','FR:France','DE:Germany','GR:Greece','HU:Hungary','IE:Ireland','IT:Italy','LV:Latvia','LT:Lithuania','LU:Luxembourg','MT:Malta','NL:Netherlands','PL:Poland','PT:Portugal','RO:Romania','SK:Slovakia','SI:Slovenia','ES:Spain','SE:Sweden'].map(s=>[...s.split(':'),'EUR','EU']),...['BH:Bahrain:BHD','KW:Kuwait:KWD','OM:Oman:OMR','QA:Qatar:QAR','SA:Saudi Arabia:SAR','AE:United Arab Emirates:AED'].map(s=>[...s.split(':'),'GCC'])];
await db.batch(countries.map(([code,name,currency,region])=>({sql:'INSERT INTO destinations VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',args:[code,name,currency,1,code==='NP'?20:15,40,30,30,5000,400,80,region]})));
}
await migrateCatalogue();
if(process.env.ADMIN_EMAIL&&process.env.ADMIN_PASSWORD&&!(await db.prepare('SELECT id FROM users WHERE email=?').get(process.env.ADMIN_EMAIL))){
if(process.env.ADMIN_PASSWORD.length<12)throw Error('ADMIN_PASSWORD must contain 12 characters');
(await db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(randomUUID(),process.env.ADMIN_EMAIL,'Administrator',passwordHash(process.env.ADMIN_PASSWORD),'admin'));
}


}
export function passwordHash(password:string){const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
export async function audit(actor:string,action:string,detail:unknown){(await db.prepare('INSERT INTO audit(id,actor,action,detail) VALUES(?,?,?,?)').run(randomUUID(),actor,action,JSON.stringify(detail)));}


