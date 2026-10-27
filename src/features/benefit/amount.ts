import { currencyDecimals, minorUnitsPerMajor } from '../../money';

/**
 * Benefit Mode's contribution amounts: the first price a shopper chooses
 * rather than reads from D1. Pure, so every entry point (cart, buy now,
 * checkout form, JSON checkout) runs the same rules and they can be tested
 * without the runtime. Amounts are integer minor units end to end.
 */

/** Stripe's per-charge ceiling in minor units (999,999.99 in two-decimal currencies). */
export const PROVIDER_MAX_MINOR = 99_999_999;

/** Default safety cap against typos: 10,000 in the store currency's major units. */
export const DEFAULT_SAFETY_CAP_MAJOR = 10_000;

export type AmountProblem = 'invalid' | 'precision' | 'below_minimum' | 'above_maximum';

export type AmountResult = { ok: true; cents: number } | { ok: false; problem: AmountProblem };

/**
 * Shopper input in major units → integer minor units. Accepts "25", "25.5",
 * "25,50" (a decimal comma, as Italian keyboards type it) and surrounding
 * spaces; refuses thousands separators, signs, exponents and more decimals than
 * the currency has, rather than guessing what was meant.
 */
export function parseAmountInput(raw: string | null | undefined, currency: string): AmountResult {
  const text = String(raw ?? '').trim();
  const m = /^(\d{1,9})(?:[.,](\d+))?$/.exec(text);
  if (!m) return { ok: false, problem: 'invalid' };
  const decimals = currencyDecimals(currency);
  const fraction = m[2] ?? '';
  // "25.50" in EUR is fine; "25.505" is not, and neither is "25.5" in JPY.
  if (fraction.replace(/0+$/, '').length > decimals) return { ok: false, problem: 'precision' };
  const cents = Number(m[1]) * minorUnitsPerMajor(currency) + Number(fraction.padEnd(decimals, '0').slice(0, decimals) || 0);
  return Number.isSafeInteger(cents) ? { ok: true, cents } : { ok: false, problem: 'invalid' };
}

/** The ceiling for one unit: the store's cap (if any), never above the provider's. */
export function maximumCents(capCents: number | null): number {
  return capCents != null && capCents > 0 ? Math.min(capCents, PROVIDER_MAX_MINOR) : PROVIDER_MAX_MINOR;
}

/**
 * Check a per-unit contribution against the product's current minimum and the
 * ceiling. A contribution exactly at the minimum is valid; the minimum is a
 * floor, never a component of the amount.
 */
export function checkContribution(cents: number, minimumCents: number, capCents: number | null): AmountResult {
  if (!Number.isSafeInteger(cents) || cents < 0) return { ok: false, problem: 'invalid' };
  if (cents < minimumCents) return { ok: false, problem: 'below_minimum' };
  if (cents > maximumCents(capCents)) return { ok: false, problem: 'above_maximum' };
  return { ok: true, cents };
}

/** Parse then check, the usual path for a form field. */
export function readContribution(
  raw: string | null | undefined,
  currency: string,
  minimumCents: number,
  capCents: number | null,
): AmountResult {
  const parsed = parseAmountInput(raw, currency);
  return parsed.ok ? checkContribution(parsed.cents, minimumCents, capCents) : parsed;
}

/** Minor units → the plain number an `<input type="number">` shows ("25.00", "1000"). */
export function amountInputValue(cents: number, currency: string): string {
  const decimals = currencyDecimals(currency);
  return (cents / minorUnitsPerMajor(currency)).toFixed(decimals);
}

/** The `step` attribute for that input (0.01 for EUR, 1 for JPY). */
export function amountInputStep(currency: string): string {
  const decimals = currencyDecimals(currency);
  return decimals === 0 ? '1' : `0.${'0'.repeat(decimals - 1)}1`;
}
