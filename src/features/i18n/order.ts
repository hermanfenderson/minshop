/**
 * The language of an order: the one the shopper used at checkout, stored on
 * the order (migrations/0040). Pure, so emails sent from webhooks, the outbox
 * sweep and the cron all resolve it the same way.
 */
import { UI_SOURCE_LOCALE, isSupportedLocale, normalizeLocaleCode, type LocaleRegistry } from '../../i18n/index.ts';
import { BUILTIN_LOCALES } from '../../i18n/locales.ts';

/**
 * The stable language of orders that predate 0040 (or carry an unreadable
 * value). Those were all transacted before the store had languages, in English.
 * Deliberately NOT the store default or the admin language: either can change
 * later, and an old order must not change language with them.
 */
export const LEGACY_ORDER_LOCALE = UI_SOURCE_LOCALE;

/** The language an order is communicated in. */
export function orderLocale(
  stored: string | null | undefined,
  registry: LocaleRegistry = BUILTIN_LOCALES,
): string {
  const code = normalizeLocaleCode(stored);
  return code && isSupportedLocale(registry, code) ? code : LEGACY_ORDER_LOCALE;
}

/**
 * A language received from a public endpoint (the JSON checkout's `locale`),
 * accepted only when it is a supported AND enabled language; otherwise null,
 * so the caller falls back to the request's own language.
 */
export function acceptedLocale(
  value: unknown,
  enabledLocales: readonly string[],
  registry: LocaleRegistry = BUILTIN_LOCALES,
): string | null {
  const code = normalizeLocaleCode(value);
  return code && isSupportedLocale(registry, code) && enabledLocales.includes(code) ? code : null;
}
