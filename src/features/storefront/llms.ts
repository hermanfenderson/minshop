import { markdownExcerpt } from '../pages/markdown.ts';
import type { APIContext } from 'astro';
import { PUBLIC_CACHE_CONTROL } from '../cache/public';
import { env } from 'cloudflare:workers';
import { getConfig, formatPrice } from '../../config';
import { listProducts, countProducts } from '../products/db';
import { listCategories } from '../categories/db';
import { listPublishedPages } from '../pages/db';
import { publicOrigin } from '../http/origin';
import { loadTranslations, translatedLocalesByRow } from '../translations/db';
import { translatedAll } from '../translations/content';
import { LOCALE_REGISTRY, languageSettings } from '../i18n/settings';

// Markdown link text can't contain unescaped brackets; product names are free
// text, so strip brackets and collapse whitespace. Slugs are URL-safe already.
const linkText = (s: string) => s.replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim();
const oneLine = (s: string | null, max = 100) => {
  if (!s) return '';
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

// /llms.txt — the llmstxt.org convention: a concise, link-rich map of the store
// for LLMs/agents. Beyond the usual catalog, it documents the JSON checkout so an
// agentic buyer can go from "what's for sale" to "place the order" without scraping.
export const llmsResponse = async ({ url, locals }: Pick<APIContext, 'url' | 'locals'>): Promise<Response> => {
  const origin = publicOrigin(url.origin, env.CANONICAL_ORIGIN);
  // Absolute public URL for a logical path: the canonical origin + mount.
  const abs = (path: string) => `${origin}${locals.urls.href(path)}`;
  const { currency } = getConfig();
  const storeName = locals.settings?.storeName ?? getConfig().storeName;
  const { t, intl } = locals.i18n;

  const total = await countProducts(env.DB);
  const sourceProducts = total > 0 ? await listProducts(env.DB, total, 0) : [];
  const sourceCategories = await listCategories(env.DB);
  const sourcePages = await listPublishedPages(env.DB);
  // This file is per language (/llms.txt, /it/llms.txt): its links stay in it,
  // and names and descriptions come from the same translations the pages show.
  const tr = await loadTranslations(env.DB, locals.contentLocale, {
    product: sourceProducts.map((p) => p.id),
    category: sourceCategories.map((c) => c.id),
    page: sourcePages.map((p) => p.id),
  });
  const products = translatedAll(tr, 'product', sourceProducts);
  const categories = translatedAll(tr, 'category', sourceCategories);
  const pages = translatedAll(tr, 'page', sourcePages);
  const languages = languageSettings(locals.settings);
  // Each link goes to the page's canonical URL: in this language where the
  // content is translated, else the original (features/i18n/seo.ts).
  const [productCover, categoryCover, pageCover] = locals.contentLocale
    ? await Promise.all([
        translatedLocalesByRow(env.DB, 'product', sourceProducts),
        translatedLocalesByRow(env.DB, 'category', sourceCategories),
        translatedLocalesByRow(
          env.DB,
          'page',
          sourcePages.map((p) => ({ id: p.id, title: p.title, body_markdown: p.has_body ? '…' : '' })),
        ),
      ])
    : [new Map<number, string[]>(), new Map<number, string[]>(), new Map<number, string[]>()];
  const link = (path: string, cover: Map<number, string[]>, id: number) =>
    !locals.contentLocale || cover.get(id)?.includes(locals.contentLocale)
      ? abs(path)
      : `${origin}${locals.urls.href(path, { locale: languages.contentSourceLocale })}`;
  const others = languages.enabledLocales.filter((code) => code !== locals.locale);
  const languageLine =
    others.length > 0
      ? `\n${t('llms.language', {
          others: others
            .map((code) => `[${LOCALE_REGISTRY[code]?.label ?? code}](${origin}${locals.urls.href('/llms.txt', { locale: code })})`)
            .join(', '),
        })}\n`
      : '';

  const productLines = products.map((p) => {
    const desc = oneLine(p.description ? markdownExcerpt(p.description, 300) : null);
    // This whole-catalog response carries coarse tags, so checkout-frequency
    // product-tag purges cannot keep stock honest here. Omit availability; the
    // catalog API and checkout resolve it through product-scoped/live reads.
    return `- [${linkText(p.name)}](${link(`/products/${p.slug}`, productCover, p.id)}): ${formatPrice(p.price_cents, currency, intl)}${desc ? ` — ${desc}` : ''}`;
  });

  const categoryLines = categories.map(
    (c) => `- [${linkText(c.name)}](${link(`/categories/${c.slug}`, categoryCover, c.id)})`,
  );

  // Merchant-authored informational pages (shipping, returns, policies) — the
  // context an agent needs that the catalog itself doesn't carry.
  const pageLines = pages.map((p) => `- [${linkText(p.title)}](${link(`/pages/${p.slug}`, pageCover, p.id)})`);

  // Optional: this store's MCP endpoint, when one is deployed. The MCP server is
  // a SEPARATE Worker whose hostname the storefront cannot derive — they share a
  // database, not a config — and many instances never deploy it. So it is
  // advertised only when MCP_URL is set; unset means llms.txt says nothing,
  // rather than pointing agents at an endpoint that does not exist.
  const mcpUrl = (env.MCP_URL ?? '').trim();
  const mcpLine = mcpUrl
    ? `\n- [Model Context Protocol endpoint](${mcpUrl}): streamable HTTP. Browse and purchase need no credentials — \`browse_products\`, \`get_product_details\`, \`payment_methods\`, \`create_checkout\`, \`check_order_status\`. Same checkout as the JSON endpoints above.`
    : '';

  const body = `# ${storeName}

> ${t('llms.intro', { storeName, currency: currency.toUpperCase() })}
${languageLine}
## ${t('llms.products')}
${productLines.length > 0 ? productLines.join('\n') : `- ${t('llms.noProducts')}`}

## ${t('llms.categories')}
${categoryLines.length > 0 ? categoryLines.join('\n') : `- ${t('llms.noCategories')}`}
${pageLines.length > 0 ? `\n## ${t('llms.pages')}\n${pageLines.join('\n')}\n` : ''}
## ${t('llms.agents')}
- [List payment methods](${abs('/api/checkout')}): \`GET\` → \`{ available_methods, default }\`.
- [Browse the catalog as JSON](${abs('/api/products')}): \`GET\` (\`?q=\`, \`?limit=\`, \`?offset=\`) → products with prefixed public IDs (\`id: "prod_…"\`; the detail route \`/api/products/<slug>\` adds variants \`var_…\` and extras \`xtra_…\`).
- [Create a checkout](${abs('/api/checkout')}): \`POST\` with \`Content-Type: application/json\`, body \`{ "items": [{ "product_id": "prod_…", "quantity": number, "variant_id"?: "var_…", "extra_ids"?: ["xtra_…"] }], "method"?: string }\` → \`{ "checkout_url": string, "order_status_url": string }\`. IDs are the catalog's prefixed public IDs; \`slug\` is accepted in place of \`product_id\` as a convenience. Numeric IDs are rejected with 400. Pricing and stock are resolved server-side; CORS is open for browser-based callers. Poll \`order_status_url\` for \`confirming | expired | paid | refunded\`; a paid item may include a token-protected \`download_url\`. After submitting payment, keep polling through \`expired\` until \`paid\` or HTTP 410 because verified settlement can arrive late.
- [Search the catalog](${abs('/search')}?q=): append a query, e.g. \`/search?q=leather\`. Keyword + semantic matching.
- [Sitemap](${abs('/sitemap.xml')}): every product, category, and page URL.${mcpLine}
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': PUBLIC_CACHE_CONTROL,
    },
  });
};
