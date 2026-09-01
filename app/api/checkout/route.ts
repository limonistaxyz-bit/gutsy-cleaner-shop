import { PRODUCTS, db, getActiveBatch } from '@/app/lib/store';
import { checkoutReady, settings, squareConfig } from '@/app/lib/square';
import { createLink, type StoredCheckout } from '@/app/lib/reconcile';

export async function POST(request: Request) {
  if (!checkoutReady()) return Response.json({ error: 'Online ordering is not open yet.' }, { status: 503 });
  const config = settings();
  if (request.headers.get('origin') !== config.APP_ORIGIN) return Response.json({error:'Invalid request origin.'},{status:403});
  let body;
  try {
    const raw = await request.text();
    if(raw.length > 8192) return Response.json({error:'Request too large.'},{status:413});
    body = JSON.parse(raw);
  } catch { return Response.json({error:'Invalid request.'},{status:400}); }
  if(!body||typeof body!=='object'||Array.isArray(body))return Response.json({error:'Invalid request.'},{status:400});
  const name=typeof body.name==='string'?body.name.trim():'';
  const email=typeof body.email==='string'?body.email.trim():'';
  const mobile=typeof body.mobile==='string'?body.mobile.trim():'';
  const id=body.checkoutId;
  if(!name||name.length>120||!/^\S+@\S+\.\S+$/.test(email)||email.length>254||!/^\+?[\d ()-]{7,25}$/.test(mobile)||typeof id!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return Response.json({error:'Please check your name, email and mobile number.'},{status:400});
  if(!body.cart||typeof body.cart!=='object'||Array.isArray(body.cart)||Object.keys(body.cart).some(key=>!(key in PRODUCTS)))return Response.json({error:'Invalid bag.'},{status:400});
  const lines = (Object.keys(PRODUCTS) as (keyof typeof PRODUCTS)[]).map(key=>({id:key,quantity:body.cart[key]??0,...PRODUCTS[key]}));
  if(lines.some(x=>typeof x.quantity!=='number'||!Number.isSafeInteger(x.quantity)||x.quantity<0||x.quantity>100))return Response.json({error:'Choose whole-number quantities between 0 and 100.'},{status:400});
  const count=lines.reduce((n,x)=>n+x.quantity,0);
  if(count<1||count>100)return Response.json({error:'Your bag must contain between 1 and 100 items.'},{status:400});
  const database=db();
  // Hash the trusted edge IP; retain only a bounded per-minute abuse counter.
  const ip=request.headers.get('cf-connecting-ip');
  if(ip){
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip)))).map(x=>x.toString(16).padStart(2,'0')).join('');
    const window=Math.floor(Date.now()/60000);
    const rate=await database.prepare('INSERT INTO checkout_rate_limits (key,window_start,count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN window_start=excluded.window_start THEN count+1 ELSE 1 END, window_start=excluded.window_start RETURNING count').bind(hash,window).first<{count:number}>();
    if((rate?.count??0)>10)return Response.json({error:'Please wait a minute before trying again.'},{status:429});
  }
  let row=await database.prepare('SELECT * FROM orders WHERE id=?').bind(id).first<StoredCheckout & {customer_name:string;email:string;mobile:string}>();
  if(row){
    const items=await database.prepare('SELECT product_id, quantity FROM order_items WHERE order_id=?').bind(id).all<{product_id:string;quantity:number}>();
    if(row.customer_name!==name||row.email!==email||row.mobile!==mobile||lines.some(x=>x.quantity!==(items.results.find(y=>y.product_id===x.id)?.quantity??0)))return Response.json({error:'Your bag changed. Please start a new checkout.'},{status:409});
    if(row.status==='paid')return Response.json({url:`${config.APP_ORIGIN}/order-confirmed?order=${id}`});
    if(!['creating_checkout','pending_payment'].includes(row.status)||row.reservation_expires_at<=Date.now())return Response.json({error:'This checkout has expired. Refresh the page to start again.'},{status:409});
  } else {
    const batch=await getActiveBatch();
    const now=Date.now();
    if(!batch.is_open||now>=batch.cutoff_at)return Response.json({error:'Preorders are closed for this pickup.'},{status:409});
    const amount=lines.reduce((n,x)=>n+x.cents*x.quantity,0);
    const note=`Pickup ${batch.pickup_label}, 8:30 AM–1:00 PM. Senoia Farmers Market, Stall 33, 40 Travis St, Senoia, GA 30276-1811.`;
    const payload={idempotency_key:id,description:'Gutsy Cleaner preorder',order:{location_id:squareConfig().location,reference_id:id,line_items:lines.filter(x=>x.quantity).map(x=>({name:x.name,quantity:String(x.quantity),base_price_money:{amount:x.cents,currency:'USD'},note})),taxes:Number(config.SALES_TAX_PERCENT)>0?[{uid:'sales-tax',name:'Sales tax',percentage:config.SALES_TAX_PERCENT,scope:'ORDER',type:'ADDITIVE'}]:[]},checkout_options:{redirect_url:`${config.APP_ORIGIN}/order-confirmed?order=${id}`,ask_for_shipping_address:false,allow_tipping:false,enable_coupon:false},pre_populated_data:{buyer_email:email},payment_note:note};
    const reservation=database.prepare("INSERT INTO orders (id,order_number,batch_id,customer_name,email,mobile,item_count,amount_cents,status,reservation_expires_at,created_at,square_request_json,payment_environment) SELECT ?,?,?,?,?,?,?,?,'creating_checkout',?,?,?,? FROM batches WHERE id=? AND is_open=1 AND cutoff_at>? AND reserved+?<=capacity").bind(id,`GUTSY-${id.slice(0,8).toUpperCase()}`,batch.id,name,email,mobile,count,amount,Math.min(now+30*60000,batch.cutoff_at),now,JSON.stringify(payload),config.SQUARE_ENVIRONMENT!,batch.id,now,count);
    const results=await database.batch([reservation,...lines.filter(x=>x.quantity).map(x=>database.prepare('INSERT INTO order_items (order_id,product_id,product_name,quantity,unit_price_cents) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM orders WHERE id=?)').bind(id,x.id,x.name,x.quantity,x.cents,id))]);
    if(!results[0].meta.changes)return Response.json({error:'That quantity is no longer available. Please refresh your bag.'},{status:409});
    row=await database.prepare('SELECT * FROM orders WHERE id=?').bind(id).first<typeof row>();
  }
  try {
    if(!row)throw new Error('Order not found.');
    const ready=await createLink(row);
    return Response.json({url:ready.square_link_url});
  } catch {
    return Response.json({error:'We could not open payment yet. Please try again with the same bag; your reservation will be reused.'},{status:502});
  }
}
