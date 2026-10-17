import { describe, expect, it } from 'vitest';
import { countryName, countryOptions } from './countries';

describe('country names', () => {
  it('names countries in English by default', () => {
    expect(countryName('it')).toBe('Italy');
    expect(countryName('DE')).toBe('Germany');
  });

  it('names countries in the given language', () => {
    expect(countryName('DE', 'it')).toBe('Germania');
    expect(countryName('US', 'it')).toBe('Stati Uniti');
  });

  it('sorts the picker in the given language', () => {
    const it = countryOptions('it').map((c) => c.name);
    expect(it.indexOf('Germania')).toBeLessThan(it.indexOf('Italia'));
    expect(countryOptions().some((c) => c.name === 'Germany')).toBe(true);
  });
});
