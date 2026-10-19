/**
 * Builds the TranslationEditor's rows for each admin editor: the source text
 * beside every stored translation, one read per entity type.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { StoreSettings } from '../settings/db';
import { LOCALE_REGISTRY, languageSettings } from '../i18n/settings';
import { TRANSLATABLE, type TranslatableEntity } from './content';
import { translatableLocales, translationsByRow } from './db';
import { FIELD_RULES, emptyInputName, fieldInputName } from './form';
import type { TranslationRow } from './TranslationEditor.astro';

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  description: 'Description (Markdown)',
  variant_label: 'Option name (e.g. Size)',
  label: 'Label',
  alt: 'Alt text',
  title: 'Title',
  body_markdown: 'Content (Markdown)',
};

const label = (code: string) => LOCALE_REGISTRY[code]?.label ?? code;

/** The original language and the languages an admin can translate into. */
export function editorLanguages(settings: StoreSettings | undefined) {
  const languages = languageSettings(settings);
  return {
    source: { code: languages.contentSourceLocale, label: label(languages.contentSourceLocale) },
    languages: translatableLocales(languages).map((code) => ({ code, label: label(code) })),
  };
}

export interface EditorItem {
  id: number;
  publicId: string | null;
  title?: string;
  /** Source text per translatable field. */
  source: Record<string, string | null>;
}

/** Rows for one entity's items, with every language's stored values. */
export async function editorRows(
  db: D1Database,
  entity: TranslatableEntity,
  items: EditorItem[],
  /** Fields carried but not shown (see TranslationField.hidden). */
  hiddenFields: readonly string[] = [],
): Promise<TranslationRow[]> {
  const withIds = items.filter((i): i is EditorItem & { publicId: string } => i.publicId !== null);
  const stored = await translationsByRow(db, entity, withIds.map((i) => i.id));
  return withIds.map((item) => ({
    title: item.title,
    fields: TRANSLATABLE[entity].fields.map((field) => {
      const rule = FIELD_RULES[entity][field];
      const values: Record<string, string | null> = {};
      for (const [locale, t] of stored.get(item.id) ?? []) {
        values[locale] = (t.fields as Record<string, string | null>)[field] ?? null;
      }
      return {
        name: fieldInputName(entity, item.publicId, field),
        emptyName: rule.allowEmpty ? emptyInputName(entity, item.publicId, field) : undefined,
        label: FIELD_LABELS[field] ?? field,
        source: item.source[field] ?? null,
        values,
        multiline: rule.multiline,
        maxlength: rule.max,
        hidden: hiddenFields.includes(field),
      };
    }),
  }));
}
