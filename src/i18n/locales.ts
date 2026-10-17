/**
 * The registry of SUPPORTED languages: those with a UI catalog in the code.
 * Which of them a store ENABLES, and which is its default, are runtime settings
 * (see ./settings); this file only says what exists.
 *
 * Codes are lowercase BCP 47 ('en', 'it', 'pt-br'). Each language names its
 * fallbacks for UI messages; English, the source catalog, always closes the
 * chain, so a partial translation degrades to English instead of raw keys.
 */

/** The language the UI catalogs are written in: every chain ends here. */
export const UI_SOURCE_LOCALE = 'en';

export interface LocaleInfo {
  /** Native name, for language switchers ("Italiano"). */
  label: string;
  /** BCP 47 tag handed to Intl for numbers, prices, and dates. */
  intl: string;
  /** Text direction, for `<html dir>`. */
  dir: 'ltr' | 'rtl';
  /** UI fallbacks before English, most specific first (pt-br → ['pt']). */
  fallback?: string[];
}

export type LocaleRegistry = Readonly<Record<string, LocaleInfo>>;

/**
 * Languages upstream bundles a catalog for. `en` maps to en-US so English
 * formatting is unchanged from before i18n.
 */
export const BUILTIN_LOCALES: LocaleRegistry = Object.freeze({
  en: { label: 'English', intl: 'en-US', dir: 'ltr' },
  it: { label: 'Italiano', intl: 'it-IT', dir: 'ltr' },
});

const CODE = /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/;

/** Canonical form of a language code ('IT' → 'it', 'pt_BR' → 'pt-br'), or null if malformed. */
export function normalizeLocaleCode(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const code = value.trim().toLowerCase().replace(/_/g, '-');
  return CODE.test(code) ? code : null;
}

/**
 * The built-in registry plus a clone's own languages (from store.config.ts).
 * A clone entry with a built-in code replaces it. Throws on a malformed code or
 * an Intl tag the runtime can't format with — a build-time mistake, not data.
 */
export function createLocaleRegistry(extra: Record<string, LocaleInfo> = {}): LocaleRegistry {
  const merged: Record<string, LocaleInfo> = { ...BUILTIN_LOCALES };
  for (const [raw, info] of Object.entries(extra)) {
    const code = normalizeLocaleCode(raw);
    if (!code) throw new Error(`i18n: "${raw}" is not a valid language code`);
    if (Intl.NumberFormat.supportedLocalesOf([info.intl]).length === 0) {
      throw new Error(`i18n: Intl has no data for "${info.intl}" (language "${code}")`);
    }
    merged[code] = { ...info, fallback: info.fallback?.map((f) => normalizeLocaleCode(f) ?? f) };
  }
  return Object.freeze(merged);
}

export function isSupportedLocale(registry: LocaleRegistry, code: unknown): code is string {
  return typeof code === 'string' && Object.hasOwn(registry, code);
}

/**
 * Where UI messages for `code` are looked up, in order: the language itself,
 * its declared fallbacks, its base language ('pt-br' → 'pt') when supported,
 * then `tail` (e.g. the store's default language), and English last. Only
 * supported codes appear, each once.
 */
export function fallbackChain(
  registry: LocaleRegistry,
  code: string,
  tail: readonly string[] = [],
): string[] {
  const chain: string[] = [];
  const visit = (c: string): void => {
    if (!isSupportedLocale(registry, c) || chain.includes(c)) return;
    chain.push(c);
    for (const f of registry[c].fallback ?? []) visit(f);
    const base = c.split('-')[0];
    if (base !== c) visit(base);
  };
  visit(code);
  for (const t of tail) visit(t);
  visit(UI_SOURCE_LOCALE);
  return chain;
}
