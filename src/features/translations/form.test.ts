import { describe, expect, it } from 'vitest';
import { emptyInputName, fieldInputName, parseTranslationForm } from './form';

const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

describe('parseTranslationForm', () => {
  const product = new Map([['prod_a', 1]]);
  const variant = new Map([['var_a', 10]]);

  it('reads every field of the rows the form rendered', () => {
    const { writes, errors } = parseTranslationForm(
      form({
        [fieldInputName('product', 'prod_a', 'name')]: ' Tracolla ',
        [fieldInputName('product', 'prod_a', 'description')]: '',
        [fieldInputName('product', 'prod_a', 'variant_label')]: 'Colore',
        [fieldInputName('variant', 'var_a', 'label')]: 'Rosso',
      }),
      { product, variant },
    );
    expect(errors).toEqual([]);
    expect(writes).toEqual([
      { entity: 'product', id: 1, publicId: 'prod_a', fields: { name: 'Tracolla', description: null, variant_label: 'Colore' } },
      { entity: 'variant', id: 10, publicId: 'var_a', fields: { label: 'Rosso' } },
    ]);
  });

  it('stores a deliberately empty field as an empty string', () => {
    const { writes } = parseTranslationForm(
      form({
        [fieldInputName('product', 'prod_a', 'name')]: 'Tracolla',
        [fieldInputName('product', 'prod_a', 'description')]: '',
        [emptyInputName('product', 'prod_a', 'description')]: '1',
      }),
      { product },
    );
    expect(writes[0].fields).toMatchObject({ description: '' });
  });

  it('does not allow "empty on purpose" where the field cannot be empty', () => {
    const { writes } = parseTranslationForm(
      form({ [fieldInputName('product', 'prod_a', 'name')]: '', [emptyInputName('product', 'prod_a', 'name')]: '1' }),
      { product },
    );
    expect(writes[0].fields).toMatchObject({ name: null });
  });

  it('ignores rows and columns the form may not write', () => {
    const { writes } = parseTranslationForm(
      form({
        [fieldInputName('product', 'prod_other', 'name')]: 'Altro',
        [fieldInputName('product', 'prod_a', 'price_cents')]: '1',
        [fieldInputName('variant', 'var_b', 'label')]: 'Blu',
      }),
      { product, variant },
    );
    expect(writes).toEqual([]);
  });

  it('refuses an over-long value', () => {
    const { errors } = parseTranslationForm(form({ [fieldInputName('menuItem', 'nav_a', 'label')]: 'x'.repeat(61) }), {
      menuItem: new Map([['nav_a', 3]]),
    });
    expect(errors).toHaveLength(1);
  });
});
