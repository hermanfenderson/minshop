import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { listProducts, countProducts } from '../../../features/products/db';
import { categoriesForProducts } from '../../../features/categories/db';
import { getSearchProvider } from '../../../features/search';
import { toCatalogProduct } from '../../../features/catalog/serialize';
import { commerceMode } from '../../../features/settings/db';
import { catalogJson, catalogPreflight } from '../../../features/catalog/http';
import { parseCatalogListQuery } from '../../../features/catalog/query';
import { getConfig } from '../../../config';
import { publicOrigin } from '../../../features/http/origin';
import { addCacheTags, productCacheTags } from '../../../features/cache/tags';
import { catalogLanguage } from '../../../features/catalog/language';
import { translated, translatedAll } from '../../../features/translations/content';

export const prerender = false;

export const OPTIONS: APIRoute = () => catalogPreflight();

/**
 * GET /api/products — machine-readable catalog for agents/tools.
 *   ?q=<query>      semantic/keyword search (uses the active search backend)
 *   ?limit=<1-100>  page size (default 24)
 *   ?offset=<n>     pagination offset
 * Returns active products only. Absolute image + product urls.
 */
export const GET: APIRoute = async ({ url, locals }) => {
  const { query: q, limit, offset } = parseCatalogListQuery(url.searchParams);
  const origin = publicOrigin(url.origin, env.CANONICAL_ORIGIN);

  let page;
  let total;
  if (q) {
    const result = await (await getSearchProvider()).search(q, { limit, offset, locale: locals.contentLocale });
    total = result.total;
    page = result.products;
  } else {
    page = await listProducts(env.DB, limit, offset);
    total = await countProducts(env.DB);
  }

  const imageBaseUrl = getConfig().images.baseUrl;
  const minimumContribution = (await commerceMode(env.DB, locals.settings)) === 'benefit';
  const categories = await categoriesForProducts(
    env.DB,
    page.map((p) => p.id),
  );
  // Texts and product URLs in the language ?lang= names; prices are shared.
  const language = await catalogLanguage(env.DB, locals, origin, {
    product: page.map((p) => p.id),
    category: [...categories.values()].flat().map((c) => c.id),
  });
  const products = page.map((p) =>
    toCatalogProduct(
      translated(language.translations, 'product', p),
      translatedAll(language.translations, 'category', categories.get(p.id) ?? []).map((c) => c.name),
      origin,
      { imageBaseUrl, absolute: language.absolute, minimumContribution },
    ),
  );

  const response = catalogJson({ products, total, limit, offset, query: q || null });
  if (language.contentLanguage) response.headers.set('content-language', language.contentLanguage);
  addCacheTags(response.headers, productCacheTags(page.map((product) => product.public_id)));
  return response;
};
