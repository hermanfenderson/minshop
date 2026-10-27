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
} satisfies Record<`benefit.${string}`, Message>;
