import { describe, it, expect } from 'vitest';
import {
  currencyDecimals,
  formatMoney,
  formatNumber,
  minorUnitsPerMajor,
  toMinorUnits,
  toMajorUnits,
} from './money';

describe('currency scaling', () => {
  it('knows decimal places per currency (ISO 4217)', () => {
    expect(currencyDecimals('usd')).toBe(2);
    expect(currencyDecimals('eur')).toBe(2);
    expect(currencyDecimals('gbp')).toBe(2);
    expect(currencyDecimals('jpy')).toBe(0); // zero-decimal
    expect(currencyDecimals('krw')).toBe(0); // zero-decimal
    expect(currencyDecimals('bhd')).toBe(3); // three-decimal
    expect(currencyDecimals('kwd')).toBe(3);
  });

  it('is case-insensitive on the currency code', () => {
    expect(currencyDecimals('USD')).toBe(2);
    expect(minorUnitsPerMajor('JPY')).toBe(1);
  });

  it('derives minor units per major from the decimals', () => {
    expect(minorUnitsPerMajor('usd')).toBe(100);
    expect(minorUnitsPerMajor('jpy')).toBe(1);
    expect(minorUnitsPerMajor('bhd')).toBe(1000);
  });

  it('converts major → minor scaled by currency', () => {
    expect(toMinorUnits(19.99, 'usd')).toBe(1999);
    expect(toMinorUnits(1000, 'jpy')).toBe(1000); // not 100000
    expect(toMinorUnits(2.5, 'bhd')).toBe(2500);
  });

  it('rounds half-cent inputs rather than truncating', () => {
    expect(toMinorUnits(0.1 + 0.2, 'usd')).toBe(30); // 0.30000000000000004 → 30
    expect(toMinorUnits(19.005, 'usd')).toBe(1901); // round, not floor
  });

  it('converts minor → major scaled by currency', () => {
    expect(toMajorUnits(1999, 'usd')).toBe(19.99);
    expect(toMajorUnits(1000, 'jpy')).toBe(1000); // yen has no sub-unit
    expect(toMajorUnits(2500, 'bhd')).toBe(2.5);
  });

  it('round-trips major → minor → major for each currency class', () => {
    for (const [amount, cur] of [
      [19.99, 'usd'],
      [1000, 'jpy'],
      [2.5, 'bhd'],
    ] as const) {
      expect(toMajorUnits(toMinorUnits(amount, cur), cur)).toBe(amount);
    }
  });

  it('falls back to 2 decimals for an unknown currency code', () => {
    expect(currencyDecimals('zzz')).toBe(2);
  });
});

describe('localized formatting', () => {
  it('keeps the en-US output when no locale is given', () => {
    expect(formatMoney(1999, 'usd')).toBe('$19.99');
    expect(formatMoney(1999, 'eur')).toBe('€19.99');
    expect(formatMoney(1000, 'jpy')).toBe('¥1,000');
  });

  it('formats prices in the given Intl locale', () => {
    // Intl separates the amount and the symbol with a no-break space.
    expect(formatMoney(123456, 'eur', 'it-IT')).toBe('1234,56 €');
    expect(formatMoney(1999, 'eur', 'de-DE')).toBe('19,99 €');
    expect(formatMoney(1000, 'jpy', 'ja-JP')).toBe('￥1,000');
    expect(formatMoney(2500, 'bhd', 'en-US')).toBe('BHD 2.500');
  });

  it('caches per locale and currency without mixing them up', () => {
    expect(formatMoney(100, 'eur', 'it-IT')).toBe('1,00 €');
    expect(formatMoney(100, 'eur')).toBe('€1.00');
    expect(formatMoney(100, 'usd', 'it-IT')).toBe('1,00 USD');
  });

  it('formats plain numbers in a locale, with options', () => {
    expect(formatNumber(1234.5)).toBe('1,234.5');
    expect(formatNumber(1234.5, 'it-IT')).toBe('1234,5');
    expect(formatNumber(12345.5, 'it-IT')).toBe('12.345,5');
    expect(formatNumber(0.25, 'it-IT', { style: 'percent' })).toBe('25%');
  });
});
