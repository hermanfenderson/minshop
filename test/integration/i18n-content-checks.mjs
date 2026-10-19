/**
 * Translated CONTENT, end to end, against the running Worker of i18n.sh: an
 * admin creates content in English, translates it into Italian from the
 * dashboard, and the storefront, the cart, a demo purchase and the order show
 * each language where it belongs. i18n.sh then checks the stored rows in D1.
 *
 * Usage: node test/integration/i18n-content-checks.mjs <origin> <mount> <cookie prefix> <admin password>
 */
const [origin, mount = '', cookiePrefix = '', adminPassword] = process.argv.slice(2);
const EN = mount;
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
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const equal = (actual, expected, what) => {
  if (actual !== expected) throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
const get = (path, init = {}) => fetch(origin + path, { redirect: 'manual', ...init });
const form = (fields, cookie = '') => ({
  method: 'POST',
  headers: { origin, 'content-type': 'application/x-www-form-urlencoded', ...(cookie && { cookie }) },
  body: new URLSearchParams(fields).toString(),
});
async function html(path, cookie = '') {
  const res = await get(path, cookie ? { headers: { cookie } } : {});
  equal(res.status, 200, `GET ${path}`);
  return res.text();
}
const location = (res) => (res.headers.get('location') ?? '').replace(origin, '').replace('https://canonical.example', '');
const htmlLang = (body) => body.match(/<html lang="([^"]+)"/)?.[1];
const cookieHeader = (res) => (res.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
const h1 = (body) => body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, '').trim();
const tr = (entity, publicId, field) => `tr|${entity}|${publicId}|${field}`;

console.log(`\ntranslated content (mount "${mount || '/'}")`);

// A fresh store: the setup wizard sets the test password and signs the admin in.
let admin = '';
await check('the admin signs in on the fresh store', async () => {
  const res = await get(`${EN}/admin/setup`, form({ store_name: 'Content Test', time_zone: 'UTC', admin_password: adminPassword }));
  equal(res.status, 303, 'setup status');
  admin = cookieHeader(res);
  assert(admin.includes(`${cookiePrefix}admin_session=`), 'no admin session');
});

const translate = async (fields) => {
  const res = await get(`${EN}/api/admin/translations`, form({ locale: 'it', ...fields }, admin));
  equal(res.status, 303, 'translation save status');
  assert(location(res).includes('translated=it') && !location(res).includes('translation_error'), `save: ${location(res)}`);
};

// ── 1–7: a product, created in English and translated into Italian ──────────
let productId = '';
await check('a product created in English from the admin', async () => {
  const res = await get(
    `${EN}/api/admin/products`,
    form(
      {
        name: 'Festival strap',
        description: 'Soft cotton strap.',
        price: '24',
        stock: '5',
        weight: '100',
        active: 'on',
        requires_shipping: 'on',
        slug: 'festival-strap',
      },
      admin,
    ),
  );
  equal(res.status, 303, 'create status');
  assert(!location(res).includes('error'), location(res));
  const json = await (await get(`${EN}/api/products/festival-strap`)).json();
  productId = json.id;
  assert(/^prod_/.test(productId), `public id ${productId}`);
});

await check('its Italian translation is saved from the product editor', async () => {
  const editor = await html(`${EN}/admin/products/${productId}/edit`, admin);
  assert(editor.includes('id="translations"') && editor.includes('data-translation-locale="it"'), 'no translation section');
  assert(editor.includes('data-translation-status="missing"'), 'missing fields are not shown as missing');
  await translate({
    scope: 'product',
    id: productId,
    return: `/admin/products/${productId}/edit`,
    [tr('product', productId, 'name')]: 'Tracolla del festival',
    [tr('product', productId, 'description')]: 'Tracolla in cotone morbido.',
    [tr('product', productId, 'variant_label')]: '',
  });
  const after = await html(`${EN}/admin/products/${productId}/edit`, admin);
  assert(after.includes('value="Tracolla del festival"'), 'the editor does not show the saved translation');
  // The admin edits the source: its own form keeps the English name.
  assert(after.includes('value="Festival strap"'), 'the source form lost the English name');
});

const productPrice = (body) => body.match(/"price":"([^"]+)"/)?.[1];
await check('/products/<slug> is English and /it/…/products/<slug> Italian, same price', async () => {
  const en = await html(`${EN}/products/festival-strap`);
  const it = await html(`${IT}/products/festival-strap`);
  equal(h1(en), 'Festival strap', 'English name');
  equal(h1(it), 'Tracolla del festival', 'Italian name');
  equal(htmlLang(it), 'it', 'Italian page language');
  assert(it.includes('Tracolla in cotone morbido.') && en.includes('Soft cotton strap.'), 'descriptions');
  equal(productPrice(it), productPrice(en), 'price shared by both languages');
});

await check('editing the Italian translation leaves English untouched', async () => {
  // Name changed, description cleared: the description falls back to English.
  await translate({
    scope: 'product',
    id: productId,
    return: `/admin/products/${productId}/edit`,
    [tr('product', productId, 'name')]: 'Tracolla Monopolele',
    [tr('product', productId, 'description')]: '',
    [tr('product', productId, 'variant_label')]: '',
  });
  const en = await html(`${EN}/products/festival-strap`);
  const it = await html(`${IT}/products/festival-strap`);
  equal(h1(it), 'Tracolla Monopolele', 'updated Italian name');
  equal(h1(en), 'Festival strap', 'English name');
  assert(it.includes('Soft cotton strap.'), 'an untranslated field does not fall back to the original');
  const json = await (await get(`${EN}/api/products/festival-strap`)).json();
  equal(json.name, 'Festival strap', 'source row name');
  const itJson = await (await get(`${EN}/api/products/festival-strap?lang=it`)).json();
  equal(JSON.stringify(itJson.price), JSON.stringify(json.price), 'price via the API');
  equal(itJson.in_stock, json.in_stock, 'stock via the API');
});

await check('the public API answers in the language ?lang= names', async () => {
  const res = await get(`${EN}/api/products/festival-strap?lang=it`);
  const json = await res.json();
  equal(json.name, 'Tracolla Monopolele', 'Italian name');
  assert(json.url.endsWith(`${IT}/products/festival-strap`), `Italian url ${json.url}`);
  equal(res.headers.get('content-language'), 'it', 'content-language');
});

await check('Italian search finds the translated name; English search does not', async () => {
  const it = await html(`${IT}/search?q=tracolla`);
  const en = await html(`${EN}/search?q=tracolla`);
  assert(it.includes(`${IT}/products/festival-strap`), 'no Italian hit');
  assert(!en.includes('/products/festival-strap"'), 'English search matched an Italian-only word');
});

await check('both language versions carry the product cache tag', async () => {
  for (const path of [`${EN}/products/festival-strap`, `${IT}/products/festival-strap`]) {
    const tags = (await get(path)).headers.get('cache-tag') ?? '';
    assert(tags.includes(`product:${productId}`), `${path} tags ${tags}`);
  }
});

// ── 8–10: buy it in Italian; the order keeps the Italian name ───────────────
let orderPath = '';
await check('the Italian cart shows the Italian name, the English cart the English one', async () => {
  const add = await get(`${EN}/api/cart?lang=it`, form({ _action: 'add', product_id: productId, qty: '1' }));
  equal(add.status, 303, 'add status');
  const cart = cookieHeader(add);
  assert((await html(`${IT}/cart`, cart)).includes('Tracolla Monopolele'), 'Italian cart');
  assert((await html(`${EN}/cart`, cart)).includes('Festival strap'), 'English cart (same cookie)');

  const withCart = (init) => ({ ...init, headers: { ...init.headers, cookie: cart } });
  let res = await get(`${EN}/api/checkout?lang=it`, withCart(form({ method: 'demo' })));
  equal(res.status, 303, 'checkout status');
  const next = location(res);
  res = await get(next, withCart({}));
  if (res.status === 200) {
    const body = await res.text();
    assert(body.includes('Tracolla Monopolele'), 'checkout summary in Italian');
    const fields = Object.fromEntries([...body.matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/g)].map((m) => [m[1], m[2]]));
    res = await get(next, withCart(form({ ...fields, email: 'content-it@example.com', name: 'A', line1: '1 Main St', city: 'Springfield', state: 'IL', postal_code: '62701', country: 'US' })));
  }
  equal(res.status, 303, 'pay redirect');
  const pay = location(res);
  res = await get(pay, form({ email: 'content-it@example.com', outcome: 'approve' }));
  equal(res.status, 303, 'payment status');
  orderPath = location(res);
  assert(orderPath.startsWith(`${IT}/order/`), orderPath);
  assert((await html(orderPath)).includes('Tracolla Monopolele'), 'order page shows the Italian name');
});

await check('a later translation edit does not rewrite the order', async () => {
  await translate({
    scope: 'product',
    id: productId,
    return: `/admin/products/${productId}/edit`,
    [tr('product', productId, 'name')]: 'Tracolla rinominata',
    [tr('product', productId, 'description')]: '',
    [tr('product', productId, 'variant_label')]: '',
  });
  const body = await html(orderPath);
  assert(body.includes('Tracolla Monopolele') && !body.includes('Tracolla rinominata'), 'the order snapshot changed');
});

// ── Categories ───────────────────────────────────────────────────────────────
let categoryId = '';
await check('a category is translated from its editor', async () => {
  const res = await get(`${EN}/api/admin/categories`, form({ name: 'Straps', slug: 'straps' }, admin));
  equal(res.status, 303, 'create status');
  const list = await html(`${EN}/admin/categories`, admin);
  categoryId = list.match(/\/admin\/categories\/(cat_[0-9a-z]+)\/edit"[^>]*>[\s\S]{0,200}?Straps/)?.[1] ?? list.match(/(cat_[0-9a-z]+)\/edit[^<]*<[^>]*>\s*Straps/)?.[1] ?? '';
  if (!categoryId) {
    // Fall back to the newest category link on the list.
    categoryId = [...list.matchAll(/\/admin\/categories\/(cat_[0-9a-z]+)\/edit/g)].map((m) => m[1]).pop() ?? '';
  }
  assert(/^cat_/.test(categoryId), 'category id');
  await translate({ scope: 'category', id: categoryId, return: `/admin/categories/${categoryId}/edit`, [tr('category', categoryId, 'name')]: 'Tracolle' });
  equal(h1(await html(`${EN}/categories/straps`)), 'Straps', 'English category');
  equal(h1(await html(`${IT}/categories/straps`)), 'Tracolle', 'Italian category');
});

// ── Pages ────────────────────────────────────────────────────────────────────
let pageId = '';
await check('a content page is translated, rendered with the same safe Markdown', async () => {
  let res = await get(`${EN}/api/admin/pages`, form({ title: 'Festival info', slug: 'festival-info' }, admin));
  equal(res.status, 303, 'create status');
  pageId = location(res).match(/(page_[0-9a-z]+)/)?.[1] ?? '';
  assert(pageId, `page id from ${location(res)}`);
  res = await get(
    `${EN}/api/admin/pages/${pageId}`,
    form({ title: 'Festival info', slug: 'festival-info', body_markdown: 'Hello **festival**.', published: 'on', layout: 'standard' }, admin),
  );
  equal(res.status, 303, 'publish status');
  await translate({
    scope: 'page',
    id: pageId,
    return: `/admin/pages/${pageId}/edit`,
    [tr('page', pageId, 'title')]: 'Info festival',
    [tr('page', pageId, 'body_markdown')]: 'Ciao **festival**. <script>alert(1)</script>',
  });
  const en = await html(`${EN}/pages/festival-info`);
  const it = await html(`${IT}/pages/festival-info`);
  assert(en.includes('Hello <strong>festival</strong>'), 'English body');
  assert(it.includes('Ciao <strong>festival</strong>'), 'Italian body');
  assert(it.includes('Info festival'), 'Italian title');
  // html: false escapes it in the body (an attribute value, like the meta
  // description, is inert text either way).
  const markup = it.replace(/\s[\w-]+="[^"]*"/g, '');
  assert(!markup.includes('<script>alert(1)'), 'raw HTML in the translated body was parsed');
  assert(it.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'raw HTML was not shown escaped');
});

// ── Menus ────────────────────────────────────────────────────────────────────
await check('an unlabelled menu item follows its target, a translated label wins', async () => {
  const res = await get(
    `${EN}/api/admin/navigation`,
    form({ _action: 'add', location: 'header', target_type: 'page', target_id_page: pageId, target_id: pageId }, admin),
  );
  equal(res.status, 303, 'add status');
  const nav = await html(`${EN}/admin/navigation`, admin);
  const navIds = [...nav.matchAll(/name="id" value="(nav_[0-9a-z]+)"/g)].map((m) => m[1]);
  const navId = navIds.at(-1);
  assert(navId, 'menu item id');
  // Before any menu translation: the page's own translated title.
  const header = (body) => body.match(/<header[\s\S]*?<\/header>/)?.[0] ?? '';
  assert(header(await html(`${IT}/`)).includes('Info festival'), 'Italian header does not follow the translated page title');
  const navRows = Object.fromEntries([...new Set(navIds)].map((id) => [tr('menuItem', id, 'label'), id === navId ? 'Informazioni' : '']));
  await translate({ scope: 'menu', return: '/admin/navigation', ...navRows });
  assert(header(await html(`${IT}/`)).includes('Informazioni'), 'Italian header label');
  assert(header(await html(`${EN}/`)).includes('Festival info'), 'English header label');
});

// ── Announcement ─────────────────────────────────────────────────────────────
await check('the announcement shows in each language', async () => {
  const res = await get(`${EN}/admin/settings`, form({ _action: 'save_announcement', announcement: 'Free entry', announcement_href: '' }, admin));
  assert(res.status === 200 || res.status === 303, `settings status ${res.status}`);
  await translate({ scope: 'announcement', return: '/admin/settings', announcement: 'Ingresso libero', announcement_href: '' });
  assert((await html(`${IT}/`)).includes('Ingresso libero'), 'Italian announcement');
  const en = await html(`${EN}/`);
  assert(en.includes('Free entry') && !en.includes('Ingresso libero'), 'English announcement');
});

// ── Deletion: translations go with their entity ──────────────────────────────
await check('deleting a category removes its translations', async () => {
  const res = await get(`${EN}/api/admin/categories/${categoryId}`, form({ _action: 'delete' }, admin));
  equal(res.status, 303, 'delete status');
  equal((await get(`${IT}/categories/straps`)).status, 404, 'the Italian category page');
});

// ── Phase 6 fixes ────────────────────────────────────────────────────────────
await check('the option name is offered only for a product with options', async () => {
  const strap = await html(`${EN}/admin/products/${productId}/edit`, admin);
  assert(!strap.includes('Option name (e.g. Size)'), 'shown for a product without options');
  assert(strap.includes(`type="hidden" name="${tr('product', productId, 'variant_label')}"`), 'not carried, so a save would clear it');
  const tee = (await (await get(`${EN}/api/products/sample-tee`)).json()).id;
  assert((await html(`${EN}/admin/products/${tee}/edit`, admin)).includes('Option name (e.g. Size)'), 'hidden for a product with options');
});

await check('"choose a size" names the option in the shopper\'s language', async () => {
  const tee = (await (await get(`${EN}/api/products/sample-tee`)).json()).id;
  await translate({
    scope: 'product',
    id: tee,
    return: `/admin/products/${tee}/edit`,
    [tr('product', tee, 'name')]: '',
    [tr('product', tee, 'description')]: '',
    [tr('product', tee, 'variant_label')]: 'Taglia',
  });
  const res = await get(`${EN}/api/cart?lang=it`, form({ _action: 'add', product_id: tee, qty: '1' }));
  assert(decodeURIComponent(location(res)).includes('Taglia'), `message: ${decodeURIComponent(location(res))}`);
  const enRes = await get(`${EN}/api/cart`, form({ _action: 'add', product_id: tee, qty: '1' }));
  assert(!decodeURIComponent(location(enRes)).includes('Taglia'), 'English message used the Italian option name');
});

// ── SEO: canonical, hreflang, JSON-LD, sitemap, llms.txt ─────────────────────
const C = 'https://canonical.example';
const links = (body) => ({
  canonical: body.match(/<link rel="canonical" href="([^"]+)"/)?.[1],
  hreflang: [...body.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => `${m[1]} ${m[2]}`),
  ogLocale: body.match(/<meta property="og:locale" content="([^"]+)"/)?.[1],
  ogAlternates: [...body.matchAll(/<meta property="og:locale:alternate" content="([^"]+)"/g)].map((m) => m[1]),
  noindex: body.includes('<meta name="robots" content="noindex">'),
});
const graphOf = (body) => {
  const raw = body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert(raw, 'no JSON-LD');
  return JSON.parse(raw)['@graph'];
};
const saveProduct = (name, description) =>
  translate({
    scope: 'product',
    id: productId,
    return: `/admin/products/${productId}/edit`,
    [tr('product', productId, 'name')]: name,
    [tr('product', productId, 'description')]: description,
    [tr('product', productId, 'variant_label')]: '',
  });
const strapEn = `${C}${EN}/products/festival-strap`;
const strapIt = `${C}${IT}/products/festival-strap`;
const expectedAlternates = [`en ${strapEn}`, `it ${strapIt}`, `x-default ${strapEn}`];

await check('a fully translated product: self-canonical, reciprocal hreflang, Italian og:locale', async () => {
  await saveProduct('Tracolla del festival', 'Tracolla in cotone morbido.');
  const en = links(await html(`${EN}/products/festival-strap`));
  const it = links(await html(`${IT}/products/festival-strap`));
  equal(en.canonical, strapEn, 'English canonical');
  equal(it.canonical, strapIt, 'Italian canonical');
  equal(JSON.stringify(en.hreflang), JSON.stringify(expectedAlternates), 'English hreflang');
  equal(JSON.stringify(it.hreflang), JSON.stringify(expectedAlternates), 'Italian hreflang (reciprocal)');
  equal(it.ogLocale, 'it_IT', 'og:locale');
  equal(JSON.stringify(it.ogAlternates), JSON.stringify(['en_US']), 'og:locale:alternate');
  assert(!it.noindex && !en.noindex, 'a product page said noindex');
});

await check('its JSON-LD is Italian in the Italian page, with the same offer', async () => {
  const [itPage, itCrumbs, itProduct] = graphOf(await html(`${IT}/products/festival-strap`));
  const [, , enProduct] = graphOf(await html(`${EN}/products/festival-strap`));
  equal(itPage.inLanguage, 'it', 'inLanguage');
  equal(itPage.url, strapIt, 'page url');
  equal(itProduct.name, 'Tracolla del festival', 'product name');
  equal(itProduct.description, 'Tracolla in cotone morbido.', 'product description');
  equal(JSON.stringify({ ...itProduct.offers, url: null }), JSON.stringify({ ...enProduct.offers, url: null }), 'shared offer');
  equal(itProduct.offers.url, strapIt, 'offer url');
  equal(itCrumbs.itemListElement.at(-1).name, 'Tracolla del festival', 'breadcrumb');
  assert(itCrumbs.itemListElement[0].item.startsWith(`${C}${IT}/`), 'breadcrumb links stay Italian');
});

await check('a partially translated product is not presented as a translation', async () => {
  await saveProduct('Tracolla del festival', ''); // name only: the description falls back
  const it = links(await html(`${IT}/products/festival-strap`));
  const en = links(await html(`${EN}/products/festival-strap`));
  equal(it.canonical, strapEn, 'canonical points at the original');
  equal(it.hreflang.length, 0, 'Italian hreflang');
  equal(en.hreflang.length, 0, 'English hreflang no longer names the Italian page');
  equal(graphOf(await html(`${IT}/products/festival-strap`))[0].inLanguage, 'en', 'inLanguage of the main content');
});

await check('an untranslated product canonicals to the original in both languages', async () => {
  const it = links(await html(`${IT}/products/sample-mug`));
  equal(it.canonical, `${C}${EN}/products/sample-mug`, 'canonical');
  equal(it.hreflang.length, 0, 'hreflang');
});

await check('transactional and private pages say noindex and carry no hreflang', async () => {
  for (const path of [`${IT}/cart`, `${EN}/cart`, `${IT}/checkout`, `${IT}/search?q=x`, orderPath]) {
    const res = await get(path);
    if (res.status !== 200) continue; // a redirect is not indexed either
    const l = links(await res.text());
    assert(l.noindex, `${path} is indexable`);
    equal(l.hreflang.length, 0, `${path} hreflang`);
  }
});

let sitemap = '';
await check('the sitemap is valid XML with the same alternates as the HTML', async () => {
  await saveProduct('Tracolla del festival', 'Tracolla in cotone morbido.');
  const res = await get(`${EN}/sitemap.xml`);
  equal(res.status, 200, 'sitemap status');
  sitemap = await res.text();
  const { execFileSync } = await import('node:child_process');
  execFileSync('xmllint', ['--noout', '-'], { input: sitemap });
  const urlFor = (loc) => sitemap.match(new RegExp(`<url>\\s*<loc>${loc.replace(/[.?]/g, '\\$&')}</loc>([\\s\\S]*?)</url>`))?.[1];
  for (const loc of [strapEn, strapIt]) {
    const block = urlFor(loc);
    assert(block !== undefined, `${loc} missing`);
    const alts = [...block.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => `${m[1]} ${m[2]}`);
    equal(JSON.stringify(alts), JSON.stringify(expectedAlternates), `${loc} alternates`);
  }
  // The Italian catalog is an interface page: listed. An untranslated product: original only.
  assert(sitemap.includes(`<loc>${C}${IT}/</loc>`), 'Italian home');
  assert(sitemap.includes(`<loc>${C}${EN}/products/sample-mug</loc>`), 'original of untranslated product');
  assert(!sitemap.includes(`${IT}/products/sample-mug<`), 'untranslated Italian product listed');
});

await check('the sitemap leaves out drafts and everything private', async () => {
  const res = await get(`${EN}/api/admin/pages`, form({ title: 'Draft notes', slug: 'draft-notes' }, admin));
  equal(res.status, 303, 'draft created');
  sitemap = await (await get(`${EN}/sitemap.xml`)).text();
  assert(!sitemap.includes('draft-notes'), 'draft page listed');
  for (const part of ['/admin', '/api/', '/cart', '/checkout', '/pay/', '/order/', '/account', '/search', '/express']) {
    assert(!sitemap.includes(`${C}${EN}${part}`) && !sitemap.includes(`${C}${IT}${part}`), `${part} listed`);
  }
  // The translated page is listed in both languages.
  assert(sitemap.includes(`<loc>${C}${IT}/pages/festival-info</loc>`), 'translated page');
});

await check('llms.txt follows the language and the mount', async () => {
  const it = await (await get(`${IT}/llms.txt`)).text();
  const en = await (await get(`${EN}/llms.txt`)).text();
  assert(it.includes(`[Tracolla del festival](${C}${IT}/products/festival-strap)`), 'Italian product line');
  assert(it.includes('## Prodotti') && it.includes(`${C}${EN}/llms.txt`), 'Italian headings and the English file');
  assert(en.includes(`[Festival strap](${C}${EN}/products/festival-strap)`), 'English product line');
  assert(en.includes(`${C}${IT}/llms.txt`), 'English names the Italian file');
});

await check('sitemap, llms.txt and pages carry the tags an editorial purge clears', async () => {
  for (const path of [`${EN}/sitemap.xml`, `${IT}/llms.txt`, `${IT}/pages/festival-info`]) {
    const tags = (await get(path)).headers.get('cache-tag') ?? '';
    assert(tags.includes('catalog') && tags.includes('shell'), `${path} tags ${tags}`);
  }
});

await check('the content source cannot move onto a language that has translations', async () => {
  const res = await get(`${EN}/admin/settings`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/x-www-form-urlencoded', cookie: admin },
    body: new URLSearchParams([
      ['_action', 'save_languages'],
      ['default_locale', 'en'],
      ['content_source_locale', 'it'],
      ['routing', 'prefix'],
      ['detect', 'off'],
      ['enabled_locales', 'en'],
      ['enabled_locales', 'it'],
    ]).toString(),
  });
  const body = await res.text();
  assert(body.includes('Translations in &quot;it&quot; already exist') || body.includes('Translations in "it" already exist'), 'the change was not refused');
  equal(links(await html(`${IT}/products/festival-strap`)).canonical, strapIt, 'settings unchanged');
});

await check('disabling Italian removes it from hreflang, the sitemap and llms.txt', async () => {
  // URLSearchParams needs repeated keys: build the body by hand.
  const post = (enabled) =>
    get(`${EN}/admin/settings`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/x-www-form-urlencoded', cookie: admin },
      body: new URLSearchParams([
        ['_action', 'save_languages'],
        ['default_locale', 'en'],
        ['content_source_locale', 'en'],
        ['routing', 'prefix'],
        ['detect', 'off'],
        ...enabled.map((code) => ['enabled_locales', code]),
      ]).toString(),
    });
  await post(['en']);
  try {
    const en = links(await html(`${EN}/products/festival-strap`));
    equal(en.canonical, strapEn, 'canonical');
    equal(en.hreflang.length, 0, 'hreflang');
    equal(en.ogLocale, undefined, 'og:locale on a single-language store');
    const map = await (await get(`${EN}/sitemap.xml`)).text();
    assert(!map.includes(`${IT}/`) && !map.includes('xhtml:link'), 'the sitemap still names Italian');
    assert(!(await (await get(`${EN}/llms.txt`)).text()).includes('/it'), 'llms.txt names Italian');
    assert((await get(`${IT}/products/festival-strap`)).status !== 200, 'the Italian page still answers');
  } finally {
    await post(['en', 'it']);
  }
  equal(links(await html(`${IT}/products/festival-strap`)).hreflang.length, 3, 'Italian back after re-enabling');
});

// I18N_SAMPLES=<dir> saves what the Worker really served, for review.
if (process.env.I18N_SAMPLES) {
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync(process.env.I18N_SAMPLES, { recursive: true });
  const head = (body) => body.match(/<head>[\s\S]*?<\/head>/)?.[0].replace(/<script is:inline>[\s\S]*?<\/script>|<script>[\s\S]*?<\/script>/g, '') ?? '';
  const ld = (body) => body.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/)?.[0] ?? '';
  for (const [name, path] of [['product-en', `${EN}/products/festival-strap`], ['product-it', `${IT}/products/festival-strap`], ['untranslated-it', `${IT}/products/sample-mug`]]) {
    const body = await html(path);
    writeFileSync(`${process.env.I18N_SAMPLES}/${name}.html`, `${head(body)}\n${ld(body)}\n`);
  }
  writeFileSync(`${process.env.I18N_SAMPLES}/sitemap.xml`, await (await get(`${EN}/sitemap.xml`)).text());
  writeFileSync(`${process.env.I18N_SAMPLES}/llms-it.txt`, await (await get(`${IT}/llms.txt`)).text());
}

if (failures > 0) {
  console.log(`\ntranslated content: ${failures} check(s) failed`);
  process.exit(1);
}
console.log('\ntranslated content: all checks passed');
