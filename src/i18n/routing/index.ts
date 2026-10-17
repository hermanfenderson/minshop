import { BUILTIN_LOCALES, type LocaleRegistry } from '../locales';
import type { I18nSettings } from '../settings';
import { domainRouting } from './domain';
import { prefixRouting } from './prefix';
import { queryRouting } from './query';
import type { LocaleRouting } from './strategy';

export type { LocaleMatch, LocaleRouting, PublicLocation, RoutingContext } from './strategy';

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
