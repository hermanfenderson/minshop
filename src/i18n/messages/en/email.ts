import type { Message } from '../../format.ts';

/**
 * Transactional email. HTML bodies insert these as written (no escaping of the
 * message itself), so keep them free of `<`, `>` and `&` unless they are markup.
 * `{param}` values are escaped where the email is HTML.
 */
export const email = {
  // Shared receipt lines and buttons
  'email.totals.shipping': 'Shipping',
  'email.totals.discount': 'Discount',
  'email.totals.tax': 'Tax',
  'email.totals.total': 'Total',
  'email.text.shipping': 'Shipping: {amount}',
  'email.text.discount': 'Discount: -{amount}',
  'email.text.tax': 'Tax: {amount}',
  'email.text.total': 'Total: {amount}',
  'email.text.viewOrder': 'View your order: {url}',
  'email.button.viewOrder': 'View your order',

  // Customer receipt
  'email.confirmation.subject': 'Your {store} order #{num}',
  'email.confirmation.heading': 'Thanks for your order',
  'email.confirmation.subheading': "Order #{num} is confirmed. We'll email you again when it ships.",
  'email.confirmation.textThanks': 'Thanks for your order!',
  'email.confirmation.textOrder': 'Order #{num}, {store}',
  'email.confirmation.downloadReady': 'Your download is ready.',
  'email.confirmation.footer': 'Questions about this order? Just reply to this email.',

  // Store-owner "new order" notification
  'email.notification.subject': 'New {store} order #{id}',
  'email.notification.heading': 'New order #{id}',
  'email.notification.subheading': '{amount} from {email}',
  'email.notification.unknownAddress': 'an unknown address',
  'email.notification.identifiers': 'Order identifiers',
  'email.notification.orderNumber': 'Order #{id}',
  'email.notification.shipTo': 'Ship to',
  'email.notification.viewInAdmin': 'View in admin',
  'email.notification.textHeading': 'New order #{id}',
  'email.notification.textPublicId': 'Public ID: {publicId}',
  'email.notification.textCustomer': 'Customer: {email}',
  'email.notification.textShipTo': 'Ship to:',
  'email.notification.textViewInAdmin': 'View in admin: {url}',

  // "Your order has shipped"
  'email.shipped.subject': 'Your {store} order #{num} has shipped',
  'email.shipped.heading': 'Your order is on its way',
  'email.shipped.subheading': 'Order #{num} shipped.',
  'email.shipped.tracking': 'Tracking',
  'email.shipped.trackPackage': 'Track your package',
  'email.shipped.orderDetails': 'Order details:',
  'email.shipped.textShipped': 'Your order #{num} has shipped!',
  'email.shipped.textCarrier': 'Carrier: {carrier}',
  'email.shipped.textTracking': 'Tracking: {number}',
  'email.shipped.textTrackIt': 'Track it: {url}',

  // Refund notice
  'email.refunded.subjectFull': 'Your {store} order #{num} has been refunded',
  'email.refunded.subjectPartial': 'A refund for your {store} order #{num}',
  'email.refunded.headingFull': 'Your order has been refunded',
  'email.refunded.headingPartial': 'A refund is on its way',
  'email.refunded.subheading': 'Order #{num}',
  'email.refunded.refund': 'Refund',
  'email.refunded.refunded': 'Refunded',
  'email.refunded.totalRefunded': 'Total refunded',
  'email.refunded.stillPaid': 'Still paid',
  'email.refunded.timingCard': 'Card refunds usually appear within 5-10 business days, depending on your bank.',
  'email.refunded.timingOther': 'The refund was sent back over the same payment method you used.',
  'email.refunded.textFull': 'Your order #{num} has been refunded.',
  'email.refunded.textPartial': 'A refund was issued for order #{num}.',
  'email.refunded.textRefunded': 'Refunded: {amount}',
  'email.refunded.textTotalSoFar': 'Total refunded so far: {amount}',
  'email.refunded.textStillPaid': 'Still paid: {amount}',

  // Guest-link reissue
  'email.reissue.subject': 'Your new {store} order link (#{num})',
  'email.reissue.heading': 'Your new order link',
  'email.reissue.subheading': 'A fresh link for order #{num}.',
  'email.reissue.body': 'Any links from earlier emails no longer work — use this one from now on.',
  'email.reissue.footer': "If you didn't ask for a new link, you can ignore this email.",
  'email.reissue.textIntro': 'Here is a fresh link to your {store} order #{num}.',
  'email.reissue.textBody': 'Any links from earlier emails no longer work — use this one from now on:',
  'email.reissue.textIgnore':
    "If you didn't ask for a new link, you can ignore this email; the new link\nstill shows your order as usual.",

  // Magic sign-in link
  'email.login.subject': 'Sign in to {store}',
  'email.login.heading': 'Sign in',
  'email.login.subheading': 'This link expires in 15 minutes and can only be used once.',
  'email.login.button': 'Sign in',
  'email.login.fallback': 'Button not working? Paste this into your browser:',
  'email.login.footer': "If you didn't request this, you can safely ignore this email.",
  'email.login.textIntro': 'Click to sign in to {store}:',
  'email.login.textExpiry': "This link expires in 15 minutes. If you didn't request it, ignore this email.",
} satisfies Record<`email.${string}`, Message>;
