import type { Message } from '../../format.ts';

/**
 * Benefit Mode (docs/ROADMAP_BENEFIT_MODE.md): every price is a minimum
 * contribution the supporter may raise. Import-free, like the storefront
 * catalog, because the purchase controls fall back to it.
 */
export const benefit = {
  // Product page — the one amount field (R2, R3)
  'benefit.product.minimum': 'Minimum contribution: {price}',
  'benefit.product.amountLabel': 'Your contribution',
  'benefit.product.amountHelp': 'Any amount from {price}.',
  'benefit.product.encourage': 'Your contribution keeps this project free and open to everyone. If you can, consider giving a little more!',
  'benefit.product.addToCart': 'Add contribution',
  'benefit.product.buyNow': 'Contribute now',

  // Cart
  'benefit.llms.minimum': 'from {price} (minimum contribution; any higher amount is welcome)',

  'benefit.cart.contribution': 'Contribution',
  'benefit.cart.each': '{price} each',
  'benefit.cart.change': 'Change',
  'benefit.cart.total': 'Total contribution',

  // Donor details, collected before payment for the receipt (R14)
  'benefit.donor.heading': 'Your details for the receipt',
  'benefit.donor.intro': 'We issue a contribution receipt in your name. These details are used for the receipt and kept by us.',
  'benefit.donor.privacy': 'How we handle them',
  'benefit.donor.company': 'Donating as a company',
  'benefit.donor.firstName': 'First name',
  'benefit.donor.lastName': 'Last name',
  'benefit.donor.companyName': 'Company name',
  'benefit.donor.taxCode': 'Tax code (codice fiscale)',
  'benefit.donor.taxCodeHint': 'Required for residents of Italy.',
  'benefit.donor.companyTaxCode': 'Company tax code, if different from the VAT number',
  'benefit.donor.vat': 'VAT number',
  'benefit.donor.address': 'Address',
  'benefit.donor.postal': 'Postcode',
  'benefit.donor.city': 'City',
  'benefit.donor.region': 'Province or state',
  'benefit.donor.country': 'Country of residence',
  'benefit.donor.listed': 'Show the name in the public list of supporters',
  'benefit.donor.displayName': 'Name to show (leave empty to appear as “anonymous”)',
  'benefit.donor.error': 'Please check the receipt details: {fields}.',

  // Refusals — on the product page, the cart, or checkout (R4)
  'benefit.error.invalid': 'Please enter an amount, for example 25 or 25.50.',
  'benefit.error.precision': 'That amount has too many decimal places.',
  'benefit.error.belowMinimum': 'The minimum contribution for {name} is {price}.',
  'benefit.error.method': 'Contributions can be paid by card only.',
  'benefit.error.aboveMaximum': 'The largest contribution we can accept online for {name} is {price}. Please contact us for more.',

  // Receipts (R11/R12/R15). Generic wording only; anything with legal weight is
  // the issuer's own text, configured in Admin → Receipts.
  'benefit.receipt.title.donation': 'Contribution receipt',
  'benefit.receipt.title.shipping': 'Shipping cost receipt',
  'benefit.receipt.title.refund_note': 'Refund note',
  'benefit.receipt.date': 'Date',
  'benefit.receipt.number': 'Receipt no.',
  'benefit.receipt.noteNumber': 'Note no.',
  'benefit.receipt.order': 'Order',
  'benefit.receipt.amount': 'Amount',
  'benefit.receipt.amountWords': 'In words',
  'benefit.receipt.from': 'From',
  'benefit.receipt.to': 'To',
  'benefit.receipt.taxCode': 'Tax code',
  'benefit.receipt.vat': 'VAT number',
  'benefit.receipt.annex': 'Annex: thank-you gifts sent with this contribution, at no charge',
  'benefit.receipt.annexQuantity': 'Qty',
  'benefit.receipt.replaces': 'This document cancels and replaces receipt {label}.',
  'benefit.receipt.cancels': 'This note cancels receipt {label}.',
  'benefit.receipt.signature': 'Signature of the legal representative and stamp',
  'benefit.receipt.method.stripe': 'electronic payment (card or wallet, via Stripe)',
  'benefit.receipt.method.demo': 'test payment (demo — not a real payment)',
  'benefit.receipt.method.other': 'electronic payment',
  'benefit.receipt.placeholder.donation.person':
    '{issuer} confirms that it received from {donor} a contribution of {amount} ({amount_words}) on {date}, paid by {payment_method}.\n\n[Placeholder text: set the final wording in Admin › Receipts.]',
  'benefit.receipt.placeholder.donation.company':
    '{issuer} confirms that it received from {donor} a contribution of {amount} ({amount_words}) on {date}, paid by {payment_method}.\n\n[Placeholder text: set the final wording in Admin › Receipts.]',
  'benefit.receipt.placeholder.shipping':
    '{issuer} confirms that it received from {donor} {amount} ({amount_words}) on {date} as reimbursement of the shipping cost for order {order}, charged at cost.\n\n[Placeholder text: set the final wording in Admin › Receipts.]',
  'benefit.receipt.placeholder.refund_note':
    '{issuer} returned {amount} ({amount_words}) to {donor} on {date}.\n\n[Placeholder text: set the final wording in Admin › Receipts.]',
  'benefit.receipt.heading': 'Receipts',
  'benefit.receipt.download': '{title} {label} (PDF)',
  'benefit.receipt.pending': 'Your receipt is being prepared and will appear here shortly.',
} satisfies Record<`benefit.${string}`, Message>;
