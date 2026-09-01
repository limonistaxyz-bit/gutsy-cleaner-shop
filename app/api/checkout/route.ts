import { env } from "cloudflare:workers";
import { PRODUCTS, db, getActiveBatch, releaseExpiredReservations } from "@/app/lib/store";

type ProductId = keyof typeof PRODUCTS;
type Body = { name?:string; email?:string; mobile?:string; cart?:Partial<Record<ProductId,number>> };

export async function POST(request: Request) {
  const secret = (env as unknown as Record<string,string | undefined>).STRIPE_SECRET_KEY;
  if (!secret) return Response.json({ error: "Online payment is not connected yet." }, { status: 503 });
  let body: Body;
  try { body = await request.json() as Body; } catch { return Response.json({error:"Invalid request."},{status:400}); }
  const name=body.name?.trim(), email=body.email?.trim(), mobile=body.mobile?.trim();
  if(!name||!email||!mobile) return Response.json({error:"Name, email and mobile number are required."},{status:400});
  const lines=(Object.keys(PRODUCTS) as ProductId[]).map(id=>({id,quantity:Math.max(0,Math.floor(Number(body.cart?.[id]??0))),...PRODUCTS[id]})).filter(x=>x.quantity>0);
  const itemCount=lines.reduce((s,x)=>s+x.quantity,0);
  const batch=await getActiveBatch();
  if(itemCount<1||itemCount>batch.capacity) return Response.json({error:`Choose between 1 and ${batch.capacity} items.`},{status:400});
  if(!batch.is_open||Date.now()>=batch.cutoff_at)return Response.json({error:"Preorders are closed for this pickup."},{status:409});
  await releaseExpiredReservations(batch.id);
  const database=db();
  const reserve=await database.prepare("UPDATE batches SET reserved = reserved + ? WHERE id = ? AND is_open = 1 AND reserved + ? <= capacity").bind(itemCount,batch.id,itemCount).run();
  if(!reserve.meta.changes) return Response.json({error:"That quantity is no longer available. Please refresh your bag."},{status:409});
  const id=crypto.randomUUID();
  const orderNumber=`GUTSY-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
  const amount=lines.reduce((s,x)=>s+x.cents*x.quantity,0);
  const now=Date.now(), expires=now+30*60*1000;
  try {
    await database.batch([
      database.prepare("INSERT INTO orders (id, order_number, batch_id, customer_name, email, mobile, item_count, amount_cents, status, reservation_expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', ?, ?)").bind(id,orderNumber,batch.id,name,email,mobile,itemCount,amount,expires,now),
      ...lines.map(x=>database.prepare("INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price_cents) VALUES (?, ?, ?, ?, ?)").bind(id,x.id,x.name,x.quantity,x.cents)),
    ]);
    const form=new URLSearchParams();
    form.set("mode","payment"); form.set("customer_email",email); form.set("success_url",`${new URL(request.url).origin}/order-confirmed?session_id={CHECKOUT_SESSION_ID}`); form.set("cancel_url",`${new URL(request.url).origin}/?checkout=cancelled`); form.set("expires_at",String(Math.floor(expires/1000))); form.set("metadata[order_id]",id); form.set("metadata[order_number]",orderNumber);
    lines.forEach((x,i)=>{form.set(`line_items[${i}][quantity]`,String(x.quantity));form.set(`line_items[${i}][price_data][currency]`,"usd");form.set(`line_items[${i}][price_data][unit_amount]`,String(x.cents));form.set(`line_items[${i}][price_data][product_data][name]`,x.name);});
    const stripe=await fetch("https://api.stripe.com/v1/checkout/sessions",{method:"POST",headers:{Authorization:`Bearer ${secret}`,"Content-Type":"application/x-www-form-urlencoded"},body:form});
    const session=await stripe.json() as {id?:string;url?:string;error?:{message?:string}};
    if(!stripe.ok||!session.id||!session.url) throw new Error(session.error?.message??"Stripe checkout could not start.");
    await database.prepare("UPDATE orders SET stripe_session_id = ? WHERE id = ?").bind(session.id,id).run();
    return Response.json({url:session.url});
  } catch(error) {
    await database.batch([database.prepare("UPDATE orders SET status = 'checkout_error' WHERE id = ?").bind(id),database.prepare("UPDATE batches SET reserved = MAX(0, reserved - ?) WHERE id = ?").bind(itemCount,batch.id)]);
    return Response.json({error:error instanceof Error?error.message:"Checkout could not start."},{status:502});
  }
}
