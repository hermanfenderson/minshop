import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { getConfig } from '../../../../config';
import { createI18n } from '../../../../i18n/index.ts';
import { LOCALE_REGISTRY } from '../../../../features/i18n/settings';
import { loadReceiptSettings, receiptImages } from '../../../../features/receipts';
import { buildReceiptDocument, renderReceiptPdf, type ReceiptKind } from '../../../../features/receipts/document';
import { previewDonor } from '../../../../features/receipts/preview';
import { receiptLabel, seriesPrefix } from '../../../../features/receipts/settings';
import { countryName } from '../../../../features/shipping/countries';

export const prerender = false;

const KINDS: Record<string, { kind: ReceiptKind; donor: 'person' | 'company' }> = {
  'donation:person': { kind: 'donation', donor: 'person' },
  'donation:company': { kind: 'donation', donor: 'company' },
  shipping: { kind: 'shipping', donor: 'person' },
  refund_note: { kind: 'refund_note', donor: 'person' },
};

// GET /api/admin/receipts/preview?slot=donation:person&locale=it — the current
// settings drawn on an invented donor and order. Nothing is numbered or stored.
export const GET: APIRoute = async ({ url }) => {
  const choice = KINDS[url.searchParams.get('slot') ?? ''] ?? KINDS['donation:person'];
  const requested = url.searchParams.get('locale') ?? 'en';
  const locale = LOCALE_REGISTRY[requested] ? requested : 'en';
  const settings = await loadReceiptSettings(env.DB);
  const i18n = createI18n(locale);
  const today = new Date().toISOString().slice(0, 10);
  const currency = getConfig().currency.toUpperCase();
  const doc = buildReceiptDocument({
    kind: choice.kind,
    label: receiptLabel(seriesPrefix(settings, choice.kind), 0, Number(today.slice(0, 4))),
    issuedOn: today,
    paidOn: today,
    amountCents: choice.kind === 'shipping' ? 750 : 4000,
    currency,
    orderRef: 'PREVIEW',
    paymentMethod: 'stripe',
    donor: previewDonor(choice.donor),
    gifts: choice.kind === 'donation' ? [{ name: 'T-shirt (M)', quantity: 1 }] : [],
    relatedLabel: choice.kind === 'refund_note' ? receiptLabel(settings.prefix, 0, Number(today.slice(0, 4))) : null,
    settings,
    i18n,
    countryName: (code) => countryName(code, i18n.locale),
  });
  const pdf = renderReceiptPdf(doc, await receiptImages(doc));
  return new Response(pdf, {
    headers: { 'content-type': 'application/pdf', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  });
};
