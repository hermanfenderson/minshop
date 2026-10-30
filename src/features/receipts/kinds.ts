/**
 * The kinds of receipt document. No imports, so the D1 integration suite can
 * load it under plain Node.
 */
export type ReceiptKind = 'donation' | 'manual_donation' | 'shipping' | 'refund_note';

/** A contribution receipt, whether the shop collected the money or an admin recorded it. */
export const isContributionKind = (kind: string): kind is 'donation' | 'manual_donation' =>
  kind === 'donation' || kind === 'manual_donation';
