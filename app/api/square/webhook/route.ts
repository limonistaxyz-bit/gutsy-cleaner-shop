import { settings, squareConfig } from '@/app/lib/square';
import { verifyHmac } from '@/app/lib/security';
import { db } from '@/app/lib/store';
import { reconcileCheckout, type StoredCheckout } from '@/app/lib/reconcile';
export async function POST(request: Request) {
  const config=settings();
  if(!config.SQUARE_WEBHOOK_SIGNATURE_KEY||!config.APP_ORIGIN)return new Response('Unavailable',{status:503});
  const raw=await request.text();
  if(raw.length>262144)return new Response('Too large',{status:413});
  if(!await verifyHmac(config.SQUARE_WEBHOOK_SIGNATURE_KEY,`${config.APP_ORIGIN}/api/square/webhook`+raw,request.headers.get('x-square-hmacsha256-signature')??''))return new Response('Invalid signature',{status:403});
  try {
    const event=JSON.parse(raw);
    if(!['payment.created','payment.updated'].includes(event.type))return new Response('OK');
    const payment=event.data?.object?.payment;
    if(payment?.location_id!==squareConfig().location||typeof payment?.order_id!=='string')return new Response('OK');
    const row=await db().prepare('SELECT * FROM orders WHERE square_order_id=?').bind(payment.order_id).first<StoredCheckout>();
    if(row)await reconcileCheckout(row,false);
    // Unknown orders may belong to another Square checkout. Our cron also reconciles
    // the race where Square delivered a payment before we persisted its order ID.
    return new Response('OK');
  } catch { return new Response('Please retry',{status:503}); }
}
