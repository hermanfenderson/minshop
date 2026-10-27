import { describe, expect, it } from 'vitest';
import { keptAmounts, planReceipts } from './reconcile';

const order = (refundedCents: number, shippingCents = 750) => ({ totalCents: 4750, shippingCents, refundedCents });

describe('keptAmounts', () => {
  it('takes refunds off the contribution first', () => {
    expect(keptAmounts(order(0))).toEqual({ donation: 4000, shipping: 750 });
    expect(keptAmounts(order(1000))).toEqual({ donation: 3000, shipping: 750 });
    expect(keptAmounts(order(4250))).toEqual({ donation: 0, shipping: 500 });
    expect(keptAmounts(order(4750))).toEqual({ donation: 0, shipping: 0 });
  });

  it('never goes negative on bad input', () => {
    expect(keptAmounts({ totalCents: 1000, shippingCents: 2000, refundedCents: 5000 })).toEqual({ donation: 0, shipping: 0 });
  });
});

describe('planReceipts', () => {
  it('issues the first receipts of a paid order', () => {
    expect(planReceipts(7, order(0), [])).toEqual([
      { type: 'issue', kind: 'donation', amountCents: 4000, issueKey: 'donation:7', replaces: null },
      { type: 'issue', kind: 'shipping', amountCents: 750, issueKey: 'shipping:7', replaces: null },
    ]);
    expect(planReceipts(7, order(0, 0), [])).toEqual([
      { type: 'issue', kind: 'donation', amountCents: 4750, issueKey: 'donation:7', replaces: null },
    ]);
  });

  it('does nothing when the receipts already match', () => {
    const live = [
      { id: 1, kind: 'donation' as const, amountCents: 4000 },
      { id: 2, kind: 'shipping' as const, amountCents: 750 },
    ];
    expect(planReceipts(7, order(0), live)).toEqual([]);
  });

  it('answers a partial refund with a note and a replacement receipt', () => {
    const live = [
      { id: 1, kind: 'donation' as const, amountCents: 4000 },
      { id: 2, kind: 'shipping' as const, amountCents: 750 },
    ];
    expect(planReceipts(7, order(1500), live)).toEqual([
      { type: 'note', amountCents: 1500, issueKey: 'refund_note:1', cancels: 1 },
      { type: 'issue', kind: 'donation', amountCents: 2500, issueKey: 'donation:7:after:1', replaces: 1 },
    ]);
  });

  it('answers a full refund with notes only', () => {
    const live = [
      { id: 3, kind: 'donation' as const, amountCents: 2500 },
      { id: 2, kind: 'shipping' as const, amountCents: 750 },
    ];
    expect(planReceipts(7, order(4750), live)).toEqual([
      { type: 'note', amountCents: 2500, issueKey: 'refund_note:3', cancels: 3 },
      { type: 'note', amountCents: 750, issueKey: 'refund_note:2', cancels: 2 },
    ]);
  });

  it('reissues without a note when a recorded refund is voided', () => {
    const live = [{ id: 3, kind: 'donation' as const, amountCents: 2500 }];
    expect(planReceipts(7, order(0, 0), live)).toEqual([
      { type: 'issue', kind: 'donation', amountCents: 4750, issueKey: 'donation:7:after:3', replaces: 3 },
    ]);
    // After a full refund there is nothing in force; the new receipt keys off the last note.
    expect(planReceipts(7, order(0, 0), [], { donation: 9 })).toEqual([
      { type: 'issue', kind: 'donation', amountCents: 4750, issueKey: 'donation:7:after-note:9', replaces: null },
    ]);
  });
});
