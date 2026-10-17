/**
 * Public surface of the i18n engine. Everything here is pure TypeScript: no
 * Cloudflare, Astro, config, or feature imports (engine-boundary.test.ts).
 * Runtime glue (settings from D1, the middleware step) lives in features/i18n.
 */
export { escapeHtml, formatMessage, createTranslator } from './format';
export type { Message, Params, PluralMessage, Translator } from './format';
export { BUNDLED_CATALOGS, SOURCE_CATALOG } from './catalog';
export type { Catalog, MessageKey } from './catalog';
export {
  BUILTIN_LOCALES,
  UI_SOURCE_LOCALE,
  createLocaleRegistry,
  fallbackChain,
  isSupportedLocale,
  normalizeLocaleCode,
} from './locales';
export type { LocaleInfo, LocaleRegistry } from './locales';
export { createI18n, enI18n } from './translator';
export type { I18n, I18nOptions } from './translator';
export { checkCatalog, checkSourceCatalog, placeholders } from './check';
export type { CatalogReport } from './check';
