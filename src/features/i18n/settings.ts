/**
 * The store's language settings: stored as `i18n_*` rows in D1 (read in the
 * same batch as every other setting) and resolved by the pure engine. Pure
 * itself — the middleware passes the rows it already loaded.
 */
import {
  BUILTIN_LOCALES,
  DEFAULT_I18N_SETTINGS,
  resolveI18nSettings,
  type I18nSettings,
  type LocaleRegistry,
} from '../../i18n';
import type { SettingKey, StoreSettings } from '../settings/db';

/** Supported languages. A clone extends this with createLocaleRegistry(). */
export const LOCALE_REGISTRY: LocaleRegistry = BUILTIN_LOCALES;

/**
 * Effective language settings. No stored rows (every existing store) resolves
 * to one language with today's URLs.
 */
export function languageSettings(store: StoreSettings | undefined): I18nSettings {
  return resolveI18nSettings(store?.i18n ?? {}, LOCALE_REGISTRY);
}

/** Whether the store serves more than one language. */
export function isMultilingual(settings: I18nSettings): boolean {
  return settings.enabledLocales.length > 1;
}

/**
 * Settings → the rows to store. A value equal to the built-in default is
 * written as null (row deleted), so a store that turns languages back off
 * returns to exactly the state of one that never had them.
 */
export function languageRows(settings: I18nSettings): Array<[SettingKey, string | null]> {
  const d = DEFAULT_I18N_SETTINGS;
  const keep = <T>(value: T, fallback: T, text: string): string | null => (value === fallback ? null : text);
  const enabled = settings.enabledLocales.join(',');
  return [
    ['i18n_default_locale', keep(settings.defaultLocale, d.defaultLocale, settings.defaultLocale)],
    ['i18n_content_source_locale', keep(settings.contentSourceLocale, settings.defaultLocale, settings.contentSourceLocale)],
    ['i18n_enabled_locales', keep(enabled, settings.defaultLocale, enabled)],
    ['i18n_routing', keep(settings.routing, d.routing, settings.routing)],
    ['i18n_prefix_default', settings.prefixDefault ? '1' : null],
    ['i18n_query_param', keep(settings.queryParam, d.queryParam, settings.queryParam)],
    ['i18n_detect', settings.detect === 'root' ? 'root' : null],
    ['i18n_admin_locale', keep(settings.adminLocale, settings.defaultLocale, settings.adminLocale)],
  ];
}
