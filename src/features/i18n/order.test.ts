import { describe, expect, it } from 'vitest';
import { LEGACY_ORDER_LOCALE, acceptedLocale, orderLocale } from './order';

describe('orderLocale', () => {
  it('uses the language stored on the order', () => {
    expect(orderLocale('it')).toBe('it');
    expect(orderLocale('IT')).toBe('it');
  });

  it('gives orders from before 0040 a stable fallback: English, not the store default', () => {
    expect(LEGACY_ORDER_LOCALE).toBe('en');
    expect(orderLocale(null)).toBe('en');
    expect(orderLocale(undefined)).toBe('en');
    expect(orderLocale('xx')).toBe('en');
    expect(orderLocale('not a code')).toBe('en');
  });
});

describe('acceptedLocale (public endpoints)', () => {
  it('accepts only supported, enabled languages', () => {
    expect(acceptedLocale('it', ['en', 'it'])).toBe('it');
    expect(acceptedLocale('IT', ['en', 'it'])).toBe('it');
    expect(acceptedLocale('it', ['en'])).toBeNull();
    expect(acceptedLocale('de', ['en', 'de'])).toBeNull(); // no catalog
    expect(acceptedLocale('../it', ['en', 'it'])).toBeNull();
    expect(acceptedLocale(42, ['en', 'it'])).toBeNull();
    expect(acceptedLocale(undefined, ['en', 'it'])).toBeNull();
  });
});
