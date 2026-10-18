/**
 * The name a purchase line carries — on the checkout page, to the payment
 * provider, and in the order snapshot: "Tee — Large (Gift wrap)". Built from
 * rows already in the shopper's language, so the order keeps the name the
 * shopper saw.
 */
export function purchaseLineName(
  product: { name: string },
  variant: { label: string } | null,
  extras: Array<{ label: string }>,
): string {
  return (
    product.name +
    (variant ? ` — ${variant.label}` : '') +
    (extras.length ? ` (${extras.map((e) => e.label).join(', ')})` : '')
  );
}
