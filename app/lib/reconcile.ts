import { db } from './store';
import { squareRequest, settings, squareConfig, type SquareOrder, type Payment } from './square';
export type StoredCheckout = { id: string; batch_id: string; status: string; amount_cents: number; reservation_expires_at: number; square_order_id: string | null; square_link_id: string | null; square_link_url: string | null; square_request_json: string; payment_environment: string };

export async function createLink(row: StoredCheckout) {
  if (row.payment_environment !== settings().SQUARE_ENVIRONMENT) throw new Error('Payment environment does not match.');
  if (row.square_order_id && row.square_link_id && row.square_link_url) return row;
  // Persisted payload + idempotency key make recovery safe after a timeout/crash.
  const result = await squareRequest<{ payment_link?: { id: string; order_id: string; url: string }; related_resources?: { orders?: SquareOrder[] } }>('/online-checkout/payment-links', 'POST', JSON.parse(row.square_request_json));
  const link = result.payment_link;
  if (!link?.id || !link.order_id || !link.url || new URL(link.url).protocol !== 'https:') throw new Error('Incomplete Square response.');
  const order = result.related_resources?.orders?.find(o => o.id === link.order_id) ?? (await squareRequest<{ order: SquareOrder }>(`/orders/${encodeURIComponent(link.order_id)}`)).order;
  const total = order.total_money;
  if (!total || total.currency !== 'USD' || !Number.isSafeInteger(total.amount) || total.amount < row.amount_cents || order.location_id !== squareConfig().location) throw new Error('Unexpected Square order total or location.');
  await db().prepare("UPDATE orders SET square_order_id=?, square_link_id=?, square_link_url=?, amount_cents=?, status='pending_payment' WHERE id=? AND status IN ('creating_checkout','pending_payment')").bind(link.order_id, link.id, link.url, total.amount, row.id).run();
  return { ...row, square_order_id: link.order_id, square_link_id: link.id, square_link_url: link.url, amount_cents: total.amount, status: 'pending_payment' };
}

async function recordPayment(row: StoredCheckout, order: SquareOrder) {
  if (order.location_id !== squareConfig().location || order.id !== row.square_order_id) throw new Error('Square order mismatch.');
  let total = 0;
  let unsettled = false;
  for (const tender of order.tenders ?? []) {
    if (!tender.payment_id) { unsettled = true; continue; }
    const { payment } = await squareRequest<{ payment: Payment }>(`/payments/${encodeURIComponent(tender.payment_id)}`);
    if (payment.order_id !== order.id || payment.location_id !== order.location_id || payment.amount_money?.currency !== 'USD') throw new Error('Square payment mismatch.');
    if (payment.status === 'COMPLETED') total += payment.amount_money.amount;
    else if (!['FAILED', 'CANCELED'].includes(payment.status ?? '')) unsettled = true;
  }
  if (total === row.amount_cents) {
    await db().prepare("UPDATE orders SET status='paid', paid_at=? WHERE id=? AND status IN ('creating_checkout','pending_payment')").bind(Date.now(), row.id).run();
    return 'paid';
  }
  if (total > 0 || unsettled) return 'uncertain';
  return 'unpaid';
}

export async function reconcileCheckout(input: StoredCheckout, expire: boolean) {
  if (!['creating_checkout', 'pending_payment'].includes(input.status) || input.payment_environment !== settings().SQUARE_ENVIRONMENT) return;
  const row = await createLink(input);
  const path = `/orders/${encodeURIComponent(row.square_order_id!)}`;
  let order = (await squareRequest<{ order: SquareOrder }>(path)).order;
  if (await recordPayment(row, order) !== 'unpaid') return;
  if (!expire || row.reservation_expires_at > Date.now()) return;
  if (order.state !== 'CANCELED') {
    await squareRequest(`/online-checkout/payment-links/${encodeURIComponent(row.square_link_id!)}`, 'DELETE');
    order = (await squareRequest<{ order: SquareOrder }>(path)).order;
  }
  // Never release a reservation merely because time passed or a network request failed.
  if (await recordPayment(row, order) === 'unpaid' && order.state === 'CANCELED') {
    await db().prepare("UPDATE orders SET status='expired' WHERE id=? AND status='pending_payment'").bind(row.id).run();
  }
}
export async function reconcilePending(batchId?: string) {
  const rows = await db().prepare("SELECT * FROM orders WHERE square_request_json IS NOT NULL AND status IN ('creating_checkout','pending_payment') AND payment_environment=?" + (batchId ? ' AND batch_id=?' : '') + ' ORDER BY reservation_expires_at LIMIT 5')
    .bind(settings().SQUARE_ENVIRONMENT ?? '', ...(batchId ? [batchId] : [])).all<StoredCheckout>();
  for (const row of rows.results) {
    try { await reconcileCheckout(row, true); }
    catch { console.error('A checkout could not be reconciled; its reservation was retained.', row.id); }
  }
}
