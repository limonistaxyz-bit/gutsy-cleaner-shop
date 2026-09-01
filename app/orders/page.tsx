import { env } from "cloudflare:workers";
import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { db } from "@/app/lib/store";
import { getActiveBatch } from "@/app/lib/store";
import BatchControls from "./BatchControls";

export const dynamic="force-dynamic";

export default async function Orders(){
 const user=await requireChatGPTUser("/orders");
 const admin=(env as unknown as Record<string,string|undefined>).ADMIN_EMAIL;
 if(!admin||user.email.toLowerCase()!==admin.toLowerCase()) return <main className="confirmation"><div className="confirmCard"><h1>Owner access only.</h1></div></main>;
 const batch=await getActiveBatch();
 const cutoffLabel=new Date(batch.cutoff_at).toLocaleString("en-US",{timeZone:"America/New_York",weekday:"long",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"});
 const result=await db().prepare("SELECT order_number, customer_name, email, mobile, item_count, amount_cents, status, created_at FROM orders WHERE batch_id = ? ORDER BY created_at DESC").bind(batch.id).all<Record<string,string|number>>();
 return <main className="ordersPage"><div className="ordersHead"><div><p className="kicker">Private owner view</p><h1>{batch.pickup_label} orders</h1></div><a href="/">Back to shop</a></div><BatchControls pickupDate={batch.pickup_date} capacity={batch.capacity} cutoffLabel={cutoffLabel}/><div className="orderTable"><table><thead><tr><th>Order</th><th>Customer</th><th>Contact</th><th>Items</th><th>Total</th><th>Status</th></tr></thead><tbody>{result.results.map(row=><tr key={String(row.order_number)}><td>{row.order_number}</td><td>{row.customer_name}</td><td>{row.mobile}<small>{row.email}</small></td><td>{row.item_count}</td><td>${(Number(row.amount_cents)/100).toFixed(2)}</td><td>{String(row.status).replaceAll("_"," ")}</td></tr>)}</tbody></table>{result.results.length===0&&<p className="emptyOrders">No orders yet for this pickup.</p>}</div></main>
}
