import { describe, expect, it } from 'vitest';
import { resolveI18nSettings } from '../../i18n/settings';
import { BUILTIN_LOCALES } from '../../i18n/locales';
import { isCompleteTranslation, localizedLocales, pageSeo, translatedLocales } from './seo';

const monopolele = resolveI18nSettings({ defaultLocale: 'en', contentSourceLocale: 'en', enabledLocales: ['en', 'it'] });
// Monopolele's shape: /shop for English, /it/shop for Italian.
const absolute = (path: string, locale: string) =>
  `https://monopolele.example${locale === 'en' ? '' : `/${locale}`}/shop${path === '/' ? '/' : path}`;
const seo = (locale: string, available: 'all' | string[], settings = monopolele) =>
  pageSeo({ settings, registry: BUILTIN_LOCALES, locale, absolute, path: '/products/strap', available });

describe('pageSeo', () => {
  it('a translated page is self-canonical with reciprocal hreflang and x-default', () => {
    const en = seo('en', ['it']);
    const it_ = seo('it', ['it']);
    expect(it_.canonical).toBe('https://monopolele.example/it/shop/products/strap');
    expect(en.canonical).toBe('https://monopolele.example/shop/products/strap');
    const expected = [
      { hreflang: 'en', href: 'https://monopolele.example/shop/products/strap' },
      { hreflang: 'it', href: 'https://monopolele.example/it/shop/products/strap' },
      { hreflang: 'x-default', href: 'https://monopolele.example/shop/products/strap' },
    ];
    // Every version lists every version, itself included: reciprocal.
    expect(en.alternates).toEqual(expected);
    expect(it_.alternates).toEqual(expected);
    expect(it_.ogLocale).toBe('it_IT');
    expect(it_.ogLocaleAlternates).toEqual(['en_US']);
  });

  it('an untranslated Italian page canonicals to the original and claims no translation', () => {
    const it_ = seo('it', []);
    expect(it_.localized).toBe(false);
    expect(it_.canonical).toBe('https://monopolele.example/shop/products/strap');
    expect(it_.alternates).toEqual([]);
    expect(it_.ogLocaleAlternates).toEqual([]);
    expect(it_.contentLanguage).toBe('en');
    // …and the original does not list it either.
    expect(seo('en', []).alternates).toEqual([]);
  });

  it('interface pages exist in every enabled language', () => {
    expect(seo('it', 'all').alternates.map((a) => a.hreflang)).toEqual(['en', 'it', 'x-default']);
  });

  it('never names a disabled language, even if translations exist for it', () => {
    const single = resolveI18nSettings({ enabledLocales: ['en'] });
    expect(localizedLocales(single, ['it'])).toEqual(['en']);
    expect(seo('en', ['it'], single).alternates).toEqual([]);
  });

  it('a single-language store gets its canonical and nothing else', () => {
    const single = resolveI18nSettings();
    const s = seo('en', 'all', single);
    expect(s.canonical).toBe('https://monopolele.example/shop/products/strap');
    expect(s.alternates).toEqual([]);
    expect(s.localized).toBe(true);
  });

  it('omits x-default when the default language has no version', () => {
    const itDefault = resolveI18nSettings({ defaultLocale: 'it', contentSourceLocale: 'en', enabledLocales: ['it', 'en'] });
    // Not translated into the default (Italian): only the English original exists.
    expect(seo('en', [], itDefault).alternates).toEqual([]);
    expect(seo('it', [], itDefault).canonical).toBe('https://monopolele.example/shop/products/strap');
  });
});

describe('translation completeness', () => {
  const product = { name: 'Strap', description: 'Soft cotton.' };
  it('needs the main fields, not the secondary ones', () => {
    expect(isCompleteTranslation('product', product, { name: 'Tracolla', description: 'Cotone.' })).toBe(true);
    expect(isCompleteTranslation('product', product, { name: 'Tracolla', description: null })).toBe(false);
    expect(isCompleteTranslation('product', product, { name: null, description: 'Cotone.' })).toBe(false);
    expect(isCompleteTranslation('product', product, undefined)).toBe(false);
  });
  it('does not require a field the original leaves empty', () => {
    expect(isCompleteTranslation('product', { name: 'Strap', description: null }, { name: 'Tracolla' })).toBe(true);
    expect(isCompleteTranslation('page', { title: 'About', body_markdown: '' }, { title: 'Chi siamo' })).toBe(true);
  });
  it('counts a deliberately empty field as translated', () => {
    expect(isCompleteTranslation('product', product, { name: 'Tracolla', description: '' })).toBe(true);
  });
  it('lists the fully translated languages', () => {
    const rows = new Map([
      ['it', { name: 'Tracolla', description: 'Cotone.' }],
      ['de', { name: 'Riemen', description: null }],
    ]);
    expect(translatedLocales('product', product, rows)).toEqual(['it']);
  });
});
