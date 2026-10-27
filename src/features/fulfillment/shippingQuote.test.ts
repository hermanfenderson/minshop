import { describe, expect, it } from 'vitest';
import { buyerShippingCents, combineShippingOptions, parseSurchargePct } from './shippingQuote';

describe('buyerShippingCents', () => {
  it('adds the surcharge and rounds up to the next 50 cents', () => {
    expect(buyerShippingCents(449, 22)).toBe(550); // 5.48 → 5.50
    expect(buyerShippingCents(1253, 22)).toBe(1550); // 15.29 → 15.50
    expect(buyerShippingCents(410, 22)).toBe(550); // 5.002 → 5.50, never under cost
    expect(buyerShippingCents(500, 0)).toBe(500);
    expect(buyerShippingCents(1000, 0)).toBe(1000); // already on a step: unchanged
  });
});

describe('parseSurchargePct', () => {
  it('defaults to 22 and ignores nonsense', () => {
    expect(parseSurchargePct(null)).toBe(22);
    expect(parseSurchargePct('')).toBe(22);
    expect(parseSurchargePct('10')).toBe(10);
    expect(parseSurchargePct('-5')).toBe(22);
    expect(parseSurchargePct('abc')).toBe(22);
  });
});

describe('combineShippingOptions', () => {
  const zone = [
    { label: 'Standard', amountCents: 500 },
    { label: 'Express', amountCents: 1200 },
  ];

  it('prices a cart the fulfiller ships alone at its rate, under the zone label', () => {
    expect(combineShippingOptions(zone, 550, true)).toEqual([{ label: 'Standard', amountCents: 550 }]);
  });

  it('adds the fulfiller to what the shop ships itself', () => {
    expect(combineShippingOptions(zone, 550, false)).toEqual([
      { label: 'Standard', amountCents: 1050 },
      { label: 'Express', amountCents: 1750 },
    ]);
  });

  it('keeps a free option free and drops pickup', () => {
    const options = [
      { label: 'Free shipping', amountCents: 0 },
      { label: 'Pickup', amountCents: 0, pickup: true },
      { label: 'Standard', amountCents: 500 },
    ];
    expect(combineShippingOptions(options, 550, true)).toEqual([
      { label: 'Free shipping', amountCents: 0 },
      { label: 'Standard', amountCents: 550 },
    ]);
    expect(combineShippingOptions([{ label: 'Pickup', amountCents: 0, pickup: true }], 550, true)).toEqual([]);
  });
});
