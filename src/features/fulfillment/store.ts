import type { D1Database } from '@cloudflare/workers-types';
import type { FulfillableOrder, OrderLineRow } from './order';
import type { FulfillmentShipment } from './provider';

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

/** Fulfiller ids of the given variants, for a checkout quote. */
export async function loadVariantRefs(
  db: D1Database,
  variantIds: number[],
): Promise<Map<number, { fulfillment_ref: string | null; fulfillment_rate_ref: string | null }>> {
  const ids = [...new Set(variantIds)];
  if (ids.length === 0) return new Map();
  const { results } = await db
    .prepare(
      `SELECT id, fulfillment_ref, fulfillment_rate_ref FROM product_variants WHERE id IN (${ids.map(() => '?').join(', ')})`,
    )
    .bind(...ids)
    .all<{ id: number; fulfillment_ref: string | null; fulfillment_rate_ref: string | null }>();
  return new Map((results ?? []).map((r) => [r.id, r]));
}

// ── After the handover: what the fulfiller did with the order (migration 0048) ──

/** Our order behind a fulfiller's order id, if we handed it over. */
export async function findFulfillmentOrder(
  db: D1Database,
  provider: string,
  providerOrderId: string,
): Promise<number | null> {
  const row = await db
    .prepare(`SELECT order_id FROM order_fulfillments WHERE provider = ? AND provider_order_id = ? AND state = 'submitted'`)
    .bind(provider, providerOrderId)
    .first<{ order_id: number }>();
  return row?.order_id ?? null;
}

/** The fulfiller's status as just read; also stamps the row, which paces the poll. */
export async function recordProviderStatus(db: D1Database, orderId: number, status: string): Promise<void> {
  await db
    .prepare(`UPDATE order_fulfillments SET provider_status = ?, updated_at = datetime('now') WHERE order_id = ?`)
    .bind(status.slice(0, 40), orderId)
    .run();
}

/** Store the packages not seen before; returns those, in the fulfiller's order. */
export async function recordShipments(
  db: D1Database,
  orderId: number,
  provider: string,
  shipments: FulfillmentShipment[],
): Promise<FulfillmentShipment[]> {
  const added: FulfillmentShipment[] = [];
  for (const s of shipments) {
    const res = await db
      .prepare(
        `INSERT OR IGNORE INTO order_shipments
           (order_id, provider, provider_shipment_id, carrier, service, tracking_number, tracking_url, shipped_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(orderId, provider, s.id, s.carrier, s.service, s.trackingNumber, s.trackingUrl, s.shippedAt)
      .run();
    if ((res.meta?.changes ?? 0) > 0) added.push(s);
  }
  return added;
}

/**
 * The first package marks the order shipped with its tracking, once: an order
 * already fulfilled (by hand, a label, or an earlier package) is left alone, and
 * so is one with a label purchase in flight. True = it changed now, so the
 * customer's shipped email is due.
 */
export async function fulfillFromShipment(db: D1Database, orderId: number, s: FulfillmentShipment): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE orders
          SET fulfillment_status = 'fulfilled', tracking_carrier = ?, tracking_number = ?, tracking_url = ?,
              fulfilled_at = datetime('now')
        WHERE id = ? AND fulfillment_status = 'unfulfilled'
          AND NOT EXISTS (
            SELECT 1 FROM shipping_labels
             WHERE order_id = orders.id AND status IN ('purchasing', 'uncertain')
          )`,
    )
    .bind(s.carrier, s.trackingNumber, s.trackingUrl, orderId)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export interface ShipmentRow {
  provider_shipment_id: string;
  carrier: string | null;
  service: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
}

export async function listShipments(db: D1Database, orderId: number): Promise<ShipmentRow[]> {
  const { results } = await db
    .prepare(
      `SELECT provider_shipment_id, carrier, service, tracking_number, tracking_url, shipped_at
         FROM order_shipments WHERE order_id = ? ORDER BY id`,
    )
    .bind(orderId)
    .all<ShipmentRow>();
  return results ?? [];
}

/**
 * Handed-over orders not shipped yet, for the cron to read back in case a
 * webhook never came: each at most every 6 hours, for 60 days.
 */
export async function listUnshippedFulfillments(
  db: D1Database,
  limit = 5,
): Promise<Array<{ order_id: number; provider_order_id: string }>> {
  const { results } = await db
    .prepare(
      `SELECT f.order_id, f.provider_order_id
         FROM order_fulfillments f JOIN orders o ON o.id = f.order_id
        WHERE f.state = 'submitted' AND f.provider_order_id IS NOT NULL
          AND COALESCE(f.provider_status, '') <> 'canceled'
          AND o.fulfillment_status = 'unfulfilled'
          AND f.created_at > datetime('now', '-60 days')
          AND f.updated_at < datetime('now', '-6 hours')
        ORDER BY f.updated_at
        LIMIT ?`,
    )
    .bind(limit)
    .all<{ order_id: number; provider_order_id: string }>();
  return results ?? [];
}
