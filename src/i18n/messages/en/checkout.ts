import type { Message } from '../../format';

// Only the payment-method names the cart shows, from ddyy/minshop#60. The rest
// of checkout is localized in a later phase.
export const checkout = {
  'checkout.method.stripe.label': 'Pay with card',
  'checkout.method.stripe.hint': 'Visa, Mastercard, Apple Pay & more',
  'checkout.method.stripe.setup': 'Set up card payments',
  'checkout.method.lightning.label': 'Pay with Lightning ⚡',
  'checkout.method.lightning.hint': 'Instant — from any Lightning wallet',
  'checkout.method.lightning.setup': 'Set up Lightning',
  'checkout.method.opennode.label': 'Pay with Bitcoin',
  'checkout.method.opennode.hint': 'On-chain or Lightning (OpenNode)',
  'checkout.method.opennode.setup': 'Set up OpenNode',
  'checkout.method.demo.label': 'Demo checkout',
  'checkout.method.demo.hint': 'Simulated — places a real test order, no charge',
} satisfies Record<`checkout.${string}`, Message>;
