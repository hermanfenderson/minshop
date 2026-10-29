import type { D1Database } from '@cloudflare/workers-types';
import type { Product } from '../products/db';

/**
 * The free donation the cart offers in Benefit Mode: the shop's plain donation
 * product (Monopolele: Gratitude), i.e. the first active single-unit
 * contribution without variants (isSingleUnitContribution). Added from the cart
 * with the supporter's amount, it lands on the same order and the same receipt
 * as the perks. Null = the shop has none, and the cart offers nothing.
 */
export async function findFreeDonationProduct(db: D1Database): Promise<Product | null> {
  return db
    .prepare(
      `SELECT * FROM products
        WHERE active = 1 AND public_id IS NOT NULL
          AND track_inventory = 0 AND requires_shipping = 0 AND file_key IS NULL
          AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = products.id)
        ORDER BY id
        LIMIT 1`,
    )
    .first<Product>();
}

/**
 * The cart's lines with the free donation, if present, moved to the end — it
 * closes the list whatever order things were added in — and that line itself.
 */
export function freeDonationLast<L extends { product: { public_id: string | null } }>(
  lines: L[],
  freeDonation: { public_id: string | null } | null,
): { lines: L[]; freeLine: L | null } {
  const isFree = (l: L) => !!freeDonation?.public_id && l.product.public_id === freeDonation.public_id;
  const freeLine = lines.find(isFree) ?? null;
  return { lines: freeLine ? [...lines.filter((l) => !isFree(l)), freeLine] : lines, freeLine };
}
