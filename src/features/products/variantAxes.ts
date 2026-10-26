/**
 * Variant axes: a product whose variant group is named "Color / Size" and whose
 * variants are labelled "Black / M", "Black / L", … is shown as one selector per
 * axis instead of one long list. Pure, so the storefront model, the cart and
 * Buy now resolve a choice the same way.
 *
 * The axes are a reading of the labels, not stored data: the variant row stays
 * the unit of price, stock and image. A product qualifies only when the group
 * name and EVERY variant label split into the same number (2+) of non-empty
 * parts and no two variants share a combination; otherwise it keeps the single
 * list, so an odd label never hides a variant.
 */

export const AXIS_SEPARATOR = ' / ';

/** Form field carrying the value index chosen on axis `i`. */
export const axisField = (i: number): string => `option_${i}`;

export interface VariantAxes {
  /** Axis names, e.g. ["Color", "Size"]. */
  names: string[];
  /** Per axis, its values in first-seen order (variants are in position order). */
  values: string[][];
  /** Per variant (same order as the input), the value index on each axis. */
  combos: number[][];
}

function split(label: string, n: number): string[] | null {
  const parts = label.split(AXIS_SEPARATOR).map((p) => p.trim());
  return parts.length === n && parts.every((p) => p !== '') ? parts : null;
}

export function variantAxes(groupLabel: string | null | undefined, labels: string[]): VariantAxes | null {
  if (!groupLabel || labels.length < 2) return null;
  const names = groupLabel.split(AXIS_SEPARATOR).map((p) => p.trim());
  if (names.length < 2 || names.some((n) => n === '')) return null;

  const values: string[][] = names.map(() => []);
  const combos: number[][] = [];
  const seen = new Set<string>();
  for (const label of labels) {
    const parts = split(label, names.length);
    if (!parts) return null;
    const combo = parts.map((part, axis) => {
      let index = values[axis].indexOf(part);
      if (index === -1) index = values[axis].push(part) - 1;
      return index;
    });
    const key = combo.join(',');
    if (seen.has(key)) return null;
    seen.add(key);
    combos.push(combo);
  }
  return { names, values, combos };
}

/**
 * Display names for `axes`, taken from translated labels when they split the
 * same way (same parts per variant, mapping one-to-one onto the source
 * values); otherwise the source names. Values are identified by index, never
 * by text, so a translation can only change what is shown.
 */
export function translatedAxes(
  axes: VariantAxes,
  groupLabel: string | null | undefined,
  labels: string[],
): Pick<VariantAxes, 'names' | 'values'> {
  const shown = variantAxes(groupLabel, labels);
  const sameShape =
    shown !== null &&
    shown.names.length === axes.names.length &&
    shown.values.every((v, i) => v.length === axes.values[i].length) &&
    shown.combos.every((combo, row) => combo.every((value, axis) => value === axes.combos[row][axis]));
  return sameShape ? { names: shown.names, values: shown.values } : { names: axes.names, values: axes.values };
}

/**
 * The variant (index into the input) matching the submitted axis fields, or
 * null when a field is missing, malformed, or the combination does not exist.
 */
export function variantForChoice(axes: VariantAxes, get: (field: string) => unknown): number | null {
  const chosen: number[] = [];
  for (let axis = 0; axis < axes.names.length; axis++) {
    const raw = get(axisField(axis));
    if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null;
    const index = Number(raw);
    if (index >= axes.values[axis].length) return null;
    chosen.push(index);
  }
  const row = axes.combos.findIndex((combo) => combo.every((value, axis) => value === chosen[axis]));
  return row === -1 ? null : row;
}

/**
 * The public ID a product form chose: `variant_id` when present (the single
 * list, scripts, the JSON API), else the axis fields (the two-axis selector
 * without JavaScript). Null when neither names one of `variants`.
 */
export function chosenVariantPublicId(
  variants: { public_id: string | null; label: string }[],
  groupLabel: string | null | undefined,
  wantedPublicId: string | null,
  get: (field: string) => unknown,
): string | null {
  if (wantedPublicId) return variants.some((v) => v.public_id === wantedPublicId) ? wantedPublicId : null;
  const axes = variantAxes(groupLabel, variants.map((v) => v.label));
  if (!axes) return null;
  const row = variantForChoice(axes, get);
  return row === null ? null : variants[row].public_id;
}
