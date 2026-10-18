/**
 * resolveRequestLocale(): from a request URL to "serve this language at this
 * logical path", "redirect there", or "not ours". One decision table for all
 * three strategies; the strategies only read and write the URL.
 *
 * Rules (the architecture document's middleware step):
 * - The language of a page depends only on its URL. Cookies and
 *   Accept-Language can only suggest, on the home page, with `detect: 'root'`.
 * - Surfaces with no language (admin, API, images, build assets) live only at
 *   the bare mount; a language prefix or parameter on them redirects away.
 * - A disabled or unknown language redirects to the default; an explicit
 *   default prefix/parameter redirects to the canonical URL.
 * - Redirects of non-GET requests use 308, which keeps the method and body.
 */
import { joinMount } from './mount.ts';
import { negotiateLocale } from './negotiate.ts';
import { normalizeLocaleCode } from './locales.ts';
import type { LocaleRouting, PublicLocation } from './routing/strategy.ts';
import type { I18nSettings } from './settings.ts';

/** First path segments (under the mount) that never carry a language. */
export const UNLOCALIZED_SEGMENTS: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'images',
  '_astro',
  '_image',
  '_actions',
  '_server-islands',
  'cdn-cgi',
]);

/** Single files under the mount that never carry a language. */
export const UNLOCALIZED_FILES: ReadonlySet<string> = new Set(['/robots.txt', '/sitemap.xml', '/favicon.svg']);

/**
 * The query parameter public API endpoints read their language from
 * (`/shop/api/cart?lang=it`): an API has no language in its path, but its
 * redirects, messages and, later, content answer in the caller's language.
 */
export const API_LANGUAGE_PARAM = 'lang';

/** Public API endpoints that take `?lang=`. Admin, webhooks and internal ones never do. */
export function isLanguageAwareApi(path: string): boolean {
  return path.startsWith('/api/') && !/^\/api\/(admin|webhook|internal)(\/|$)/.test(path);
}

/** Whether a logical path has a language (pages, partials) or not (admin, API, assets). */
export function isLocalizedPath(path: string): boolean {
  if (UNLOCALIZED_FILES.has(path)) return false;
  return !UNLOCALIZED_SEGMENTS.has(path.split('/')[1] ?? '');
}

export type Resolution =
  | { action: 'outside' }
  | {
      action: 'redirect';
      status: 301 | 302 | 308;
      /** Relative ('/shop/cart') unless the target is on another host. */
      location: string;
      /** True for the preference-based home redirect: never cache it. */
      negotiated: boolean;
    }
  | {
      action: 'serve';
      locale: string;
      /** Logical path: no language, no mount. */
      path: string;
      localized: boolean;
      /** Mount + logical path: the route Astro should render. */
      internalPath: string;
      /** True when the public path differs from internalPath (prefix strategy). */
      rewrite: boolean;
    };

export interface ResolveOptions {
  mount: string;
  method?: string;
  /** Only read for the home-page suggestion with `detect: 'root'`. */
  preferred?: { cookie?: string | null; acceptLanguage?: string | null };
}

/** A PublicLocation as a URL string, keeping the request's other query params. */
export function locationToString(
  loc: PublicLocation,
  current: URL,
  strategyParam?: string,
  search: URLSearchParams = current.searchParams,
): string {
  const params = new URLSearchParams(search);
  if (strategyParam) params.delete(strategyParam);
  for (const [k, v] of loc.params) params.set(k, v);
  const query = params.toString();
  const tail = loc.pathname + (query ? '?' + query : '');
  if (loc.host && loc.host !== current.host.toLowerCase()) return `${current.protocol}//${loc.host}${tail}`;
  return tail;
}

export function resolveRequestLocale(
  url: URL,
  routing: LocaleRouting,
  settings: I18nSettings,
  options: ResolveOptions,
): Resolution {
  const match = routing.match(url);
  if (match.kind === 'outside') return { action: 'outside' };

  const { path, locale: named } = match;
  const localized = isLocalizedPath(path);
  const def = settings.defaultLocale;
  const safe = options.method === undefined || options.method === 'GET' || options.method === 'HEAD';
  const permanent = safe ? 301 : 308;
  const redirect = (locale: string, isLocalized: boolean): Resolution => ({
    action: 'redirect',
    status: permanent,
    location: locationToString(routing.locate(path, locale, isLocalized), url, routing.param),
    negotiated: false,
  });
  const serve = (locale: string): Resolution => ({
    action: 'serve',
    locale,
    path,
    localized,
    internalPath: joinMount(options.mount, path),
    rewrite: routing.kind === 'prefix' && named !== null,
  });

  const enabled = (code: string | null): string | null =>
    code !== null && settings.enabledLocales.includes(code) ? code : null;

  if (!localized) {
    // No language in the path. A public API may still answer in one, named by
    // ?lang= (never rewritten: no body is ever touched on these routes).
    const api = isLanguageAwareApi(path);
    const asked = api ? enabled(normalizeLocaleCode(url.searchParams.get(API_LANGUAGE_PARAM))) : null;
    if (named === null) return serve(asked ?? def);
    // A host names its language: unlocalized surfaces simply live on every host.
    if (routing.kind === 'domain') return serve(asked ?? enabled(named) ?? def);
    // Query strategy on an API: its own parameter is a language too.
    if (routing.kind === 'query' && api) return serve(asked ?? enabled(named) ?? def);
    // A prefix (or a query language) on a surface that has none: drop it,
    // carrying an API's language over as ?lang=.
    const carry = api ? enabled(named) : null;
    const search = new URLSearchParams(url.searchParams);
    if (carry && carry !== def) search.set(API_LANGUAGE_PARAM, carry);
    return {
      action: 'redirect',
      status: permanent,
      location: locationToString(routing.locate(path, def, false), url, routing.param, search),
      negotiated: false,
    };
  }

  if (named !== null) {
    if (!settings.enabledLocales.includes(named)) return redirect(def, true);
    if (routing.kind === 'domain') return serve(named);
    if (named === def && !(routing.kind === 'prefix' && settings.prefixDefault)) return redirect(def, true);
    return serve(named);
  }

  if (routing.kind === 'prefix' && settings.prefixDefault) return redirect(def, true);

  if (settings.detect === 'root' && path === '/' && safe && options.preferred) {
    const { cookie, acceptLanguage } = options.preferred;
    const pick =
      (cookie && settings.enabledLocales.includes(cookie) ? cookie : null) ??
      negotiateLocale(acceptLanguage, settings.enabledLocales);
    if (pick && pick !== def) {
      return {
        action: 'redirect',
        status: 302,
        location: locationToString(routing.locate('/', pick, true), url, routing.param),
        negotiated: true,
      };
    }
  }
  return serve(def);
}
