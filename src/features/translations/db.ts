/**
 * D1 access for editorial translations (migrations/0041). A page names every
 * row it is about to render and reads all their translations in ONE batch —
 * one statement per entity type, never one per row — and a request in the
 * source language reads nothing at all.
 */
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import type { I18nSettings } from '../../i18n/settings.ts';
import {
  NO_TRANSLATIONS,
  TRANSLATABLE,
  isBlankTranslation,
  translated,
  translatedAll,
  translationSet,
  type TranslatableEntity,
  type TranslationFields,
  type TranslationSet,
} from './content.ts';

export type TranslationWants = Partial<Record<TranslatableEntity, Iterable<number | null | undefined>>>;

const idsOf = (ids: Iterable<number | null | undefined>): number[] =>
  [...new Set([...ids].filter((id): id is number => typeof id === 'number'))];

// json_each keeps it one bound parameter whatever the list length (D1 caps a
// statement at 100 parameters).
const selectFor = (db: D1Database, entity: TranslatableEntity, locale: string | null, ids: number[]) => {
  const { table, key, fields } = TRANSLATABLE[entity];
  const where = locale === null ? '' : 'locale = ? AND ';
  const stmt = db.prepare(
    `SELECT ${key} AS id, locale, ${fields.join(', ')}, origin, updated_at FROM ${table}
      WHERE ${where}${key} IN (SELECT value FROM json_each(?))`,
  );
  return locale === null ? stmt.bind(JSON.stringify(ids)) : stmt.bind(locale, JSON.stringify(ids));
};

/**
 * The translations of the named rows in `locale`. Null locale (the source
 * language, or a single-language store) returns the empty set without a query.
 * A read failure — say, a store whose 0041 has not run yet — degrades to the
 * source text rather than failing the page.
 */
export async function loadTranslations(
  db: D1Database,
  locale: string | null,
  wants: TranslationWants,
): Promise<TranslationSet> {
  if (!locale) return NO_TRANSLATIONS;
  const entries = (Object.entries(wants) as Array<[TranslatableEntity, Iterable<number | null | undefined>]>)
    .map(([entity, ids]) => [entity, idsOf(ids)] as const)
    .filter(([, ids]) => ids.length > 0);
  if (entries.length === 0) return translationSet(locale, {});
  try {
    const results = await db.batch(entries.map(([entity, ids]) => selectFor(db, entity, locale, ids)));
    const rows: Partial<Record<TranslatableEntity, Map<number, Record<string, string | null>>>> = {};
    entries.forEach(([entity], i) => {
      rows[entity] = new Map(
        ((results[i]?.results ?? []) as Array<Record<string, string | null> & { id: number }>).map((r) => [r.id, r]),
      );
    });
    return translationSet(locale, rows);
  } catch (err) {
    console.error('Reading translations failed; showing the source text:', err);
    return translationSet(locale, {});
  }
}

export interface StoredTranslation<E extends TranslatableEntity> {
  fields: TranslationFields<E>;
  origin: 'admin' | 'file';
  updatedAt: string;
}

/** Every language's translation of the named rows, for the admin forms. */
export async function translationsByRow<E extends TranslatableEntity>(
  db: D1Database,
  entity: E,
  ids: Iterable<number | null | undefined>,
): Promise<Map<number, Map<string, StoredTranslation<E>>>> {
  const list = idsOf(ids);
  const out = new Map<number, Map<string, StoredTranslation<E>>>();
  if (list.length === 0) return out;
  const { results } = await selectFor(db, entity, null, list).all<Record<string, string | null> & { id: number }>();
  for (const r of results ?? []) {
    const fields = Object.fromEntries(TRANSLATABLE[entity].fields.map((f) => [f, r[f] ?? null])) as TranslationFields<E>;
    const byLocale = out.get(r.id) ?? new Map();
    byLocale.set(r.locale as string, {
      fields,
      origin: r.origin === 'file' ? 'file' : 'admin',
      updatedAt: (r.updated_at as string) ?? '',
    });
    out.set(r.id, byLocale);
  }
  return out;
}

/** The languages an admin can translate into: every enabled one but the source. */
export function translatableLocales(settings: I18nSettings): string[] {
  return settings.enabledLocales.filter((l) => l !== settings.contentSourceLocale);
}

/**
 * The statement that stores one row's translation in one language, for the
 * caller to batch with the rest of its save. All-blank deletes the row, so
 * "not translated" has exactly one representation. Only the entity's
 * editorial columns are written; the source row is never touched.
 */
export function saveTranslationStatement<E extends TranslatableEntity>(
  db: D1Database,
  entity: E,
  id: number,
  locale: string,
  fields: TranslationFields<E>,
): D1PreparedStatement {
  const { table, key, fields: columns } = TRANSLATABLE[entity];
  const values = columns.map((c) => (fields as Record<string, string | null | undefined>)[c] ?? null);
  if (isBlankTranslation(Object.fromEntries(columns.map((c, i) => [c, values[i]])))) {
    return db.prepare(`DELETE FROM ${table} WHERE ${key} = ? AND locale = ?`).bind(id, locale);
  }
  return db
    .prepare(
      `INSERT INTO ${table} (${key}, locale, ${columns.join(', ')}, origin, updated_at)
       VALUES (?, ?, ${columns.map(() => '?').join(', ')}, 'admin', datetime('now'))
       ON CONFLICT(${key}, locale) DO UPDATE SET
         ${columns.map((c) => `${c} = excluded.${c}`).join(', ')},
         origin = 'admin', updated_at = datetime('now')`,
    )
    .bind(id, locale, ...values);
}

/**
 * One purchase line's product, variant and extras in `locale` — what a buy-now
 * checkout shows and snapshots onto the order. One batched read.
 */
export async function translatedPurchase<
  P extends { id: number },
  V extends { id: number },
  X extends { id: number },
>(
  db: D1Database,
  locale: string | null,
  product: P,
  variant: V | null,
  extras: X[],
): Promise<{ product: P; variant: V | null; extras: X[] }> {
  const set = await loadTranslations(db, locale, {
    product: [product.id],
    variant: variant ? [variant.id] : [],
    extra: extras.map((e) => e.id),
  });
  return {
    product: translated(set, 'product', product),
    variant: variant && translated(set, 'variant', variant),
    extras: translatedAll(set, 'extra', extras),
  };
}

/**
 * Every language that has at least one stored translation, of any entity —
 * what the settings page needs to refuse a content-source change that would
 * collide with existing rows.
 */
export async function localesWithTranslations(db: D1Database): Promise<string[]> {
  const union = Object.values(TRANSLATABLE)
    .map((t) => `SELECT DISTINCT locale FROM ${t.table}`)
    .join(' UNION ');
  try {
    const { results } = await db.prepare(union).all<{ locale: string }>();
    return (results ?? []).map((r) => r.locale);
  } catch (err) {
    console.error('Listing translated languages failed:', err);
    return [];
  }
}

/**
 * A product's option name ("Size") in `locale`, for the "choose a size"
 * message the variant check sends a shopper back with. Null when the product
 * names none in any language.
 */
export async function translatedVariantLabel(
  db: D1Database,
  locale: string | null,
  product: { id: number; variant_label: string | null },
): Promise<string | null> {
  const set = await loadTranslations(db, locale, { product: [product.id] });
  return translated(set, 'product', product).variant_label || null;
}
