import { readForm } from '../../features/http/form';
import type { APIRoute } from 'astro';
import type { LocaleUrls } from '../../i18n';
import { acceptedLocale } from '../../features/i18n/order';
import { requestLanguage } from '../../features/i18n/request';
import { LOCALE_REGISTRY, languageSettings } from '../../features/i18n/settings';
import { MOUNT } from '../../deployment';
import { env } from 'cloudflare:workers';
import { getProductByPublicId, getProductBySlug, type Product } from '../../features/products/db';
import { sellableStock } from '../../features/products/stock';
import {
  listVariants,
  getExtrasByPublicIds,
  type ProductVariant,
  type ProductExtra,
} from '../../features/products/variants';
import { parsePublicId } from '../../features/ids/publicId.ts';
import {
  claimOrderIdentity,
  deleteGuestAccessIfUnsettled,
} from '../../features/orders/guestAccess.ts';
import { lineUnitPriceCents } from '../../features/cart/key';
import { productImageUrl } from '../../features/products/image';
import { readCart, resolveCart } from '../../features/cart/cart';
import {
  getPaymentProvider,
  enabledMethods,
  defaultMethod,
  isMethodAvailable,
  type PaymentMethod,
  STRIPE_CHECKOUT_TTL_SECONDS,
  OPENNODE_CHECKOUT_TTL_SECONDS,
  RESERVATION_EXPIRY_GRACE_SECONDS,
  DEMO_CHECKOUT_TTL_SECONDS,
} from '../../features/payments';
import { getStoreSettings } from '../../features/settings/db';
import { createConfigRatesCalculator } from '../../features/shipping/calculator';
import { shippingFor } from '../../features/shipping/effective';
import { shipmentWeightFor } from '../../features/shipping/lines';
import { quoteFulfillerShipping } from '../../features/fulfillment';
import { combineShippingOptions } from '../../features/fulfillment/shippingQuote';
import { stripeAllowedCountries, stripeSessionDestination } from '../../features/payments/stripeCountries.ts';
import { getConfig } from '../../config';
import {
  reserveInventory,
  releaseInventoryReservation,
} from '../../features/orders/reservations';
import { reservationItems, type LineDraft } from '../../features/orders/reservationItems.ts';
import { purgeStockProductCache } from '../../features/cache/purge';
import { lifecycleActive } from '../../features/digitalDelivery/rollout.ts';
import { mintLightningOrder } from '../../features/payments/lightning-provider';
import { getLightningBackend } from '../../features/payments/lightning';
import type { I18n } from '../../i18n/index.ts';
import { purchaseLineName } from '../../features/cart/lineName';
import { loadTranslations, translatedPurchase, translatedVariantLabel } from '../../features/translations/db';
import { translated, translatedAll, translationLocale } from '../../features/translations/content';
import { benefitRules, BENEFIT_PAYMENT_METHODS, isSingleUnitContribution } from '../../features/benefit/mode';
import { checkContribution, readContribution } from '../../features/benefit/amount';
import { contributionError } from '../../features/benefit/messages';
import { findFreeDonationProduct } from '../../features/benefit/freeDonation';
import { parseDonor, type Donor, type DonorProblem } from '../../features/benefit/donor';
import { writeDonorDraft } from '../../features/benefit/donorDraft';

export const prerender = false;

interface ShipTo {
  email: string;
  name: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postal: string;
  country: string;
}

/** Validate an agent-supplied `ship_to` object; null if incomplete/invalid. */
function parseShipTo(raw: unknown): ShipTo | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const s = (k: string) => (typeof r[k] === 'string' ? (r[k] as string).trim() : '');
  const email = s('email');
  const name = s('name');
  const line1 = s('line1');
  const city = s('city');
  const postal = s('postal');
  const country = s('country').toUpperCase();
  if (!/.+@.+\..+/.test(email) || !name || !line1 || !city || !postal || country.length !== 2) {
    return null;
  }
  return { email, name, line1, line2: s('line2') || null, city, state: s('state') || null, postal, country };
}

const MAX_CHECKOUT_LINES = 50;
const MAX_JSON_BYTES = 64 * 1024;

function reservationTtlSeconds(method: PaymentMethod): number {
  if (method === 'demo') return DEMO_CHECKOUT_TTL_SECONDS;
  if (method === 'lightning') {
    return (
      getConfig().payments.lightning.invoiceExpiryMinutes * 60 +
      RESERVATION_EXPIRY_GRACE_SECONDS
    );
  }
  const providerTtl =
    method === 'opennode' ? OPENNODE_CHECKOUT_TTL_SECONDS : STRIPE_CHECKOUT_TTL_SECONDS;
  return providerTtl + RESERVATION_EXPIRY_GRACE_SECONDS;
}

// Open CORS so browser-based agents/tools can POST cross-origin.
const CHECKOUT_CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};
const cjson = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...CHECKOUT_CORS },
  });

export const OPTIONS: APIRoute = () => new Response(null, { status: 204, headers: CHECKOUT_CORS });

// GET /api/checkout — discovery: which payment methods this store offers, so an
// agent can choose one to pass as { method } below.
export const GET: APIRoute = async () => {
  const settings = await getStoreSettings(env.DB);
  const methods = enabledMethods(settings);
  return cjson({ available_methods: methods, default: methods[0] });
};

// Creates a checkout session for either a single "Buy now" product (when
// product_id is posted) or the whole cart. Pricing + stock come from D1.
// JSON Content-Type → the programmatic (agent) path: returns { checkout_url }
// instead of a redirect. Form posts keep the existing browser flow below.
export const POST: APIRoute = async ({ request, cookies, url, redirect: astroRedirect, locals }) => {
  const urls = locals.urls;
  if ((request.headers.get('content-type') ?? '').includes('application/json')) {
    return handleJsonCheckout(request, url, urls, locals.i18n);
  }
  // Every redirect below names a LOGICAL path ('/cart', '/products/x?error=…');
  // the URL builder adds the mount. The hosted-checkout hop uses Response.redirect.
  const redirect = (path: string, status: 301 | 302 | 303 | 307 | 308 = 303) =>
    astroRedirect(urls.href(path), status);
  // The browser flow: every refusal below is read by the shopper, on /cart or the
  // product page (both show `?error=` as-is), so it is rendered in their language.
  const i18n = locals.i18n;
  const { t } = i18n;

  const form = await readForm(request);
  const origin = url.origin;
  const settings = await getStoreSettings(env.DB);
  // Benefit Mode: each line's price is a minimum the supporter may raise.
  const benefit = benefitRules(settings, getConfig().currency);

  let lines: LineDraft[] = [];
  let cancelUrl = urls.absolute('/');
  // Where to send the shopper if a stock check fails (cart, or the product).
  let errorPath = '/cart';

  // Forms submit prefixed public IDs only; numeric row IDs are never accepted.
  const productIdRaw = form.get('product_id');
  const productPublicId = parsePublicId(productIdRaw, 'product');
  if (productIdRaw != null && String(productIdRaw).trim() !== '' && !productPublicId) {
    return new Response(t('checkout.error.invalidProductId'), { status: 400 });
  }
  if (productPublicId) {
    const product = await getProductByPublicId(env.DB, productPublicId);
    if (!product || !product.active) {
      return new Response(t('checkout.error.productUnavailable'), { status: 404 });
    }
    // Express "Buy now" — resolve variant + extras right here so it checks out
    // WITHOUT the cart (works even when the cart is switched off).
    const variants = await listVariants(env.DB, product.id);
    let variant: ProductVariant | null = null;
    if (variants.length > 0) {
      const wantedVariant = parsePublicId(form.get('variant_id'), 'variant');
      variant = wantedVariant ? (variants.find((v) => v.public_id === wantedVariant) ?? null) : null;
      if (!variant) {
        const label =
          (await translatedVariantLabel(env.DB, locals.contentLocale, product)) || t('checkout.error.variantFallback');
        return redirect(
          `/products/${product.slug}?error=${encodeURIComponent(t('checkout.error.chooseVariant', { label }))}`,
          303,
        );
      }
    }
    const extraPublicIds = form
      .getAll('extra')
      .map((v) => parsePublicId(v, 'extra'))
      .filter((v): v is string => v !== null);
    // Extras are off in Benefit Mode: the one amount is the whole contribution.
    const extras = extraPublicIds.length && !benefit
      ? await getExtrasByPublicIds(env.DB, product.id, extraPublicIds)
      : [];
    // The order keeps the name in the shopper's language.
    const shown = await translatedPurchase(env.DB, locals.contentLocale, product, variant, extras);
    const name = purchaseLineName(shown.product, shown.variant, shown.extras);
    const priceCents = lineUnitPriceCents(product.price_cents, variant, extras);
    let unitPriceCents = priceCents;
    if (benefit) {
      // No field (a crafted post) means the minimum, never a guess.
      const raw = form.get('amount');
      const amount = raw == null
        ? { ok: true as const, cents: priceCents }
        : readContribution(String(raw), getConfig().currency, priceCents, benefit.capCents);
      if (!amount.ok) {
        const message = contributionError(i18n, amount.problem, {
          name,
          minimumCents: priceCents,
          capCents: benefit.capCents,
          currency: getConfig().currency,
        });
        return redirect(`/products/${product.slug}?error=${encodeURIComponent(message)}`, 303);
      }
      unitPriceCents = amount.cents;
    }
    lines = [
      {
        product,
        qty: 1,
        name,
        unitPriceCents,
        availableStock: sellableStock(product, variant ? variant.stock : product.stock),
        variantId: variant?.id ?? null,
        ...(benefit ? { minimumCents: priceCents } : {}),
      },
    ];
    cancelUrl = urls.absolute(`/products/${product.slug}?canceled=1`);
    errorPath = `/products/${product.slug}`;
  } else {
    const { lines: cartLines } = await resolveCart(env.DB, readCart(cookies), locals.contentLocale, benefit);
    // Benefit Mode: an amount that no longer passes (the minimum rose since it
    // was added) is refused here; the cart shows the line and its new floor.
    const refused = cartLines.find((l) => l.amountProblem);
    if (benefit && refused?.amountProblem) {
      const message = contributionError(i18n, refused.amountProblem, {
        name: purchaseLineName(refused.product, refused.variant, []),
        minimumCents: refused.minimumCents,
        capCents: benefit.capCents,
        currency: getConfig().currency,
      });
      return redirect(`/cart?error=${encodeURIComponent(message)}`, 303);
    }
    lines = cartLines.map((l) => ({
      product: l.product,
      qty: l.qty,
      // "Tee — Large (Gift wrap)", already in the shopper's language.
      name: purchaseLineName(l.product, l.variant, l.extras),
      unitPriceCents: l.unitPriceCents,
      availableStock: l.availableStock,
      variantId: l.variant?.id ?? null,
      ...(benefit ? { minimumCents: l.minimumCents } : {}),
    }));
    cancelUrl = urls.absolute('/cart?canceled=1');
  }

  if (lines.length === 0) return redirect('/cart', 303);

  // Benefit Mode: the free donation is «Free donation» / «Donazione libera» on the
  // order, its page and its emails, as in the cart, not the product's own name
  // (Gratitude) — Mauro, 2026-10-30.
  if (benefit) {
    const free = await findFreeDonationProduct(env.DB);
    if (free) for (const l of lines) if (l.product.id === free.id) l.name = i18n.t('benefit.cart.free.name');
  }

  // Don't oversell — check the variant's stock (or the product's), not the base.
  const short = lines.find((l) => l.availableStock < l.qty);
  if (short) {
    const msg =
      short.availableStock <= 0
        ? t('checkout.error.lineSoldOut', { name: short.name })
        : t('checkout.error.lineShort', { count: short.availableStock, name: short.name });
    return redirect(`${errorPath}?error=${encodeURIComponent(msg)}`, 303);
  }

  // The buyer picks a rail on the cart page (method buttons). An explicitly-chosen
  // real rail that isn't configured → setup instructions (the cart links there too,
  // this guards a crafted POST). Otherwise resolve to a usable method (demo always).
  const requestedRaw = String(form.get('method') ?? '').trim();
  const requested = requestedRaw as PaymentMethod;
  if (
    requestedRaw &&
    requestedRaw !== 'demo' &&
    (['stripe', 'lightning', 'opennode'] as string[]).includes(requestedRaw) &&
    !isMethodAvailable(requested, settings)
  ) {
    return redirect(`/payment-setup?method=${encodeURIComponent(requestedRaw)}`, 303);
  }
  const available = enabledMethods(settings);
  // No method enabled → no checkout. Bounce back to the cart (which says so).
  if (available.length === 0) return redirect('/cart', 303);
  // Cart checkout passes an explicit method (the picker buttons). Express buy-now
  // passes none → use the store's default (available[0] — the default rail first).
  const selected: PaymentMethod =
    (available.includes(requested) ? requested : available[0]) ?? defaultMethod(settings);

  const cfg = getConfig();

  // Benefit Mode collects the donor before payment (R14) and supports the rails
  // that need no in-app address step; the receipt needs both.
  let donor: Donor | null = null;
  if (benefit) {
    if (!(BENEFIT_PAYMENT_METHODS as readonly string[]).includes(selected)) {
      return redirect(`${errorPath}?error=${encodeURIComponent(t('benefit.error.method'))}`, 303);
    }
    const get = (name: string) => form.get(name);
    writeDonorDraft(cookies, get, url.protocol === 'https:');
    const parsed = parseDonor(get);
    if (!parsed.ok) {
      // Back to the form the details were typed in (buy now's is /express), with
      // the same line; the draft cookie refills the fields.
      const back = new URLSearchParams();
      if (productPublicId) {
        back.set('product_id', productPublicId);
        const vid = parsePublicId(form.get('variant_id'), 'variant');
        if (vid) back.set('variant_id', vid);
        const amount = String(form.get('amount') ?? '').trim();
        if (amount) back.set('amount', amount);
      }
      back.set('error', donorProblemsMessage(i18n, parsed.problems));
      return redirect(productPublicId ? `/express?${back}` : `/cart?${back}`, 303);
    }
    donor = parsed.donor;
  }

  // Lightning + shipping enabled: we must collect the address before we can total
  // the order (zone-accurate shipping), so route to the own-checkout page. Carry the
  // buy-now product + variant/extras so it prices the same line. Stripe & OpenNode
  // collect/handle shipping on their own hosted page, so they continue below.
  const effectiveShipping = shippingFor(settings).config;
  // Digital-only baskets never collect an address or pay for delivery, whatever
  // the store's shipping setting says.
  const shipment = shipmentWeightFor(lines);
  const shippingApplies = effectiveShipping.enabled && shipment.shippingRequired;

  // Rails that cannot collect a destination on their own hosted page go through the
  // in-app step first: Lightning has no hosted page, OpenNode's ignores addresses,
  // and Demo has none. Without this, OpenNode charged no shipping at all and Demo
  // billed whichever rate sorted first — both silently wrong once a merchant can
  // edit rates. Stripe collects the address itself and continues below.
  const IN_APP_SHIPPING_RAILS = ['lightning', 'opennode', 'demo'];
  if (benefit && IN_APP_SHIPPING_RAILS.includes(selected) && shippingApplies) {
    // The in-app address page knows nothing of contributions or donors.
    return redirect(`${errorPath}?error=${encodeURIComponent(t('benefit.error.method'))}`, 303);
  }
  if (IN_APP_SHIPPING_RAILS.includes(selected) && shippingApplies) {
    const params = new URLSearchParams({ method: selected });
    if (productPublicId) {
      params.set('product_id', productPublicId);
      const vid = parsePublicId(form.get('variant_id'), 'variant');
      if (vid) params.set('variant_id', vid);
      for (const ex of form.getAll('extra')) {
        const xid = parsePublicId(ex, 'extra');
        if (xid) params.append('extra', xid);
      }
    }
    return redirect(`/checkout?${params}`, 303);
  }

  const provider = await getPaymentProvider(selected);
  // Single store currency: charge every line in it (Stripe can't mix currencies
  // in one session). New products already default to this; legacy rows are coerced.
  const storeCurrency = cfg.currency;

  // Shipping (when enabled): rates come from the shared zone calculator. Stripe
  // Checkout shows a STATIC list (it collects the address itself, after this), so
  // it gets the primary zone's options; zone-accurate per-address shipping is the
  // own-checkout (Lightning) path's job — Stripe can't recompute mid-session.
  const subtotalCents = lines.reduce((s, l) => s + l.unitPriceCents * l.qty, 0);
  const shipCalc = createConfigRatesCalculator(effectiveShipping, i18n);
  // The shopper pre-selects a destination on the cart (defaulted, editable), so
  // Stripe gets that zone's rates instead of always the first zone's. Stripe still
  // collects + confirms the full address on its page; this just sets which rates
  // it shows. Falls back to the first zone's country (e.g. buy-now, no selector).
  const countryField = form.get('country');
  const selectedCountry = countryField == null ? null : String(countryField).trim().toUpperCase();
  // Nullable on purpose: an invented fallback (say 'US' for a CU-only store)
  // would fail later as "we don't ship to US" — true but useless. The absence of
  // ANY Stripe-supported configured country is its own, configuration-level
  // problem and gets named as such before quoting or reserving.
  const stripeFallbackCountry =
    stripeAllowedCountries(shipCalc.allowedCountries(), shipCalc.hasCatchAll())[0] ?? null;
  // Absent → the supported fallback. PRESENT → taken as supplied, even when
  // malformed: stripeSessionDestination rejects anything that is not a real
  // alpha-2 code, so 'USA' becomes a refusal, not a silent quote for a
  // destination the shopper never chose. (Empty string counts as absent — that
  // is a selector that submitted nothing, not a chosen value.)
  const shipCountry = selectedCountry ? selectedCountry : stripeFallbackCountry;
  if (shippingApplies && shipCountry == null) {
    return redirect(
      `${errorPath}?error=${encodeURIComponent(t('checkout.shipping.errorCardDestinations'))}`,
      303,
    );
  }
  const quote = shippingApplies && shipCountry != null
    ? shipCalc.quoteFor({
        subtotalCents,
        country: shipCountry,
        itemWeightGrams: shipment.itemWeightGrams,
        missingWeight: shipment.missingWeight,
      })
    : null;
  // No options for a REQUIRED shipment blocks the order — sending Stripe an empty
  // option list (or an empty allowed_countries) is an API error, not "no shipping".
  if (quote && quote.options.length === 0) {
    const missing = quote.omitted.some((o) => o.reason === 'missing_weight');
    if (missing) {
      console.error(
        JSON.stringify({
          event: 'shipping_quote_blocked',
          reason: 'missing_weight',
          country: shipCountry,
          products: quote.missingWeight.map(
            (m) => lines.find((l) => l.product.id === m.productId)?.product.public_id ?? m.name,
          ),
        }),
      );
    }
    return redirect(
      `${errorPath}?error=${encodeURIComponent(
        missing
          ? t('checkout.shipping.errorMissingWeight')
          : quote.omitted.some((o) => o.reason === 'overweight')
            ? t('checkout.shipping.errorOverweight')
            : t('checkout.shipping.errorNoShip', { country: shipCountry ?? '' }),
      )}`,
      303,
    );
  }
  // The session collects an address ONLY for the country the rates were priced
  // against. Any wider list lets the shopper keep a cheap zone's rate while
  // entering an address in an expensive one; a crafted country in the POST is
  // refused here, before inventory is reserved.
  const sessionCountries =
    quote && shipCountry
      ? stripeSessionDestination(shipCountry, shipCalc.allowedCountries(), shipCalc.hasCatchAll())
      : null;
  if (quote && !sessionCountries) {
    return redirect(
      `${errorPath}?error=${encodeURIComponent(
        t('checkout.shipping.errorCardNoShip', { country: shipCountry ?? '' }),
      )}`,
      303,
    );
  }
  // Items made and shipped by the fulfiller (Printful) are priced by it, for the
  // chosen country; the shop's zone rates still cover anything it ships itself.
  // No answer in time → the zone rates alone, so checkout never waits on it.
  const fulfiller =
    quote && sessionCountries && shipCountry
      ? await quoteFulfillerShipping(
          env.DB,
          lines.map((l) => ({
            variantId: l.variantId,
            productRef: l.product.fulfillment_ref ?? null,
            productRateRef: l.product.fulfillment_rate_ref ?? null,
            quantity: l.qty,
            requiresShipping: l.product.requires_shipping !== 0,
          })),
          shipCountry,
          storeCurrency,
        )
      : null;
  const shippingOptions =
    quote && fulfiller ? combineShippingOptions(quote.options, fulfiller.cents, fulfiller.shipsEverything) : quote?.options;
  if (quote && shippingOptions?.length === 0) {
    return redirect(
      `${errorPath}?error=${encodeURIComponent(t('checkout.shipping.errorNoShip', { country: shipCountry ?? '' }))}`,
      303,
    );
  }
  const shipping =
    quote && sessionCountries && shippingOptions
      ? {
          addressCountries: sessionCountries,
          hasCatchAll: false,
          options: shippingOptions,
          shipmentWeightGrams: quote.shipmentWeightGrams,
        }
      : undefined;

  // Claim the order's public identity + guest credential BEFORE provider
  // handoff: the ord_ id ties reservation → pending payment → settled order,
  // and the access token is the only thing guest URLs carry. success_url points
  // at /order/<token>; the webhook stores the ord_ id on the order.
  const { publicId, accessToken } = await claimOrderIdentity(env.DB);
  const items = reservationItems(lines);
  const reserved = await reserveInventory(
    env.DB,
    publicId,
    items,
    reservationTtlSeconds(selected),
    selected,
    purgeStockProductCache,
  );
  if (!reserved) {
    await deleteGuestAccessIfUnsettled(env.DB, publicId);
    return redirect(
      `${errorPath}?error=${encodeURIComponent(t('checkout.error.reservationFailed'))}`,
      303,
    );
  }
  if (donor) await storeReservationDonor(publicId, donor);

  let checkoutUrl: string;
  try {
    const result = await provider.createCheckout({
      lineItems: lines.map((l) => ({
        name: l.name,
        amountCents: l.unitPriceCents,
        currency: storeCurrency,
        quantity: l.qty,
        // Same image/placeholder resolution as the storefront, made absolute so
        // Stripe can fetch it (won't render from localhost).
        imageUrl: new URL(productImageUrl(l.product.image_key, cfg.images.baseUrl), origin).href,
      })),
      successUrl: urls.absolute(`/order/${accessToken}`),
      // Returning from a hosted checkout does not make that session unpayable,
      // so inventory remains held until its verified expiry/failure webhook.
      cancelUrl,
      shipping,
      // Benefit Mode: a contribution is what the supporter chose — no code
      // lowers it, and donations carry no tax (R16).
      allowPromotionCodes: benefit ? false : (settings.discountsEnabled ?? cfg.discounts.enabled),
      donation: Boolean(benefit),
      automaticTax: benefit ? false : (settings.taxEnabled ?? cfg.tax.enabled),
      orderItemsJson: JSON.stringify(
        lines.map((l) => ({ id: l.product.id, q: l.qty, n: l.name, p: l.unitPriceCents, v: l.variantId })),
      ),
      // Provider metadata stays bounded (and NEVER carries the access token);
      // the cart snapshot is held in D1.
      metadata: {
        public_id: publicId,
        reservation_id: publicId,
      },
      accessToken,
      payUrl: urls.absolute(`/pay/${accessToken}`),
      locale: locals.locale,
    });
    checkoutUrl = result.url;
  } catch (error) {
    // Compensate the whole claim: stock hold AND the guest credential.
    await releaseInventoryReservation(env.DB, publicId, purgeStockProductCache);
    await deleteGuestAccessIfUnsettled(env.DB, publicId);
    throw error;
  }

  return Response.redirect(checkoutUrl, 303);
};

/** Keep the donor with the checkout until it settles and its receipt is issued. */
async function storeReservationDonor(publicId: string, donor: Donor): Promise<void> {
  await env.DB.prepare('UPDATE checkout_reservations SET donor = ? WHERE public_id = ?')
    .bind(JSON.stringify(donor), publicId)
    .run();
}

/** "Please check the receipt details: tax code, city." in the supporter's language. */
function donorProblemsMessage(i18n: I18n, problems: DonorProblem[]): string {
  const LABEL = {
    first_name: 'benefit.donor.firstName',
    last_name: 'benefit.donor.lastName',
    company_name: 'benefit.donor.companyName',
    tax_code: 'benefit.donor.taxCode',
    vat: 'benefit.donor.vat',
    address: 'benefit.donor.address',
    postal: 'benefit.donor.postal',
    city: 'benefit.donor.city',
    country: 'benefit.donor.country',
  } as const;
  const fields = [...new Set(problems.map((p) => i18n.t(LABEL[p.field])))].join(', ');
  return i18n.t('benefit.donor.error', { fields });
}

/**
 * Programmatic checkout for agents/tools. Body:
 *   { items: [{ product_id, quantity, variant_id?, extra_ids?: string[] }], method? }
 * `product_id` is the prefixed public ID (`prod_…`) from the catalog; `slug` is
 * accepted as a documented convenience selector. `variant_id` (`var_…`) is
 * required for products that have a variant group; `extra_ids` (`xtra_…`) are
 * optional add-ons — all from the catalog (GET /api/products/:slug). Numeric
 * row IDs and the legacy numeric `extras` array are rejected with 400.
 * Resolves selectors → priced lines (variant/extra-aware), validates stock,
 * creates a hosted checkout session, and returns { checkout_url } as JSON — the
 * agent hands that URL to the human to pay (honest given agentic-payment
 * standards aren't settled). Reuses the same createCheckout() as the browser
 * flow, so shipping/tax/discounts behave the same.
 *
 * Its `error`/`note` strings are part of the machine-readable agent contract and
 * stay English; `i18n` only names the synthesized free-shipping rate, so its label
 * matches the browser flow's (agents echo labels back as `shipping_label`).
 */
async function handleJsonCheckout(
  request: Request,
  url: URL,
  urls: LocaleUrls,
  i18n: I18n,
): Promise<Response> {
  const origin = url.origin;

  // Early reject on the declared size, then enforce the cap on the bytes we
  // actually read — a missing/lying content-length header can't slip past.
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    return cjson({ error: 'Checkout body is too large.' }, 413);
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return cjson({ error: 'Invalid request body.' }, 400);
  }
  if (new TextEncoder().encode(raw).length > MAX_JSON_BYTES) {
    return cjson({ error: 'Checkout body is too large.' }, 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return cjson({ error: 'Invalid JSON body.' }, 400);
  }
  const rawItems = (body as { items?: unknown })?.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return cjson({ error: 'Body must be { "items": [{ "product_id": "prod_…", "quantity": number }] }.' }, 400);
  }
  if (rawItems.length > MAX_CHECKOUT_LINES) {
    return cjson({ error: `A checkout can contain at most ${MAX_CHECKOUT_LINES} lines.` }, 400);
  }

  // Optional { method } selects the rail; default = the store's default (first
  // available). Must be one the store actually offers.
  const jsonSettings = await getStoreSettings(env.DB);
  // An agent may name the shopper's language in the body. It is honoured only
  // when the store has it enabled; otherwise the request's own language
  // (?lang=, already validated by the middleware) applies. The return URLs
  // follow the language the order will be stored with.
  const jsonLanguages = languageSettings(jsonSettings);
  const jsonLocale =
    acceptedLocale((body as { locale?: unknown }).locale, jsonLanguages.enabledLocales) ?? i18n.locale;
  if (jsonLocale !== i18n.locale) {
    ({ urls, i18n } = requestLanguage(
      jsonLanguages,
      LOCALE_REGISTRY,
      MOUNT,
      jsonLocale,
      url.origin,
      { path: '/', search: '' },
      jsonSettings.commerceMode === 'benefit' ? 'benefit' : undefined,
    ));
  }
  const available = enabledMethods(jsonSettings);
  if (available.length === 0) {
    return cjson({ error: 'This store is not accepting payments right now.' }, 503);
  }
  const requested =
    typeof (body as { method?: unknown }).method === 'string'
      ? ((body as { method: string }).method.trim() as PaymentMethod)
      : undefined;
  if (requested && !available.includes(requested)) {
    return cjson({ error: `Unsupported payment method "${requested}".`, available_methods: available }, 400);
  }
  const method: PaymentMethod = requested ?? available[0] ?? defaultMethod(jsonSettings);

  const cfg = getConfig();
  const effectiveShipping = shippingFor(jsonSettings).config;

  // Benefit Mode: per-item `amount_cents` (default: the minimum) and a `donor`
  // object for the receipt, with the donor form's field names minus "donor_".
  const jsonBenefit = benefitRules(jsonSettings, cfg.currency);
  let jsonDonor: Donor | null = null;
  if (jsonBenefit) {
    if (!(BENEFIT_PAYMENT_METHODS as readonly string[]).includes(method)) {
      return cjson({ error: `Contributions are paid with ${BENEFIT_PAYMENT_METHODS.join(' or ')}.`, available_methods: BENEFIT_PAYMENT_METHODS }, 400);
    }
    const rawDonor = (body as { donor?: unknown }).donor;
    const donorFields = rawDonor && typeof rawDonor === 'object' ? (rawDonor as Record<string, unknown>) : {};
    const parsedDonor = parseDonor((name) => {
      const value = donorFields[name.replace(/^donor_/, '')];
      return typeof value === 'boolean' ? (value ? 'on' : '') : value;
    });
    if (!parsedDonor.ok) {
      return cjson(
        {
          error: 'This store issues contribution receipts: "donor" needs { first_name, last_name, tax_code (Italy), address, postal, city, country } or, with "company": true, { company_name, vat, address, postal, city, country }.',
          problems: parsedDonor.problems,
        },
        400,
      );
    }
    jsonDonor = parsedDonor.donor;
  }

  // Resolve each { product_id | slug, quantity, variant_id?, extra_ids? } → a
  // priced line, validating active + variant choice + stock. All identifiers
  // are prefixed public IDs from the catalog (GET /api/products/:slug); numeric
  // row IDs are never accepted.
  interface AgentLine extends LineDraft {
    variant: ProductVariant | null;
    extras: ProductExtra[];
  }
  const lines: AgentLine[] = [];
  for (const raw of rawItems) {
    const r = raw as {
      product_id?: unknown;
      slug?: unknown;
      quantity?: unknown;
      variant_id?: unknown;
      extra_ids?: unknown;
      extras?: unknown;
      amount_cents?: unknown;
    };
    // The legacy numeric `extras` array is rejected outright, not silently read.
    if (r.extras !== undefined) {
      return cjson(
        { error: 'The numeric "extras" array is no longer accepted; pass "extra_ids": ["xtra_…"].' },
        400,
      );
    }
    const qty = Number(r.quantity);

    // Product selector: prefixed public ID (canonical) or slug (convenience).
    let product: Product | null = null;
    let selector = '';
    if (r.product_id !== undefined) {
      const pid = parsePublicId(r.product_id, 'product');
      if (!pid) {
        return cjson(
          { error: 'Each "product_id" must be a prefixed public ID ("prod_…") — numeric IDs are not accepted.' },
          400,
        );
      }
      selector = pid;
      product = await getProductByPublicId(env.DB, pid);
    } else {
      const slug = typeof r.slug === 'string' ? r.slug.trim() : '';
      if (!slug) return cjson({ error: 'Each item needs a "product_id" (or "slug").' }, 400);
      selector = slug;
      product = await getProductBySlug(env.DB, slug);
    }
    if (!Number.isInteger(qty) || qty < 1) return cjson({ error: `Invalid quantity for "${selector}".` }, 400);
    if (!product || !product.active) return cjson({ error: `Product not found: ${selector}` }, 404);
    const slug = product.slug;

    // Variant: required when the product has any. Validate it belongs + is active.
    const variants = await listVariants(env.DB, product.id);
    let variant: ProductVariant | null = null;
    if (variants.length > 0) {
      if (r.variant_id !== undefined && typeof r.variant_id !== 'string') {
        return cjson(
          { error: `"variant_id" must be a prefixed public ID ("var_…") — numeric IDs are not accepted.` },
          400,
        );
      }
      const wanted = parsePublicId(r.variant_id, 'variant');
      variant = wanted ? (variants.find((v) => v.public_id === wanted) ?? null) : null;
      if (!variant) {
        return cjson(
          {
            error: `"${slug}" requires a valid "variant_id" (${product.variant_label || 'option'}).`,
            product_id: product.public_id,
            slug,
            variants: variants.map((v) => ({ id: v.public_id, label: v.label, in_stock: sellableStock(product, v.stock) > 0 })),
          },
          400,
        );
      }
    }

    // Extras: keep the valid, active add-ons that belong to the product.
    let extras: ProductExtra[] = [];
    if (r.extra_ids !== undefined) {
      if (!Array.isArray(r.extra_ids)) {
        return cjson({ error: '"extra_ids" must be an array of "xtra_…" public IDs.' }, 400);
      }
      const wantExtras: string[] = [];
      for (const x of r.extra_ids) {
        const xid = parsePublicId(x, 'extra');
        if (!xid) {
          return cjson(
            { error: 'Every "extra_ids" entry must be a prefixed public ID ("xtra_…") — numeric IDs are not accepted.' },
            400,
          );
        }
        wantExtras.push(xid);
      }
      extras = wantExtras.length ? await getExtrasByPublicIds(env.DB, product.id, wantExtras) : [];
    }

    const availableStock = sellableStock(product, variant ? variant.stock : product.stock);
    if (availableStock < qty) {
      const label = variant ? `${product.name} — ${variant.label}` : product.name;
      return cjson(
        {
          error: availableStock <= 0 ? `${label} is sold out.` : `Only ${availableStock} of ${label} in stock.`,
          product_id: product.public_id,
          slug,
          available: availableStock,
        },
        409,
      );
    }

    if (jsonBenefit) {
      // Extras are off in Benefit Mode; the amount is the whole contribution.
      if (extras.length > 0) return cjson({ error: 'Add-ons are not offered with contributions.' }, 400);
      const minimumCents = lineUnitPriceCents(product.price_cents, variant, []);
      const chosen = r.amount_cents === undefined ? minimumCents : Number(r.amount_cents);
      const check = checkContribution(chosen, minimumCents, jsonBenefit.capCents);
      if (!check.ok) {
        return cjson(
          {
            error: `"amount_cents" for "${slug}" must be a whole number of minor units from ${minimumCents} to ${jsonBenefit.capCents}.`,
            reason: check.problem,
            minimum_cents: minimumCents,
            maximum_cents: jsonBenefit.capCents,
          },
          400,
        );
      }
      lines.push({
        product,
        qty: isSingleUnitContribution(product) ? 1 : qty,
        name: purchaseLineName(product, variant, []),
        unitPriceCents: check.cents,
        availableStock,
        variantId: variant?.id ?? null,
        variant,
        extras: [],
        minimumCents,
      });
      continue;
    }

    lines.push({
      product,
      qty,
      name: purchaseLineName(product, variant, extras),
      unitPriceCents: lineUnitPriceCents(product.price_cents, variant, extras),
      availableStock,
      variantId: variant?.id ?? null,
      variant,
      extras,
    });
  }

  // Names in the order's language, read for every line in one batch.
  const jsonContentLocale = translationLocale(jsonLanguages, jsonLocale);
  if (jsonContentLocale) {
    const tr = await loadTranslations(env.DB, jsonContentLocale, {
      product: lines.map((l) => l.product.id),
      variant: lines.map((l) => l.variant?.id),
      extra: lines.flatMap((l) => (l.extras ?? []).map((e) => e.id)),
    });
    for (const l of lines) {
      l.name = purchaseLineName(
        translated(tr, 'product', l.product),
        l.variant ? translated(tr, 'variant', l.variant) : null,
        translatedAll(tr, 'extra', l.extras ?? []),
      );
    }
  }

  const storeCurrency = cfg.currency;
  const subtotalCents = lines.reduce((s, l) => s + l.unitPriceCents * l.qty, 0);
  const shipCalc = createConfigRatesCalculator(effectiveShipping, i18n);
  const stripeFallbackCountry =
    stripeAllowedCountries(shipCalc.allowedCountries(), shipCalc.hasCatchAll())[0] ?? null;
  // Weight comes from the D1 rows resolved above; a request body never supplies it.
  const shipment = shipmentWeightFor(lines);
  const shippingOn = effectiveShipping.enabled && shipment.shippingRequired;
  const quoteFor = (country: string) =>
    shipCalc.quoteFor({
      subtotalCents,
      country,
      itemWeightGrams: shipment.itemWeightGrams,
      missingWeight: shipment.missingWeight,
    });
  /** 422 with a reason an agent can act on, from the same quote the browser uses. */
  const productByRowId = new Map(lines.map((l) => [l.product.id, l.product]));
  const shippingProblem = (country: string, quote: ReturnType<typeof quoteFor>) => {
    if (quote.omitted.some((o) => o.reason === 'missing_weight')) {
      console.error(
        JSON.stringify({
          event: 'shipping_quote_blocked',
          reason: 'missing_weight',
          country: country.toUpperCase(),
          products: quote.missingWeight.map(
            (m) => productByRowId.get(m.productId)?.public_id ?? m.name,
          ),
        }),
      );
      return cjson(
        {
          error: 'Shipping cannot be calculated: some items have no shipping weight recorded.',
          reason: 'missing_weight',
          items: quote.missingWeight.map((m) => ({
            product_id: productByRowId.get(m.productId)?.public_id ?? null,
            slug: productByRowId.get(m.productId)?.slug ?? null,
            name: m.name,
          })),
        },
        422,
      );
    }
    if (quote.omitted.some((o) => o.reason === 'overweight')) {
      return cjson(
        {
          error: 'This order is too heavy for the available shipping services.',
          reason: 'overweight',
          shipment_weight_grams: quote.shipmentWeightGrams,
        },
        422,
      );
    }
    return cjson(
      { error: `This store does not ship to ${country.toUpperCase()}.`, reason: 'destination' },
      422,
    );
  };
  // The static preflight prices the FIRST configured country, which only Stripe
  // needs (its hosted page takes a fixed list before knowing the address). The
  // in-app rails must be judged solely on the ship_to they submit — quoting the
  // first zone here rejected orders that their own destination could serve.
  // Agents may choose the destination the Stripe session is priced for; without
  // one the first Stripe-supported configured country is used.
  // Absent/undefined → the supported fallback. Present in ANY other form — a
  // string of the wrong shape, a number, null — is a claim about the destination
  // and must be judged, not silently replaced with a different country.
  const shipCountryRaw = (body as { ship_country?: unknown }).ship_country;
  if (shipCountryRaw !== undefined && typeof shipCountryRaw !== 'string') {
    return cjson(
      { error: '"ship_country" must be an ISO 3166-1 alpha-2 string.', reason: 'destination' },
      422,
    );
  }
  const stripeCountry =
    shipCountryRaw === undefined ? stripeFallbackCountry : shipCountryRaw.trim().toUpperCase();
  if (shippingOn && method === 'stripe' && stripeCountry == null) {
    return cjson(
      {
        error:
          'None of the configured shipping destinations are supported by Stripe checkout. Pass "ship_country" or use another payment method.',
        reason: 'destination',
      },
      422,
    );
  }
  const hostedQuote =
    shippingOn && method === 'stripe' && stripeCountry != null ? quoteFor(stripeCountry) : null;
  if (hostedQuote && hostedQuote.options.length === 0) {
    return shippingProblem(stripeCountry ?? '', hostedQuote);
  }
  // Narrow the session to the quoted country (see the form path): a wider list
  // would let the payer keep this zone's rate while shipping to another.
  const sessionCountries =
    hostedQuote && stripeCountry
      ? stripeSessionDestination(stripeCountry, shipCalc.allowedCountries(), shipCalc.hasCatchAll())
      : null;
  if (hostedQuote && !sessionCountries) {
    return cjson(
      {
        error: `Stripe checkout cannot collect an address in ${stripeCountry}.`,
        reason: 'destination',
      },
      422,
    );
  }
  const shipping =
    hostedQuote && sessionCountries
      ? {
          addressCountries: sessionCountries,
          hasCatchAll: false,
          options: hostedQuote.options,
          shipmentWeightGrams: hostedQuote.shipmentWeightGrams,
        }
      : undefined;

  // The JSON API has no interactive step, so every rail that cannot collect an
  // address on a hosted page takes it as `ship_to` here: the agent supplies the
  // address, we price THAT country, and the chosen rate travels with the charge.
  // Without this, OpenNode and Demo reached their adapters with an unselected list
  // and charged nothing for shipping.
  const IN_APP_JSON_RAILS = ['lightning', 'opennode', 'demo'];
  const needsShipTo = shippingOn && IN_APP_JSON_RAILS.includes(method);
  if (jsonBenefit && needsShipTo) {
    return cjson({ error: 'Contributions with something to ship are paid with stripe.', available_methods: ['stripe'] }, 400);
  }
  let shipTo: ReturnType<typeof parseShipTo> = null;
  let chosen: { label: string; amountCents: number; pickup?: boolean } | undefined;
  let inAppQuote: ReturnType<typeof quoteFor> | null = null;

  if (needsShipTo) {
    shipTo = parseShipTo((body as { ship_to?: unknown }).ship_to);
    if (!shipTo) {
      return cjson(
        {
          error: `A shipped ${method} order needs a "ship_to" address: { email, name, line1, city, postal, country }.`,
          available_methods: available,
        },
        400,
      );
    }
    inAppQuote = quoteFor(shipTo.country);
    const shipOptions = inAppQuote.options;
    if (shipOptions.length === 0) return shippingProblem(shipTo.country, inAppQuote);
    const wantLabel =
      typeof (body as { shipping_label?: unknown }).shipping_label === 'string'
        ? (body as { shipping_label: string }).shipping_label
        : null;
    chosen = wantLabel ? shipOptions.find((o) => o.label === wantLabel) : shipOptions[0];
    if (!chosen) {
      return cjson(
        {
          error: `Unknown shipping_label "${wantLabel}".`,
          shipping_options: shipOptions.map((o) => ({ label: o.label, amount_cents: o.amountCents })),
        },
        400,
      );
    }
  }

  if (method === 'lightning' && shippingOn && shipTo && chosen && inAppQuote) {
    const { publicId: lnPublicId, accessToken: lnAccessToken } = await claimOrderIdentity(env.DB);
    const lnReserved = await reserveInventory(
      env.DB,
      lnPublicId,
      reservationItems(lines),
      reservationTtlSeconds('lightning'),
      'lightning',
      purgeStockProductCache,
    );
    if (!lnReserved) {
      await deleteGuestAccessIfUnsettled(env.DB, lnPublicId);
      return cjson({ error: 'Some inventory just sold out. Refresh the catalog and retry.' }, 409);
    }
    try {
      const minted = await mintLightningOrder(env.DB, await getLightningBackend(), {
        origin,
        publicId: lnPublicId,
        accessToken: lnAccessToken,
        payUrl: urls.absolute(`/pay/${lnAccessToken}`),
        locale: jsonLocale,
        currency: storeCurrency,
        subtotalCents,
        shippingCents: chosen.amountCents,
        shippingLabel: chosen.label,
        shippingWeightGrams: inAppQuote.shipmentWeightGrams,
        deliveryMethod: chosen.pickup ? 'pickup' : 'shipping',
        itemsJson: JSON.stringify(
          lines.map((l) => ({ id: l.product.id, v: l.variantId, q: l.qty, n: l.name, p: l.unitPriceCents })),
        ),
        email: shipTo.email,
        shippingAddress: {
          name: shipTo.name,
          line1: shipTo.line1,
          line2: shipTo.line2,
          city: shipTo.city,
          state: shipTo.state,
          postal: shipTo.postal,
          country: shipTo.country,
        },
        reservationId: lnPublicId,
      });
      return cjson({
        method,
        available_methods: available,
        flow: 'invoice',
        checkout_url: minted.payUrl,
        ...(lifecycleActive()
          ? { order_status_url: urls.absolute(`/order/${lnAccessToken}/status`) }
          : {}),
        lightning: {
          invoice: minted.bolt11,
          amount_sat: minted.amountSat,
          payment_hash: minted.paymentHash,
          expires_at: minted.expiresAt,
        },
        order_public_id: lnPublicId,
        currency: storeCurrency.toUpperCase(),
        subtotal_cents: subtotalCents,
        shipping_cents: chosen.amountCents,
        shipping_label: chosen.label,
        total_cents: subtotalCents + chosen.amountCents,
        ship_to: shipTo,
        items: lines.map((l) => ({
          slug: l.product.slug,
          name: l.name,
          quantity: l.qty,
          variant: l.variant ? { id: l.variant.public_id, label: l.variant.label } : null,
          extras: l.extras.map((e) => ({ id: e.public_id, label: e.label })),
          unit_price_cents: l.unitPriceCents,
          line_total_cents: l.unitPriceCents * l.qty,
        })),
        note: 'Pay the BOLT11 `lightning.invoice` from any Lightning wallet — the total includes shipping, and the order captures your ship_to address. Settlement is confirmed by the webhook.',
      });
    } catch (error) {
      // The Lightning node can be briefly unreachable. Release the held stock and
      // the guest credential, and return a retryable 503 rather than a 500, so an
      // agent can back off + retry.
      await releaseInventoryReservation(env.DB, lnPublicId, purgeStockProductCache);
      await deleteGuestAccessIfUnsettled(env.DB, lnPublicId);
      console.error(
        JSON.stringify({
          event: 'lightning_invoice_failed',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      return cjson(
        { error: 'Lightning is temporarily unavailable. Retry shortly, or use another method.', available_methods: available },
        503,
      );
    }
  }

  const { publicId, accessToken } = await claimOrderIdentity(env.DB);
  const provider = await getPaymentProvider(method);
  const items = reservationItems(lines);
  const reserved = await reserveInventory(
    env.DB,
    publicId,
    items,
    reservationTtlSeconds(method),
    method,
    purgeStockProductCache,
  );
  if (!reserved) {
    await deleteGuestAccessIfUnsettled(env.DB, publicId);
    return cjson({ error: 'Some inventory just sold out. Refresh the catalog and retry.' }, 409);
  }
  if (jsonDonor) await storeReservationDonor(publicId, jsonDonor);

  let result;
  try {
    result = await provider.createCheckout({
      lineItems: lines.map((l) => ({
        name: l.name,
        amountCents: l.unitPriceCents,
        currency: storeCurrency,
        quantity: l.qty,
        imageUrl: new URL(productImageUrl(l.product.image_key, cfg.images.baseUrl), origin).href,
      })),
      successUrl: urls.absolute(`/order/${accessToken}`),
      cancelUrl: urls.absolute('/'),
      shipping: method === 'stripe' ? shipping : undefined,
      ...(chosen &&
        shipTo && {
          selectedShipping: {
            label: chosen.label,
            amountCents: chosen.amountCents,
            weightGrams: inAppQuote?.shipmentWeightGrams ?? null,
            deliveryMethod: chosen.pickup ? 'pickup' : 'shipping',
            address: {
              name: shipTo.name,
              line1: shipTo.line1,
              line2: shipTo.line2,
              city: shipTo.city,
              state: shipTo.state,
              postal: shipTo.postal,
              country: shipTo.country,
            },
            email: shipTo.email,
          },
        }),
      allowPromotionCodes: jsonBenefit ? false : (jsonSettings.discountsEnabled ?? cfg.discounts.enabled),
      donation: Boolean(jsonBenefit),
      automaticTax: jsonBenefit ? false : (jsonSettings.taxEnabled ?? cfg.tax.enabled),
      orderItemsJson: JSON.stringify(
        lines.map((l) => ({ id: l.product.id, q: l.qty, n: l.name, p: l.unitPriceCents, v: l.variantId })),
      ),
      metadata: {
        public_id: publicId,
        reservation_id: publicId,
      },
      accessToken,
      payUrl: urls.absolute(`/pay/${accessToken}`),
      locale: jsonLocale,
    });
  } catch (error) {
    await releaseInventoryReservation(env.DB, publicId, purgeStockProductCache);
    await deleteGuestAccessIfUnsettled(env.DB, publicId);
    throw error;
  }

  // Lightning: surface the BOLT11 invoice so an agent with a wallet can pay it
  // directly (no human, no /pay page). Settlement is confirmed by the existing
  // webhook → the order is recorded. Hosted providers expose checkout_url only.
  const ln = result.lightning;
  return cjson({
    method, // the rail used: 'stripe' | 'lightning' | 'opennode'
    available_methods: available, // what else this store offers
    flow: ln ? 'invoice' : 'redirect',
    checkout_url: result.url, // human fallback (QR page for Lightning, hosted page otherwise)
    ...(lifecycleActive() ? { order_status_url: urls.absolute(`/order/${accessToken}/status`) } : {}),
    ...(ln && {
      lightning: {
        invoice: ln.invoice,
        amount_sat: ln.amountSat,
        payment_hash: ln.paymentHash,
        expires_at: ln.expiresAt,
      },
    }),
    order_public_id: publicId,
    currency: storeCurrency.toUpperCase(),
    subtotal_cents: subtotalCents,
    // The rate this order was priced with, when the in-app step chose one —
    // the Lightning branch has always echoed it; demo/OpenNode should too.
    ...(chosen && {
      shipping_cents: chosen.amountCents,
      shipping_label: chosen.label,
      total_cents: subtotalCents + chosen.amountCents,
    }),
    items: lines.map((l) => ({
      slug: l.product.slug,
      name: l.name,
      quantity: l.qty,
      variant: l.variant ? { id: l.variant.public_id, label: l.variant.label } : null,
      extras: l.extras.map((e) => ({ id: e.public_id, label: e.label })),
      unit_price_cents: l.unitPriceCents,
      line_total_cents: l.unitPriceCents * l.qty,
    })),
    note: ln
      ? 'Pay the BOLT11 `lightning.invoice` from any Lightning wallet — no human needed; the order is recorded once settlement is confirmed. Or open checkout_url for the QR page.'
      : 'Open checkout_url to complete payment. Shipping, tax, and discounts (if enabled) are applied on the hosted checkout page.',
  });
}
