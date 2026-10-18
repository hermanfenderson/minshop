import { describe, expect, it } from 'vitest';
import { resolveI18nSettings } from '../../i18n/settings';
import {
  NO_TRANSLATIONS,
  TRANSLATABLE,
  isBlankTranslation,
  submittedField,
  translated,
  translatedAll,
  translationLocale,
  translationSet,
} from './content';

const product = {
  id: 1,
  name: 'Ukulele strap',
  description: 'Soft cotton.',
  variant_label: 'Colour',
  price_cents: 1500,
  stock: 4,
  slug: 'ukulele-strap',
};

const it_ = (rows: Record<string, Record<number, Record<string, string | null>>>) =>
  translationSet(
    'it',
    Object.fromEntries(Object.entries(rows).map(([e, m]) => [e, new Map(Object.entries(m).map(([k, v]) => [Number(k), v]))])),
  );

describe('translated', () => {
  it('replaces translated fields and keeps the rest', () => {
    const p = translated(it_({ product: { 1: { name: 'Tracolla', description: null, variant_label: null } } }), 'product', product);
    expect(p).toEqual({ ...product, name: 'Tracolla' });
  });

  it('falls back field by field on a partial translation', () => {
    const p = translated(it_({ product: { 1: { name: null, description: 'Cotone morbido.' } } }), 'product', product);
    expect(p.name).toBe('Ukulele strap');
    expect(p.description).toBe('Cotone morbido.');
  });

  it('keeps an empty string as a deliberate empty value', () => {
    const p = translated(it_({ product: { 1: { description: '' } } }), 'product', product);
    expect(p.description).toBe('');
  });

  it('never changes commercial data, even if a row carried such a key', () => {
    const p = translated(
      it_({ product: { 1: { name: 'Tracolla', price_cents: '1', stock: '0', slug: 'tracolla' } as never } }),
      'product',
      product,
    );
    expect(p.price_cents).toBe(1500);
    expect(p.stock).toBe(4);
    expect(p.slug).toBe('ukulele-strap');
  });

  it('returns the row itself when there is nothing to apply', () => {
    expect(translated(NO_TRANSLATIONS, 'product', product)).toBe(product);
    expect(translated(it_({ product: {} }), 'product', product)).toBe(product);
    const rows = [product];
    expect(translatedAll(NO_TRANSLATIONS, 'product', rows)).toBe(rows);
  });

  it('does not mutate the source row', () => {
    translated(it_({ product: { 1: { name: 'Tracolla' } } }), 'product', product);
    expect(product.name).toBe('Ukulele strap');
  });

  it('lists only editorial fields as translatable', () => {
    const all = Object.values(TRANSLATABLE).flatMap((t) => t.fields as readonly string[]);
    for (const commercial of ['price_cents', 'stock', 'sku', 'weight_grams', 'active', 'published', 'slug']) {
      expect(all).not.toContain(commercial);
    }
  });
});

describe('translationLocale', () => {
  const monopolele = resolveI18nSettings({ defaultLocale: 'en', contentSourceLocale: 'en', enabledLocales: ['en', 'it'] });
  it('reads translations only for an enabled language other than the source', () => {
    expect(translationLocale(monopolele, 'it')).toBe('it');
    expect(translationLocale(monopolele, 'en')).toBeNull();
    expect(translationLocale(monopolele, 'de')).toBeNull();
  });
  it('reads nothing in a single-language store', () => {
    expect(translationLocale(resolveI18nSettings(), 'en')).toBeNull();
  });
  it('follows the content source, not the default language', () => {
    const s = resolveI18nSettings({ defaultLocale: 'it', contentSourceLocale: 'en', enabledLocales: ['it', 'en'] });
    expect(translationLocale(s, 'it')).toBe('it');
    expect(translationLocale(s, 'en')).toBeNull();
  });
});

describe('submittedField', () => {
  it('reads a blank field as not translated', () => {
    expect(submittedField('  ')).toBeNull();
    expect(submittedField(undefined)).toBeNull();
  });
  it('reads a blank field marked empty on purpose as an empty value', () => {
    expect(submittedField('', { emptyOnPurpose: true })).toBe('');
  });
  it('trims single-line fields and keeps Markdown indentation', () => {
    expect(submittedField('  Tracolla ')).toBe('Tracolla');
    expect(submittedField('    code\r\n', { multiline: true })).toBe('    code');
  });
  it('knows a row with no value at all', () => {
    expect(isBlankTranslation({ name: null, description: undefined })).toBe(true);
    expect(isBlankTranslation({ name: null, description: '' })).toBe(false);
  });
});
