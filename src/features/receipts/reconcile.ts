/**
 * What an order's receipts must become after refunds (R11). Pure: given the
 * receipts that are still in force and what the order now keeps, it lists the
 * documents to issue. The caller numbers and stores them.
 *
 * A receipt is never edited. When the kept amount drops below a receipt's, a
 * refund note cancels that receipt and, unless nothing is left, a new receipt
 * replaces it for the rest; a full refund therefore leaves the note alone.
 * When the kept amount rises (a recorded refund voided), a new receipt
 * replaces the old one with no note, since nothing was returned.
 *
 * Refunds come off the contribution first: shipping paid for a parcel that
 * was sent is a cost already incurred, so it is the last thing returned.
 */

export type ReceiptSeriesKind = 'donation' | 'shipping';

export interface LiveReceipt {
  id: number;
  kind: ReceiptSeriesKind;
  amountCents: number;
}

export interface OrderAmounts {
  totalCents: number;
  shippingCents: number;
  refundedCents: number;
}

export type ReceiptAction =
  | { type: 'issue'; kind: ReceiptSeriesKind; amountCents: number; issueKey: string; replaces: number | null }
  | { type: 'note'; amountCents: number; issueKey: string; cancels: number };

/** What each series should now say. */
export function keptAmounts(order: OrderAmounts): Record<ReceiptSeriesKind, number> {
  const shipping = Math.max(0, Math.min(order.shippingCents, order.totalCents));
  const contribution = order.totalCents - shipping;
  const refunded = Math.max(0, Math.min(order.refundedCents, order.totalCents));
  return {
    donation: Math.max(0, contribution - refunded),
    shipping: shipping - Math.max(0, refunded - contribution),
  };
}

/**
 * The documents to issue so the receipts in force match `order`.
 * `live` holds at most one receipt per kind: the latest that nothing has
 * cancelled or replaced. `lastNote` is, per kind, the latest note that left
 * that kind with no receipt, so a receipt issued after it has a key of its own.
 */
export function planReceipts(
  orderId: number,
  order: OrderAmounts,
  live: LiveReceipt[],
  lastNote: Partial<Record<ReceiptSeriesKind, number>> = {},
): ReceiptAction[] {
  const kept = keptAmounts(order);
  const actions: ReceiptAction[] = [];
  for (const kind of ['donation', 'shipping'] as const) {
    const current = live.find((r) => r.kind === kind) ?? null;
    const target = kept[kind];
    if (!current) {
      if (target <= 0) continue;
      // First receipt, or one after a full refund was undone.
      const after = lastNote[kind];
      actions.push({
        type: 'issue',
        kind,
        amountCents: target,
        issueKey: after == null ? `${kind}:${orderId}` : `${kind}:${orderId}:after-note:${after}`,
        replaces: null,
      });
      continue;
    }
    if (current.amountCents === target) continue;
    if (target < current.amountCents) {
      actions.push({
        type: 'note',
        amountCents: current.amountCents - target,
        issueKey: `refund_note:${current.id}`,
        cancels: current.id,
      });
    }
    if (target > 0) {
      actions.push({
        type: 'issue',
        kind,
        amountCents: target,
        issueKey: `${kind}:${orderId}:after:${current.id}`,
        replaces: current.id,
      });
    }
  }
  return actions;
}
