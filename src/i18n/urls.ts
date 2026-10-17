/**
 * LocaleUrls: the ONE place internal URLs are built. Every link, form action
 * and redirect passes a LOGICAL path ('/products/mug', no language, no mount)
 * through it, and gets the public URL for the active strategy and mount.
 *
 * Astro.redirect() does not add the mount (verified by the routing
 * prototype), and Astro.url shows the internal path after a rewrite, so
 * neither may be used to build a public URL.
 */
import { API_LANGUAGE_PARAM, isLanguageAwareApi, isLocalizedPath, locationToString } from './resolve';
import type { LocaleRouting } from './routing/strategy';
import type { I18nSettings } from './settings';

/**
 * A logical path → public URL function. Pure presentation builders take one
 * instead of a whole LocaleUrls, defaulting to rootHref, so their unit tests
 * and a store at the root mount see the logical path unchanged.
 */
export type Href = (path: string) => string;
export const rootHref: Href = (path) => path;

export interface UrlOptions {
  /** Another language than the current one. */
  locale?: string;
  /** Query parameters to add (the strategy's own parameter is managed here). */
  search?: Record<string, string> | URLSearchParams;
}

export interface Alternate {
  /** BCP 47 for hreflang ('it', 'pt-BR', 'x-default'). */
  hreflang: string;
  href: string;
}

export interface LocaleUrls {
  readonly locale: string;
  /** Public URL, relative unless the language lives on another host. */
  href(path: string, options?: UrlOptions): string;
  /** Absolute public URL (emails, canonical, sitemap, payment return URLs). */
  absolute(path: string, options?: UrlOptions): string;
  /** The current page in another language, keeping its other query params. */
  switchTo(locale: string): string;
  /** Absolute URLs of `path` in each language it exists in, plus x-default. */
  alternates(path: string, available?: readonly string[]): Alternate[];
  // Typed builders for the routes the storefront links to.
  home(): string;
  product(slug: string): string;
  category(slug: string): string;
  page(slug: string): string;
  cart(): string;
  checkout(): string;
  search(query?: string): string;
  order(token: string): string;
  pay(publicId: string): string;
  account(): string;
}

export interface LocaleUrlsInput {
  routing: LocaleRouting;
  settings: I18nSettings;
  locale: string;
  /** The public origin ('https://monopolele.com'), e.g. CANONICAL_ORIGIN. */
  origin: string;
  /** The current logical path and query, for switchTo(). */
  currentPath?: string;
  currentSearch?: string;
}

/** BCP 47 casing for hreflang: 'pt-br' → 'pt-BR', 'zh-hant' → 'zh-Hant'. */
export function hreflangTag(code: string): string {
  return code
    .split('-')
    .map((part, i) => (i === 0 ? part : part.length === 2 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1)))
    .join('-');
}

const seg = (value: string) => encodeURIComponent(value);

export function createLocaleUrls(input: LocaleUrlsInput): LocaleUrls {
  const { routing, settings, locale, origin } = input;
  const base = new URL(origin);

  const build = (path: string, options: UrlOptions = {}, absolute = false): string => {
    // Accept 'path?query#hash' from callers, but treat the parts separately.
    const hashAt = path.indexOf('#');
    const hash = hashAt >= 0 ? path.slice(hashAt) : '';
    const beforeHash = hashAt >= 0 ? path.slice(0, hashAt) : path;
    const queryAt = beforeHash.indexOf('?');
    const pathname = queryAt >= 0 ? beforeHash.slice(0, queryAt) : beforeHash;
    const query = queryAt >= 0 ? beforeHash.slice(queryAt + 1) : '';
    if (!pathname.startsWith('/')) throw new Error(`i18n: "${path}" is not a logical path`);
    const search = new URLSearchParams(query);
    for (const [k, v] of new URLSearchParams(options.search ?? {})) search.set(k, v);
    const target = options.locale ?? locale;
    const located = routing.locate(pathname, target, isLocalizedPath(pathname));
    // A public API carries the caller's language as ?lang= (none for the default).
    // Added after the strategy so a query strategy using 'lang' can't strip it.
    const api = isLanguageAwareApi(pathname);
    if (api) search.delete(API_LANGUAGE_PARAM);
    const loc =
      api && target !== settings.defaultLocale
        ? { ...located, params: [...located.params, [API_LANGUAGE_PARAM, target] as [string, string]] }
        : located;
    const href = locationToString(loc, base, routing.param, search) + hash;
    return absolute && href.startsWith('/') ? base.origin + href : href;
  };

  const urls: LocaleUrls = {
    locale,
    href: (path, options) => build(path, options),
    absolute: (path, options) => build(path, options, true),
    switchTo: (target) => build((input.currentPath ?? '/') + (input.currentSearch ?? ''), { locale: target }),
    alternates(path, available = settings.enabledLocales) {
      const langs = settings.enabledLocales.filter((code) => available.includes(code));
      const list = langs.map((code) => ({ hreflang: hreflangTag(code), href: build(path, { locale: code }, true) }));
      if (list.length > 0) {
        list.push({ hreflang: 'x-default', href: build(path, { locale: settings.defaultLocale }, true) });
      }
      return list;
    },
    home: () => build('/'),
    product: (slug) => build(`/products/${seg(slug)}`),
    category: (slug) => build(`/categories/${seg(slug)}`),
    page: (slug) => build(`/pages/${seg(slug)}`),
    cart: () => build('/cart'),
    checkout: () => build('/checkout'),
    search: (query) => build('/search', query ? { search: { q: query } } : {}),
    order: (token) => build(`/order/${seg(token)}`),
    pay: (publicId) => build(`/pay/${seg(publicId)}`),
    account: () => build('/account'),
  };
  return urls;
}
