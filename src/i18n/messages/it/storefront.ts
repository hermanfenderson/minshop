import type { Catalog } from '../../catalog.ts';

export const storefront = {
  'storefront.meta.title': '{title} — {storeName}',
  'storefront.meta.description': 'Acquista su {storeName}.',

  'storefront.cartDrawer.label': 'Carrello',
  'storefront.cartDrawer.title': 'Il tuo carrello',
  'storefront.cartDrawer.close': 'Chiudi carrello',

  'storefront.header.primaryNav': 'Principale',
  'storefront.header.storeNav': 'Negozio',
  'storefront.header.search': 'Cerca',
  'storefront.header.menu': 'Menu',
  'storefront.header.cart': 'Carrello',
  'storefront.header.account': 'Account',

  'storefront.footer.nav': 'Piè di pagina',

  'storefront.nav.shop': 'Negozio',
  'storefront.nav.home': 'Home',
  'storefront.nav.breadcrumb': 'Percorso di navigazione',
  'storefront.nav.categories': 'Categorie',
  'storefront.nav.backToShop': 'Torna al negozio',

  'storefront.catalog.eyebrow': 'Negozio',
  'storefront.catalog.heading': 'Tutti i prodotti',
  'storefront.catalog.empty': 'Non ci sono ancora prodotti.',
  'storefront.catalog.emptyMarket': 'Qui non c’è ancora niente. Torna a trovarci presto.',
  'storefront.catalog.emptyStudio': 'Le pareti sono ancora vuote.',
  'storefront.catalog.shown': {
    one: '{count} visualizzato',
    many: '{count} visualizzati',
    other: '{count} visualizzati',
  },
  'storefront.catalog.shownPaged': {
    one: '{count} visualizzato · pagina {page}/{totalPages}',
    many: '{count} visualizzati · pagina {page}/{totalPages}',
    other: '{count} visualizzati · pagina {page}/{totalPages}',
  },
  'storefront.catalog.sort': 'Ordina',

  'storefront.category.empty': 'Non ci sono ancora prodotti in questa categoria.',

  'storefront.product.soldOut': 'Esaurito',
  'storefront.product.inStock': 'Disponibile',
  'storefront.product.outOfStockShort': 'Esaurito',
  'storefront.product.lowStock': 'Ultimi pezzi',
  'storefront.product.digitalDownload': 'Download digitale',
  'storefront.product.priceFrom': 'da',
  'storefront.product.share': 'Condividi',
  'storefront.product.linkCopied': 'Link copiato',
  'storefront.product.showMore': 'Mostra di più',
  'storefront.product.showLess': 'Mostra meno',
  'storefront.product.details': 'Dettagli',
  'storefront.product.youMayAlsoLike': 'Potrebbe piacerti anche',
  'storefront.product.related': 'Correlati',
  'storefront.product.option': 'Opzione',
  'storefront.product.variantSoldOut': '{variant} — non disponibile',
  'storefront.product.addOns': 'Extra',
  'storefront.product.addToCart': 'Aggiungi al carrello',
  'storefront.product.buyNow': 'Acquista ora',

  'storefront.search.label': 'Cerca prodotti',
  'storefront.search.title': 'Cerca',
  'storefront.search.titleWithQuery': 'Ricerca: {query}',
  'storefront.search.heading': 'Cosa stai cercando?',
  'storefront.search.placeholder': 'Cerca prodotti…',
  'storefront.search.corrected':
    'Nessun risultato per «{query}»: ecco i risultati per <strong class="font-medium text-ink">{suggestion}</strong>.',
  'storefront.search.resultCount': {
    one: '{count} risultato per «{query}»',
    many: '{count} risultati per «{query}»',
    other: '{count} risultati per «{query}»',
  },
  'storefront.search.moreFromCategories': 'Altro da queste categorie',
  'storefront.search.noResults': 'Nessun prodotto corrisponde a «{query}». Prova con un’altra parola.',

  'storefront.notFound.title': 'Pagina non trovata',
  'storefront.notFound.description': 'La pagina che cerchi non esiste.',
  'storefront.notFound.eyebrow': 'Errore 404',
  'storefront.notFound.body': 'La pagina che cerchi è stata spostata, è andata esaurita o non è mai esistita.',
  'storefront.notFound.searchCatalog': 'Cerca nel catalogo',

  'storefront.error.notFound': 'Non trovato',
} satisfies Catalog;
