/**
 * The runtime language settings (stored in D1, edited in Admin → Languages)
 * and the rules for changing them. Pure: the D1 reading and writing live in
 * features/i18n; this module only resolves, validates, and explains.
 *
 * Two reference languages with different jobs:
 * - `defaultLocale` is a ROUTING choice: the language of the interface and of
 *   the URLs without a language prefix.
 * - `contentSourceLocale` is a fact about the DATA: the language the main
 *   tables (products, categories, pages) are written in. Untranslated content
 *   falls back to it. Changing the default never moves or migrates text.
 */
import {
  BUILTIN_LOCALES,
  UI_SOURCE_LOCALE,
  isSupportedLocale,
  normalizeLocaleCode,
  type LocaleRegistry,
} from './locales';

export type RoutingStrategy = 'prefix' | 'query' | 'domain';

export interface I18nSettings {
  defaultLocale: string;
  contentSourceLocale: string;
  /** Always contains defaultLocale, which comes first. */
  enabledLocales: string[];
  routing: RoutingStrategy;
  /** prefix only: also prefix the default language (/en/shop/…). */
  prefixDefault: boolean;
  /** query only: the parameter name (?lang=it). */
  queryParam: string;
  /** domain only: language → host ('it' → 'shop.example.it'). */
  domains: Record<string, string>;
  /** 'root': only the home page redirects (302) to a preferred language. */
  detect: 'off' | 'root';
  /** The admin's default language; each browser can switch it. */
  adminLocale: string;
}

/** What a store with no language settings gets: today's behavior, exactly. */
export const DEFAULT_I18N_SETTINGS: Readonly<I18nSettings> = Object.freeze({
  defaultLocale: UI_SOURCE_LOCALE,
  contentSourceLocale: UI_SOURCE_LOCALE,
  enabledLocales: [UI_SOURCE_LOCALE],
  routing: 'prefix',
  prefixDefault: false,
  queryParam: 'lang',
  domains: {},
  detect: 'off',
  adminLocale: UI_SOURCE_LOCALE,
});

/**
 * Top-level path segments a language prefix must never shadow (a 3-letter
 * code like 'api' is a valid BCP 47 shape). Paths under the mount.
 */
export const RESERVED_SEGMENTS: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'images',
  'partials',
  '_astro',
  '_image',
  '_actions',
  '_server-islands',
  'cdn-cgi',
]);

const QUERY_PARAM = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;
const HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*(:\d{1,5})?$/;

function supported(registry: LocaleRegistry, value: unknown): string | null {
  const code = normalizeLocaleCode(value);
  return code && isSupportedLocale(registry, code) ? code : null;
}

/**
 * Lenient resolution for the request path: fills defaults, normalizes codes,
 * drops what isn't supported, and never throws. A bad stored value degrades to
 * a working store; validateI18nSettings() is what stops it being saved.
 */
export function resolveI18nSettings(
  input: Partial<I18nSettings> = {},
  registry: LocaleRegistry = BUILTIN_LOCALES,
): I18nSettings {
  const defaultLocale = supported(registry, input.defaultLocale) ?? DEFAULT_I18N_SETTINGS.defaultLocale;
  const enabled = (input.enabledLocales ?? [])
    .map((c) => supported(registry, c))
    .filter((c): c is string => c !== null && c !== defaultLocale);
  const domains: Record<string, string> = {};
  for (const [raw, host] of Object.entries(input.domains ?? {})) {
    const code = supported(registry, raw);
    if (code && typeof host === 'string') domains[code] = host.trim().toLowerCase();
  }
  return {
    defaultLocale,
    // Unset source = the default at the time the store first saved its languages.
    contentSourceLocale: supported(registry, input.contentSourceLocale) ?? defaultLocale,
    enabledLocales: [defaultLocale, ...new Set(enabled)],
    routing: input.routing === 'query' || input.routing === 'domain' ? input.routing : 'prefix',
    prefixDefault: input.prefixDefault === true,
    queryParam:
      input.queryParam && QUERY_PARAM.test(input.queryParam) ? input.queryParam : DEFAULT_I18N_SETTINGS.queryParam,
    domains,
    detect: input.detect === 'root' ? 'root' : 'off',
    adminLocale: supported(registry, input.adminLocale) ?? defaultLocale,
  };
}

export interface SettingsIssue {
  field: keyof I18nSettings | 'mountPath';
  /** Stable code for the admin to translate. */
  code: string;
  /** English explanation, for logs and tests. */
  message: string;
}

export interface ValidateOptions {
  registry?: LocaleRegistry;
  /** Normalized mount ('' or '/shop'), to catch a prefix shadowing it. */
  mount?: string;
  /** The domain strategy is engine-only in the first version (review decision). */
  allowDomainRouting?: boolean;
}

/**
 * Strict validation for saving from the admin. Takes the values as entered
 * (codes may still need normalizing) and reports every problem at once.
 */
export function validateI18nSettings(input: I18nSettings, options: ValidateOptions = {}): SettingsIssue[] {
  const registry = options.registry ?? BUILTIN_LOCALES;
  const issues: SettingsIssue[] = [];
  const issue = (field: SettingsIssue['field'], code: string, message: string) =>
    issues.push({ field, code, message });

  const enabled = input.enabledLocales.map((c) => normalizeLocaleCode(c) ?? String(c));
  if (enabled.length === 0) issue('enabledLocales', 'enabled.empty', 'Enable at least one language.');
  for (const code of enabled) {
    if (!isSupportedLocale(registry, code)) {
      issue('enabledLocales', 'enabled.unsupported', `"${code}" has no catalog in this store.`);
    }
  }
  if (new Set(enabled).size !== enabled.length) {
    issue('enabledLocales', 'enabled.duplicate', 'A language is enabled twice.');
  }

  const def = normalizeLocaleCode(input.defaultLocale);
  if (!def || !isSupportedLocale(registry, def)) {
    issue('defaultLocale', 'default.unsupported', `"${input.defaultLocale}" has no catalog in this store.`);
  } else if (!enabled.includes(def)) {
    issue('defaultLocale', 'default.notEnabled', 'The default language must be enabled.');
  }

  for (const field of ['contentSourceLocale', 'adminLocale'] as const) {
    const code = normalizeLocaleCode(input[field]);
    if (!code || !isSupportedLocale(registry, code)) {
      issue(field, `${field}.unsupported`, `"${input[field]}" has no catalog in this store.`);
    }
  }

  if (!['prefix', 'query', 'domain'].includes(input.routing)) {
    issue('routing', 'routing.unknown', `Unknown routing strategy "${input.routing}".`);
  } else if (input.routing === 'domain' && !options.allowDomainRouting) {
    issue('routing', 'routing.domainUnavailable', 'Domain routing is not available yet.');
  }

  if (input.routing === 'prefix') {
    const mountHead = (options.mount ?? '').split('/')[1];
    for (const code of enabled) {
      if (RESERVED_SEGMENTS.has(code)) {
        issue('enabledLocales', 'prefix.reserved', `"/${code}/" is a reserved path and can't be a language prefix.`);
      }
      if (mountHead && code === mountHead) {
        issue('enabledLocales', 'prefix.mount', `"/${code}/" is also the mount path.`);
      }
    }
  }

  if (input.routing === 'query' && !QUERY_PARAM.test(input.queryParam)) {
    issue('queryParam', 'query.invalid', `"${input.queryParam}" is not a valid parameter name.`);
  }

  if (input.routing === 'domain') {
    const hosts = new Map<string, string>();
    for (const code of enabled) {
      const host = input.domains[code]?.trim().toLowerCase();
      if (!host) {
        issue('domains', 'domain.missing', `"${code}" has no domain.`);
      } else if (!HOST.test(host)) {
        issue('domains', 'domain.invalid', `"${host}" is not a valid host name.`);
      } else if (hosts.has(host)) {
        issue('domains', 'domain.duplicate', `"${host}" is used by both "${hosts.get(host)}" and "${code}".`);
      } else {
        hosts.set(host, code);
      }
    }
  }
  return issues;
}

/** What changing the default language does, so the admin can ask for confirmation. */
export interface DefaultLocaleChange {
  from: string;
  to: string;
  /** Always true: this is a controlled operation, never a silent toggle. */
  requiresProcedure: true;
  /** Stable codes for the admin to explain each consequence. */
  effects: string[];
}

/**
 * Explains a change of `defaultLocale`, or returns null when there is none.
 * The change is allowed, but it changes what the URLs WITHOUT a language
 * prefix mean: links, bookmarks, search results and caches that point at them
 * start serving another language. It needs a controlled procedure: confirm,
 * purge the cache, resubmit the sitemap. No text moves: the content source
 * language is a separate setting.
 */
export function describeDefaultLocaleChange(prev: I18nSettings, next: I18nSettings): DefaultLocaleChange | null {
  if (prev.defaultLocale === next.defaultLocale) return null;
  const effects = ['unprefixedUrlsChangeLanguage'];
  if (next.routing === 'prefix' && !next.prefixDefault) effects.push('previousDefaultGetsPrefix');
  if (next.routing === 'query') effects.push('previousDefaultGetsParam');
  effects.push('cachePurgeRequired', 'sitemapAndHreflangChange');
  if (prev.contentSourceLocale !== next.defaultLocale) effects.push('contentStaysInSourceLanguage');
  return { from: prev.defaultLocale, to: next.defaultLocale, requiresProcedure: true, effects };
}

/**
 * Whether `contentSourceLocale` may change. It only relabels the language the
 * main tables are written in, so it is safe when no translation rows exist in
 * the new source language; otherwise those rows would collide with the source
 * text, and the change is refused (a guided swap is out of scope for now).
 */
export function checkContentSourceChange(
  prev: I18nSettings,
  next: I18nSettings,
  localesWithTranslations: readonly string[],
): SettingsIssue | null {
  if (prev.contentSourceLocale === next.contentSourceLocale) return null;
  if (!localesWithTranslations.includes(next.contentSourceLocale)) return null;
  return {
    field: 'contentSourceLocale',
    code: 'contentSource.hasTranslations',
    message: `Translations in "${next.contentSourceLocale}" already exist; changing the source would collide with them.`,
  };
}
