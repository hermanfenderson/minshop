import type { Catalog } from '../../catalog.ts';

/**
 * Benefit Mode in italiano: chi sostiene non compra e non paga un prezzo. Si
 * sceglie un omaggio e si dà un contributo, da un minimo in su. Sostituisce le
 * parole del negozio (prezzo, acquisto, ordine, carrello, cassa) ovunque le
 * vedano i sostenitori, email comprese; l'admin resta com'è.
 */
export const benefitVocabulary: Catalog = {
  'storefront.meta.description': 'Sostieni {storeName}.',
  'storefront.cartDrawer.label': 'Il tuo sostegno',
  'storefront.cartDrawer.title': 'Il tuo sostegno',
  'storefront.cartDrawer.close': 'Chiudi',
  'storefront.header.storeNav': 'Sostieni',
  'storefront.header.cart': 'Il tuo sostegno',
  'storefront.nav.shop': 'Sostieni',
  'storefront.nav.backToShop': 'Torna a Sostieni',
  'storefront.catalog.eyebrow': 'Sostieni',
  'storefront.catalog.heading': 'Sostieni il festival',
  'storefront.catalog.empty': 'Non ci sono ancora omaggi.',
  'storefront.category.empty': 'Non ci sono ancora omaggi in questa categoria.',
  'storefront.product.priceFrom': 'Contributo da',
  'storefront.product.addToCart': 'Aggiungi il contributo',
  'storefront.product.buyNow': 'Contribuisci ora',
  'storefront.search.label': 'Cerca tra gli omaggi',
  'storefront.search.placeholder': 'Cerca tra gli omaggi…',
  'storefront.search.noResults': 'Nessun omaggio corrisponde a «{query}». Prova con un’altra parola.',

  'catalog.list.eyebrow': 'Sostieni',
  'catalog.list.heading': 'Sostieni il festival',
  'catalog.sort.price': 'Contributo minimo',

  'cart.page.title': 'Il tuo sostegno',
  'cart.page.heading': 'Il tuo sostegno',
  'cart.page.empty': 'Non hai ancora scelto come sostenerci.',
  'cart.page.continueShopping': 'Scegli altri omaggi',
  'cart.line.each': '{price} ciascuno',
  'cart.summary.subtotal': 'Totale contributo',
  'cart.summary.unavailable': 'Al momento non è possibile completare il contributo.',
  'cart.drawer.checkout': 'Contribuisci',
  'cart.drawer.viewFullCart': 'Vedi il tuo sostegno',

  'checkout.page.title': 'Completa il contributo',
  'checkout.page.heading': 'Completa il contributo',
  'checkout.page.summary': {
    one: 'Contributo {subtotal} · {count} scelta',
    many: 'Contributo {subtotal} · {count} scelte',
    other: 'Contributo {subtotal} · {count} scelte',
  },
  'checkout.shipping.optionTotal': '{price} · in tutto {total}',
  'checkout.shipping.errorMissingWeightItems':
    'Al momento non possiamo calcolare la spedizione per {items}. Contattaci per completare il contributo.',
  'checkout.shipping.errorMissingWeight':
    'Al momento non possiamo calcolare la spedizione per uno di questi omaggi. Contattaci per completare il contributo.',
  'checkout.shipping.errorOverweight': 'Questa spedizione è troppo pesante per i servizi disponibili.',
  'checkout.shipping.errorCardNoShip': 'Ci dispiace, con il pagamento con carta non possiamo spedire omaggi in questo paese ({country}).',
  'checkout.shipping.errorCardDestinations':
    'Le destinazioni di spedizione configurate non sono supportate dal pagamento con carta. Contattaci per completare il contributo.',
  'checkout.error.lineShort': {
    one: '{name}: solo {count} disponibile. Modifica le tue scelte.',
    many: '{name}: solo {count} disponibili. Modifica le tue scelte.',
    other: '{name}: solo {count} disponibili. Modifica le tue scelte.',
  },
  'checkout.error.cartShort':
    'Alcuni omaggi non sono più disponibili nella quantità scelta. Controlla il tuo sostegno.',
  'checkout.error.reservationFailed': 'Alcuni omaggi si sono appena esauriti: controlla il tuo sostegno.',
  'checkout.error.productUnavailable': 'Omaggio non disponibile',
  'checkout.express.description': 'Contributo rapido.',
  'checkout.express.eyebrow': 'Contributo rapido',
  'checkout.express.buyNow': 'Contribuisci ora',
  'checkout.setup.back': 'Torna al tuo sostegno',
  'checkout.lightning.backToCart': 'Torna al tuo sostegno',
  'checkout.lightning.invoiceDescription': '{store} — contributo {ref}',
  'checkout.opennode.description': 'Contributo {ref}',

  'order.page.titleConfirmed': 'Contributo registrato',
  'order.page.titleConfirming': 'Registrazione del contributo in corso',
  'order.confirmed.heading': 'Grazie! Il tuo contributo è registrato.',
  'order.confirmed.reference': 'Contributo #{ref}',
  'order.confirmed.referenceWithReceipt': 'Contributo #{ref} · la conferma è in arrivo a {email}',
  'order.confirmed.item': 'Scelta',
  'order.confirmed.continueShopping': 'Scegli altri omaggi',
  'order.confirming.heading': 'Registrazione del tuo contributo in corso…',
  'order.confirming.body':
    'Il pagamento è andato a buon fine e stiamo registrando il tuo contributo. Questa pagina si aggiorna automaticamente: di solito bastano pochi secondi.',
  'order.processing.body':
    "Il tuo pagamento è stato autorizzato ed è in elaborazione. Gli addebiti bancari come il SEPA possono richiedere alcuni giorni lavorativi: il contributo viene registrato, con la conferma via email, appena arriva il pagamento. Puoi chiudere questa pagina.",
  'order.failed.body':
    'Il pagamento non è andato a buon fine, quindi nessun contributo è stato registrato e non ti verrà addebitato nulla. Le tue scelte sono ancora salvate: puoi riprovare, anche con un altro metodo di pagamento.',
  'order.expired.heading': 'Pagamento scaduto',
  'order.expired.body':
    'Il pagamento non è stato completato in tempo, quindi nessun contributo è stato registrato. Le tue scelte sono ancora salvate.',
  'order.pending.backToCart': 'Torna al tuo sostegno',
  'order.download.refunded': 'I download non sono disponibili per un contributo rimborsato per intero.',

  'account.orders.heading': 'I tuoi contributi',
  'account.orders.empty': 'Non hai ancora dato contributi.',
  'account.orders.startShopping': 'Scopri come sostenerci',
  'account.orders.reference': 'Contributo #{ref}',
  'account.login.intro':
    'Inserisci la tua email e ti invieremo un link di accesso, senza bisogno di password. Usa l’indirizzo dei tuoi contributi per vederne lo storico.',

  'email.totals.discount': 'Riduzione',
  'email.text.discount': 'Riduzione: -{amount}',
  'email.text.viewOrder': 'Vedi il tuo contributo: {url}',
  'email.button.viewOrder': 'Vedi il tuo contributo',
  'email.confirmation.subject': 'Il tuo contributo #{num} a {store}',
  'email.confirmation.heading': 'Grazie per il tuo contributo',
  'email.confirmation.subheading':
    'Il contributo #{num} è registrato. Se hai scelto un omaggio da spedire, ti scriveremo di nuovo quando parte.',
  'email.confirmation.textThanks': 'Grazie per il tuo contributo!',
  'email.confirmation.textOrder': 'Contributo #{num}, {store}',
  'email.confirmation.footer': 'Domande su questo contributo? Rispondi semplicemente a questa email.',
  'email.notification.subject': 'Nuovo contributo #{id} a {store}',
  'email.notification.heading': 'Nuovo contributo #{id}',
  'email.notification.identifiers': 'Identificativi del contributo',
  'email.notification.orderNumber': 'Contributo #{id}',
  'email.notification.textHeading': 'Nuovo contributo #{id}',
  'email.shipped.subject': 'I tuoi omaggi da {store} sono in viaggio (#{num})',
  'email.shipped.heading': 'I tuoi omaggi sono in viaggio',
  'email.shipped.subheading': 'Gli omaggi del contributo #{num} sono stati spediti.',
  'email.shipped.orderDetails': 'Dettagli del contributo:',
  'email.shipped.textShipped': 'Gli omaggi del tuo contributo #{num} sono stati spediti!',
  'email.refunded.subjectFull': 'Il tuo contributo #{num} a {store} è stato rimborsato',
  'email.refunded.subjectPartial': 'Un rimborso per il tuo contributo #{num} a {store}',
  'email.refunded.headingFull': 'Il tuo contributo è stato rimborsato',
  'email.refunded.subheading': 'Contributo #{num}',
  'email.refunded.textFull': 'Il tuo contributo #{num} è stato rimborsato.',
  'email.refunded.textPartial': 'È stato emesso un rimborso per il contributo #{num}.',
  'email.reissue.subject': 'Il nuovo link al tuo contributo a {store} (#{num})',
  'email.reissue.heading': 'Il nuovo link al tuo contributo',
  'email.reissue.subheading': 'Un nuovo link per il contributo #{num}.',
  'email.reissue.textIntro': 'Ecco un nuovo link al tuo contributo #{num} a {store}.',
  'email.reissue.textIgnore':
    'Se non hai chiesto un nuovo link, puoi ignorare questa email; il nuovo link\nmostra comunque il tuo contributo come sempre.',
  'email.paymentFailed.subheading':
    'La banca non ha completato il pagamento: il contributo non è stato registrato e non ti è stato addebitato nulla.',
  'email.paymentFailed.textRetry': 'Per riprovare, ripeti il contributo: {url}',
  'email.paymentFailedOwner.explain':
    'La banca non ha completato questo pagamento differito. Nessun contributo è stato registrato e gli omaggi sono tornati disponibili.',
  'email.paymentFailedOwner.view': 'Vedi i pagamenti non completati',

  'llms.intro':
    "{storeName} raccoglie contributi online: chi sostiene sceglie un omaggio e dà un contributo, da un minimo in su; lo si può fare anche in modo programmatico. Tutti gli importi sono in {currency}. Questo file segue la convenzione llms.txt (https://llmstxt.org). I link al catalogo e alle categorie sono attivi; un agente può completare un contributo tramite l'endpoint JSON di checkout descritto in \"For agents\".",
  'llms.products': 'Omaggi',
  'llms.noProducts': '(nessun omaggio)',
};
