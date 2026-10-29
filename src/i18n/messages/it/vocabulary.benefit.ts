import type { Catalog } from '../../catalog.ts';

/**
 * Benefit Mode in italiano: chi sostiene non compra e non paga un prezzo. Si
 * sceglie un omaggio e si fa una donazione, da un minimo in su. Sostituisce le
 * parole del negozio (prezzo, acquisto, ordine, carrello, cassa) ovunque le
 * vedano i sostenitori, email comprese; l'admin resta com'è.
 */
export const benefitVocabulary: Catalog = {
  'storefront.meta.description': 'Sostieni {storeName}.',
  'storefront.cartDrawer.label': 'Carrello',
  'storefront.cartDrawer.title': 'Carrello',
  'storefront.cartDrawer.close': 'Chiudi',
  'storefront.header.storeNav': 'Sostieni',
  'storefront.header.cart': 'Carrello',
  'storefront.nav.shop': 'Sostieni',
  'storefront.nav.backToShop': 'Torna a Sostieni',
  'storefront.catalog.eyebrow': 'Sostieni',
  'storefront.catalog.heading': 'Sostieni il festival',
  'storefront.catalog.empty': 'Non ci sono ancora omaggi.',
  'storefront.category.empty': 'Non ci sono ancora omaggi in questa categoria.',
  'storefront.product.priceFrom': 'Donazione minima',
  'storefront.product.addToCart': 'Aggiungi al carrello',
  'storefront.product.buyNow': 'Dona ora',
  'storefront.search.label': 'Cerca tra gli omaggi',
  'storefront.search.placeholder': 'Cerca tra gli omaggi…',
  'storefront.search.noResults': 'Nessun omaggio corrisponde a «{query}». Prova con un’altra parola.',

  'catalog.list.eyebrow': 'Sostieni',
  'catalog.list.heading': 'Sostieni il festival',
  'catalog.sort.price': 'Donazione minima',

  'cart.page.title': 'Carrello',
  'cart.page.heading': 'Carrello',
  'cart.page.empty': 'Non hai ancora scelto come sostenerci.',
  'cart.page.continueShopping': 'Scegli altri omaggi',
  'cart.line.each': '{price} ciascuno',
  'cart.summary.subtotal': 'Totale donazione',
  'cart.summary.unavailable': 'Al momento non è possibile completare la donazione.',
  'cart.drawer.checkout': 'Dona',
  'cart.drawer.viewFullCart': 'Vedi il carrello',

  'checkout.page.title': 'Completa la donazione',
  'checkout.page.heading': 'Completa la donazione',
  'checkout.page.summary': {
    one: 'Donazione {subtotal} · {count} scelta',
    many: 'Donazione {subtotal} · {count} scelte',
    other: 'Donazione {subtotal} · {count} scelte',
  },
  'checkout.shipping.optionTotal': '{price} · in tutto {total}',
  'checkout.shipping.errorMissingWeightItems':
    'Al momento non possiamo calcolare la spedizione per {items}. Contattaci per completare la donazione.',
  'checkout.shipping.errorMissingWeight':
    'Al momento non possiamo calcolare la spedizione per uno di questi omaggi. Contattaci per completare la donazione.',
  'checkout.shipping.errorOverweight': 'Questa spedizione è troppo pesante per i servizi disponibili.',
  'checkout.shipping.errorCardNoShip': 'Ci dispiace, con il pagamento con carta non possiamo spedire omaggi in questo paese ({country}).',
  'checkout.shipping.errorCardDestinations':
    'Le destinazioni di spedizione configurate non sono supportate dal pagamento con carta. Contattaci per completare la donazione.',
  'checkout.error.lineShort': {
    one: '{name}: solo {count} disponibile. Modifica le tue scelte.',
    many: '{name}: solo {count} disponibili. Modifica le tue scelte.',
    other: '{name}: solo {count} disponibili. Modifica le tue scelte.',
  },
  'checkout.error.cartShort':
    'Alcuni omaggi non sono più disponibili nella quantità scelta. Controlla il carrello.',
  'checkout.error.reservationFailed': 'Alcuni omaggi si sono appena esauriti: controlla il carrello.',
  'checkout.error.productUnavailable': 'Omaggio non disponibile',
  'checkout.express.description': 'Donazione rapida.',
  'checkout.express.eyebrow': 'Donazione rapida',
  'checkout.express.buyNow': 'Dona ora',
  'checkout.setup.back': 'Torna al carrello',
  'checkout.lightning.backToCart': 'Torna al carrello',
  'checkout.lightning.invoiceDescription': '{store} — donazione {ref}',
  'checkout.opennode.description': 'Donazione {ref}',

  'order.page.titleConfirmed': 'Donazione registrata',
  'order.page.titleConfirming': 'Registrazione della donazione in corso',
  'order.confirmed.heading': 'Grazie! La tua donazione è registrata.',
  'order.confirmed.reference': 'Donazione #{ref}',
  'order.confirmed.referenceWithReceipt': 'Donazione #{ref} · la conferma è in arrivo a {email}',
  'order.confirmed.item': 'Scelta',
  'order.confirmed.continueShopping': 'Scegli altri omaggi',
  'order.confirming.heading': 'Registrazione della tua donazione in corso…',
  'order.confirming.body':
    'Il pagamento è andato a buon fine e stiamo registrando la tua donazione. Questa pagina si aggiorna automaticamente: di solito bastano pochi secondi.',
  'order.processing.body':
    "Il tuo pagamento è stato autorizzato ed è in elaborazione. Gli addebiti bancari come il SEPA possono richiedere alcuni giorni lavorativi: la donazione viene registrata, con la conferma via email, appena arriva il pagamento. Puoi chiudere questa pagina.",
  'order.failed.body':
    'Il pagamento non è andato a buon fine, quindi nessuna donazione è stata registrata e non ti verrà addebitato nulla. Le tue scelte sono ancora salvate: puoi riprovare, anche con un altro metodo di pagamento.',
  'order.expired.heading': 'Pagamento scaduto',
  'order.expired.body':
    'Il pagamento non è stato completato in tempo, quindi nessuna donazione è stata registrata. Le tue scelte sono ancora salvate.',
  'order.pending.backToCart': 'Torna al carrello',
  'order.download.refunded': 'I download non sono disponibili per una donazione rimborsata per intero.',

  'account.orders.heading': 'Le tue donazioni',
  'account.orders.empty': 'Non hai ancora fatto donazioni.',
  'account.orders.startShopping': 'Scopri come sostenerci',
  'account.orders.reference': 'Donazione #{ref}',
  'account.login.intro':
    'Inserisci la tua email e ti invieremo un link di accesso, senza bisogno di password. Usa l’indirizzo delle tue donazioni per vederne lo storico.',

  'email.totals.discount': 'Riduzione',
  'email.text.discount': 'Riduzione: -{amount}',
  'email.text.viewOrder': 'Vedi la tua donazione: {url}',
  'email.button.viewOrder': 'Vedi la tua donazione',
  'email.confirmation.subject': 'La tua donazione #{num} a {store}',
  'email.confirmation.heading': 'Grazie per la tua donazione',
  'email.confirmation.subheading':
    'La donazione #{num} è registrata. Se hai scelto un omaggio da spedire, ti scriveremo di nuovo quando parte.',
  'email.confirmation.textThanks': 'Grazie per la tua donazione!',
  'email.confirmation.textOrder': 'Donazione #{num}, {store}',
  'email.confirmation.footer': 'Domande su questa donazione? Rispondi semplicemente a questa email.',
  'email.notification.subject': 'Nuova donazione #{id} a {store}',
  'email.notification.heading': 'Nuova donazione #{id}',
  'email.notification.identifiers': 'Identificativi della donazione',
  'email.notification.orderNumber': 'Donazione #{id}',
  'email.notification.textHeading': 'Nuova donazione #{id}',
  'email.shipped.subject': 'I tuoi omaggi da {store} sono in viaggio (#{num})',
  'email.shipped.heading': 'I tuoi omaggi sono in viaggio',
  'email.shipped.subheading': 'Gli omaggi della donazione #{num} sono stati spediti.',
  'email.shipped.orderDetails': 'Dettagli della donazione:',
  'email.shipped.textShipped': 'Gli omaggi della tua donazione #{num} sono stati spediti!',
  'email.refunded.subjectFull': 'La tua donazione #{num} a {store} è stata rimborsata',
  'email.refunded.subjectPartial': 'Un rimborso per la tua donazione #{num} a {store}',
  'email.refunded.headingFull': 'La tua donazione è stata rimborsata',
  'email.refunded.subheading': 'Donazione #{num}',
  'email.refunded.textFull': 'La tua donazione #{num} è stata rimborsata.',
  'email.refunded.textPartial': 'È stato emesso un rimborso per la donazione #{num}.',
  'email.reissue.subject': 'Il nuovo link alla tua donazione a {store} (#{num})',
  'email.reissue.heading': 'Il nuovo link alla tua donazione',
  'email.reissue.subheading': 'Un nuovo link per la donazione #{num}.',
  'email.reissue.textIntro': 'Ecco un nuovo link alla tua donazione #{num} a {store}.',
  'email.reissue.textIgnore':
    'Se non hai chiesto un nuovo link, puoi ignorare questa email; il nuovo link\nmostra comunque la tua donazione come sempre.',
  'email.paymentFailed.subheading':
    'La banca non ha completato il pagamento: la donazione non è stata registrata e non ti è stato addebitato nulla.',
  'email.paymentFailed.textRetry': 'Per riprovare, ripeti la donazione: {url}',
  'email.paymentFailedOwner.explain':
    'La banca non ha completato questo pagamento differito. Nessuna donazione è stata registrata e gli omaggi sono tornati disponibili.',
  'email.paymentFailedOwner.view': 'Vedi i pagamenti non completati',

  'llms.intro':
    "{storeName} raccoglie donazioni online: chi sostiene sceglie un omaggio e fa una donazione, da un minimo in su; lo si può fare anche in modo programmatico. Tutti gli importi sono in {currency}. Questo file segue la convenzione llms.txt (https://llmstxt.org). I link al catalogo e alle categorie sono attivi; un agente può completare una donazione tramite l'endpoint JSON di checkout descritto in \"For agents\".",
  'llms.products': 'Omaggi',
  'llms.noProducts': '(nessun omaggio)',
};
