import { describe, expect, it } from 'vitest';
import { negotiateLocale, parseAcceptLanguage } from './negotiate';

describe('parseAcceptLanguage', () => {
  it('orders ranges by weight, keeping header order on ties', () => {
    expect(parseAcceptLanguage('it-IT,it;q=0.9,en;q=0.8,de;q=0.9')).toEqual([
      { tag: 'it-it', q: 1 },
      { tag: 'it', q: 0.9 },
      { tag: 'de', q: 0.9 },
      { tag: 'en', q: 0.8 },
    ]);
  });

  it('drops wildcards, zero weights and garbage', () => {
    expect(parseAcceptLanguage('*;q=0.5, fr;q=0, en;q=abc, <script>, , es')).toEqual([{ tag: 'es', q: 1 }]);
    expect(parseAcceptLanguage(null)).toEqual([]);
    expect(parseAcceptLanguage('')).toEqual([]);
  });

  it('bounds the work on huge headers', () => {
    expect(parseAcceptLanguage(Array(500).fill('en').join(',')).length).toBe(20);
  });
});

describe('negotiateLocale', () => {
  it('matches exactly, then by base language, then a regional variant', () => {
    expect(negotiateLocale('it', ['en', 'it'])).toBe('it');
    expect(negotiateLocale('it-CH,de;q=0.5', ['en', 'it'])).toBe('it');
    expect(negotiateLocale('pt', ['en', 'pt-br'])).toBe('pt-br');
  });

  it('honors weights and returns null when nothing is enabled', () => {
    expect(negotiateLocale('de,it;q=0.8,en;q=0.9', ['en', 'it'])).toBe('en');
    expect(negotiateLocale('de,fr', ['en', 'it'])).toBeNull();
    expect(negotiateLocale(undefined, ['en'])).toBeNull();
  });
});
