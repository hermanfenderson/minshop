import { describe, expect, it } from 'vitest';
import { freeDonationLast, suggestedFreeDonationCents } from './freeDonation';

const line = (id: string) => ({ product: { public_id: id } });

describe('freeDonationLast', () => {
  it('moves the free donation to the end and returns it', () => {
    const { lines, freeLine } = freeDonationLast([line('gra'), line('tee'), line('mug')], { public_id: 'gra' });
    expect(lines.map((l) => l.product.public_id)).toEqual(['tee', 'mug', 'gra']);
    expect(freeLine?.product.public_id).toBe('gra');
  });

  it('leaves the cart alone without one', () => {
    const cart = [line('tee'), line('mug')];
    expect(freeDonationLast(cart, { public_id: 'gra' })).toEqual({ lines: cart, freeLine: null });
    expect(freeDonationLast(cart, null)).toEqual({ lines: cart, freeLine: null });
  });
});

describe('suggestedFreeDonationCents', () => {
  it('starts at 10, or at the minimum when that is higher', () => {
    expect(suggestedFreeDonationCents(100, 'EUR')).toBe(1000);
    expect(suggestedFreeDonationCents(2500, 'EUR')).toBe(2500);
    expect(suggestedFreeDonationCents(100, 'JPY')).toBe(100);
  });
});
