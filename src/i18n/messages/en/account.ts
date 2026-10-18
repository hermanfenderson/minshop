import type { Message } from '../../format.ts';

export const account = {
  // /account
  'account.page.title': 'Your account',
  'account.orders.heading': 'Your orders',
  'account.orders.signOut': 'Sign out',
  'account.orders.signedInAs': 'Signed in as {email}',
  'account.orders.empty': 'No orders yet.',
  'account.orders.startShopping': 'Start shopping',
  'account.orders.reference': 'Order #{ref}',
  // Lowercase on purpose: the list capitalizes them with CSS.
  'account.orders.statusPaid': 'paid',
  'account.orders.statusRefunded': 'refunded',
  'account.orders.statusPartiallyRefunded': 'Partially refunded',

  // /account/login
  'account.login.title': 'Sign in',
  'account.login.heading': 'Sign in',
  'account.login.expired': 'That link expired — request a new one.',
  'account.login.verificationFailed': 'Verification failed — please try again.',
  'account.login.invalidEmail': 'Enter a valid email address.',
  'account.login.sent': 'Check your email — we sent a one-time sign-in link. It expires in 15 minutes.',
  'account.login.intro':
    "Enter your email and we'll send a sign-in link — no password needed. Use the address from your orders to see your order history.",
  'account.login.emailPlaceholder': 'you@example.com',
  'account.login.submit': 'Send sign-in link',
} satisfies Record<`account.${string}`, Message>;
