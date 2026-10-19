/**
 * Multilingual search signals: which language versions of a page exist, its
 * canonical URL, its hreflang alternates and its Open Graph locales. Pure, and
 * the ONE place these rules live, so the HTML head and the sitemap can never
 * disagree.
 *
 * A language version EXISTS ("is localized") when its main content is in that
 * language — not merely its interface. Following Google Search Central, a page
 * whose interface is Italian but whose main content still falls back to the
 * English text is a duplicate of the English page, not a translation:
 *
 * - its canonical is the source-language URL (the original it duplicates);
 * - it carries no hreflang, and no other page lists it as an alternate;
 * - the sitemap leaves it out.
 *
 * A localized version is self-canonical and lists every localized version,
 * itself included, plus x-default (the default language) when that version
 * exists — so the annotations are reciprocal by construction. A store with one
 * language gets no hreflang at all, exactly as before.
 */
import type { I18nSettings } from '../../i18n/settings.ts';
import type { LocaleRegistry } from '../../i18n/locales.ts';
import { hreflangTag } from '../../i18n/urls.ts';

export interface SeoAlternate {
  hreflang: string;
  href: string;
}

export interface PageSeo {
  /** Absolute canonical URL (mount and language included). */
  canonical: string;
  /** Whether this language version is a real translation (see above). */
  localized: boolean;
  /** hreflang links, empty unless localized and there is more than one version. */
  alternates: SeoAlternate[];
  /** og:locale (en_US), and og:locale:alternate for the other localized versions. */
  ogLocale: string;
  ogLocaleAlternates: string[];
  /** Language of the main content (the source one on a fallback page). */
  contentLanguage: string;
}

/**
 * Where a page's content exists: 'all' for interface pages (catalog, home),
 * or the languages a piece of content is translated into. The content source
 * language always has it; only enabled languages count.
 */
export type Availability = 'all' | readonly string[];

export function localizedLocales(settings: I18nSettings, available: Availability): string[] {
  return settings.enabledLocales.filter(
    (code) => available === 'all' || code === settings.contentSourceLocale || available.includes(code),
  );
}

const ogTag = (registry: LocaleRegistry, code: string) => (registry[code]?.intl ?? code).replace('-', '_');

export function pageSeo(input: {
  settings: I18nSettings;
  registry: LocaleRegistry;
  /** The language this request renders. */
  locale: string;
  /** Absolute URL of a logical path in a language (the central URL builder). */
  absolute: (path: string, locale: string) => string;
  /** The page's logical path ('/products/strap'). */
  path: string;
  available: Availability;
}): PageSeo {
  const { settings, registry, locale, absolute, path } = input;
  const versions = localizedLocales(settings, input.available);
  const multilingual = settings.enabledLocales.length > 1;
  const localized = !multilingual || versions.includes(locale);
  // A fallback page points at the original it duplicates.
  const contentLanguage = localized
    ? locale
    : versions.includes(settings.contentSourceLocale)
      ? settings.contentSourceLocale
      : (versions[0] ?? settings.defaultLocale);
  const alternates: SeoAlternate[] =
    localized && multilingual && versions.length > 1
      ? [
          ...versions.map((code) => ({ hreflang: hreflangTag(code), href: absolute(path, code) })),
          ...(versions.includes(settings.defaultLocale)
            ? [{ hreflang: 'x-default', href: absolute(path, settings.defaultLocale) }]
            : []),
        ]
      : [];
  return {
    canonical: absolute(path, contentLanguage),
    localized,
    alternates,
    ogLocale: ogTag(registry, locale),
    ogLocaleAlternates: alternates.length ? versions.filter((c) => c !== locale).map((c) => ogTag(registry, c)) : [],
    contentLanguage,
  };
}

/**
 * The translation completeness rule, per entity: which translated fields make
 * a language version a translation. Secondary fields — option and add-on
 * labels, image alt text, the product's option name — fall back without
 * demoting the page; the main content does not.
 *
 * - product: name, and the description when the original has one;
 * - category: name;
 * - page: title, and the body when the original has one.
 */
export type CompletenessEntity = 'product' | 'category' | 'page';

const REQUIRED: Record<CompletenessEntity, Array<{ field: string; whenSource?: string }>> = {
  product: [{ field: 'name' }, { field: 'description', whenSource: 'description' }],
  category: [{ field: 'name' }],
  page: [{ field: 'title' }, { field: 'body_markdown', whenSource: 'body_markdown' }],
};

const hasText = (v: unknown) => typeof v === 'string' && v.trim() !== '';

export function isCompleteTranslation(
  entity: CompletenessEntity,
  source: Record<string, unknown>,
  translation: Record<string, unknown> | undefined,
): boolean {
  if (!translation) return false;
  return REQUIRED[entity].every(({ field, whenSource }) => {
    if (whenSource && !hasText(source[whenSource])) return true;
    const value = translation[field];
    // '' is a deliberate empty value: translated, on purpose.
    return value !== null && value !== undefined;
  });
}

/** The languages a row is fully translated into (its source language aside). */
export function translatedLocales(
  entity: CompletenessEntity,
  source: Record<string, unknown>,
  byLocale: ReadonlyMap<string, Record<string, unknown>> | undefined,
): string[] {
  return [...(byLocale ?? [])].filter(([, t]) => isCompleteTranslation(entity, source, t)).map(([code]) => code);
}

export interface SitemapEntry {
  loc: string;
  alternates: SeoAlternate[];
}

/**
 * The sitemap's URLs: one per localized version of each page, each carrying
 * the same hreflang set as that version's HTML head (pageSeo, the one rule).
 * Fallback versions are not listed — they are not translations.
 */
export function sitemapEntries(
  settings: I18nSettings,
  registry: LocaleRegistry,
  absolute: (path: string, locale: string) => string,
  pages: Array<{ path: string; available: Availability }>,
): SitemapEntry[] {
  return pages.flatMap(({ path, available }) =>
    localizedLocales(settings, available).map((locale) => {
      const seo = pageSeo({ settings, registry, locale, absolute, path, available });
      return { loc: seo.canonical, alternates: seo.alternates };
    }),
  );
}
