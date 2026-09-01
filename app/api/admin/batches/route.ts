import { isOwner } from "@/app/lib/owner";
import { db, batchPrefix } from "@/app/lib/store";

function easternWallTime(date:string,hour:number){
 const [y,m,d]=date.split("-").map(Number); const target=Date.UTC(y,m-1,d,hour);
 let guess=target;
 for(let i=0;i<2;i++){
  const parts=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(guess));
  const value=(type:string)=>Number(parts.find(p=>p.type===type)?.value);
  const represented=Date.UTC(value("year"),value("month")-1,value("day"),value("hour"),value("minute"),value("second"));
  guess=target-(represented-guess);
 }
 return guess;
}

export async function POST(request:Request){
 if(!await isOwner())return Response.json({error:"Owner access required."},{status:403});
 if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:"Invalid request origin."},{status:403});
 const body=await request.json() as {pickupDate?:string;capacity?:number};
 if(!/^\d{4}-\d{2}-\d{2}$/.test(body.pickupDate??""))return Response.json({error:"Choose a pickup date."},{status:400});
 const pickupDate=body.pickupDate!; const pickup=new Date(`${pickupDate}T12:00:00`);
 if(!Number.isFinite(pickup.getTime())||pickup.toISOString().slice(0,10)!==pickupDate||pickup.getUTCDay()!==6)return Response.json({error:"Pickup must be a Saturday."},{status:400});
 const capacity=Math.floor(Number(body.capacity)); if(!Number.isFinite(capacity)||capacity<1||capacity>100)return Response.json({error:"Batch limit must be between 1 and 100."},{status:400});
 const cutoffDate=new Date(pickup); cutoffDate.setDate(cutoffDate.getDate()-2);
 const cutoffKey=`${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth()+1).padStart(2,"0")}-${String(cutoffDate.getDate()).padStart(2,"0")}`;
 const cutoffAt=easternWallTime(cutoffKey,18);
 const pickupLabel=pickup.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});
 const database=db();
 const batchId=batchPrefix()+pickupDate;
 const existing=await database.prepare("SELECT reserved FROM batches WHERE id = ?").bind(batchId).first<{reserved:number}>();
 if(existing&&existing.reserved>capacity)return Response.json({error:`This batch already has ${existing.reserved} items reserved. Choose a limit of at least ${existing.reserved}.`},{status:409});
 await database.batch([
  database.prepare("UPDATE batches SET is_open = 0 WHERE is_open = 1 AND id LIKE ?").bind(batchPrefix()+"%"),
  database.prepare("INSERT INTO batches (id, pickup_label, pickup_date, cutoff_at, capacity, reserved, is_open) VALUES (?, ?, ?, ?, ?, 0, 1) ON CONFLICT(id) DO UPDATE SET pickup_label=excluded.pickup_label, pickup_date=excluded.pickup_date, cutoff_at=excluded.cutoff_at, capacity=excluded.capacity, is_open=1").bind(batchId,pickupLabel,pickupDate,cutoffAt,capacity),
 ]);
 return Response.json({ok:true});
}
