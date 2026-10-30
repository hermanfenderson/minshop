import type { Catalog } from '../../catalog.ts';

/**
 * Benefit Mode words: supporters do not buy and pay no price. They choose a
 * perk and make a donation, from a minimum up. These replace the shop's
 * words (price, purchase, order, cart, checkout) wherever supporters see them,
 * emails included; the admin keeps its own.
 */
export const benefitVocabulary: Catalog = {
  'storefront.meta.description': 'Support {storeName}.',
  'storefront.cartDrawer.label': 'Cart',
  'storefront.cartDrawer.title': 'Cart',
  'storefront.cartDrawer.close': 'Close',
  'storefront.header.storeNav': 'Support',
  'storefront.header.cart': 'Cart',
  'storefront.nav.shop': 'Support',
  'storefront.nav.backToShop': 'Back to Support',
  'storefront.catalog.eyebrow': 'Support',
  'storefront.catalog.heading': 'Support the festival',
  'storefront.catalog.empty': 'No perks yet.',
  'storefront.category.empty': 'No perks in this category yet.',
  'storefront.product.priceFrom': 'Minimum donation',
  'storefront.product.addToCart': 'Add to cart',
  'storefront.product.buyNow': 'Donate now',
  'storefront.search.label': 'Search perks',
  'storefront.search.placeholder': 'Search perks…',
  'storefront.search.noResults': 'No perks match “{query}”. Try a different word.',

  'catalog.list.eyebrow': 'Support',
  'catalog.list.heading': 'Support the festival',
  'catalog.sort.price': 'Minimum donation',

  'cart.page.title': 'Cart',
  'cart.page.heading': 'Cart',
  'cart.page.empty': "You haven't chosen how to support us yet.",
  'cart.page.continueShopping': 'Find out how',
  'cart.line.each': '{price} each',
  'cart.summary.subtotal': 'Total donation',
  'cart.summary.unavailable': 'Donations are currently unavailable.',
  'cart.drawer.checkout': 'Donate',
  'cart.drawer.viewFullCart': 'View cart',

  'checkout.page.title': 'Complete your donation',
  'checkout.page.heading': 'Complete your donation',
  'checkout.page.summary': {
    one: 'Donation {subtotal} · {count} choice',
    other: 'Donation {subtotal} · {count} choices',
  },
  'checkout.shipping.optionTotal': '{price} · {total} in all',
  'checkout.shipping.errorMissingWeightItems':
    "We can't calculate shipping for {items} right now. Please contact us to complete your donation.",
  'checkout.shipping.errorMissingWeight':
    "We can't calculate shipping for one of these perks right now. Please contact us to complete your donation.",
  'checkout.shipping.errorOverweight': 'This parcel is too heavy for the available shipping services.',
  'checkout.shipping.errorCardNoShip': "Sorry, we can't ship perks to {country} with card payment.",
  'checkout.shipping.errorCardDestinations':
    'The configured shipping destinations are not supported by card payment. Please contact us to complete your donation.',
  'checkout.error.lineShort': { other: 'Only {count} of {name} left — please adjust your choices.' },
  'checkout.error.cartShort': 'Some perks are no longer available in the quantity you chose. Please review your cart.',
  'checkout.error.reservationFailed': 'Some perks just ran out — please review your cart.',
  'checkout.error.productUnavailable': 'Perk unavailable',
  'checkout.express.description': 'Quick donation.',
  'checkout.express.eyebrow': 'Quick donation',
  'checkout.express.buyNow': 'Donate now',
  'checkout.setup.back': 'Back to cart',
  'checkout.lightning.backToCart': 'Back to cart',
  'checkout.lightning.invoiceDescription': '{store} — donation {ref}',
  'checkout.opennode.description': 'Donation {ref}',

  'order.page.titleConfirmed': 'Donation recorded',
  'order.page.titleConfirming': 'Recording your donation',
  'order.confirmed.heading': 'Thank you! Your donation is recorded.',
  'order.confirmed.reference': 'Donation #{ref}',
  'order.confirmed.referenceWithReceipt': 'Donation #{ref} · a confirmation is on its way to {email}',
  'order.confirmed.item': 'Choice',
  'order.confirmed.continueShopping': 'Choose more perks',
  'order.confirming.heading': 'Recording your donation…',
  'order.confirming.body':
    "Your payment went through and we're recording your donation. This page refreshes automatically — it usually takes just a few seconds.",
  'order.processing.body':
    'Your payment has been authorised and is being processed. Bank debits such as SEPA can take a few business days to clear: your donation is recorded, and its confirmation emailed, as soon as the payment arrives. You can close this page.',
  'order.failed.body':
    "Your payment didn't go through, so no donation was recorded and nothing will be charged. Your choices are still saved: you can try again, also with another payment method.",
  'order.expired.heading': 'Payment expired',
  'order.expired.body':
    "This payment wasn't completed in time, so no donation was recorded. Your choices are still saved.",
  'order.pending.backToCart': 'Back to cart',
  'order.download.refunded': 'Downloads are unavailable for a fully refunded donation.',

  'account.orders.heading': 'Your donations',
  'account.orders.empty': 'No donations yet.',
  'account.orders.startShopping': 'See how to support us',
  'account.orders.reference': 'Donation #{ref}',
  'account.login.intro':
    "Enter your email and we'll send a sign-in link — no password needed. Use the address from your donations to see their history.",

  'email.totals.discount': 'Reduction',
  'email.text.discount': 'Reduction: -{amount}',
  'order.confirmed.discount': 'Reduction',
  'email.text.viewOrder': 'View your donation: {url}',
  'email.button.viewOrder': 'View your donation',
  'email.confirmation.subject': 'Your donation #{num} to {store}',
  'email.confirmation.heading': 'Thank you for your donation',
  'email.confirmation.subheading':
    "Donation #{num} is recorded. If you chose a perk to be shipped, we'll email you again when it leaves.",
  'email.confirmation.textThanks': 'Thank you for your donation!',
  'email.confirmation.textOrder': 'Donation #{num}, {store}',
  'email.confirmation.footer': 'Questions about this donation? Just reply to this email.',
  'email.notification.subject': 'New donation #{id} to {store}',
  'email.notification.heading': 'New donation #{id}',
  'email.notification.identifiers': 'Donation identifiers',
  'email.notification.orderNumber': 'Donation #{id}',
  'email.notification.textHeading': 'New donation #{id}',
  'email.shipped.subject': 'Your perks from {store} are on their way (#{num})',
  'email.shipped.heading': 'Your perks are on their way',
  'email.shipped.subheading': 'The perks of donation #{num} have shipped.',
  'email.shipped.orderDetails': 'Donation details:',
  'email.shipped.textShipped': 'The perks of your donation #{num} have shipped!',
  'email.package.subject': 'A package of your perks from {store} is on its way (#{num})',
  'email.package.subheading': 'Some perks of donation #{num} have shipped.',
  'email.package.textShipped': 'A package with perks of your donation #{num} has shipped!',
  'email.package.lastOne': 'This is the last package: all your perks have shipped.',
  'email.refunded.subjectFull': 'Your donation #{num} to {store} has been refunded',
  'email.refunded.subjectPartial': 'A refund for your donation #{num} to {store}',
  'email.refunded.headingFull': 'Your donation has been refunded',
  'email.refunded.subheading': 'Donation #{num}',
  'email.refunded.textFull': 'Your donation #{num} has been refunded.',
  'email.refunded.textPartial': 'A refund was issued for donation #{num}.',
  'email.reissue.subject': 'Your new {store} donation link (#{num})',
  'email.reissue.heading': 'Your new donation link',
  'email.reissue.subheading': 'A fresh link for donation #{num}.',
  'email.reissue.textIntro': 'Here is a fresh link to your {store} donation #{num}.',
  'email.reissue.textIgnore':
    "If you didn't ask for a new link, you can ignore this email; the new link\nstill shows your donation as usual.",
  'email.paymentFailed.subheading':
    'Your bank could not complete the payment, so no donation was recorded and nothing was charged.',
  'email.paymentFailed.textRetry': 'To try again, make the donation once more: {url}',
  'email.paymentFailedOwner.explain':
    'The bank did not complete this delayed payment. No donation was recorded and the perks are back in stock.',
  'email.paymentFailedOwner.view': 'See unfinished payments',

  'llms.intro':
    '{storeName} collects donations online: supporters choose a perk and make a donation, from a minimum up, also programmatically. All amounts are in {currency}. This file follows the llms.txt convention (https://llmstxt.org). Catalog and category links are live; an agent can complete a donation via the JSON checkout endpoint under "For agents".',
  'llms.products': 'Perks',
  'llms.noProducts': '(no perks listed)',
};
