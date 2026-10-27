import type { D1Database } from '@cloudflare/workers-types';
import { getSecret } from '../secrets/store';
import { getSetting } from '../settings/db';
import { buildFulfillmentInput } from './order';
import { PrintfulProvider } from './printful';
import type { FulfillmentProvider } from './provider';
import {
  claimFulfillment,
  listDueFulfillments,
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
