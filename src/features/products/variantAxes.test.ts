import { describe, expect, it } from 'vitest';
import { axisField, chosenVariantPublicId, translatedAxes, variantAxes, variantForChoice } from './variantAxes';

const labels = ['White / S', 'White / M', 'Black / S', 'Black / M'];

describe('variantAxes', () => {
  it('reads two axes from the group name and labels, values in first-seen order', () => {
    expect(variantAxes('Color / Size', labels)).toEqual({
      names: ['Color', 'Size'],
      values: [['White', 'Black'], ['S', 'M']],
      combos: [[0, 0], [0, 1], [1, 0], [1, 1]],
    });
  });

  it('keeps the single list when the labels do not split cleanly', () => {
    expect(variantAxes('Size', ['S', 'M'])).toBeNull();
    expect(variantAxes('Color / Size', ['White / S', 'Black'])).toBeNull();
    expect(variantAxes('Color / Size', ['White / S', ' / M'])).toBeNull();
    expect(variantAxes('Color / Size', ['White / S', 'White / S'])).toBeNull();
    expect(variantAxes(null, labels)).toBeNull();
  });

  it('allows missing combinations', () => {
    const axes = variantAxes('Color / Size', ['White / S', 'Black / M'])!;
    expect(variantForChoice(axes, (f) => ({ option_0: '0', option_1: '1' })[f])).toBeNull();
    expect(variantForChoice(axes, (f) => ({ option_0: '1', option_1: '1' })[f])).toBe(1);
  });
});

describe('translatedAxes', () => {
  const axes = variantAxes('Color / Size', labels)!;

  it('shows translated names when they map one-to-one', () => {
    const shown = translatedAxes(axes, 'Colore / Taglia', ['Bianco / S', 'Bianco / M', 'Nero / S', 'Nero / M']);
    expect(shown).toEqual({ names: ['Colore', 'Taglia'], values: [['Bianco', 'Nero'], ['S', 'M']] });
  });

  it('falls back to the source when a translation breaks the shape', () => {
    const shown = translatedAxes(axes, 'Colore / Taglia', ['Bianco / S', 'Bianco / M', 'Bianco / S2', 'Nero / M']);
    expect(shown.names).toEqual(['Color', 'Size']);
  });
});

describe('chosenVariantPublicId', () => {
  const variants = labels.map((label, i) => ({ public_id: `var_${i}`, label }));
  const none = () => null;

  it('prefers an explicit variant_id, and only one of this product', () => {
    expect(chosenVariantPublicId(variants, 'Color / Size', 'var_2', none)).toBe('var_2');
    expect(chosenVariantPublicId(variants, 'Color / Size', 'var_9', none)).toBeNull();
  });

  it('resolves the axis fields when there is no variant_id', () => {
    const form = { [axisField(0)]: '1', [axisField(1)]: '1' };
    expect(chosenVariantPublicId(variants, 'Color / Size', null, (f) => form[f])).toBe('var_3');
    expect(chosenVariantPublicId(variants, 'Color / Size', null, (f) => ({ option_0: '1', option_1: 'x' })[f])).toBeNull();
    expect(chosenVariantPublicId(variants, 'Size', null, (f) => form[f])).toBeNull();
  });
});
