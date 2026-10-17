import { describe, expect, it } from 'vitest';
import { resolveI18nSettings, type I18nSettings } from '../settings';
import { createRouting } from './index';

const url = (href: string) => new URL(href, 'https://monopolele.com');
const settings = (over: Partial<I18nSettings> = {}) =>
  resolveI18nSettings({ defaultLocale: 'en', contentSourceLocale: 'it', enabledLocales: ['en', 'it'], ...over });

describe('prefix strategy', () => {
  for (const mount of ['', '/shop']) {
    const r = createRouting(settings(), mount);
    describe(`mount "${mount || '/'}"`, () => {
      it('reads the language before the mount', () => {
        expect(r.match(url(`/it${mount}/products/mug`))).toEqual({ kind: 'match', locale: 'it', path: '/products/mug' });
        expect(r.match(url(`${mount}/products/mug`))).toEqual({ kind: 'match', locale: null, path: '/products/mug' });
        expect(r.match(url(`/it${mount}/`))).toEqual({ kind: 'match', locale: 'it', path: '/' });
        expect(r.match(url(`/en${mount}/cart`))).toEqual({ kind: 'match', locale: 'en', path: '/cart' });
      });

      it('locates logical paths, without a prefix for the default language', () => {
        expect(r.locate('/products/mug', 'it', true).pathname).toBe(`/it${mount}/products/mug`);
        expect(r.locate('/products/mug', 'en', true).pathname).toBe(`${mount}/products/mug`);
        expect(r.locate('/', 'it', true).pathname).toBe(`/it${mount}/`);
        expect(r.locate('/api/cart', 'it', false).pathname).toBe(`${mount}/api/cart`);
      });
    });
  }

  it('recognizes a supported but disabled language, so it can be redirected', () => {
    const r = createRouting(settings({ enabledLocales: ['en'] }), '/shop');
    expect(r.match(url('/it/shop/cart'))).toEqual({ kind: 'match', locale: 'it', path: '/cart' });
  });

  it('leaves other apps on the host alone (Monopolele owns /, /it/ and robots.txt)', () => {
    const r = createRouting(settings(), '/shop');
    for (const path of ['/', '/it/', '/it', '/it/chi-siamo', '/robots.txt', '/shopping', '/blog/x']) {
      expect(r.match(url(path)), path).toEqual({ kind: 'outside' });
    }
  });

  it('prefixes the default language too with prefixDefault', () => {
    const r = createRouting(settings({ prefixDefault: true }), '/shop');
    expect(r.locate('/cart', 'en', true).pathname).toBe('/en/shop/cart');
    expect(r.locate('/api/cart', 'en', false).pathname).toBe('/shop/api/cart');
  });
});

describe('query strategy', () => {
  const r = createRouting(settings({ routing: 'query' }), '/shop');

  it('reads the parameter and never touches the path', () => {
    expect(r.match(url('/shop/cart?lang=it'))).toEqual({ kind: 'match', locale: 'it', path: '/cart' });
    expect(r.match(url('/shop/cart?lang=IT'))).toEqual({ kind: 'match', locale: 'it', path: '/cart' });
    expect(r.match(url('/shop/cart'))).toEqual({ kind: 'match', locale: null, path: '/cart' });
    expect(r.match(url('/shop/cart?lang=xx'))).toEqual({ kind: 'match', locale: 'xx', path: '/cart' });
    expect(r.match(url('/blog?lang=it'))).toEqual({ kind: 'outside' });
  });

  it('adds the parameter only for other languages', () => {
    expect(r.locate('/cart', 'it', true)).toEqual({ pathname: '/shop/cart', params: [['lang', 'it']] });
    expect(r.locate('/cart', 'en', true)).toEqual({ pathname: '/shop/cart', params: [] });
    expect(r.locate('/api/cart', 'it', false)).toEqual({ pathname: '/shop/api/cart', params: [] });
    expect(r.param).toBe('lang');
  });

  it('uses the configured parameter name', () => {
    const custom = createRouting(settings({ routing: 'query', queryParam: 'hl' }), '');
    expect(custom.match(url('/cart?hl=it'))).toEqual({ kind: 'match', locale: 'it', path: '/cart' });
  });
});

describe('domain strategy (engine only)', () => {
  const r = createRouting(
    settings({ routing: 'domain', domains: { en: 'shop.example.com', it: 'negozio.example.it' } }),
    '',
  );

  it('reads the language from the host', () => {
    expect(r.match(url('https://negozio.example.it/cart'))).toEqual({ kind: 'match', locale: 'it', path: '/cart' });
    expect(r.match(url('https://shop.example.com/cart'))).toEqual({ kind: 'match', locale: 'en', path: '/cart' });
    expect(r.match(url('https://other.example.net/cart'))).toEqual({ kind: 'match', locale: null, path: '/cart' });
  });

  it('locates each language on its host', () => {
    expect(r.locate('/cart', 'it', true)).toEqual({ host: 'negozio.example.it', pathname: '/cart', params: [] });
    expect(r.locate('/api/cart', 'it', false)).toEqual({ pathname: '/api/cart', params: [] });
  });
});
