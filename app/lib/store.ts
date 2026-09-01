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

export function batchPrefix() {
  const value=(env as unknown as Record<string,string|undefined>).SQUARE_ENVIRONMENT;
  return value==='production'?'production:':'sandbox:';
}

export async function getActiveBatch() {
  const database=db();
  const prefix=batchPrefix();
  let batch=await database.prepare("SELECT id, pickup_date, pickup_label, cutoff_at, capacity, reserved, is_open FROM batches WHERE is_open = 1 AND id LIKE ? ORDER BY pickup_date LIMIT 1").bind(prefix+"%").first<ActiveBatch>();
  if(!batch){
    const cutoff=Date.parse("2026-10-01T18:00:00-04:00");
    await database.prepare("INSERT OR IGNORE INTO batches (id, pickup_label, pickup_date, cutoff_at, capacity, reserved, is_open) VALUES (?, ?, ?, ?, ?, 0, 1)").bind(prefix+"2026-10-03","October 3, 2026","2026-10-03",cutoff,CAPACITY).run();
    await database.prepare("UPDATE batches SET pickup_date = ?, cutoff_at = ?, is_open = 1 WHERE id = ? AND pickup_date = ''").bind("2026-10-03",cutoff,prefix+"2026-10-03").run();
    batch=await database.prepare("SELECT id, pickup_date, pickup_label, cutoff_at, capacity, reserved, is_open FROM batches WHERE is_open = 1 AND id LIKE ? ORDER BY pickup_date LIMIT 1").bind(prefix+"%").first<ActiveBatch>();
  }
  if(!batch)throw new Error("No batch is open");
  return batch;
}

export async function releaseExpiredReservations(batchId:string) {
  const { reconcilePending } = await import('./reconcile');
  await reconcilePending(batchId);
}
