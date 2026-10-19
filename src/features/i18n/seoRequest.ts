/**
 * The request-side glue for features/i18n/seo.ts: the store's languages, the
 * central URL builder on the canonical origin, and which routes are indexable.
 */
import { MOUNT } from '../../deployment';
import { isPublicStorefrontPath } from '../cache/public';
import { requestLanguage } from './request';
import { LOCALE_REGISTRY, languageSettings } from './settings';
import { pageSeo, type Availability, type PageSeo } from './seo';

export interface RequestSeo extends PageSeo {
  /** Absolute URL of a logical path in the page's content language. */
  absolute: (path: string) => string;
}

/**
 * Pages a search engine should index: the public storefront documents, minus
 * internal search results. Cart, checkout, payment, order and account pages
 * are transactional or private and say noindex.
 */
export function isIndexablePage(path: string): boolean {
  return isPublicStorefrontPath(path) && path !== '/search';
}

export function requestSeo(
  locals: App.Locals,
  /** The public origin (CANONICAL_ORIGIN when set). */
  origin: string,
  path: string,
  available: Availability = 'all',
): RequestSeo {
  const settings = languageSettings(locals.settings);
  const { urls } = requestLanguage(settings, LOCALE_REGISTRY, MOUNT, locals.locale, origin, { path, search: '' });
  const absolute = (p: string, locale: string) => urls.absolute(p, { locale });
  const seo = pageSeo({ settings, registry: LOCALE_REGISTRY, locale: locals.locale, absolute, path, available });
  return { ...seo, absolute: (p) => absolute(p, seo.contentLanguage) };
}
