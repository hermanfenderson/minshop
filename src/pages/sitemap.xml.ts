import { rootHref, type Href } from '../i18n/urls';
import type { APIRoute } from 'astro';
import { PUBLIC_CACHE_CONTROL } from '../features/cache/public';
import { env } from 'cloudflare:workers';
import { listProducts, countProducts } from '../features/products/db';
import { listCategories } from '../features/categories/db';
import { listPublishedPages } from '../features/pages/db';
import { catalogPath } from '../features/settings/home';
import { publicOrigin } from '../features/http/origin';
import { MOUNT } from '../deployment';
import { requestLanguage } from '../features/i18n/request';
import { LOCALE_REGISTRY, languageSettings } from '../features/i18n/settings';
import { sitemapEntries, type Availability, type SitemapEntry } from '../features/i18n/seo';
import { translatedLocalesByRow } from '../features/translations/db';

export const prerender = false;

/**
 * Every page the sitemap should list, in order, with the languages its
 * content exists in ('all' for the catalog, an interface page).
 *
 * The catalog is included at whichever address it actually lives at. When the
 * home page has been pointed at a page or product, `/` renders that target and
 * canonicals to it — so listing `/` would put a non-canonical duplicate in the
 * sitemap (the target is already listed on its own URL), while the real catalog
 * at `/products` would be missing entirely.
 *
 * Pure and exported so the rule is testable without standing up a request.
 */
export function sitemapPages(
  homePage: string | null | undefined,
  data: {
    categories: Array<{ slug: string; translatedInto?: string[] }>;
    products: Array<{ slug: string; translatedInto?: string[] }>;
    pages: Array<{ slug: string; translatedInto?: string[] }>;
  },
): Array<{ path: string; available: Availability }> {
  const of = (row: { translatedInto?: string[] }) => row.translatedInto ?? [];
  return [
    { path: catalogPath(homePage), available: 'all' as const },
    ...data.categories.map((c) => ({ path: `/categories/${c.slug}`, available: of(c) })),
    ...data.products.map((p) => ({ path: `/products/${p.slug}`, available: of(p) })),
    // Published pages only — drafts must not be discoverable.
    ...data.pages.map((p) => ({ path: `/pages/${p.slug}`, available: of(p) })),
  ];
}

/** The single-language URL list (kept for its tests and callers). */
export function sitemapLocs(
  origin: string,
  homePage: string | null | undefined,
  data: { categories: { slug: string }[]; products: { slug: string }[]; pages: { slug: string }[] },
  /** Logical path → public path (mount, language). Root by default. */
  href: Href = rootHref,
): string[] {
  return sitemapPages(homePage, data).map((p) => `${origin}${href(p.path)}`);
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/**
 * The document. One language: exactly the plain urlset it always was. More:
 * every localized version with its xhtml:link alternates — the same set its
 * HTML head carries (features/i18n/seo.ts).
 */
export function sitemapXml(entries: SitemapEntry[], multilingual: boolean): string {
  if (!multilingual) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `  <url><loc>${xml(e.loc)}</loc></url>`).join('\n')}
</urlset>
`;
  }
  const url = (e: SitemapEntry) =>
    [
      `  <url>`,
      `    <loc>${xml(e.loc)}</loc>`,
      ...e.alternates.map(
        (a) => `    <xhtml:link rel="alternate" hreflang="${xml(a.hreflang)}" href="${xml(a.href)}"/>`,
      ),
      `  </url>`,
    ].join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.map(url).join('\n')}
</urlset>
`;
}

// One sitemap for every language, at the store's own address (never under a
// language prefix: /sitemap.xml is an unlocalized file). Active products,
// categories and published pages; nothing transactional or private.
export const GET: APIRoute = async ({ url, locals }) => {
  const origin = publicOrigin(url.origin, env.CANONICAL_ORIGIN);
  const total = await countProducts(env.DB);
  const products = total > 0 ? await listProducts(env.DB, total, 0) : [];
  const categories = await listCategories(env.DB);
  const pages = await listPublishedPages(env.DB);

  const settings = languageSettings(locals.settings);
  const multilingual = settings.enabledLocales.length > 1;
  // Which languages each row is fully translated into: one read per entity type.
  const [productCover, categoryCover, pageCover] = multilingual
    ? await Promise.all([
        translatedLocalesByRow(env.DB, 'product', products),
        translatedLocalesByRow(env.DB, 'category', categories),
        translatedLocalesByRow(
          env.DB,
          'page',
          pages.map((p) => ({ id: p.id, title: p.title, body_markdown: p.has_body ? '…' : '' })),
        ),
      ])
    : [new Map<number, string[]>(), new Map<number, string[]>(), new Map<number, string[]>()];
  const listed = sitemapPages(locals.settings?.homePage, {
    categories: categories.map((c) => ({ slug: c.slug, translatedInto: categoryCover.get(c.id) })),
    products: products.map((p) => ({ slug: p.slug, translatedInto: productCover.get(p.id) })),
    pages: pages.map((p) => ({ slug: p.slug, translatedInto: pageCover.get(p.id) })),
  });

  const { urls } = requestLanguage(settings, LOCALE_REGISTRY, MOUNT, settings.defaultLocale, origin, {
    path: '/',
    search: '',
  });
  const entries = sitemapEntries(
    settings,
    LOCALE_REGISTRY,
    (path, locale) => urls.absolute(path, { locale }),
    listed,
  );

  return new Response(sitemapXml(entries, multilingual), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': PUBLIC_CACHE_CONTROL,
    },
  });
};
