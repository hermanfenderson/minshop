import { describe, it, expect } from 'vitest';
import { sitemapLocs, sitemapPages, sitemapXml } from './sitemap.xml';
import { sitemapEntries } from '../features/i18n/seo';
import { BUILTIN_LOCALES } from '../i18n/locales';
import { createLocaleUrls, createRouting, resolveI18nSettings } from '../i18n';

const origin = 'https://shop.example';
const data = {
  categories: [{ slug: 'hats' }],
  products: [{ slug: 'beanie' }],
  pages: [{ slug: 'about' }],
};

describe('sitemapLocs', () => {
  it('lists the catalog at / when the home page is the catalog', () => {
    const locs = sitemapLocs(origin, null, data);
    expect(locs[0]).toBe(`${origin}/`);
    expect(locs).not.toContain(`${origin}/products`);
  });

  // With `/` taken over, it renders the chosen target and canonicals to it — so
  // listing `/` would be a non-canonical duplicate of a URL already in the
  // sitemap, and the real catalog would be absent altogether.
  it('lists the catalog at /products once the home page is overridden', () => {
    const locs = sitemapLocs(origin, 'page:3', data);
    expect(locs[0]).toBe(`${origin}/products`);
    expect(locs).not.toContain(`${origin}/`);
  });

  it('covers every category, product, and published page', () => {
    const locs = sitemapLocs(origin, null, data);
    expect(locs).toContain(`${origin}/categories/hats`);
    expect(locs).toContain(`${origin}/products/beanie`);
    expect(locs).toContain(`${origin}/pages/about`);
    expect(locs).toHaveLength(4);
  });

  it('never emits a duplicate URL', () => {
    for (const home of [null, 'page:3', 'product:9']) {
      const locs = sitemapLocs(origin, home, data);
      expect(new Set(locs).size).toBe(locs.length);
    }
  });

  it('keeps every URL under the mount', () => {
    const settings = resolveI18nSettings();
    const urls = createLocaleUrls({
      routing: createRouting(settings, '/shop'),
      settings,
      locale: 'en',
      origin,
    });
    const locs = sitemapLocs(origin, null, data, urls.href);
    expect(locs).toEqual([
      `${origin}/shop/`,
      `${origin}/shop/categories/hats`,
      `${origin}/shop/products/beanie`,
      `${origin}/shop/pages/about`,
    ]);
  });
});

describe('multilingual sitemap', () => {
  const settings = resolveI18nSettings({ enabledLocales: ['en', 'it'] });
  const absolute = (path: string, locale: string) =>
    createLocaleUrls({
      routing: createRouting(settings, '/shop'),
      settings,
      locale,
      origin,
    }).absolute(path);
  const pages = sitemapPages(null, {
    categories: [],
    products: [
      { slug: 'strap', translatedInto: ['it'] },
      { slug: 'mug', translatedInto: [] },
    ],
    pages: [],
  });
  const entries = sitemapEntries(settings, BUILTIN_LOCALES, absolute, pages);

  it('lists every translated version, and only the original of untranslated content', () => {
    expect(entries.map((e) => e.loc)).toEqual([
      `${origin}/shop/`,
      `${origin}/it/shop/`,
      `${origin}/shop/products/strap`,
      `${origin}/it/shop/products/strap`,
      `${origin}/shop/products/mug`,
    ]);
  });

  it('gives each version the reciprocal alternates its HTML carries', () => {
    const strap = entries.filter((e) => e.loc.includes('strap'));
    expect(strap[0].alternates).toEqual(strap[1].alternates);
    expect(strap[0].alternates.map((a) => a.hreflang)).toEqual(['en', 'it', 'x-default']);
    expect(entries.find((e) => e.loc.endsWith('/mug'))!.alternates).toEqual([]);
  });

  it('writes xhtml:link alternates in a namespaced urlset', () => {
    const doc = sitemapXml(entries, true);
    expect(doc).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
    expect(doc).toContain(`<xhtml:link rel="alternate" hreflang="it" href="${origin}/it/shop/products/strap"/>`);
    expect(doc.match(/<url>/g)).toHaveLength(5);
  });

  it('keeps a single-language sitemap exactly as it was', () => {
    const doc = sitemapXml([{ loc: `${origin}/`, alternates: [] }], false);
    expect(doc).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${origin}/</loc></url>
</urlset>
`);
  });
});
