import { describe, expect, it } from 'vitest';
import {
  BUILTIN_LOCALES,
  createLocaleRegistry,
  fallbackChain,
  isSupportedLocale,
  normalizeLocaleCode,
} from './locales.ts';

describe('language codes', () => {
  it('normalizes to lowercase BCP 47', () => {
    expect(normalizeLocaleCode('IT')).toBe('it');
    expect(normalizeLocaleCode(' pt_BR ')).toBe('pt-br');
    expect(normalizeLocaleCode('zh-Hant-TW')).toBe('zh-hant-tw');
  });

  it('rejects malformed codes', () => {
    for (const bad of ['', 'i', 'italian', 'it-', '../it', 'it/x', 42, null, undefined]) {
      expect(normalizeLocaleCode(bad), String(bad)).toBeNull();
    }
  });
});

describe('registry', () => {
  it('bundles English and Italian', () => {
    expect(Object.keys(BUILTIN_LOCALES).sort()).toEqual(['en', 'it']);
    expect(BUILTIN_LOCALES.en.intl).toBe('en-US');
    expect(isSupportedLocale(BUILTIN_LOCALES, 'it')).toBe(true);
    expect(isSupportedLocale(BUILTIN_LOCALES, 'de')).toBe(false);
    expect(isSupportedLocale(BUILTIN_LOCALES, 'toString')).toBe(false);
  });

  it('lets a clone add or replace languages', () => {
    const registry = createLocaleRegistry({
      'pt_BR': { label: 'Português (Brasil)', intl: 'pt-BR', dir: 'ltr', fallback: ['PT'] },
      pt: { label: 'Português', intl: 'pt-PT', dir: 'ltr' },
      ar: { label: 'العربية', intl: 'ar', dir: 'rtl' },
    });
    expect(Object.keys(registry).sort()).toEqual(['ar', 'en', 'it', 'pt', 'pt-br']);
    expect(registry['pt-br'].fallback).toEqual(['pt']);
    expect(registry.ar.dir).toBe('rtl');
    expect(BUILTIN_LOCALES).not.toHaveProperty('pt'); // the built-ins are untouched
  });

  it('rejects malformed codes and unknown Intl tags at build time', () => {
    expect(() => createLocaleRegistry({ 'not a code': { label: 'x', intl: 'en', dir: 'ltr' } })).toThrow(
      /valid language code/,
    );
    expect(() => createLocaleRegistry({ xx: { label: 'x', intl: 'xx-QQ-invalid-tag', dir: 'ltr' } })).toThrow();
  });
});

describe('fallback chain', () => {
  const registry = createLocaleRegistry({
    pt: { label: 'Português', intl: 'pt-PT', dir: 'ltr' },
    'pt-br': { label: 'Português (Brasil)', intl: 'pt-BR', dir: 'ltr' },
    'de-ch': { label: 'Deutsch (Schweiz)', intl: 'de-CH', dir: 'ltr', fallback: ['it'] },
  });

  it('always ends with English', () => {
    expect(fallbackChain(registry, 'it')).toEqual(['it', 'en']);
    expect(fallbackChain(registry, 'en')).toEqual(['en']);
  });

  it('walks the base language and declared fallbacks', () => {
    expect(fallbackChain(registry, 'pt-br')).toEqual(['pt-br', 'pt', 'en']);
    expect(fallbackChain(registry, 'de-ch')).toEqual(['de-ch', 'it', 'en']);
  });

  it('adds the tail before English and skips duplicates and unknown codes', () => {
    expect(fallbackChain(registry, 'pt-br', ['it', 'pt', 'xx'])).toEqual(['pt-br', 'pt', 'it', 'en']);
    expect(fallbackChain(registry, 'xx')).toEqual(['en']);
  });
});
