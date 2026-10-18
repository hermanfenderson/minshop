/**
 * Our language code → the `locale` Stripe Checkout accepts. Pure, so the
 * mapping is testable without the SDK.
 *
 * Stripe renders its hosted page in a fixed list of languages; anything else
 * must be 'auto' (Stripe then follows the browser). The list is Stripe's
 * documented Checkout Session `locale` enum.
 */
const STRIPE_LOCALES = new Set([
  'bg', 'cs', 'da', 'de', 'el', 'en', 'en-GB', 'es', 'es-419', 'et', 'fi', 'fil', 'fr', 'fr-CA',
  'hr', 'hu', 'id', 'it', 'ja', 'ko', 'lt', 'lv', 'ms', 'mt', 'nb', 'nl', 'pl', 'pt', 'pt-BR',
  'ro', 'ru', 'sk', 'sl', 'sv', 'th', 'tr', 'vi', 'zh', 'zh-HK', 'zh-TW',
]);

/** BCP 47 casing Stripe uses ('pt-br' → 'pt-BR'). */
function stripeCase(code: string): string {
  const [lang, ...rest] = code.split('-');
  return [lang.toLowerCase(), ...rest.map((p) => (/^\d+$/.test(p) ? p : p.toUpperCase()))].join('-');
}

/** The Checkout `locale` for a language: exact, else its base language, else 'auto'. */
export function stripeCheckoutLocale(locale: string | null | undefined): string {
  if (!locale) return 'auto';
  const exact = stripeCase(locale);
  if (STRIPE_LOCALES.has(exact)) return exact;
  const base = exact.split('-')[0];
  return STRIPE_LOCALES.has(base) ? base : 'auto';
}
