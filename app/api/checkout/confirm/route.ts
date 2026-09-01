import { db } from '@/app/lib/store';
import { reconcileCheckout, type StoredCheckout } from '@/app/lib/reconcile';
export async function GET(request: Request) {
  const id=new URL(request.url).searchParams.get('order')??'';
  const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
  if(!/^[0-9a-f-]{36}$/i.test(id))return Response.json({error:'Order not found.'},{status:404,headers});
  const row=await db().prepare('SELECT * FROM orders WHERE id=? AND square_request_json IS NOT NULL').bind(id).first<StoredCheckout>();
  if(!row)return Response.json({error:'Order not found.'},{status:404,headers});
  try { await reconcileCheckout(row,false); } catch { return Response.json({error:'Payment confirmation is temporarily unavailable. Please check again shortly.'},{status:503,headers}); }
  const order=await db().prepare('SELECT o.order_number,o.amount_cents,o.status,b.pickup_label FROM orders o JOIN batches b ON b.id=o.batch_id WHERE o.id=?').bind(id).first<{order_number:string;amount_cents:number;status:string;pickup_label:string}>();
  if(order?.status!=='paid')return Response.json({error:order?.status==='expired'?'This unpaid checkout has expired.':'Payment has not been confirmed yet.'},{status:409,headers});
  return Response.json({order}, {headers});
}
