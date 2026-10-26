/**
 * What the order page tells a buyer whose payment has not (yet) become an
 * order, from the checkout reservation behind their access link. Without it a
 * failed or still-clearing bank debit read "your payment went through" forever.
 */
export type PendingOrderState = 'confirming' | 'processing' | 'failed' | 'expired';

export function pendingOrderState(reservationStatus: string | null | undefined): PendingOrderState {
  switch (reservationStatus) {
    // Checkout completed with the money still in flight (SEPA and other
    // delayed methods): the order appears when the provider confirms.
    case 'payment_pending':
      return 'processing';
    case 'failed':
      return 'failed';
    // 'released' is what expiry and failure record when the reservation
    // lifecycle is off; either way no payment is coming.
    case 'expired':
    case 'released':
      return 'expired';
    // 'active' / 'settled' / no reservation: the webhook is about to land.
    default:
      return 'confirming';
  }
}
