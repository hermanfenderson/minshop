import type { Message } from '../../format.ts';

export const checkout = {
  // Payment-method buttons on /cart and /express
  'checkout.method.stripe.label': 'Proceed to payment',
  'checkout.method.stripe.hint': 'Card, wallets, bank debit & more',
  'checkout.method.stripe.setup': 'Set up Stripe payments',
  'checkout.method.lightning.label': 'Pay with Lightning ⚡',
  'checkout.method.lightning.hint': 'Instant — from any Lightning wallet',
  'checkout.method.lightning.setup': 'Set up Lightning',
  'checkout.method.opennode.label': 'Pay with Bitcoin',
  'checkout.method.opennode.hint': 'On-chain or Lightning (OpenNode)',
  'checkout.method.opennode.setup': 'Set up OpenNode',
  'checkout.method.demo.label': 'Demo checkout',
  'checkout.method.demo.hint': 'Simulated — places a real test order, no charge',

  // /checkout (in-app address + shipping step)
  'checkout.page.title': 'Checkout',
  'checkout.page.description': 'Enter your shipping details.',
  'checkout.page.heading': 'Checkout',
  'checkout.page.summary': {
    one: 'Subtotal {subtotal} · {count} item',
    other: 'Subtotal {subtotal} · {count} items',
  },
  'checkout.demo.banner': '⚠️ Demo checkout — not a real payment',
  'checkout.demo.noticeCheckout':
    'No card is charged. Completing it places a real order tagged <code class="rounded bg-amber-100 px-1">demo</code> so you can see the full flow.',
  'checkout.address.email': 'Email',
  'checkout.address.fullName': 'Full name',
  'checkout.address.line1': 'Address',
  'checkout.address.line2': 'Apartment, suite, etc. (optional)',
  'checkout.address.city': 'City',
  'checkout.address.state': 'State / Province',
  'checkout.address.postal': 'Postal code',
  'checkout.address.country': 'Country',
  'checkout.address.shipsTo': 'Ships to: {countries}',
  'checkout.address.continue': 'Continue to shipping',
  'checkout.address.errorEmail': 'A valid email is required.',
  'checkout.address.errorName': 'Name is required.',
  'checkout.address.errorLine1': 'Address is required.',
  'checkout.address.errorCity': 'City is required.',
  'checkout.address.errorPostal': 'Postal code is required.',
  'checkout.address.errorCountry': 'Use a 2-letter country code (e.g. US).',
  'checkout.shipping.shipTo': 'Ship to',
  'checkout.shipping.editAddress': 'Edit address',
  'checkout.shipping.legend': 'Shipping',
  'checkout.shipping.free': 'Free',
  'checkout.shipping.optionTotal': '{price} · total {total}',
  /** The synthesized $0 option once a zone's free-shipping threshold is reached. */
  'checkout.shipping.freeShippingLabel': 'Free shipping',
  'checkout.shipping.errorChooseOption': 'Please choose a shipping option.',
  'checkout.shipping.errorMissingWeightItems':
    "We can't calculate shipping for {items} right now. Please contact us to complete this order.",
  'checkout.shipping.errorMissingWeight':
    "We can't calculate shipping for one of these items right now. Please contact us to complete this order.",
  'checkout.shipping.errorOverweight': 'This order is too heavy for the available shipping services.',
  'checkout.shipping.errorNoShip': "Sorry, we don't ship to {country} yet.",
  'checkout.shipping.errorCardNoShip': "Sorry, card checkout can't ship to {country}.",
  'checkout.shipping.errorCardDestinations':
    'The configured shipping destinations are not supported by card checkout. Please contact us to complete this order.',
  'checkout.rail.lightning': 'Pay with Lightning',
  'checkout.rail.opennode': 'Pay with Bitcoin',
  'checkout.rail.demo': 'Place demo order',

  // Checkout errors (shown on /checkout, or carried to /cart or the product page)
  'checkout.error.chooseVariant': 'Please choose a {label}.',
  'checkout.error.variantFallback': 'option',
  'checkout.error.soldOut': 'Sold out',
  'checkout.error.lineSoldOut': '{name} is sold out.',
  'checkout.error.lineShort': {
    other: 'Only {count} of {name} left — please adjust your cart.',
  },
  'checkout.error.cartShort':
    'Some items are no longer available in the quantity you selected. Please review your cart.',
  'checkout.error.reservationFailed': 'Some inventory just sold out — please review your cart.',
  'checkout.error.lightningUnavailable':
    'Lightning is temporarily unavailable. Please try again in a moment, or choose another payment method.',
  'checkout.error.methodUnavailable':
    'That payment method is temporarily unavailable. Please try again in a moment, or choose another.',
  'checkout.error.invalidProductId': 'Invalid product id (expected a prod_… public ID).',
  'checkout.error.productUnavailable': 'Product unavailable',

  // /express
  'checkout.express.description': 'Express checkout.',
  'checkout.express.eyebrow': 'Express checkout',
  'checkout.express.buyNow': 'Buy now',
  'checkout.express.qty': 'Qty {qty}',
  'checkout.express.total': 'Total',
  'checkout.express.shipTo': 'Ship to',
  'checkout.express.back': 'Back',

  // /payment-setup (owner-facing setup help reached from the cart)
  'checkout.setup.title': 'Set up payments',
  'checkout.setup.description': 'How to enable a payment method.',
  'checkout.setup.back': 'Back to cart',
  'checkout.setup.notConfigured':
    "This payment method isn't configured yet. Add a real rail (card or Lightning) in Admin → Settings → Payments, or keep using the Demo checkout to try the store.",
  'checkout.setup.demoNote':
    'In the meantime, <strong class="font-semibold">Demo checkout</strong> works right now — it places a real, demo-tagged order so you can see the full flow without charging anyone.',
  'checkout.setup.stripe.title': 'Set up card payments (Stripe)',
  'checkout.setup.stripe.intro': 'Accept Visa, Mastercard, Apple Pay and more via Stripe Checkout.',
  'checkout.setup.stripe.step1':
    'Create a Stripe account and grab your Secret key from dashboard.stripe.com/apikeys.',
  'checkout.setup.stripe.step2':
    'Paste it in Admin → Settings → Payment keys (Stripe secret key). It’s stored encrypted in your database.',
  'checkout.setup.stripe.step3':
    'Add a webhook endpoint in Stripe pointing at {url} (events: checkout.session.completed, checkout.session.async_payment_succeeded, and charge.refunded — the last one syncs refunds you make in the Stripe Dashboard back to your orders).',
  'checkout.setup.stripe.step4':
    'Paste the signing secret it gives you into Payment keys (Stripe webhook signing secret). The card button goes live automatically.',
  'checkout.setup.lightning.title': 'Set up Lightning payments',
  'checkout.setup.lightning.intro': 'Take instant Bitcoin Lightning payments from any wallet.',
  'checkout.setup.lightning.step1': 'Stand up an LNbits instance (or a phoenixd node).',
  'checkout.setup.lightning.step2':
    'In Admin → Settings → Payments, set the default rail to Lightning and pick the node (LNbits or phoenixd).',
  'checkout.setup.lightning.step3':
    'Enter the node URL in Payment config, and the key (LNbits invoice/read key, or phoenixd password) in Payment keys. The Lightning button goes live automatically.',
  'checkout.setup.opennode.title': 'Set up Bitcoin payments (OpenNode)',
  'checkout.setup.opennode.intro': 'Hosted on-chain + Lightning checkout via OpenNode.',
  'checkout.setup.opennode.step1': 'Create an OpenNode account and an API key.',
  'checkout.setup.opennode.step2': 'Paste it in Admin → Settings → Payment keys (OpenNode API key).',
  'checkout.setup.opennode.step3':
    'Point its webhook at {url}, and set the default rail to OpenNode in Settings → Payments.',

  // /pay/<token> (self-rendered rails)
  'checkout.pay.notFound': 'Not found',
  'checkout.pay.demoTitle': 'Demo checkout',
  'checkout.pay.demoDescription': 'Simulated checkout for {store}.',
  'checkout.pay.lightningTitle': 'Pay with Lightning',
  'checkout.pay.lightningDescription': 'Pay {store} with Bitcoin Lightning.',
  'checkout.pay.demoExpiredHeading': 'Checkout expired',
  'checkout.pay.demoExpired': 'This demo checkout has expired. Please start a new one.',

  // Demo checkout view + settlement
  'checkout.demo.noticePay':
    'No card is charged. Submitting places a real order tagged <code class="rounded bg-amber-100 px-1">demo</code> so you can see the full flow.',
  'checkout.demo.shipping': 'Shipping',
  'checkout.demo.total': 'Total',
  'checkout.demo.emailLabel': 'Email for the order confirmation',
  'checkout.demo.cardLegend': 'Card (test — input ignored)',
  'checkout.demo.cardNumber': 'Card number',
  'checkout.demo.cardExpiry': 'Expiry',
  'checkout.demo.cardCvc': 'CVC',
  'checkout.demo.outcomeLabel': 'Simulate outcome',
  'checkout.demo.outcomeApprove': 'Approve payment',
  'checkout.demo.outcomeDecline': 'Decline — card declined',
  'checkout.demo.outcomeInsufficient': 'Decline — insufficient funds',
  'checkout.demo.pay': 'Pay {total}',
  'checkout.demo.cancel': 'Cancel',
  'checkout.demo.declinedCard': 'Payment declined — your card was declined. (Simulated)',
  'checkout.demo.declinedInsufficient': 'Payment declined — insufficient funds. (Simulated)',
  'checkout.demo.expired': 'This demo checkout has expired.',
  'checkout.demo.emailRequired': 'A valid email is required.',

  // Lightning invoice view
  'checkout.lightning.expiredHeading': 'Invoice expired',
  'checkout.lightning.expired':
    "This Lightning invoice is no longer payable and you weren't charged. Start a new checkout to try again.",
  'checkout.lightning.backToCart': 'Back to cart',
  'checkout.lightning.sats': { other: '{amount} sats' },
  'checkout.lightning.scanToPay': '{amount} · scan or tap to pay',
  'checkout.lightning.openWalletLabel': 'Open in Lightning wallet',
  'checkout.lightning.invoiceLabel': 'Lightning invoice',
  'checkout.lightning.copy': 'Copy',
  'checkout.lightning.copied': 'Copied',
  'checkout.lightning.openWallet': 'Open in wallet',
  'checkout.lightning.waiting': 'Waiting for payment… this page updates automatically.',
  /** The memo a wallet shows for the invoice. */
  'checkout.lightning.invoiceDescription': '{store} — order {ref}',

  /** The charge description OpenNode shows on its hosted page. */
  'checkout.opennode.description': 'Order {ref}',

  // Edge rate limiting (login and checkout posts, searches)
  'checkout.rateLimit.tooMany': 'Too many requests. Try again shortly.',
} satisfies Record<`checkout.${string}`, Message>;
