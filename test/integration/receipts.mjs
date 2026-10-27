import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import { allocateReceipt, listOrderReceipts, getReceiptByPublicId } from '../../src/features/receipts/store.ts';

// Receipt numbering against a real D1 and the real 0047 migration: one gapless
// series per kind and year, the prefix printed in the label, and an issue key
// that makes every redelivery and cron pass a no-op.
const mf = new Miniflare({
  modules: true,
  script: 'export default { fetch() { return new Response("ok") } }',
  compatibilityDate: '2026-07-20',
  d1Databases: ['DB'],
});

try {
  const db = await mf.getD1Database('DB');
  await db.exec("CREATE TABLE orders (id INTEGER PRIMARY KEY, public_id TEXT, status TEXT NOT NULL DEFAULT 'paid')");
  // The migration verbatim, one statement at a time (comments stripped).
  const migration = readFileSync(new URL('../../migrations/0047_receipts.sql', import.meta.url), 'utf8')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n');
  for (const statement of migration.split(';').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)) {
    await db.exec(statement);
  }
  await db.exec("INSERT INTO orders (id, public_id) VALUES (1, 'ord_a'), (2, 'ord_b'), (3, 'ord_c')");

  const issue = (orderId, kind, year, issueKey = `${kind}:${orderId}`) =>
    allocateReceipt(db, { orderId, kind, year, prefix: 'W', amountCents: 4000, currency: 'EUR', issueKey });

  await issue(1, 'donation', 2027);
  await issue(1, 'shipping', 2027);
  await issue(2, 'donation', 2027);
  // Redelivery and a racing cron pass: same keys, nothing new, no number used.
  await Promise.all([issue(1, 'donation', 2027), issue(2, 'donation', 2027), issue(1, 'shipping', 2027)]);
  await issue(3, 'donation', 2027);
  // A new year starts the series again.
  await issue(3, 'shipping', 2028);

  const labels = (await db.prepare('SELECT kind, label FROM receipts ORDER BY id').all()).results.map((r) => `${r.kind} ${r.label}`);
  assert.deepEqual(labels, [
    'donation W1/2027',
    'shipping W1/2027',
    'donation W2/2027',
    'donation W3/2027',
    'shipping W1/2028',
  ]);

  // Concurrent issuers for different orders never share a number.
  await db.exec("INSERT INTO orders (id, public_id) VALUES (10, 'x'), (11, 'y'), (12, 'z'), (13, 'w')");
  await Promise.all([10, 11, 12, 13].map((id) => issue(id, 'donation', 2029)));
  const numbers = (await db.prepare("SELECT number FROM receipts WHERE series_year = 2029 ORDER BY number").all()).results.map((r) => r.number);
  assert.deepEqual(numbers, [1, 2, 3, 4]);

  const forOrder = await listOrderReceipts(db, 1);
  assert.deepEqual(forOrder.map((r) => r.kind), ['donation', 'shipping']);
  assert.match(forOrder[0].public_id, /^rcpt_/);
  assert.equal(forOrder[0].document, '', 'the snapshot is written after the number is taken');
  assert.equal((await getReceiptByPublicId(db, forOrder[1].public_id)).label, 'W1/2027');

  console.log('receipts integration: all checks passed');
} finally {
  await mf.dispose();
}
