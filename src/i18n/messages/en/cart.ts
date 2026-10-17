import type { Message } from '../../format';

export const cart = {
  // /cart
  'cart.page.title': 'Cart',
  'cart.page.heading': 'Your cart',
  'cart.page.empty': 'Your cart is empty.',
  'cart.page.continueShopping': 'Continue shopping',
  'cart.line.each': '{price} each',
  'cart.line.outOfStock': 'Out of stock',
  'cart.line.onlyAvailable': { other: 'Only {count} available' },
  'cart.line.quantity': 'Quantity',
  'cart.line.update': 'Update',
  'cart.line.remove': 'Remove',
  'cart.summary.subtotal': 'Subtotal',
  'cart.summary.unavailable': 'Checkout is currently unavailable.',
  'cart.summary.shipTo': 'Ship to',
  'cart.summary.setUp': 'Set up',

  // The cart drawer (/partials/cart)
  'cart.drawer.checkout': 'Checkout',
  'cart.drawer.viewFullCart': 'View full cart',

  // POST /api/cart
  'cart.error.chooseVariant': 'Please choose a {label}.',
  'cart.error.variantFallback': 'option',
} satisfies Record<`cart.${string}`, Message>;
