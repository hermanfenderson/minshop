import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import {
  claimFulfillment,
  getFulfillment,
  listDueFulfillments,
  loadFulfillableOrder,
  markFulfillmentFailed,
  markFulfillmentSubmitted,
  MAX_FULFILLMENT_ATTEMPTS,
  queueFulfillment,
  retryFulfillment,
} from '../../src/features/fulfillment/store.ts';
import { buildFulfillmentInput } from '../../src/features/fulfillment/order.ts';

// The order_fulfillments statements against a real D1: which orders open a
// row, the line/ref join, claim exclusivity, fencing, and the failed park.
const mf = new Miniflare({
  modules: true,
  script: 'export default { fetch() { return new Response("ok") } }',
  compatibilityDate: '2026-07-20',
  d1Databases: ['DB'],
});

try {
  const db = await mf.getD1Database('DB');
  for (const sql of [
    'CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, fulfillment_ref TEXT)',
    'CREATE TABLE product_variants (id INTEGER PRIMARY KEY, product_id INTEGER, label TEXT, fulfillment_ref TEXT)',
    "CREATE TABLE orders (id INTEGER PRIMARY KEY, public_id TEXT, email TEXT, currency TEXT, ship_address TEXT, status TEXT NOT NULL DEFAULT 'paid')",
    'CREATE TABLE order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, product_id INTEGER, variant_id INTEGER, name TEXT, price_cents INTEGER, quantity INTEGER)',
    "CREATE TABLE order_fulfillments (order_id INTEGER PRIMARY KEY, provider TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, lease_expires_at TEXT, provider_order_id TEXT, provider_status TEXT, last_error TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
  ]) {
    await db.exec(sql);
  }
  const address = JSON.stringify({ name: 'Ada', line1: 'Via Roma 1', line2: null, city: 'Monopoli', state: null, postal: '70043', country: 'IT' });
  await db.batch([
    // Tee: variants linked. Mug: no variants, linked on the product. Gratitude: not linked.
    db.prepare("INSERT INTO products VALUES (1, 'Tee', NULL), (2, 'Mug', '5001'), (3, 'Gratitude', NULL)"),
    db.prepare("INSERT INTO product_variants VALUES (10, 1, 'Black / M', '4011'), (11, 1, 'White / S', NULL)"),
    db.prepare("INSERT INTO orders VALUES (1, 'ord_mixed', 'a@example.com', 'EUR', ?, 'paid'), (2, 'ord_own', 'b@example.com', 'EUR', ?, 'paid'), (3, 'ord_refunded', 'c@example.com', 'EUR', ?, 'refunded')").bind(address, address, address),
    db.prepare(`INSERT INTO order_items (order_id, product_id, variant_id, name, price_cents, quantity) VALUES
      (1, 1, 10, 'Tee — Black / M', 2500, 2), (1, 2, NULL, 'Mug', 1500, 1), (1, 3, NULL, 'Gratitude', 1000, 1),
      (1, 1, 11, 'Tee — White / S', 2500, 1),
      (2, 3, NULL, 'Gratitude', 1000, 1),
      (3, 2, NULL, 'Mug', 1500, 1)`),
  ]);

  // Only a paid order with a linked line opens a row, and only once.
  assert.equal(await queueFulfillment(db, 1, 'printful'), true);
  assert.equal(await queueFulfillment(db, 1, 'printful'), false);
  assert.equal(await queueFulfillment(db, 2, 'printful'), false, 'nothing of the fulfiller in it');
  assert.equal(await queueFulfillment(db, 3, 'printful'), false, 'not paid');

  // The join: a variant's ref, a variant-less product's ref, nothing for the rest.
  const loaded = await loadFulfillableOrder(db, 1);
  assert.deepEqual(loaded.rows.map((r) => r.ref), ['4011', '5001', null, null]);
  const built = buildFulfillmentInput(loaded.order, loaded.rows);
  assert.equal(built.kind, 'send');
  assert.deepEqual(built.input.lines.map((l) => [l.ref, l.quantity]), [['4011', 2], ['5001', 1]]);

  // Claim once; fencing keeps a stale worker from finishing over a live one.
  assert.equal(await claimFulfillment(db, 1), 1);
  assert.equal(await claimFulfillment(db, 1), null);
  await db.prepare("UPDATE order_fulfillments SET lease_expires_at = datetime('now', '-1 minute')").run();
  assert.deepEqual(await listDueFulfillments(db), [1]);
  assert.equal(await claimFulfillment(db, 1), 2);
  await markFulfillmentSubmitted(db, 1, 1, '99', 'draft');
  assert.equal((await getFulfillment(db, 1)).state, 'processing');
  // A retryable failure goes back to pending; a refusal parks it.
  assert.equal(await markFulfillmentFailed(db, 1, 2, 'Printful 503', true), 'pending');
  assert.equal(await claimFulfillment(db, 1), 3);
  assert.equal(await markFulfillmentFailed(db, 1, 3, 'Printful 400: bad variant', false), 'failed');
  assert.deepEqual(await listDueFulfillments(db), []);
  assert.equal(await claimFulfillment(db, 1), null);

  // Retry by a person: fresh attempts, then it goes through.
  assert.equal(await retryFulfillment(db, 1), true);
  assert.equal(await claimFulfillment(db, 1), 1);
  await markFulfillmentSubmitted(db, 1, 1, '99', 'draft');
  const done = await getFulfillment(db, 1);
  assert.equal(done.state, 'submitted');
  assert.equal(done.provider_order_id, '99');
  assert.equal(done.last_error, null);
  assert.equal(await claimFulfillment(db, 1), null, 'a submitted order is never sent again');
  assert.equal(await retryFulfillment(db, 1), false);

  // A worker that died on its last attempt is parked for a person, not left "sending".
  await db
    .prepare(
      `UPDATE order_fulfillments SET state = 'processing', attempts = ?, lease_expires_at = datetime('now', '-1 minute') WHERE order_id = 1`,
    )
    .bind(MAX_FULFILLMENT_ATTEMPTS)
    .run();
  assert.equal(await claimFulfillment(db, 1), null);
  assert.equal((await getFulfillment(db, 1)).state, 'failed');

  console.log('fulfillment integration: all checks passed');
} finally {
  await mf.dispose();
}
