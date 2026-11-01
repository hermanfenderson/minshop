import { describe, expect, it } from 'vitest';
import { paymentIntentFor, refusedSuffix } from './stripe';

const base = { lineItems: [], successUrl: 'https://x/ok', cancelUrl: 'https://x/ko' };

describe('paymentIntentFor', () => {
  it('marks the payment with the shop and the order', () => {
    expect(
      paymentIntentFor({ ...base, channel: "L'Altracittà", statementSuffix: 'LALTRACITTA', metadata: { public_id: 'abc' } }, true),
    ).toEqual({
      description: "L'Altracittà · abc",
      metadata: { shop: "L'Altracittà", order: 'abc' },
      statement_descriptor_suffix: 'LALTRACITTA',
    });
  });
  it('leaves the suffix out on the retry, and everything out without a channel', () => {
    expect(paymentIntentFor({ ...base, channel: 'Festival', statementSuffix: 'FESTIVAL' }, false)).toEqual({
      description: 'Festival',
      metadata: { shop: 'Festival' },
    });
    expect(paymentIntentFor(base, true)).toBeNull();
  });
});

describe('refusedSuffix', () => {
  it('recognises only Stripe refusing the descriptor', () => {
    expect(refusedSuffix({ type: 'StripeInvalidRequestError', param: 'payment_intent_data[statement_descriptor_suffix]' })).toBe(true);
    expect(refusedSuffix({ type: 'StripeInvalidRequestError', param: 'line_items' })).toBe(false);
    expect(refusedSuffix(new Error('network'))).toBe(false);
  });
});
