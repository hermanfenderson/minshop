import { describe, expect, it } from 'vitest';
import { PrintfulProvider, printfulExternalId, printfulOrderPayload } from './printful';
import type { FulfillmentOrderInput } from './provider';

const input: FulfillmentOrderInput = {
  externalId: 'ord_8yq3ct0chs',
  currency: 'EUR',
  confirm: false,
  lines: [{ ref: '4011', quantity: 2, unitPriceCents: 2500, name: 'Tee — Black / M' }],
  recipient: {
    name: 'Ada Lovelace',
    address1: 'Via Roma 1',
    address2: null,
    city: 'Monopoli',
    stateCode: 'BA',
    countryCode: 'it',
    zip: '70043',
    email: 'ada@example.com',
  },
};

describe('printfulOrderPayload', () => {
  it('maps lines to sync variants with the retail price in major units', () => {
    const body = printfulOrderPayload(input);
    expect(body.external_id).toBe('ord_8yq3ct0chs');
    expect(body.items).toEqual([{ sync_variant_id: 4011, quantity: 2, retail_price: '25.00', name: 'Tee — Black / M' }]);
    expect(body.recipient).toMatchObject({ country_code: 'IT', zip: '70043', email: 'ada@example.com' });
  });

  it('sends a region only where Printful requires one', () => {
    expect(printfulOrderPayload(input).recipient).not.toHaveProperty('state_code');
    const us = printfulOrderPayload({ ...input, recipient: { ...input.recipient, countryCode: 'US', stateCode: 'CA' } });
    expect(us.recipient).toHaveProperty('state_code', 'CA');
  });

  it('fits legacy UUID public ids in 32 characters', () => {
    expect(printfulExternalId('123e4567-e89b-12d3-a456-426614174000')).toBe('123e4567e89b12d3a456426614174000');
  });
});

type Call = { url: string; method: string; body?: string };

function fakeFetch(responses: Array<[number, unknown] | Error>) {
  const calls: Call[] = [];
  const impl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body as string | undefined });
    const next = responses.shift();
    if (!next) throw new Error('unexpected call');
    if (next instanceof Error) throw next;
    return new Response(JSON.stringify(next[1]), { status: next[0] });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('PrintfulProvider.submitOrder', () => {
  it('creates a draft when no order has this external id yet', async () => {
    const { impl, calls } = fakeFetch([
      [404, { code: 404, result: 'Not found' }],
      [200, { code: 200, result: { id: 99, status: 'draft' } }],
    ]);
    const outcome = await new PrintfulProvider('t', impl).submitOrder(input);
    expect(outcome).toEqual({ ok: true, providerOrderId: '99', status: 'draft' });
    expect(calls[0].url).toBe('https://api.printful.com/orders/@ord_8yq3ct0chs');
    expect(calls[1].url).toBe('https://api.printful.com/orders?confirm=false');
    expect(calls[1].method).toBe('POST');
  });

  it('finds an order a lost answer already created instead of making another', async () => {
    const { impl, calls } = fakeFetch([[200, { code: 200, result: { id: 99, status: 'draft' } }]]);
    const outcome = await new PrintfulProvider('t', impl).submitOrder(input);
    expect(outcome).toEqual({ ok: true, providerOrderId: '99', status: 'draft' });
    expect(calls).toHaveLength(1);
  });

  it('asks for production only when told to confirm', async () => {
    const { impl, calls } = fakeFetch([[404, {}], [200, { result: { id: 1, status: 'pending' } }]]);
    await new PrintfulProvider('t', impl).submitOrder({ ...input, confirm: true });
    expect(calls[1].url).toBe('https://api.printful.com/orders?confirm=true');
  });

  it('retries outages and rate limits, not refusals', async () => {
    const refused = fakeFetch([[404, {}], [400, { error: { message: 'Invalid sync variant' } }]]);
    expect(await new PrintfulProvider('t', refused.impl).submitOrder(input)).toEqual({
      ok: false,
      retryable: false,
      error: 'Printful 400: Invalid sync variant',
    });
    const busy = fakeFetch([[429, {}]]);
    expect(await new PrintfulProvider('t', busy.impl).submitOrder(input)).toMatchObject({ ok: false, retryable: true });
    const down = fakeFetch([new Error('connection reset')]);
    expect(await new PrintfulProvider('t', down.impl).submitOrder(input)).toMatchObject({ ok: false, retryable: true });
  });
});
