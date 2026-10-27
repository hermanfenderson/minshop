import { describe, expect, it } from 'vitest';
import { buildFulfillmentInput, type FulfillableOrder, type OrderLineRow } from './order';

const address = {
  name: 'Ada Lovelace',
  line1: 'Via Roma 1',
  line2: null,
  city: 'Monopoli',
  state: 'BA',
  postal: '70043',
  country: 'it',
};
const order: FulfillableOrder = {
  public_id: 'ord_abc',
  email: 'ada@example.com',
  currency: 'eur',
  ship_address: JSON.stringify(address),
};
const tee: OrderLineRow = { name: 'Tee', quantity: 1, price_cents: 2500, ref: '4011' };
const gratitude: OrderLineRow = { name: 'Gratitude', quantity: 1, price_cents: 1000, ref: null };

describe('buildFulfillmentInput', () => {
  it('sends only the lines linked to the fulfiller', () => {
    const built = buildFulfillmentInput(order, [tee, gratitude]);
    expect(built.kind).toBe('send');
    if (built.kind !== 'send') return;
    expect(built.input.lines).toEqual([{ ref: '4011', quantity: 1, unitPriceCents: 2500, name: 'Tee' }]);
    expect(built.input.currency).toBe('EUR');
    expect(built.input.recipient).toMatchObject({ countryCode: 'IT', address2: null, zip: '70043' });
  });

  it('has nothing to send for an order of the shop’s own items', () => {
    expect(buildFulfillmentInput(order, [gratitude]).kind).toBe('nothing');
  });

  it('stops for a person when the address cannot be shipped to', () => {
    expect(buildFulfillmentInput({ ...order, ship_address: null }, [tee])).toEqual({
      kind: 'blocked',
      reason: 'Shipping address incomplete: missing address',
    });
    const noZip = buildFulfillmentInput({ ...order, ship_address: JSON.stringify({ ...address, postal: ' ' }) }, [tee]);
    expect(noZip).toEqual({ kind: 'blocked', reason: 'Shipping address incomplete: missing postal' });
  });
});
