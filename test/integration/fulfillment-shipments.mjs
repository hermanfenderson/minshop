import assert from 'node:assert/strict';
import { Miniflare } from 'miniflare';
import {
  findFulfillmentOrder,
  listUnshippedFulfillments,
  recordProviderStatus,
} from '../../src/features/fulfillment/store.ts';
import {
  deleteManualPackages,
  fulfilWhenAllPacked,
  listPackages,
  loadPackableLines,
  packedQuantities,
  recordPackage,
  waitingLines,
} from '../../src/features/fulfillment/packages.ts';

// What happens after the handover (migrations 0048–0049), against a real D1:
// packages recorded once with what they hold, the order shipped only when
// nothing waits, the poll's pacing.
const mf = new Miniflare({
  modules: true,
  script: 'export default { fetch() { return new Response("ok") } }',
  compatibilityDate: '2026-07-20',
  d1Databases: ['DB'],
});

const pkg = (orderId, id, number, items, provider = 'printful') => ({
  orderId,
  provider,
  providerShipmentId: id,
  carrier: 'EVRI',
  service: 'Standard',
  trackingNumber: number,
  trackingUrl: `https://myorders.co/tracking/${id}/${number}`,
  shippedAt: '2026-10-29T10:00:00.000Z',
  items,
});

try {
  const db = await mf.getD1Database('DB');
  for (const sql of [
    "CREATE TABLE orders (id INTEGER PRIMARY KEY, fulfillment_status TEXT NOT NULL DEFAULT 'unfulfilled', tracking_carrier TEXT, tracking_number TEXT, tracking_url TEXT, fulfilled_at TEXT)",
    'CREATE TABLE shipping_labels (order_id INTEGER, status TEXT)',
    "CREATE TABLE order_fulfillments (order_id INTEGER PRIMARY KEY, provider TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, lease_expires_at TEXT, provider_order_id TEXT, provider_status TEXT, last_error TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')))",
    'CREATE TABLE products (id INTEGER PRIMARY KEY, fulfillment_ref TEXT, requires_shipping INTEGER NOT NULL DEFAULT 1)',
    'CREATE TABLE product_variants (id INTEGER PRIMARY KEY, fulfillment_ref TEXT)',
    'CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL, product_id INTEGER, variant_id INTEGER, name TEXT NOT NULL, quantity INTEGER NOT NULL)',
    'CREATE TABLE order_shipment_items (shipment_id INTEGER NOT NULL REFERENCES order_shipments(id) ON DELETE CASCADE, order_item_id INTEGER NOT NULL, quantity INTEGER NOT NULL CHECK (quantity > 0), PRIMARY KEY (shipment_id, order_item_id))',
    'CREATE TABLE order_shipments (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL, provider TEXT NOT NULL, provider_shipment_id TEXT NOT NULL, carrier TEXT, service TEXT, tracking_number TEXT, tracking_url TEXT, shipped_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime(\'now\')), UNIQUE (provider, provider_shipment_id))',
  ]) {
    await db.exec(sql);
  }
  await db.batch([
    db.prepare('INSERT INTO orders (id) VALUES (1), (2), (3), (4)'),
    // Order 1: a mug and a tee from Printful, an ukulele the shop ships, a donation.
    db.prepare("INSERT INTO products (id, fulfillment_ref, requires_shipping) VALUES (10, '4001', 1), (11, '4002', 1), (12, NULL, 1), (13, NULL, 0)"),
    db.prepare(
      `INSERT INTO order_items (id, order_id, product_id, name, quantity) VALUES
        (1, 1, 10, 'Mug', 1), (2, 1, 11, 'Tee', 1), (3, 1, 12, 'Ukulele', 1), (4, 1, 13, 'Donation', 1),
        (5, 2, 10, 'Mug', 1)`,
    ),
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
  const first = await recordPackage(db, pkg(1, 's1', 'N1', [{ orderItemId: 1, quantity: 1 }]));
  assert.ok(first);
  assert.equal(await recordPackage(db, pkg(1, 's1', 'N1', [{ orderItemId: 1, quantity: 1 }])), null);
  const lines = await loadPackableLines(db, 1);
  assert.deepEqual(lines.map((l) => [l.id, l.ref, l.requires_shipping]), [[1, '4001', 1], [2, '4002', 1], [3, null, 1], [4, null, 0]]);

  // One package of three: the order waits for the tee and the ukulele.
  assert.deepEqual(waitingLines(lines, await packedQuantities(db, 1)).map((l) => l.name), ['Tee', 'Ukulele']);
  assert.equal(await fulfilWhenAllPacked(db, 1), false);

  // The tee from another facility; then the shop's own ukulele.
  await recordPackage(db, pkg(1, 's2', 'N2', [{ orderItemId: 2, quantity: 1 }]));
  assert.equal(await fulfilWhenAllPacked(db, 1), false);
  await recordPackage(db, pkg(1, 'm1', 'U1', [{ orderItemId: 3, quantity: 1 }], 'manual'));
  assert.equal(await fulfilWhenAllPacked(db, 1), true);
  assert.equal(await fulfilWhenAllPacked(db, 1), false, 'only once');
  const order = await db.prepare('SELECT * FROM orders WHERE id = 1').first();
  assert.equal(order.fulfillment_status, 'fulfilled');
  assert.equal(order.tracking_number, 'U1', 'the latest package sums the order up');
  const packages = await listPackages(db, 1);
  assert.deepEqual(packages.map((p) => [p.provider_shipment_id, p.items.map((i) => i.name)]), [['s1', ['Mug']], ['s2', ['Tee']], ['m1', ['Ukulele']]]);

  // Marked unshipped: the package recorded by hand goes, Printful's stay.
  await deleteManualPackages(db, 1);
  assert.deepEqual((await listPackages(db, 1)).map((p) => p.provider_shipment_id), ['s1', 's2']);

  // A label purchase in flight wins: the package does not fulfil the order.
  await db.prepare("INSERT INTO shipping_labels VALUES (2, 'purchasing')").run();
  await recordPackage(db, pkg(2, 's3', 'N3', [{ orderItemId: 5, quantity: 1 }]));
  assert.equal(await fulfilWhenAllPacked(db, 2), false);

  console.log('✓ fulfillment shipments: packages once with their contents, shipped when nothing waits, poll paced');
} finally {
  await mf.dispose();
}
