import { describe, expect, it } from 'vitest';
import {
  PRINTFUL_WEBHOOK_TYPES,
  PrintfulProvider,
  parsePrintfulEvent,
  pickStandardRate,
  printfulExternalId,
  printfulOrderPayload,
  printfulRatePayload,
  printfulShipments,
} from './printful';
import { fulfillmentWebhookKey } from './webhookKey';
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

describe('shipping quotes', () => {
  it('asks by catalog variant, with a stand-in region where Printful needs one', () => {
    const it_ = printfulRatePayload({ countryCode: 'it', currency: 'eur', lines: [{ rateRef: '8947', quantity: 2 }] });
    expect(it_).toEqual({ recipient: { country_code: 'IT' }, items: [{ variant_id: 8947, quantity: 2 }], currency: 'EUR' });
    expect(printfulRatePayload({ countryCode: 'US', currency: 'EUR', lines: [] }).recipient).toEqual({
      country_code: 'US',
      state_code: 'NY',
    });
  });

  it('takes the STANDARD rate in minor units', () => {
    const result = [
      { id: 'STANDARD_CARBON_OFFSET', rate: '4.77', currency: 'EUR' },
      { id: 'STANDARD', rate: '4.69', currency: 'EUR' },
    ];
    expect(pickStandardRate(result, 'EUR')).toBe(469);
    expect(pickStandardRate([{ id: 'FLAT', rate: '6.10', currency: 'EUR' }, { id: 'X', rate: '5.00', currency: 'EUR' }], 'EUR')).toBe(500);
    expect(pickStandardRate([{ id: 'STANDARD', rate: '4.69', currency: 'USD' }], 'EUR')).toBeNull();
    expect(pickStandardRate('Not found', 'EUR')).toBeNull();
  });

  it('reports a refusal or an outage as a failed quote', async () => {
    const refused = fakeFetch([[400, { error: { message: 'State code is missing' } }]]);
    expect(
      await new PrintfulProvider('t', refused.impl).quoteShipping({ countryCode: 'IT', currency: 'EUR', lines: [] }),
    ).toEqual({ ok: false, error: 'Printful 400: State code is missing' });
    const down = fakeFetch([new Error('timeout')]);
    expect(
      await new PrintfulProvider('t', down.impl).quoteShipping({ countryCode: 'IT', currency: 'EUR', lines: [] }),
    ).toMatchObject({ ok: false });
  });
});

// Shapes as Printful returns them (a real fulfilled order read on 2026-10-29, numbers changed).
const shippedOrder = {
  id: 162845412,
  status: 'fulfilled',
  shipments: [
    { id: 80307798, status: 'shipped', carrier: 'EVRI', service: 'Evri Shop to Home Standard', tracking_number: 'H06FXA0000000001', tracking_url: 'https://myorders.co/tracking/80307798/H06FXA0000000001', ship_date: '2026-06-17', shipped_at: 1781695963 },
    { id: 80307799, status: 'canceled', carrier: 'EVRI', service: null, tracking_number: 'X', tracking_url: null, ship_date: null, shipped_at: 0 },
    { id: 80307800, status: 'pending', carrier: null, service: null, tracking_number: '', tracking_url: '', ship_date: null, shipped_at: 0 },
  ],
};

describe('printfulShipments', () => {
  it('keeps the packages that left, with their own tracking page', () => {
    expect(printfulShipments(shippedOrder)).toEqual([
      {
        id: '80307798',
        carrier: 'EVRI',
        service: 'Evri Shop to Home Standard',
        trackingNumber: 'H06FXA0000000001',
        trackingUrl: 'https://myorders.co/tracking/80307798/H06FXA0000000001',
        shippedAt: new Date(1781695963 * 1000).toISOString(),
      },
    ]);
  });

  it('copes with no shipments and refuses non-https tracking links', () => {
    expect(printfulShipments({ status: 'draft' })).toEqual([]);
    expect(printfulShipments(null)).toEqual([]);
    const [s] = printfulShipments({ shipments: [{ id: 1, status: 'shipped', tracking_number: 'N', tracking_url: 'javascript:alert(1)', ship_date: '2026-06-01' }] });
    expect(s.trackingUrl).toBeNull();
    expect(s.shippedAt).toBe('2026-06-01');
  });
});

describe('parsePrintfulEvent', () => {
  it('reads the type and the order id, nothing else', () => {
    expect(parsePrintfulEvent({ type: 'package_shipped', data: { order: { id: 162845412 }, shipment: { id: 1 } } })).toEqual({
      type: 'package_shipped',
      providerOrderId: '162845412',
    });
    expect(parsePrintfulEvent({ type: 'product_synced', data: { sync_product: { id: 1 } } })).toEqual({ type: 'product_synced', providerOrderId: null });
    expect(parsePrintfulEvent('nope')).toBeNull();
  });
});

describe('PrintfulProvider read-back and webhook', () => {
  it('reads the order and its shipments', async () => {
    const calls: string[] = [];
    const provider = new PrintfulProvider('t', async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ code: 200, result: shippedOrder }), { status: 200 });
    });
    const read = await provider.getOrder('162845412');
    expect(calls).toEqual(['https://api.printful.com/orders/162845412']);
    expect(read.ok && read.order.status).toBe('fulfilled');
    expect(read.ok && read.order.shipments.map((s) => s.id)).toEqual(['80307798']);
  });

  it('marks Printful being busy as retryable', async () => {
    const provider = new PrintfulProvider('t', async () => new Response('{}', { status: 503 }));
    expect(await provider.getOrder('1')).toMatchObject({ ok: false, retryable: true });
  });

  it('registers one URL with the shipping and order events', async () => {
    let sent: { url: string; types: string[] } | null = null;
    const provider = new PrintfulProvider('t', async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ code: 200, result: {} }), { status: 200 });
    });
    expect(await provider.registerWebhook('https://shop.example/api/webhook/printful?k=abc')).toEqual({ ok: true });
    expect(sent!.url).toBe('https://shop.example/api/webhook/printful?k=abc');
    expect(sent!.types).toContain('package_shipped');
    expect(sent!.types).toEqual([...PRINTFUL_WEBHOOK_TYPES]);
  });
});

describe('fulfillmentWebhookKey', () => {
  it('is stable per secret and differs between secrets', async () => {
    const a = await fulfillmentWebhookKey('secret-a');
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(await fulfillmentWebhookKey('secret-a')).toBe(a);
    expect(await fulfillmentWebhookKey('secret-b')).not.toBe(a);
  });
});
