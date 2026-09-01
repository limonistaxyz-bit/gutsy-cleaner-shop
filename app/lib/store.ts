import { env } from "cloudflare:workers";

export const CAPACITY = 12;
export const PRODUCTS = {
  starter: { name: "Gutsy Cleaner Starter Kit", cents: 2500 },
  concentrate: { name: "Gutsy Concentrate", cents: 700 },
  bottle: { name: "Ready-to-Use Gutsy Cleaner", cents: 900 },
} as const;

export function db() {
  if (!env.DB) throw new Error("Database unavailable");
  return env.DB;
}

export type ActiveBatch={id:string;pickup_date:string;pickup_label:string;cutoff_at:number;capacity:number;reserved:number;is_open:number};

export async function getActiveBatch() {
  const database=db();
  let batch=await database.prepare("SELECT id, pickup_date, pickup_label, cutoff_at, capacity, reserved, is_open FROM batches WHERE is_open = 1 ORDER BY pickup_date LIMIT 1").first<ActiveBatch>();
  if(!batch){
    const cutoff=Date.parse("2026-10-01T18:00:00-04:00");
    await database.prepare("INSERT OR IGNORE INTO batches (id, pickup_label, pickup_date, cutoff_at, capacity, reserved, is_open) VALUES (?, ?, ?, ?, ?, 0, 1)").bind("2026-10-03","October 3, 2026","2026-10-03",cutoff,CAPACITY).run();
    await database.prepare("UPDATE batches SET pickup_date = ?, cutoff_at = ?, is_open = 1 WHERE id = ? AND pickup_date = ''").bind("2026-10-03",cutoff,"2026-10-03").run();
    batch=await database.prepare("SELECT id, pickup_date, pickup_label, cutoff_at, capacity, reserved, is_open FROM batches WHERE is_open = 1 ORDER BY pickup_date LIMIT 1").first<ActiveBatch>();
  }
  if(!batch)throw new Error("No batch is open");
  return batch;
}

export async function releaseExpiredReservations(batchId:string) {
  const database = db();
  const now = Date.now();
  const expired = await database.prepare(
    "SELECT COALESCE(SUM(item_count), 0) AS quantity FROM orders WHERE batch_id = ? AND status = 'pending_payment' AND reservation_expires_at < ?"
  ).bind(batchId, now).first<{quantity:number}>();
  const quantity = Number(expired?.quantity ?? 0);
  if (quantity > 0) {
    await database.batch([
      database.prepare("UPDATE orders SET status = 'expired' WHERE batch_id = ? AND status = 'pending_payment' AND reservation_expires_at < ?").bind(batchId, now),
      database.prepare("UPDATE batches SET reserved = MAX(0, reserved - ?) WHERE id = ?").bind(quantity, batchId),
    ]);
  }
}
