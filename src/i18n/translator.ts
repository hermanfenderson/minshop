/**
 * The bound translator: a language, its fallback chain, and the catalogs.
 * Pure — no Cloudflare or Astro imports — so unit-tested modules and
 * presentation builders can take an `I18n` without touching the runtime.
 */
import { BUNDLED_CATALOGS, type Catalog, type MessageKey } from './catalog';
import { createTranslator, type Message, type Translator } from './format';
import {
  BUILTIN_LOCALES,
  UI_SOURCE_LOCALE,
  fallbackChain,
  isSupportedLocale,
  type LocaleRegistry,
} from './locales';

/** The translator for one language, typed over every catalog key. */
export interface I18n extends Translator<MessageKey> {
  /** Text direction of the language, for `<html dir>`. */
  dir: 'ltr' | 'rtl';
  /** Where messages are looked up, in order (always ends with English). */
  chain: readonly string[];
}

export interface I18nOptions {
  registry?: LocaleRegistry;
  catalogs?: Readonly<Record<string, Catalog>>;
  /** Fallbacks after the language's own chain, before English (e.g. the store default). */
  tail?: readonly string[];
}

const cache = new Map<string, I18n>();

/**
 * The translator for `locale`. An unsupported code gets the English
 * translator, so a stale setting can never break a page. Instances for the
 * built-in registry and catalogs are cached (they are immutable).
 */
export function createI18n(locale: string = UI_SOURCE_LOCALE, options: I18nOptions = {}): I18n {
  const registry = options.registry ?? BUILTIN_LOCALES;
  const catalogs = options.catalogs ?? BUNDLED_CATALOGS;
  const tail = options.tail ?? [];
  const code = isSupportedLocale(registry, locale) ? locale : UI_SOURCE_LOCALE;
  const cacheable = registry === BUILTIN_LOCALES && catalogs === BUNDLED_CATALOGS;
  const cacheKey = `${code}|${tail.join(',')}`;
  if (cacheable) {
    const hit = cache.get(cacheKey);
    if (hit) return hit;
  }

  const chain = fallbackChain(registry, code, tail);
  const sources = chain.map((c) => catalogs[c] ?? {}) as Array<Record<string, Message | undefined>>;
  const lookup = (key: MessageKey): Message | undefined => {
    for (const source of sources) {
      const message = source[key];
      if (message !== undefined) return message;
    }
    return undefined;
  };
  const info = registry[code];
  const i18n: I18n = {
    ...createTranslator<MessageKey>(code, info.intl, lookup),
    dir: info.dir,
    chain,
  };
  if (cacheable) cache.set(cacheKey, i18n);
  return i18n;
}

/** English — the default for pure code and tests that don't pass a translator. */
export const enI18n: I18n = createI18n(UI_SOURCE_LOCALE);
