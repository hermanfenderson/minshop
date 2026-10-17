import { describe, expect, it } from 'vitest';
import { isLocalizedPath, resolveRequestLocale } from './resolve';
import { createRouting } from './routing';
import { resolveI18nSettings, type I18nSettings } from './settings';

const ORIGIN = 'https://monopolele.com';
const monopolele = (over: Partial<I18nSettings> = {}) =>
  resolveI18nSettings({ defaultLocale: 'en', contentSourceLocale: 'it', enabledLocales: ['en', 'it'], ...over });

function resolve(path: string, over: Partial<I18nSettings> = {}, mount = '/shop', extra = {}) {
  const s = monopolele(over);
  return resolveRequestLocale(new URL(path, ORIGIN), createRouting(s, mount), s, { mount, ...extra });
}

describe('isLocalizedPath', () => {
  it('separates pages from surfaces with no language', () => {
    for (const p of ['/', '/cart', '/products/mug', '/partials/cart', '/pay/otk_x', '/llms.txt']) {
      expect(isLocalizedPath(p), p).toBe(true);
    }
    for (const p of ['/admin', '/admin/login', '/api/cart', '/images/a.jpg', '/_astro/x.js', '/robots.txt', '/sitemap.xml']) {
      expect(isLocalizedPath(p), p).toBe(false);
    }
  });
});

describe('prefix strategy under /shop (Monopolele)', () => {
  it('serves English at /shop/ without a rewrite', () => {
    expect(resolve('/shop/')).toEqual({
      action: 'serve', locale: 'en', path: '/', localized: true, internalPath: '/shop/', rewrite: false,
    });
  });

  it('serves Italian at /it/shop/ through a rewrite to the internal path', () => {
    expect(resolve('/it/shop/products/mug?x=1')).toEqual({
      action: 'serve', locale: 'it', path: '/products/mug', localized: true, internalPath: '/shop/products/mug', rewrite: true,
    });
  });

  it('is not involved outside the mount', () => {
    expect(resolve('/it/')).toEqual({ action: 'outside' });
    expect(resolve('/robots.txt')).toEqual({ action: 'outside' });
  });

  it('serves surfaces with no language at the bare mount', () => {
    expect(resolve('/shop/api/cart')).toMatchObject({ action: 'serve', locale: 'en', localized: false, rewrite: false });
    expect(resolve('/shop/admin')).toMatchObject({ action: 'serve', localized: false });
  });

  it('redirects a language prefix away from those surfaces', () => {
    expect(resolve('/it/shop/admin')).toEqual({ action: 'redirect', status: 301, location: '/shop/admin', negotiated: false });
    expect(resolve('/it/shop/images/a.jpg')).toMatchObject({ location: '/shop/images/a.jpg' });
  });

  it('keeps the method and body: 308 for non-GET redirects', () => {
    expect(resolve('/it/shop/api/cart', {}, '/shop', { method: 'POST' })).toEqual({
      action: 'redirect', status: 308, location: '/shop/api/cart', negotiated: false,
    });
    expect(resolve('/it/shop/cart', {}, '/shop', { method: 'POST' })).toMatchObject({ action: 'serve', rewrite: true });
  });

  it('redirects the explicit default prefix to the canonical URL, keeping the query', () => {
    expect(resolve('/en/shop/search?q=uke')).toEqual({
      action: 'redirect', status: 301, location: '/shop/search?q=uke', negotiated: false,
    });
  });

  it('redirects a disabled language to the default', () => {
    expect(resolve('/it/shop/cart', { enabledLocales: ['en'] })).toMatchObject({ action: 'redirect', location: '/shop/cart' });
  });

  it('with prefixDefault, prefixes the default and redirects bare URLs', () => {
    expect(resolve('/shop/cart', { prefixDefault: true })).toMatchObject({ action: 'redirect', location: '/en/shop/cart' });
    expect(resolve('/en/shop/cart', { prefixDefault: true })).toMatchObject({ action: 'serve', locale: 'en', rewrite: true });
    expect(resolve('/shop/api/cart', { prefixDefault: true })).toMatchObject({ action: 'serve', localized: false });
  });
});

describe('prefix strategy standalone (mount /)', () => {
  it('serves the same tree at the root', () => {
    expect(resolve('/', {}, '')).toMatchObject({ action: 'serve', locale: 'en', internalPath: '/' });
    expect(resolve('/it/', {}, '')).toMatchObject({ action: 'serve', locale: 'it', internalPath: '/', rewrite: true });
    expect(resolve('/it', {}, '')).toMatchObject({ action: 'serve', locale: 'it', path: '/' });
    expect(resolve('/it/api/cart', {}, '')).toMatchObject({ action: 'redirect', location: '/api/cart' });
  });
});

describe('home-page language detection', () => {
  const opts = (acceptLanguage: string | null, cookie: string | null = null) => ({ preferred: { acceptLanguage, cookie } });

  it('is off by default: the URL alone decides', () => {
    expect(resolve('/shop/', {}, '/shop', opts('it'))).toMatchObject({ action: 'serve', locale: 'en' });
  });

  it('with detect=root, suggests a language on the home page only (302, never cached)', () => {
    expect(resolve('/shop/', { detect: 'root' }, '/shop', opts('it-IT,it;q=0.9'))).toEqual({
      action: 'redirect', status: 302, location: '/it/shop/', negotiated: true,
    });
    expect(resolve('/shop/cart', { detect: 'root' }, '/shop', opts('it'))).toMatchObject({ action: 'serve', locale: 'en' });
  });

  it('prefers an explicit cookie choice over Accept-Language', () => {
    expect(resolve('/shop/', { detect: 'root' }, '/shop', opts('it', 'en'))).toMatchObject({ action: 'serve', locale: 'en' });
    expect(resolve('/shop/', { detect: 'root' }, '/shop', opts('en', 'it'))).toMatchObject({ location: '/it/shop/' });
  });

  it('never redirects a POST', () => {
    expect(resolve('/shop/', { detect: 'root' }, '/shop', { method: 'POST', ...opts('it') })).toMatchObject({ action: 'serve' });
  });
});

describe('query strategy', () => {
  const q = { routing: 'query' as const };

  it('serves the named language with no rewrite', () => {
    expect(resolve('/shop/cart?lang=it', q)).toMatchObject({ action: 'serve', locale: 'it', rewrite: false, internalPath: '/shop/cart' });
  });

  it('removes a default, unknown or disabled parameter, keeping the rest', () => {
    expect(resolve('/shop/search?q=uke&lang=en', q)).toMatchObject({ action: 'redirect', location: '/shop/search?q=uke' });
    expect(resolve('/shop/cart?lang=xx', q)).toMatchObject({ action: 'redirect', location: '/shop/cart' });
    expect(resolve('/shop/api/cart?lang=it', q)).toMatchObject({ action: 'redirect', location: '/shop/api/cart' });
  });
});

describe('domain strategy (engine only)', () => {
  const d = { routing: 'domain' as const, domains: { en: 'monopolele.com', it: 'monopolele.it' } };
  const at = (href: string) => {
    const s = monopolele(d);
    return resolveRequestLocale(new URL(href), createRouting(s, '/shop'), s, { mount: '/shop' });
  };

  it('serves the host language, and every surface on every host', () => {
    expect(at('https://monopolele.it/shop/cart')).toMatchObject({ action: 'serve', locale: 'it', rewrite: false });
    expect(at('https://monopolele.it/shop/api/cart')).toMatchObject({ action: 'serve', localized: false });
    expect(at('https://unmapped.example/shop/cart')).toMatchObject({ action: 'serve', locale: 'en' });
  });

  it('redirects a host whose language is disabled to the default host', () => {
    const s = monopolele({ ...d, enabledLocales: ['en'] });
    const r = resolveRequestLocale(new URL('https://monopolele.it/shop/cart?x=1'), createRouting(s, '/shop'), s, { mount: '/shop' });
    expect(r).toEqual({ action: 'redirect', status: 301, location: 'https://monopolele.com/shop/cart?x=1', negotiated: false });
  });
});
