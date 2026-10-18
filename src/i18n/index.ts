/**
 * Public surface of the i18n engine. Everything here is pure TypeScript: no
 * Cloudflare, Astro, config, or feature imports (engine-boundary.test.ts).
 * Runtime glue (settings from D1, the middleware step) lives in features/i18n.
 */
export { escapeHtml, formatMessage, createTranslator } from './format.ts';
export type { Message, Params, PluralMessage, Translator } from './format.ts';
export { BUNDLED_CATALOGS, SOURCE_CATALOG } from './catalog.ts';
export type { Catalog, MessageKey } from './catalog.ts';
export {
  BUILTIN_LOCALES,
  UI_SOURCE_LOCALE,
  createLocaleRegistry,
  fallbackChain,
  isSupportedLocale,
  normalizeLocaleCode,
} from './locales.ts';
export type { LocaleInfo, LocaleRegistry } from './locales.ts';
export { createI18n, enI18n } from './translator.ts';
export type { I18n, I18nOptions } from './translator.ts';
export { checkCatalog, checkSourceCatalog, placeholders } from './check.ts';
export type { CatalogReport } from './check.ts';
export { joinMount, mountToBase, normalizeMountPath, stripMount } from './mount.ts';
export {
  DEFAULT_I18N_SETTINGS,
  RESERVED_SEGMENTS,
  checkContentSourceChange,
  describeDefaultLocaleChange,
  resolveI18nSettings,
  validateI18nSettings,
} from './settings.ts';
export type {
  DefaultLocaleChange,
  I18nSettings,
  RoutingStrategy,
  SettingsIssue,
  ValidateOptions,
} from './settings.ts';
export { createRouting } from './routing/index.ts';
export type { LocaleMatch, LocaleRouting, PublicLocation, RoutingContext } from './routing/index.ts';
export { negotiateLocale, parseAcceptLanguage } from './negotiate.ts';
export type { LanguageRange } from './negotiate.ts';
export {
  API_LANGUAGE_PARAM,
  UNLOCALIZED_FILES,
  UNLOCALIZED_SEGMENTS,
  isLanguageAwareApi,
  isLocalizedPath,
  locationToString,
  resolveRequestLocale,
} from './resolve.ts';
export type { Resolution, ResolveOptions } from './resolve.ts';
export { createLocaleUrls, hreflangTag, rootHref } from './urls.ts';
export type { Alternate, Href, LocaleUrls, LocaleUrlsInput, UrlOptions } from './urls.ts';
