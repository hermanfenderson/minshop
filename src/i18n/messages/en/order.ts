import type { Message } from '../../format.ts';

export const order = {
  // /order/<token> (confirmation)
  'order.error.notFound': 'Not found',
  'order.page.titleConfirmed': 'Order confirmed',
  'order.page.titleConfirming': 'Confirming your order',
  'order.confirmed.heading': 'Thank you! Your order is confirmed.',
  'order.confirmed.reference': 'Order #{ref}',
  'order.confirmed.referenceWithReceipt': 'Order #{ref} · a receipt is on its way to {email}',
  'order.confirmed.item': 'Item',
  'order.confirmed.qty': 'Qty',
  'order.confirmed.lineTotal': 'Total',
  'order.confirmed.total': 'Total: {amount}',
  'order.confirmed.paidWith': 'Paid with {method}',
  'order.confirmed.refundedFull': 'Refunded {amount}.',
  'order.confirmed.refundedPartial': 'Refunded {amount} — {remaining} still paid.',
  'order.confirmed.continueShopping': 'Continue shopping',
  'order.payment.demo': 'Demo (no charge)',
  'order.downloads.heading': 'Downloads',
  'order.downloads.sizeKb': '{size} KB',
  'order.downloads.unavailableAfterRefund': 'Unavailable after refund',
  'order.downloads.download': 'Download',
  'order.confirming.heading': 'Confirming your order…',
  'order.confirming.body':
    "Your payment went through and we're recording your order. This page refreshes automatically — it usually takes just a few seconds.",
  'order.processing.heading': 'Payment processing',
  'order.processing.body': 'Your payment has been authorised and is being processed. Bank debits such as SEPA can take a few business days to clear: your order is confirmed, and its receipt emailed, as soon as the payment arrives. You can close this page.',
  'order.failed.heading': 'Payment not completed',
  'order.failed.body': "Your payment didn't go through, so no order was placed and nothing will be charged. Your cart is still saved: you can try again, also with another payment method.",
  'order.expired.heading': 'Checkout expired',
  'order.expired.body': "This payment wasn't completed in time, so no order was placed. Your cart is still saved.",
  'order.pending.backToCart': 'Back to cart',

  // /order/<token>/download/<item> (plain-text refusals)
  'order.download.notFound': 'Not found',
  'order.download.unsettled': 'Payment is not settled.',
  'order.download.refunded': 'Downloads are unavailable for a fully refunded order.',
  'order.download.fileUnavailable': 'File unavailable',

  // Carriers that have no brand name of their own
  'order.carrier.other': 'Other',
} satisfies Record<`order.${string}`, Message>;
