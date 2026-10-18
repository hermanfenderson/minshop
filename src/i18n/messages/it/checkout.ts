import type { Catalog } from '../../catalog.ts';

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

  'checkout.page.title': 'Cassa',
  'checkout.page.description': 'Inserisci i dati di spedizione.',
  'checkout.page.heading': 'Cassa',
  'checkout.page.summary': {
    one: 'Subtotale {subtotal} · {count} articolo',
    many: 'Subtotale {subtotal} · {count} articoli',
    other: 'Subtotale {subtotal} · {count} articoli',
  },
  'checkout.demo.banner': '⚠️ Cassa demo: non è un pagamento reale',
  'checkout.demo.noticeCheckout':
    'Nessun addebito sulla carta. Completando la procedura crei un vero ordine contrassegnato come <code class="rounded bg-amber-100 px-1">demo</code>, così puoi vedere l’intero flusso.',
  'checkout.address.email': 'Email',
  'checkout.address.fullName': 'Nome e cognome',
  'checkout.address.line1': 'Indirizzo',
  'checkout.address.line2': 'Scala, interno, ecc. (facoltativo)',
  'checkout.address.city': 'Città',
  'checkout.address.state': 'Provincia / Stato',
  'checkout.address.postal': 'Codice postale',
  'checkout.address.country': 'Paese',
  'checkout.address.shipsTo': 'Spediamo in: {countries}',
  'checkout.address.continue': 'Continua con la spedizione',
  'checkout.address.errorEmail': 'Inserisci un’email valida.',
  'checkout.address.errorName': 'Il nome è obbligatorio.',
  'checkout.address.errorLine1': 'L’indirizzo è obbligatorio.',
  'checkout.address.errorCity': 'La città è obbligatoria.',
  'checkout.address.errorPostal': 'Il codice postale è obbligatorio.',
  'checkout.address.errorCountry': 'Usa un codice paese di 2 lettere (es. IT).',
  'checkout.shipping.shipTo': 'Consegna a',
  'checkout.shipping.editAddress': 'Modifica indirizzo',
  'checkout.shipping.legend': 'Spedizione',
  'checkout.shipping.free': 'Gratis',
  'checkout.shipping.optionTotal': '{price} · totale {total}',
  'checkout.shipping.freeShippingLabel': 'Spedizione gratuita',
  'checkout.shipping.errorChooseOption': 'Scegli un’opzione di spedizione.',
  'checkout.shipping.errorMissingWeightItems':
    'Al momento non possiamo calcolare la spedizione per {items}. Contattaci per completare l’ordine.',
  'checkout.shipping.errorMissingWeight':
    'Al momento non possiamo calcolare la spedizione per uno di questi articoli. Contattaci per completare l’ordine.',
  'checkout.shipping.errorOverweight':
    'Questo ordine è troppo pesante per i servizi di spedizione disponibili.',
  'checkout.shipping.errorNoShip': 'Ci dispiace, non spediamo ancora in questo paese ({country}).',
  'checkout.shipping.errorCardNoShip':
    'Ci dispiace, con il pagamento con carta non possiamo spedire in questo paese ({country}).',
  'checkout.shipping.errorCardDestinations':
    'Le destinazioni di spedizione configurate non sono supportate dal pagamento con carta. Contattaci per completare l’ordine.',
  'checkout.rail.lightning': 'Paga con Lightning',
  'checkout.rail.opennode': 'Paga con Bitcoin',
  'checkout.rail.demo': 'Effettua ordine demo',

  'checkout.error.chooseVariant': 'Seleziona {label}.',
  'checkout.error.variantFallback': 'un’opzione',
  'checkout.error.soldOut': 'Esaurito',
  'checkout.error.lineSoldOut': '{name} non è più disponibile.',
  'checkout.error.lineShort': {
    one: '{name}: solo {count} disponibile. Modifica il carrello.',
    many: '{name}: solo {count} disponibili. Modifica il carrello.',
    other: '{name}: solo {count} disponibili. Modifica il carrello.',
  },
  'checkout.error.cartShort':
    'Alcuni articoli non sono più disponibili nella quantità selezionata. Controlla il carrello.',
  'checkout.error.reservationFailed': 'Alcuni articoli si sono appena esauriti: controlla il carrello.',
  'checkout.error.lightningUnavailable':
    'Lightning non è temporaneamente disponibile. Riprova tra poco o scegli un altro metodo di pagamento.',
  'checkout.error.methodUnavailable':
    'Questo metodo di pagamento non è temporaneamente disponibile. Riprova tra poco o scegline un altro.',
  'checkout.error.invalidProductId': 'ID prodotto non valido (atteso un ID pubblico prod_…).',
  'checkout.error.productUnavailable': 'Prodotto non disponibile',

  'checkout.express.description': 'Acquisto rapido.',
  'checkout.express.eyebrow': 'Acquisto rapido',
  'checkout.express.buyNow': 'Acquista ora',
  'checkout.express.qty': 'Qtà {qty}',
  'checkout.express.total': 'Totale',
  'checkout.express.shipTo': 'Spedizione in',
  'checkout.express.back': 'Indietro',

  'checkout.setup.title': 'Configura i pagamenti',
  'checkout.setup.description': 'Come attivare un metodo di pagamento.',
  'checkout.setup.back': 'Torna al carrello',
  'checkout.setup.notConfigured':
    'Questo metodo di pagamento non è ancora configurato. Aggiungi un metodo reale (carta o Lightning) in Admin → Impostazioni → Pagamenti, oppure continua a usare la Cassa demo per provare il negozio.',
  'checkout.setup.demoNote':
    'Nel frattempo la <strong class="font-semibold">Cassa demo</strong> funziona già: crea un vero ordine contrassegnato come demo, così puoi vedere l’intero flusso senza addebitare nulla a nessuno.',
  'checkout.setup.stripe.title': 'Configura i pagamenti con carta (Stripe)',
  'checkout.setup.stripe.intro': 'Accetta Visa, Mastercard, Apple Pay e altro tramite Stripe Checkout.',
  'checkout.setup.stripe.step1':
    'Crea un account Stripe e copia la tua chiave segreta da dashboard.stripe.com/apikeys.',
  'checkout.setup.stripe.step2':
    'Incollala in Admin → Impostazioni → Chiavi di pagamento (chiave segreta Stripe). Viene salvata cifrata nel tuo database.',
  'checkout.setup.stripe.step3':
    'In Stripe aggiungi un endpoint webhook che punti a {url} (eventi: checkout.session.completed, checkout.session.async_payment_succeeded e charge.refunded; l’ultimo sincronizza con i tuoi ordini i rimborsi effettuati dalla Dashboard di Stripe).',
  'checkout.setup.stripe.step4':
    'Incolla il segreto di firma che ricevi in Chiavi di pagamento (segreto di firma del webhook Stripe). Il pulsante della carta si attiva automaticamente.',
  'checkout.setup.lightning.title': 'Configura i pagamenti Lightning',
  'checkout.setup.lightning.intro': 'Ricevi pagamenti Bitcoin Lightning istantanei da qualsiasi wallet.',
  'checkout.setup.lightning.step1': 'Avvia un’istanza LNbits (o un nodo phoenixd).',
  'checkout.setup.lightning.step2':
    'In Admin → Impostazioni → Pagamenti, imposta Lightning come metodo predefinito e scegli il nodo (LNbits o phoenixd).',
  'checkout.setup.lightning.step3':
    'Inserisci l’URL del nodo in Configurazione pagamenti e la chiave (chiave invoice/read di LNbits o password di phoenixd) in Chiavi di pagamento. Il pulsante Lightning si attiva automaticamente.',
  'checkout.setup.opennode.title': 'Configura i pagamenti Bitcoin (OpenNode)',
  'checkout.setup.opennode.intro': 'Pagamento ospitato on-chain + Lightning tramite OpenNode.',
  'checkout.setup.opennode.step1': 'Crea un account OpenNode e una chiave API.',
  'checkout.setup.opennode.step2':
    'Incollala in Admin → Impostazioni → Chiavi di pagamento (chiave API OpenNode).',
  'checkout.setup.opennode.step3':
    'Fai puntare il suo webhook a {url} e imposta OpenNode come metodo predefinito in Impostazioni → Pagamenti.',

  'checkout.pay.notFound': 'Non trovato',
  'checkout.pay.demoTitle': 'Cassa demo',
  'checkout.pay.demoDescription': 'Cassa simulata di {store}.',
  'checkout.pay.lightningTitle': 'Paga con Lightning',
  'checkout.pay.lightningDescription': 'Paga {store} con Bitcoin Lightning.',
  'checkout.pay.demoExpiredHeading': 'Sessione di pagamento scaduta',
  'checkout.pay.demoExpired': 'Questa sessione demo è scaduta. Avviane una nuova.',

  'checkout.demo.noticePay':
    'Nessun addebito sulla carta. Inviando il modulo crei un vero ordine contrassegnato come <code class="rounded bg-amber-100 px-1">demo</code>, così puoi vedere l’intero flusso.',
  'checkout.demo.shipping': 'Spedizione',
  'checkout.demo.total': 'Totale',
  'checkout.demo.emailLabel': 'Email per la conferma dell’ordine',
  'checkout.demo.cardLegend': 'Carta (test: i dati vengono ignorati)',
  'checkout.demo.cardNumber': 'Numero della carta',
  'checkout.demo.cardExpiry': 'Scadenza',
  'checkout.demo.cardCvc': 'CVC',
  'checkout.demo.outcomeLabel': 'Simula l’esito',
  'checkout.demo.outcomeApprove': 'Approva il pagamento',
  'checkout.demo.outcomeDecline': 'Rifiuta: carta rifiutata',
  'checkout.demo.outcomeInsufficient': 'Rifiuta: fondi insufficienti',
  'checkout.demo.pay': 'Paga {total}',
  'checkout.demo.cancel': 'Annulla',
  'checkout.demo.declinedCard': 'Pagamento rifiutato: la tua carta è stata rifiutata. (Simulazione)',
  'checkout.demo.declinedInsufficient': 'Pagamento rifiutato: fondi insufficienti. (Simulazione)',
  'checkout.demo.expired': 'Questa sessione demo è scaduta.',
  'checkout.demo.emailRequired': 'Inserisci un’email valida.',

  'checkout.lightning.expiredHeading': 'Fattura scaduta',
  'checkout.lightning.expired':
    'Questa fattura Lightning non è più pagabile e non ti è stato addebitato nulla. Avvia un nuovo pagamento per riprovare.',
  'checkout.lightning.backToCart': 'Torna al carrello',
  'checkout.lightning.sats': { one: '{amount} sat', many: '{amount} sat', other: '{amount} sat' },
  'checkout.lightning.scanToPay': '{amount} · scansiona o tocca per pagare',
  'checkout.lightning.openWalletLabel': 'Apri nel wallet Lightning',
  'checkout.lightning.invoiceLabel': 'Fattura Lightning',
  'checkout.lightning.copy': 'Copia',
  'checkout.lightning.copied': 'Copiato',
  'checkout.lightning.openWallet': 'Apri nel wallet',
  'checkout.lightning.waiting': 'In attesa del pagamento… la pagina si aggiorna automaticamente.',
  'checkout.lightning.invoiceDescription': '{store} — ordine {ref}',

  'checkout.opennode.description': 'Ordine {ref}',

  'checkout.rateLimit.tooMany': 'Troppe richieste. Riprova tra poco.',
} satisfies Catalog;
