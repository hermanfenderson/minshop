// Import a WooCommerce catalog (categories, products, variations, photos) into
// a Minshop instance. Two steps, so the shop is only written from a local copy
// that can be inspected first:
//
//   node --env-file=.env.woocommerce scripts/import-woocommerce.mjs fetch
//   node scripts/import-woocommerce.mjs apply --local [--replace]
//   node scripts/import-woocommerce.mjs apply --instance <slug> [--replace]
//
// fetch  reads the WooCommerce REST API (a READ-only key is enough: it only
//        sends GETs) and downloads the photos to .import/woocommerce/.
//        Needs WOOCOMMERCE_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET.
// apply  uploads the photos to the instance's images bucket and runs one SQL
//        file against its D1. --local targets `npm run dev`/`preview` state;
//        --instance reads .instances/<slug>.env (scripts/provision-cf.sh) and
//        writes to the deployed instance. --replace first removes the existing
//        catalog (products, categories and their rows; orders keep their own
//        snapshot; media files stay in the library). Without it the import
//        refuses to run over products whose slug already exists.
//
// Re-running is safe: a photo whose file name and size are already in the
// media library is reused, not uploaded again.
//
// The mapping itself is src/features/import/woocommerce.ts (unit-tested).

import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { buildImportSql, mapCategories, mapProduct } from '../src/features/import/woocommerce.ts';
import { generatePublicId } from '../src/features/ids/publicId.ts';
import { readImageDimensions } from '../src/features/media/dimensions.ts';
import { storeOverrides } from '../src/store.config.ts';

const DIR = '.import/woocommerce';
const IMAGES = join(DIR, 'images');
const CATALOG = join(DIR, 'catalog.json');
// Same limits as an admin upload (src/features/media/upload.ts).
const MAX_BYTES = 5 * 1024 * 1024;
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

const [command, ...args] = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};

function usage() {
  console.error('usage: import-woocommerce.mjs fetch | apply (--local | --instance <slug>) [--replace]');
  process.exit(2);
}

// ── fetch ────────────────────────────────────────────────────────────────────

async function wooGet(path) {
  const base = process.env.WOOCOMMERCE_URL?.replace(/\/+$/, '');
  const key = process.env.WOOCOMMERCE_CONSUMER_KEY;
  const secret = process.env.WOOCOMMERCE_CONSUMER_SECRET;
  if (!base || !key || !secret) {
    console.error('Set WOOCOMMERCE_URL, WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET (e.g. --env-file=.env.woocommerce).');
    process.exit(2);
  }
  const res = await fetch(`${base}/wp-json/wc/v3/${path}`, {
    headers: { authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}` },
  });
  if (!res.ok) throw new Error(`GET ${path}: HTTP ${res.status}`);
  return res.json();
}

async function wooAll(path) {
  const all = [];
  for (let page = 1; ; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const batch = await wooGet(`${path}${sep}per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) return all;
  }
}

function imageFile(image) {
  const ext = extname(new URL(image.src).pathname).toLowerCase() || '.bin';
  return join(IMAGES, `${image.id}${ext}`);
}

async function fetchCatalog() {
  mkdirSync(IMAGES, { recursive: true });
  const [categories, products, weightUnit] = await Promise.all([
    wooAll('products/categories'),
    wooAll('products?status=publish'),
    wooGet('settings/products/woocommerce_weight_unit').then((s) => s.value),
  ]);
  for (const p of products) {
    if (p.type === 'variable') p.variations = await wooAll(`products/${p.id}/variations`);
  }
  writeFileSync(CATALOG, JSON.stringify({ fetchedAt: new Date().toISOString(), weightUnit, categories, products }, null, 2));

  const images = new Map();
  for (const p of products) {
    for (const img of p.images) images.set(img.id, img);
    for (const v of p.variations ?? []) if (v.image) images.set(v.image.id, v.image);
  }
  let downloaded = 0;
  const queue = [...images.values()].filter((img) => !existsSync(imageFile(img)));
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let img = queue.shift(); img; img = queue.shift()) {
        const res = await fetch(img.src);
        if (!res.ok) throw new Error(`GET ${img.src}: HTTP ${res.status}`);
        writeFileSync(imageFile(img), Buffer.from(await res.arrayBuffer()));
        downloaded++;
      }
    }),
  );
  const variations = products.reduce((n, p) => n + (p.variations?.length ?? 0), 0);
  console.log(`${products.length} products, ${variations} variations, ${categories.length} categories, ${images.size} photos (${downloaded} downloaded) → ${DIR}`);
}

// ── apply ────────────────────────────────────────────────────────────────────

function target() {
  if (flag('--local') === Boolean(option('--instance'))) usage();
  if (flag('--local')) {
    return { label: 'local', d1: ['DB', '--local'], bucket: 'minshop-images', r2: ['--local'] };
  }
  const slug = option('--instance');
  const envFile = `.instances/${slug}.env`;
  if (!existsSync(envFile)) {
    console.error(`${envFile} not found (written by scripts/provision-cf.sh).`);
    process.exit(2);
  }
  const meta = Object.fromEntries(
    readFileSync(envFile, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
  return { label: slug, d1: [meta.DB_NAME, '--remote'], bucket: meta.BUCKET, r2: ['--remote'] };
}

function wrangler(argv) {
  return execFileSync('npx', ['wrangler', ...argv], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, CI: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

const execFileAsync = promisify(execFile);
function wranglerAsync(argv) {
  return execFileAsync('npx', ['wrangler', ...argv], { env: { ...process.env, CI: '1' }, maxBuffer: 16 * 1024 * 1024 });
}

function d1Rows(t, sql) {
  return JSON.parse(wrangler(['d1', 'execute', ...t.d1, '--json', '--command', sql]))[0]?.results ?? [];
}

function mediaKey(ext) {
  // Same shape as mediaKeyFor() in src/features/media/upload.ts (20 hex chars).
  return `media/${randomBytes(10).toString('hex')}.${ext === '.jpeg' ? 'jpg' : ext.slice(1)}`;
}

async function apply() {
  const t = target();
  if (!existsSync(CATALOG)) {
    console.error(`${CATALOG} not found: run the fetch step first.`);
    process.exit(2);
  }
  const replace = flag('--replace');
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
  const currency = (storeOverrides.currency ?? 'usd').toLowerCase();
  const categories = mapCategories(catalog.categories);
  const products = catalog.products.map((p) => mapProduct(p, { currency, weightUnit: catalog.weightUnit }));

  const existing = d1Rows(t, 'SELECT slug FROM products').map((r) => r.slug);
  if (!replace) {
    const clash = products.filter((p) => existing.includes(p.slug)).map((p) => p.slug);
    if (clash.length) {
      console.error(`Products already in ${t.label}: ${clash.join(', ')}. Use --replace to replace the whole catalog.`);
      process.exit(1);
    }
  }

  // Photos: reuse a library row with the same file name and size, else upload.
  const library = d1Rows(t, 'SELECT image_key, public_id, original_name, size_bytes, mime_type, width, height FROM media');
  const media = new Map();
  const skipped = [];
  let uploaded = 0;
  const wanted = new Map();
  for (const p of products) for (const img of p.images) wanted.set(img.wooImageId, img);
  const uploads = [];
  for (const img of wanted.values()) {
    const file = imageFile({ id: img.wooImageId, src: img.src });
    const ext = extname(file);
    const mime = MIME[ext];
    if (!existsSync(file)) {
      skipped.push(`${img.src} (not downloaded)`);
      continue;
    }
    const size = statSync(file).size;
    if (!mime || size > MAX_BYTES) {
      skipped.push(`${img.src} (${mime ? `${(size / 1048576).toFixed(1)} MB` : 'unsupported type'})`);
      continue;
    }
    const originalName = basename(new URL(img.src).pathname);
    const reuse = library.find((m) => m.original_name === originalName && m.size_bytes === size);
    if (reuse) {
      media.set(img.wooImageId, {
        key: reuse.image_key, publicId: reuse.public_id, originalName, mime: reuse.mime_type, sizeBytes: size,
        width: reuse.width, height: reuse.height, existing: true,
      });
      continue;
    }
    const dims = readImageDimensions(new Uint8Array(readFileSync(file)));
    media.set(img.wooImageId, {
      key: mediaKey(ext), publicId: generatePublicId('media'), originalName, mime, sizeBytes: size,
      width: dims?.width ?? null, height: dims?.height ?? null, existing: false,
    });
    uploads.push({ file, entry: media.get(img.wooImageId) });
  }
  // Objects before rows, as in uploadMedia(): a failure leaves orphan objects
  // at worst (the SQL never runs), never a row pointing at nothing.
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let u = uploads.shift(); u; u = uploads.shift()) {
        await wranglerAsync(['r2', 'object', 'put', `${t.bucket}/${u.entry.key}`, '--file', u.file, '--content-type', u.entry.mime, ...t.r2]);
        uploaded++;
        process.stdout.write(`\rphotos uploaded: ${uploaded}`);
      }
    }),
  );
  if (uploaded) process.stdout.write('\n');

  const statements = buildImportSql(categories, products, { currency, replace, media, newId: generatePublicId });
  const sqlFile = join(DIR, `import-${t.label}.sql`);
  writeFileSync(sqlFile, statements.map((s) => `${s};`).join('\n') + '\n');
  wrangler(['d1', 'execute', ...t.d1, '--file', sqlFile]);

  console.log(`${t.label}: ${categories.length} categories, ${products.length} products, ` +
    `${products.reduce((n, p) => n + p.variants.length, 0)} variants, ${media.size} photos ` +
    `(${uploaded} uploaded, ${media.size - uploaded} reused)${replace ? `, replacing ${existing.length} products` : ''}`);
  for (const s of skipped) console.log(`  skipped photo: ${s}`);
  // One line per remark, listing the products it applies to.
  const remarks = new Map();
  for (const p of products) for (const n of p.notes) remarks.set(n, [...(remarks.get(n) ?? []), p.slug]);
  for (const [note, slugs] of remarks) console.log(`  ${note}: ${slugs.length === products.length ? 'all products' : slugs.join(', ')}`);
}

if (command === 'fetch') await fetchCatalog();
else if (command === 'apply') await apply();
else usage();
