/**
 * The shop's suffix on the shopper's card statement ("PREFIX* SUFFIX"), so several
 * shops sharing one Stripe account read differently there too. Stripe accepts
 * Latin letters, digits and spaces, at least one letter, never < > \ ' " * — and
 * at most 22 characters together with the account's prefix, which only Stripe
 * knows: the checkout retries without the suffix if Stripe refuses it.
 */
export const STATEMENT_SUFFIX_MAX = 22;

/** What the merchant typed → a suffix Stripe accepts, or null (none). */
export function statementSuffix(raw: string | null | undefined): string | null {
  const s = (raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 .,&-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, STATEMENT_SUFFIX_MAX)
    .trim();
  return /[A-Z]/.test(s) ? s : null;
}
