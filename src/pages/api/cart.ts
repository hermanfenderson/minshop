import { readForm } from '../../features/http/form';
import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { readCart, writeCart, CART_QTY_MAX } from '../../features/cart/cart';
import { cartKey, lineUnitPriceCents, parseCartKey } from '../../features/cart/key';
import { getProductByPublicId, type Product } from '../../features/products/db';
import { listVariants, getExtrasByPublicIds, type ProductVariant } from '../../features/products/variants';
import { parsePublicId } from '../../features/ids/publicId.ts';
import { getStoreSettings } from '../../features/settings/db';
import { translatedPurchase, translatedVariantLabel } from '../../features/translations/db';
import { chosenVariantPublicId } from '../../features/products/variantAxes';
import { purchaseLineName } from '../../features/cart/lineName';
import { benefitRules, isSingleUnitContribution } from '../../features/benefit/mode';
import { readContribution } from '../../features/benefit/amount';
import { contributionError } from '../../features/benefit/messages';
import { getConfig } from '../../config';

export const prerender = false;

// POST /api/cart — add / update / remove a line, then back to the cart.
// Lines are keyed by product[:variant][#extras] public-ID tuples. `add` resolves
// the chosen variant + extras (validated against D1); `update`/`remove` act on
// the line key. Numeric row IDs are never accepted.
export const POST: APIRoute = async ({ request, cookies, url, redirect, locals }) => {
  const { t } = locals.i18n;
  const form = await readForm(request);
  const action = String(form.get('_action'));
  const cart = readCart(cookies);
  const partial = request.headers.get('x-partial') === '1';
  const settings = await getStoreSettings(env.DB);
  // Cart switched off in Settings → browse-only; refuse all cart mutations.
  if (!settings.cartEnabled) {
    return partial ? new Response(null, { status: 204 }) : redirect(locals.urls.home(), 303);
  }
  const done = () =>
    partial ? new Response(null, { status: 204 }) : redirect(locals.urls.cart(), 303);
  const currency = getConfig().currency;
  const benefit = benefitRules(settings, currency);

  /**
   * Benefit Mode: the supporter's amount for one unit of this line, checked
   * against the current minimum, or the refusal to show them.
   */
  const chosenAmount = async (
    product: Product,
    variant: ProductVariant | null,
  ): Promise<{ ok: true; cents: number } | { ok: false; message: string }> => {
    const minimumCents = lineUnitPriceCents(product.price_cents, variant, []);
    const raw = form.get('amount');
    // No field (an old page, a crafted post) means the minimum, never a guess.
    const result = raw == null ? { ok: true as const, cents: minimumCents } : readContribution(String(raw), currency, minimumCents, benefit!.capCents);
    if (result.ok) return result;
    const shown = await translatedPurchase(env.DB, locals.contentLocale, product, variant, []);
    return {
      ok: false,
      message: contributionError(locals.i18n, result.problem, {
        name: purchaseLineName(shown.product, shown.variant, []),
        minimumCents,
        capCents: benefit!.capCents,
        currency,
      }),
    };
  };

  // ── amount (Benefit Mode): change the contribution of one line ───────────────
  if (action === 'amount' && benefit) {
    const key = String(form.get('key') ?? '');
    const parsed = parseCartKey(key);
    const qty = cart[key];
    const product = parsed && qty ? await getProductByPublicId(env.DB, parsed.productPublicId) : null;
    if (!parsed || !product || !product.active || !product.public_id) return done();
    const variant = parsed.variantPublicId
      ? ((await listVariants(env.DB, product.id)).find((v) => v.public_id === parsed.variantPublicId) ?? null)
      : null;
    if (parsed.variantPublicId && !variant) return done();
    const amount = await chosenAmount(product, variant);
    if (!amount.ok) {
      return partial
        ? new Response(null, { status: 204 })
        : redirect(locals.urls.href(`/cart?error=${encodeURIComponent(amount.message)}`), 303);
    }
    delete cart[key];
    const next = cartKey(product.public_id, parsed.variantPublicId, [], amount.cents);
    cart[next] = Math.min((cart[next] ?? 0) + qty, isSingleUnitContribution(product) ? 1 : CART_QTY_MAX);
    writeCart(cookies, cart, url.protocol === 'https:');
    return done();
  }

  // ── update / remove: operate on the exact line key ──────────────────────────
  if (action === 'update' || action === 'remove') {
    const key = String(form.get('key') ?? '');
    if (parseCartKey(key)) {
      if (action === 'remove') {
        delete cart[key];
      } else {
        const qty = Number(form.get('qty'));
        if (Number.isInteger(qty) && qty > 0) cart[key] = Math.min(qty, CART_QTY_MAX);
        else delete cart[key];
        // A single-unit contribution stays one unit; its amount is what changes.
        const pid = parseCartKey(key)?.productPublicId;
        if (benefit && pid && cart[key] > 1) {
          const product = await getProductByPublicId(env.DB, pid);
          if (product && isSingleUnitContribution(product)) cart[key] = 1;
        }
      }
    }
    writeCart(cookies, cart, url.protocol === 'https:');
    return done();
  }

  // ── add: product + (required) variant + (optional) extras ───────────────────
  const productPublicId = parsePublicId(form.get('product_id'), 'product');
  const product = productPublicId ? await getProductByPublicId(env.DB, productPublicId) : null;
  if (!product || !product.active || !product.public_id) return done();

  // Variant is required when the product has any.
  const variants = await listVariants(env.DB, product.id);
  let variantPublicId: string | null = null;
  if (variants.length > 0) {
    // variant_id, or — from the multi-axis selector without JavaScript — the
    // option_<i> fields.
    const wanted = chosenVariantPublicId(
      variants,
      product.variant_label,
      parsePublicId(form.get('variant_id'), 'variant'),
      (field) => form.get(field),
    );
    const chosen = wanted ? variants.find((v) => v.public_id === wanted) : undefined;
    if (!chosen) {
      if (partial) return new Response(null, { status: 204 });
      const label =
        (await translatedVariantLabel(env.DB, locals.contentLocale, product)) || t('cart.error.variantFallback');
      return redirect(
        locals.urls.href(`/products/${product.slug}?error=${encodeURIComponent(t('cart.error.chooseVariant', { label }))}`),
        303,
      );
    }
    variantPublicId = chosen.public_id;
  }

  if (benefit) {
    const variant = variantPublicId ? (variants.find((v) => v.public_id === variantPublicId) ?? null) : null;
    const amount = await chosenAmount(product, variant);
    if (!amount.ok) {
      if (partial) return new Response(null, { status: 204 });
      return redirect(
        locals.urls.href(`/products/${product.slug}?error=${encodeURIComponent(amount.message)}`),
        303,
      );
    }
    const key = cartKey(product.public_id, variantPublicId, [], amount.cents);
    if (isSingleUnitContribution(product)) {
      // One line, one unit: a new amount replaces the earlier one.
      for (const existing of Object.keys(cart)) {
        if (parseCartKey(existing)?.productPublicId === product.public_id) delete cart[existing];
      }
      cart[key] = 1;
    } else {
      cart[key] = Math.min((cart[key] ?? 0) + 1, CART_QTY_MAX);
    }
    writeCart(cookies, cart, url.protocol === 'https:');
    return done();
  }

  // Extras: keep only valid, active ones that belong to the product.
  const wantExtras = form
    .getAll('extra')
    .map((v) => parsePublicId(v, 'extra'))
    .filter((v): v is string => v !== null);
  const extras = wantExtras.length
    ? await getExtrasByPublicIds(env.DB, product.id, wantExtras)
    : [];

  const key = cartKey(
    product.public_id,
    variantPublicId,
    extras.flatMap((e) => (e.public_id ? [e.public_id] : [])),
  );
  cart[key] = Math.min((cart[key] ?? 0) + 1, CART_QTY_MAX);

  writeCart(cookies, cart, url.protocol === 'https:');
  return done();
};
