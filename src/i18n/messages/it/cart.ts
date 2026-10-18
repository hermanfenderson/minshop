import type { Catalog } from '../../catalog.ts';

export const cart = {
  'cart.page.title': 'Carrello',
  'cart.page.heading': 'Il tuo carrello',
  'cart.page.empty': 'Il tuo carrello è vuoto.',
  'cart.page.continueShopping': 'Continua gli acquisti',
  'cart.line.each': '{price} cad.',
  'cart.line.outOfStock': 'Esaurito',
  'cart.line.onlyAvailable': {
    one: 'Solo {count} disponibile',
    many: 'Solo {count} disponibili',
    other: 'Solo {count} disponibili',
  },
  'cart.line.quantity': 'Quantità',
  'cart.line.update': 'Aggiorna',
  'cart.line.remove': 'Rimuovi',
  'cart.summary.subtotal': 'Subtotale',
  'cart.summary.unavailable': 'Al momento non è possibile completare l’acquisto.',
  'cart.summary.shipTo': 'Spedizione in',
  'cart.summary.setUp': 'Configura',
  'cart.drawer.checkout': 'Vai alla cassa',
  'cart.drawer.viewFullCart': 'Vedi il carrello completo',
  'cart.error.chooseVariant': 'Seleziona {label}.',
  'cart.error.variantFallback': 'un’opzione',
} satisfies Catalog;
