/**
 * What a translation save invalidates. Cache tags are shared by every language
 * version of a URL (/products/x and /it/products/x both carry product:<id>),
 * so one purge clears them all, while the cache KEYS stay separate per
 * language — the language is in the URL, never in a Vary header.
 */
import { CACHE_TAG } from '../cache/tags.ts';

export type TranslationScope = 'product' | 'category' | 'page' | 'menu' | 'announcement';

export function translationPurgeTags(scope: TranslationScope, publicId: string | null): string[] {
  switch (scope) {
    // Its own page, and every list, search result and card that names it.
    case 'product':
      return publicId ? [CACHE_TAG.catalog, CACHE_TAG.product(publicId)] : [CACHE_TAG.catalog];
    // Category names appear in catalog lists and breadcrumbs.
    case 'category':
      return [CACHE_TAG.catalog];
    // Pages, menus and the announcement live in the shell every document renders.
    case 'page':
    case 'menu':
    case 'announcement':
      return [CACHE_TAG.shell];
  }
}
