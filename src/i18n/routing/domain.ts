/**
 * Domain strategy: each language has its own host (shop.example.it). Engine
 * only in the first version: tested here, not yet selectable in the admin.
 * A host with no language mapped serves the default language.
 */
import { joinMount, stripMount } from '../mount.ts';
import type { LocaleMatch, LocaleRouting, PublicLocation, RoutingContext } from './strategy.ts';

export function domainRouting(ctx: RoutingContext): LocaleRouting {
  const { settings, mount } = ctx;
  const byHost = new Map(Object.entries(settings.domains).map(([code, host]) => [host, code]));
  return {
    kind: 'domain',
    match(url: URL): LocaleMatch {
      const path = stripMount(url.pathname, mount);
      if (path === null) return { kind: 'outside' };
      return { kind: 'match', locale: byHost.get(url.host.toLowerCase()) ?? null, path };
    },
    locate(path: string, locale: string, localized: boolean): PublicLocation {
      const host = localized ? settings.domains[locale] : undefined;
      return { ...(host && { host }), pathname: joinMount(mount, path), params: [] };
    },
  };
}
