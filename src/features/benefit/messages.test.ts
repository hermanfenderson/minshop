import { describe, expect, it } from 'vitest';
import { contributionError } from './messages';

const i18n = {
  t: (key: string, params?: Record<string, string | number>) => `${key}${params ? ` ${JSON.stringify(params)}` : ''}`,
  money: (minor: number, currency: string) => `${minor / 100} ${currency}`,
};
const line = { name: 'Tee', minimumCents: 2000, capCents: 1_000_000, currency: 'EUR' };

describe('contributionError', () => {
  it('names the line and the limit it missed', () => {
    expect(contributionError(i18n, 'below_minimum', line)).toBe('benefit.error.belowMinimum {"name":"Tee","price":"20 EUR"}');
    expect(contributionError(i18n, 'above_maximum', line)).toBe('benefit.error.aboveMaximum {"name":"Tee","price":"10000 EUR"}');
    expect(contributionError(i18n, 'precision', line)).toBe('benefit.error.precision');
    expect(contributionError(i18n, 'invalid', line)).toBe('benefit.error.invalid');
  });
});
