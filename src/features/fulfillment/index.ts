import type { D1Database } from '@cloudflare/workers-types';
import { getSecret } from '../secrets/store';
import { getSetting } from '../settings/db';
import { buildFulfillmentInput } from './order';
import { PrintfulProvider } from './printful';
import { buyerShippingCents, parseSurchargePct } from './shippingQuote';
import type { FulfillmentProvider } from './provider';
import {
  claimFulfillment,
  listDueFulfillments,
  loadVariantRefs,
  loadFulfillableOrder,
  markFulfillmentFailed,
  markFulfillmentSubmitted,
  queueFulfillment,
} from './store';

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

/** Cron: push rows left pending by an outage, or abandoned mid-attempt. */
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
