import { describe, expect, it } from 'vitest';
import { RECEIPT_MANUAL_METHODS, isManualPaymentMethod, isReceivedOn, readManualPayment } from './manualPaymentMethod';

describe('manual payments', () => {
  it('knows its methods, and gives cash no receipt', () => {
    expect(isManualPaymentMethod('bank_transfer')).toBe(true);
    expect(isManualPaymentMethod('stripe')).toBe(false);
    expect(RECEIPT_MANUAL_METHODS).toContain('bank_transfer');
    expect(RECEIPT_MANUAL_METHODS).not.toContain('cash');
  });

  it('takes a real day that is not in the future', () => {
    expect(isReceivedOn('2027-02-28', '2027-03-01')).toBe(true);
    expect(isReceivedOn('2027-03-01', '2027-03-01')).toBe(true);
    expect(isReceivedOn('2027-03-02', '2027-03-01')).toBe(false);
    expect(isReceivedOn('2027-02-30', '2027-03-01')).toBe(false);
    expect(isReceivedOn('1/3/2027', '2027-03-01')).toBe(false);
  });

  it('reads what it stored and refuses anything else', () => {
    const p = { method: 'cheque', receivedOn: '2027-01-15', reference: 'N. 123', note: '' };
    expect(readManualPayment(JSON.stringify(p))).toEqual(p);
    expect(readManualPayment(JSON.stringify({ ...p, method: 'gold' }))).toBeNull();
    expect(readManualPayment('nope')).toBeNull();
    expect(readManualPayment(null)).toBeNull();
  });
});

