import type { Catalog } from '../../catalog';

// Only the payment-method names the cart shows, from ddyy/minshop#60. The rest
// of checkout is localized in a later phase.
export const checkout = {
  'checkout.method.stripe.label': 'Paga con carta',
  'checkout.method.stripe.hint': 'Visa, Mastercard, Apple Pay e altro',
  'checkout.method.stripe.setup': 'Configura i pagamenti con carta',
  'checkout.method.lightning.label': 'Paga con Lightning ⚡',
  'checkout.method.lightning.hint': 'Istantaneo, da qualsiasi wallet Lightning',
  'checkout.method.lightning.setup': 'Configura Lightning',
  'checkout.method.opennode.label': 'Paga con Bitcoin',
  'checkout.method.opennode.hint': 'On-chain o Lightning (OpenNode)',
  'checkout.method.opennode.setup': 'Configura OpenNode',
  'checkout.method.demo.label': 'Cassa demo',
  'checkout.method.demo.hint': 'Simulata: crea un vero ordine di prova, senza addebito',
} satisfies Catalog;
