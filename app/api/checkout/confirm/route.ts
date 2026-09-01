import { env } from "cloudflare:workers";
import { db } from "@/app/lib/store";

export async function GET(request:Request){
 const sessionId=new URL(request.url).searchParams.get("session_id");
 const secret=(env as unknown as Record<string,string|undefined>).STRIPE_SECRET_KEY;
 if(!sessionId||!secret)return Response.json({error:"Confirmation unavailable."},{status:400});
 const response=await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,{headers:{Authorization:`Bearer ${secret}`}});
 const session=await response.json() as {payment_status?:string;metadata?:{order_id?:string}};
 if(!response.ok||session.payment_status!=="paid"||!session.metadata?.order_id)return Response.json({error:"Payment has not been confirmed."},{status:409});
 const database=db(); const now=Date.now();
 await database.prepare("UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ? AND status = 'pending_payment'").bind(now,session.metadata.order_id).run();
 const order=await database.prepare("SELECT order_number, customer_name, email, amount_cents FROM orders WHERE id = ?").bind(session.metadata.order_id).first();
 return Response.json({order});
}
