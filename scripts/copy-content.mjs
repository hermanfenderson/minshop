#!/usr/bin/env node
//
// Populate a NEW instance from an existing one: catalog, translations, media
// (D1 rows + the image objects in R2) and an allowlist of settings. Never the
// shop's history: orders, checkouts, receipts, refunds, notifications, labels
// and sessions stay behind, and so does the encrypted vault (enc:* settings):
// it is sealed with the source's SECRETS_KEK and holds the source's keys.
//
//   Usage:  node scripts/copy-content.mjs <from-slug> <to-slug> [--apply] [--set key=value ...]
//
// Without --apply it only reads both instances and prints the plan. With
// --apply it writes to the TARGET (never the source), and refuses unless the
// target's content tables are empty, so it cannot merge into a live shop.
// Run it BEFORE the target's first deploy: the settings it copies
// (admin_password_hash, setup_complete) close the first-run setup wizard.
//
// --set overrides a copied setting or adds one, e.g. --set store_url=https://…
// --set accounts_enabled=0. A value of "-" drops the key from the copy.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const [from, to] = args.filter((a) => !a.startsWith('--') && !a.includes('='));
const apply = args.includes('--apply');
const overrides = Object.fromEntries(
  args.flatMap((a, i) => (args[i - 1] === '--set' ? [a.split(/=(.*)/s).slice(0, 2)] : [])),
);
const slug = /^[a-z][a-z0-9-]{1,40}$/;
if (!slug.test(from ?? '') || !slug.test(to ?? '') || from === to) {
  console.error('usage: node scripts/copy-content.mjs <from-slug> <to-slug> [--apply] [--set key=value ...]');
  process.exit(1);
}

// Insertion order follows the foreign keys (deferred anyway, see below).
const CONTENT_TABLES = [
  'media',
  'categories', 'category_translations',
  'products', 'product_translations',
  'product_images', 'product_image_translations',
  'product_variants', 'product_variant_translations',
  'product_categories',
  'product_extras', 'product_extra_translations',
  'pages', 'page_translations', 'page_media',
  'menu_items', 'menu_item_translations',
];
// Shop history and transient state: never copied (listed so the plan says so).
const SKIPPED_TABLES = [
  'orders', 'order_items', 'order_item_ids', 'order_guest_access', 'order_notifications',
  'order_fulfillments', 'order_inventory_exceptions', 'order_reference_aliases',
  'checkout_reservations', 'checkout_notifications', 'pending_payments',
  'receipts', 'refunds', 'refund_sync_events', 'shipping_labels', 'shipping_label_attempts',
];
// Settings copied as they are. Anything else (enc:* vault, email_*, store_url…)
// stays behind unless passed with --set.
const SETTINGS = [
  'store_name', 'time_zone', 'i18n_enabled_locales', 'commerce_mode',
  'payment_methods_disabled', 'shipping_config', 'accounts_enabled',
  'receipt_issuer', 'receipt_prefix', 'receipt_logo_key', 'receipt_stamp_key',
  'admin_password_hash', 'setup_complete', 'email_notify_to',
];

function instance(name) {
  const env = readFileSync(join(root, '.instances', `${name}.env`), 'utf8');
  const get = (key) => env.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1];
  return { db: get('DB_NAME'), bucket: get('BUCKET') };
}

function wrangler(argv, { input } = {}) {
  const result = spawnSync(join(root, 'node_modules/.bin/wrangler'), argv, {
    cwd: root, encoding: 'utf8', input, env: { ...process.env, CI: '1' }, maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`wrangler ${argv.slice(0, 3).join(' ')} failed:\n${result.stderr || result.stdout}`);
  return result.stdout;
}
const query = (db, sql) => JSON.parse(wrangler(['d1', 'execute', db, '--remote', '--json', '--command', sql]))[0].results;
const sqlString = (v) => (v === null ? 'NULL' : `'${String(v).replaceAll("'", "''")}'`);
const counts = (db, tables) =>
  query(db, `SELECT ${tables.map((t) => `(SELECT count(*) FROM "${t}") AS "${t}"`).join(', ')}`)[0];

const src = instance(from);
const dst = instance(to);
console.log(`▸ ${from} (${src.db}, ${src.bucket}) → ${to} (${dst.db}, ${dst.bucket})${apply ? '' : '   [plan only]'}`);

const srcCounts = counts(src.db, [...CONTENT_TABLES, ...SKIPPED_TABLES]);
const dstCounts = counts(dst.db, CONTENT_TABLES);
console.log('\n  table                          copy  target now');
for (const t of CONTENT_TABLES) console.log(`  ${t.padEnd(30)} ${String(srcCounts[t]).padStart(4)}  ${dstCounts[t]}`);
console.log('\n  not copied: ' + SKIPPED_TABLES.map((t) => `${t} (${srcCounts[t]})`).join(', '));
console.log('  not copied: the vault (enc:*), sessions (KV), the private files bucket');

const srcSettings = Object.fromEntries(query(src.db, 'SELECT key, value FROM settings').map((r) => [r.key, r.value]));
const settings = Object.fromEntries(SETTINGS.filter((k) => k in srcSettings).map((k) => [k, srcSettings[k]]));
for (const [k, v] of Object.entries(overrides)) {
  if (k.startsWith('enc:')) throw new Error('the vault is never copied or set from here');
  if (v === '-') delete settings[k]; else settings[k] = v;
}
const secretish = (k) => k === 'admin_password_hash';
console.log('\n  settings: ' + Object.entries(settings).map(([k, v]) => (secretish(k) ? `${k}=(hidden)` : `${k}=${JSON.stringify(v).slice(0, 60)}`)).join('\n            '));
console.log('  left out: ' + Object.keys(srcSettings).filter((k) => !(k in settings)).join(', '));

const keys = query(src.db, 'SELECT image_key, mime_type FROM media ORDER BY id');
console.log(`\n  R2: ${keys.length} image objects (${src.bucket} → ${dst.bucket})`);

if (!apply) {
  console.log('\nPlan only. Re-run with --apply to write the target.');
  process.exit(0);
}

const busy = CONTENT_TABLES.filter((t) => dstCounts[t] > 0);
const dstSettings = query(dst.db, 'SELECT count(*) AS n FROM settings')[0].n;
if (busy.length || dstSettings > 0) {
  throw new Error(`target is not empty (${[...busy, dstSettings ? 'settings' : ''].filter(Boolean).join(', ')}): refusing to merge`);
}

const work = mkdtempSync(join(tmpdir(), 'minshop-copy-'));
try {
  // 1. Rows: one data-only export of the content tables, applied in one file.
  const dump = join(work, 'content.sql');
  wrangler(['d1', 'export', src.db, '--remote', '--no-schema', '--output', dump, ...CONTENT_TABLES.flatMap((t) => ['--table', t])]);
  const body = readFileSync(dump, 'utf8');
  const settingsSql = Object.entries(settings)
    .map(([k, v]) => `INSERT INTO settings (key, value) VALUES (${sqlString(k)}, ${sqlString(v)});`).join('\n');
  writeFileSync(dump, `PRAGMA defer_foreign_keys = on;\n${body}\n${settingsSql}\n`);
  wrangler(['d1', 'execute', dst.db, '--remote', '--yes', '--file', dump]);
  const after = counts(dst.db, CONTENT_TABLES);
  const wrong = CONTENT_TABLES.filter((t) => after[t] !== srcCounts[t]);
  if (wrong.length) throw new Error(`row counts differ after the copy: ${wrong.join(', ')}`);
  console.log('✓ rows copied, counts match');

  // 2. Images: object by object (wrangler has no bucket-to-bucket copy).
  let n = 0;
  for (const { image_key: key, mime_type: type } of keys) {
    const file = join(work, 'object');
    wrangler(['r2', 'object', 'get', `${src.bucket}/${key}`, '--remote', '--file', file]);
    wrangler(['r2', 'object', 'put', `${dst.bucket}/${key}`, '--remote', '--file', file, ...(type ? ['--content-type', type] : [])]);
    if (++n % 50 === 0) console.log(`  ${n}/${keys.length} objects`);
  }
  console.log(`✓ ${n} objects copied`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
