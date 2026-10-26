import { describe, expect, it } from 'vitest';
import { pendingOrderState } from './pendingState';

describe('pendingOrderState', () => {
  it('waits for the webhook while the checkout is open or just settled', () => {
    expect(pendingOrderState('active')).toBe('confirming');
    expect(pendingOrderState('settled')).toBe('confirming');
    expect(pendingOrderState(null)).toBe('confirming');
  });

  it('says a delayed payment is still clearing', () => {
    expect(pendingOrderState('payment_pending')).toBe('processing');
  });

  it('never claims success for a payment that is not coming', () => {
    expect(pendingOrderState('failed')).toBe('failed');
    expect(pendingOrderState('expired')).toBe('expired');
    expect(pendingOrderState('released')).toBe('expired');
  });
});
