import { describe, expect, it } from 'vitest';
import { stripeCheckoutLocale } from './stripeLocale';

describe('stripeCheckoutLocale', () => {
  it('passes the languages Stripe renders', () => {
    expect(stripeCheckoutLocale('it')).toBe('it');
    expect(stripeCheckoutLocale('en')).toBe('en');
    expect(stripeCheckoutLocale('pt-br')).toBe('pt-BR');
    expect(stripeCheckoutLocale('es-419')).toBe('es-419');
  });

  it('falls back to the base language, then to auto', () => {
    expect(stripeCheckoutLocale('it-ch')).toBe('it');
    expect(stripeCheckoutLocale('ca')).toBe('auto');
    expect(stripeCheckoutLocale(null)).toBe('auto');
    expect(stripeCheckoutLocale(undefined)).toBe('auto');
  });
});
