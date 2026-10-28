import type { Catalog } from '../../catalog.ts';

/**
 * Benefit Mode words: supporters do not buy and pay no price. They choose a
 * perk and give a contribution, from a minimum up. These replace the shop's
 * words (price, purchase, order, cart, checkout) wherever supporters see them,
 * emails included; the admin keeps its own.
 */
export const benefitVocabulary: Catalog = {
  'storefront.meta.description': 'Support {storeName}.',
  'storefront.cartDrawer.label': 'Your support',
  'storefront.cartDrawer.title': 'Your support',
  'storefront.cartDrawer.close': 'Close',
  'storefront.header.storeNav': 'Support',
  'storefront.header.cart': 'Your support',
  'storefront.nav.shop': 'Support',
  'storefront.nav.backToShop': 'Back to Support',
  'storefront.catalog.eyebrow': 'Support',
  'storefront.catalog.heading': 'Support the festival',
  'storefront.catalog.empty': 'No perks yet.',
  'storefront.category.empty': 'No perks in this category yet.',
  'storefront.product.priceFrom': 'Contribution from',
  'storefront.product.addToCart': 'Add contribution',
  'storefront.product.buyNow': 'Contribute now',
  'storefront.search.label': 'Search perks',
  'storefront.search.placeholder': 'Search perks…',
  'storefront.search.noResults': 'No perks match “{query}”. Try a different word.',

  'catalog.list.eyebrow': 'Support',
  'catalog.list.heading': 'Support the festival',
  'catalog.sort.price': 'Minimum contribution',

  'cart.page.title': 'Your support',
  'cart.page.heading': 'Your support',
  'cart.page.empty': "You haven't chosen how to support us yet.",
  'cart.page.continueShopping': 'Choose more perks',
  'cart.line.each': '{price} each',
  'cart.summary.subtotal': 'Total contribution',
  'cart.summary.unavailable': 'Contributions are currently unavailable.',
  'cart.drawer.checkout': 'Contribute',
  'cart.drawer.viewFullCart': 'View your support',

  'checkout.page.title': 'Complete your contribution',
  'checkout.page.heading': 'Complete your contribution',
  'checkout.page.summary': {
    one: 'Contribution {subtotal} · {count} choice',
    other: 'Contribution {subtotal} · {count} choices',
  },
  'checkout.shipping.optionTotal': '{price} · {total} in all',
  'checkout.shipping.errorMissingWeightItems':
    "We can't calculate shipping for {items} right now. Please contact us to complete your contribution.",
  'checkout.shipping.errorMissingWeight':
    "We can't calculate shipping for one of these perks right now. Please contact us to complete your contribution.",
  'checkout.shipping.errorOverweight': 'This parcel is too heavy for the available shipping services.',
  'checkout.shipping.errorCardNoShip': "Sorry, we can't ship perks to {country} with card payment.",
  'checkout.shipping.errorCardDestinations':
    'The configured shipping destinations are not supported by card payment. Please contact us to complete your contribution.',
  'checkout.error.lineShort': { other: 'Only {count} of {name} left — please adjust your choices.' },
  'checkout.error.cartShort': 'Some perks are no longer available in the quantity you chose. Please review your support.',
  'checkout.error.reservationFailed': 'Some perks just ran out — please review your support.',
  'checkout.error.productUnavailable': 'Perk unavailable',
  'checkout.express.description': 'Quick contribution.',
  'checkout.express.eyebrow': 'Quick contribution',
  'checkout.express.buyNow': 'Contribute now',
  'checkout.setup.back': 'Back to your support',
  'checkout.lightning.backToCart': 'Back to your support',
  'checkout.lightning.invoiceDescription': '{store} — contribution {ref}',
  'checkout.opennode.description': 'Contribution {ref}',

  'order.page.titleConfirmed': 'Contribution recorded',
  'order.page.titleConfirming': 'Recording your contribution',
  'order.confirmed.heading': 'Thank you! Your contribution is recorded.',
  'order.confirmed.reference': 'Contribution #{ref}',
  'order.confirmed.referenceWithReceipt': 'Contribution #{ref} · a confirmation is on its way to {email}',
  'order.confirmed.item': 'Choice',
  'order.confirmed.continueShopping': 'Choose more perks',
  'order.confirming.heading': 'Recording your contribution…',
  'order.confirming.body':
    "Your payment went through and we're recording your contribution. This page refreshes automatically — it usually takes just a few seconds.",
  'order.processing.body':
    'Your payment has been authorised and is being processed. Bank debits such as SEPA can take a few business days to clear: your contribution is recorded, and its confirmation emailed, as soon as the payment arrives. You can close this page.',
  'order.failed.body':
    "Your payment didn't go through, so no contribution was recorded and nothing will be charged. Your choices are still saved: you can try again, also with another payment method.",
  'order.expired.heading': 'Payment expired',
  'order.expired.body':
    "This payment wasn't completed in time, so no contribution was recorded. Your choices are still saved.",
  'order.pending.backToCart': 'Back to your support',
  'order.download.refunded': 'Downloads are unavailable for a fully refunded contribution.',

  'account.orders.heading': 'Your contributions',
  'account.orders.empty': 'No contributions yet.',
  'account.orders.startShopping': 'See how to support us',
  'account.orders.reference': 'Contribution #{ref}',
  'account.login.intro':
    "Enter your email and we'll send a sign-in link — no password needed. Use the address from your contributions to see their history.",

  'email.totals.discount': 'Reduction',
  'email.text.discount': 'Reduction: -{amount}',
  'email.text.viewOrder': 'View your contribution: {url}',
  'email.button.viewOrder': 'View your contribution',
  'email.confirmation.subject': 'Your contribution #{num} to {store}',
  'email.confirmation.heading': 'Thank you for your contribution',
  'email.confirmation.subheading':
    "Contribution #{num} is recorded. If you chose a perk to be shipped, we'll email you again when it leaves.",
  'email.confirmation.textThanks': 'Thank you for your contribution!',
  'email.confirmation.textOrder': 'Contribution #{num}, {store}',
  'email.confirmation.footer': 'Questions about this contribution? Just reply to this email.',
  'email.notification.subject': 'New contribution #{id} to {store}',
  'email.notification.heading': 'New contribution #{id}',
  'email.notification.identifiers': 'Contribution identifiers',
  'email.notification.orderNumber': 'Contribution #{id}',
  'email.notification.textHeading': 'New contribution #{id}',
  'email.shipped.subject': 'Your perks from {store} are on their way (#{num})',
  'email.shipped.heading': 'Your perks are on their way',
  'email.shipped.subheading': 'The perks of contribution #{num} have shipped.',
  'email.shipped.orderDetails': 'Contribution details:',
  'email.shipped.textShipped': 'The perks of your contribution #{num} have shipped!',
  'email.refunded.subjectFull': 'Your contribution #{num} to {store} has been refunded',
  'email.refunded.subjectPartial': 'A refund for your contribution #{num} to {store}',
  'email.refunded.headingFull': 'Your contribution has been refunded',
  'email.refunded.subheading': 'Contribution #{num}',
  'email.refunded.textFull': 'Your contribution #{num} has been refunded.',
  'email.refunded.textPartial': 'A refund was issued for contribution #{num}.',
  'email.reissue.subject': 'Your new {store} contribution link (#{num})',
  'email.reissue.heading': 'Your new contribution link',
  'email.reissue.subheading': 'A fresh link for contribution #{num}.',
  'email.reissue.textIntro': 'Here is a fresh link to your {store} contribution #{num}.',
  'email.reissue.textIgnore':
    "If you didn't ask for a new link, you can ignore this email; the new link\nstill shows your contribution as usual.",
  'email.paymentFailed.subheading':
    'Your bank could not complete the payment, so no contribution was recorded and nothing was charged.',
  'email.paymentFailed.textRetry': 'To try again, make the contribution once more: {url}',
  'email.paymentFailedOwner.explain':
    'The bank did not complete this delayed payment. No contribution was recorded and the perks are back in stock.',
  'email.paymentFailedOwner.view': 'See unfinished payments',

  'llms.intro':
    '{storeName} collects contributions online: supporters choose a perk and give a contribution, from a minimum up, also programmatically. All amounts are in {currency}. This file follows the llms.txt convention (https://llmstxt.org). Catalog and category links are live; an agent can complete a contribution via the JSON checkout endpoint under "For agents".',
  'llms.products': 'Perks',
  'llms.noProducts': '(no perks listed)',
};
