/**
 * The admin translation form, parsed. Pure, so it is unit-tested without D1.
 *
 * Every input is named `tr|<entity>|<publicId>|<field>`, with an optional
 * `tr-empty|…` checkbox for "empty on purpose". The route passes, per entity,
 * the public IDs this form may write (the rows it rendered, resolved from D1),
 * so a crafted field can neither name a row of another product nor a column
 * outside the editorial list.
 */
import { TRANSLATABLE, submittedField, type TranslatableEntity, type TranslationFields } from './content.ts';

interface FieldRule {
  max: number;
  multiline?: boolean;
  /** The field may be deliberately empty in a language (a blank description). */
  allowEmpty?: boolean;
}

export const FIELD_RULES: { [E in TranslatableEntity]: Record<string, FieldRule> } = {
  product: {
    name: { max: 200 },
    description: { max: 20_000, multiline: true, allowEmpty: true },
    variant_label: { max: 60 },
  },
  variant: { label: { max: 120 } },
  extra: { label: { max: 120 } },
  image: { alt: { max: 300, allowEmpty: true } },
  category: { name: { max: 200 } },
  page: { title: { max: 120 }, body_markdown: { max: 100_000, multiline: true, allowEmpty: true } },
  menuItem: { label: { max: 60 } },
};

export const fieldInputName = (entity: TranslatableEntity, publicId: string, field: string): string =>
  `tr|${entity}|${publicId}|${field}`;
export const emptyInputName = (entity: TranslatableEntity, publicId: string, field: string): string =>
  `tr-empty|${entity}|${publicId}|${field}`;

export interface TranslationWrite<E extends TranslatableEntity = TranslatableEntity> {
  entity: E;
  id: number;
  publicId: string;
  fields: TranslationFields<E>;
}

type FormLike = { get(name: string): unknown };

/**
 * The writes a submitted form asks for, one per allowed row: every editorial
 * field of the row is read (a field left blank becomes NULL, so clearing a
 * translation is a save like any other). Errors name the field.
 */
export function parseTranslationForm(
  form: FormLike,
  allowed: Partial<Record<TranslatableEntity, Map<string, number>>>,
): { writes: TranslationWrite[]; errors: string[] } {
  const writes: TranslationWrite[] = [];
  const errors: string[] = [];
  for (const [entity, rows] of Object.entries(allowed) as Array<[TranslatableEntity, Map<string, number>]>) {
    for (const [publicId, id] of rows) {
      // Only rows the form actually rendered: an absent row is left alone.
      const present = TRANSLATABLE[entity].fields.some((f) => form.get(fieldInputName(entity, publicId, f)) !== null);
      if (!present) continue;
      const fields: Record<string, string | null> = {};
      for (const field of TRANSLATABLE[entity].fields) {
        const rule = FIELD_RULES[entity][field];
        // The editor always renders every field of a row it shows, so an
        // absent field reads as blank like any other.
        const raw = form.get(fieldInputName(entity, publicId, field));
        const empty = rule.allowEmpty === true && form.get(emptyInputName(entity, publicId, field)) !== null;
        const value = submittedField(raw, { emptyOnPurpose: empty, multiline: rule.multiline });
        if (value !== null && value.length > rule.max) {
          errors.push(`${field.replace('_', ' ')} is longer than ${rule.max} characters.`);
          continue;
        }
        fields[field] = value;
      }
      writes.push({ entity, id, publicId, fields: fields as TranslationFields<typeof entity> });
    }
  }
  return { writes, errors };
}
