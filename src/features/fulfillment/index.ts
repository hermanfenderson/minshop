import type { D1Database } from '@cloudflare/workers-types';
import { deliverOrderNotifications } from '../email/outbox';
import { packageShippedKind, queueNotification } from '../email/outboxStore';
import { getSecret } from '../secrets/store';
import { getSetting } from '../settings/db';
import { buildFulfillmentInput } from './order';
export { fulfillmentWebhookKey } from './webhookKey';
import { PrintfulProvider } from './printful';
import { buyerShippingCents, parseSurchargePct } from './shippingQuote';
import type { FulfillmentProvider } from './provider';
import {
  claimFulfillment,
  findFulfillmentOrder,
  listDueFulfillments,
  listUnshippedFulfillments,
  loadVariantRefs,
  loadFulfillableOrder,
  markFulfillmentFailed,
  markFulfillmentSubmitted,
  queueFulfillment,
  recordProviderStatus,
} from './store';
import {
  addPackageItems,
  fulfillerRemainder,
  fulfilWhenAllPacked,
  loadPackableLines,
  mapPackageItems,
  packagesWithoutItems,
  packedQuantities,
  recordPackage,
} from './packages';

/**
 * Factory + driver. Optional infrastructure like the payment rails: with no
 * Printful token in the vault every call here is a no-op, so a shop that ships
 * everything itself never notices this feature exists.
 */
export async function getFulfillmentProvider(db: D1Database): Promise<FulfillmentProvider | null> {
  const token = await getSecret(db, 'printful_api_token');
  return token ? new PrintfulProvider(token) : null;
}

/** Off unless the merchant chose it: a draft costs nothing until someone confirms it. */
async function confirmsOrders(db: D1Database): Promise<boolean> {
  return (await getSetting(db, 'printful_confirm_orders')) === '1';
}

/**
 * Hand a just-paid order to the fulfiller, if it has lines for it. Safe to call
 * from every settlement path and every redelivery: the row is opened once, and
 * a submitted row is never claimed again. Never throws into settlement — the
 * order is already paid and saved; a failure stays on the row for the cron and
 * the admin.
 */
export async function dispatchFulfillment(db: D1Database, orderId: number): Promise<void> {
  try {
    const provider = await getFulfillmentProvider(db);
    if (!provider) return;
    await queueFulfillment(db, orderId, provider.name);
    await pushFulfillment(db, orderId, provider);
  } catch (err) {
    console.error(`Fulfillment dispatch failed for order ${orderId}:`, err);
  }
}

/**
 * Cron: push rows left pending by an outage, or abandoned mid-attempt; then read
 * back a few handed-over orders not shipped yet, in case a webhook never came.
 */
export async function sweepFulfillments(db: D1Database): Promise<void> {
  const provider = await getFulfillmentProvider(db);
  if (!provider) return;
  for (const orderId of await listDueFulfillments(db)) {
    try {
      await pushFulfillment(db, orderId, provider);
    } catch (err) {
      console.error(`Fulfillment retry failed for order ${orderId}:`, err);
    }
  }
  for (const row of await listUnshippedFulfillments(db)) {
    try {
      await syncFulfillment(db, row.order_id, row.provider_order_id, provider, null);
    } catch (err) {
      console.error(`Fulfillment read-back failed for order ${row.order_id}:`, err);
    }
  }
}

export type SyncOutcome = 'unknown-order' | 'synced' | 'shipped' | { retryable: boolean; error: string };

/**
 * A fulfiller's webhook for its order `providerOrderId`. The body is not
 * believed: the order is read back from the fulfiller's API.
 */
export async function handleFulfillmentEvent(
  db: D1Database,
  provider: FulfillmentProvider,
  providerOrderId: string,
  origin: string,
): Promise<SyncOutcome> {
  const orderId = await findFulfillmentOrder(db, provider.name, providerOrderId);
  if (orderId == null) return 'unknown-order';
  return syncFulfillment(db, orderId, providerOrderId, provider, origin);
}

/**
 * Read the fulfiller's order back and record what changed: its status and
 * every new package with what it holds. Each new package queues its own email;
 * the order is marked shipped only when every line that ships is in a package
 * (the shop may still owe its own items: an ukulele, say).
 */
export async function syncFulfillment(
  db: D1Database,
  orderId: number,
  providerOrderId: string,
  provider: FulfillmentProvider,
  requestOrigin: string | null,
): Promise<SyncOutcome> {
  const read = await provider.getOrder(providerOrderId);
  if (!read.ok) return { retryable: read.retryable, error: read.error };
  await recordProviderStatus(db, orderId, read.order.status);
  const lines = await loadPackableLines(db, orderId);
  const packed = await packedQuantities(db, orderId);
  const added: number[] = [];
  for (const s of read.order.shipments) {
    const items = s.items ? mapPackageItems(s.items, lines, packed) : [];
    const id = await recordPackage(db, {
      orderId,
      provider: provider.name,
      providerShipmentId: s.id,
      carrier: s.carrier,
      service: s.service,
      trackingNumber: s.trackingNumber,
      trackingUrl: s.trackingUrl,
      shippedAt: s.shippedAt,
      items,
    });
    if (id == null) continue;
    for (const i of items) packed.set(i.orderItemId, (packed.get(i.orderItemId) ?? 0) + i.quantity);
    added.push(id);
  }
  // The fulfiller says it is done: whatever of its lines no package listed
  // went in its last package that did not say what it held (or its last one).
  if (read.order.status === 'fulfilled') {
    const rest = fulfillerRemainder(lines, packed);
    if (rest.length > 0) {
      const target = (await packagesWithoutItems(db, orderId, provider.name)).at(-1) ?? (await lastPackage(db, orderId, provider.name));
      if (target != null) await addPackageItems(db, target, rest);
    }
  }
  if (added.length === 0) return 'synced';
  for (const id of added) await queueNotification(db, orderId, packageShippedKind(id));
  await fulfilWhenAllPacked(db, orderId);
  // Links in the email use the shop's public address, never the host the
  // fulfiller happened to call. Without one, the outbox sweep sends it later.
  const origin = (await getSetting(db, 'store_url')) || requestOrigin;
  if (origin) {
    try {
      await deliverOrderNotifications(db, orderId, origin);
    } catch (err) {
      console.error(`Shipped-notification delivery failed for order ${orderId}:`, err);
    }
  }
  return 'shipped';
}

async function lastPackage(db: D1Database, orderId: number, provider: string): Promise<number | null> {
  const row = await db
    .prepare('SELECT id FROM order_shipments WHERE order_id = ? AND provider = ? ORDER BY id DESC LIMIT 1')
    .bind(orderId, provider)
    .first<{ id: number }>();
  return row?.id ?? null;
}

export async function pushFulfillment(db: D1Database, orderId: number, provider: FulfillmentProvider): Promise<void> {
  const attempts = await claimFulfillment(db, orderId);
  if (attempts == null) return;
  const loaded = await loadFulfillableOrder(db, orderId);
  const built = loaded ? buildFulfillmentInput(loaded.order, loaded.rows) : null;
  if (!built || built.kind !== 'send') {
    const reason = !built
      ? 'Order not found'
      : built.kind === 'blocked'
        ? built.reason
        : 'No line is linked to the fulfiller any more';
    await markFulfillmentFailed(db, orderId, attempts, reason, false);
    return;
  }
  const outcome = await provider.submitOrder({ ...built.input, confirm: await confirmsOrders(db) });
  if (outcome.ok) {
    await markFulfillmentSubmitted(db, orderId, attempts, outcome.providerOrderId, outcome.status);
    return;
  }
  const state = await markFulfillmentFailed(db, orderId, attempts, outcome.error, outcome.retryable);
  if (state === 'failed') console.error(`Fulfillment for order ${orderId} needs attention: ${outcome.error}`);
}

export interface FulfillerShippingLine {
  /** The line's variant, whose refs win; null = the product's refs apply. */
  variantId: number | null;
  productRef: string | null;
  productRateRef: string | null;
  quantity: number;
  requiresShipping: boolean;
}

/** How long checkout waits for the fulfiller's rate before using the shop's own. */
const QUOTE_TIMEOUT_MS = 4000;

/**
 * The buyer's price for the fulfiller's part of a cart, or null when there is
 * none or it cannot be had (not configured, no catalog id, the fulfiller slow
 * or down) — the caller then keeps the shop's own zone rates, so checkout
 * never stops because of the fulfiller.
 */
export async function quoteFulfillerShipping(
  db: D1Database,
  lines: FulfillerShippingLine[],
  countryCode: string,
  currency: string,
): Promise<{ cents: number; shipsEverything: boolean } | null> {
  try {
    const variantRefs = await loadVariantRefs(
      db,
      lines.flatMap((l) => (l.variantId == null ? [] : [l.variantId])),
    );
    const resolved = lines.map((l) => {
      const v = l.variantId == null ? null : variantRefs.get(l.variantId);
      return {
        ...l,
        ref: l.variantId == null ? l.productRef : (v?.fulfillment_ref ?? null),
        rateRef: l.variantId == null ? l.productRateRef : (v?.fulfillment_rate_ref ?? null),
      };
    });
    const theirs = resolved.filter((l) => l.ref);
    if (theirs.length === 0) return null;
    const provider = await getFulfillmentProvider(db);
    if (!provider) return null;
    if (theirs.some((l) => !l.rateRef)) {
      console.error('Fulfiller shipping quote skipped: a linked line has no catalog id (rerun the link script).');
      return null;
    }
    const outcome = await provider.quoteShipping({
      countryCode,
      currency,
      lines: theirs.map((l) => ({ rateRef: l.rateRef!, quantity: l.quantity })),
      signal: AbortSignal.timeout(QUOTE_TIMEOUT_MS),
    });
    if (!outcome.ok) {
      console.error(`Fulfiller shipping quote failed (${countryCode}): ${outcome.error}`);
      return null;
    }
    const pct = parseSurchargePct(await getSetting(db, 'printful_shipping_surcharge_pct'));
    return {
      cents: buyerShippingCents(outcome.amountCents, pct),
      shipsEverything: resolved.every((l) => !l.requiresShipping || l.ref),
    };
  } catch (err) {
    console.error('Fulfiller shipping quote failed:', err);
    return null;
  }
}
