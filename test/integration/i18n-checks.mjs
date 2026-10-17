/**
 * Two-language checks against a running Worker (see i18n.sh): English at the
 * mount, Italian at /it + mount. Interface text is not translated yet; this
 * proves the routing: every page renders in both languages, navigation never
 * loses the language, POST bodies survive the rewrite, and APIs, webhooks and
 * admin paths are never rewritten.
 *
 * Usage: node test/integration/i18n-checks.mjs <origin> <mount: '' | '/shop'> <cookie prefix>
 */
const [origin, mount = '', cookiePrefix = ''] = process.argv.slice(2);
const EN = mount; // '' or '/shop'
const IT = `/it${mount}`;
let failures = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures++;
    console.log(`  ✗ ${name}\n      ${error instanceof Error ? error.message : String(error)}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, what) {
  if (actual !== expected) throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

const form = (fields) => ({
  method: 'POST',
  headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams(fields).toString(),
});

async function get(path, init = {}) {
  return fetch(origin + path, { redirect: 'manual', ...init });
}

async function html(path, init) {
  const res = await get(path, init);
  equal(res.status, 200, `GET ${path}`);
  return res.text();
}

const debug = (...args) => process.env.I18N_DEBUG && console.log('      ·', ...args);
const location = (res) => (res.headers.get('location') ?? '').replace(origin, '');
const htmlLang = (body) => body.match(/<html lang="([^"]+)"/)?.[1];
const cookiesOf = (res) => res.headers.getSetCookie?.() ?? [];
const cookieHeader = (res) => cookiesOf(res).map((c) => c.split(';')[0]).join('; ');

console.log(`i18n routing (mount "${mount || '/'}")`);

// ── Pages in both languages ──────────────────────────────────────────────────
const PAGES = ['/', '/products', '/products/sample-tee', '/categories/apparel', '/pages/about', '/search?q=sample', '/cart'];
for (const page of PAGES) {
  await check(`${page} renders in English and Italian`, async () => {
    equal(htmlLang(await html(EN + page)), 'en', `lang of ${EN + page}`);
    equal(htmlLang(await html(IT + page)), 'it', `lang of ${IT + page}`);
  });
}

await check('the switcher links each page to itself in the other language', async () => {
  const en = await html(`${EN}/products/sample-tee?x=1`);
  assert(en.includes(`href="${IT}/products/sample-tee?x=1" lang="it" hreflang="it"`), 'Italian link on the English page');
  assert(/<span lang="en" aria-current="true"/.test(en), 'English marked current');
  const it = await html(`${IT}/products/sample-tee`);
  assert(it.includes(`href="${EN}/products/sample-tee" lang="en" hreflang="en"`), 'English link on the Italian page');
});

await check('canonical and links follow the page language', async () => {
  const it = await html(`${IT}/products/sample-tee`);
  assert(it.includes(`<link rel="canonical" href="https://canonical.example${IT}/products/sample-tee"`), 'Italian canonical');
  assert(it.includes(`action="${EN}/api/cart?lang=it"`), 'add-to-cart form names the language');
  assert(it.includes(`data-cart-partial="${IT}/partials/cart"`), 'drawer fragment in Italian');
});

// ── Navigation never loses the language ──────────────────────────────────────
await check('an Italian crawl stays Italian on every page link', async () => {
  const pageLink = /^\/(products|categories|pages|cart|checkout|search|account|order|pay|partials|express)?(\/|$|\?)/;
  const seen = new Set();
  const queue = [`${IT}/`];
  const lost = [];
  while (queue.length && seen.size < 120) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    const res = await get(path);
    if (res.status !== 200 || !(res.headers.get('content-type') ?? '').includes('text/html')) continue;
    const body = await res.text();
    for (const [, attr, raw] of body.matchAll(/\b(href|action)="([^"]+)"/g)) {
      if (raw.startsWith('#') || /^[a-z]+:/i.test(raw) || raw.startsWith('//')) continue;
      if (/hreflang="en"/.test(body) && body.includes(`href="${raw}" lang="en"`)) continue; // the switcher
      const url = new URL(raw, origin + path);
      const p = url.pathname;
      if (p.startsWith(`${EN}/_astro/`) || p.startsWith(`${EN}/images/`) || /\.(svg|ico|png)$/.test(p)) continue;
      if (p.startsWith(`${EN}/api/admin`) || p.startsWith(`${EN}/admin`)) continue;
      if (p.startsWith(`${EN}/api/`)) {
        if (url.searchParams.get('lang') !== 'it') lost.push(`${path}: ${attr}=${raw}`);
        continue;
      }
      if (!p.startsWith(IT)) {
        if (pageLink.test(p.slice(EN.length) || '/')) lost.push(`${path}: ${attr}=${raw}`);
        continue;
      }
      if (attr === 'href' && !seen.has(p + url.search)) queue.push(p + url.search);
    }
  }
  debug(`crawled ${seen.size} Italian pages`);
  assert(seen.size > 10, `crawled only ${seen.size} pages`);
  assert(lost.length === 0, `links that drop the language:\n        ${[...new Set(lost)].slice(0, 10).join('\n        ')}`);
});

// ── Canonical redirects ──────────────────────────────────────────────────────
await check('an explicit default prefix redirects to the canonical URL (301)', async () => {
  const res = await get(`/en${mount}/cart?x=1`);
  equal(res.status, 301, 'status');
  equal(location(res), `${EN}/cart?x=1`, 'location');
});

await check('a language prefix on admin, API and webhook paths is dropped', async () => {
  let res = await get(`${IT}/admin`);
  equal(res.status, 301, 'admin status');
  equal(location(res), `${EN}/admin`, 'admin location');
  res = await get(`${IT}/api/products?limit=1`);
  equal(res.status, 301, 'api status');
  equal(location(res), `${EN}/api/products?limit=1&lang=it`, 'api keeps its language as ?lang=');
  res = await get(`${IT}/api/webhook/stripe`, form({ any: 'thing' }));
  equal(res.status, 308, 'webhook keeps method and body: 308');
  equal(location(res), `${EN}/api/webhook/stripe`, 'webhook never takes a language');
});

await check('a POST to a prefixed API is redirected with 308, not rewritten', async () => {
  const res = await get(`${IT}/api/cart`, form({ _action: 'update', key: 'x', qty: '1' }));
  equal(res.status, 308, 'status');
  equal(location(res), `${EN}/api/cart?lang=it`, 'location');
});

await check('an unsupported prefix is not the store (404)', async () => {
  equal((await get(`/de${mount}/cart`)).status, 404, 'status');
});

// ── Forms, cart and checkout across languages ────────────────────────────────
const productPage = await html(`${IT}/products/sample-tee`);
const productId = productPage.match(/name="product_id" value="([^"]+)"/)?.[1];
const variantId = productPage.match(/name="variant_id"[^>]*value="([^"]+)"/)?.[1];

await check('a POST body survives the rewrite (form and multipart)', async () => {
  // Body present → buy-now for a product with variants → back to it with an error.
  // Body lost → no product → the (empty) cart. The two are distinguishable.
  let res = await get(`${IT}/express?keep=1`, form({ product_id: productId }));
  equal(res.status, 303, 'status');
  assert(location(res).startsWith(`${IT}/products/sample-tee?error=`), `urlencoded body reached the page: ${location(res)}`);
  const multipart = new FormData();
  multipart.set('product_id', productId);
  res = await get(`${IT}/express`, { method: 'POST', headers: { origin }, body: multipart });
  assert(location(res).startsWith(`${IT}/products/sample-tee?error=`), `multipart body reached the page: ${location(res)}`);
  res = await get(`${IT}/express`, form({}));
  equal(location(res), `${IT}/cart`, 'control without a body');
});

await check('a POST with no body and no Content-Type is not a server error', async () => {
  // Read as an empty form: the endpoints answer with their normal redirect.
  for (const path of [`${EN}/api/cart`, `${EN}/api/checkout?lang=it`, `${IT}/express`, `${IT}/checkout`, `${EN}/express`]) {
    const res = await get(path, { method: 'POST', headers: { origin } });
    assert(res.status === 303, `${path}: ${res.status}`);
    assert(location(res).startsWith(path.startsWith(IT) || path.includes('lang=it') ? `${IT}/` : `${EN}/`), `${path} → ${location(res)}`);
  }
});

let cart = '';
await check('add to cart from an Italian page returns to the Italian cart', async () => {
  const res = await get(`${EN}/api/cart?lang=it`, form({ _action: 'add', product_id: productId, variant_id: variantId, qty: '1' }));
  equal(res.status, 303, 'status');
  equal(location(res), `${IT}/cart`, 'location');
  const names = cookiesOf(res).map((c) => c.split('=')[0]);
  assert(names.includes(`${cookiePrefix}cart`) && names.includes(`${cookiePrefix}cart_n`), `cookies ${names}`);
  assert(cookiesOf(res).every((c) => /Path=\//i.test(c)), 'cookies on Path=/ (shared by both languages)');
  cart = cookieHeader(res);
});

await check('the same cart shows in both languages, and switching keeps it', async () => {
  const it = await html(`${IT}/cart`, { headers: { cookie: cart } });
  const en = await html(`${EN}/cart`, { headers: { cookie: cart } });
  const lines = (body) => (body.match(/name="key" value="[^"]+"/g) ?? []).sort().join();
  assert(lines(it).length > 0, 'the Italian cart has the item');
  equal(lines(en), lines(it), 'same lines in English');
  assert(it.includes(`href="${EN}/cart" lang="en"`), 'switcher points to the English cart');
});

await check('the cart fragment answers in the page language', async () => {
  const body = await html(`${IT}/partials/cart`, { headers: { cookie: cart, 'x-partial': '1' } });
  assert(body.includes(`href="${IT}/products/`) || body.includes(`href="${IT}/cart"`), 'Italian links in the fragment');
});

await check('a missing variant sends the Italian shopper back to the Italian product', async () => {
  const res = await get(`${EN}/api/cart?lang=it`, form({ _action: 'add', product_id: productId, qty: '1' }));
  assert(location(res).startsWith(`${IT}/products/sample-tee?error=`), location(res));
});

await check('checkout from the Italian cart stays Italian through payment and the order page', async () => {
  const withCart = (init) => ({ ...init, headers: { ...init.headers, cookie: cart } });
  // Cart → method choice (public API, ?lang=it) → in-app checkout in Italian.
  let res = await get(`${EN}/api/checkout?lang=it`, withCart(form({ method: 'demo' })));
  equal(res.status, 303, 'checkout status');
  let next = location(res);
  assert(next.startsWith(`${IT}/checkout`), `in-app checkout in Italian: ${next}`);
  // The in-app checkout mints the demo payment and sends the shopper to the
  // store's own pay page — built by the caller in the shopper's language.
  res = await get(next, withCart({}));
  if (res.status === 200) {
    // Address step: post it back through the rewrite.
    const body = await res.text();
    const fields = Object.fromEntries([...body.matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/g)].map((m) => [m[1], m[2]]));
    res = await get(next, withCart(form({ ...fields, email: 'buyer@example.com', name: 'A', line1: 'Via Roma 1', city: 'Roma', postal_code: '00100', country: 'IT' })));
  }
  equal(res.status, 303, 'pay redirect status');
  const pay = location(res).replace('https://canonical.example', '');
  debug(`pay page ${pay}`);
  assert(pay.startsWith(`${IT}/pay/`), `pay page in Italian: ${pay}`);
  equal(htmlLang(await html(pay)), 'it', 'pay page language');
  // Pay (demo card) with a POST through the rewrite → the Italian order page.
  res = await get(pay, form({ email: 'buyer@example.com', outcome: 'approve' }));
  equal(res.status, 303, 'payment status');
  const order = location(res);
  debug(`order page ${order}`);
  assert(order.startsWith(`${IT}/order/`), `order page in Italian: ${order}`);
  equal(htmlLang(await html(order)), 'it', 'order page language');
});

await check('customer sign-in posts through the rewrite and stays Italian', async () => {
  const res = await get(`${IT}/account/login`, form({ email: 'buyer@example.com' }));
  equal(res.status, 303, 'status');
  assert(location(res).startsWith(`${IT}/`), location(res));
});

// ── APIs, webhooks, admin: no language in the path, no rewrite ───────────────
await check('public APIs answer without a rewrite, in the language they name', async () => {
  const res = await get(`${EN}/api/products?limit=1&lang=it`);
  equal(res.status, 200, 'status');
  const body = await res.json();
  assert(Array.isArray(body.products), 'catalog JSON');
});

await check('webhooks are reached directly, never redirected', async () => {
  const res = await get(`${EN}/api/webhook/stripe`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  equal(res.status, 404, 'unconfigured provider answers from the handler');
  equal(await res.text(), 'Unknown or unconfigured payment method', 'handler body');
});

await check('admin stays unprefixed', async () => {
  const res = await get(`${EN}/admin`);
  assert([302, 303].includes(res.status), `admin status ${res.status}`);
  assert(location(res).startsWith(`${EN}/admin/`), location(res));
});

// ── Cache: one response per URL, never per visitor ───────────────────────────
await check('each language is a separate, cacheable URL with no Vary', async () => {
  const en = await get(`${EN}/products/sample-tee`);
  const it = await get(`${IT}/products/sample-tee`);
  for (const res of [en, it]) {
    assert((res.headers.get('cache-control') ?? '').includes('s-maxage'), `cacheable: ${res.headers.get('cache-control')}`);
    equal(res.headers.get('vary'), null, 'no Vary: the URL alone decides the language');
  }
  equal(it.headers.get('cache-tag'), en.headers.get('cache-tag'), 'one purge covers both languages');
});

if (failures > 0) {
  console.log(`\ni18n routing: ${failures} check(s) failed`);
  process.exit(1);
}
console.log('\ni18n routing: all checks passed');
