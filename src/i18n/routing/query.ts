/**
 * Query-parameter strategy: the language is ?lang=it on any URL under the
 * mount. The default language has no parameter. Paths never change, so no
 * rewrite is needed; every internal link must carry the parameter.
 */
import { joinMount, stripMount } from '../mount.ts';
import type { LocaleMatch, LocaleRouting, PublicLocation, RoutingContext } from './strategy.ts';

export function queryRouting(ctx: RoutingContext): LocaleRouting {
  const { settings, mount } = ctx;
  const param = settings.queryParam;
  return {
    kind: 'query',
    param,
    match(url: URL): LocaleMatch {
      const path = stripMount(url.pathname, mount);
      if (path === null) return { kind: 'outside' };
      const raw = url.searchParams.get(param);
      // Any value is an explicit attempt: resolve redirects unknown ones away.
      return { kind: 'match', locale: raw === null ? null : raw.trim().toLowerCase(), path };
    },
    locate(path: string, locale: string, localized: boolean): PublicLocation {
      const params: Array<[string, string]> =
        localized && locale !== settings.defaultLocale ? [[param, locale]] : [];
      return { pathname: joinMount(mount, path), params };
    },
  };
}
