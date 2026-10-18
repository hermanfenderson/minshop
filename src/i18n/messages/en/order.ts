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
  'order.payment.card': 'Card',
  'order.payment.demo': 'Demo (no charge)',
  'order.downloads.heading': 'Downloads',
  'order.downloads.sizeKb': '{size} KB',
  'order.downloads.unavailableAfterRefund': 'Unavailable after refund',
  'order.downloads.download': 'Download',
  'order.confirming.heading': 'Confirming your order…',
  'order.confirming.body':
    "Your payment went through and we're recording your order. This page refreshes automatically — it usually takes just a few seconds.",

  // /order/<token>/download/<item> (plain-text refusals)
  'order.download.notFound': 'Not found',
  'order.download.unsettled': 'Payment is not settled.',
  'order.download.refunded': 'Downloads are unavailable for a fully refunded order.',
  'order.download.fileUnavailable': 'File unavailable',

  // Carriers that have no brand name of their own
  'order.carrier.other': 'Other',
} satisfies Record<`order.${string}`, Message>;
