import type { ShippingOption } from '../shipping/calculator';

/**
 * Checkout shipping when part (or all) of the cart is made and shipped by the
 * fulfiller. Pure: the caller fetches the fulfiller's rate; this decides what
 * the buyer pays and how it combines with the shop's own zone rates.
 */

/** Default surcharge on the fulfiller's rate: the fulfiller's rates are before tax. */
export const DEFAULT_SHIPPING_SURCHARGE_PCT = 22;

/** Round up to this many minor units (50 cents), so prices stay tidy and never undercharge. */
const ROUND_TO = 50;

export function parseSurchargePct(raw: string | null | undefined): number {
  if (raw == null || raw.trim() === '') return DEFAULT_SHIPPING_SURCHARGE_PCT;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : DEFAULT_SHIPPING_SURCHARGE_PCT;
}

/** What the buyer pays for the fulfiller's part: rate plus surcharge, rounded up. */
export function buyerShippingCents(rateCents: number, surchargePct: number): number {
  // Rounded up from the exact amount (rounding to a cent first could land just
  // under a step); the epsilon only absorbs float noise like 610.0000000001.
  const withTax = rateCents * (1 + surchargePct / 100);
  return Math.ceil(withTax / ROUND_TO - 1e-9) * ROUND_TO;
}

/**
 * Fold the fulfiller's part into the zone's options:
 * - pickup is dropped: the fulfiller's items travel from its warehouse;
 * - a free option (free over a threshold, or a 0 rate) stays free — the
 *   merchant promised it, so the merchant absorbs the fulfiller's cost;
 * - when the fulfiller ships everything, the paid options collapse into one at
 *   the fulfiller's price, under the zone's first paid label;
 * - when the shop also ships something, the fulfiller's price is added to each
 *   paid option.
 */
export function combineShippingOptions(
  zoneOptions: ShippingOption[],
  fulfillerCents: number,
  fulfillerShipsEverything: boolean,
): ShippingOption[] {
  const delivered = zoneOptions.filter((o) => !o.pickup);
  const free = delivered.filter((o) => o.amountCents === 0);
  const paid = delivered.filter((o) => o.amountCents > 0);
  if (paid.length === 0) return free;
  const priced = fulfillerShipsEverything
    ? [{ label: paid[0].label, amountCents: fulfillerCents }]
    : paid.map((o) => ({ ...o, amountCents: o.amountCents + fulfillerCents }));
  return [...free, ...priced];
}
