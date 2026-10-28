/**
 * Request-side helpers for the middleware's language step. Pure: the
 * middleware passes the URL, the mount and the settings it already loaded.
 */
import {
  createI18n,
  createLocaleUrls,
  createRouting,
  isSupportedLocale,
  stripMount,
  type I18n,
  type I18nSettings,
  type Vocabulary,
  type LocaleRegistry,
  type LocaleUrls,
} from '../../i18n';

/**
 * The logical path of a request BEFORE the settings are known, so the
 * middleware can decide what it must read: a supported language prefix ahead
 * of the mount is skipped ('/it/shop/cart' → '/cart'). Null outside the mount.
 */
export function preParsePath(pathname: string, mount: string, registry: LocaleRegistry): string | null {
  const first = pathname.split('/')[1] ?? '';
  if (isSupportedLocale(registry, first)) {
    const behindPrefix = stripMount(pathname.slice(first.length + 1) || '/', mount);
    if (behindPrefix !== null) return behindPrefix;
  }
  return stripMount(pathname, mount);
}

/** Whether the URL names a language (a prefix, or ?lang= / the query parameter). */
export function namesLanguage(url: URL, mount: string, registry: LocaleRegistry, queryParam: string): boolean {
  if (url.searchParams.has('lang') || url.searchParams.has(queryParam)) return true;
  return preParsePath(url.pathname, mount, registry) !== stripMount(url.pathname, mount);
}

export interface RequestLanguage {
  locale: string;
  i18n: I18n;
  urls: LocaleUrls;
}

/** The translator and URL builder for one request's language. */
export function requestLanguage(
  settings: I18nSettings,
  registry: LocaleRegistry,
  mount: string,
  locale: string,
  origin: string,
  current: { path: string; search: string },
  vocabulary?: Vocabulary,
): RequestLanguage {
  return {
    locale,
    // Untranslated UI strings fall back to the store default, then English.
    i18n: createI18n(locale, { registry, tail: [settings.defaultLocale], vocabulary }),
    urls: createLocaleUrls({
      routing: createRouting(settings, mount, registry),
      settings,
      locale,
      origin,
      currentPath: current.path,
      currentSearch: current.search,
    }),
  };
}
