# Sito e shop da una configurazione comune (tema `site-shell`)

Quando Minshop vive dentro un sito (in `/shop/` dello stesso host), il visitatore
non deve accorgersi del passaggio: stesso logo, stesso menu, stesso footer,
stessi colori e font. Per non mantenere due copie, **il sito pubblica la sua
"shell" in un file JSON e lo shop la legge in build** con il tema `site-shell`.

```
sito (Astro)                         Minshop
src/data/shell.json  ──build──▶  SITE_SHELL=<file o URL>  ──▶  tema site-shell
   │  usato dal Layout del sito                                Header, Footer, token
   └─ pubblicato in /shell.json
```

Cambiare il menu = modificare `shell.json` nel sito, poi ripubblicare **sito e
shop**. La lettura è solo in build: nessuna richiesta a runtime.

## Formato (`version: 1`)

Ogni testo può essere una stringa o un oggetto per lingua
(`{"en": "Shop", "it": "Negozio"}`): lo shop sceglie la lingua della pagina.
Nei campi `footer.about` e `banner.text` la sintassi `[testo](href)` diventa un link.

| Campo | Contenuto |
|---|---|
| `version` | `1` (obbligatorio) |
| `name` | nome del sito (obbligatorio) |
| `origin` | facoltativo: prefisso dei link relativi, quando lo shop gira su un altro host (es. `https://monopolele.com`) |
| `home` | link del logo, default `/` |
| `logo` | `{src, alt, width, height, text?, tagline?}`; senza, il logo dell'Admin |
| `fonts` | `{stylesheet?: URL https, faces?: regole @font-face, body, heading, prose?}` (font-family CSS) |
| `colors` | `ink muted faint line paper surface brand brandHover onBrand accent header onHeader headerLine navAccent footer onFooter footerMuted badge onBadge bannerLink` |
| `products` | cornice delle foto: `{"aspect": "2/3", "fit": "contain"}` per copertine intere; default `1/1` + `cover` |
| `nav` | voci del menu `{id?, label, href}` o gruppi `{label, children: [...]}` (tendina) (obbligatorio) |
| `shopNav` | `id` della voce evidenziata dentro lo shop (es. `libri`) |
| `banner` | `{text}`: riga sopra l'header |
| `footer` | `{about?, columns?: [{title, links}], legal?, links?}`; un link senza `href` è una riga di testo (indirizzo, telefono) |

Campi in più (es. `icon`, `cart.href` usati solo dal sito) vengono ignorati.
Esempio neutro: [`src/features/storefront/site-shell.example.json`](../src/features/storefront/site-shell.example.json);
esempio reale: `src/data/shell.json` di laltracitta-web.

Cosa resta dello shop: ricerca, account, carrello (con il contatore), selettore
di lingua e i link del footer dell'Admin (condizioni, privacy) accanto a quelli
del sito. I link dell'header dell'Admin non sono mostrati: il menu è quello del sito.

## Usarlo su un'istanza

Nel file `.instances/<slug>.env` (fuori da Git):

```sh
THEME=site-shell
SITE_SHELL=/percorso/del/sito/src/data/shell.json   # oppure https://<sito>/shell.json
```

`scripts/deploy-instance.sh <slug>` li esporta e si ferma se `THEME=site-shell`
non ha `SITE_SHELL`. Senza `SITE_SHELL` (sviluppo, test) si usa l'esempio neutro.
Il build stampa `[site-shell] <origine>` per verificare quale file ha letto.

## Lato sito

1. Spostare in `src/data/shell.json` menu, footer, logo, colori e font del Layout.
2. Il Layout li legge da lì (niente più testi del menu scritti nel template).
3. Pubblicare il file: un endpoint `src/pages/shell.json.ts` che restituisce il JSON.

## L'Altracittà (fatto il 2026-10-28)

`laltracitta-web`: `src/data/shell.json`, `src/lib/shell.ts` (colori → variabili
CSS del sito), `src/layouts/Layout.astro`, `/shell.json`. Istanza
`laltracitta-test-shop` con `THEME=site-shell` e `SITE_SHELL` sul file del repo.

## Monopolele (da applicare)

Il menu 2027 non è un file statico: nasce dalla home dell'edizione
(`home.navigation`, link risolti da `src/lib/splash-links.ts`) ed è già esportato
per WordPress da `scripts/build-wp-bridge.mjs` (header, footer e CSS in
`wordpress/monopolele-bridge/generated/`). La shell va generata **dallo stesso
build del ponte**, così WordPress e Minshop vestono lo stesso telaio:

1. Nel target `wp-bridge` aggiungere una rotta `/_shell/[locale].json` (o una
   sola con le due lingue) che serializzi `home.navigation`, `home.footer`,
   `brand.logo` e i colori di `src/styles/editions/2027/splash.css`
   (`--navy`, `--white`, `--orange`, …), con le etichette `{en, it}`.
2. `build-wp-bridge.mjs` la copia in `generated/shell.json` e la include nel
   manifest: `check:wp-bridge` segnala quando il menu cambia e la shell no.
3. `origin: "https://monopolele.com"` finché lo shop di test è su `workers.dev`;
   logo e font puntano alle copie già servite dal tema ponte
   (`/wp-content/themes/monopolele-bridge/generated/assets/…`). Il font
   Montserrat non ha CORS: da un altro host si vede il font di riserva.
4. Colori: header e footer scuri come il sito (`header: #041d37`,
   `onHeader: #fffaf2`, `navAccent: #ffa32b`), pagina chiara per leggibilità
   di prodotti e cassa (`paper: #fffaf2`, `ink: #072c55`).
5. `.instances/monopolele-test-shop.env`: `THEME=site-shell`,
   `SITE_SHELL=~/monopolele-web/wordpress/monopolele-bridge/generated/shell.json`.
