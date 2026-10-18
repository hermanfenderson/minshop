import type { Catalog } from '../../catalog.ts';

export const order = {
  'order.error.notFound': 'Non trovato',
  'order.page.titleConfirmed': 'Ordine confermato',
  'order.page.titleConfirming': 'Conferma dell’ordine in corso',
  'order.confirmed.heading': 'Grazie! Il tuo ordine è confermato.',
  'order.confirmed.reference': 'Ordine #{ref}',
  'order.confirmed.referenceWithReceipt': 'Ordine #{ref} · la ricevuta è in arrivo a {email}',
  'order.confirmed.item': 'Articolo',
  'order.confirmed.qty': 'Qtà',
  'order.confirmed.lineTotal': 'Totale',
  'order.confirmed.total': 'Totale: {amount}',
  'order.confirmed.paidWith': 'Pagamento: {method}',
  'order.confirmed.refundedFull': 'Rimborso di {amount} effettuato.',
  'order.confirmed.refundedPartial':
    'Rimborso di {amount} effettuato; resta pagato un importo di {remaining}.',
  'order.confirmed.continueShopping': 'Continua gli acquisti',
  'order.payment.card': 'Carta',
  'order.payment.demo': 'Demo (nessun addebito)',
  'order.downloads.heading': 'Download',
  'order.downloads.sizeKb': '{size} KB',
  'order.downloads.unavailableAfterRefund': 'Non disponibile dopo il rimborso',
  'order.downloads.download': 'Scarica',
  'order.confirming.heading': 'Conferma del tuo ordine in corso…',
  'order.confirming.body':
    'Il pagamento è andato a buon fine e stiamo registrando il tuo ordine. Questa pagina si aggiorna automaticamente: di solito bastano pochi secondi.',
  'order.download.notFound': 'Non trovato',
  'order.download.unsettled': 'Il pagamento non è ancora stato completato.',
  'order.download.refunded': 'I download non sono disponibili per un ordine rimborsato per intero.',
  'order.download.fileUnavailable': 'File non disponibile',
  'order.carrier.other': 'Altro',
} satisfies Catalog;
