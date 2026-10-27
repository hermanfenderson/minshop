import type { D1Database } from '@cloudflare/workers-types';
import type { FulfillableOrder, OrderLineRow } from './order';

/**
 * The order_fulfillments state machine (migration 0043) — every statement
 * that moves a row, and nothing else. No `cloudflare:workers` import, so
 * test/integration/fulfillment.mjs runs these exact statements on a real D1.
 *
 *   pending ──claim──▶ processing ──▶ submitted
 *      ▲                    │
 *      └──── retryable ─────┤
 *                           └──▶ failed (a person must look: Retry in Admin)
 *
 * Same claim/lease/fencing shape as the email outbox: whoever claims bumps
 * `attempts`, and every completion carries that number, so a late worker whose
 * lease expired cannot overwrite the one that took over.
 */

export type FulfillmentState = 'pending' | 'processing' | 'submitted' | 'failed';

export interface FulfillmentRecord {
  order_id: number;
  provider: string;
  state: FulfillmentState;
  attempts: number;
  provider_order_id: string | null;
  provider_status: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/** Automatic attempts before a row waits for a person. */
export const MAX_FULFILLMENT_ATTEMPTS = 6;
export const FULFILLMENT_LEASE_SECONDS = 120;

const LINES_SQL = `
  SELECT oi.name, oi.quantity, oi.price_cents,
         COALESCE(v.fulfillment_ref, CASE WHEN oi.variant_id IS NULL THEN p.fulfillment_ref END) AS ref
    FROM order_items oi
    LEFT JOIN product_variants v ON v.id = oi.variant_id
    LEFT JOIN products p ON p.id = oi.product_id
   WHERE oi.order_id = ?
   ORDER BY oi.id`;

/**
 * Open a row for a paid order that has at least one linked line. INSERT OR
 * IGNORE on the order id: settlement, its redeliveries and the Lightning page
 * can all call this, and only the first opens anything.
 */
export async function queueFulfillment(db: D1Database, orderId: number, provider: string): Promise<boolean> {
  const res = await db
    .prepare(
      `INSERT OR IGNORE INTO order_fulfillments (order_id, provider)
       SELECT ?, ? WHERE EXISTS (
         SELECT 1 FROM orders o
          WHERE o.id = ? AND o.status = 'paid'
            AND EXISTS (SELECT 1 FROM (${LINES_SQL}) WHERE ref IS NOT NULL))`,
    )
    .bind(orderId, provider, orderId, orderId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function getFulfillment(db: D1Database, orderId: number): Promise<FulfillmentRecord | null> {
  return db.prepare('SELECT * FROM order_fulfillments WHERE order_id = ?').bind(orderId).first<FulfillmentRecord>();
}

/** The order and its lines with their fulfillment refs, for buildFulfillmentInput. */
export async function loadFulfillableOrder(
  db: D1Database,
  orderId: number,
): Promise<{ order: FulfillableOrder; rows: OrderLineRow[] } | null> {
  const order = await db
    .prepare('SELECT public_id, email, currency, ship_address FROM orders WHERE id = ?')
    .bind(orderId)
    .first<FulfillableOrder>();
  if (!order) return null;
  const { results } = await db.prepare(LINES_SQL).bind(orderId).all<OrderLineRow>();
  return { order, rows: results ?? [] };
}

/** Claim a row: pending, or processing with an expired lease. Returns the attempt number. */
export async function claimFulfillment(db: D1Database, orderId: number): Promise<number | null> {
  // A worker that died on its last attempt leaves 'processing' behind; park it
  // for a person instead of leaving it looking busy forever.
  await db
    .prepare(
      `UPDATE order_fulfillments
          SET state = 'failed', lease_expires_at = NULL, updated_at = datetime('now'),
              last_error = COALESCE(last_error, 'attempts interrupted (lease expired)')
        WHERE order_id = ? AND state = 'processing' AND lease_expires_at < datetime('now')
          AND attempts >= ${MAX_FULFILLMENT_ATTEMPTS}`,
    )
    .bind(orderId)
    .run();
  const row = await db
    .prepare(
      `UPDATE order_fulfillments
          SET state = 'processing', attempts = attempts + 1, updated_at = datetime('now'),
              lease_expires_at = datetime('now', '+${FULFILLMENT_LEASE_SECONDS} seconds')
        WHERE order_id = ? AND attempts < ${MAX_FULFILLMENT_ATTEMPTS}
          AND (state = 'pending' OR (state = 'processing' AND lease_expires_at < datetime('now')))
        RETURNING attempts`,
    )
    .bind(orderId)
    .first<{ attempts: number }>();
  return row?.attempts ?? null;
}

export async function markFulfillmentSubmitted(
  db: D1Database,
  orderId: number,
  attempts: number,
  providerOrderId: string,
  providerStatus: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE order_fulfillments
          SET state = 'submitted', provider_order_id = ?, provider_status = ?, last_error = NULL,
              lease_expires_at = NULL, updated_at = datetime('now')
        WHERE order_id = ? AND state = 'processing' AND attempts = ?`,
    )
    .bind(providerOrderId, providerStatus, orderId, attempts)
    .run();
}

/**
 * A failed attempt: back to pending while it may cure itself (the fulfiller was
 * down) and attempts remain; otherwise 'failed', for a person to look at.
 */
export async function markFulfillmentFailed(
  db: D1Database,
  orderId: number,
  attempts: number,
  error: string,
  retryable: boolean,
): Promise<FulfillmentState> {
  const next: FulfillmentState = retryable && attempts < MAX_FULFILLMENT_ATTEMPTS ? 'pending' : 'failed';
  await db
    .prepare(
      `UPDATE order_fulfillments
          SET state = ?, last_error = ?, lease_expires_at = NULL, updated_at = datetime('now')
        WHERE order_id = ? AND state = 'processing' AND attempts = ?`,
    )
    .bind(next, error.slice(0, 500), orderId, attempts)
    .run();
  return next;
}

/** The admin's Retry: a failed row gets a fresh set of attempts. */
export async function retryFulfillment(db: D1Database, orderId: number): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE order_fulfillments
          SET state = 'pending', attempts = 0, updated_at = datetime('now')
        WHERE order_id = ? AND state = 'failed'`,
    )
    .bind(orderId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

/** Rows the cron should push again: pending, or abandoned mid-attempt. */
export async function listDueFulfillments(db: D1Database, limit = 10): Promise<number[]> {
  const { results } = await db
    .prepare(
      `SELECT order_id FROM order_fulfillments
        WHERE state = 'pending' OR (state = 'processing' AND lease_expires_at < datetime('now'))
        ORDER BY updated_at
        LIMIT ?`,
    )
    .bind(limit)
    .all<{ order_id: number }>();
  return (results ?? []).map((r) => r.order_id);
}
