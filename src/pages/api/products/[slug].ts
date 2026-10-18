import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getProductBySlug } from '../../../features/products/db';
import { listVariants, listExtras } from '../../../features/products/variants';
import { categoriesForProduct } from '../../../features/categories/db';
import { toCatalogProduct } from '../../../features/catalog/serialize';
import { catalogJson, catalogPreflight } from '../../../features/catalog/http';
import { getConfig } from '../../../config';
import { publicOrigin } from '../../../features/http/origin';
import { addCacheTags, productCacheTags } from '../../../features/cache/tags';
import { catalogLanguage } from '../../../features/catalog/language';
import { translated, translatedAll } from '../../../features/translations/content';

export const prerender = false;

export const OPTIONS: APIRoute = () => catalogPreflight();

/** GET /api/products/:slug — one product as catalog JSON (with variants + extras).
    404 if missing/inactive. */
export const GET: APIRoute = async ({ params, url, locals }) => {
  const product = params.slug ? await getProductBySlug(env.DB, params.slug) : null;
  if (!product || product.active !== 1) {
    return catalogJson({ error: 'Product not found' }, 404);
  }
  const [cats, variants, extras] = await Promise.all([
    categoriesForProduct(env.DB, product.id),
    listVariants(env.DB, product.id),
    listExtras(env.DB, product.id),
  ]);
  const origin = publicOrigin(url.origin, env.CANONICAL_ORIGIN);
  const language = await catalogLanguage(env.DB, locals, origin, {
    product: [product.id],
    category: cats.map((c) => c.id),
    variant: variants.map((v) => v.id),
    extra: extras.map((e) => e.id),
  });
  const tr = language.translations;
  const response = catalogJson(
    toCatalogProduct(
      translated(tr, 'product', product),
      translatedAll(tr, 'category', cats).map((c) => c.name),
      origin,
      {
        variants: translatedAll(tr, 'variant', variants),
        extras: translatedAll(tr, 'extra', extras),
        imageBaseUrl: getConfig().images.baseUrl,
        absolute: language.absolute,
      },
    ),
  );
  if (language.contentLanguage) response.headers.set('content-language', language.contentLanguage);
  addCacheTags(response.headers, productCacheTags([product.public_id]));
  return response;
};
