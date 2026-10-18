/**
 * Sub-directory strategy: the language is the first path segment, BEFORE the
 * mount (/it/shop/products/mug). The default language has no prefix unless
 * `prefixDefault` is set.
 */
import { joinMount, stripMount } from '../mount.ts';
import type { LocaleMatch, LocaleRouting, PublicLocation, RoutingContext } from './strategy.ts';

export function prefixRouting(ctx: RoutingContext): LocaleRouting {
  const { settings, mount, known } = ctx;
  return {
    kind: 'prefix',
    match(url: URL): LocaleMatch {
      const first = url.pathname.split('/')[1] ?? '';
      if (known.has(first)) {
        const rest = url.pathname.slice(first.length + 1) || '/';
        const path = stripMount(rest, mount);
        return path === null ? { kind: 'outside' } : { kind: 'match', locale: first, path };
      }
      const path = stripMount(url.pathname, mount);
      return path === null ? { kind: 'outside' } : { kind: 'match', locale: null, path };
    },
    locate(path: string, locale: string, localized: boolean): PublicLocation {
      const prefixed = localized && (locale !== settings.defaultLocale || settings.prefixDefault);
      return { pathname: (prefixed ? '/' + locale : '') + joinMount(mount, path), params: [] };
    },
  };
}
