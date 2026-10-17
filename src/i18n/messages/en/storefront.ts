// The catalog-free formatter's type, not ../../core's: storefront templates
// reach this file for their English fallback, and core would drag every
// locale's catalogs into the storefront boundary checker's import walk.
import type { Message } from '../../format';

/**
 * The shopper-facing browse surfaces: the document shell, every theme's
 * templates, the storefront controls, and the catalog, search, category,
 * product, content, and 404 routes. Where the themes say the same thing they
 * share a key; wording only one theme uses is named for what it says.
 */
export const storefront = {
  // Layout.astro: document title and the default meta description.
  'storefront.meta.title': '{title} — {storeName}',
  'storefront.meta.description': 'Shop {storeName}.',

  // Layout.astro: the slide-out cart drawer.
  'storefront.cartDrawer.label': 'Cart',
  'storefront.cartDrawer.title': 'Your cart',
  'storefront.cartDrawer.close': 'Close cart',

  // Theme headers and the header controls.
  'storefront.header.primaryNav': 'Primary',
  'storefront.header.storeNav': 'Store',
  'storefront.header.search': 'Search',
  'storefront.header.menu': 'Menu',
  'storefront.header.cart': 'Cart',
  'storefront.header.account': 'Account',

  // Theme footers.
  'storefront.footer.nav': 'Footer',

  // Navigation shared by product, category, and 404 pages.
  'storefront.nav.shop': 'Shop',
  'storefront.nav.breadcrumb': 'Breadcrumb',
  'storefront.nav.categories': 'Categories',
  'storefront.nav.backToShop': 'Back to shop',

  // The catalog at / and /products (theme Catalog templates, sort control).
  'storefront.catalog.eyebrow': 'Shop',
  'storefront.catalog.heading': 'All products',
  'storefront.catalog.empty': 'No products yet.',
  'storefront.catalog.emptyMarket': 'Nothing here yet. Check back shortly.',
  'storefront.catalog.emptyStudio': 'Nothing on the wall yet.',
  'storefront.catalog.shown': { one: '{count} shown', other: '{count} shown' },
  'storefront.catalog.shownPaged': {
    one: '{count} shown · page {page}/{totalPages}',
    other: '{count} shown · page {page}/{totalPages}',
  },
  'storefront.catalog.sort': 'Sort',

  // /categories/<slug>
  'storefront.category.empty': 'No products in this category yet.',

  // Product cards, the product page, and the purchase controls.
  'storefront.product.soldOut': 'Sold out',
  'storefront.product.inStock': 'In stock',
  'storefront.product.outOfStockShort': 'Out',
  'storefront.product.lowStock': 'Low stock',
  'storefront.product.digitalDownload': 'Digital download',
  // Precedes the lowest variant price: "from $24.00".
  'storefront.product.priceFrom': 'from',
  'storefront.product.share': 'Share',
  // Swapped in by the share button's script after it copies the link.
  'storefront.product.linkCopied': 'Link copied',
  'storefront.product.details': 'Details',
  'storefront.product.youMayAlsoLike': 'You may also like',
  'storefront.product.related': 'Related',
  // Legend for a variant group the merchant left unnamed.
  'storefront.product.option': 'Option',
  'storefront.product.variantSoldOut': '{variant} — sold out',
  'storefront.product.addOns': 'Add-ons',
  'storefront.product.addToCart': 'Add to cart',
  'storefront.product.buyNow': 'Buy now',

  // /search
  'storefront.search.label': 'Search products',
  'storefront.search.title': 'Search',
  'storefront.search.titleWithQuery': 'Search: {query}',
  'storefront.search.heading': 'Find something',
  'storefront.search.placeholder': 'Search products…',
  'storefront.search.corrected':
    'No matches for “{query}” — showing results for <strong class="font-medium text-ink">{suggestion}</strong>.',
  'storefront.search.resultCount': {
    one: '{count} result for “{query}”',
    other: '{count} results for “{query}”',
  },
  'storefront.search.moreFromCategories': 'More from these categories',
  'storefront.search.noResults': 'No products match “{query}”. Try a different word.',

  // 404.astro
  'storefront.notFound.title': 'Page not found',
  'storefront.notFound.description': "The page you're looking for doesn't exist.",
  'storefront.notFound.eyebrow': 'Error 404',
  'storefront.notFound.body': "The page you're looking for moved, sold out, or never existed.",
  'storefront.notFound.searchCatalog': 'Search the catalog',

  // Plain-text 404 for a missing product, category, or content page.
  'storefront.error.notFound': 'Not found',
} satisfies Record<`storefront.${string}`, Message>;
