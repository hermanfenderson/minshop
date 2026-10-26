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
- Catalogo: i 30 prodotti demo del setup (senza foto: segnaposto).

## Correzioni fatte durante il passo 1

- `noindex` per istanza (variabile `NOINDEX`), assente in Minshop.
- `scripts/reset.sh` svuota tutte le tabelle delle migrazioni (prima 11 su 31).
- `provision-cf.sh` registra mount, prefisso e `noindex`; nuovo `deploy-instance.sh`.
- Valuta EUR nel fork (`src/store.config.ts`).
- Il catalogo demo del setup nasceva in `usd` (default della colonna) anche in
  uno shop in euro: mostrato in €, addebitato in $. Corretto nel codice e nei
  dati dello shop di test.
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
| 3-D Secure | da fare |
| SEPA che fallisce (stock liberato) | da fare |
| Klarna, PayPal | da fare (PayPal: verificare se attivabile) |
| Rimborso di un ordine SEPA | ⚠️ rifiutato da Stripe, non dallo shop: per un account nuovo Stripe blocca i rimborsi SEPA dopo il primo tentativo finché non rivede l'account (fino a 2 giorni lavorativi) |
| Rimborso totale di un ordine con carta, dall'Admin | ✅ ordine «refunded», un solo rimborso registrato: il `charge.refunded` che segue è riconosciuto e non lo conta due volte |
| Rimborso parziale dalla dashboard Stripe | ✅ 7,00 € su 57,00 €: `charge.refunded` elaborato al primo tentativo, ordine ancora «paid» con 7,00 € rimborsati |

## Checklist per la produzione

- Istanza `monopolele-shop` creata pulita, stesso codice e mount, senza `NOINDEX`.
- Mittente email `info@monopolele.com` (nel test: l'indirizzo di Mauro).
- **Turnstile** su login admin e accesso clienti: widget gratuito nella
  dashboard Cloudflare, sitekey e segreto in Admin → Settings → Bot protection.
  Indispensabile se si attivano gli account clienti (ogni accesso spedisce un'email).
- Chiavi Stripe live e webhook live con gli stessi eventi e la stessa versione API.
- Demo spento; in cassa solo i metodi Stripe attivi e provati.
- Valutare Cloudflare Access su `/shop/admin` e `/shop/api/admin`.
- `robots.txt` del sito ospite con la sitemap del negozio ed esclusione di
  `/shop/admin` e `/shop/api/`.
