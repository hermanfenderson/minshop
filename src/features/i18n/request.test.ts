import { describe, expect, it } from 'vitest';
import { BUILTIN_LOCALES, resolveI18nSettings } from '../../i18n';
import { namesLanguage, preParsePath, requestLanguage } from './request';

const u = (p: string) => new URL(p, 'https://monopolele.com');

describe('preParsePath', () => {
  it('finds the logical path behind a language prefix and the mount', () => {
    expect(preParsePath('/it/shop/cart', '/shop', BUILTIN_LOCALES)).toBe('/cart');
    expect(preParsePath('/shop/cart', '/shop', BUILTIN_LOCALES)).toBe('/cart');
    expect(preParsePath('/it/shop', '/shop', BUILTIN_LOCALES)).toBe('/');
    expect(preParsePath('/it/', '', BUILTIN_LOCALES)).toBe('/');
  });

  it('is null outside the mount, including the host site\'s own /it/ pages', () => {
    expect(preParsePath('/it/chi-siamo', '/shop', BUILTIN_LOCALES)).toBeNull();
    expect(preParsePath('/blog', '/shop', BUILTIN_LOCALES)).toBeNull();
  });
});

describe('namesLanguage', () => {
  it('detects a prefix or a language parameter', () => {
    expect(namesLanguage(u('/it/shop/cart'), '/shop', BUILTIN_LOCALES, 'lang')).toBe(true);
    expect(namesLanguage(u('/shop/api/cart?lang=it'), '/shop', BUILTIN_LOCALES, 'lang')).toBe(true);
    expect(namesLanguage(u('/shop/api/cart'), '/shop', BUILTIN_LOCALES, 'lang')).toBe(false);
  });
});

describe('requestLanguage', () => {
  it('builds the translator and URLs for the request language', () => {
    const settings = resolveI18nSettings({ enabledLocales: ['en', 'it'] });
    const r = requestLanguage(settings, BUILTIN_LOCALES, '/shop', 'it', 'https://monopolele.com', {
      path: '/products/mug',
      search: '',
    });
    expect(r.locale).toBe('it');
    expect(r.i18n.t('common.pagination.next')).toBe('Successiva');
    expect(r.urls.cart()).toBe('/it/shop/cart');
    expect(r.urls.switchTo('en')).toBe('/shop/products/mug');
  });
});
