#!/usr/bin/env node
// Copy Printful products from one store to an API store, then link the shop's
// variants to them.
//
//   node --env-file=.env.printful-<test|prod> scripts/printful-copy.mjs list
//   node --env-file=.env.printful-<test|prod> scripts/printful-copy.mjs copy [--only <sourceProductId>] [--apply]
//   node --env-file=.env.printful-<test|prod> scripts/printful-copy.mjs link --local | --instance <slug> [--apply]
//
// PRINTFUL_SOURCE_TOKEN reads the store the products live in today (any store
// type; read-only scopes are enough). PRINTFUL_TOKEN is the API store's token
// (products: view and manage). The source store is only ever read.
//
// copy: each source product is recreated with the same catalog variants, print
// files (by file-library id), options, SKUs and prices. Its external id is the
// source product's, and an existing one is skipped, so a rerun only adds what is
// missing. Without --apply it prints what it would do.
//
// link: sets product_variants.fulfillment_ref to the API store's sync variant
// id (and fulfillment_rate_ref to its catalog variant id), matched on SKU (the WooCommerce import kept Printful's SKUs). Without
// --apply it prints the SQL instead of running it.

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const BASE = 'https://api.printful.com';
const [command, ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes(name);
const option = (name) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};
const apply = flag('--apply');

function token(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set (run with --env-file=.env.printful-test or -prod).`);
    process.exit(1);
  }
  return value;
}

async function pf(tok, path, init = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    });
    const body = await res.json().catch(() => null);
    // 120 requests a minute: back off and try again rather than fail midway.
    if (res.status === 429 && attempt < 5) {
      await new Promise((r) => setTimeout(r, 15_000));
      continue;
    }
    return { status: res.status, body };
  }
}

/** Every sync product of a store, with its variants. `/sync` works on any store type. */
async function listProducts(tok, path) {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const { status, body } = await pf(tok, `${path}?limit=100&offset=${offset}`);
    if (status !== 200) throw new Error(`${path}: ${status} ${JSON.stringify(body?.error ?? body)}`);
    out.push(...body.result);
    if (out.length >= body.paging.total) return out;
  }
}

async function getProduct(tok, path, id) {
  const { status, body } = await pf(tok, `${path}/${id}`);
  if (status !== 200) throw new Error(`${path}/${id}: ${status} ${JSON.stringify(body?.error ?? body)}`);
  return body.result;
}

/** The create body for the API store, from a source product. */
function copyPayload(source) {
  const p = source.sync_product;
  return {
    sync_product: { name: p.name, external_id: String(p.external_id ?? p.id) },
    sync_variants: source.sync_variants
      .filter((v) => !v.is_ignored)
      .map((v) => ({
        ...(v.external_id ? { external_id: String(v.external_id) } : {}),
        variant_id: v.variant_id,
        retail_price: v.retail_price,
        ...(v.sku ? { sku: v.sku } : {}),
        files: v.files.map((f) => ({ type: f.type, id: f.id, ...(f.options?.length ? { options: f.options } : {}) })),
        options: v.options,
      })),
  };
}

async function list() {
  const src = token('PRINTFUL_SOURCE_TOKEN');
  for (const p of await listProducts(src, '/sync/products')) {
    console.log(`${p.id}\t${p.external_id}\t${p.variants} variants\t${p.name}`);
  }
}

async function copy() {
  const src = token('PRINTFUL_SOURCE_TOKEN');
  const dst = token('PRINTFUL_TOKEN');
  const only = option('--only');
  const existing = new Set((await listProducts(dst, '/store/products')).map((p) => String(p.external_id)));
  let sources = await listProducts(src, '/sync/products');
  if (only) sources = sources.filter((p) => String(p.id) === only);
  let created = 0;
  for (const summary of sources) {
    const extId = String(summary.external_id ?? summary.id);
    if (existing.has(extId)) {
      console.log(`skip    ${summary.name} (already in the API store)`);
      continue;
    }
    const payload = copyPayload(await getProduct(src, '/sync/products', summary.id));
    if (!apply) {
      console.log(`would copy ${summary.name}: ${payload.sync_variants.length} variants`);
      continue;
    }
    const { status, body } = await pf(dst, '/store/products', { method: 'POST', body: JSON.stringify(payload) });
    if (status !== 200) {
      console.error(`FAILED  ${summary.name}: ${status} ${body?.error?.message ?? JSON.stringify(body)}`);
      continue;
    }
    created++;
    console.log(`copied  ${summary.name} → ${body.result.id}`);
  }
  if (apply) console.log(`${created} product(s) created.`);
}

const sqlString = (s) => `'${String(s).replaceAll("'", "''")}'`;

async function link() {
  const dst = token('PRINTFUL_TOKEN');
  const local = flag('--local');
  const instance = option('--instance');
  if (!local && !instance) {
    console.error('link needs --local or --instance <slug>.');
    process.exit(1);
  }
  const statements = [];
  let variants = 0;
  for (const summary of await listProducts(dst, '/store/products')) {
    const product = await getProduct(dst, '/store/products', summary.id);
    for (const v of product.sync_variants) {
      if (!v.sku) {
        console.log(`no SKU  ${v.name} — link it by hand`);
        continue;
      }
      variants++;
      // Two ids: the store variant places orders, the catalog variant prices shipping.
      statements.push(
        `UPDATE product_variants SET fulfillment_ref = ${sqlString(v.id)}, fulfillment_rate_ref = ${sqlString(v.variant_id)} WHERE sku = ${sqlString(v.sku)};`,
      );
    }
  }
  // Report which shop variants matched, so a SKU that drifted shows up here
  // rather than as an order line that silently never reaches Printful.
  const skus = statements.map((s) => s.match(/sku = '(.*)';$/)[1].replaceAll("''", "'"));
  const check = `SELECT p.slug, v.label, v.sku FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.sku IN (${skus.map(sqlString).join(', ')})`;
  const label = local ? 'local' : instance;
  mkdirSync('.import/printful', { recursive: true });
  const file = `.import/printful/link-${label}.sql`;
  writeFileSync(file, statements.join('\n') + '\n');
  console.log(`${variants} Printful variants with a SKU; SQL in ${file}`);
  if (!apply) return;

  const target = local ? ['--local'] : ['--remote'];
  const db = local ? 'DB' : readFileSync(`.instances/${instance}.env`, 'utf8').match(/^DB_NAME=(.+)$/m)?.[1];
  const config = local ? [] : ['--config', `.instances/${instance}.wrangler.jsonc`];
  if (!db) throw new Error(`No DB_NAME in .instances/${instance}.env`);
  const wrangler = (args) =>
    execFileSync('npx', ['wrangler', 'd1', 'execute', db, ...target, ...config, ...args], { encoding: 'utf8' });
  wrangler(['--file', file]);
  const matched = JSON.parse(wrangler(['--json', '--command', check]))[0].results;
  const found = new Set(matched.map((r) => r.sku));
  console.log(`${matched.length} shop variants linked.`);
  for (const sku of skus.filter((s) => !found.has(s))) console.log(`no shop variant with SKU ${sku}`);
}

const commands = { list, copy, link };
if (!commands[command]) {
  console.error('usage: printful-copy.mjs list | copy [--only <id>] [--apply] | link --local|--instance <slug> [--apply]');
  process.exit(1);
}
await commands[command]();
