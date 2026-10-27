# Shop di test Monopolele (passo 1)

Resoconto dello shop di test su Cloudflare per Monopolele, passo 1 del brief
«Minshop: shop di test su Cloudflare e connettore Printful» (wiki Monopolele
2027, `MINSHOP_SHOP_DI_TEST.md`). Istanza di test **permanente** (decisione A:
due istanze); la produzione nascerà pulita con lo stesso codice e lo stesso mount.

## Istanza

| Voce | Valore |
|---|---|
| Indirizzo | host `workers.dev` del Worker (non pubblicato: è nella wiki privata), `/shop/` in EN e `/it/shop/` in IT |
| Admin | `/shop/admin` (password del setup wizard) |
| Worker | `monopolele-test-shop` |
| D1 | `monopolele-test-shop-db` |
| R2 | `monopolele-test-shop-images` (pubblico via Worker), `monopolele-test-shop-files` (privato) |
| KV | `monopolele-test-shop-session` (creato dal deploy, sessioni Astro) |
| Segreti Worker | `AUTH_SECRET`, `SECRETS_KEK` (casuali, mai mostrati) |
| Build | mount `/shop`, `cookiePrefix` `minshop_`, valuta EUR, tema `default` |
| Indicizzazione | `NOINDEX=true`: `X-Robots-Tag` su ogni risposta, meta `noindex`, robots.txt `Disallow` |

Creato il 2026-10-26 dal ramo `feat/printful` con
`MINSHOP_MOUNT_PATH=/shop MINSHOP_COOKIE_PREFIX=minshop_ MINSHOP_NOINDEX=1 scripts/provision-cf.sh monopolele-test-shop`
(il primo tentativo si è fermato perché R2 non era attivo sull'account; ripreso
a mano dal passo 2 con lo stesso D1). La configurazione dell'istanza è in
`.instances/` (fuori da Git); i deploy successivi:
`scripts/deploy-instance.sh monopolele-test-shop`.

Il nome `*.workers.dev` è bloccato dal firewall della rete aziendale da cui si
lavora: lo shop si raggiunge dalla rete dati. Non riguarda i visitatori.

## Configurazione (Admin)

- Nome `Monopolele`, fuso `Europe/Rome`, lingue EN (sorgente) + IT.
- Spedizioni provvisorie a tariffa fissa: Italia 5 €, resto del mondo 15 €.
- Pagamenti: solo Stripe in modalità test (sandbox), chiave e segreto del
  webhook nel vault cifrato. Demo spento. Lightning e OpenNode non configurati:
  la cassa offre solo i metodi configurati, quindi non compaiono (verificato con
  un carrello: unico pulsante Stripe, «Proceed to payment»).
- Webhook Stripe di test: `<host>/shop/api/webhook/stripe`, versione API
  `2026-07-29.dahlia` (quella della libreria `stripe` 22.4), eventi
  `checkout.session.completed`, `…async_payment_succeeded`,
  `…async_payment_failed`, `…expired`, `charge.refunded`.
- Email: Resend, dominio `monopolele.com` verificato in regione EU (Irlanda),
  record `resend._domainkey` (TXT), `rsend` e `send` (CNAME); MX, SPF, DKIM e
  DMARC di Google invariati. Mittente e avvisi di nuovo ordine per ora
  sull'indirizzo di Mauro; tracciamento di clic e aperture spento.
- Catalogo: dal 2026-10-26 quello di WooCommerce (sotto); prima i 30 prodotti
  demo del setup.

## Correzioni fatte durante il passo 1

- `noindex` per istanza (variabile `NOINDEX`), assente in Minshop.
- `scripts/reset.sh` svuota tutte le tabelle delle migrazioni (prima 11 su 31).
- `provision-cf.sh` registra mount, prefisso e `noindex`; nuovo `deploy-instance.sh`.
- Valuta EUR nel fork (`src/store.config.ts`).
- Il catalogo demo del setup nasceva in `usd` (default della colonna) anche in
  uno shop in euro: mostrato in €, addebitato in $. Corretto nel codice e nei
  dati dello shop di test.
- La pagina d'ordine diceva «Your payment went through» per ogni pagamento non
  ancora diventato ordine, anche fallito o scaduto. Ora legge la prenotazione:
  in elaborazione (SEPA, si aggiorna ogni 30 s), fallito, scaduto, in conferma.
- Il pulsante della cassa diceva «Pay with card» e la conferma d'ordine «Paid
  with Card» anche per SEPA e gli altri metodi di Stripe Checkout: ora
  «Proceed to payment / Procedi al pagamento» e «Paid with Stripe»; in Admin
  il metodo si chiama «Stripe» invece di «Card (Stripe)».

## Collaudo

Esiti del 2026-10-26 (acquisti fatti da Mauro dal telefono, verifiche di Claude
su D1, log del Worker ed esterno):

| Prova | Esito |
|---|---|
| Carta `4242…`, ordine EN e ordine IT | ✅ pagati in EUR, lingua dell'ordine registrata |
| Email al cliente e all'admin (Resend) | ✅ inviate al primo tentativo, ~2 s dopo il pagamento |
| SEPA, IBAN di test che va a buon fine | ✅ `completed` con pagamento in attesa → nessun ordine; ordine pagato solo con `async_payment_succeeded` (16 s dopo, tempi di test) |
| In cassa solo Stripe, niente demo | ✅ |
| `noindex` | ✅ intestazione, meta e robots.txt |
| Admin protetto | ✅ setup chiuso, `/shop/api/admin` risponde 401 senza login |
| Carrello e cassa EN/IT sotto il mount | ✅ `/shop/` e `/it/shop/` |
| 3-D Secure (`4000 0027 6000 3184`) | ✅ ordine pagato |
| SEPA che fallisce (`DE62…3001`) | ✅ nessun ordine; prenotazione chiusa come «failed» 16 s dopo, stock liberato |
| Pagina d'ordine dopo un SEPA fallito | ❌→✅ diceva «payment went through» per sempre; corretta: «Payment not completed», con il ritorno al carrello |
| PayPal dentro Stripe | ✅ attivabile e visibile in cassa (punto aperto del brief chiuso) |
| Klarna | non provato: non interessa a Mauro (2026-10-26); si può spegnere nella dashboard Stripe |
| Carrello abbandonato su Stripe | ✅ stock liberato da un webhook di Stripe (prenotazione chiusa come «failed», non per scadenza naturale: da osservare ancora) |
| Account cliente (link d'accesso via email) | ✅ funziona: accesso e storico degli ordini |
| Rimborso di un ordine SEPA | ⚠️ rifiutato da Stripe, non dallo shop: per un account nuovo Stripe blocca i rimborsi SEPA dopo il primo tentativo finché non rivede l'account (fino a 2 giorni lavorativi) |
| Rimborso totale di un ordine con carta, dall'Admin | ✅ ordine «refunded», un solo rimborso registrato: il `charge.refunded` che segue è riconosciuto e non lo conta due volte |
| Rimborso parziale dalla dashboard Stripe | ✅ 7,00 € su 57,00 €: `charge.refunded` elaborato al primo tentativo, ordine ancora «paid» con 7,00 € rimborsati |

Seguito dei pagamenti non riusciti (roadmap, punto 2), provato il 2026-10-27
dopo il deploy con la migrazione `0042`:

| Prova | Esito |
|---|---|
| SEPA che fallisce (`DE62…3001`), 20,00 € | ✅ nessun ordine; prenotazione «failed» circa 75 s dopo, con email, importo, valuta e lingua salvati |
| Email al cliente («Payment not completed») e avviso all'admin | ✅ inviate entrambe al primo tentativo, ricevute da Mauro |
| Admin → Orders → «Unpaid checkouts» | ✅ il checkout fallito compare con stato «Failed» e avviso al cliente «Emailed»; l'elenco Orders resta solo dei pagati |

## Catalogo importato da WooCommerce (passo 2, punto 3 del piano)

Il 2026-10-26, con `scripts/import-woocommerce.mjs` (chiave WooCommerce di sola
lettura; prima provato sulla copia locale): 7 categorie, 24 prodotti, 173
varianti, 407 foto nella libreria media. I prodotti e le categorie demo sono
stati tolti; i 4 ordini di prova restano, con nome e prezzo degli articoli.

- Colore e taglia diventano un'unica lista («Black / M»): il doppio selettore
  è in [roadmap](ROADMAP.md#two-axis-variant-picker).
- Gratitude è disattivato (prezzo 0: un carrello a 0 € non si paga).
- Disponibilità 100 per ogni variante: WooCommerce non conta i pezzi.
  Segnaposto, anche per gli ukulele.
- Prezzi e slug come in WooCommerce; la tazza 2023 arrotondata a 15,00 €.
- Non riportate: immagini e descrizioni delle categorie (Minshop non le ha).
- Traduzioni italiane: da rifare nell'Admin.

Il primo tentativo sullo shop si è fermato senza cambiare nulla: D1, a
differenza della copia locale, applica il vincolo tra righe d'ordine e
prodotti. Ora la sostituzione del catalogo scollega prima le righe d'ordine.

## Connettore Printful, primo passo (2026-10-27)

- **Store Printful di test** «Monopolele TEST» (tipo API), token privato limitato
  allo store, nel vault dell'Admin. I 20 prodotti dello store collegato a
  WooCommerce copiati con `scripts/printful-copy.mjs copy` (store d'origine solo
  letto, con un token di sola lettura): stesse varianti di catalogo, stessi file
  di stampa (per id della libreria), SKU e prezzi.
- **Varianti collegate per SKU** con `scripts/printful-copy.mjs link`: le 173
  varianti dello shop hanno il loro `fulfillment_ref` (migrazione `0043`);
  ukulele e Gratitude restano senza, quindi non partono mai verso Printful.
- **Ordine dopo il pagamento**: le righe collegate partono come **bozza**
  (impostazione «New orders: Draft»), con l'id pubblico dell'ordine come
  `external_id`; la scheda Printful dell'ordine in Admin mostra lo stato e un
  pulsante per riprovare, il cron riprova da solo.

| Prova | Esito |
|---|---|
| Tazza 2023 «Dark green / 11 oz», carta di test | ❌→✅ primo invio fallito per un errore del codice su Workers (`fetch` chiamato come metodo), corretto e ripubblicato; il cron l'ha riprovato da solo |
| Bozza in Printful | ✅ ordine `draft`, external id = ordine dello shop, variante e SKU giusti, file di stampa presenti, indirizzo IT completo, prezzo al pubblico 15,00 € |
| Costo Printful della bozza | 7,25 € articolo + 4,69 € spedizione = 14,57 € (il cliente ha pagato 20,00 € con la spedizione dello shop): dato utile per le tariffe in cassa |

## Checklist per la produzione

- Istanza `monopolele-shop` creata pulita, stesso codice e mount, senza `NOINDEX`.
- Mittente email `info@monopolele.com` (nel test: l'indirizzo di Mauro).
- **Turnstile** su login admin e accesso clienti: widget gratuito nella
  dashboard Cloudflare, sitekey e segreto in Admin → Settings → Bot protection.
  Indispensabile se si attivano gli account clienti (ogni accesso spedisce un'email).
- Chiavi Stripe live e webhook live con gli stessi eventi e la stessa versione API.
- Demo spento; in cassa solo i metodi Stripe attivi e provati.
- **Pagamenti non riusciti o in sospeso** ([roadmap](ROADMAP.md#failed-and-pending-payment-follow-up)):
  email al cliente e avviso all'admin quando un pagamento differito (SEPA)
  fallisce, e in Admin una vista dei pagamenti falliti, scaduti e in
  elaborazione. Oggi l'ordine semplicemente non nasce e nessuno lo sa: lo si
  vede solo nella dashboard Stripe. Da sviluppare prima della produzione.
- Valutare Cloudflare Access su `/shop/admin` e `/shop/api/admin`.
- `robots.txt` del sito ospite con la sitemap del negozio ed esclusione di
  `/shop/admin` e `/shop/api/`.
