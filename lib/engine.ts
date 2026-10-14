export type Product = {id:string;name:string;brand:string;category:string;price:number;stock:number;weight:number;l:number;w:number;h:number;daily:number;emoji:string;pack:string;vegan:number};
export type Line = {product:Product;quantity:number};
export type Rules = {maxWeight:number;length:number;width:number;height:number;divisor:number;baseRate:number;kgRate:number;active:number;currency:string;name:string;code:string};
type Placement={productId:string;name:string;x:number;y:number;z:number;l:number;w:number;h:number};
export function forecast(products:Product[], adults:number,children:number,days:number,budget:number,vegan:boolean){
 let remaining=budget;
 return products.filter(p=>p.stock>0&&(!vegan||p.vegan)).map(product=>{
 const needed=Math.ceil(product.daily*(adults+children*.6)*days);
 const quantity=Math.max(0,Math.min(needed,product.stock,Math.floor(remaining/product.price)));
 remaining-=quantity*product.price;
 return {productId:product.id,quantity,reason:`Starter estimate: ${days} days for ${adults} adults and ${children} children. Pack-rounded; please adjust to your pantry.`,confidence:'low',version:'starter-v1'};
 }).filter(x=>x.quantity>0);
}
export function pack(lines:Line[],r:Rules){
 if(!r.active)throw Error('Destination is inactive');
 const boxes:{weight:number;items:Placement[];spaces:{x:number;y:number;z:number;l:number;w:number;h:number}[]}[]=[];
 const units=lines.flatMap(({product,quantity})=>{
 if(!Number.isInteger(quantity)||quantity<0||quantity>100)throw Error('Invalid quantity');
 if(quantity>product.stock)throw Error(`${product.name} has insufficient stock`);
 return Array.from({length:quantity},()=>product);
 }).sort((a,b)=>b.l*b.w*b.h-a.l*a.w*a.h);
 if(units.length>300)throw Error('Maximum 300 packs per basket');
 for(const p of units){
 const rotations=[[p.l,p.w,p.h],[p.l,p.h,p.w],[p.w,p.l,p.h],[p.w,p.h,p.l],[p.h,p.l,p.w],[p.h,p.w,p.l]];
 if(p.weight+.4>r.maxWeight||!rotations.some(([l,w,h])=>l<=r.length&&w<=r.width&&h<=r.height))throw Error(`${p.name} cannot fit this destination's carton`);
 let placed=false;
 for(let b=0;b<=boxes.length;b++){
 if(b===boxes.length)boxes.push({weight:.4,items:[],spaces:[{x:0,y:0,z:0,l:r.length,w:r.width,h:r.height}]});
 const box=boxes[b];
 if(box.weight+p.weight>r.maxWeight)continue;
 for(let s=0;s<box.spaces.length;s++){
 const space=box.spaces[s],rot=rotations.find(([l,w,h])=>l<=space.l&&w<=space.w&&h<=space.h);
 if(!rot)continue;
 const [l,w,h]=rot;box.spaces.splice(s,1);box.weight+=p.weight;
 box.items.push({productId:p.id,name:p.name,x:space.x,y:space.y,z:space.z,l,w,h});
 box.spaces.push({x:space.x+l,y:space.y,z:space.z,l:space.l-l,w:space.w,h:space.h},{x:space.x,y:space.y+w,z:space.z,l,w:space.w-w,h:space.h},{x:space.x,y:space.y,z:space.z+h,l,w,h:space.h-h});
 box.spaces=box.spaces.filter(s=>s.l>0&&s.w>0&&s.h>0);placed=true;break;
 }if(placed)break;
 }
 }
 const cartons=boxes.map((box,i)=>{const volumetric=(r.length+2)*(r.width+2)*(r.height+2)/r.divisor,billable=Math.ceil(Math.max(box.weight,volumetric)*2)/2;return {number:i+1,weight:Math.round(box.weight*100)/100,volumetric,billable,shipping:r.baseRate+Math.round(billable*r.kgRate),items:box.items,fill:Math.round(box.items.reduce((v,p)=>v+p.l*p.w*p.h,0)/(r.length*r.width*r.height)*100)};});
 const subtotal=lines.reduce((sum,l)=>sum+l.product.price*l.quantity,0),shipping=cartons.reduce((s,b)=>s+b.shipping,0),packaging=cartons.length*150;
 return {cartons,subtotal,shipping,packaging,tax:0,total:subtotal+shipping+packaging,currency:r.currency,sample:true,notes:'Sample local fulfilment quote. Tax is unconfigured; international routes require compliance review. Heuristic packing, not a guaranteed optimum.'};
}
