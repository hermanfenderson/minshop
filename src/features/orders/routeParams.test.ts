import { describe, expect, it } from 'vitest';
import { orderRouteParams } from './routeParams';

describe('orderRouteParams', () => {
  it('keeps the params Astro gives', () => {
    expect(orderRouteParams({ token: 'otk_a', receiptPublicId: 'rcpt_b' }, '/x')).toEqual({ token: 'otk_a', sub: 'rcpt_b' });
  });

  it('reads them from a language-prefixed path when Astro gives none', () => {
    expect(orderRouteParams({}, '/it/support/order/otk_a/receipt/rcpt_b')).toEqual({ token: 'otk_a', sub: 'rcpt_b' });
    expect(orderRouteParams({}, '/it/support/order/otk_a/download/oit_c/')).toEqual({ token: 'otk_a', sub: 'oit_c' });
    expect(orderRouteParams({}, '/it/order/otk_a/status')).toEqual({ token: 'otk_a', sub: undefined });
    expect(orderRouteParams({}, '/it/support/cart')).toEqual({ token: undefined, sub: undefined });
  });
});
