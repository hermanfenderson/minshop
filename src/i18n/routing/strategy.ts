/**
 * One interface for the three language strategies. A strategy only reads and
 * writes the language part of a URL; the decisions (redirect, default,
 * detection) are made once, in ../resolve, for all of them.
 */
import type { I18nSettings, RoutingStrategy } from '../settings.ts';

export interface RoutingContext {
  settings: I18nSettings;
  /** Normalized mount: '' or '/shop'. */
  mount: string;
  /** Every supported code, enabled or not, so a disabled one is still recognized. */
  known: ReadonlySet<string>;
}

export type LocaleMatch =
  | { kind: 'outside' } // not under the mount: another app's URL
  | {
      kind: 'match';
      /** The language the URL names explicitly (maybe disabled), or null. */
      locale: string | null;
      /** The logical path: no language, no mount. */
      path: string;
    };

/** Where a logical path lives for a language, before it becomes a string. */
export interface PublicLocation {
  /** Set only when the language has its own host (domain strategy). */
  host?: string;
  pathname: string;
  /** Query parameters the strategy adds (query strategy). */
  params: Array<[string, string]>;
}

export interface LocaleRouting {
  readonly kind: RoutingStrategy;
  /** The query parameter this strategy owns, if any (removed when rewriting URLs). */
  readonly param?: string;
  match(url: URL): LocaleMatch;
  /** `localized: false` for surfaces with no language (admin, API, images). */
  locate(path: string, locale: string, localized: boolean): PublicLocation;
}
