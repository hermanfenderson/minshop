import type { Catalog } from '../../catalog.ts';

export const account = {
  'account.page.title': 'Il tuo account',
  'account.orders.heading': 'I tuoi ordini',
  'account.orders.signOut': 'Esci',
  'account.orders.signedInAs': 'Accesso effettuato come {email}',
  'account.orders.empty': 'Non hai ancora effettuato ordini.',
  'account.orders.startShopping': 'Inizia a fare acquisti',
  'account.orders.reference': 'Ordine #{ref}',
  'account.orders.statusPaid': 'pagato',
  'account.orders.statusRefunded': 'rimborsato',
  'account.orders.statusPartiallyRefunded': 'Rimborsato in parte',
  'account.login.title': 'Accedi',
  'account.login.heading': 'Accedi',
  'account.login.expired': 'Il link è scaduto: richiedine uno nuovo.',
  'account.login.verificationFailed': 'Verifica non riuscita: riprova.',
  'account.login.invalidEmail': 'Inserisci un indirizzo email valido.',
  'account.login.sent':
    'Controlla la tua email: ti abbiamo inviato un link di accesso monouso. Scade tra 15 minuti.',
  'account.login.intro':
    'Inserisci la tua email e ti invieremo un link di accesso, senza bisogno di password. Usa l’indirizzo dei tuoi ordini per vederne lo storico.',
  'account.login.emailPlaceholder': 'nome@example.com',
  'account.login.submit': 'Invia link di accesso',
} satisfies Catalog;
