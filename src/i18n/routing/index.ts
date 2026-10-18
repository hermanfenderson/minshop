import { BUILTIN_LOCALES, type LocaleRegistry } from '../locales.ts';
import type { I18nSettings } from '../settings.ts';
import { domainRouting } from './domain.ts';
import { prefixRouting } from './prefix.ts';
import { queryRouting } from './query.ts';
import type { LocaleRouting } from './strategy.ts';

export type { LocaleMatch, LocaleRouting, PublicLocation, RoutingContext } from './strategy.ts';

/** The strategy the settings select, bound to a mount. */
export function createRouting(
  settings: I18nSettings,
  mount: string,
  registry: LocaleRegistry = BUILTIN_LOCALES,
): LocaleRouting {
  const ctx = { settings, mount, known: new Set(Object.keys(registry)) };
  switch (settings.routing) {
    case 'query':
      return queryRouting(ctx);
    case 'domain':
      return domainRouting(ctx);
    default:
      return prefixRouting(ctx);
  }
}
