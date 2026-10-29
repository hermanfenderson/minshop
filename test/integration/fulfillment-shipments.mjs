import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import {
  findFulfillmentOrder,
  fulfillFromShipment,
  listShipments,
  listUnshippedFulfillments,
  recordProviderStatus,
  recordShipments,
} from '../../src/features/fulfillment/store.ts';

// What happens after the handover (migration 0048), against a real D1: packages
// recorded once, the first one fulfils the order once, the poll's pacing.
const mf = new Miniflare({
  modules: true,
  script: 'export default { fetch() { return new Response("ok") } }',
  compatibilityDate: '2026-07-20',
  d1Databases: ['DB'],
});

const pkg = (id, number) => ({
  id,
  carrier: 'EVRI',
  service: 'Standard',
  trackingNumber: number,
  trackingUrl: `https://myorders.co/tracking/${id}/${number}`,
  shippedAt: '2026-10-29T10:00:00.000Z',
});

try {
  const db = await mf.getD1Database('DB');
  for (const sql of [
    "CREATE TABLE orders (id INTEGER PRIMARY KEY, fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled', tracking_carrier TEXT, tracking_number TEXT, tracking_url TEXT, fulfilled_at TEXT)",
    'CREATE TABLE shipping_labels (order_id INTEGER, status TEXT)',
    "CREATE TABLE order_fulfillments (order_id INTEGER PRIMARY KEY, provider TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, lease_expires_at TEXT, provider_order_id TEXT, provider_status TEXT, last_error TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
    'CREATE TABLE order_shipments (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, provider TEXT NOT NULL, provider_shipment_id TEXT NOT NULL, carrier TEXT, service TEXT, tracking_number TEXT, tracking_url TEXT, shipped_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime(\'now\')), UNIQUE (provider, provider_shipment_id))',
  ]) {
    await db.exec(sql);
  }
  await db.batch([
    db.prepare('INSERT INTO orders (id) VALUES (1), (2), (3), (4)'),
    db.prepare(
      `INSERT INTO order_fulfillments (order_id, provider, state, provider_order_id, provider_status, updated_at) VALUES
        (1, 'printful', 'submitted', '900', 'pending', datetime('now', '-7 hours')),
        (2, 'printful', 'submitted', '901', 'pending', datetime('now', '-1 hours')),
        (3, 'printful', 'failed', NULL, NULL, datetime('now', '-7 hours')),
        (4, 'printful', 'submitted', '903', 'canceled', datetime('now', '-7 hours'))`,
    ),
  ]);

  // Only handed-over rows are found by the fulfiller's id.
  assert.equal(await findFulfillmentOrder(db, 'printful', '900'), 1);
  assert.equal(await findFulfillmentOrder(db, 'printful', 'nope'), null);
  assert.equal(await findFulfillmentOrder(db, 'shippo', '900'), null);

  // The poll: unshipped, not canceled, not read in the last 6 hours.
  assert.deepEqual(await listUnshippedFulfillments(db), [{ order_id: 1, provider_order_id: '900' }]);
  await recordProviderStatus(db, 1, 'inprocess');
  assert.deepEqual(await listUnshippedFulfillments(db), [], 'a read-back paces the next one');

  // Packages: recorded once each, whatever the number of webhooks.
  assert.deepEqual((await recordShipments(db, 1, 'printful', [pkg('s1', 'N1')])).map((s) => s.id), ['s1']);
  assert.deepEqual(await recordShipments(db, 1, 'printful', [pkg('s1', 'N1')]), []);
  assert.deepEqual((await recordShipments(db, 1, 'printful', [pkg('s1', 'N1'), pkg('s2', 'N2')])).map((s) => s.id), ['s2']);
  assert.deepEqual((await listShipments(db, 1)).map((s) => s.tracking_number), ['N1', 'N2']);

  // The first package fulfils the order with its tracking page, and only once.
  assert.equal(await fulfillFromShipment(db, 1, pkg('s1', 'N1')), true);
  assert.equal(await fulfillFromShipment(db, 1, pkg('s2', 'N2')), false);
  const order = await db.prepare('SELECT * FROM orders WHERE id = 1').first();
  assert.equal(order.fulfillment_status, 'fulfilled');
  assert.equal(order.tracking_number, 'N1');
  assert.equal(order.tracking_url, 'https://myorders.co/tracking/s1/N1');

  // A label purchase in flight wins: the package does not fulfil the order.
  await db.prepare("INSERT INTO shipping_labels VALUES (2, 'purchasing')").run();
  assert.equal(await fulfillFromShipment(db, 2, pkg('s3', 'N3')), false);

  console.log('✓ fulfillment shipments: packages once, first one fulfils once, poll paced');
} finally {
  await mf.dispose();
}
