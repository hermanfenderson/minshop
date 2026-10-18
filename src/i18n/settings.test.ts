import { describe, expect, it } from 'vitest';
import { createLocaleRegistry } from './locales.ts';
import {
  DEFAULT_I18N_SETTINGS,
  checkContentSourceChange,
  describeDefaultLocaleChange,
  resolveI18nSettings,
  validateI18nSettings,
  type I18nSettings,
} from './settings.ts';

const monopolele: I18nSettings = {
  ...DEFAULT_I18N_SETTINGS,
  defaultLocale: 'en',
  contentSourceLocale: 'it',
  enabledLocales: ['en', 'it'],
};

describe('resolveI18nSettings', () => {
  it('gives a store with no settings today\'s behavior', () => {
    expect(resolveI18nSettings()).toEqual(DEFAULT_I18N_SETTINGS);
    expect(resolveI18nSettings({})).toEqual({
      defaultLocale: 'en',
      contentSourceLocale: 'en',
      enabledLocales: ['en'],
      routing: 'prefix',
      prefixDefault: false,
      queryParam: 'lang',
      domains: {},
      detect: 'off',
      adminLocale: 'en',
    });
  });

  it('keeps the content source independent of the default', () => {
    const s = resolveI18nSettings(monopolele);
    expect(s.defaultLocale).toBe('en');
    expect(s.contentSourceLocale).toBe('it');
  });

  it('defaults the content source and admin language to the default language', () => {
    const s = resolveI18nSettings({ defaultLocale: 'it' });
    expect(s.contentSourceLocale).toBe('it');
    expect(s.adminLocale).toBe('it');
    expect(s.enabledLocales).toEqual(['it']);
  });

  it('normalizes codes, puts the default first, and drops what is unsupported', () => {
    const s = resolveI18nSettings({ defaultLocale: 'IT', enabledLocales: ['EN', 'it', 'xx', 'en'] });
    expect(s.enabledLocales).toEqual(['it', 'en']);
    expect(resolveI18nSettings({ defaultLocale: 'xx' }).defaultLocale).toBe('en');
  });

  it('never trusts unknown strategies or parameter names', () => {
    const s = resolveI18nSettings({ routing: 'cookie' as never, queryParam: '1 bad', detect: 'always' as never });
    expect(s.routing).toBe('prefix');
    expect(s.queryParam).toBe('lang');
    expect(s.detect).toBe('off');
  });

  it('keeps domains only for supported languages, lowercased', () => {
    const s = resolveI18nSettings({ domains: { IT: ' Shop.Example.IT ', xx: 'x.test' } });
    expect(s.domains).toEqual({ it: 'shop.example.it' });
  });
});

describe('validateI18nSettings', () => {
  const codes = (s: I18nSettings, opts = {}) => validateI18nSettings(s, opts).map((i) => i.code);

  it('accepts the Monopolele setup under /shop', () => {
    expect(validateI18nSettings(monopolele, { mount: '/shop' })).toEqual([]);
  });

  it('requires a supported, enabled default', () => {
    expect(codes({ ...monopolele, defaultLocale: 'de' })).toContain('default.unsupported');
    expect(codes({ ...monopolele, enabledLocales: ['it'] })).toContain('default.notEnabled');
    expect(codes({ ...monopolele, enabledLocales: [] })).toEqual(
      expect.arrayContaining(['enabled.empty', 'default.notEnabled']),
    );
  });

  it('rejects unsupported, duplicate, and unsupported reference languages', () => {
    expect(codes({ ...monopolele, enabledLocales: ['en', 'it', 'de'] })).toContain('enabled.unsupported');
    expect(codes({ ...monopolele, enabledLocales: ['en', 'it', 'IT'] })).toContain('enabled.duplicate');
    expect(codes({ ...monopolele, contentSourceLocale: 'de' })).toContain('contentSourceLocale.unsupported');
    expect(codes({ ...monopolele, adminLocale: 'de' })).toContain('adminLocale.unsupported');
  });

  it('keeps the domain strategy engine-only unless allowed', () => {
    const domain = { ...monopolele, routing: 'domain' as const, domains: { en: 'shop.example.com', it: 'shop.example.it' } };
    expect(codes(domain)).toEqual(['routing.domainUnavailable']);
    expect(codes(domain, { allowDomainRouting: true })).toEqual([]);
  });

  it('checks domains: one valid, unique host per enabled language', () => {
    const opts = { allowDomainRouting: true };
    const base = { ...monopolele, routing: 'domain' as const };
    expect(codes({ ...base, domains: { en: 'shop.example.com' } }, opts)).toEqual(['domain.missing']);
    expect(codes({ ...base, domains: { en: 'a.test', it: 'not a host' } }, opts)).toEqual(['domain.invalid']);
    expect(codes({ ...base, domains: { en: 'a.test', it: 'A.test' } }, opts)).toEqual(['domain.duplicate']);
  });

  it('stops a language prefix from shadowing reserved paths or the mount', () => {
    const registry = createLocaleRegistry({ api: { label: 'API', intl: 'en', dir: 'ltr' } });
    expect(codes({ ...monopolele, enabledLocales: ['en', 'it', 'api'] }, { registry })).toContain('prefix.reserved');
    expect(codes(monopolele, { mount: '/it' })).toContain('prefix.mount');
  });

  it('validates the query parameter name', () => {
    expect(codes({ ...monopolele, routing: 'query', queryParam: 'l ang' })).toEqual(['query.invalid']);
  });
});

describe('changing the reference languages', () => {
  it('flags a default-language change as a controlled procedure', () => {
    const change = describeDefaultLocaleChange(monopolele, { ...monopolele, defaultLocale: 'it' });
    expect(change).toEqual({
      from: 'en',
      to: 'it',
      requiresProcedure: true,
      effects: ['unprefixedUrlsChangeLanguage', 'previousDefaultGetsPrefix', 'cachePurgeRequired', 'sitemapAndHreflangChange'],
    });
  });

  it('notes when content stays in a source language other than the new default', () => {
    const change = describeDefaultLocaleChange(
      { ...monopolele, contentSourceLocale: 'en' },
      { ...monopolele, contentSourceLocale: 'en', defaultLocale: 'it', routing: 'query' },
    );
    expect(change?.effects).toEqual([
      'unprefixedUrlsChangeLanguage',
      'previousDefaultGetsParam',
      'cachePurgeRequired',
      'sitemapAndHreflangChange',
      'contentStaysInSourceLanguage',
    ]);
  });

  it('reports no change when the default stays', () => {
    expect(describeDefaultLocaleChange(monopolele, { ...monopolele, enabledLocales: ['en'] })).toBeNull();
  });

  it('lets the content source be relabeled only without colliding translations', () => {
    const next = { ...monopolele, contentSourceLocale: 'en' };
    expect(checkContentSourceChange(monopolele, next, [])).toBeNull();
    expect(checkContentSourceChange(monopolele, next, ['de'])).toBeNull();
    expect(checkContentSourceChange(monopolele, next, ['en'])?.code).toBe('contentSource.hasTranslations');
    expect(checkContentSourceChange(monopolele, monopolele, ['it', 'en'])).toBeNull();
  });
});
