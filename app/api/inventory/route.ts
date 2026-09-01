import { checkoutReady } from "@/app/lib/square";
import { getActiveBatch, releaseExpiredReservations } from "@/app/lib/store";

export async function GET() {
  const batch=await getActiveBatch();

  const refreshed=await getActiveBatch();
  const pickup=new Date(`${refreshed.pickup_date}T12:00:00`).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"});
  const cutoff=new Date(refreshed.cutoff_at).toLocaleString("en-US",{timeZone:"America/New_York",weekday:"long",month:"long",day:"numeric",hour:"numeric",minute:"2-digit"});
  return Response.json({remaining:Math.max(0,refreshed.capacity-refreshed.reserved),capacity:refreshed.capacity,pickupDate:refreshed.pickup_date,pickupLabel:pickup,cutoffLabel:cutoff,isOpen:checkoutReady()&&refreshed.is_open===1&&Date.now()<refreshed.cutoff_at},{headers:{"Cache-Control":"no-store"}});
}
