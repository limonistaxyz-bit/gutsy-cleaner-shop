import { env } from 'cloudflare:workers';
export function settings() { return env as unknown as Record<string, string | undefined>; }
export function squareConfig() {
  const value = settings();
  if (!['sandbox', 'production'].includes(value.SQUARE_ENVIRONMENT ?? '') || !value.SQUARE_ACCESS_TOKEN || !value.SQUARE_LOCATION_ID) throw new Error('Payment connection is not configured.');
  return { token: value.SQUARE_ACCESS_TOKEN, location: value.SQUARE_LOCATION_ID, base: value.SQUARE_ENVIRONMENT === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com' };
}
export function checkoutReady() {
  try {
    squareConfig();
    const value = settings();
    const url = new URL(value.APP_ORIGIN ?? '');
    return value.CHECKOUT_ENABLED === 'true' && url.protocol === 'https:' && url.origin === value.APP_ORIGIN &&
      !!value.ACCESS_TEAM_DOMAIN && !!value.ACCESS_AUD && !!value.ADMIN_EMAIL &&
      !!value.SQUARE_WEBHOOK_SIGNATURE_KEY && /^\d+(\.\d{1,4})?$/.test(value.SALES_TAX_PERCENT ?? '') &&
      Number(value.SALES_TAX_PERCENT) <= 100;
  } catch { return false; }
}
export async function squareRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const config = squareConfig();
  const response = await fetch(`${config.base}/v2${path}`, {
    method, headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json', 'Square-Version': '2026-08-19' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`Square request failed (${response.status}).`);
  return response.json() as Promise<T>;
}
export type SquareOrder = { id: string; state?: string; location_id?: string; total_money?: { amount: number; currency: string }; tenders?: { payment_id?: string }[] };
export type Payment = { id: string; status?: string; order_id?: string; location_id?: string; amount_money?: { amount: number; currency: string } };
