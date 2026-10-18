/**
 * Editorial content in other languages (migrations/0041). Pure: what can be
 * translated, which language needs translating, and the field-by-field
 * fallback. The D1 reads and writes live in db.ts.
 *
 * The main tables hold the source language. A translation row only ever
 * overrides EDITORIAL fields, listed here — prices, stock, SKUs, weights and
 * status have no translation column, so no translation can touch them.
 */
import type { I18nSettings } from '../../i18n/settings.ts';

export const TRANSLATABLE = {
  product: { table: 'product_translations', key: 'product_id', fields: ['name', 'description', 'variant_label'] },
  variant: { table: 'product_variant_translations', key: 'variant_id', fields: ['label'] },
  extra: { table: 'product_extra_translations', key: 'extra_id', fields: ['label'] },
  image: { table: 'product_image_translations', key: 'image_id', fields: ['alt'] },
  category: { table: 'category_translations', key: 'category_id', fields: ['name'] },
  page: { table: 'page_translations', key: 'page_id', fields: ['title', 'body_markdown'] },
  menuItem: { table: 'menu_item_translations', key: 'menu_item_id', fields: ['label'] },
} as const;

export type TranslatableEntity = keyof typeof TRANSLATABLE;
export type TranslatableField<E extends TranslatableEntity> = (typeof TRANSLATABLE)[E]['fields'][number];

/**
 * One language's values for one row. A missing or null field is "not
 * translated" (fall back); an empty string is a deliberate empty value.
 */
export type TranslationFields<E extends TranslatableEntity> = Partial<Record<TranslatableField<E>, string | null>>;

/** The translations a page loaded, by entity and row id. */
export interface TranslationSet {
  readonly locale: string | null;
  get<E extends TranslatableEntity>(entity: E, id: number): TranslationFields<E> | undefined;
}

export const NO_TRANSLATIONS: TranslationSet = { locale: null, get: () => undefined };

export function translationSet(
  locale: string,
  rows: Partial<Record<TranslatableEntity, Map<number, Record<string, string | null>>>>,
): TranslationSet {
  return {
    locale,
    get: (entity, id) => rows[entity]?.get(id) as never,
  };
}

/**
 * The language whose translations a request reads, or null when it reads the
 * main tables as they are: the source language itself, a language the store
 * has not enabled, and every single-language store. Null costs no query.
 */
export function translationLocale(settings: I18nSettings, locale: string): string | null {
  if (locale === settings.contentSourceLocale) return null;
  return settings.enabledLocales.includes(locale) ? locale : null;
}

/**
 * The row in the request's language: each translated field replaces the source
 * value, every other field — commercial ones included — is the row's own.
 * Returns the row itself when nothing applies, a copy otherwise.
 */
export function translated<E extends TranslatableEntity, T extends object>(
  set: TranslationSet,
  entity: E,
  row: T & { id: number },
): T {
  const t = set.get(entity, row.id);
  if (!t) return row;
  let out: T | null = null;
  for (const field of TRANSLATABLE[entity].fields) {
    const value = (t as Record<string, string | null | undefined>)[field];
    if (value === null || value === undefined) continue;
    out ??= { ...row };
    (out as Record<string, unknown>)[field] = value;
  }
  return out ?? row;
}

/** Every row of a list, in the request's language. */
export function translatedAll<E extends TranslatableEntity, T extends object>(
  set: TranslationSet,
  entity: E,
  rows: Array<T & { id: number }>,
): T[] {
  return set.locale ? rows.map((r) => translated(set, entity, r)) : rows;
}

/**
 * A field as submitted from the admin form: blank means "not translated"
 * (NULL, falls back), unless the admin marked it empty on purpose.
 */
export function submittedField(
  raw: unknown,
  { emptyOnPurpose = false, multiline = false }: { emptyOnPurpose?: boolean; multiline?: boolean } = {},
): string | null {
  const text = typeof raw === 'string' ? raw.replace(/\r\n/g, '\n') : '';
  // Markdown keeps its own leading whitespace (indented code, nested lists).
  if (text.trim() !== '') return multiline ? text.trimEnd() : text.trim();
  return emptyOnPurpose ? '' : null;
}

/** True when a translation row carries no value at all (and can be dropped). */
export function isBlankTranslation(fields: Record<string, string | null | undefined>): boolean {
  return Object.values(fields).every((v) => v === null || v === undefined);
}
