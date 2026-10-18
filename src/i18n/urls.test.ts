import { describe, expect, it } from 'vitest';
import { createRouting } from './routing/index.ts';
import { resolveI18nSettings, type I18nSettings } from './settings.ts';
import { createLocaleUrls, hreflangTag } from './urls.ts';

const ORIGIN = 'https://monopolele.com';
function urls(locale: string, over: Partial<I18nSettings> = {}, mount = '/shop', current = {}) {
  const settings = resolveI18nSettings({ defaultLocale: 'en', contentSourceLocale: 'it', enabledLocales: ['en', 'it'], ...over });
  return createLocaleUrls({ routing: createRouting(settings, mount), settings, locale, origin: ORIGIN, ...current });
}

describe('LocaleUrls, prefix strategy under /shop', () => {
  const en = urls('en');
  const it_ = urls('it');

  it('builds the Monopolele URLs', () => {
    expect(en.home()).toBe('/shop/');
    expect(it_.home()).toBe('/it/shop/');
    expect(en.product('mug')).toBe('/shop/products/mug');
    expect(it_.product('mug')).toBe('/it/shop/products/mug');
    expect(it_.category('t-shirt')).toBe('/it/shop/categories/t-shirt');
    expect(it_.cart()).toBe('/it/shop/cart');
    expect(it_.order('tok_1')).toBe('/it/shop/order/tok_1');
  });

  it('never prefixes surfaces with no language; public APIs carry ?lang=', () => {
    expect(it_.href('/api/cart')).toBe('/shop/api/cart?lang=it');
    expect(en.href('/api/cart')).toBe('/shop/api/cart');
    expect(it_.href('/api/admin/products')).toBe('/shop/api/admin/products');
    expect(it_.absolute('/api/webhook/stripe')).toBe('https://monopolele.com/shop/api/webhook/stripe');
    expect(it_.href('/images/a/b.jpg')).toBe('/shop/images/a/b.jpg');
    expect(it_.href('/admin')).toBe('/shop/admin');
  });

  it('keeps queries and fragments, and encodes slugs', () => {
    expect(it_.search('tazza blu')).toBe('/it/shop/search?q=tazza+blu');
    expect(it_.href('/products/mug?canceled=1#buy')).toBe('/it/shop/products/mug?canceled=1#buy');
    expect(en.product('a/b c')).toBe('/shop/products/a%2Fb%20c');
  });

  it('builds absolute URLs for emails, canonicals and payment returns', () => {
    expect(it_.absolute('/order/tok_1')).toBe('https://monopolele.com/it/shop/order/tok_1');
    expect(en.absolute('/')).toBe('https://monopolele.com/shop/');
  });

  it('switches the current page to another language', () => {
    const page = urls('en', {}, '/shop', { currentPath: '/search', currentSearch: '?q=uke' });
    expect(page.switchTo('it')).toBe('/it/shop/search?q=uke');
    expect(urls('it', {}, '/shop', { currentPath: '/cart' }).switchTo('en')).toBe('/shop/cart');
  });

  it('lists hreflang alternates for the languages a page exists in, plus x-default', () => {
    expect(en.alternates('/products/mug')).toEqual([
      { hreflang: 'en', href: 'https://monopolele.com/shop/products/mug' },
      { hreflang: 'it', href: 'https://monopolele.com/it/shop/products/mug' },
      { hreflang: 'x-default', href: 'https://monopolele.com/shop/products/mug' },
    ]);
    expect(en.alternates('/products/mug', ['it'])).toEqual([
      { hreflang: 'it', href: 'https://monopolele.com/it/shop/products/mug' },
      { hreflang: 'x-default', href: 'https://monopolele.com/shop/products/mug' },
    ]);
    expect(en.alternates('/products/mug', [])).toEqual([]);
  });

  it('rejects paths that are not logical paths', () => {
    expect(() => en.href('products/mug')).toThrow(/logical path/);
  });
});

describe('LocaleUrls, standalone and other strategies', () => {
  it('works at the root mount', () => {
    expect(urls('it', {}, '').home()).toBe('/it/');
    expect(urls('en', {}, '').home()).toBe('/');
    expect(urls('it', {}, '').href('/api/cart')).toBe('/api/cart?lang=it');
  });

  it('query strategy: carries the parameter and replaces a stale one', () => {
    const q = urls('it', { routing: 'query' });
    expect(q.cart()).toBe('/shop/cart?lang=it');
    expect(q.search('uke')).toBe('/shop/search?q=uke&lang=it');
    expect(q.href('/cart?lang=en')).toBe('/shop/cart?lang=it');
    expect(q.href('/cart', { locale: 'en' })).toBe('/shop/cart');
    expect(q.href('/api/products')).toBe('/shop/api/products?lang=it');
    expect(q.href('/api/products?lang=en', { locale: 'en' })).toBe('/shop/api/products');
  });

  it('domain strategy: absolute URLs across hosts', () => {
    const over = { routing: 'domain' as const, domains: { en: 'monopolele.com', it: 'monopolele.it' } };
    const en = urls('en', over, '');
    expect(en.cart()).toBe('/cart');
    expect(en.href('/cart', { locale: 'it' })).toBe('https://monopolele.it/cart');
    expect(en.absolute('/cart')).toBe('https://monopolele.com/cart');
  });
});

describe('hreflangTag', () => {
  it('uses BCP 47 casing', () => {
    expect(hreflangTag('it')).toBe('it');
    expect(hreflangTag('pt-br')).toBe('pt-BR');
    expect(hreflangTag('zh-hant-tw')).toBe('zh-Hant-TW');
  });
});
