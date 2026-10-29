# Shop di produzione Monopolele

Istanza `monopolele-shop`, gemella dello [shop di test](SHOP_TEST_MONOPOLELE.md): stesso codice,
stesso mount, stesso tema, nessun `NOINDEX`. Sta dietro al sito di produzione (Worker
`monopolele`, repository `monopolele-web`, `deploy/worker/`) in `/support/` e `/it/support/`.
Nessuna route su `monopolele.com` finché Mauro non sposta il dominio.

## Istanza

| Voce | Valore |
|---|---|
| Worker | `monopolele-shop` (`workers.dev`; host nella wiki privata) |
| Sito che lo ospita | Worker `monopolele`, service binding `SHOP` |
| D1 | `monopolele-shop-db` |
| R2 | `monopolele-shop-images` (pubblico via Worker), `monopolele-shop-files` (privato), località EEUR |
| KV | sessioni Astro, creato dal primo deploy |
| Segreti Worker | `AUTH_SECRET`, `SECRETS_KEK`: casuali, diversi dal test, caricati con la prima versione |
| Build | mount `/support`, `cookiePrefix` `minshop_`, tema `monopolele`, `SITE_SHELL` = `monopolele-web/dist-worker-production/shell.json` |

## Come è nato (2026-10-29)

1. `MINSHOP_DEFER_DEPLOY=1 MINSHOP_R2_LOCATION=eeur MINSHOP_MOUNT_PATH=/support MINSHOP_COOKIE_PREFIX=minshop_ THEME=monopolele SITE_SHELL=… scripts/provision-cf.sh monopolele-shop`:
   D1, due bucket e migrazioni, **nessun Worker**.
2. `node scripts/copy-content.mjs monopolele-test-shop monopolele-shop --apply --set store_url=<host del sito di produzione>`:
   piano approvato da Mauro. Copiati catalogo (7 categorie, 24 prodotti, 173 varianti), traduzioni,
   411 foto prodotto e libreria media (413 righe e oggetti R2) e le impostazioni: nome, fuso, lingue,
   Benefit Mode, spedizioni, dati delle ricevute, account clienti accesi, password admin **uguale al
   test** (scelta di Mauro), `setup_complete`. **Non** copiati: ordini, checkout, ricevute, rimborsi,
   notifiche, sessioni, il bucket privato (solo le 2 ricevute di prova) e il vault cifrato (Stripe,
   webhook, Resend, Printful: sigillati con il KEK del test, e comunque chiavi di test).
3. Correzioni: la variante scesa a 99 da un ordine di prova torna a 100; collegamenti Printful
   (`fulfillment_ref`) svuotati su richiesta di Mauro, restano gli id di catalogo per le tariffe.
4. Primo deploy con `MINSHOP_SECRETS_FILE` (segreti nella versione): il database era già popolato,
   la procedura di setup non è mai stata raggiungibile.

Deploy successivi: `scripts/deploy-instance.sh monopolele-shop`, **dopo** `npm run build:worker-production`
in `monopolele-web` se menu o footer sono cambiati (lo shop legge la shell al suo build).

## Cosa deve fare Mauro

Tutto in Admin (`<host>/support/admin`, con la password dello shop di test; il primo passo è
cambiarla). Le chiavi si incollano solo nell'Admin, mai in chat o nei file.

1. **Password admin**: da autenticato, `/support/admin/setup` → «New password (optional)».
   Sceglierne una diversa da quella del test. Password persa: `scripts/admin-reset.sh --remote`
   riapre il setup (va richiuso subito).
2. **Stripe live**
   1. Dashboard Stripe in modalità **live** → Sviluppatori → Chiavi API → copia la *Secret key*
      (`sk_live_…`).
   2. Sviluppatori → Webhook → *Aggiungi destinazione*: eventi dell'account, versione API
      **`2026-07-29.dahlia`**, eventi `checkout.session.completed`,
      `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
      `checkout.session.expired`, `charge.refunded`; URL
      `https://monopolele-shop.<account>.workers.dev/support/api/webhook/stripe` (l'indirizzo
      proprio dello shop, come nel test: non cambia quando il sito passa al sottodominio o a
      monopolele.com). Copia il *Signing secret* (`whsec_…`).
   3. Admin → Settings → **Payments**: incolla chiave e segreto del webhook. Demo resta spento.
   4. Metodi di pagamento nella dashboard live: carte, SEPA, PayPal come provati nel test; Klarna
      spento.
3. **Turnstile** (indispensabile: gli account clienti sono accesi e ogni accesso spedisce
   un'email): dashboard Cloudflare → Turnstile → *Add widget*, modalità *Managed*, hostname
   `prod.monopolele.com`, `monopolele.com`, `monopolele.<account>.workers.dev` e
   `monopolele-shop.<account>.workers.dev`. Sitekey e segreto in Admin → Settings → **Bot protection**.
4. **Email**: in Resend crea una chiave nuova con solo invio sul dominio `monopolele.com` (già
   verificato). Admin → Settings → **Email**: chiave Resend, mittente `info@monopolele.com`,
   avvisi di nuovo ordine (copiato dal test: `mauro@monopolele.com`).
5. **Printful**: rinomina lo store collegato a WooCommerce in «Monopolele WooCommerce», crea lo
   store **API** «Monopolele» e un token privato limitato a quello store. Poi, con Claude: i
   prodotti si copiano con `scripts/printful-copy.mjs copy` (sorgente letta con un token di sola
   lettura), le varianti si ricollegano con `printful-copy.mjs link`, il token va in Admin →
   Settings → Fulfillment, «New orders: Draft» finché non si è provato un ordine vero.
6. **Prova finale** dopo i punti 2–4: un acquisto vero di piccolo importo con carta, ricevuta
   ed email, poi rimborso dall'Admin.
7. Facoltativo: Cloudflare Access su `/support/admin` e `/support/api/admin`.

## Note aperte

- Gratitude ha `track_inventory` acceso con 100 pezzi, come nel test: dopo 100 donazioni risulta
  esaurito. Da decidere se spegnere l'inventario per quel prodotto.
- `store_url` punta a `https://prod.monopolele.com` (sottodominio di verifica creato da Mauro il
  2026-10-29): da cambiare in Admin → Settings → General quando monopolele.com passa al Worker.
- Indicizzazione: un solo indirizzo, `monopolele.com`. Lo shop dichiara canonical lì
  (`CANONICAL_ORIGIN`), il Worker del sito aggiunge `noindex` su ogni altro host
  (`prod.monopolele.com`, workers.dev); `www` va in 301 con una regola Cloudflare.
- Disponibilità 100 per variante: segnaposto ereditato da WooCommerce, anche per gli ukulele.

## Registro deploy

| Data | Versione | Commit | Note |
|---|---|---|---|
| 2026-10-29 | `7478d378-b56f-45de-b7a2-a9343c49843a` | `c47ba06` | Primo deploy, segreti nella versione, D1 già popolato. Verificati: setup e admin → login, API admin 401, nessun `noindex`, carrello EN/IT senza pagamento dal sito di produzione. |
| 2026-10-29 | `f2d4d615-f7bf-469e-8cc6-034f35a08f88` | `c47ba06` | «Doppio salto» (Mauro): `CANONICAL_ORIGIN=https://monopolele.com` (canonical, sitemap, robots, `llms.txt`); `store_url` = `https://prod.monopolele.com`. Shop di test non ripubblicato (nessuna modifica). |
